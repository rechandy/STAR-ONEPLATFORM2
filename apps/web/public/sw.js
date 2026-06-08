/* OnePlatform service worker — Phase 0 app-shell offline baseline.
 * Strategy:
 *   - precache the app shell on install
 *   - navigation requests: network-first, falling back to cached shell offline
 *   - other GET requests: stale-while-revalidate
 * Phase 2 adds the IndexedDB outbox + Background Sync for offline data collection
 * (see docs/architecture/04-client-and-mobile-strategy.md). Do NOT cache
 * authenticated student-PII responses here.
 */
const VERSION = 'v1';
const SHELL_CACHE = `op-shell-${VERSION}`;
const RUNTIME_CACHE = `op-runtime-${VERSION}`;
const SHELL_ASSETS = ['/', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigations: network-first with offline shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/', { ignoreSearch: true })),
    );
    return;
  }

  // Static/runtime GETs: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
