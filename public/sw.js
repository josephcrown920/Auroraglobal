// Aurora Service Worker — multi-strategy caching for near-instant repeat visits
// and offline resilience.
//
// Strategies:
//   /assets/*            → Cache-first (Vite hashes guarantee freshness)
//   Fonts (Google/gstatic) → Cache-first (immutable after first download)
//   Images (.png/.jpeg/.webp/.jpg/.svg/.ico) → Cache-first
//   Navigation (HTML pages) → Stale-while-revalidate (show fast, refresh bg)
//   API / everything else → Network-only (never stale)
//
// Install: pre-warm the cache with landing images & nav icons so the first
// meaningful paint is fast even on slow connections.

const STATIC_CACHE  = 'aurora-static-v3';
const PAGE_CACHE    = 'aurora-pages-v3';

// Public files to pre-cache at install time (non-hashed, stable paths).
// /offline.html is always first — it's the fallback for uncached navigation.
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/landing-photo-1.jpeg',
  '/landing-photo-2.jpeg',
  '/landing-photo-3.jpeg',
  '/landing-photo-4.jpeg',
  '/landing-photo-5.jpeg',
  '/landing-photo-6.png',
  '/landing-photo-7.png',
  '/landing-photo-8.png',
  '/landing-photo-nba-josh.png',
  '/landing-photo-studios-grid.png',
  '/nav-previews/perform-anywhere.jpg',
  '/nav-previews/scene-builder.jpg',
  '/nav-previews/video-agent.jpg',
  '/nav-previews/motion.jpg',
];

// On install: pre-cache landing assets, then activate immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE_ASSETS.map((url) =>
            new Request(url, { cache: 'reload' })
          )
        ).catch(() => {})
      )
      .then(() => self.skipWaiting())
  );
});

// On activate: prune every stale cache, then claim all open clients.
self.addEventListener('activate', (event) => {
  const KEEP = new Set([STATIC_CACHE, PAGE_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(woff2?|ttf|otf|eot)$/) ||
    url.pathname.match(/\.(png|ico|svg|webp|jpeg|jpg|gif|mp4|webm)$/) ||
    (url.hostname === 'fonts.googleapis.com' && url.pathname.startsWith('/css')) ||
    url.hostname === 'fonts.gstatic.com'
  );
}

function isNavigation(request) {
  return request.mode === 'navigate';
}

function isApiCall(url) {
  return url.pathname.startsWith('/api/') ||
         url.pathname.startsWith('/_server/');
}

// Cache-first: return cache hit immediately; fetch + update cache on miss.
function cacheFirst(request, cacheName) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      if (response.ok || response.type === 'opaque') {
        caches.open(cacheName).then((c) => c.put(request, response.clone()));
      }
      return response;
    }).catch(() => cached ?? new Response('', { status: 503, statusText: 'Offline' }));
  });
}

// Stale-while-revalidate: return cache immediately (fast), then refresh in bg.
// Falls back to /offline.html when the page is not cached and network is down.
function staleWhileRevalidate(request, cacheName) {
  const fetchAndCache = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(cacheName).then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return caches.match(request).then((cached) => {
    // Kick off the network fetch regardless (background update).
    const networkPromise = fetchAndCache;
    // If we have a cached copy, return it straight away.
    if (cached) return cached;
    // No cache — wait for the network; serve offline page if it fails.
    return networkPromise.then((r) => {
      if (r) return r;
      return caches.match('/offline.html').then(
        (offline) => offline ?? new Response('You are offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      );
    });
  });
}

// ── Fetch handler ─────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept API calls — always go to the network.
  if (isApiCall(url)) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  if (isNavigation(event.request)) {
    event.respondWith(staleWhileRevalidate(event.request, PAGE_CACHE));
    return;
  }

  // Everything else: network-only.
});
