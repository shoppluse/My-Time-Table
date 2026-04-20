const CACHE_NAME = "iskcon-farm-v3-no-stale";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./productdetail.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Install: cache only core local files
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

// Activate: delete all old caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// 1. For HTML/navigation => ALWAYS network first (prevents old homepage showing after reload)
// 2. For same-origin local assets => cache first, then network fallback
// 3. For external CDN/images => just fetch normally (don't cache old remote stuff)
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Handle page navigation / HTML requests with NETWORK FIRST
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match("./index.html");
          });
        })
    );
    return;
  }

  // Cache only same-origin local assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((networkResponse) => {
            // cache successful local GET requests only
            if (request.method === "GET" && networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // External resources (Unsplash, Fonts, CDN) => no forced caching
  event.respondWith(fetch(request));
});
