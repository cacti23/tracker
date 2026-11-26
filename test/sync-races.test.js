'use strict'
// Race-window and merge-granularity regressions for js/sync.js.
//
// test/sync.test.js covers the decision table; this file covers what happens BETWEEN
// steps: an edit made while a PATCH is in flight, a save made in the moment between a
// pull and the page reload, two devices pushing at once, clock skew, and pages that
// write synced keys without loading sync.js. Each test here failed on the code before
// the fix it guards (see the commit that added this file).
//
// The harness models the browser more closely than sync.test.js:
//   • an "origin" is one localStorage shared by every document (tab, iframe) on it;
//     a write in one document fires a `storage` event in the others, as browsers do;
//   • location.reload() really reloads: the old page's timers and requests die and
//     sync.js is loaded fresh, with the same init() options;
//   • the fake gist keeps a revision history (GET /gists/:id/:sha works) and any
//     request can be held mid-flight to open a race window on purpose;
//   • each device can have its own clock skew.
// Run with: node --test test/sync-races.test.js

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8')
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 0))
const clone = (o) => JSON.parse(JSON.stringify(o))

// ── fake GitHub gist with revision history ──────────────────────────────────
function makeCloud() {
  let n = 1
  const gist = { id: 'g1', description: 'tracker-sync-v1', files: {}, history: [{ version: 'v1' }] }
  const revisions = { v1: {} }
  const held = []          // [{ match, release }]
  const holds = []         // predicates registered with holdNext
  const cloud = { gist, patches: 0, log: [] }
  function json(body, ok) {
    return Promise.resolve({ ok: ok !== false, json: () => Promise.resolve(clone(body)), text: () => Promise.resolve(JSON.stringify(body)) })
  }
  const fails = []         // [{ dev, method, status, headers, body }] from failNext
  cloud.requests = 0
  function handle(url, o) {
    const method = o.method || 'GET'
    if (/\/gists\?per_page/.test(url)) return json(/page=1$/.test(url) ? [gist] : [])
    let m = url.match(/\/gists\/g1\/(v\d+)$/)
    if (m && method === 'GET') return revisions[m[1]] ? json({ id: 'g1', files: revisions[m[1]], history: gist.history }) : json({}, false)
    if (/\/gists\/g1$/.test(url) && method === 'GET') return json(gist)
    if (/\/gists\/g1$/.test(url) && method === 'PATCH') {
      const body = JSON.parse(o.body)
      Object.keys(body.files).forEach((f) => { if (body.files[f] === null) delete gist.files[f]; else gist.files[f] = body.files[f] })
      const v = 'v' + (++n)
      revisions[v] = clone(gist.files)
      gist.history = [{ version: v }].concat(gist.history)
      cloud.patches++
      cloud.log.push(Object.keys(body.files).join(','))
      return json(gist)
    }
    return json({ message: 'not found' }, false)
  }
  cloud.fetch = (dev, url, o) => {
    o = o || {}
    const method = o.method || 'GET'
    if (/\/gists/.test(url)) cloud.requests++   // gist calls only; the /user lookup is not modelled
    const f = /\/gists\//.test(url) ? fails.findIndex((x) => x.dev === dev && x.method === method) : -1
    if (f >= 0) {
      const x = fails.splice(f, 1)[0]
      const h = x.headers || {}
      return Promise.resolve({ ok: false, status: x.status, headers: { get: (n) => (n in h ? h[n] : null) }, json: () => Promise.resolve({}), text: () => Promise.resolve(x.body || '') })
    }
    const i = holds.findIndex((h) => h.dev === dev && h.method === method)
    if (i >= 0) {
      holds.splice(i, 1)
      return new Promise((resolve) => held.push({ dev, method, release: () => resolve(handle(url, o)) }))
    }
    return handle(url, o)
  }
  // Answer the next gist request of `method` from `dev` with an HTTP error.
  cloud.failNext = (dev, method, status, headers, body) => fails.push({ dev, method, status, headers, body })
  // Hold the next request of `method` from `dev` until release(dev).
  cloud.holdNext = (dev, method) => holds.push({ dev, method })
  cloud.release = (dev) => {
    for (let i = held.length - 1; i >= 0; i--) if (!dev || held[i].dev === dev) held.splice(i, 1)[0].release()
  }
  cloud.held = () => held.length
  cloud.read = (f) => (gist.files[f] ? JSON.parse(gist.files[f].content) : null)
  cloud.val = (app, k) => { const p = cloud.read(app + '.json'); return p && p.data[k] !== undefined ? JSON.parse(p.data[k]) : undefined }
  return cloud
}

// ── one browser origin: shared localStorage, storage events between documents ──
function makeOrigin() {
  const map = new Map()
  const docs = new Set()
  function view(doc) {
    // A fresh object per document, like each page's own `localStorage` binding — so the
    // write hook a page's sync.js installs dies with that page.
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { const old = map.has(k) ? map.get(k) : null; v = String(v); map.set(k, v); if (old !== v) notify(doc, k, old, v) },
      removeItem: (k) => { const old = map.has(k) ? map.get(k) : null; map.delete(k); if (old !== null) notify(doc, k, old, null) },
    }
  }
  function notify(from, key, oldValue, newValue) {
    docs.forEach((d) => {
      if (d === from || d.dead) return
      setTimeout(() => { if (!d.dead) d.listeners.forEach((fn) => fn({ key, oldValue, newValue, storageArea: d.view })) }, 0)
    })
  }
  function doc() {
    const d = { listeners: [], dead: false }
    d.view = view(d)
    docs.add(d)
    d.close = () => { d.dead = true; docs.delete(d) }
    return d
  }
  return { map, doc }
}

// A page running sync.js. Reloading it boots a fresh page on the same origin.
function makeDevice(cloud, opts) {
  opts = opts || {}
  const origin = opts.origin || makeOrigin()
  const name = opts.name || 'dev' + Math.random().toString(36).slice(2, 7)
  const skew = opts.skew || 0
  const dev = { name, origin, reloads: 0, page: null }
  function boot() {
    const d = origin.doc()
    d.visListeners = []
    d.winListeners = {}
    const timers = new Set()
    class D extends Date {
      constructor(...a) { if (a.length) super(...a); else super(Date.now() + skew) }
      static now() { return Date.now() + skew }
      static parse(s) { return Date.parse(s) }
    }
    const sb = {
      localStorage: d.view,
      document: {
        getElementById: () => null, visibilityState: 'visible',
        addEventListener: (type, fn) => { if (type === 'visibilitychange') d.visListeners.push(fn) },
      },
      fetch: (url, o) => (d.dead ? new Promise(() => {}) : cloud.fetch(name, url, o)),
      console, JSON, Object, Array, String, Number, Boolean, Math, Promise, Error, Date: D,
      setTimeout: (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!d.dead) fn() }, ms); timers.add(t); return t },
      clearTimeout: (t) => { clearTimeout(t); timers.delete(t) },
      alert: () => {}, prompt: () => null, confirm: () => true,
      addEventListener: (type, fn) => { if (type === 'storage') d.listeners.push(fn); else (d.winListeners[type] = d.winListeners[type] || []).push(fn) },
      navigator: opts.navigator,
      location: {
        reload() {
          if (d.dead) return
          d.close(); timers.forEach((t) => clearTimeout(t)); timers.clear()
          dev.reloads++
          boot()
        },
      },
    }
    sb.window = sb
    vm.createContext(sb)
    vm.runInContext(SRC, sb, { filename: 'sync.js' })
    if (!d.view.getItem('tracker-sync-token')) d.view.setItem('tracker-sync-token', 't')
    if (!d.view.getItem('tracker-sync-gistid')) d.view.setItem('tracker-sync-gistid', 'g1')
    sb.DataSync.init(Object.assign({ appId: 'app', keys: ['a', 'b'] }, opts.init || {}))
    dev.page = d
    dev.ls = d.view
    dev.DS = sb.DataSync
    // The person switches back to this tab or reopens the installed app.
    dev.returnToTab = () => { sb.document.visibilityState = 'visible'; d.visListeners.forEach((fn) => fn()) }
    dev.hide = () => { sb.document.visibilityState = 'hidden'; d.visListeners.forEach((fn) => fn()) }
    dev.fire = (type) => (d.winListeners[type] || []).forEach((fn) => fn({ type }))
  }
  boot()
  return dev
}
// A document on the same origin that writes localStorage WITHOUT loading sync.js —
// papers/paper-club.html or google/google-onsite-log.html inside index.html's iframe.
function makeBareDoc(origin) { return origin.doc().view }

const get = (dev, k) => JSON.parse(dev.ls.getItem(k) || 'null')
const set = (dev, k, v) => dev.ls.setItem(k, JSON.stringify(v))
// One background reconcile (pushSoon is the quiet path every app uses), then let any
// scheduled reload (<= 600 ms) happen.
async function sync(dev, wait) { dev.DS.pushSoon(1); await tick(wait === undefined ? 40 : wait) }
async function syncAndReload(dev) { await sync(dev, 750) }

async function twoSyncedDevices(cloud, opts) {
  const A = makeDevice(cloud, Object.assign({ name: 'A' }, opts)), B = makeDevice(cloud, Object.assign({ name: 'B' }, opts))
  set(A, 'a', { x: 1 }); set(A, 'b', { n: 1 })
  await syncAndReload(A)
  await syncAndReload(B)
  await tick(5)
  return { A, B }
}

// ── S1: the reload window ───────────────────────────────────────────────────
test('S1: a save of stale in-memory state between a pull and the reload cannot overwrite the pulled data', async () => {
  const cloud = makeCloud()
  const { A, B } = await twoSyncedDevices(cloud)
  const staleInMemory = get(B, 'a')                 // B's app loaded this before the pull
  set(A, 'a', { x: 1, fromA: 1 })
  await syncAndReload(A)
  await tick(5)
  const reloadsBefore = B.reloads
  await sync(B)                                     // B pulls; the reload is a few hundred ms away
  assert.equal(B.reloads, reloadsBefore, 'reload has not happened yet: this is the window')
  staleInMemory.tapDuringWindow = 1
  set(B, 'a', staleInMemory)                        // the app saves its stale copy
  await tick(750)
  assert.equal(B.reloads, reloadsBefore + 1, 'the pull reloads the page')
  assert.equal(get(B, 'a').fromA, 1, 'A\'s edit must survive on B: ' + B.ls.getItem('a'))
  await syncAndReload(B)
  assert.equal(cloud.val('app', 'a').fromA, 1, 'and must not be pushed away from the cloud')
})

// ── S2: an edit made while a merge PATCH is in flight ──────────────────────
test('S2: an edit made while a merge upload is in flight is not overwritten by the merge result', async () => {
  const cloud = makeCloud()
  const { A, B } = await twoSyncedDevices(cloud)
  set(B, 'a', { x: 1, fromB: 1 }); await sync(B)    // cloud changed
  await tick(5)
  set(A, 'b', { n: 1, first: 1 })                   // A edited too -> merge
  cloud.holdNext('A', 'PATCH')
  await sync(A)
  assert.equal(cloud.held(), 1, 'merge PATCH is in flight')
  set(A, 'b', { n: 1, first: 1, duringPatch: 1 })   // user keeps editing
  cloud.release('A')
  await tick(900)
  assert.equal(get(A, 'b').duringPatch, 1, 'the mid-upload edit must survive locally: ' + A.ls.getItem('b'))
  assert.equal(get(A, 'a').fromB, 1, 'and the merge must still bring in B\'s edit')
  assert.equal(cloud.val('app', 'b').duringPatch, 1, 'and the mid-upload edit must reach the cloud without another manual sync')
})

// ── S3: markSynced must fingerprint what was uploaded, not what is local now ──
test('S3: an edit made while a push is in flight is not recorded as synced (and is not lost to a later pull)', async () => {
  const cloud = makeCloud()
  const { A, B } = await twoSyncedDevices(cloud)
  set(A, 'a', { x: 1, z: 9 })
  cloud.holdNext('A', 'PATCH')
  await sync(A)
  set(A, 'b', { n: 1, NEW: 1 })                     // edit #2 during the PATCH
  cloud.release('A')
  await tick(40)
  // The app is closed before its own debounced push for edit #2 fires; on main that push
  // was the only thing that would have uploaded it. Simulate by killing the page.
  A.page.close()
  const A2 = makeDevice(cloud, { name: 'A', origin: A.origin })
  await syncAndReload(B)
  set(B, 'a', { x: 1, z: 9, fromB: 1 }); await sync(B)
  await syncAndReload(A2)                           // A reopens
  assert.equal(get(A2, 'b').NEW, 1, 'edit #2 must still be on A: ' + A2.ls.getItem('b'))
  assert.equal(get(A2, 'a').fromB, 1, 'and A must have B\'s edit')
  assert.equal(cloud.val('app', 'b').NEW, 1, 'and edit #2 must be in the cloud')
})

// ── S4: clock skew between devices ──────────────────────────────────────────
test('S4: a device whose clock is behind still has its pushes noticed by other devices', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A' }), B = makeDevice(cloud, { name: 'B', skew: -120000 })
  set(A, 'a', { x: 1 }); await syncAndReload(A)
  await syncAndReload(B)
  set(B, 'a', { x: 1, fromB: 1 }); await sync(B)    // stamped 2 minutes "in the past"
  await tick(5)
  set(A, 'a', { x: 1, fromA: 1 }); await syncAndReload(A)
  const c = cloud.val('app', 'a')
  assert.ok(c.fromA && c.fromB, 'cloud must hold both edits, not A\'s over B\'s: ' + JSON.stringify(c))
  assert.ok(get(A, 'a').fromB, 'A must have B\'s edit')
})

// ── S5: two devices pushing at the same time ────────────────────────────────
test('S5: when another device\'s push lands between our read and our upload, its edits are merged back in', async () => {
  const cloud = makeCloud()
  const { A, B } = await twoSyncedDevices(cloud)
  set(A, 'a', { x: 1, fromA: 1 }); set(B, 'b', { n: 1, fromB: 1 })
  cloud.holdNext('A', 'PATCH')
  await sync(A)                                      // A read v_n, its upload is slow
  await sync(B)                                      // B read v_n and its upload lands
  assert.equal(cloud.val('app', 'b').fromB, 1)
  cloud.release('A')                                 // A's upload lands on top of B's
  await tick(900)
  assert.equal(cloud.val('app', 'b').fromB, 1, 'B\'s edit must not be wiped from the cloud: ' + JSON.stringify(cloud.read('app.json').data))
  assert.equal(cloud.val('app', 'a').fromA, 1, 'and A\'s edit must be there too')
  assert.equal(get(A, 'b').fromB, 1, 'A must have adopted B\'s edit')
})

test('S5: a push by ANOTHER app in between is not mistaken for a lost update', async () => {
  const cloud = makeCloud()
  const { A } = await twoSyncedDevices(cloud)
  const G = makeDevice(cloud, { name: 'G', init: { appId: 'gym', keys: ['g'] } })
  set(A, 'a', { x: 1, fromA: 1 })
  cloud.holdNext('A', 'PATCH')
  await sync(A)
  set(G, 'g', { s: 1 }); await sync(G)               // a different file in the same gist
  const before = cloud.patches, reloadsBefore = A.reloads
  cloud.release('A')
  await tick(200)
  assert.equal(cloud.patches, before + 1, 'only A\'s own upload; no recovery merge')
  assert.equal(A.reloads, reloadsBefore)
})

// ── S6: no-op syncs must not touch the cloud ────────────────────────────────
test('S6: a sync with nothing changed on either side does not upload', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A', init: { appId: 'app', keys: ['a', 'streak'], noiseKeys: ['streak'], autoPush: true, autoPushDelayMs: 5 } })
  set(A, 'a', { good: 1 }); await tick(60)
  set(A, 'a', { bad: 1 }); await tick(60)
  const before = cloud.patches
  set(A, 'streak', { d: 'tomorrow' }); await tick(60)   // page load next day: noise only
  await sync(A, 60)                                     // and an explicit check
  assert.equal(cloud.patches, before, 'no upload for a noise write or an unchanged sync')
})

// ── S7: a follow-up reconcile that pulls must reload too ───────────────────
test('S7: a queued follow-up sync that pulls or merges still reloads the page', async () => {
  const cloud = makeCloud()
  const { A, B } = await twoSyncedDevices(cloud)
  set(A, 'a', { x: 1, y: 1 })
  const reloadsBefore = A.reloads
  cloud.holdNext('A', 'PATCH')
  await sync(A)                                      // push in flight
  A.DS.pushSoon(1); await tick(20)                   // second trigger joins -> queued follow-up
  cloud.holdNext('A', 'GET')                          // the follow-up's read waits...
  cloud.release('A'); await tick(20)
  await syncAndReload(B)                              // ...while B picks up y
  set(B, 'b', { n: 1, fromB: 1 }); await sync(B)      // and pushes its own edit
  cloud.release('A')                                 // follow-up now reads B's edit and pulls
  await tick(750)
  assert.equal(A.reloads, reloadsBefore + 1, 'the follow-up pull must reload the page')
  assert.equal(get(A, 'b').fromB, 1)
})

// ── S8: pages that write synced keys without loading sync.js ───────────────
test('S8: a synced key written by an iframe page (no sync.js) counts as an edit and is auto-pushed', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A', init: { appId: 'app', keys: ['a', 'paper'], autoPush: true, autoPushDelayMs: 5 } })
  set(A, 'a', { x: 1 }); await tick(80)
  const iframe = makeBareDoc(A.origin)
  iframe.setItem('paper', JSON.stringify({ 3: 'Done' }))
  await tick(120)
  assert.ok(JSON.parse(A.ls.getItem('app-sync-meta')).lastEditAt, 'the iframe write is recorded as an edit')
  assert.deepEqual(cloud.val('app', 'paper'), { 3: 'Done' }, 'and uploaded')
})

test('S8 (papers audit replay): an iframe edit is not overwritten by the other device\'s untouched, older copy of that key', async () => {
  const cloud = makeCloud()
  const init = { appId: 'app', keys: ['a', 'paper'] }
  const A = makeDevice(cloud, { name: 'A', init }), B = makeDevice(cloud, { name: 'B', init })
  set(A, 'a', { q1: 1 }); set(A, 'paper', { 3: 'In progress' }); await syncAndReload(A)
  await syncAndReload(B)
  set(B, 'a', { q1: 1, viewedOnB: 1 })              // an ordinary edit first: B has a lastEditAt
  await tick(10)
  makeBareDoc(B.origin).setItem('paper', JSON.stringify({ 3: 'Done' }))
  await tick(10)
  set(A, 'a', { q1: 1, q2: 1 }); await syncAndReload(A)
  await syncAndReload(B)
  assert.equal(get(B, 'paper')[3], 'Done', 'the iframe edit must survive: ' + B.ls.getItem('paper'))
  assert.equal(cloud.val('app', 'paper')[3], 'Done')
  assert.equal(get(B, 'a').q2, 1)
})

test('S8: two tabs of the same app settle after one edit (no storage-event ping-pong)', async () => {
  const cloud = makeCloud()
  const init = { appId: 'app', keys: ['a', 'b'], autoPush: true, autoPushDelayMs: 5 }
  const T1 = makeDevice(cloud, { name: 'T1', init })
  const T2 = makeDevice(cloud, { name: 'T2', init, origin: T1.origin })
  set(T1, 'a', { x: 1 })
  await tick(400)
  const settled = cloud.patches
  assert.ok(settled >= 1 && settled <= 3, 'a couple of uploads at most, got ' + settled)
  await tick(400)
  assert.equal(cloud.patches, settled, 'no further uploads once settled')
  assert.deepEqual(cloud.val('app', 'a'), { x: 1 })
  // A pull written by one tab's sync is not an edit in the other tab.
  const B = makeDevice(cloud, { name: 'B', init })
  await tick(100)
  set(B, 'b', { fromB: 1 }); await tick(100)
  const p = cloud.patches
  T1.DS.pushSoon(1); await tick(900)
  assert.equal(get(T2, 'b').fromB, 1)
  assert.equal(cloud.patches, p, 'pulling into one tab must not make either tab upload')
})

// ── autoSync: unsynced edits are not held back by the once-a-day gate ──────
test('autoSync uploads edits that never reached the cloud even within 24h of the last check', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A' })
  set(A, 'a', { x: 1 }); await syncAndReload(A)
  set(A, 'a', { x: 1, unsent: 1 })                  // tab closed before its push
  A.page.close()
  const A2 = makeDevice(cloud, { name: 'A', origin: A.origin })
  A2.DS.autoSync(); await tick(80)
  assert.equal(cloud.val('app', 'a').unsent, 1)
})

// ── autoSync onReturn: a tab left open picks up another device's edits ─────
// The notebook has no Sync or Pull button any more (Adi, 2026-11-25), so a page that
// stays open (an installed PWA) must check the cloud by itself when the person comes back.
test('autoSync({ onReturn: true }) pulls another device\'s edit when the person comes back to the tab', async () => {
  const cloud = makeCloud()
  const { A, B } = await twoSyncedDevices(cloud)
  A.DS.autoSync({ everyOpen: true, onReturn: true }); await tick(80)
  set(B, 'a', { x: 1, fromB: 1 }); await syncAndReload(B)
  assert.equal(get(A, 'a').fromB, undefined)
  A.returnToTab(); await tick(750)
  assert.equal(get(A, 'a').fromB, 1)
})

// ── merge granularity: deepKeys ─────────────────────────────────────────────
test('deepKeys: habits ticked on different days on two devices keep every tick, and a new habit on either side', async () => {
  const cloud = makeCloud()
  const K = 'habits_data_v1'
  const init = { appId: 'habits', keys: [K, 'habits_view'], deepKeys: { habits_data_v1: 'id' } }
  const A = makeDevice(cloud, { name: 'A', init }), B = makeDevice(cloud, { name: 'B', init })
  set(A, K, { habits: [{ id: 'h1', name: 'Run' }], logs: { h1: { '2026-11-10': true } } })
  await syncAndReload(A); await syncAndReload(B)
  await tick(5)
  const a = get(A, K); a.logs.h1['2026-11-14'] = true; set(A, K, a)
  await tick(5)
  const b = get(B, K); b.logs.h1['2026-11-15'] = true; b.habits.push({ id: 'h2', name: 'Read' }); b.logs.h2 = { '2026-11-15': true }; set(B, K, b)
  await syncAndReload(A)
  await syncAndReload(B)
  const m = get(B, K)
  assert.deepEqual(Object.keys(m.logs.h1).sort(), ['2026-11-10', '2026-11-14', '2026-11-15'])
  assert.deepEqual(m.habits.map((h) => h.id), ['h1', 'h2'])
  assert.deepEqual(m.logs.h2, { '2026-11-15': true })
  await syncAndReload(A)
  assert.deepEqual(get(A, K), m, 'A converges to the same data')
})

test('an un-tick on one device survives a merge when the other device didn\'t touch that key', async () => {
  // Per-key ancestor: B only changed habits_view-like data in another key, so its copy of
  // habits_data_v1 is just older, and A's deletion of a date must not be undone by it.
  const cloud = makeCloud()
  const K = 'habits_data_v1'
  const init = { appId: 'habits', keys: [K, 'other'], deepKeys: { habits_data_v1: 'id' } }
  const A = makeDevice(cloud, { name: 'A', init }), B = makeDevice(cloud, { name: 'B', init })
  set(A, K, { habits: [{ id: 'h1' }], logs: { h1: { '2026-11-14': true, '2026-11-15': true } } }); set(A, 'other', { v: 1 })
  await syncAndReload(A); await syncAndReload(B)
  await tick(5)
  set(B, 'other', { v: 2 })                           // B edits something else
  await tick(5)
  const a = get(A, K); delete a.logs.h1['2026-11-15']; set(A, K, a)   // A un-ticks
  await syncAndReload(A)
  await syncAndReload(B)                              // B: both changed -> merge
  assert.deepEqual(get(B, K).logs.h1, { '2026-11-14': true }, 'the un-tick must not come back')
  assert.deepEqual(get(B, 'other'), { v: 2 })
})

test('deepKeys: gym history arrays are unioned by date and stay in date order', async () => {
  const cloud = makeCloud()
  const K = 'gym5day_history_v1'
  const init = { appId: 'gym5day', keys: [K], deepKeys: { gym5day_history_v1: 'date' } }
  const A = makeDevice(cloud, { name: 'A', init }), B = makeDevice(cloud, { name: 'B', init })
  set(A, K, { Squat: [{ date: '2026-11-07', sets: [{ weight: '100', reps: '5' }] }] })
  await syncAndReload(A); await syncAndReload(B)
  await tick(5)
  const a = get(A, K); a.Squat.push({ date: '2026-11-14', sets: [{ weight: '105', reps: '5' }] }); set(A, K, a)
  await tick(5)
  const b = get(B, K); b.Squat.push({ date: '2026-11-12', sets: [{ weight: '102.5', reps: '5' }] }); b.Bench = [{ date: '2026-11-12', sets: [] }]; set(B, K, b)
  await syncAndReload(A)
  await syncAndReload(B)
  const m = get(B, K)
  assert.deepEqual(m.Squat.map((e) => e.date), ['2026-11-07', '2026-11-12', '2026-11-14'])
  assert.ok(m.Bench)
})

test('deepKeys: the same date on both sides keeps one entry (the preferred side\'s), not both', async () => {
  const cloud = makeCloud()
  const K = 'gym5day_history_v1'
  const init = { appId: 'gym5day', keys: [K], deepKeys: { gym5day_history_v1: 'date' } }
  const A = makeDevice(cloud, { name: 'A', init }), B = makeDevice(cloud, { name: 'B', init })
  set(A, K, { Squat: [{ date: '2026-11-07', sets: [] }] })
  await syncAndReload(A); await syncAndReload(B)
  await tick(5)
  set(A, K, { Squat: [{ date: '2026-11-07', sets: [] }, { date: '2026-11-14', sets: [{ weight: '100' }] }], Bench: [{ date: '2026-11-14', sets: [] }] })
  await syncAndReload(A)
  await tick(5)
  set(B, K, { Squat: [{ date: '2026-11-07', sets: [] }, { date: '2026-11-14', sets: [{ weight: '110' }] }] })
  await syncAndReload(B)                              // B edited after A's push, so B's entry wins
  assert.deepEqual(get(B, K).Squat, [{ date: '2026-11-07', sets: [] }, { date: '2026-11-14', sets: [{ weight: '110' }] }])
  assert.ok(get(B, K).Bench, 'and A\'s other exercise is still merged in')
})

// ── app wiring (static checks of the DataSync.init calls) ──────────────────
function initCall(file) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const i = html.indexOf('DataSync.init(')
  return html.slice(i, html.indexOf('})', i))
}
test('habits: view and theme are noise keys, habits_data_v1 merges deeply, and edits push quietly', () => {
  const call = initCall('apps/habits.html')
  assert.match(call, /noiseKeys:\s*\[[^\]]*'habits_view'/)
  assert.match(call, /noiseKeys:\s*\[[^\]]*themeKey/)
  assert.match(call, /deepKeys:\s*\{[^}]*STORAGE_KEY/)
  const html = fs.readFileSync(path.join(__dirname, '..', 'apps/habits.html'), 'utf8')
  const fn = html.slice(html.indexOf('function scheduleAutoPush'), html.indexOf('function uid'))
  assert.doesNotMatch(fn, /syncNow/, 'a per-edit syncNow() alerts on every offline tap')
})
test('gym: history merges by date', () => {
  assert.match(initCall('apps/gym-5day.html'), /deepKeys:\s*\{[^}]*gym5day_history_v1[^}]*'date'/)
})

// ── Sync hardening (2026-11-26 review): deletes, health, rate limits, offline, tabs ──

test('H1: a delete sticks when the other device edited a different entry of the same key', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A' }), B = makeDevice(cloud, { name: 'B' })
  set(A, 'a', { q1: 'Solved', q2: 'Solved' }); set(A, 'b', { n: 1 })
  await syncAndReload(A); await syncAndReload(B); await tick(5)
  set(A, 'a', { q1: 'Solved' })                               // A clears q2
  await syncAndReload(A)
  set(B, 'a', { q1: 'Solved', q2: 'Solved', q3: 'Pending' }) // B, not yet synced, adds q3
  await syncAndReload(B)
  assert.deepEqual(get(B, 'a'), { q1: 'Solved', q3: 'Pending' }, 'q2 must stay deleted and q3 kept: ' + B.ls.getItem('a'))
  assert.deepEqual(cloud.val('app', 'a'), { q1: 'Solved', q3: 'Pending' })
})

test('H2: deleted on one device but edited on the other keeps the edit; both-edited entries still merge', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A' }), B = makeDevice(cloud, { name: 'B' })
  set(A, 'a', { q1: 'old note', q2: 'x' }); set(A, 'b', { n: 1 })
  await syncAndReload(A); await syncAndReload(B); await tick(5)
  set(A, 'a', { q2: 'x' })                                    // A deletes q1
  await syncAndReload(A)
  set(B, 'a', { q1: 'new note', q2: 'x' })                    // B edits q1
  await syncAndReload(B)
  assert.equal(get(B, 'a').q1, 'new note', 'an edit is work; a delete of it must not win')
})

test('H3: a 401 marks sync as signed out (no blind retry), and the next good sync clears it', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A' })
  set(A, 'a', { x: 1 }); await sync(A)                  // signed in and synced once
  set(A, 'a', { x: 2 })
  cloud.failNext('A', 'GET', 401, {}, '{"message":"Bad credentials"}')   // then the token is revoked
  const before = cloud.requests
  await sync(A)
  assert.equal(A.DS.health().state, 'auth')
  assert.match(A.DS.health().text, /sign in again/i)
  assert.equal(cloud.requests - before, 1, 'a lost sign-in is not retried with a re-resolved gist')
  await sync(A)
  assert.equal(A.DS.health().state, 'ok')
})

test('H4: a rate limit pauses every request until GitHub\'s reset time', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A' })
  set(A, 'a', { x: 1 })
  const reset = Math.floor(Date.now() / 1000) + 2   // short, so the resume timer doesn't keep the test run alive
  cloud.failNext('A', 'GET', 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) }, 'API rate limit exceeded')
  await sync(A)
  assert.equal(A.DS.health().state, 'rate')
  assert.equal(Number(A.ls.getItem('tracker-sync-paused-until')), reset * 1000)
  const before = cloud.requests
  set(A, 'a', { x: 2 }); await sync(A); A.returnToTab(); await tick(40)
  assert.equal(cloud.requests, before, 'no request while paused')
  A.ls.setItem('tracker-sync-paused-until', String(Date.now() - 1))   // the reset time passes
  await sync(A)
  assert.equal(cloud.val('app', 'a').x, 2, 'syncing resumes after the pause')
  assert.equal(A.ls.getItem('tracker-sync-paused-until'), null)
})

test('H5: hiding the tab sends a waiting upload at once instead of after the debounce', async () => {
  const cloud = makeCloud()
  const A = makeDevice(cloud, { name: 'A', init: { appId: 'app', keys: ['a'], autoPush: true, autoPushDelayMs: 60000 } })
  set(A, 'a', { x: 1 })
  await tick(20)
  assert.equal(cloud.patches, 0, 'still inside the debounce')
  A.hide()
  await tick(40)
  assert.equal(cloud.val('app', 'a').x, 1, 'the edit reached the cloud when the tab was hidden')
})

test('H6: offline edits wait without requests and upload when the browser is back online', async () => {
  const cloud = makeCloud()
  const nav = { onLine: false }
  const A = makeDevice(cloud, { name: 'A', navigator: nav, init: { appId: 'app', keys: ['a'], autoPush: true, autoPushDelayMs: 5 } })
  set(A, 'a', { x: 1 })
  await tick(40)
  assert.equal(cloud.requests, 0, 'no request while the browser says it is offline')
  assert.equal(A.DS.health().state, 'offline')
  nav.onLine = true
  A.fire('online')
  await tick(40)
  assert.equal(cloud.val('app', 'a').x, 1)
  assert.equal(A.DS.health().state, 'ok')
})

test('H7: two tabs with Web Locks sync one at a time, so the second sends nothing new', async () => {
  const cloud = makeCloud()
  let chain = Promise.resolve()
  const locks = { request: (name, fn) => { const run = chain.then(() => fn()); chain = run.catch(() => {}); return run } }
  const origin = makeOrigin()
  const opts = { origin, navigator: { onLine: true, locks } }
  const T1 = makeDevice(cloud, Object.assign({ name: 'T1' }, opts)), T2 = makeDevice(cloud, Object.assign({ name: 'T2' }, opts))
  set(T1, 'a', { x: 1 })
  cloud.holdNext('T1', 'PATCH')                             // T1's upload is slow
  T1.DS.pushSoon(1); await tick(20)
  T2.DS.pushSoon(1); await tick(20)                         // T2 tries while T1 is mid-upload
  cloud.release('T1')
  await tick(80)
  assert.equal(cloud.patches, 1, 'one upload for one edit, not one per tab')
})
