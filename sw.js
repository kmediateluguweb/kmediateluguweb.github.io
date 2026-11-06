const CACHE_NAME = "k-media-telugu-v10";
const APP_SHELL = ["/", "/index.html", "/home.css?v=20261106-7", "/style.css", "/manifest.webmanifest", "/news-feed.json"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key.startsWith("k-media-telugu-")).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const isPageOrData = request.mode === "navigate" || /\\.(css|js|json)$/.test(url.pathname);
  if (isPageOrData) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const refresh = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => {}));
        return cached;
      }
      return refresh.catch(() => request.mode === "navigate" ? caches.match("/index.html") : Response.error());
    })());
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }))
  );
});
