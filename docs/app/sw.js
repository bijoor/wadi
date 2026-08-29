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

const VERSION = "666c6f2f";
const SHELL_CACHE = `wadi-shell-${VERSION}`;
const RUNTIME_CACHE = `wadi-runtime-${VERSION}`;
const PRECACHE = ["./","./index.html","./assets/viewer-BA1GO83x.js","./assets/viewer-CNC7AqOf.js","./assets/viewer-At0tiqjU.css","./assets/viewer-Cjnve5tx.js","./assets/viewer-BWzL4roi.js","./assets/viewer-CZ_79vgy.js","./assets/viewer-iIPpR0e2.js","./assets/viewer-Dkbiz_v3.js","./assets/viewer-B2lNDgTg.js","./assets/viewer-ZsUNQkRv.js","./assets/viewer-j-2UvOlr.js","./assets/viewer-QiwdHIUk.js","./assets/viewer-C1KTvbjP.js","./assets/viewer-DuRL7t6i.js","./manifest.webmanifest","./favicon.svg","./icon-192.png","./icon-512.png","./apple-touch-icon.png","./templates/blank.json","./templates/family_home.wadi","./templates/manifest.json","./templates/single_story_cottage.wadi","/house_config.json","/2d/roof/roof-cross-section.svg"];

// Web Share Target inbox: a shared .wadi file is stashed here (UNVERSIONED, so it
// survives a worker update) for the app to pick up on its next boot.
const SHARE_INBOX = "wadi-share-inbox";
const SHARE_INBOX_KEY = "/__shared_wadi__";

// Absolute URL of the app-shell document, used as the navigation fallback.
const SHELL_URL = new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  // Precache the shell. addAll is atomic — if any entry 404s the whole install
  // fails, so keep the list to things the build guarantees exist.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
  // skipWaiting: activate the new worker immediately instead of waiting for all
  // open tabs to close. This is what lets a REINSTALLED desktop app pick up the
  // new viewer bundle — otherwise the persisted WKWebView service worker keeps
  // serving the old shell across reinstalls (its "client" never counts as
  // closed), and rebuilt viewer code silently doesn't run. The tradeoff (a live
  // browser editing session could get the new worker mid-flight) is bounded:
  // the already-loaded page keeps its in-memory assets, and the fresh shell only
  // takes effect on the NEXT navigation/reload. (activate keeps the current
  // version's caches; only strictly-older versions are pruned.)
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE && k !== SHARE_INBOX)
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

  // Web Share Target: when the OS shares a file INTO Wadi, it POSTs it to
  // <scope>share-target (declared in the manifest). Stash the file and redirect to
  // the app, which loads it on boot. This is what makes a .wadi shared from another
  // app (WhatsApp, Files, …) open in the installed Wadi PWA on Android.
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/share-target")) {
    event.respondWith(
      (async () => {
        try {
          const form = await req.formData();
          const file =
            form.get("wadi") ||
            [...form.values()].find((v) => v && typeof v.text === "function");
          if (file && typeof file.text === "function") {
            // Read the file to TEXT here (reliable in the SW) and stash the text,
            // rather than storing the File as a Response body (which some Androids
            // fail to read back on the app side). Boot reads it via res.text().
            const text = await file.text();
            const cache = await caches.open(SHARE_INBOX);
            await cache.put(
              SHARE_INBOX_KEY,
              new Response(text, { headers: { "content-type": "application/json" } }),
            );
          }
        } catch (_e) {
          /* ignore — the app shows a "couldn't read the shared file" notice */
        }
        // 303 → the client GETs the shell; boot reads the stashed file.
        return Response.redirect(
          new URL("index.html?shared=1", self.registration.scope).href,
          303,
        );
      })(),
    );
    return;
  }

  // Only handle GET over http(s); leave POST/PUT, range media, extensions, etc.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Navigations → app shell, NETWORK-FIRST (with an offline cache fallback).
  // Cache-first here was the "splash, no UI" bug: a cached index.html from an
  // earlier deploy references a hashed JS chunk that a newer deploy pruned, so
  // the entry script 404s and the app never mounts. Fetching the shell from the
  // network first guarantees index.html + its chunks always match the CURRENT
  // deploy. Fall back to the cached shell only when the network is unreachable
  // (offline) or too slow, so the PWA still launches without a connection.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        let res = null;
        try {
          res = await Promise.race([
            fetch(req),
            new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);
        } catch {
          res = null;
        }
        if (res && res.ok) {
          caches.open(SHELL_CACHE).then((c) => c.put(SHELL_URL, res.clone()));
          return res;
        }
        return (await caches.match(SHELL_URL)) || (res ?? Response.error());
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
