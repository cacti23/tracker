const CACHE = 'habits-cache-v5';
const ASSETS = ['habits.html', '../css/apps.css', '../js/dates.js', '../js/sync.js', '../js/back-button.js', 'habits-manifest.json', '../icons/icon-192.png', '../icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // CacheStorage is shared by every service worker on this origin: only drop our own old versions.
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('habits-cache-') && k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // network-first for the GitHub sync API, cache-first for the app shell
  if (e.request.url.includes('api.github.com') || e.request.url.includes('gist.githubusercontent.com')) return;
  // HTML/JS: network-first so new deploys show immediately; cache is the offline fallback
  if (e.request.mode === 'navigate' || e.request.url.endsWith('.html') || e.request.url.endsWith('.js')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
