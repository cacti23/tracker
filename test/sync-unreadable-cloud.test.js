'use strict'
// A malformed gist payload, and a plain transient download failure.
// readAppFile (js/sync.js) fetches a truncated (>~1MB) file from raw_url without checking
// r.ok, and parsePayload turns any unreadable content into null. doReconcile then treats the
// cloud as "no file" and falls through to step 7: push local over it. pushApp only writes
// <app>.prev.json when prevRemote has data, and prevRemote is that null, so before the fix
// the other device's upload was replaced with no .prev backup, even by a device with no edits.
// (.prev.json is gone since: the gist's revision history is the cloud backup, and a PATCH only
// adds a revision, so the unreadable text stays there. What must hold is that a failed download
// never reaches the upload at all; see the first test.)
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

function makeLocalStorage() {
  const store = new Map()
  return { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() }
}
const res = (body, ok, status) => Promise.resolve({ ok, status: status || (ok ? 200 : 500), json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) })

function setup(fileShape) {
  // The cloud holds device A's newer upload (T2) with a key this device has never seen.
  const cloudPayload = JSON.stringify({ updatedAt: 'T2', data: { k1: '{"a":1}', k2: '{"fromA":true}' } })
  const gist = { id: 'g1', description: 'tracker-sync-v1', history: [{ version: 'v2' }], files: {} }
  gist.files['dsa.json'] = fileShape(cloudPayload)
  const patches = []
  const fetch = (url, o) => {
    o = o || {}
    if (/\/gists\/g1$/.test(url) && o.method === 'PATCH') {
      const body = JSON.parse(o.body); patches.push(body)
      Object.keys(body.files).forEach(f => { gist.files[f] = { content: body.files[f].content } })
      gist.history = [{ version: 'v3' }, { version: 'v2' }]
      return res(gist, true)
    }
    if (/\/gists\?per_page=100&page=1$/.test(url)) return res([{ id: 'g1', description: 'tracker-sync-v1', files: { 'dsa.json': { size: 100 } } }], true)
    if (/\/gists\?per_page/.test(url)) return res([], true)
    if (/\/gists\/g1$/.test(url)) return res(JSON.parse(JSON.stringify(gist)), true)
    if (/raw\.example/.test(url)) return res('upstream error', false, 502)   // transient raw_url failure
    return res({ message: 'nope' }, false, 404)
  }
  const ls = makeLocalStorage()
  const sb = { localStorage: ls, document: { getElementById: () => null }, fetch, console, setTimeout, clearTimeout, alert() {}, prompt: () => null, confirm: () => true, location: { reload() {} } }
  sb.window = sb
  vm.createContext(sb)
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8'), sb)
  ls.setItem('tracker-sync-token', 't')
  ls.setItem('tracker-sync-gistid', 'g1')
  // This device last synced at T1 and has NOT edited since (so its hash matches).
  ls.setItem('k1', '{"a":1}')
  sb.DataSync.init({ appId: 'dsa', keys: ['k1', 'k2'] })
  return { sb, ls, gist, patches }
}

async function runSync(sb, ls) {
  // Record "synced, unchanged" bookkeeping exactly as a previous pull would.
  ls.setItem('dsa-sync-meta', JSON.stringify({ lastSyncedAt: 'T1', lastLocalHash: null }))
  sb.DataSync.syncNow()
  await new Promise(r => setTimeout(r, 100))
}

test('a failed download of a large cloud file stops the sync instead of overwriting the cloud', async () => {
  const { sb, ls, gist, patches } = setup(p => ({ truncated: true, raw_url: 'https://raw.example/dsa.json', content: p.slice(0, 10), size: p.length }))
  const before = JSON.stringify(gist.files['dsa.json'])
  await runSync(sb, ls)
  assert.deepEqual(patches, [], 'nothing may be uploaded when the cloud copy could not be read')
  assert.equal(JSON.stringify(gist.files['dsa.json']), before)
})

test('an unparseable cloud file is replaced by one upload (a new revision), never deleted', async () => {
  const { sb, ls, gist, patches } = setup(p => ({ content: p.slice(0, -1) /* truncated JSON */ }))
  await runSync(sb, ls)
  assert.equal(patches.length, 1, 'one PATCH: GitHub keeps the replaced text as the previous revision')
  assert.ok(Object.values(patches[0].files).every(f => f !== null), 'no file is deleted')
  assert.ok(JSON.parse(gist.files['dsa.json'].content).data.k1, 'this device\'s data is now in the cloud')
})
