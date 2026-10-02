'use strict'
// Tests for sync.js's reconcile logic — specifically the fix for the bug where
// grading questions, then having ANY reconcile decide "the cloud copy is newer"
// (purely by upload timestamp, regardless of content), would silently overwrite
// fresh local grades with an older cloud snapshot.
//
// Loads the real sync.js into a Node vm with a fake in-memory "gist" standing in
// for the GitHub API, so the actual reconcile/push/pull code runs unmodified.
// Run with: node --test test/sync.test.js

const { test, beforeEach } = require('node:test')
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

// extra: { elements: {id: fakeElement}, prompt(), confirm() }
function load(localStorage, fakeGitHub, extra) {
  extra = extra || {}
  const alerts = []
  const elements = extra.elements || {}
  const sandbox = {
    localStorage,
    document: { getElementById: (id) => elements[id] || null },
    fetch: fakeGitHub.fetch.bind(fakeGitHub),
    console, JSON, Object, Array, String, Number, Boolean, Date, Math, Promise, Error,
    setTimeout, clearTimeout,
    alert: (msg) => { alerts.push(msg) },
    prompt: extra.prompt || (() => null),
    confirm: extra.confirm || (() => true),
  }
  sandbox.window = sandbox
  sandbox.location = { reload() {} } // syncNow()/autoSync() reload the page on a successful pull
  vm.createContext(sandbox)
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8')
  vm.runInContext(src, sandbox, { filename: 'sync.js' })
  sandbox.DataSync.__alerts = alerts
  return sandbox.DataSync
}

let localStorage, fakeGitHub, DataSync
beforeEach(() => {
  localStorage = makeLocalStorage()
  fakeGitHub = makeFakeGitHub()
  DataSync = load(localStorage, fakeGitHub)
  localStorage.setItem('tracker-sync-token', 'test-token')
  DataSync.init({ appId: 'dsa', keys: ['dsa-revise-v1', 'dsa-qp-state-v1'] })
})

function reconcileOnce() {
  // syncNow() drives the button UI too; call the same underlying flow via syncNow
  // but resolve on the outcome by racing localStorage state instead of relying on
  // DOM — simplest is to reach into the module's own testable behavior indirectly
  // through repeated calls to syncNow() and awaiting its promise chain settling.
  return new Promise(resolve => {
    const check = () => {
      const before = JSON.stringify(fakeGitHub.gist.files)
      DataSync.syncNow()
      setTimeout(() => resolve(), 50)
    }
    check()
  })
}

test('first sync on a fresh device pushes local data to an empty gist', async () => {
  localStorage.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'shaky' } }))
  await reconcileOnce()
  const uploaded = JSON.parse(fakeGitHub.gist.files['dsa.json'].content)
  assert.equal(JSON.parse(uploaded.data['dsa-revise-v1']).q1.grade, 'shaky')
})

test('REGRESSION: local edits made after the last sync are never silently discarded by an older remote timestamp', async () => {
  // Device syncs once with an early grade.
  localStorage.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'solid' } }))
  await reconcileOnce()

  // Now the user grades MORE questions locally (no further sync yet) — exactly
  // like grading a 35-question batch that hasn't been pushed.
  localStorage.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'solid' }, q2: { grade: 'shaky' }, q3: { grade: 'forgot' } }))

  // Something else (another device/browser sharing the token) pushed to the gist
  // AFTER our last sync, with a LATER timestamp but OLDER/incomplete data — the
  // exact shape of the bug: newer upload time, staler content.
  fakeGitHub.gist.files['dsa.json'] = {
    content: JSON.stringify({ updatedAt: new Date(Date.now() + 60000).toISOString(), data: { 'dsa-revise-v1': JSON.stringify({ q1: { grade: 'solid' } }) } }),
  }

  await reconcileOnce()

  const stillLocal = JSON.parse(localStorage.getItem('dsa-revise-v1'))
  assert.equal(stillLocal.q2 && stillLocal.q2.grade, 'shaky', 'q2 must survive — it was graded locally after the last sync and never got a chance to be pushed')
  assert.equal(stillLocal.q3 && stillLocal.q3.grade, 'forgot', 'q3 must survive for the same reason')
})

test('a remote update IS pulled in when local has no pending edits of its own', async () => {
  localStorage.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'solid' } }))
  await reconcileOnce() // baseline sync, local == remote, hash recorded

  // No local changes happen after this. Some other device pushes a genuine update.
  fakeGitHub.gist.files['dsa.json'] = {
    content: JSON.stringify({ updatedAt: new Date(Date.now() + 60000).toISOString(), data: { 'dsa-revise-v1': JSON.stringify({ q1: { grade: 'solid' }, q2: { grade: 'shaky' } }) } }),
  }

  await reconcileOnce()

  const pulled = JSON.parse(localStorage.getItem('dsa-revise-v1'))
  assert.equal(pulled.q2 && pulled.q2.grade, 'shaky', 'with no local edits pending, the newer remote update should be pulled in')
})

test('empty local storage always restores from a non-empty remote regardless of hash bookkeeping', async () => {
  fakeGitHub.gist.files['dsa.json'] = {
    content: JSON.stringify({ updatedAt: new Date().toISOString(), data: { 'dsa-revise-v1': JSON.stringify({ q1: { grade: 'solid' } }) } }),
  }
  // localStorage for the app keys is empty (e.g. cleared browser data).
  await reconcileOnce()
  const restored = JSON.parse(localStorage.getItem('dsa-revise-v1'))
  assert.equal(restored.q1.grade, 'solid')
})

test('REGRESSION: a device "poisoned" by an earlier thin push still recovers rich remote data on the next sync', async () => {
  // Simulate a device that, under the old bug, already completed one bad sync: it
  // pushed a near-empty local state once, so it now has its OWN lastSyncedAt/lastLocalHash
  // that make reconcile() think it's "caught up" — even though the real data lives
  // only in the cloud. This is the exact trap a fresh tablet install fell into
  // (dsa-streak-v1 gets written on page load, making "local" look non-empty).
  localStorage.setItem('dsa-qp-state-v1', JSON.stringify({ touched: true }))
  await reconcileOnce() // this device's own thin push; now "looks" synced

  // The cloud actually holds much richer real progress from another device, with an
  // updatedAt that is NOT newer than this device's own lastSyncedAt (so the old
  // timestamp-based pull condition alone would never fire).
  const richData = {}
  for (let i = 0; i < 50; i++) richData['q' + i] = { grade: 'solid', notes: 'practiced multiple times, feeling confident' }
  fakeGitHub.gist.files['dsa.json'] = {
    content: JSON.stringify({ updatedAt: new Date(0).toISOString(), data: { 'dsa-revise-v1': JSON.stringify(richData) } }),
  }

  await reconcileOnce()

  const pulled = JSON.parse(localStorage.getItem('dsa-revise-v1') || 'null')
  assert.ok(pulled, 'the rich remote data must be pulled in even though this device looked "caught up"')
  assert.equal(pulled.q49.grade, 'solid')
})

test('the TOKEN button (not the Sync button) reflects whether a token is saved on this device', () => {
  const ls = makeLocalStorage()
  const fgh = makeFakeGitHub()
  const syncBtn = makeFakeButton()
  const tokenBtn = makeFakeButton()
  let promptReturn = 'brand-new-token'
  const ds = load(ls, fgh, {
    elements: { dataSyncBtn: syncBtn, dataTokenBtn: tokenBtn },
    prompt: () => promptReturn,
  })
  ds.init({ appId: 'dsa', keys: ['dsa-revise-v1'] })
  assert.equal(tokenBtn.classList.contains('ds-token-set'), false, 'no token yet — token button must not be highlighted')

  ds.setToken() // prompt() returns 'brand-new-token'

  assert.equal(tokenBtn.classList.contains('ds-token-set'), true, 'a token is now saved — the TOKEN button must be highlighted')
  assert.equal(syncBtn.classList.contains('ds-token-set'), false, 'the Sync button must never get this class — only the Token button reflects token state')
})

test('clearing the token (blank prompt) un-highlights the token button', () => {
  const ls = makeLocalStorage()
  const fgh = makeFakeGitHub()
  const tokenBtn = makeFakeButton()
  let promptReturn = 'a-token'
  const ds = load(ls, fgh, { elements: { dataTokenBtn: tokenBtn }, prompt: () => promptReturn })
  ds.init({ appId: 'dsa', keys: [] })
  ds.setToken()
  assert.equal(tokenBtn.classList.contains('ds-token-set'), true)

  promptReturn = '' // user clears the field
  ds.setToken()
  assert.equal(tokenBtn.classList.contains('ds-token-set'), false, 'blanking the token must un-highlight the button')
})

test('setToken() reports which GitHub account the token belongs to, so mismatched-account devices are obvious', async () => {
  const ls = makeLocalStorage()
  const fgh = makeFakeGitHub({ user: { login: 'aditya-real-account' } })
  const ds = load(ls, fgh, { prompt: () => 'some-token' })
  ds.init({ appId: 'dsa', keys: [] })

  ds.setToken()
  await new Promise((r) => setTimeout(r, 20)) // the /user confirmation is async

  const msgs = ds.__alerts.join('\n')
  assert.match(msgs, /@aditya-real-account/, 'the connected-as confirmation must name the actual GitHub account')
})

test('REGRESSION: a token for a different GitHub account used to silently create an orphaned empty gist — now it warns instead', async () => {
  // Simulates exactly what likely happened on the tablet: a token that is valid,
  // but belongs to an account with no "tracker-sync-v1" gist yet (different account,
  // or a fine-grained PAT scoped to the wrong resource owner). Before this fix,
  // resolveGist() would quietly create a fresh empty gist and nothing on screen
  // would explain why the device's real data never shows up.
  const ls = makeLocalStorage()
  const fgh = makeFakeGitHub({ hasExisting: false, user: { login: 'wrong-account' } })
  ls.setItem('tracker-sync-token', 'token-for-a-different-account')
  const ds = load(ls, fgh)
  ds.init({ appId: 'dsa', keys: ['dsa-revise-v1'] })
  ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'solid' } }))

  ds.syncNow()
  await new Promise((r) => setTimeout(r, 50))

  assert.ok(fgh.gist, 'a new gist should have been created for this account')
  assert.equal(fgh.gist.description, 'tracker-sync-v1')
  const msgs = ds.__alerts.join('\n')
  assert.match(msgs, /brand-new, EMPTY sync store/, 'creating a fresh gist (instead of finding an existing one) must surface a warning explaining the likely account mismatch')
})

test('REGRESSION: an empty duplicate gist listed first must not hide the real data-bearing gist from Pull', async () => {
  // Tablet scenario: a duplicate EMPTY "tracker-sync-v1" gist (newer, so GitHub lists it first)
  // sits ahead of the real gist. Old code took the first match and Pull found "nothing".
  const gh = makeFakeGitHub({ extraGists: [{ id: 'emptydup', description: 'tracker-sync-v1', updated_at: '2026-10-01T10:00:00Z', files: { 'README.md': { size: 70 } } }] })
  gh.gist.updated_at = '2026-09-01T10:00:00Z'
  gh.gist.files['dsa.json'] = { size: 100, content: JSON.stringify({ updatedAt: '2026-09-30T00:00:00Z', data: { 'dsa-revise-v1': '{"q1":1}' } }) }
  const ls = makeLocalStorage()
  const ds = load(ls, gh)
  ls.setItem('tracker-sync-token', 'test-token')
  ls.setItem('tracker-sync-gistid', 'emptydup') // stale cache pointing at the empty one
  ds.init({ appId: 'dsa', keys: ['dsa-revise-v1'] })
  ds.pullLatest()
  await new Promise(r => setTimeout(r, 50))
  assert.equal(ls.getItem('dsa-revise-v1'), '{"q1":1}')
  assert.equal(ls.getItem('tracker-sync-gistid'), 'gist1')
})

test('REGRESSION: a newer-but-much-thinner cloud copy must not overwrite richer, unchanged local data', async () => {
  const big = JSON.stringify({ q1: { grade: 'solid' }, q2: { grade: 'shaky' }, q3: { grade: 'forgot' }, pad: 'x'.repeat(500) })
  localStorage.setItem('dsa-revise-v1', big)
  await reconcileOnce() // pushes; local now "caught up"
  // another device overwrites the cloud with near-empty state and a newer timestamp
  fakeGitHub.gist.files['dsa.json'] = { content: JSON.stringify({ updatedAt: '2999-01-01T00:00:00Z', data: { 'dsa-qp-state-v1': '{}' } }) }
  await reconcileOnce()
  assert.equal(localStorage.getItem('dsa-revise-v1'), big)
  const cloud = JSON.parse(fakeGitHub.gist.files['dsa.json'].content)
  assert.equal(cloud.data['dsa-revise-v1'], big) // cloud repaired from the richer side
})

test('INCIDENT REPLAY (2026-10-01): a device holding only 2 keys must never overwrite a 15-key cloud backup', async () => {
  // Real incident: dsa.json went 161,979 bytes/15 keys -> 123 bytes/2 keys (dsa-revise-v1 +
  // dsa-revise-migrated-v1) when a near-empty device pushed over the cloud, and every later
  // Sync/Pull then faithfully propagated the thin copy. Replay it with poisoned bookkeeping
  // (device thinks it is "caught up" and has local edits) — the worst case for the old logic.
  const rich = {}
  ;['progress', 'notes', 'topic-notes', 'submissions', 'solve-counts', 'seen', 'revise', 'last-practiced', 'review-interval']
    .forEach(n => { rich['dsa-' + n + '-v1'] = JSON.stringify({ n, pad: 'x'.repeat(400) }) })
  const keys = Object.keys(rich).concat(['dsa-revise-migrated-v1'])
  fakeGitHub.gist.files['dsa.json'] = { size: 5000, content: JSON.stringify({ updatedAt: '2026-10-01T05:40:03.341Z', data: rich }) }
  DataSync.init({ appId: 'dsa', keys })
  localStorage.setItem('dsa-revise-migrated-v1', '1')
  localStorage.setItem('dsa-revise-v1', '{"a":1}')
  localStorage.setItem('dsa-sync-meta', JSON.stringify({ lastSyncedAt: '2026-10-01T13:00:00Z', lastLocalHash: 'stale:1', lastCheckAt: '2026-10-01T13:00:00Z' }))
  await reconcileOnce()
  const cloud = JSON.parse(fakeGitHub.gist.files['dsa.json'].content)
  assert.equal(Object.keys(cloud.data).length >= 9, true, 'cloud backup must still hold the rich data')
  assert.equal(localStorage.getItem('dsa-progress-v1'), rich['dsa-progress-v1'], 'device should have adopted the cloud data')
})

// ─── merge / multi-device / auto-push (cloud sync hardening) ─────────────────
// Two "devices" = two (localStorage, DataSync) pairs sharing one fake gist.
function makeDevice(gh, initOpts) {
  const ls = makeLocalStorage()
  const ds = load(ls, gh)
  ls.setItem('tracker-sync-token', 'test-token')
  ds.init(Object.assign({ appId: 'dsa', keys: ['dsa-revise-v1', 'dsa-solve-counts-v1', 'dsa-streak-v1'] }, initOpts || {}))
  return { ls, ds }
}
const settle = (ms) => new Promise((r) => setTimeout(r, ms || 40))
async function syncDevice(dev) { dev.ds.syncNow(); await settle(50) }
const cloudData = (gh) => JSON.parse(gh.gist.files['dsa.json'].content).data
const parse = (ls, k) => JSON.parse(ls.getItem(k) || 'null')

test('MERGE: two devices that both edited since the last sync keep BOTH sets of edits', async () => {
  const gh = makeFakeGitHub()
  const A = makeDevice(gh), B = makeDevice(gh)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'solid' } }))
  await syncDevice(A)
  await syncDevice(B)                                   // B adopts q1
  await settle(5)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'solid' }, qA: { grade: 'shaky' } }))
  B.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'solid' }, qB: { grade: 'forgot' } }))
  await settle(5)
  await syncDevice(A)                                   // cloud now has qA
  await settle(5)
  await syncDevice(B)                                   // B has qB AND the cloud changed: used to wipe qA
  const merged = parse(B.ls, 'dsa-revise-v1')
  assert.ok(merged.q1 && merged.qA && merged.qB, 'B must hold q1, qA and qB: ' + JSON.stringify(merged))
  const cloud = JSON.parse(cloudData(gh)['dsa-revise-v1'])
  assert.ok(cloud.q1 && cloud.qA && cloud.qB, 'the cloud must hold all three too: ' + JSON.stringify(cloud))
  await syncDevice(A)                                   // and A picks up qB afterwards
  assert.ok(parse(A.ls, 'dsa-revise-v1').qB, 'A must receive qB')
})

test('MERGE: when both edited the SAME entry, the more recently edited side wins', async () => {
  const gh = makeFakeGitHub()
  const A = makeDevice(gh), B = makeDevice(gh)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'start' } }))
  await syncDevice(A); await syncDevice(B)
  await settle(5)
  B.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'B-old-edit' } }))   // B edits first...
  await settle(5)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'A-newer-edit' } })) // ...A edits later and syncs
  await syncDevice(A)
  await settle(5)
  await syncDevice(B)
  assert.equal(parse(B.ls, 'dsa-revise-v1').q1.grade, 'A-newer-edit', 'the cloud copy is newer than B\'s edit, so it wins')

  // Reverse: B's edit happens AFTER the cloud's last push, so B's value must win.
  await syncDevice(A)
  await settle(5)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'A-v3' } }))
  await syncDevice(A)
  await settle(5)
  B.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'B-latest' } }))
  await settle(5)
  await syncDevice(B)
  assert.equal(parse(B.ls, 'dsa-revise-v1').q1.grade, 'B-latest')
  assert.equal(JSON.parse(cloudData(gh)['dsa-revise-v1']).q1.grade, 'B-latest')
})

test('MERGE: a device syncing for the first time keeps its own offline progress instead of discarding it', async () => {
  const gh = makeFakeGitHub()
  const A = makeDevice(gh)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ qA: { grade: 'solid' } }))
  await syncDevice(A)
  const B = makeDevice(gh)                              // never synced, but has real local progress
  B.ls.setItem('dsa-revise-v1', JSON.stringify({ qB: { grade: 'shaky' } }))
  await syncDevice(B)
  const b = parse(B.ls, 'dsa-revise-v1')
  assert.ok(b.qA && b.qB, 'B must have the cloud entry and keep its own: ' + JSON.stringify(b))
  const cloud = JSON.parse(cloudData(gh)['dsa-revise-v1'])
  assert.ok(cloud.qA && cloud.qB, 'the cloud must gain B\'s entry')
})

test('MERGE: counters listed in maxKeys keep the larger count when both devices incremented', async () => {
  const gh = makeFakeGitHub()
  const opts = { maxKeys: ['dsa-solve-counts-v1'] }
  const A = makeDevice(gh, opts), B = makeDevice(gh, opts)
  A.ls.setItem('dsa-solve-counts-v1', JSON.stringify({ q1: 1 }))
  await syncDevice(A); await syncDevice(B)
  await settle(5)
  A.ls.setItem('dsa-solve-counts-v1', JSON.stringify({ q1: 4 }))
  B.ls.setItem('dsa-solve-counts-v1', JSON.stringify({ q1: 2, q2: 1 }))
  await settle(5)
  await syncDevice(A)
  await settle(5)
  await syncDevice(B)
  assert.deepEqual(parse(B.ls, 'dsa-solve-counts-v1'), { q1: 4, q2: 1 })
})

test('MERGE: recent-log style arrays are unioned by question, newest entry kept', async () => {
  const gh = makeFakeGitHub()
  const A = makeDevice(gh, { keys: ['dsa-recent-log-v1'] }), B = makeDevice(gh, { keys: ['dsa-recent-log-v1'] })
  A.ls.setItem('dsa-recent-log-v1', JSON.stringify([{ lcKey: 'q1', grade: 'shaky', ts: '2026-10-01T10:00:00Z' }]))
  await syncDevice(A); await syncDevice(B)
  await settle(5)
  A.ls.setItem('dsa-recent-log-v1', JSON.stringify([{ lcKey: 'q1', grade: 'solid', ts: '2026-10-02T10:00:00Z' }]))
  B.ls.setItem('dsa-recent-log-v1', JSON.stringify([{ lcKey: 'q2', grade: 'forgot', ts: '2026-10-01T12:00:00Z' }, { lcKey: 'q1', grade: 'shaky', ts: '2026-10-01T10:00:00Z' }]))
  await settle(5)
  await syncDevice(A)
  await settle(5)
  await syncDevice(B)
  const log = parse(B.ls, 'dsa-recent-log-v1')
  assert.deepEqual(log.map(e => e.lcKey + ':' + e.grade), ['q1:solid', 'q2:forgot'])
})

test('SAFETY NET: every push keeps the previous cloud copy as <app>.prev.json', async () => {
  const gh = makeFakeGitHub()
  const A = makeDevice(gh)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'one' } }))
  await syncDevice(A)
  assert.equal(gh.gist.files['dsa.prev.json'], undefined, 'nothing to back up on the very first push')
  await settle(5)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'two' } }))
  await syncDevice(A)
  const prev = JSON.parse(gh.gist.files['dsa.prev.json'].content)
  assert.equal(JSON.parse(prev.data['dsa-revise-v1']).q1.grade, 'one')
})

test('SAFETY NET: the last three local snapshots are kept, not just the latest', async () => {
  const gh = makeFakeGitHub()
  const A = makeDevice(gh)
  for (const v of ['v1', 'v2', 'v3']) {
    gh.gist.files['dsa.json'] = { content: JSON.stringify({ updatedAt: new Date().toISOString(), data: { 'dsa-revise-v1': JSON.stringify({ v }) } }) }
    A.ds.pullLatest()
    await settle(30)
  }
  const ver = (k) => JSON.parse(JSON.parse(A.ls.getItem(k)).data['dsa-revise-v1'] || 'null')
  // local held nothing before the first pull, so snapshots 1..3 hold: (empty), v1, v2
  assert.equal(ver('dsa-presync').v, 'v2')
  assert.equal(ver('dsa-presync-2').v, 'v1')
  assert.ok(A.ls.getItem('dsa-presync-3') !== null, 'a third snapshot exists')
})

test('EDIT TRACKING: only real edits (not noiseKeys) move lastEditAt', async () => {
  const gh = makeFakeGitHub()
  const A = makeDevice(gh, { noiseKeys: ['dsa-streak-v1'] })
  A.ls.setItem('dsa-streak-v1', '{"n":1}')
  assert.equal(JSON.parse(A.ls.getItem('dsa-sync-meta') || '{}').lastEditAt, undefined, 'a streak write on page load is not an edit')
  A.ls.setItem('dsa-revise-v1', '{"q1":1}')
  assert.ok(JSON.parse(A.ls.getItem('dsa-sync-meta')).lastEditAt, 'a real edit is recorded')
})

test('A stale device that only rewrote its streak on load fast-forwards to the cloud instead of pushing over it', async () => {
  const gh = makeFakeGitHub()
  const opts = { noiseKeys: ['dsa-streak-v1'] }
  const A = makeDevice(gh, opts), B = makeDevice(gh, opts)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'a' } }))
  await syncDevice(A); await syncDevice(B)
  await settle(5)
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'a' }, q2: { grade: 'new' } }))
  await syncDevice(A)
  await settle(5)
  B.ls.setItem('dsa-streak-v1', '{"n":9}')              // B just opened the app: streak rewritten, no real edits
  await syncDevice(B)
  assert.ok(parse(B.ls, 'dsa-revise-v1').q2, 'B must pick up A\'s q2')
  assert.ok(JSON.parse(cloudData(gh)['dsa-revise-v1']).q2, 'and must not have pushed a stale copy over the cloud')
})

test('AUTO-PUSH: an edit to a synced key reaches the cloud shortly after, without pressing Sync', async () => {
  const gh = makeFakeGitHub()
  const A = makeDevice(gh, { autoPush: true, autoPushDelayMs: 20 })
  A.ls.setItem('dsa-revise-v1', JSON.stringify({ q1: { grade: 'auto' } }))
  await settle(150)
  assert.equal(JSON.parse(cloudData(gh)['dsa-revise-v1']).q1.grade, 'auto')
})

test('AUTO-PUSH: off by default, and edits to keys that are not synced never trigger it', async () => {
  const gh = makeFakeGitHub()
  const off = makeDevice(gh)
  off.ls.setItem('dsa-revise-v1', '{"q1":1}')
  await settle(100)
  assert.equal(gh.gist.files['dsa.json'], undefined, 'autoPush is opt-in')
  const on = makeDevice(makeFakeGitHub(), { autoPush: true, autoPushDelayMs: 20 })
  on.ls.setItem('some-unrelated-key', 'x')
  await settle(100)
  assert.equal(on.ls.getItem('dsa-sync-meta'), null, 'unrelated keys must not touch sync bookkeeping')
})

test('the DSA app syncs its in-progress practice sessions too', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
  const block = html.slice(html.indexOf('const BACKUP_KEYS'), html.indexOf(']', html.indexOf('const BACKUP_KEYS')))
  assert.match(block, /'dsa-practice-session-v1'/)
})
