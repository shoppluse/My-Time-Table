const CACHE_NAME = "iskcon-farm-v4-final";
const APP_SHELL = [
  "./",
  "./index.html",
  "./productdetail.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Install: cache essential local files only
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(APP_SHELL);
      } catch (error) {
        console.warn("Some core assets failed to cache during install:", error);
      }
    })
  );
});

// Activate: remove all old caches and take control immediately
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

// Fetch handling
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // -----------------------------
  // 1. HTML / page navigation => NETWORK FIRST
  // Prevents old index.html showing after reload
  // -----------------------------
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request, { ignoreSearch: true });
          return cachedPage || caches.match("./index.html");
        })
    );
    return;
  }

  // -----------------------------
  // 2. Same-origin static assets => CACHE FIRST + background update
  // Best for icons, manifest, local files
  // -----------------------------
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        // Return cached immediately if available, otherwise wait for network
        return cachedResponse || networkFetch;
      })
    );
    return;
  }

  // -----------------------------
  // 3. External resources (Unsplash, Google Fonts, CDN)
  // Don't cache them to avoid stale/old external content
  // -----------------------------
  event.respondWith(
    fetch(request).catch(() => {
      // Optional graceful fallback for failed external image requests
      if (request.destination === "image") {
        return new Response("", { status: 204 });
      }
    })
  );
});
