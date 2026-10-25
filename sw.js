const CACHE_NAME = 'learngre-v0';
const FONT_CACHE_NAME = 'learngre-fonts';

// Static application assets to pre-cache on install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/responsive.css',
  './js/app.js',
  './js/storage.js',
  './js/srs.js',
  './js/session.js',
  './js/distractor.js',
  './js/ui.js',
  './data/vocab.jsonl',
  './data/question_templates.jsonl'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use cache: 'reload' to bypass the browser HTTP disk cache
      // and guarantee that the latest files are fetched from the server.
      const requests = PRECACHE_ASSETS.map((url) => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, FONT_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (!allowedCaches.includes(name)) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Only handle same-origin or GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle Google Fonts (cache-first runtime caching)
  if (requestUrl.hostname.includes('fonts.googleapis.com') || requestUrl.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          return cachedResponse;
        }
      })
    );
    return;
  }

  // Strategy for HTML / Navigation requests: Network-First (fallback to Cache when offline)
  // Ensures user always gets the latest HTML when online, preventing stale asset references
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || caches.match('./index.html') || caches.match('./');
        })
    );
    return;
  }

  // Strategy for static assets: Cache-First, fallback to Network with automatic cache update
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
