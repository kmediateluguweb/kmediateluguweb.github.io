const CACHE_NAME = "k-media-telugu-v29";
const APP_SHELL = ["/", "/index.html", "/home.css?v=20261109-1", "/manifest.webmanifest", "/home-feed.json?v=20261110-1", "/logo-mark.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("k-media-telugu-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;

  // Public Supabase news images: cache-first for repeat visits, refresh quietly.
  // These are public editorial images only; never cache authenticated API data.
  if (url.hostname === "mewyojxgsuceppsauesh.supabase.co" &&
      url.pathname.startsWith("/storage/v1/object/public/news-images/") &&
      request.destination === "image") {
    event.respondWith((async () => {
      const cache = await caches.open("kmt-public-images-v1");
      const cached = await cache.match(request);
      const refresh = fetch(request).then(async response => {
        if (response && (response.ok || response.type === "opaque")) {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          if (keys.length > 160) {
            for (const key of keys.slice(0, keys.length - 160)) await cache.delete(key);
          }
        }
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => {}));
        return cached;
      }
      return (await refresh).catch(() => caches.match(request));
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigation must be network-first. A missing static article is intentionally
  // handled by 404.html, which resolves its short ID through Supabase.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, {cache:"no-store"});
        if (url.pathname.startsWith("/articles/")) {
          const html = await response.clone().text();
          const contentType = response.headers.get("content-type") || "";
          const canonical = html.match(/<link\s+rel=["\x27]canonical["\x27]\s+href=["\x27]([^"\x27]+)["\x27]/i);

          // IMPORTANT: Do not replace GitHub Pages' HTML 404 fallback with a
          // plain-text 503. The fallback JavaScript must run to find the article.
          if (response.status === 404 &&
              contentType.toLowerCase().includes("text/html") &&
              html.includes('id="kmt-article-fallback"')) {
            return response;
          }

          if (!response.ok || !canonical || canonical[1] !== (url.origin + url.pathname)) {
            return new Response("ఈ వార్తా పేజీ సర్వర్‌లో ఇంకా సరిగా అందుబాటులో లేదు. కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.", {status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
          }
          return new Response(html, {status:response.status,headers:response.headers});
        }
        return response;
      } catch (error) {
        const isArticleRoute = url.pathname.startsWith("/articles/") || url.pathname === "/article.html";
        if (!isArticleRoute) {
          const cachedHome = await caches.match("/") || await caches.match("/index.html");
          if (cachedHome) return cachedHome;
        }
        return new Response("ఈ వార్తను తెరవడానికి ఇంటర్నెట్ కనెక్షన్ అవసరం. మళ్లీ ప్రయత్నించండి.", {
          status:503, headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}
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
