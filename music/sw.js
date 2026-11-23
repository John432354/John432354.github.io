/* ============================================================================
   Sonora — optional service worker
   ----------------------------------------------------------------------------
   A single .html file CANNOT contain its own service worker: the browser only
   registers a worker from a real, same-origin script URL. So this file is the
   one thing that can't be inlined. Drop it next to music.html (with the icons/
   folder) and the app gains:

     • offline launch from the Home Screen icon
     • instant cold starts from cache
     • no blank screen when the network drops

   Without it everything still works — you just need the network to load.
   ========================================================================== */

const VERSION = 'sonora-v4';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // allSettled: a missing optional file must not fail the whole install
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept the music backend (YouTube / Invidious / Cobalt calls)
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to the cached app shell when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(VERSION);
          return (await cache.match(req)) ||
                 (await cache.match('./index.html')) ||
                 (await cache.match('./music.html')) ||
                 new Response('Offline and the app shell is not cached yet. Open Sonora once while online.', {
                   status: 503, headers: { 'Content-Type': 'text/plain' }
                 });
        })
    );
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
