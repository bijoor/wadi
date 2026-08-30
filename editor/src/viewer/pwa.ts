// PWA glue for the browser app: service-worker registration, an in-app
// "Install app" button, and a startup pass that warms/refreshes the offline
// cache (templates + furniture GLBs) when there's connectivity.
//
// All of this is WEB-ONLY. The Tauri desktop app is already offline and is
// distributed natively, so every entry point here is guarded off there (via
// isTauri() and a secure-browser check).

import { isTauri } from "@tauri-apps/api/core";
import { FURNITURE_CATALOG, furnitureUrl, furnitureBaseUrl } from "../furniture/catalog";
import { fetchCatalogText } from "../io/templateSource";

// A real browser on a secure origin (https or localhost) — the only place a
// service worker can run. Tauri (tauri:// or *.tauri.localhost) is excluded
// both here and explicitly via isTauri().
function isSecureBrowser(): boolean {
  return (
    !isTauri() &&
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  );
}

// Already launched as an installed app? Then don't offer to install again.
function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

// Run `tasks` with at most `n` in flight — keeps the warm pass from saturating
// a slow mobile connection.
async function runPool(tasks: Array<() => Promise<unknown>>, n: number): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) {
      const task = tasks[i++];
      try {
        await task();
      } catch {
        /* best-effort warm; ignore individual failures */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, worker));
}

const GLB_WARM_KEY = "wadi.offlineGlbWarm";

// Fetch every template .wadi + (once per catalog version) every furniture GLB so
// they're in the service worker's runtime cache for offline use. Templates are
// re-fetched on each online start (they're the mutable content and small); GLBs
// are large and effectively immutable, so they're warmed ONCE per catalog+host
// version — re-downloading ~2 MB on every launch would punish mobile-data users,
// and the SW already revalidates any GLB whenever it's actually used.
async function warmOfflineCache(): Promise<void> {
  if (!isSecureBrowser()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  // Only meaningful once a worker controls the page (so its fetch handler caches
  // what we request). On a first-ever load clients.claim() makes this true after
  // activation; if not yet controlled, skip — the next start will warm.
  if (!navigator.serviceWorker.controller) return;

  // Templates — refresh every online start. fetchCatalogText already does the
  // R2→bundled fallback + timeout, and its request flows through the SW cache.
  try {
    const idx = JSON.parse(await fetchCatalogText("index.json")) as {
      templates?: Array<{ id: string }>;
    };
    const ids = (idx.templates ?? []).map((t) => t.id).filter(Boolean);
    await runPool(
      ids.map((id) => () => fetchCatalogText(`${id}.wadi`)),
      4,
    );
  } catch {
    /* offline / index unreachable → nothing to refresh */
  }

  // GLBs — warm once per (catalog size + host). Changing either re-warms.
  const glbVersion = `${FURNITURE_CATALOG.length}@${furnitureBaseUrl()}`;
  let warmed: string | null = null;
  try {
    warmed = localStorage.getItem(GLB_WARM_KEY);
  } catch {
    /* localStorage blocked — just warm this session */
  }
  if (warmed !== glbVersion) {
    await runPool(
      FURNITURE_CATALOG.map((f) => () =>
        // Read the body so the download completes (and the SW caches the full
        // response); a HEAD-only touch wouldn't populate the cache body.
        fetch(furnitureUrl(f.id)).then((r) => (r.ok ? r.arrayBuffer() : null)),
      ),
      6,
    );
    try {
      localStorage.setItem(GLB_WARM_KEY, glbVersion);
    } catch {
      /* ignore */
    }
  }
}

// The desktop app must NOT run a service worker. The embedded Tauri server
// already serves the bundle locally and offline, so a worker adds nothing —
// but a PERSISTED WKWebView worker (left by an older build, or a web session
// sharing this webview's storage) keeps controlling the page across launches
// and can strand it on a stale/partial bundle: after an app update the old
// worker prunes its cache, the still-running old index.html then lazy-loads a
// code-split `viewer-*.js` chunk that 404s, and the 3D view renders broken (an
// unpopulated ground plane, missing geometry). Registration is already skipped
// in Tauri, but skipping isn't enough — an ALREADY-registered worker lingers.
// So proactively tear any worker + its caches down; if one was controlling this
// very load, reload ONCE to boot cleanly from the embedded server.
async function purgeStaleWorkers(): Promise<void> {
  try {
    const hadController = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if (hadController && !sessionStorage.getItem("wadi.swPurged")) {
      sessionStorage.setItem("wadi.swPurged", "1"); // guard against a reload loop
      location.reload();
    }
  } catch {
    /* best-effort teardown; a failure just leaves the (harmless) status quo */
  }
}

// Register the service worker (web only) and, once it controls the page, warm
// the offline cache in the background (on idle, so it never competes with boot).
export function registerServiceWorker(): void {
  if (!isSecureBrowser()) {
    void purgeStaleWorkers(); // Tauri / file:// → native offline; kill any SW left behind
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* offline support is best-effort; ignore registration failures */
    });
    // Warm after the worker is ready + the browser is idle.
    navigator.serviceWorker.ready
      .then(() => {
        const run = () => void warmOfflineCache();
        if ("requestIdleCallback" in window) {
          (window as unknown as { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(
            run,
            { timeout: 4000 },
          );
        } else {
          setTimeout(run, 2000);
        }
      })
      .catch(() => {});
  });
}

// The header "⬇ Install app" button (#btn-install), shown only in a web browser
// that can install (and isn't already installed). On Chromium/Android it fires
// the native install prompt; on iOS Safari (no beforeinstallprompt) it explains
// the Share → Add to Home Screen gesture. Stays hidden in the Tauri app and once
// installed. Lives in the header buttons row so it never overlaps the viewer UI.
export function setupInstallPrompt(): void {
  if (!isSecureBrowser() || isStandalone()) return;

  let deferred: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent); // only Safari can Add to Home Screen

  const wire = (): void => {
    const btn = document.getElementById("btn-install") as HTMLButtonElement | null;
    if (!btn) return;
    const show = () => { btn.style.display = ""; };
    const hide = () => { btn.style.display = "none"; };

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault(); // keep our own button in control
      deferred = e as typeof deferred;
      show();
    });
    window.addEventListener("appinstalled", hide);

    btn.addEventListener("click", async () => {
      if (deferred) {
        await deferred.prompt();
        try {
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") hide();
        } catch {
          /* ignore */
        }
        deferred = null;
      } else if (isIOS) {
        alert("To install Wadi: tap the Share button, then “Add to Home Screen”.");
      }
    });

    // iOS never fires beforeinstallprompt — reveal the button so the user can
    // learn the gesture. Others wait for the event before revealing it.
    if (isIOS) show();
  };
  if (document.body) wire();
  else window.addEventListener("DOMContentLoaded", wire);
}
