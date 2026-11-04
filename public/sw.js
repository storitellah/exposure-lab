/*
 * Tatu Exposure Lab service worker.
 * - Versioned cache; obsolete caches are removed on activate.
 * - Precaches only the essential app shell; everything else is cached
 *   after first use (same-origin GET, successful responses only).
 * - Navigations are network-first with an offline fallback, so users are
 *   never trapped on an obsolete version.
 * - Blob/data URLs, POSTs and cross-origin requests are never touched.
 */
const VERSION = 'v1.3.0';
const CACHE_NAME = `tatu-lab-${VERSION}`;
const SHELL = ['/', '/manifest.webmanifest', '/icons/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return;

  // Navigations: network first, cached shell as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Static assets: cache first, then network; cache successful responses.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && (response.type === 'basic' || response.type === 'default')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response; // error responses are returned but never cached
      });
    }),
  );
});
