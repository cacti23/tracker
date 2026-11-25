'use strict'
// Fixes from the pre-launch security review (2026-11-25), before the hub goes public:
//   1. sign-out cancels the sign-in token at GitHub (they never expire on their own),
//   2. sign-out can erase this browser (shared or public computer),
//   3. "Delete my data" deletes the tracker gist, cancels the token and erases the browser,
//   4. a full browser storage no longer loses a save without a word,
//   5. the callback host can be pinned with PUBLIC_ORIGIN.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
const handler = require('../api/github-oauth.js')

// ── api/github-oauth.js: revoke ──
async function call({ url, method = 'GET', headers = {}, env = {} }) {
  const keys = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'PUBLIC_ORIGIN']
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))
  const savedFetch = global.fetch
  Object.assign(process.env, { GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 'csecret' }, env)
  const calls = []
  global.fetch = async (u, o) => { calls.push({ u, o }); return { status: 204, json: async () => ({}) } }
  try {
    const res = { statusCode: 200, headers: {}, body: '' }
    res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v }
    res.end = (b) => { res.body = b || '' }
    await handler({ url, method, headers: { host: 'tracker.example', ...headers } }, res)
    return { res, calls }
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
    global.fetch = savedFetch
  }
}

test('revoke: cancels a sign-in token at GitHub with the app secret, never exposing it', async () => {
  const { res, calls } = await call({ url: '/api/github-oauth?action=revoke', method: 'POST',
    headers: { authorization: 'Bearer gho_abc123', origin: 'https://tracker.example' } })
  assert.equal(res.statusCode, 204)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].u, 'https://api.github.com/applications/cid/token')
  assert.equal(calls[0].o.method, 'DELETE')
  assert.equal(calls[0].o.headers.Authorization, 'Basic ' + Buffer.from('cid:csecret').toString('base64'))
  assert.deepEqual(JSON.parse(calls[0].o.body), { access_token: 'gho_abc123' })
  assert.ok(!JSON.stringify(res).includes('csecret'))
})

test('revoke: refuses GET, other sites, and tokens this app did not issue', async () => {
  const cases = [
    [{ method: 'GET', headers: { authorization: 'Bearer gho_abc' } }, 405],
    [{ method: 'POST', headers: { authorization: 'Bearer gho_abc', origin: 'https://evil.example' } }, 403],
    [{ method: 'POST', headers: { authorization: 'Bearer ghp_personal' } }, 400],
    [{ method: 'POST', headers: {} }, 400],
  ]
  for (const [opts, status] of cases) {
    const { res, calls } = await call({ url: '/api/github-oauth?action=revoke', ...opts })
    assert.equal(res.statusCode, status, JSON.stringify(opts))
    assert.equal(calls.length, 0)
  }
})

test('PUBLIC_ORIGIN pins the callback, whatever host the request names', async () => {
  const { res } = await call({ url: '/api/github-oauth?return=%2F', env: { PUBLIC_ORIGIN: 'https://hub.example/' },
    headers: { 'x-forwarded-host': 'evil.example' } })
  assert.equal(new URL(res.headers.location).searchParams.get('redirect_uri'), 'https://hub.example/api/github-oauth')
})

// ── js/sync.js: sign-out and Delete my data ──
function loadSync({ token, confirms = [true, true], typed = 'DELETE', gists = [] } = {}) {
  const store = new Map([['dsa-notes-v1', '{"LC_1":"my note"}'], ['dsa-theme', 'dark']])
  if (token) store.set('tracker-sync-token', token)
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k), clear: () => store.clear(),
  }
  const fetched = []
  const fetch = (url, o = {}) => {
    fetched.push({ url, method: o.method || 'GET', auth: o.headers && o.headers.Authorization })
    if (/\/gists\?/.test(url)) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(gists) })
    return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
  }
  let reloaded = 0
  const answers = [...confirms]
  const sandbox = {
    localStorage, fetch, location: { hash: '', pathname: '/', search: '', href: '/', reload() { reloaded++ } },
    history: { replaceState() {} }, document: { getElementById: () => null },
    console, JSON, Object, Array, String, Number, Boolean, Date, Math, Promise, Error, setTimeout, clearTimeout,
    alert() {}, prompt: () => typed, confirm: () => answers.shift(),
  }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'sync.js'), 'utf8'), sandbox)
  return { DataSync: sandbox.DataSync, store, fetched, reloads: () => reloaded }
}

test('sign-out cancels the sign-in token, and "erase" clears this browser', async () => {
  const s = loadSync({ token: 'gho_tok', confirms: [true, true] })
  await s.DataSync.account()
  const revoke = s.fetched.find(f => f.url === '/api/github-oauth?action=revoke')
  assert.ok(revoke, 'revoke was called')
  assert.equal(revoke.method, 'POST')
  assert.equal(revoke.auth, 'Bearer gho_tok')
  assert.equal(s.store.size, 0, 'every key of every app is gone')
  assert.equal(s.reloads(), 1)
})

test('sign-out without "erase" keeps the progress here but still drops and cancels the token', async () => {
  const s = loadSync({ token: 'gho_tok', confirms: [true, false] })
  await s.DataSync.account()
  assert.equal(s.store.get('dsa-notes-v1'), '{"LC_1":"my note"}')
  assert.equal(s.store.has('tracker-sync-token'), false)
  assert.ok(s.fetched.some(f => f.url === '/api/github-oauth?action=revoke'))
})

test('a pasted personal token is not sent to our server on sign-out', async () => {
  const s = loadSync({ token: 'ghp_personal', confirms: [true, false] })
  await s.DataSync.account()
  assert.equal(s.fetched.length, 0)
})

test('Delete my data: deletes only the tracker gist, cancels the token, erases the browser', async () => {
  const gists = [{ id: 'g1', description: 'tracker-sync-v1' }, { id: 'other', description: 'my dotfiles' }]
  const s = loadSync({ token: 'gho_tok', gists })
  const msg = await s.DataSync.deleteMyData()
  const deletes = s.fetched.filter(f => f.method === 'DELETE').map(f => f.url)
  assert.deepEqual(deletes, ['https://api.github.com/gists/g1'])
  assert.ok(s.fetched.some(f => f.url === '/api/github-oauth?action=revoke'))
  assert.equal(s.store.size, 0)
  assert.match(msg, /Deleted 1 synced gist,/)
})

test('Delete my data does nothing unless DELETE is typed', async () => {
  const s = loadSync({ token: 'gho_tok', typed: 'yes', gists: [{ id: 'g1', description: 'tracker-sync-v1' }] })
  const msg = await s.DataSync.deleteMyData()
  assert.equal(msg, 'Nothing was deleted.')
  assert.equal(s.fetched.length, 0)
  assert.equal(s.store.get('dsa-notes-v1'), '{"LC_1":"my note"}')
})

test('the Privacy page is in the hub sidebar and its button has no inline handler', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  assert.match(html, /id="nav-privacy"[^>]*onclick="loadEmbed\('privacy'\)"/)
  assert.match(html, /src: 'dsa\/privacy\.html'/)
  const page = fs.readFileSync(path.join(ROOT, 'dsa', 'privacy.html'), 'utf8')
  assert.match(page, /id="deleteBtn"/)
  assert.doesNotMatch(page, /\son[a-z]+="/)
})

// ── js/data.js: storage full ──
function loadData({ capacity }) {
  const store = new Map()
  const size = () => [...store].reduce((n, [k, v]) => n + k.length + v.length, 0)
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      const before = store.get(k); store.set(k, String(v))
      if (size() > capacity) { if (before === undefined) store.delete(k); else store.set(k, before); throw new Error('QuotaExceededError') }
    },
    removeItem: (k) => store.delete(k),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
  const alerts = []
  const sandbox = { localStorage, alert: (m) => alerts.push(m), console, JSON, Object, Array, Date, Math, String, Number, addEventListener() {} }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'dates.js'), 'utf8'), sandbox)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8'), sandbox)
  return { sandbox, store, alerts }
}

test('a full storage drops the old undo snapshots to make room, and the save lands', () => {
  const { sandbox, store, alerts } = loadData({ capacity: 400 })
  store.set('dsa-presync-2', 'x'.repeat(150))
  store.set('dsa-presync-3', 'x'.repeat(150))
  vm.runInContext('setNote("LC_1", "' + 'n'.repeat(100) + '")', sandbox)
  assert.ok(store.get('dsa-notes-v1').includes('nnn'))
  assert.equal(store.has('dsa-presync-3'), false)
  assert.deepEqual(alerts, [])
})

test('when nothing can be freed, the user is told once that the change was not saved', () => {
  const { sandbox, alerts } = loadData({ capacity: 50 })
  assert.doesNotThrow(() => vm.runInContext('setNote("LC_1", "' + 'n'.repeat(100) + '"); setNote("LC_2", "' + 'm'.repeat(100) + '")', sandbox))
  assert.equal(alerts.length, 1)
  assert.match(alerts[0], /storage is full/)
})
