'use strict'
// Short-lived sign-in tokens (GitHub App): the server keeps the refresh token in an HttpOnly
// cookie and renews on request; sync.js renews an 8-hour ghu_ token before it runs out, and
// once more on a 401. The older OAuth App (gho_, no expiry) keeps working when the App keys
// are missing, so nothing breaks before the keys are set in Vercel.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const handler = require('../api/github-oauth.js')
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8')
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 0))

// ── server ──────────────────────────────────────────────────────────────────
const APP = { GITHUB_APP_CLIENT_ID: 'appid', GITHUB_APP_CLIENT_SECRET: 'appsecret' }
const OAUTH = { GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 'csecret' }
const ENV_KEYS = Object.keys(APP).concat(Object.keys(OAUTH), ['PUBLIC_ORIGIN'])

async function call({ url, method = 'GET', headers = {}, env = Object.assign({}, APP, OAUTH), fetchImpl }) {
  const saved = {}, savedFetch = global.fetch, calls = []
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; if (env[k]) process.env[k] = env[k]; else delete process.env[k] }
  global.fetch = async (u, o) => { calls.push({ u, o }); return fetchImpl ? fetchImpl(u, o) : { status: 204, json: async () => ({}) } }
  try {
    const res = { statusCode: 200, headers: {}, body: '' }
    res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v }
    res.end = (b) => { res.body = b || '' }
    await handler({ url, method, headers: Object.assign({ host: 'tracker.example' }, headers) }, res)
    return { res, calls }
  } finally {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
    global.fetch = savedFetch
  }
}
const cookies = (res) => [].concat(res.headers['set-cookie'] || [])

test('server: with the GitHub App keys, sign-in uses the App (no scope) instead of the OAuth App', async () => {
  const { res } = await call({ url: '/api/github-oauth?return=%2F' })
  const loc = new URL(res.headers.location)
  assert.equal(loc.searchParams.get('client_id'), 'appid')
  assert.equal(loc.searchParams.get('scope'), null)
})

test('server: without the App keys, sign-in still uses the OAuth App as before', async () => {
  const { res } = await call({ url: '/api/github-oauth?return=%2F', env: OAUTH })
  const loc = new URL(res.headers.location)
  assert.equal(loc.searchParams.get('client_id'), 'cid')
  assert.equal(loc.searchParams.get('scope'), 'gist')
})

test('server: the callback keeps the refresh token in an HttpOnly cookie and gives the page only the 8-hour token', async () => {
  const st = 'a'.repeat(32)
  const { res, calls } = await call({
    url: `/api/github-oauth?code=c0de&state=${st}`,
    headers: { cookie: `tracker_oauth=${st}.%2Fapps%2Fhabits.html` },
    fetchImpl: () => ({ json: async () => ({ access_token: 'ghu_abc', expires_in: 28800, refresh_token: 'ghr_xyz', refresh_token_expires_in: 15811200 }) }),
  })
  assert.deepEqual(JSON.parse(calls[0].o.body).client_id, 'appid')
  assert.equal(res.headers.location, '/apps/habits.html#tracker-signin=ghu_abc&expires_in=28800')
  assert.ok(!res.headers.location.includes('ghr_'), 'the refresh token never goes to the page')
  const rc = cookies(res).find((c) => c.startsWith('tracker_refresh='))
  assert.match(rc, /^tracker_refresh=ghr_xyz; Path=\/api\/github-oauth; HttpOnly; Secure; SameSite=Strict; Max-Age=15811200$/)
  assert.ok(cookies(res).some((c) => /^tracker_oauth=;.*Max-Age=0/.test(c)), 'the state cookie is still cleared')
})

test('server: refresh trades the cookie for a new token and a new cookie', async () => {
  const { res, calls } = await call({
    url: '/api/github-oauth?action=refresh', method: 'POST',
    headers: { cookie: 'tracker_refresh=ghr_old', origin: 'https://tracker.example' },
    fetchImpl: () => ({ json: async () => ({ access_token: 'ghu_new', expires_in: 28800, refresh_token: 'ghr_new', refresh_token_expires_in: 15811200 }) }),
  })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { access_token: 'ghu_new', expires_in: 28800 })
  assert.deepEqual(JSON.parse(calls[0].o.body), { client_id: 'appid', client_secret: 'appsecret', grant_type: 'refresh_token', refresh_token: 'ghr_old' })
  assert.match(cookies(res)[0], /^tracker_refresh=ghr_new;.*HttpOnly/)
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.ok(!res.body.includes('ghr_'))
})

test('server: refresh refuses GET, other sites and a missing cookie, and a failure keeps the cookie', async () => {
  const cases = [
    [{ method: 'GET', headers: { cookie: 'tracker_refresh=ghr_x' } }, 405],
    [{ method: 'POST', headers: { cookie: 'tracker_refresh=ghr_x', origin: 'https://evil.example' } }, 403],
    [{ method: 'POST', headers: {} }, 401],
  ]
  for (const [opts, status] of cases) {
    const { res, calls } = await call(Object.assign({ url: '/api/github-oauth?action=refresh' }, opts))
    assert.equal(res.statusCode, status, JSON.stringify(opts))
    assert.equal(calls.length, 0)
  }
  const { res } = await call({ url: '/api/github-oauth?action=refresh', method: 'POST', headers: { cookie: 'tracker_refresh=ghr_used' },
    fetchImpl: () => ({ json: async () => ({ error: 'bad_refresh_token' }) }) })
  assert.equal(res.statusCode, 401)
  assert.equal(cookies(res).length, 0, 'another tab may have just renewed: its cookie must survive')
})

test('server: revoke cancels a ghu_ token with the App keys and drops the refresh cookie; gho_ still uses the OAuth keys', async () => {
  let r = await call({ url: '/api/github-oauth?action=revoke', method: 'POST', headers: { authorization: 'Bearer ghu_abc' } })
  assert.equal(r.res.statusCode, 204)
  assert.equal(r.calls[0].u, 'https://api.github.com/applications/appid/token')
  assert.match(cookies(r.res)[0], /^tracker_refresh=;.*Max-Age=0/)
  r = await call({ url: '/api/github-oauth?action=revoke', method: 'POST', headers: { authorization: 'Bearer gho_abc' } })
  assert.equal(r.calls[0].u, 'https://api.github.com/applications/cid/token')
})

// ── sync.js ─────────────────────────────────────────────────────────────────
// A device whose GitHub answers with the given token rules. `valid` is the set of tokens GitHub
// accepts; `renew` is what the refresh endpoint answers.
function device({ hash = '', token, expiresAt, valid, renew }) {
  const store = new Map()
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  if (token) ls.setItem('tracker-sync-token', token)
  if (expiresAt) ls.setItem('tracker-sync-expires', String(expiresAt))
  ls.setItem('tracker-sync-gistid', 'g1')
  ls.setItem('tracker-sync-login', 'octo')
  const calls = []
  const gist = { id: 'g1', description: 'tracker-sync-v1', files: {}, history: [{ version: 'v1' }] }
  const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(JSON.parse(JSON.stringify(body))), text: () => Promise.resolve('') })
  const fetch = (url, o) => {
    o = o || {}
    const auth = (o.headers && o.headers.Authorization) || ''
    calls.push({ url, method: o.method || 'GET', auth })
    if (url === '/api/github-oauth?action=refresh') {
      if (!renew) return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })
      valid.add(renew)
      return ok({ access_token: renew, expires_in: 28800 })
    }
    if (!valid.has(auth.replace('Bearer ', ''))) return Promise.resolve({ ok: false, status: 401, headers: { get: () => null }, text: () => Promise.resolve('Bad credentials') })
    if (/\/gists\/g1$/.test(url) && o.method === 'PATCH') {
      const b = JSON.parse(o.body); Object.keys(b.files).forEach((f) => { gist.files[f] = b.files[f] })
      gist.history = [{ version: 'v' + (gist.history.length + 1) }].concat(gist.history)
      return ok(gist)
    }
    if (/\/gists\/g1$/.test(url)) return ok(gist)
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') })
  }
  const location = { hash, pathname: '/', search: '', reload() {} }
  const sb = { localStorage: ls, location, history: { replaceState: () => { location.hash = '' } }, document: { getElementById: () => null },
    fetch, console, setTimeout, clearTimeout, alert() {}, prompt: () => null, confirm: () => true }
  sb.window = sb
  vm.createContext(sb)
  vm.runInContext(SRC, sb)
  sb.DataSync.init({ appId: 'app', keys: ['a'] })
  return { ls, calls, gist, DS: sb.DataSync }
}
async function push(d) { d.ls.setItem('a', JSON.stringify({ x: Date.now() })); d.DS.pushSoon(1); await tick(60) }

test('sync: the fragment\'s expires_in is stored with the token', () => {
  const before = Date.now()
  const d = device({ hash: '#tracker-signin=ghu_abc&expires_in=28800', valid: new Set() })
  assert.equal(d.ls.getItem('tracker-sync-token'), 'ghu_abc')
  const exp = Number(d.ls.getItem('tracker-sync-expires'))
  assert.ok(exp >= before + 28800 * 1000 && exp <= Date.now() + 28800 * 1000)
})

test('sync: a token about to expire is renewed before the first GitHub call', async () => {
  const d = device({ token: 'ghu_old', expiresAt: Date.now() + 60 * 1000, valid: new Set(['ghu_old']), renew: 'ghu_new' })
  await push(d)
  assert.equal(d.calls[0].url, '/api/github-oauth?action=refresh')
  assert.ok(d.calls.slice(1).every((c) => c.auth === 'Bearer ghu_new'), 'every GitHub call uses the renewed token')
  assert.equal(d.ls.getItem('tracker-sync-token'), 'ghu_new')
  assert.equal(d.DS.health().state, 'ok')
})

test('sync: a 401 on a ghu_ token renews once and retries; a failed renewal shows "sign in again"', async () => {
  const d = device({ token: 'ghu_revoked', expiresAt: Date.now() + 3600 * 1000, valid: new Set(), renew: 'ghu_new' })
  await push(d)
  assert.ok(d.gist.files['app.json'], 'the upload went through after renewing')
  const e = device({ token: 'ghu_revoked', expiresAt: Date.now() + 3600 * 1000, valid: new Set(), renew: null })
  await push(e)
  assert.equal(e.DS.health().state, 'auth')
  assert.equal(e.calls.filter((c) => c.url.includes('action=refresh')).length, 1, 'renewal is tried once, not in a loop')
})

test('sync: old gho_ and pasted tokens never call the refresh endpoint', async () => {
  for (const token of ['gho_abc', 'ghp_pasted']) {
    const d = device({ token, valid: new Set([token]), renew: 'ghu_new' })
    await push(d)
    assert.ok(!d.calls.some((c) => c.url.includes('action=refresh')), token)
    assert.ok(d.gist.files['app.json'], token + ' still syncs')
  }
})
