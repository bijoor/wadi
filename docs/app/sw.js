// Wadi PWA service worker (offline support for the browser app at /app/).
//
// This file is a TEMPLATE. The viewer build (vite.viewer.config.ts →
// pwaBuild plugin) fills in the version hash and the precache list (the
// shell URLs, including the current hashed bundles) and writes the result
// to docs/app/sw.js. Editing this file changes the shipped worker on the
// next `npm run build`.
//
// Caching strategy:
//   • Shell (this /app/ origin: index.html, hashed assets, icons, manifest,
//     and — if present — the bundled default config + templates): PRECACHED at
//     install, served cache-first. Immutable hashed assets never revalidate.
//   • Navigations: app-shell — serve the cached index.html so the SPA boots
//     offline, refreshing it in the background when online.
//   • Everything else the app fetches (root-absolute /house_config.json, /2d/…,
//     and CROSS-ORIGIN R2 furniture / templates): stale-while-revalidate into a
//     runtime cache, so they work offline once they've been fetched online.
//
// Scope note: the worker is registered at /app/ so it controls the app page.
// Scope limits which PAGES it controls — not which requests it sees — so it
// still intercepts the page's root-absolute and cross-origin fetches.

const VERSION = "7c18b537";
const SHELL_CACHE = `wadi-shell-${VERSION}`;
const RUNTIME_CACHE = `wadi-runtime-${VERSION}`;
const PRECACHE = ["./","./index.html","./assets/viewer-Db2VdZXp.js","./assets/viewer-QTnfLwEv.js","./assets/viewer-DiBI4YMN.css","./assets/viewer-eMDOTVv-.js","./assets/viewer-Dzt-8B3G.js","./assets/viewer-cFFQp462.js","./assets/viewer-s_7dLOsV.js","./assets/viewer-BDuPLM-V.js","./assets/viewer-DO7ifiGP.js","./assets/viewer-DuRL7t6i.js","./manifest.webmanifest","./favicon.svg","./icon-192.png","./icon-512.png","./apple-touch-icon.png","./templates/blank.json","./templates/family_home.wadi","./templates/index.json","./templates/single_story_cottage.wadi","/house_config.json","/2d/roof/roof-cross-section.svg"];

// Absolute URL of the app-shell document, used as the navigation fallback.
const SHELL_URL = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  // Precache the shell. addAll is atomic — if any entry 404s the whole install
  // fails, so keep the list to things the build guarantees exist.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  // No skipWaiting: a new version waits until existing tabs close, so a running
  // editing session never has its assets swapped mid-flight.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Is this request for an immutable, content-hashed asset we precached?
function isHashedAsset(url) {
  return url.origin === self.location.origin && url.pathname.includes("/assets/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET over http(s); leave POST/PUT, range media, extensions, etc.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Navigations → app shell (cache-first on the cached index.html so the app
  // boots offline; refresh it in the background when online).
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(SHELL_URL);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              caches.open(SHELL_CACHE).then((c) => c.put(SHELL_URL, res.clone()));
            }
            return res;
          })
          .catch(() => null);
        return cached || (await network) || caches.match(SHELL_URL);
      })(),
    );
    return;
  }

  // Immutable hashed bundles → cache-first (they never change under a name).
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok) {
              caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (root-absolute same-origin data + cross-origin R2 assets)
  // → stale-while-revalidate. Serve the cached copy immediately when present,
  // and update the cache in the background. Opaque (no-CORS) and CORS responses
  // are both cached; failures fall back to whatever is cached.
  //
  // The cache key is NORMALISED to origin+pathname (the query is dropped): the
  // app appends a `?t=<timestamp>` cache-buster to its R2 template/config
  // fetches, so keying on the full URL would miss offline (each request has a
  // new timestamp) and pile up one entry per load. Normalising means one entry
  // per resource and a reliable offline hit. Safe here because the app only ever
  // uses the query string as a cache-buster, never to select a resource.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const key = url.origin + url.pathname; // drop the ?t=… cache-buster
      const cached = await cache.match(key);
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            cache.put(key, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })(),
  );
});
