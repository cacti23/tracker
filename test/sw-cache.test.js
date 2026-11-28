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

// Engineering audit 2026-11-25. The first visit to the site root "/" happens before the
// service worker controls the page, so only the precached "index.html" is in the cache, not
// "/". Opening "/" offline after that first visit then failed (net::ERR_FAILED) instead of
// showing the app. A navigation to a folder URL must fall back to that folder's index.html.
function offlineFetch(file, url, cachedUrls) {
  const handlers = {}
  const self = { addEventListener: (t, fn) => { handlers[t] = fn }, skipWaiting() {}, clients: { claim() {} } }
  const caches = {
    match: async (req) => (cachedUrls.includes(typeof req === 'string' ? req : req.url) ? 'CACHED ' + (typeof req === 'string' ? req : req.url) : undefined),
    open: async () => ({ put: async () => {} }),
  }
  const fetch = () => Promise.reject(new TypeError('offline'))
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { self, caches, fetch, URL })
  let out
  handlers.fetch({ request: { method: 'GET', mode: 'navigate', url }, respondWith: (p) => { out = p } })
  return out
}

test('offline, the site root opens the cached index.html', async () => {
  assert.strictEqual(await offlineFetch('sw.js', 'https://t.example/', ['https://t.example/index.html']), 'CACHED https://t.example/index.html')
})

test('offline, a cached page still opens itself, and an uncached page is not swapped for the notebook', async () => {
  assert.strictEqual(await offlineFetch('sw.js', 'https://t.example/index.html', ['https://t.example/index.html']), 'CACHED https://t.example/index.html')
  assert.strictEqual(await offlineFetch('sw.js', 'https://t.example/apps/gym-5day.html', ['https://t.example/index.html']), undefined)
})

// Pokémon sprites showed as ⚪ in production: the habits worker re-fetched them itself, and a
// worker's fetch is checked against connect-src, which doesn't list the sprite hosts.
// Requests to other sites must go straight to the browser (no respondWith).
test('habits service worker leaves other sites\' requests alone', () => {
  const handlers = {}
  const self = { addEventListener: (t, fn) => { handlers[t] = fn }, skipWaiting() {}, clients: { claim() {} }, location: { origin: 'https://tracker.example' } }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'apps/habits-sw.js'), 'utf8'), { self, caches: { match: async () => undefined }, fetch: async () => ({}), URL })
  const handled = (url) => {
    let used = false
    handlers.fetch({ request: { method: 'GET', url, mode: 'no-cors' }, respondWith() { used = true } })
    return used
  }
  assert.strictEqual(handled('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png'), false)
  assert.strictEqual(handled('https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/4.png'), false)
  assert.strictEqual(handled('https://tracker.example/icons/icon-192.png'), true)
})
