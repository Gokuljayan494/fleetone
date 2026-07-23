/*
 * FleetOne service worker.
 *
 * Deliberately minimal. Its job is to make the app installable and to let the
 * shell open when the phone briefly drops signal — NOT to cache live data.
 *
 * - API calls (/api/*) and non-GET requests always go to the network, never a
 *   cache, so a driver never sees stale positions, trips or auth state.
 * - Page navigations are network-first, falling back to the cached shell only
 *   when truly offline.
 * - Static assets are cached so the app paints instantly on a flaky connection.
 */

const VERSION = "fleetone-v1";
const SHELL = `${VERSION}-shell`;

self.addEventListener("install", (event) => {
  // Activate the new worker immediately rather than waiting for old tabs to close.
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(["/"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs. Everything else (POSTs, /api, tiles, OSM) is
  // untouched so live data and mutations always hit the server.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: try the network first, fall back to the shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((r) => r ?? Response.error())),
    );
    return;
  }

  // Static assets: serve from cache if present, otherwise fetch and cache.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((res) => {
          if (res.ok && (res.type === "basic" || res.type === "default")) {
            const copy = res.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
