/* Backlogged service worker.
 *
 * Two rules carry this, and both are deliberate:
 *
 *   1. NETWORK-FIRST for the document. The whole app is one HTML file, so a
 *      cache-first shell would pin users to whatever version they first
 *      loaded — the classic single-file PWA trap where a fix ships and nobody
 *      ever sees it. Network wins when it can; the cache is the fallback.
 *
 *   2. NEVER touch Supabase. Sync must reach the network or fail honestly to
 *      the app's own offline state. A cached API response would silently show
 *      stale data and, worse, could serve one account's data from a shared
 *      cache. Anything that is not same-origin is passed straight through.
 *
 * Bump VERSION on release; old caches are dropped on activate.
 */
const VERSION = 'backlogged-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL))
      // A missing optional asset must not block installation.
      .catch(() => caches.open(VERSION).then(c => c.add('./index.html')))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Anything off-origin — Supabase, Google Fonts — goes straight to the network.
  if (url.origin !== self.location.origin) return;

  const isDocument = req.mode === 'navigate' ||
                     (req.headers.get('accept') || '').includes('text/html');

  if (isDocument) {
    // network-first, so a new version is picked up as soon as it exists
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // static assets: cache-first, they are versioned by the cache name
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});

// Lets the page force an update without a manual reload dance.
self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
