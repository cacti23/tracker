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

// A minimal fake GitHub Gists API: one gist, keyed by filename, in memory.
function makeFakeGitHub() {
  const gist = { id: 'gist1', description: 'tracker-sync-v1', files: {} }
  function json(body, ok) { return Promise.resolve({ ok, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) }) }
  return {
    gist,
    fetch(url, opts) {
      opts = opts || {}
      if (/\/gists\?per_page=100$/.test(url)) return json([gist], true)
      if (/\/gists$/.test(url) && opts.method === 'POST') return json(gist, true)
      if (/\/gists\/gist1$/.test(url) && (!opts.method || opts.method === 'GET')) return json(gist, true)
      if (/\/gists\/gist1$/.test(url) && opts.method === 'PATCH') {
        const body = JSON.parse(opts.body)
        Object.keys(body.files).forEach(fname => { gist.files[fname] = body.files[fname] })
        return json(gist, true)
      }
      return json({ message: 'not found' }, false)
    },
  }
}

function load(localStorage, fakeGitHub) {
  const sandbox = {
    localStorage,
    document: { getElementById: () => null },
    fetch: fakeGitHub.fetch.bind(fakeGitHub),
    console, JSON, Object, Array, String, Number, Boolean, Date, Math, Promise, Error,
    setTimeout, clearTimeout,
  }
  sandbox.window = sandbox
  sandbox.location = { reload() {} } // syncNow()/autoSync() reload the page on a successful pull
  vm.createContext(sandbox)
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8')
  vm.runInContext(src, sandbox, { filename: 'sync.js' })
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
