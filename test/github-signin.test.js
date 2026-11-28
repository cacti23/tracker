'use strict'
// "Sign in with GitHub": the serverless OAuth function (api/github-oauth.js) and the
// sync.js side that picks the token up from the URL fragment.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
const handler = require('../api/github-oauth.js')

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: '' }
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v }
  res.end = (b) => { res.body = b || ''; res.ended = true }
  return res
}
async function call(url, { cookie, env = { GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 'csecret' }, fetchImpl } = {}) {
  const saved = { id: process.env.GITHUB_CLIENT_ID, secret: process.env.GITHUB_CLIENT_SECRET, fetch: global.fetch }
  if (env.GITHUB_CLIENT_ID) process.env.GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID; else delete process.env.GITHUB_CLIENT_ID
  if (env.GITHUB_CLIENT_SECRET) process.env.GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET; else delete process.env.GITHUB_CLIENT_SECRET
  const calls = []
  global.fetch = async (u, o) => { calls.push({ u, o }); return fetchImpl ? fetchImpl(u, o) : { json: async () => ({ access_token: 'gho_abc' }) } }
  try {
    const res = fakeRes()
    await handler({ url, headers: { host: 'tracker.example', cookie } }, res)
    return { res, calls }
  } finally {
    if (saved.id === undefined) delete process.env.GITHUB_CLIENT_ID; else process.env.GITHUB_CLIENT_ID = saved.id
    if (saved.secret === undefined) delete process.env.GITHUB_CLIENT_SECRET; else process.env.GITHUB_CLIENT_SECRET = saved.secret
    global.fetch = saved.fetch
  }
}
function stateFrom(res) { return /^tracker_oauth=([0-9a-f]{32})\./.exec(res.headers['set-cookie'])[1] }

test('start: redirects to GitHub asking only for the gist scope, with a state cookie', async () => {
  const { res } = await call('/api/github-oauth?return=%2Fapps%2Fhabits.html')
  assert.equal(res.statusCode, 302)
  const loc = new URL(res.headers.location)
  assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize')
  assert.equal(loc.searchParams.get('scope'), 'gist')
  assert.equal(loc.searchParams.get('client_id'), 'cid')
  assert.equal(loc.searchParams.get('redirect_uri'), 'https://tracker.example/api/github-oauth')
  assert.equal(loc.searchParams.get('state'), stateFrom(res))
  assert.match(res.headers['set-cookie'], /HttpOnly; Secure; SameSite=Lax; Max-Age=600/)
  assert.ok(!res.headers.location.includes('csecret'), 'the client secret never goes to the browser')
})

test('callback: exchanges the code server-side and returns the token in the fragment of the starting page', async () => {
  const start = await call('/api/github-oauth?return=%2Fapps%2Fhabits.html')
  const state = stateFrom(start.res)
  const { res, calls } = await call(`/api/github-oauth?code=c0de&state=${state}`, { cookie: `x=1; tracker_oauth=${state}.%2Fapps%2Fhabits.html` })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].u, 'https://github.com/login/oauth/access_token')
  assert.deepEqual(JSON.parse(calls[0].o.body), { client_id: 'cid', client_secret: 'csecret', code: 'c0de', redirect_uri: 'https://tracker.example/api/github-oauth' })
  assert.equal(res.statusCode, 302)
  assert.equal(res.headers.location, '/apps/habits.html#tracker-signin=gho_abc')
  assert.match(res.headers['set-cookie'], /Max-Age=0/, 'the state cookie is cleared after one use')
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('callback: a wrong or missing state is refused and no code is exchanged', async () => {
  for (const cookie of [undefined, 'tracker_oauth=aaaa.%2F']) {
    const { res, calls } = await call('/api/github-oauth?code=c0de&state=bbbb', { cookie })
    assert.equal(res.statusCode, 400)
    assert.equal(calls.length, 0)
  }
})

test('callback: a cancelled sign-in or failed exchange goes back with an error, never a token', async () => {
  const st = 'f'.repeat(32)
  let r = await call(`/api/github-oauth?error=access_denied&state=${st}`, { cookie: `tracker_oauth=${st}.%2F` })
  assert.equal(r.res.headers.location, '/#tracker-signin-error=access_denied')
  assert.equal(r.calls.length, 0)
  r = await call(`/api/github-oauth?code=c&state=${st}`, { cookie: `tracker_oauth=${st}.%2F`, fetchImpl: () => ({ json: async () => ({ error: 'bad_verification_code' }) }) })
  assert.equal(r.res.headers.location, '/#tracker-signin-error=bad_verification_code')
})

test('only a same-site path can be the return target (no open redirect)', () => {
  for (const bad of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/a b', '', null]) {
    assert.equal(handler.safeReturn(bad), '/', String(bad))
  }
  for (const ok of ['/', '/index.html', '/apps/gym-5day.html', '/apps/habits.html?x=1']) assert.equal(handler.safeReturn(ok), ok)
})

test('not configured: explains instead of redirecting to GitHub', async () => {
  const { res } = await call('/api/github-oauth', { env: {} })
  assert.equal(res.statusCode, 500)
  assert.match(res.body, /not set up/)
})

// ── sync.js side ──
function loadSync(hash, { user = 'octo', confirm = () => true } = {}) {
  const store = new Map()
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  const alerts = [], replaced = [], fetched = []
  const location = { hash, pathname: '/apps/habits.html', search: '', href: 'https://t.example/apps/habits.html' + hash, reload() {} }
  const sandbox = {
    localStorage, location, alerts,
    history: { replaceState: (_s, _t, url) => { replaced.push(url); location.hash = '' } },
    document: { getElementById: () => null },
    fetch: (url) => { fetched.push(url); return Promise.resolve({ ok: /\/user$/.test(url), json: () => Promise.resolve({ login: user }), text: () => Promise.resolve('{}') }) },
    console, JSON, Object, Array, String, Number, Boolean, Date, Math, Promise, Error, setTimeout, clearTimeout,
    alert: (m) => alerts.push(m), prompt: () => null, confirm,
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'sync.js'), 'utf8'), sandbox)
  return { sandbox, localStorage, alerts, replaced, fetched, location }
}

test('sync.js stores the token from #tracker-signin and wipes it from the address bar before the app starts', async () => {
  const { sandbox, localStorage, alerts, replaced } = loadSync('#tracker-signin=gho_abc')
  assert.equal(localStorage.getItem('tracker-sync-token'), 'gho_abc')
  assert.deepEqual(replaced, ['/apps/habits.html'])
  sandbox.DataSync.init({ appId: 'habits', keys: [] })
  await new Promise((r) => setTimeout(r, 20))
  assert.match(alerts.join('\n'), /Signed in with GitHub as @octo/)
})

test('sync.js reports a cancelled sign-in and keeps no token', async () => {
  const { sandbox, localStorage, alerts, replaced } = loadSync('#tracker-signin-error=access_denied')
  assert.equal(localStorage.getItem('tracker-sync-token'), null)
  assert.deepEqual(replaced, ['/apps/habits.html'])
  sandbox.DataSync.init({ appId: 'habits', keys: [] })
  assert.match(alerts.join('\n'), /did not finish \(access_denied\)/)
})

test('sync.js leaves other URL fragments alone', () => {
  const { localStorage, replaced } = loadSync('#exp-12')
  assert.equal(localStorage.getItem('tracker-sync-token'), null)
  assert.deepEqual(replaced, [])
})

function fakeAccountBtn() {
  const classes = new Set(), label = { textContent: '' }
  return { label, title: '', querySelector: (sel) => (sel === '.ds-account-label' ? label : null),
    classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } }
}

test('the separate account button signs in when signed out', () => {
  const { sandbox, location } = loadSync('')
  const btn = fakeAccountBtn()
  sandbox.document.getElementById = (id) => (id === 'dataAccountBtn' ? btn : null)
  sandbox.DataSync.init({ appId: 'habits', keys: [] })
  assert.equal(btn.label.textContent, 'Sign in with GitHub')
  assert.equal(btn.classList.contains('ds-token-set'), false)
  sandbox.DataSync.account()
  assert.equal(location.href, '/api/github-oauth?return=%2Fapps%2Fhabits.html')
})

test('after sign-in the account button shows the GitHub username, and tapping it signs out', async () => {
  const { sandbox, localStorage } = loadSync('#tracker-signin=gho_abc', { user: 'octo' })
  const btn = fakeAccountBtn()
  sandbox.document.getElementById = (id) => (id === 'dataAccountBtn' ? btn : null)
  sandbox.DataSync.init({ appId: 'habits', keys: [] })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(btn.label.textContent, '@octo')
  assert.equal(btn.classList.contains('ds-token-set'), true)
  sandbox.DataSync.account()   // confirm() → true: sign out
  assert.equal(localStorage.getItem('tracker-sync-token'), null)
  assert.equal(btn.label.textContent, 'Sign in with GitHub')
})

test('⚙ stays the manual paste-a-token path and never starts a sign-in', () => {
  const { sandbox, location } = loadSync('')
  sandbox.prompt = () => null
  sandbox.DataSync.init({ appId: 'habits', keys: [] })
  sandbox.DataSync.setToken()
  assert.equal(location.href, 'https://t.example/apps/habits.html')
})

test('every synced page has the separate Sign in with GitHub button', () => {
  for (const f of ['index.html', 'apps/habits.html', 'apps/gym-5day.html']) {
    assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), /id="dataAccountBtn"[^>]*data-click="DataSync\.account"/, f)
  }
})

test('the main service worker never caches the sign-in function', () => {
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /pathname\.startsWith\('\/api\/'\)\) return/)
})

// The hub shows the owner's personal 🌱 Life apps only to @cacti23. The sidebar reads
// <body data-signed-in-as>, which sync.js derives from the stored token and login.
test('body data-signed-in-as follows sign-in and sign-out', async () => {
  const { sandbox } = loadSync('#tracker-signin=gho_abc', { user: 'cacti23' })
  const body = { dataset: {} }
  sandbox.document.body = body
  sandbox.document.getElementById = (id) => (id === 'dataAccountBtn' ? fakeAccountBtn() : null)
  sandbox.DataSync.init({ appId: 'dsa', keys: [] })
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(body.dataset.signedInAs, 'cacti23')
  sandbox.DataSync.account()   // confirm() → true: sign out
  assert.equal(body.dataset.signedInAs, '')
})

test('the 🌱 Life box is hidden unless signed in as cacti23', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'css', 'notebook.css'), 'utf8')  // the page's CSS lives in css/notebook.css
  assert.match(html, /#sidebar-apps \{ display: none; \}/)
  assert.match(html, /body\[data-signed-in-as="cacti23"\] #sidebar-apps \{ display: block; \}/)
})
