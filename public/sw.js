// Vuma service worker — runtime caching so the app itself stays usable
// offline (map, last-known location, previously-loaded pages), instead of
// the browser's own native "This site can't be reached" page taking over.
//
// Strategy:
// - API calls (/api/* on this domain, AND any cross-origin request like
//   Supabase's REST/Realtime API): never cached — always need live data.
//   Cross-origin requests matter here specifically because Supabase lives
//   on a completely different domain, so a same-origin-only exemption
//   silently let its responses fall through to the cache-first rule below
//   meant for static assets — serving permanently stale data on every
//   reload after the first fetch of any given query, indistinguishable
//   from updates simply not working at all.
// - Map tiles: cache-first, cached as they're viewed, so previously-seen
//   areas remain visible with no connection.
// - Page navigations: network-first, falling back to the last cached
//   version of that page, falling back to a generic offline shell.
// - Everything else (JS/CSS/images/fonts, same-origin only): cache-first
//   with runtime caching, for speed and offline resilience.

const CACHE_NAME = "vuma-cache-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/", OFFLINE_URL]).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Live data — never intercept, on this domain or any other.
  if (url.pathname.startsWith("/api/")) return;

  // Map tiles: cache-first, caching new tiles as they're seen.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return cached || new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  // Any other cross-origin request (Supabase's REST/Realtime/Storage API,
  // in practice) — always live, never cached. This is the fix: without
  // this check, these requests fell through to the cache-first static
  // asset rule below, meant for this app's own JS/CSS/images.
  if (url.origin !== self.location.origin) return;

  // Page loads: network-first (always prefer fresh content when online),
  // falling back to whatever was last cached for that exact page, falling
  // back to a generic offline shell as the last resort.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          return cached || (await cache.match("/")) || (await cache.match(OFFLINE_URL));
        })
    );
    return;
  }

  // Static assets (same-origin only, guaranteed by the check above):
  // cache-first, runtime-cached as they're encountered.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return cached || Response.error();
      }
    })
  );
});
