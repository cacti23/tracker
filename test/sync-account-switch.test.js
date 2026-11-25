'use strict'
// Engineering audit 2026-11-25, finding 1. Signing out keeps this device's progress (by design:
// "your data stays here"). When a DIFFERENT GitHub account then signed in on the same browser,
// the next sync treated that progress as the new account's own edits and uploaded it into the
// new account's gist, over that person's data (theirs survived only as .prev.json).
// Now sync remembers which account the local data belongs to and asks before mixing them:
// OK loads the new account's own progress (the old one stays as a local undo snapshot and is
// never uploaded); Cancel keeps this device's progress and merges it into the new account.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

function makeLocalStorage() {
  const store = new Map()
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null },
    setItem(k, v) { store.set(k, String(v)) },
    removeItem(k) { store.delete(k) },
    clear() { store.clear() },
  }
}

// A minimal fake GitHub API: /user plus one gist, keyed by filename, in memory.
// hasExisting:false simulates a token for an account that has NO "tracker-sync-v1"
// gist yet — the exact shape of "this token belongs to a different GitHub account
// than the device that already has your data."
function makeFakeGitHub(opts) {
  opts = opts || {}
  const user = opts.user || { login: 'testuser' }
  let gist = opts.hasExisting === false ? null : { id: 'gist1', description: 'tracker-sync-v1', files: {} }
  let nextId = 2
  function json(body, ok) { return Promise.resolve({ ok, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) }) }
  return {
    get gist() { return gist },
    fetch(url, fopts) {
      fopts = fopts || {}
      if (/\/user$/.test(url)) return json(user, true)
      if (/\/gists\?per_page=100(&page=\d+)?$/.test(url)) return json(/page=([2-9]|10)$/.test(url) ? [] : (opts.extraGists || []).concat(gist ? [gist] : []), true)
      if (/\/gists$/.test(url) && fopts.method === 'POST') {
        gist = { id: 'gist' + (nextId++), description: 'tracker-sync-v1', files: {} }
        return json(gist, true)
      }
      if (gist && new RegExp('/gists/' + gist.id + '$').test(url) && (!fopts.method || fopts.method === 'GET')) return json(gist, true)
      if (gist && new RegExp('/gists/' + gist.id + '$').test(url) && fopts.method === 'PATCH') {
        const body = JSON.parse(fopts.body)
        Object.keys(body.files).forEach(fname => { gist.files[fname] = body.files[fname] })
        return json(gist, true)
      }
      return json({ message: 'not found' }, false)
    },
  }
}

// A fake button element good enough for classList.toggle()/dataset/textContent —
// what sync.js's button-status and ds-token-set highlighting code touches.
function makeFakeButton() {
  const classes = new Set()
  return {
    dataset: {},
    textContent: '',
    classList: {
      toggle(cls, force) {
        const shouldHave = force !== undefined ? force : !classes.has(cls)
        if (shouldHave) classes.add(cls); else classes.delete(cls)
        return shouldHave
      },
      contains(cls) { return classes.has(cls) },
    },
  }
}

// extra: { elements: {id: fakeElement}, prompt(), confirm(), onReload() }
function load(localStorage, fakeGitHub, extra) {
  extra = extra || {}
  const alerts = []
  const elements = extra.elements || {}
  let dead = false   // after a reload the old page's timers and requests never complete
  const sandbox = {
    localStorage,
    document: { getElementById: (id) => elements[id] || null },
    fetch: (url, o) => (dead ? new Promise(() => {}) : fakeGitHub.fetch(url, o)),
    console, JSON, Object, Array, String, Number, Boolean, Date, Math, Promise, Error,
    setTimeout: (fn, ms) => setTimeout(() => { if (!dead) fn() }, ms), clearTimeout,
    alert: (msg) => { alerts.push(msg) },
    prompt: extra.prompt || (() => null),
    confirm: extra.confirm || (() => true),
  }
  sandbox.window = sandbox
  // sync.js reloads the page after a pull/merge changes local data
  sandbox.location = { reload() { if (dead || !extra.onReload) return; dead = true; extra.onReload() } }
  vm.createContext(sandbox)
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8')
  vm.runInContext(src, sandbox, { filename: 'sync.js' })
  sandbox.DataSync.__alerts = alerts
  return sandbox.DataSync
}


const wait = (ms) => new Promise(r => setTimeout(r, ms))
const notesIn = (gh) => JSON.parse(JSON.parse(gh.gist.files['dsa.json'].content).data['dsa-notes-v1'])

// Adi syncs a private note, signs out with the account button, then a friend signs in on the
// same browser. Returns everything a test needs to look at.
async function switchAccounts(confirmAnswer) {
  const ls = makeLocalStorage()
  const adi = makeFakeGitHub({ user: { login: 'adi' } })
  const friend = makeFakeGitHub({ user: { login: 'friend' } })
  friend.gist.files['dsa.json'] = { content: JSON.stringify({ updatedAt: '2026-11-20T00:00:00Z', data: { 'dsa-notes-v1': '{"LC_9":"FRIEND NOTE"}' } }) }
  let gh = adi
  const asked = []
  let reloads = 0
  const DS = load(ls, { fetch: (u, o) => gh.fetch(u, o) }, {
    // Sign-out's "Also erase…?" is answered Cancel: this is the case where the data stays here.
    confirm: (msg) => { asked.push(msg); return /^Signed in/.test(msg) ? true : /^Also erase/.test(msg) ? false : confirmAnswer },
    onReload: () => { reloads++ },
  })
  ls.setItem('tracker-sync-token', 'token-adi')
  DS.init({ appId: 'dsa', keys: ['dsa-notes-v1'] })
  ls.setItem('dsa-notes-v1', JSON.stringify({ LC_1: 'ADI PRIVATE NOTE' }))
  DS.syncNow(); await wait(80)
  DS.account()                                   // sign out
  gh = friend
  ls.setItem('tracker-sync-token', 'token-friend')
  DS.syncNow(); await wait(150)
  return { ls, adi, friend, asked: asked.filter(m => !/^(Signed in|Also erase)/.test(m)), reloads }
}

test('another account signing in is asked first; OK loads their own progress and never uploads the old one', async () => {
  const { ls, friend, asked } = await switchAccounts(true)
  assert.equal(asked.length, 1, 'no question was asked')
  assert.match(asked[0], /@adi/)
  assert.match(asked[0], /@friend/)
  assert.deepEqual(notesIn(friend), { LC_9: 'FRIEND NOTE' })
  assert.deepEqual(JSON.parse(ls.getItem('dsa-notes-v1')), { LC_9: 'FRIEND NOTE' })
  assert.ok(['dsa-presync', 'dsa-presync-2', 'dsa-presync-3'].some(k => /ADI PRIVATE NOTE/.test(ls.getItem(k) || '')), 'the old progress is kept as an undo copy')
})

test('Cancel keeps this device\'s progress and merges it into the new account', async () => {
  const { friend } = await switchAccounts(false)
  assert.deepEqual(notesIn(friend), { LC_1: 'ADI PRIVATE NOTE', LC_9: 'FRIEND NOTE' })
})

test('the same account signing back in is not asked anything', async () => {
  const ls = makeLocalStorage()
  const gh = makeFakeGitHub({ user: { login: 'adi' } })
  const asked = []
  const DS = load(ls, gh, { confirm: (m) => { asked.push(m); return !/^Also erase/.test(m) } })
  ls.setItem('tracker-sync-token', 't1')
  DS.init({ appId: 'dsa', keys: ['dsa-notes-v1'] })
  ls.setItem('dsa-notes-v1', '{"LC_1":"a"}')
  DS.syncNow(); await wait(80)
  DS.account()
  ls.setItem('tracker-sync-token', 't2')
  ls.setItem('dsa-notes-v1', '{"LC_1":"a","LC_2":"b"}')
  DS.syncNow(); await wait(80)
  assert.deepEqual(asked.filter(m => !/^(Signed in|Also erase)/.test(m)), [])
  assert.deepEqual(notesIn(gh), { LC_1: 'a', LC_2: 'b' })
})

test('a device synced before this change (owner unknown) is not asked, and records the owner', async () => {
  const ls = makeLocalStorage()
  const gh = makeFakeGitHub({ user: { login: 'adi' } })
  const asked = []
  const DS = load(ls, gh, { confirm: (m) => { asked.push(m); return !/^Also erase/.test(m) } })
  ls.setItem('tracker-sync-token', 't1')
  ls.setItem('dsa-sync-meta', JSON.stringify({ lastSyncedAt: 'x', lastLocalHash: 'y' }))
  DS.init({ appId: 'dsa', keys: ['dsa-notes-v1'] })
  ls.setItem('dsa-notes-v1', '{"LC_1":"a"}')
  DS.syncNow(); await wait(80)
  assert.deepEqual(asked, [])
  assert.equal(JSON.parse(ls.getItem('dsa-sync-meta')).lastLogin, 'adi')
})

test('after "Pull latest" as the new account, the next sync does not ask again', async () => {
  const ls = makeLocalStorage()
  const adi = makeFakeGitHub({ user: { login: 'adi' } })
  const friend = makeFakeGitHub({ user: { login: 'friend' } })
  friend.gist.files['dsa.json'] = { content: JSON.stringify({ updatedAt: '2026-11-20T00:00:00Z', data: { 'dsa-notes-v1': '{"LC_9":"F"}' } }) }
  let gh = adi
  const asked = []
  const DS = load(ls, { fetch: (u, o) => gh.fetch(u, o) }, { confirm: (m) => { asked.push(m); return true } })
  ls.setItem('tracker-sync-token', 'a')
  DS.init({ appId: 'dsa', keys: ['dsa-notes-v1'] })
  ls.setItem('dsa-notes-v1', '{"LC_1":"A"}')
  DS.syncNow(); await wait(80)
  DS.account()
  gh = friend
  ls.setItem('tracker-sync-token', 'f')
  DS.pullLatest(); await wait(80)
  asked.length = 0
  DS.syncNow(); await wait(80)
  assert.deepEqual(asked, [])
})
