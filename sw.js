const CACHE_NAME = "k-media-telugu-v22";
const APP_SHELL = ["/", "/index.html", "/home.css?v=20261107-02", "/manifest.webmanifest", "/home-feed.json?v=20261107-01", "/logo-mark.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("k-media-telugu-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigation must be network-first: never serve the homepage for a missing article URL.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, {cache:"no-store"});
        if (response && response.ok && new URL(response.url || request.url).pathname === url.pathname) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      } catch (error) {
        const isArticleRoute = url.pathname.startsWith("/articles/") || url.pathname === "/article.html";
        if (!isArticleRoute) {
          const cachedHome = await caches.match("/") || await caches.match("/index.html");
          if (cachedHome) return cachedHome;
        }
        return new Response("ఈ వార్తను తెరవడానికి ఇంటర్నెట్ కనెక్షన్ అవసరం. మళ్లీ ప్రయత్నించండి.", {
          status:503, headers:{"Content-Type":"text/plain; charset=utf-8"}
        });
      }
    })());
    return;
  }

  const isAsset = /\.(?:css|js|json|svg|webmanifest)$/.test(url.pathname);
  if (!isAsset) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    });
    if (cached) {
      event.waitUntil(network.catch(() => {}));
      return cached;
    }
    return network;
  })());
});
