const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

// Both service workers run on one origin and share one CacheStorage, so each must
// clean up only its own old caches, never the other app's offline copy.
async function activate(file, existing) {
  const handlers = {}
  const deleted = []
  const self = {
    addEventListener: (t, fn) => { handlers[t] = fn },
    skipWaiting() {},
    clients: { claim() {} },
  }
  const caches = {
    keys: async () => existing.slice(),
    delete: async (k) => { deleted.push(k); return true },
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { self, caches })
  let done
  handlers.activate({ waitUntil: (p) => { done = p } })
  await done
  return deleted.sort()
}

const ALL = ['tracker-cache-v0', 'tracker-cache-v1', 'habits-cache-v4', 'habits-cache-v5', 'someone-else']

test('main service worker keeps the habits cache', async () => {
  const deleted = await activate('sw.js', ALL)
  assert.deepStrictEqual(deleted, ['tracker-cache-v0'])
})

test('habits service worker keeps the main app cache', async () => {
  const deleted = await activate('apps/habits-sw.js', ALL)
  assert.deepStrictEqual(deleted, ['habits-cache-v4'])
})
