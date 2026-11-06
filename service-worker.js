// Legacy admin worker: unregister itself so it cannot override the main site's worker.
self.addEventListener("install", event => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await caches.delete("kmedia-news-manager-v3");
    await self.registration.unregister();
  })());
});
