/*
 * FleetOne service worker.
 *
 * Deliberately minimal. Its job is to make the app installable and to let the
 * shell open when the phone briefly drops signal — NOT to cache live data.
 *
 * - API calls (/api/*) and non-GET requests always go to the network, never a
 *   cache, so a driver never sees stale positions, trips or auth state.
 * - Everything else is network-first: the freshest version always wins when
 *   online, and the cache is only a fallback for when the connection drops.
 *   (Cache-first would serve stale CSS/JS after an update — avoided here.)
 */

const VERSION = "fleetone-v2";
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

  // Page navigations: network first, fall back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((r) => r ?? Response.error())),
    );
    return;
  }

  // Everything else (CSS, JS, icons): network first so updates always win,
  // updating the cache as we go; only fall back to cache when offline.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && (res.type === "basic" || res.type === "default")) {
          const copy = res.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r ?? Response.error())),
  );
});
