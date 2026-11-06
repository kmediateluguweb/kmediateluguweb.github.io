const CACHE_NAME = "k-media-telugu-v16";
const APP_SHELL = ["/", "/index.html", "/home.css?v=20261106-10", "/manifest.webmanifest", "/home-feed.json?v=20261106-11", "/logo-mark.svg"];
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
  const staticAsset = request.mode === "navigate" || /\.(?:css|js|json|svg|webmanifest)$/.test(url.pathname);
  if (!staticAsset) return;
  const cachedPromise = caches.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  });
  event.respondWith((async () => {
    const cached = await cachedPromise;
    if (cached) {
      event.waitUntil(networkPromise.catch(() => {}));
      return cached;
    }
    try { return await networkPromise; }
    catch (error) {
      if (request.mode === "navigate") return (await caches.match("/index.html")) || Response.error();
      throw error;
    }
  })());
});
