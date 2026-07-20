/* Offline-first service worker for the TENN Bukit Baru progress app.
   Bump CACHE_VERSION whenever app files change. */
const CACHE_VERSION = 'tenn-bb-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache-first for the app shell; network fallback keeps future assets working.
   Successful same-origin GETs are cached for offline use. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const url = new URL(e.request.url);
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline and not cached');
      });
    })
  );
});
