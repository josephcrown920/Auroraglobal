// Aurora Service Worker — cache-first for all static assets so repeat visits
// load instantly from the local cache instead of hitting the network.
// Strategy: cache-first for /assets/* (hashed JS/CSS bundles), Google Fonts
// CSS and font files. Everything else (API calls, SSR pages) is network-only
// so content stays fresh.

const CACHE = 'aurora-static-v1';

// On install, activate immediately rather than waiting for old tabs to close.
self.addEventListener('install', () => self.skipWaiting());

// On activate, delete every stale cache version except the current one,
// then take over all open clients without a reload.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Decide what to cache.
  // 1. Vite-built assets: hashed filenames in /assets/ — safe to cache forever.
  // 2. Google Fonts CSS (tiny, tells the browser which font files to load).
  // 3. Google Fonts actual font binaries from fonts.gstatic.com.
  // 4. The app's own favicon / logo images.
  const isCacheable =
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(woff2?|ttf|otf|eot)$/) ||
    url.pathname.match(/\.(png|ico|svg|webp)$/) ||
    (url.hostname === 'fonts.googleapis.com' && url.pathname.startsWith('/css')) ||
    url.hostname === 'fonts.gstatic.com';

  if (!isCacheable) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Only cache successful or opaque (cross-origin) responses.
          if (response.ok || response.type === 'opaque') {
            caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached ?? new Response('', { status: 503, statusText: 'Offline' }));
    })
  );
});
