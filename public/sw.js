const CACHE_NAME = "holdbold-pwa-v2";
const OFFLINE_FALLBACK_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_FALLBACK_URL,
  "/icon",
  "/apple-icon",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())))
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableAsset(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return /\.(?:js|css|png|svg|jpg|jpeg|webp|gif|ico|woff2?)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(OFFLINE_FALLBACK_URL);
      })
    );
    return;
  }

  if (!isCacheableAsset(request, url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Holdbold", body: event.data.text() };
  }

  const title = payload.title || "Holdbold";
  const body = payload.body || "";
  const url = payload.url || "/dashboard/notifikationer";
  const icon = payload.icon || "/icon";
  const badge = payload.badge || "/icon";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = event.notification?.data?.url || "/dashboard/notifikationer";
  const destinationUrl = new URL(destination, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === destinationUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(destinationUrl);
      }
      return undefined;
    })
  );
});
