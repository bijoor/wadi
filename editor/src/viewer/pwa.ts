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

// Register the service worker (web only) and, once it controls the page, warm
// the offline cache in the background (on idle, so it never competes with boot).
export function registerServiceWorker(): void {
  if (!isSecureBrowser()) return; // Tauri / file:// → native offline, no SW
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

// A floating "Install app" pill, shown only in a web browser that can install
// (and isn't already installed). On Chromium/Android it fires the native
// install prompt; on iOS Safari (no beforeinstallprompt) it explains the
// Share → Add to Home Screen gesture. Hidden entirely in the Tauri app.
export function setupInstallPrompt(): void {
  if (!isSecureBrowser() || isStandalone()) return;

  let deferred: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent); // only Safari can Add to Home Screen

  const pill = document.createElement("button");
  pill.id = "wadi-install";
  pill.type = "button";
  pill.textContent = "⬇ Install app";
  Object.assign(pill.style, {
    position: "fixed",
    right: "16px",
    bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
    zIndex: "2000",
    display: "none",
    alignItems: "center",
    gap: "6px",
    padding: "10px 16px",
    borderRadius: "999px",
    border: "none",
    background: "#B85028",
    color: "#fff",
    font: "600 0.9rem system-ui, -apple-system, sans-serif",
    boxShadow: "0 4px 16px rgba(30,20,10,0.28)",
    cursor: "pointer",
  } as CSSStyleDeclaration);

  const hint = document.createElement("div");
  Object.assign(hint.style, {
    position: "fixed",
    right: "16px",
    bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
    zIndex: "2000",
    display: "none",
    maxWidth: "260px",
    padding: "10px 14px",
    borderRadius: "12px",
    background: "#fff",
    color: "#23201c",
    font: "500 0.82rem/1.4 system-ui, -apple-system, sans-serif",
    boxShadow: "0 6px 24px rgba(30,20,10,0.22)",
    border: "1px solid #e7ded1",
  } as CSSStyleDeclaration);
  hint.textContent = "Tap the Share button, then “Add to Home Screen”.";

  const show = () => {
    pill.style.display = "inline-flex";
  };
  const remove = () => {
    pill.remove();
    hint.remove();
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep our own button in control
    deferred = e as typeof deferred;
    show();
  });

  window.addEventListener("appinstalled", remove);

  pill.addEventListener("click", async () => {
    if (deferred) {
      await deferred.prompt();
      try {
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") remove();
      } catch {
        /* ignore */
      }
      deferred = null;
    } else if (isIOS) {
      // Toggle the Share→Add-to-Home-Screen hint.
      hint.style.display = hint.style.display === "none" ? "block" : "none";
    }
  });

  const attach = () => {
    document.body.appendChild(hint);
    document.body.appendChild(pill);
    // iOS never fires beforeinstallprompt — show the pill so the user can learn
    // the gesture. Others wait for the event before revealing it.
    if (isIOS) show();
  };
  if (document.body) attach();
  else window.addEventListener("DOMContentLoaded", attach);
}
