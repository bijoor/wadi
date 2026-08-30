// Viewer bootstrap — hooks the TS SVG generators + Three.js scene +
// editor's Sidebar/PropertyPanel components into the tabbed viewer
// UI (docs/index.html).
//
// The viewer HTML stays vanilla JS; this module:
//  1. Fetches ../house_config.json once on load and populates
//     the shared useConfigStore.
//  2. Whenever the store's config changes (either on load or from a
//     user edit via Sidebar/PropertyPanel), rebuilds the in-memory
//     Map<url, svg-string> from the SVG generators and patches
//     window.fetch so the vanilla-JS loaders below silently see
//     generated content instead of hitting disk. Also resets each
//     tab's "loaded" flag and triggers a re-load of whichever tab
//     is currently visible.
//  3. Mounts a Three.js scene into the 3D tab's container and the
//     layer-visibility checkboxes into the layer slot.
//  4. Mounts editor's Sidebar + PropertyPanel into the two edit slots
//     added to the HTML shell. They're only visible in edit mode.
//  5. Wires the header buttons: Edit toggle, Load, Save, Undo, Redo.

// Use the editor's own index.css so the mounted Sidebar/PropertyPanel/
// form components get EXACTLY the same Tailwind + reset rules the
// standalone editor uses. The viewer's inline <style> block in
// viewer.html handles the page-specific chrome (gradient body,
// tabs, header buttons).
import "../index.css";

import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { useConfigStore } from "../state/configStore";
import { validate } from "../schema/houseConfig";
import type { HouseConfig as ValidatedHouseConfig, HouseObject } from "../schema/houseConfig";
import type { HouseConfig } from "../svg2d/expand";
import { roomBlocksOf, connectionSatisfied } from "../graph/graphModel";
import { lintStructure, partitionFindings, type LintFinding } from "../lint/structural";
import { generateAllFloorPlans } from "../svg2d/floorPlansAll";
import { generateCombinedFloorPlans } from "../svg2d/floorPlansCombined";
import { generateCompositeSheet } from "../svg2d/compositeSheet";
import type { DrawFilter } from "../svg2d/drawFilter";
import { objectKey } from "../svg2d/drawFilter";
import { effectiveLayers, heuristicLayerId, useLayerStore } from "../three/layers";
import { generateAllElevations } from "../svg2d/elevationsAll";
import { generateCombinedElevations } from "../svg2d/elevationsCombined";
import { computeRoofSections } from "../svg2d/roof/index";
import { frameBomHtml, metalBomHtml, roofMaterialBomHtml, readTileDensities, readMetalStock } from "../svg2d/roof/htmlBom";
import { collectV2AsLegacyFrameMembers } from "../svg2d/roof/v2/computeFromHouse";
import { computeMergedV2Spec } from "../svg2d/roof/v2/computeFromHouse";
import { ridgeRunFt, slopeAreaSft } from "../svg2d/roof/v2/bom";
import { generateAllPillarSvgs } from "../svg2d/pillar/index";
import { computeWallAreas } from "../estimate/wallArea";
import { wallAreaHtml } from "../estimate/wallAreaHtml";
import { setDimensionUnits } from "../svg2d/format";
import { setTextScale, computeTextScale, houseSpanUnits } from "../svg2d/config";
import {
  pickAndLoadConfig,
  loadConfigFromPath,
  parseConfigBytes,
  saveConfig,
  saveAsWadi,
  saveToLibrary,
  libraryDir,
  saveText,
  saveBinary,
} from "../io/fileIO";
import { wdlToConfig, configToWdlText } from "../io/wdl";
import { isTauri, invoke } from "@tauri-apps/api/core";
import {
  fetchCatalogBytes,
  loadCatalog,
  templateSource,
  setTemplateSource,
  resetCatalogSource,
  type TemplateSource,
} from "../io/templateSource";
import { isWadiBundle, readBundleCoverUrls } from "../io/wadiBundle";
import { writeValue } from "../configurator/spec";
import { mountConfiguratorPanel } from "./configuratorPanel";
import { listRooms, useInteriorStore } from "../three/interiorView";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { GraphView } from "../graph/GraphView";
import { mountViewer3D, mountViewerLightingPanel, mountViewerInteriorPanel } from "./mount3D";
import { mountViewer3DToolbar } from "./Toolbar3D";
import { startConfigWatcher } from "./configWatcher";
import { registerServiceWorker, setupInstallPrompt } from "./pwa";

// Root-absolute so they resolve to the site root no matter where the app
// is served from (it lives at /app/, its data assets stay at the root).
// The generated 2d/ tab content is intercepted by patchFetch and never
// hits the network, so only these real-file fetches need the leading "/".
const CONFIG_URL = "/house_config.json";
const EAVE_CROSS_SECTION_URL = "/2d/roof/roof-cross-section.svg";
const LEFT_PANEL_KEY = "wadi:left-panel";

// State shared with the fetch patch — mutated whenever the config
// changes so that subsequent fetches return the fresh SVG strings.
const svgMap = new Map<string, string>();
let eaveSvg: string | undefined;

async function bootViewer(): Promise<void> {
  // Kick off the hand-drawn eave cross-section fetch immediately —
  // needed by the roof pipeline's eave panel.
  const eavePromise = fetch(EAVE_CROSS_SECTION_URL)
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");

  // Native file open (desktop app): if the OS launched us with a .wadi
  // file (double-click / file association) or hands us one while running,
  // load THAT — it's the most explicit user intent, so it outranks both
  // the share-link fragment and the repo auto-load. Setting the path via
  // loadConfig makes the live watcher attach to the opened file.
  let loadedFromOpenFile = false;
  if (isTauri()) {
    // Warm opens (app already running) arrive as an event; load live.
    void listen<string>("wadi://open-file", (e) => {
      if (e.payload) void openWadiPath(e.payload);
    });
    // MCP bridge (Phase 2): the wadi-mcp server POSTs to the app's localhost
    // bridge; Rust emits the request here. Load the config into the live 3D
    // view and, for a capture, read back a 3D image after the scene settles.
    void listen<{
      id: string;
      action: string;
      config: unknown;
      view?: { room?: string; camera?: string; layers?: Record<string, boolean>; isolate?: string[] };
    }>(
      "wadi://bridge-request",
      async (e) => {
      const { id, action, config, view } = e.payload;
      try {
        window.wadi?.load(config);
        if (action === "capture") {
          // The full layer list (id + label) for the caller to discover ids from.
          const availLayers = window.wadi?.listLayers?.() ?? [];
          // Resolve a requested key (id OR label, case-insensitive) → ALL matching
          // layer ids. An exact id/label hit is used alone; otherwise every layer
          // whose id/label CONTAINS the key matches — so "structure" spans
          // f1_structure + f2_structure, "walls" spans every floor's walls, etc.
          const resolveIds = (key: string): string[] => {
            const kl = key.toLowerCase();
            // An exact ID is unique → use it alone. Do NOT short-circuit on an
            // exact LABEL: labels are shared across floors (every floor has a
            // "Walls"/"Structure" layer), so matching the label must expand to
            // ALL floors — otherwise "walls" would grab only the first (often an
            // empty upper floor) and isolate to nothing.
            const byId = availLayers.find((l) => l.id === key);
            if (byId) return [byId.id];
            const subs = availLayers
              .filter(
                (l) =>
                  l.label.toLowerCase() === kl ||
                  l.id.toLowerCase().includes(kl) ||
                  l.label.toLowerCase().includes(kl),
              )
              .map((l) => l.id);
            return subs.length ? subs : [key];
          };
          // Apply requested visibility BEFORE the settle wait, so React reconciles
          // it into the R3F scene graph before we grab. Restored after capture.
          let layersChanged = false;
          if (view?.isolate?.length && window.wadi?.showOnlyLayers) {
            window.wadi.showOnlyLayers(view.isolate.flatMap(resolveIds));
            layersChanged = true;
          } else if (view?.layers && Object.keys(view.layers).length && window.wadi?.setLayers) {
            const rec: Record<string, boolean> = {};
            for (const [k, v] of Object.entries(view.layers)) for (const id of resolveIds(k)) rec[id] = v;
            window.wadi.setLayers(rec);
            layersChanged = true;
          }
          // Let React reconcile the new config (+ any layer change) into the R3F
          // scene, then capture. setTimeout, not RAF — RAF is paused when the
          // window is backgrounded, but the capture bridges force their own
          // gl.render(), so a plain timer is enough and never hangs.
          await new Promise((r) => setTimeout(r, 800));
          // Camera choice, in priority order: interior room → named exterior
          // preset → the current outside orbit. All position the camera directly
          // (no React re-render) so they work with the window backgrounded (an MCP
          // capture never has focus).
          let url: string | null = null;
          const roomQuery = view?.room?.trim();
          if (roomQuery && window.wadiCaptureInterior) {
            const q = roomQuery.toLowerCase();
            const rooms = listRooms(config);
            const match =
              rooms.find((r) => r.key === roomQuery) ??
              rooms.find((r) => r.name.toLowerCase() === q) ??
              rooms.find((r) => r.name.toLowerCase().includes(q)) ??
              rooms.find((r) => `${r.floorName}: ${r.name}`.toLowerCase().includes(q));
            if (match) url = window.wadiCaptureInterior(match.eye, 1200);
          }
          if (url === null && view?.camera && window.wadiCaptureView) {
            url = window.wadiCaptureView(view.camera, 1200);
          }
          if (url === null) url = window.wadiCapture3D?.(1200) ?? null;
          if (layersChanged) window.wadi?.showAllLayers?.(); // restore the live view
          if (!url) {
            await invoke("bridge_response", { id, ok: false, error: "capture returned null" });
            return;
          }
          const comma = url.indexOf(",");
          const data = comma >= 0 ? url.slice(comma + 1) : url;
          const mime = /^data:(.*?);/.exec(url)?.[1] ?? "image/jpeg";
          await invoke("bridge_response", {
            id,
            ok: true,
            png: data,
            mime,
            layers: availLayers.map((l) => ({ id: l.id, label: l.label, group: l.group })),
          });
        } else {
          await invoke("bridge_response", { id, ok: true });
        }
      } catch (err) {
        try {
          await invoke("bridge_response", { id, ok: false, error: String(err) });
        } catch {
          /* ignore */
        }
      }
    });
    // Cold start: drain any path captured before the webview was ready.
    try {
      const pending = await invoke<string | null>("take_pending_open");
      if (pending) {
        await openWadiPath(pending);
        loadedFromOpenFile = true;
      }
    } catch (err) {
      console.warn("viewer: take_pending_open failed", err);
    }
  }

  // Share-link handoff: if the URL carries a packed config in the '#'
  // fragment (…/#w1=…), load THAT house instead of the repo copy. This
  // is how a shared link opens a specific design on the static web app —
  // no backend, and the fragment never reaches a server. A malformed or
  // stale fragment decodes to null / fails validation and we quietly
  // fall through to the normal auto-load.
  let loadedFromHash = false;
  // When a share link is present but can't be opened, remember why so we can
  // TELL the recipient instead of silently showing the default house (which
  // looks like the link "worked" but with the wrong design).
  let shareLinkError: string | null = null;

  // File Handling API: when the OS opens a .wadi WITH the installed PWA — desktop
  // Chrome/Edge "Open with…", or Android where supported — the file arrives via
  // launchQueue rather than a share POST. Consume it and load; it overrides the
  // default house if it lands after boot. (file_handlers in the manifest is what
  // registers Wadi as an opener for .wadi in the OS.)
  if (typeof window !== "undefined" && "launchQueue" in window) {
    try {
      (window as unknown as {
        launchQueue: { setConsumer: (cb: (p: { files?: Array<{ getFile: () => Promise<File> }> }) => void) => void };
      }).launchQueue.setConsumer((params) => {
        void (async () => {
          const files = params?.files;
          if (!files || files.length === 0) return;
          try {
            const file = await files[0].getFile();
            const r = readWadiText(await file.text());
            if (r.data) {
              useConfigStore.getState().loadConfig(r.data, file.name || "opened file");
              // The launchQueue fires AFTER boot, so the owner gallery may have
              // already opened — dismiss it, otherwise the opened design sits
              // hidden behind it and the app looks like it hung.
              closeNewHouseModal();
            } else {
              showBanner(r.error ?? "Couldn't open that file.");
            }
          } catch (err) {
            console.warn("viewer: launchQueue file open failed", err);
            showBanner("Couldn't open that file: " + (err instanceof Error ? err.message : String(err)));
          }
        })();
      });
    } catch { /* launchQueue unsupported — the share-target path still works */ }
  }

  // Web Share Target: a .wadi shared INTO the installed PWA is stashed by the service
  // worker (see pwa/sw.js), which redirects here with ?shared=1. Load it (consumed
  // once) before the hash/default. This is how a file shared from WhatsApp/Files opens
  // in Wadi on Android without a link.
  if (
    !loadedFromOpenFile &&
    new URLSearchParams(location.search).has("shared") &&
    typeof caches !== "undefined"
  ) {
    try {
      const inbox = await caches.open("wadi-share-inbox");
      const res = await inbox.match("/__shared_wadi__");
      if (res) {
        await inbox.delete("/__shared_wadi__");
        const r = readWadiText(await res.text());
        if (r.data) {
          useConfigStore.getState().loadConfig(r.data, "shared file");
          loadedFromHash = true; // a specific design is loaded — skip the default auto-load
        } else {
          shareLinkError = r.error ?? "The shared file couldn't be opened.";
        }
      } else {
        // The share opened the app (…?shared=1) but the file never reached the
        // service worker's inbox. Surface it rather than showing the default.
        shareLinkError =
          "Received the share, but the file didn't come through. Please share it again — or use the 📂 Load button to open it.";
      }
    } catch {
      /* ignore — fall through to the normal load */
    }
  }

  // Floor-planner handoff: the optional planner add-on (/planner) stashes a
  // freshly-sketched HouseConfig in localStorage (same origin) and opens
  // /app#handoff. Read it once, then clear it so a reload doesn't reopen the
  // sketch. Reuses loadedFromHash so downstream skips the default auto-load.
  if (!loadedFromOpenFile && !loadedFromHash && location.hash === "#handoff") {
    try {
      const raw = localStorage.getItem("wadi:handoff");
      localStorage.removeItem("wadi:handoff");
      if (raw) {
        const parsed = validate(JSON.parse(raw), { tolerant: true });
        if (parsed.ok && parsed.data) {
          useConfigStore.getState().loadConfig(parsed.data, "floor planner");
          loadedFromHash = true;
        } else {
          console.warn("viewer: floor-planner handoff failed validation", parsed.errors);
        }
      }
    } catch (e) {
      console.warn("viewer: floor-planner handoff read failed", e);
    }
  }

  // (Share-as-URL retired: models are too large to pack into a link. A design is
  // shared now by handing over its `.wadi` bundle file — opened via the OS share
  // target, the 📂 Load button, or drag-and-drop.)

  // `?load` startup option — lets the app be driven as a pure renderer.
  //   • ?load=<url>  → fetch a house config from <url> and open it (skips the
  //     picker). Deep-link straight to a design.
  //   • ?load (bare) → EMBED mode: skip the picker + the default auto-load and
  //     wait for a programmatic window.wadi.load(). Used by the DSL playground,
  //     which iframes the app and pushes each compiled model in place.
  let loadedFromLoadParam = false;
  if (!loadedFromOpenFile && !loadedFromHash) {
    const params = new URLSearchParams(location.search);
    if (params.has("load")) {
      const url = params.get("load");
      if (url) {
        try {
          const raw = await (await fetch(url)).json();
          const parsed = validate(raw, { tolerant: true });
          if (parsed.ok && parsed.data) {
            useConfigStore.getState().loadConfig(parsed.data, "?load");
            loadedFromLoadParam = true;
          } else {
            console.error("viewer: ?load config failed validation", parsed.errors);
          }
        } catch (err) {
          console.warn("viewer: ?load fetch failed", err);
        }
      } else {
        loadedFromLoadParam = true; // bare ?load → embed; await wadi.load()
      }
    }
  }

  // Auto-load the JSON if it's next to the viewer (docs/house_config.json)
  // — unless a shared link already provided one. We validate and stuff
  // into useConfigStore so both the edit UI and the SVG generators pick
  // it up.
  if (!loadedFromOpenFile && !loadedFromHash && !loadedFromLoadParam) {
    try {
      const raw = await (await fetch(CONFIG_URL)).json();
      const parsed = validate(raw);
      if (parsed.ok && parsed.data) {
        useConfigStore.getState().loadConfig(
          parsed.data,
          "house_config.json (from repo)",
        );
      } else {
        console.error("viewer: house_config.json failed validation", parsed.errors);
      }
    } catch (err) {
      console.warn("viewer: no house_config.json auto-load", err);
    }
  }

  // A broken/stale share link fell back to the default house above — now
  // tell the recipient so they don't mistake it for the shared design.
  if (shareLinkError) showBanner(shareLinkError);

  eaveSvg = (await eavePromise) || undefined;

  // First SVG map build using whatever ended up in the store. Guarded so a
  // throw in SVG generation (e.g. an invalid opening on some object) can
  // NEVER abort init before the 3D scene + window APIs mount below — that
  // was the "model stopped loading altogether" failure.
  try {
    rebuildSvgMap();
  } catch (e) {
    console.error("[viewer] initial rebuildSvgMap failed:", e);
  }

  // Install the fetch patch once. It reads live from svgMap on every
  // call, so it doesn't need reinstalling after config changes.
  patchFetch();

  // Always-on WDL editor pane FIRST (before the 3D mounts): it shrinks the content
  // area, so the R3F canvas measures the correct width from the start instead of
  // sizing to the full width and then needing a refit.
  wireWdlEditor();

  // Mount the Three.js scene + layer panel. Both subscribe to
  // useConfigStore internally, so property-panel edits re-render the
  // scene automatically.
  const threeContainer = document.getElementById("viewer-3d-scene");
  if (threeContainer) mountViewer3D(threeContainer);
  // Slim architect toolbar (layer quick-toggles + preview capture). Owner-hidden
  // via CSS; always mounted so an in-place persona switch needs no re-mount.
  const toolbarContainer = document.getElementById("viewer-3d-toolbar");
  if (toolbarContainer) mountViewer3DToolbar(toolbarContainer);
  // (Old layer-visibility panel + layer-definition editor retired — the Toolbar3D
  // "Show/hide layers" dropdown is the live visibility UI; layers live in the WDL.)
  const lightingContainer = document.getElementById("viewer-lighting-list");
  if (lightingContainer) mountViewerLightingPanel(lightingContainer);
  const interiorContainer = document.getElementById("viewer-interior-panel");
  if (interiorContainer) mountViewerInteriorPanel(interiorContainer);

  // Configurator: the LEFT panel — a model's declared `configurator` inputs as
  // friendly sliders/selects, the simple no-WDL edit surface (the WDL editor is
  // the RIGHT panel). Shown whenever the loaded model declares inputs. Drives the
  // same writeValue path window.wadi.setKnob / a WebMCP agent uses.
  mountConfiguratorPanel();

  // Viewer chrome (embed mode + edit-mode flag). Personas are retired — one mode.
  applyViewerChrome();

  // Mount the editor's Sidebar (object tree) and PropertyPanel (per-object form).
  // Always mounted (React state via useConfigStore is shared) but hidden by CSS in
  // owner mode — so switching persona in place needs no re-mount and never loses
  // the loaded model.
  mountEditPanels();

  // Reactivity: whenever config mutates, rebuild the SVG map and
  // force the currently-visible tab to reload from the fresh strings.
  subscribeConfig();

  // Header buttons: Edit toggle, Load, Save, Undo, Redo.
  wireHeaderButtons();
  // Header ☰ — collapse/expand the left configurator panel.
  wireLeftToggle();
  // Standard keyboard shortcuts (⌘/Ctrl + S / ⇧S / O / N / Z / ⇧Z, ⌘Y).
  wireKeyboardShortcuts();
  // Offer to save unsaved changes before the app/tab closes.
  wireCloseGuard();
  // Drag-and-drop a .wadi onto the app to open it (the reliable path on iPadOS,
  // where Safari's file picker can't select a custom .wadi).
  wireFileDrop();
  // Expose window.exportCurrentSvg for the inline lightbox toolbar.
  wireExports();
  // Expose the on-demand Layout render + panel metadata.
  wireLayoutApi();
  // Expose window.wadi — the programmatic control API (templates, load,
  // knobs, view) so automation / the home-architect skill can drive the
  // model without the UI.
  wireWadiApi();
  // Read-only "layers hidden" badge — keeps the homeowner oriented when the
  // skill hides layers and the layer panel isn't visible.
  wireLayerStatus();
  // Register the wadi controls as WebMCP tools so any WebMCP browser agent
  // (Gemini in Chrome, Claude, …) can drive the model. No-op without WebMCP.
  wireWebMcpTools();
  // Expose the 2D capture bridges (architect "take a shot" + auto floor plan).
  wireCaptureBridges();
  // Surface geometry warnings (invalid openings dropped during expansion)
  // as a banner instead of silently blanking the 3D model.
  wireGeometryWarnings();

  // Live-preview loop (Tauri only): poll the loaded config file and
  // reload the model when an external editor (Claude Code / MCP) writes
  // it. No-op in a plain browser tab.
  startConfigWatcher();

  // Owner welcome/empty state: a home counts as "chosen" only if a share link
  // or an opened file drove this load. A fresh default load = not chosen, so the
  // owner sees the welcome overlay (not the leftover default model) until they
  // pick something. Architects never see it (CSS-gated to owner).
  document.body.dataset.homeChosen =
    loadedFromOpenFile || loadedFromHash || loadedFromLoadParam ? "yes" : "no";
  wireOwnerWelcome();

  // Owner first-step: on a fresh default load (no shared link, no opened
  // file), greet the owner (Gharkul) with the template gallery so they START
  // by choosing a home to customize. Architects, share-link recipients, and
  // file-opens skip straight to the model. EMBED never shows it: an embedded
  // viewer (the WDL editor's preview, the home-architect skill) is a pure
  // renderer driven by its host — the picker would fight the pushed config.
  const q = new URLSearchParams(location.search);
  const embedded = q.get("panels") === "off" || q.get("embed") === "1";
  // Fresh start (no model from a file/link/param) → open the gallery so a visitor
  // can pick a sample home or open one of their own. Not in embed mode (an agent
  // pushes the model there).
  if (!embedded && !loadedFromOpenFile && !loadedFromHash && !loadedFromLoadParam) {
    void openNewHouseModal();
  }
}

// Load a .wadi/.json file the desktop app was asked to open (cold start
// or warm via the wadi://open-file event). Passing the path to loadConfig
// makes the live watcher track the opened file.
async function openWadiPath(path: string): Promise<void> {
  // Warm opens (app already running) may replace unsaved work — offer to
  // save first. On cold start nothing is loaded yet, so the guard is a
  // no-op (dirty is false / no config).
  if (!(await guardUnsaved("opening another model"))) return;
  try {
    const res = await loadConfigFromPath(path);
    useConfigStore.getState().loadConfig(res.config, res.filename, res.filePath, res.wdl);
  } catch (e) {
    console.error("viewer: failed to open file", path, e);
    alert(
      `Couldn't open ${path}:\n${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

// ------------------------------------------------------------------
// Unsaved-changes guard (New / Open / Close)
// ------------------------------------------------------------------

type UnsavedChoice = "save" | "discard" | "cancel";

// Small 3-button dialog asking whether to save unsaved changes before a
// destructive action. A plain confirm() only offers two buttons, so we
// build our own; works identically in the browser and the Tauri webview.
function confirmUnsaved(actionLabel: string): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999;";
    const box = document.createElement("div");
    box.style.cssText =
      "background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:10px;padding:20px 22px;max-width:400px;box-shadow:0 12px 48px rgba(0,0,0,.5);font-family:system-ui,-apple-system,sans-serif;";
    const btn = (choice: UnsavedChoice, text: string, bg: string, fg: string) =>
      `<button data-choice="${choice}" style="cursor:pointer;border:1px solid #334155;border-radius:6px;padding:7px 14px;font-size:13px;font-weight:600;color:${fg};background:${bg};">${text}</button>`;
    box.innerHTML =
      `<div style="font-size:15px;font-weight:700;margin-bottom:8px;">Unsaved changes</div>` +
      `<div style="font-size:13px;color:#94a3b8;line-height:1.5;margin-bottom:18px;">You have unsaved changes. Save them before ${actionLabel}?</div>` +
      `<div style="display:flex;gap:8px;justify-content:flex-end;">` +
      btn("cancel", "Cancel", "#334155", "#e2e8f0") +
      btn("discard", "Don't Save", "#7f1d1d", "#fecaca") +
      btn("save", "Save", "#059669", "#ffffff") +
      `</div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const done = (choice: UnsavedChoice) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      resolve(choice);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done("cancel"); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); done("save"); }
    };
    document.addEventListener("keydown", onKey, true);
    box.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () =>
        done((b as HTMLElement).dataset.choice as UnsavedChoice),
      ),
    );
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) done("cancel");
    });
    (box.querySelector('[data-choice="save"]') as HTMLElement | null)?.focus();
  });
}

// Guard a destructive action. Returns true if the caller may proceed,
// false to abort. On "Save" we save first (adopting the chosen path); a
// cancelled save dialog or write error aborts the action too.
async function guardUnsaved(actionLabel: string): Promise<boolean> {
  const st = useConfigStore.getState();
  if (!st.dirty || !st.config) return true;
  const choice = await confirmUnsaved(actionLabel);
  if (choice === "cancel") return false;
  if (choice === "discard") return true;
  try {
    const saved = await saveConfig(st.config, st.filePath, st.filename ?? undefined, st.wdl);
    if (saved) st.setFilePath(saved);
    st.markSaved();
    return true;
  } catch {
    return false;
  }
}

// Intercept app/tab close when there are unsaved changes. In Tauri we can
// show the full Save / Don't Save / Cancel dialog and only then destroy the
// window; a browser tab can only trigger its own native "Leave site?"
// prompt (it may not offer to save — a browser-security limitation).
function wireCloseGuard(): void {
  if (isTauri()) {
    const win = getCurrentWindow();
    void win.onCloseRequested(async (event) => {
      if (!useConfigStore.getState().dirty) return; // allow close
      event.preventDefault();
      if (await guardUnsaved("closing")) await win.destroy();
    });
  } else {
    window.addEventListener("beforeunload", (e) => {
      if (useConfigStore.getState().dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }
}

function rebuildSvgMap(): void {
  const cfg = useConfigStore.getState().config as HouseConfig | null;
  svgMap.clear();
  if (!cfg) return;

  // Apply the config's display units (feet & inches / metric) before
  // generating any dimensioned SVG — formatDimension reads these.
  setDimensionUnits((cfg as { units?: Parameters<typeof setDimensionUnits>[0] }).units);

  // Scale dimension/label fonts to the house's physical span so text stays
  // legible at fit-to-view regardless of how big or small the house is.
  setTextScale(computeTextScale(houseSpanUnits(cfg)));

  // Each generator wrapped independently so a bad opening (which
  // makes expandRoomWalls throw) doesn't take down every SVG. The
  // rest still update; the broken tab shows its stale content until
  // the user fixes the config.
  const safe = (label: string, fn: () => void) => {
    try { fn(); }
    catch (e) {
      console.warn(`[svg] ${label} skipped:`, e instanceof Error ? e.message : e);
    }
  };

  safe("floor plans", () => {
    for (const { filename, content } of generateAllFloorPlans(cfg)) {
      svgMap.set(`2d/floor_plans/${filename}`, content);
    }
  });
  safe("combined floor plans", () => {
    svgMap.set("2d/floor_plans/floor_plans_combined.svg", generateCombinedFloorPlans(cfg));
  });
  // Config-driven manifests: the 2D tabs build their cards from the ACTUAL
  // floors of this house (not a hardcoded list), so we never request a
  // non-existent view — which is what made the viewer inject the site's
  // homepage HTML into a card (patchFetch falls through to the server for
  // unknown keys, and the SPA returns index.html with 200).
  // The Layout tab renders its composite sheets on demand (filtered) via
  // window.wadiRenderLayout, so we no longer bake them into svgMap here —
  // that avoids re-rendering every floor's whole sheet on each config edit.
  // We still publish floorPlanManifest for the Floor Plans tab.
  const floorPlanManifest: { filename: string; displayName: string }[] = [];
  safe("floor-plan manifest", () => {
    const floors = (cfg.floors ?? []) as Array<{ floor_number?: number; name?: string }>;
    for (const f of floors) {
      const num = f.floor_number ?? 0;
      const name = f.name ?? `Floor ${num}`;
      const fpFile = `2d/floor_plans/floor_plan_${num}_${name.replace(/ /g, "_")}.svg`;
      if (svgMap.has(fpFile)) floorPlanManifest.push({ filename: fpFile, displayName: name });
    }
  });
  window.floorPlanManifest = floorPlanManifest;
  safe("elevations", () => {
    for (const { view, content } of generateAllElevations(cfg)) {
      svgMap.set(`2d/elevations/elevation_${view}.svg`, content);
    }
  });
  safe("combined elevations", () => {
    svgMap.set("2d/elevations/elevations_combined.svg", generateCombinedElevations(cfg));
  });
  // Roof pipeline (v2 unified roof only). Throws on incomplete roof
  // configs; swallow so a partial config still renders floor plans +
  // elevations — the roof tab shows its empty state until the required
  // fields are filled. Result is published to window.__roofBomDebug so
  // the on-screen debug badge (🐞) can surface a missing roof.
  let roof: ReturnType<typeof computeRoofSections> = null;
  try {
    roof = computeRoofSections(cfg, { eaveCrossSectionSvg: eaveSvg });
    (window as unknown as { __roofBomDebug?: unknown }).__roofBomDebug = {
      status: roof ? "ok" : "no-roof",
      panelCount: roof?.panels.length ?? 0,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[roof] compute failed, skipping roof panels:", msg, e);
    (window as unknown as { __roofBomDebug?: unknown }).__roofBomDebug = {
      status: "error",
      error: msg,
    };
    window.roofBomManifest = [];
  }
  // v2 roof pipeline output (SVG panels + master + manifest). May be
  // null when there's no roof object or the config is incomplete.
  if (roof) {
    svgMap.set(`2d/roof/${roof.master.filename}`, roof.master.content);
    for (const p of roof.panels) {
      svgMap.set(`2d/roof/${p.filename}`, p.content);
    }
    svgMap.set("2d/roof/roof_panels.json", roof.manifest.content);
  } else {
    svgMap.set("2d/roof/roof_panels.json", JSON.stringify([], null, 2));
  }

  // HTML BOM cards — aggregates across every v2 roof (type: "roof").
  // The BOM renderers take a RoofComputed[] (empty now that legacy roofs
  // are gone) plus the v2 members converted to the legacy FrameMember
  // shape via collectV2AsLegacyFrameMembers.
  const v2Members = collectV2AsLegacyFrameMembers(cfg);
  const extraMembers = v2Members;
  // v2 tile contribution — slope area + ridge run for type:"roof" objects.
  const v2Spec = computeMergedV2Spec(cfg, { filter: "v2Only" });
  const extraArea = slopeAreaSft(v2Spec);
  const extraRidgeRun = ridgeRunFt(v2Spec);
  const hasAnyRoof = extraMembers.length > 0;
  if (hasAnyRoof) {
    const densities = readTileDensities(cfg);
    const stock = readMetalStock(cfg);
    svgMap.set("2d/roof/frame_bom.html", frameBomHtml([], extraMembers));
    svgMap.set("2d/roof/metal_bom.html", metalBomHtml([], stock, extraMembers));
    svgMap.set(
      "2d/roof/roof_material_bom.html",
      roofMaterialBomHtml([], densities, extraArea, extraRidgeRun),
    );
    window.roofBomManifest = [
      { filename: "2d/roof/frame_bom.html", displayName: "Frame BOM" },
      { filename: "2d/roof/metal_bom.html", displayName: "Metal BOM by spec" },
      { filename: "2d/roof/roof_material_bom.html", displayName: "Roof material BOM" },
    ];
  } else {
    window.roofBomManifest = [];
  }
  // Pillar elevations + cross-sections. Wrapped because
  // generatePillarElevationView throws "No ground-floor pillars to
  // draw" for houses without pillars (e.g. courtyard_home) — that
  // shouldn't take out the whole template load.
  const pillarManifest: { filename: string; displayName: string }[] = [];
  safe("pillar svgs", () => {
    const pillars = generateAllPillarSvgs(cfg);
    for (const p of pillars) {
      const url = `2d/pillars/${p.filename}`;
      svgMap.set(url, p.content);
      pillarManifest.push({ filename: url, displayName: p.label });
    }
  });
  window.pillarSvgManifest = pillarManifest;

  // Quantities: external + internal wall areas (net of openings) + gable ends.
  // Wrapped so a compute/geometry error can't take out the whole template load.
  safe("wall area", () => {
    const report = computeWallAreas(cfg);
    svgMap.set("2d/quantities/wall_area.html", wallAreaHtml(report));
    window.quantitiesManifest = [
      { filename: "2d/quantities/wall_area.html", displayName: "Wall areas" },
    ];
  });
}

function patchFetch(): void {
  const original = window.fetch.bind(window);
  window.fetch = ((input, init) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.toString()
            : String(input);
    const clean = rawUrl.split("?")[0];
    const key = clean.startsWith("./") ? clean.slice(2) : clean;
    const hit = svgMap.get(key);
    if (hit !== undefined) {
      const contentType = key.endsWith(".html")
        ? "text/html"
        : key.endsWith(".json")
          ? "application/json"
          : "image/svg+xml";
      return Promise.resolve(
        new Response(hit, {
          headers: { "Content-Type": contentType },
        }),
      );
    }
    return original(input, init);
  }) as typeof window.fetch;
}

function mountEditPanels(): void {
  // Form-studio editing is retired (WDL is the only edit surface): the Sidebar
  // object tree and the PropertyPanel forms are gone. Only the read-only Graph
  // view remains — a persistent React root over the config store, shown when the
  // Graph tab is active (view-container toggled by switchView).
  const graph = document.getElementById("view-graph");
  if (graph) createRoot(graph).render(createElement(GraphView));
}

// Called on every config mutation. Rebuilds the SVG map and asks the
// vanilla-JS viewer to re-render the tab it's currently showing.
// Editor Sidebar/PropertyPanel don't need any extra work — they read
// via useConfigStore directly.
function subscribeConfig(): void {
  let last = useConfigStore.getState().config;
  let lastSelection = useConfigStore.getState().selection;
  applySelectionAttr(lastSelection);
  useConfigStore.subscribe((state) => {
    if (state.selection !== lastSelection) {
      lastSelection = state.selection;
      applySelectionAttr(lastSelection);
    }
    if (state.config === last) return;
    last = state.config;
    // Guard: an edit that transiently produces invalid geometry must not
    // throw out of the subscriber (that would wedge reactivity and leave
    // the app looking frozen). The 3D scene subscribes separately and
    // degrades gracefully on its own.
    try {
      rebuildSvgMap();
    } catch (e) {
      console.error("[viewer] rebuildSvgMap failed on config change:", e);
    }
    reloadActiveTab();
    updateHistoryButtons();
  });
  // Same watcher for undo/redo history so the ↶ ↷ buttons update.
  useConfigStore.temporal.subscribe(() => updateHistoryButtons());
}

// Mirror the store's selection state onto body[data-selection] so the
// mobile-only CSS in viewer.html can swap between the tree and the
// property panel (and reveal the floating back button).
function applySelectionAttr(sel: unknown): void {
  document.body.dataset.selection = sel ? "on" : "off";
}

// The vanilla viewer defines these on window (see viewer.html <script>).
// We call them to trigger a full re-render of a tab after config edits.
declare global {
  interface Window {
    // Loaders + flags come from the inline <script> block.
    floorPlansLoaded?: boolean;
    elevationsLoaded?: boolean;
    roofPanelsLoaded?: boolean;
    layoutLoaded?: boolean;
    quantitiesLoaded?: boolean;
    loadFloorPlans?: () => Promise<void>;
    loadElevations?: () => Promise<void>;
    loadRoofPanels?: () => Promise<void>;
    loadLayout?: () => Promise<void>;
    loadQuantities?: () => Promise<void>;
    // Published from rebuildSvgMap so the 2D tabs build cards from the
    // actual floors (config-driven, no hardcoded floor list).
    floorPlanManifest?: { filename: string; displayName: string }[];
    // Published from rebuildSvgMap so the elevations loader can iterate
    // pillar cards without hard-coding the row/col count.
    pillarSvgManifest?: { filename: string; displayName: string }[];
    // Published from rebuildSvgMap so the roof-panels loader can render
    // the two HTML BOM cards after the SVG panels.
    roofBomManifest?: { filename: string; displayName: string }[];
    // Published from rebuildSvgMap so the Quantities tab renders the
    // wall-area report card.
    quantitiesManifest?: { filename: string; displayName: string }[];
    // Exposed by wireExports below so the inline <script> in
    // index.html can trigger a save without needing to import
    // fileIO. Filename is a hint for the save dialog.
    exportCurrentSvg?: (defaultName: string) => Promise<void>;
    // Generic exporters used by the inline Layout viewer (it passes its own
    // <svg> element). PDF is vector via svg2pdf; both save via the native
    // dialog in the desktop app.
    exportSvgElement?: (svg: SVGSVGElement, defaultName: string) => Promise<void>;
    exportSvgElementAsPdf?: (svg: SVGSVGElement, defaultName: string) => Promise<void>;
    // Multi-page PDF of EVERY card on a drawing tab (plans / elevations / roof),
    // one drawing per page with a title header + page footer — a print-ready
    // sheet set to hand to a contractor. Vector via svg2pdf.
    exportTabAsPdf?: (view: string) => Promise<void>;
    // HTML → PDF (BOM / quantities cards) — raster via html2canvas since the
    // content is HTML tables, not SVG. Same native-save path as the SVG export.
    exportHtmlElementAsPdf?: (
      el: HTMLElement,
      defaultName: string,
      opts?: { orientation?: "portrait" | "landscape" },
    ) => Promise<void>;
    // On-demand Layout composite render, driven by the filter panel.
    // Returns the composite SVG string for `floorNum` with `filter`
    // applied (object/type/layer selection + dimension toggles).
    wadiRenderLayout?: (floorNum: number, filter?: DrawFilter | null) => string;
    // Panel metadata: the floors, object types, layers, and per-object
    // list the filter panel builds its checkbox groups from.
    wadiLayoutMeta?: () => LayoutMeta | null;
    // Rasterize the SVG in the currently active 2D tab (Layout / Floor Plans /
    // Elevations / Roof) to a JPEG data URL — architect "take a shot".
    wadiCaptureActiveSvg?: () => Promise<string | null>;
    // Rasterize the ground-floor plan SVG to a JPEG data URL — used by
    // auto-capture so every template carries a legible plan.
    wadiCaptureFloorPlan?: () => Promise<string | null>;
    // Layout-tab capture button handler (inline onclick).
    captureLayoutShot?: (btn?: HTMLElement) => Promise<void>;
    // Rasterize one 2D view's SVG element and add it to the previews. Returns
    // true on success. Used by the per-card 📸 buttons on the 2D grids.
    wadiAddSvgShot?: (svg: SVGSVGElement) => Promise<boolean>;
    // Global from the inline <script> — switches the top tab / content view
    // ("3d" | "plans" | "elevations" | "roof" | "layout" | "quantities").
    switchView?: (view: string) => void;
    // Programmatic control API. Drives the SAME store the owner sliders /
    // gallery / tabs drive, so an automation client (e.g. the home-architect
    // skill) — OR the user and Claude together — can operate the app WITHOUT
    // touching the UI, panels visible or hidden. See wireWadiApi().
    wadi?: WadiApi;
    // WebMCP tool descriptors — also registered via document.modelContext when
    // the browser supports WebMCP. Exposed for inspection/testing/demo.
    wadiMcpTools?: WebMcpTool[];
  }
}

// Public shape of window.wadi — the automation control surface.
export interface WadiApi {
  /** Stock templates from the catalog (id/title/description/meta) for matching. */
  listTemplates: () => Promise<
    Array<{ id: string; title: string; description: string; meta?: unknown }>
  >;
  /** Load a stock template by id — same path as clicking a gallery card. */
  chooseTemplate: (id: string) => Promise<{ ok: true; id: string }>;
  /** Load a whole HouseConfig (object or JSON string). Validates first. */
  load: (config: unknown) => { ok: true };
  /** The current in-store config (for reading / round-tripping / saving). */
  getConfig: () => unknown;
  /** Set one configurator knob — "House.W"/"House.L" hit points, bare names
   *  hit variables — exactly like moving that slider. Values are raw units
   *  (plot: 10 units = 1 ft; roof_style 0=Flat,1=Shed,2=Gable,3=Hip). */
  setKnob: (target: string, value: number) => { ok: true; target: string; value: number };
  /** Set several knobs at once (one re-render). */
  setKnobs: (record: Record<string, number>) => { ok: true; applied: Record<string, number> };
  /** Switch the visible view/tab (3d | plans | elevations | roof | layout | quantities).
   *  NOTE for the home-architect skill: the TAB is the homeowner's to change —
   *  the skill should not call this. Kept for general automation. */
  showView: (view: string) => { ok: true; view: string };
  // --- 3D visual controls (technical; the skill drives these FOR the homeowner) ---
  /** 3D layers for this house: id, label, group, current visibility. */
  listLayers: () => Array<{ id: string; label: string; group?: string; visible: boolean }>;
  /** Show/hide 3D layers by id, e.g. { f2_structure: false }. */
  setLayers: (record: Record<string, boolean>) => { ok: true };
  /** Isolate: show ONLY these layer ids, hide all others. */
  showOnlyLayers: (ids: string[]) => { ok: true };
  /** Reveal every layer again. */
  showAllLayers: () => { ok: true };
  /** Rooms the camera can walk into (key + "Floor: Room" label). */
  listRooms: () => Array<{ key: string; label: string }>;
  /** Drop the 3D camera inside a room (first-person walk-through). */
  enterRoom: (key: string) => { ok: true; key: string };
  /** Return the 3D camera to the outside orbit view. */
  exitRoom: () => { ok: true };

  // --- Co-design mutations (WebMCP): the agent authors the SAME live model the
  // person edits. Every one funnels through the store's own actions, so agent
  // and human edits share undo, validation, and live re-render. Sizes in FEET. ---
  /** The whole house as structured data (floors, rooms + sizes/positions in
   *  feet, connections with a per-connection `passable` flag, roof, plot,
   *  variables, and an `issues` structural summary). Read this first. */
  describeHouse: () => unknown;
  /** Run the structural linter (C1-C11) over the LIVE house — the same checks
   *  the WDL/MCP path runs — and return errors + warnings. Answers "are there
   *  any layout problems?" truthfully (e.g. a connection whose rooms drifted). */
  check: () => CheckSummary;
  /** Add a room to a floor. x/y = top-left corner in feet (x east, y south);
   *  width east-west, length north-south. Abutting rooms share a wall. */
  addRoom: (input: Record<string, unknown>) => { ok: true; name: string; floor?: string };
  /** Rename / move / resize a room by name (any of new_name/x_ft/y_ft/width_ft/length_ft). */
  editRoom: (input: Record<string, unknown>) => { ok: true; name: string };
  /** Declare that two same-floor rooms open into each other; returns whether
   *  it's physically passable yet (C11) and how to fix it if not. */
  connectRooms: (input: Record<string, unknown>) => {
    ok: true; connected: string[]; passable: boolean; note: string;
  };
  /** Put a door in the wall two rooms share (centred on the overlap) and ensure
   *  they're connected. Completes a connection so it becomes passable. */
  addDoor: (input: Record<string, unknown>) => {
    ok: true; door: string; on: string; between: string[]; passable: boolean;
  };
  /** Build a WHOLE house from a room graph: {rooms:[{name,width_ft,length_ft}],
   *  connections:[[a,b],…]}. Lays connected rooms adjacent, adds a door on each,
   *  and loads it. Replaces the current model. */
  buildHouse: (input: Record<string, unknown>) => {
    ok: true; rooms: number; doors: number; plot_ft: number[]; notes: string[];
  };
  /** Undo / redo the last change (one shared history with the human). */
  undo: () => { ok: true };
  redo: () => { ok: true };
  /** Render the current 3D model to a data URL so an agent can see the result. */
  captureView: (size?: number) => string | null;
  /** Compile .wdl source through the real pipeline and load it into the live
   *  model. Returns compile/schema errors (model unchanged on error), else the
   *  C1-C12 structural check. The full DSL — every object type, variables,
   *  formulas, components — is the agent's authoring surface. */
  setWdl: (wdl: string) => Promise<unknown>;
  /** The current live model decompiled to editable .wdl text. */
  getWdl: () => Promise<string>;
  /** Compile-check .wdl WITHOUT loading it (dry run) — returns errors or ok. */
  checkWdl: (wdl: string) => Promise<unknown>;
}

// WebMCP tool descriptor — document.modelContext.registerTool (W3C WebMCP,
// Chrome 149 origin trial). The SAME wadi controls, exposed as agent-callable
// tools so any WebMCP browser agent (Gemini in Chrome, Claude, …) can drive the
// model — no UI clicks, and no problem with the 3D canvas being invisible to
// accessibility-tree agents.
export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}
interface ModelContextLike {
  registerTool: (tool: WebMcpTool, opts?: { signal?: AbortSignal }) => Promise<void>;
}

// Rasterize an SVG string to a JPEG data URL on a white ground. Ensures the
// root <svg> carries width/height (some browsers won't rasterize a viewBox-only
// SVG) and preserves aspect from the viewBox.
async function rasterizeSvgString(svg: string, maxW = 900): Promise<string | null> {
  const vb = /viewBox\s*=\s*["']([\d.\-eE\s]+)["']/.exec(svg);
  let w = 900;
  let h = 700;
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p[2] > 0 && p[3] > 0) {
      w = p[2];
      h = p[3];
    }
  }
  // Inject width/height on the first <svg …> tag if absent.
  let sized = svg;
  if (!/<svg[^>]*\bwidth\s*=/.test(svg)) {
    sized = svg.replace(/<svg\b/, `<svg width="${w}" height="${h}"`);
  }
  const blob = new Blob([sized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg image load failed"));
      img.src = url;
    });
    const tw = Math.round(Math.min(maxW, w));
    const th = Math.round((tw * h) / w);
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(img, 0, 0, tw, th);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Register the 2D capture bridges (used by the slim toolbar + auto-capture).
function wireCaptureBridges(): void {
  window.wadiCaptureActiveSvg = async () => {
    const svg = document.querySelector<SVGSVGElement>(
      "#viewer-views .view-container.active svg",
    );
    if (!svg) return null;
    return rasterizeSvgString(new XMLSerializer().serializeToString(svg));
  };

  window.wadiCaptureFloorPlan = async () => {
    const manifest = window.floorPlanManifest ?? [];
    if (manifest.length === 0) return null;
    // Prefer the "Ground" floor; else the first plan that isn't a plinth.
    const pick =
      manifest.find((m) => /ground/i.test(m.displayName)) ??
      manifest.find((m) => !/plinth/i.test(m.displayName)) ??
      manifest[0];
    const svg = svgMap.get(pick.filename);
    if (!svg) return null;
    return rasterizeSvgString(svg);
  };

  // Layout tab "📸" — rasterize the current composite sheet and append it to
  // this template's previews. Flashes ✓ on the button.
  window.captureLayoutShot = async (btn?: HTMLElement) => {
    const url = await window.wadiCaptureActiveSvg?.();
    if (!url) {
      alert("Couldn't capture the sheet — make sure a Layout sheet is visible.");
      return;
    }
    useConfigStore.getState().addThumbnail(url);
    if (btn) flashSaved(btn, "✓");
  };

  // Per-card "📸" on the 2D grids (Floor Plans / Elevations / Roof Details) —
  // rasterize THAT individual view's SVG and add it to the template previews.
  window.wadiAddSvgShot = async (svg: SVGSVGElement): Promise<boolean> => {
    try {
      const url = await rasterizeSvgString(new XMLSerializer().serializeToString(svg));
      if (!url) return false;
      useConfigStore.getState().addThumbnail(url);
      return true;
    } catch {
      return false;
    }
  };
}

interface LayoutMeta {
  floors: { num: number; name: string }[];
  types: { id: string; label: string }[];
  layers: { id: string; label: string }[];
  objects: {
    key: string;
    floor: number;
    index: number;
    type: string;
    name: string;
    layer: string;
  }[];
}

// Human-facing labels for the object types that appear on a 2D sheet.
// "openings" is a pseudo-type gating doors + windows (they draw with
// their host wall, so they aren't independent rows in the object list).
const TYPE_LABELS: Record<string, string> = {
  floor_slab: "Floor slabs",
  beam: "Beams",
  room: "Rooms",
  wall: "Walls",
  pillar: "Pillars",
  staircase: "Staircases",
  kitchen: "Kitchens",
  roof: "Roofs",
  openings: "Doors & windows",
};

function wireLayoutApi(): void {
  window.wadiRenderLayout = (floorNum: number, filter?: DrawFilter | null): string => {
    const cfg = useConfigStore.getState().config as HouseConfig | null;
    if (!cfg) return "";
    // Apply this house's display units + text scale before rendering, so the
    // composite is correct on its own (not reliant on a prior rebuildSvgMap
    // having set the module-level "active" values).
    setDimensionUnits((cfg as { units?: Parameters<typeof setDimensionUnits>[0] }).units);
    // Auto legibility scale × the panel's manual multiplier (default 1). The
    // manual lever lets the user tame oversized text on large houses, where
    // the span-based auto factor can reach its cap.
    const manual = filter?.textScale;
    const factor = typeof manual === "number" && manual > 0 ? manual : 1;
    setTextScale(computeTextScale(houseSpanUnits(cfg)) * factor);
    return generateCompositeSheet(cfg as never, floorNum, { filter });
  };

  window.wadiLayoutMeta = (): LayoutMeta | null => {
    const cfg = useConfigStore.getState().config as
      | (HouseConfig & { floors?: Array<Record<string, unknown>> })
      | null;
    if (!cfg) return null;

    const floors: LayoutMeta["floors"] = [];
    const typeIds = new Set<string>();
    const objects: LayoutMeta["objects"] = [];
    let hasOpening = false;

    (cfg.floors ?? []).forEach((f, fi) => {
      const num = (f.floor_number as number | undefined) ?? fi;
      const fname = (f.name as string | undefined) ?? `Floor ${num}`;
      floors.push({ num, name: fname });
      ((f.objects as Array<Record<string, unknown>>) ?? []).forEach((o, oi) => {
        const t = o.type as string;
        if (t === "door" || t === "window") {
          hasOpening = true;
          return; // openings draw with their wall — not standalone rows
        }
        typeIds.add(t);
        const layer =
          typeof o.layer === "string" && o.layer ? o.layer : heuristicLayerId(t, num);
        objects.push({
          key: objectKey(num, oi),
          floor: num,
          index: oi,
          type: t,
          name: (o.name as string | undefined) ?? `${t} ${oi}`,
          layer,
        });
      });
    });
    if (hasOpening) typeIds.add("openings");

    // Preserve a sensible type order; unknown types go last alphabetically.
    const typeOrder = [
      "floor_slab", "beam", "room", "wall", "staircase", "kitchen",
      "pillar", "roof", "openings",
    ];
    const types = [...typeIds]
      .sort((a, b) => {
        const ia = typeOrder.indexOf(a), ib = typeOrder.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
      })
      .map((id) => ({ id, label: TYPE_LABELS[id] ?? id }));

    const layers = effectiveLayers(cfg).map((l) => ({ id: l.id, label: l.label }));

    return { floors, types, layers, objects };
  };
}

// Full-screen "Preparing PDF…" overlay shown while an export runs — jsPDF +
// html2canvas can take a few seconds with no other feedback. Created lazily;
// show/hide are idempotent.
let pdfBusyEl: HTMLDivElement | null = null;
function showPdfBusy(text = "Preparing PDF…"): void {
  if (!pdfBusyEl) {
    const style = document.createElement("style");
    style.textContent =
      "#pdf-busy{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35)}" +
      "#pdf-busy .c{display:flex;align-items:center;gap:.75rem;background:#fff;color:#1e293b;padding:.9rem 1.4rem;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:600 .95rem system-ui,sans-serif}" +
      "#pdf-busy .s{width:18px;height:18px;border:3px solid #cbd5e1;border-top-color:#B85028;border-radius:50%;animation:pdfspin .7s linear infinite}" +
      "@keyframes pdfspin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
    pdfBusyEl = document.createElement("div");
    pdfBusyEl.id = "pdf-busy";
    pdfBusyEl.innerHTML = '<div class="c"><span class="s" aria-hidden="true"></span><span class="t"></span></div>';
    document.body.appendChild(pdfBusyEl);
  }
  (pdfBusyEl.querySelector(".t") as HTMLElement).textContent = text;
  pdfBusyEl.style.display = "flex";
}
function hidePdfBusy(): void {
  if (pdfBusyEl) pdfBusyEl.style.display = "none";
}
// Yield one frame so the overlay actually paints before a heavy sync task
// (html2canvas / svg2pdf) blocks the main thread.
const nextPaint = (): Promise<void> =>
  // Two rAFs let the "Preparing PDF…" overlay actually paint before the heavy
  // work. A setTimeout backstop keeps it from HANGING where rAF is paused/
  // throttled (a background tab, an unfocused webview) — otherwise the whole
  // PDF export could stall at the first await and never resolve.
  new Promise((r) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      r();
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 120);
  });

// Grab the currently-open lightbox SVG (as source text) and save
// via the native dialog / browser download.
function wireExports(): void {
  window.exportCurrentSvg = async (defaultName: string) => {
    const svg = document.querySelector<SVGSVGElement>("#svg-container svg");
    if (!svg) {
      alert("No SVG open to export.");
      return;
    }
    await exportSvgElementAsSvg(svg, defaultName);
  };

  // Generic SVG export (used by the inline Layout viewer, which passes its
  // own <svg> element rather than the lightbox's).
  window.exportSvgElement = async (svg: SVGSVGElement, defaultName: string) => {
    await exportSvgElementAsSvg(svg, defaultName);
  };

  // Vector PDF export. window.print() is a no-op in the desktop WKWebview,
  // so we render the SVG straight into a jsPDF page with svg2pdf (true
  // vectors — crisp lines, selectable text) and save via the native dialog.
  // Both libs are dynamic-imported so they stay out of the initial bundle.
  window.exportSvgElementAsPdf = async (svg: SVGSVGElement, defaultName: string) => {
    showPdfBusy();
    await nextPaint();
    try {
      const { width, height } = svgIntrinsicSize(svg);
      const [{ jsPDF }, { svg2pdf }] = await Promise.all([
        import("jspdf"),
        import("svg2pdf.js"),
      ]);
      // Fit the sheet onto a standard printable page rather than a page the
      // literal size of the drawing (which, in project units, would be metres
      // wide — and jsPDF hard-caps pages at 14400pt, clipping big sheets).
      // A3 oriented to the drawing gives a crisp, printable vector sheet.
      const pdf = new jsPDF({
        orientation: width >= height ? "landscape" : "portrait",
        unit: "pt",
        format: "a3",
        compress: true,
      });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const scale = Math.min((pw - margin * 2) / width, (ph - margin * 2) / height);
      const dw = width * scale;
      const dh = height * scale;
      // svg2pdf reads the live element's computed styles, so pass the on-DOM
      // node (a detached clone would lose CSS). Centre it on the page.
      await svg2pdf(svg, pdf, {
        x: (pw - dw) / 2,
        y: (ph - dh) / 2,
        width: dw,
        height: dh,
      });
      const bytes = pdf.output("arraybuffer");
      hidePdfBusy(); // bytes ready — drop the overlay before the save dialog
      await saveBinary(
        new Uint8Array(bytes),
        defaultName,
        "PDF document",
        ["pdf"],
        "application/pdf",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`PDF export failed: ${msg}`);
    } finally {
      hidePdfBusy();
    }
  };

  // Multi-page PDF of every card on a drawing tab — one drawing per page, each
  // fit to a titled A3 sheet with a page footer, for offline printing / handing
  // to a contractor. Reuses the same vector svg2pdf path as the single-card
  // export. Triggered from the tab's "⤓ PDF" button, so the tab is active and
  // its cards are in the DOM with resolved computed styles.
  window.exportTabAsPdf = async (view: string) => {
    const tabs: Record<string, { grid: string; label: string }> = {
      plans: { grid: "floor-plans-grid", label: "Floor Plans" },
      elevations: { grid: "elevations-grid", label: "Elevations" },
      roof: { grid: "roof-panels-grid", label: "Roof Details" },
    };
    const info = tabs[view];
    if (!info) return;
    const grid = document.getElementById(info.grid);
    const cards = grid
      ? Array.from(grid.querySelectorAll<HTMLElement>(".svg-item"))
          .map((it) => ({
            svg: it.querySelector<SVGSVGElement>("svg"),
            title: (it.querySelector("h3")?.textContent ?? "").trim(),
          }))
          .filter((c): c is { svg: SVGSVGElement; title: string } => c.svg != null)
      : [];
    if (!cards.length) {
      alert("No drawings on this tab yet. Open the tab so the drawings load, then try again.");
      return;
    }
    showPdfBusy(`Preparing ${info.label} PDF…`);
    await nextPaint();
    try {
      const [{ jsPDF }, { svg2pdf }] = await Promise.all([
        import("jspdf"),
        import("svg2pdf.js"),
      ]);
      let pdf: InstanceType<typeof jsPDF> | null = null;
      const margin = 28, headerH = 24, footerH = 18;
      const dateStr = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < cards.length; i++) {
        const { svg, title } = cards[i];
        const { width, height } = svgIntrinsicSize(svg);
        const orientation = width >= height ? "landscape" : "portrait";
        if (!pdf) {
          pdf = new jsPDF({ orientation, unit: "pt", format: "a3", compress: true });
        } else {
          pdf.addPage("a3", orientation);
        }
        const doc = pdf;
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        // Title header.
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text(title || info.label, margin, margin + 6, { baseline: "middle" });
        // Drawing, centred in the area between header and footer.
        const top = margin + headerH;
        const availW = pw - margin * 2;
        const availH = ph - margin - footerH - top;
        const scale = Math.min(availW / width, availH / height);
        const dw = width * scale, dh = height * scale;
        await svg2pdf(svg, doc, {
          x: (pw - dw) / 2,
          y: top + (availH - dh) / 2,
          width: dw,
          height: dh,
        });
        // Footer: source + date on the left, page count on the right.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Wadi · ${info.label} · ${dateStr}`, margin, ph - margin + 4, { baseline: "bottom" });
        doc.text(`Page ${i + 1} / ${cards.length}`, pw - margin, ph - margin + 4, {
          baseline: "bottom",
          align: "right",
        });
      }
      if (!pdf) return;
      const bytes = pdf.output("arraybuffer");
      hidePdfBusy();
      const slug = info.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await saveBinary(
        new Uint8Array(bytes),
        `${slug}.pdf`,
        "PDF document",
        ["pdf"],
        "application/pdf",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`PDF export failed: ${msg}`);
    } finally {
      hidePdfBusy();
    }
  };

  // HTML → PDF for the BOM / quantities cards. window.print() is a no-op in
  // the desktop WKWebview, so rasterise the card with html2canvas and place it
  // on A4 pages (paginating when the table is taller than one page), then save
  // via the native dialog — same path as the SVG export above.
  window.exportHtmlElementAsPdf = async (
    el: HTMLElement,
    defaultName: string,
    opts?: { orientation?: "portrait" | "landscape" },
  ) => {
    showPdfBusy();
    await nextPaint();
    try {
      const { jsPDF } = await import("jspdf");
      const orientation = opts?.orientation === "landscape" ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const tables = Array.from(el.querySelectorAll("table"));

      if (tables.length > 0) {
        // VECTOR table export — read the table DOM and draw it directly. The
        // roof BOM + Quantities cards are HTML tables; rasterising them with
        // html2canvas HANGS in the desktop WKWebview (it can't parse the app's
        // Tailwind v4 oklch() colours). Drawing the table ourselves needs no
        // rasteriser, works in every webview, and yields crisp selectable text.
        const cellText = (c: Element) => (c.textContent ?? "").replace(/\s+/g, " ").trim();
        let y = margin;
        const newPage = (extra: number) => {
          if (y + extra > pageH - margin) { pdf.addPage(); y = margin; }
        };
        for (const table of tables) {
          // Section title = nearest preceding heading in the card.
          let title = "";
          for (let p = table.previousElementSibling; p; p = p.previousElementSibling) {
            if (/^H[1-6]$/.test(p.tagName)) { title = cellText(p); break; }
          }
          const head = Array.from(table.querySelectorAll("thead tr")).map((tr) =>
            Array.from(tr.children).map(cellText),
          );
          const body = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
            Array.from(tr.children).map(cellText),
          );
          const cols = Math.max(head[0]?.length ?? 0, ...body.map((r) => r.length), 1);
          const usableW = pageW - margin * 2;
          const FS = 9, lineH = 11, padX = 6, rowPad = 6;

          // Column widths PROPORTIONAL to each column's natural content width
          // (header + body), so wide text columns get room and numeric columns
          // stay tight — equal widths were forcing the text columns to wrap and
          // collide. Cap any one column at 46% so a long column can't crowd out
          // the rest, then scale to fill the page exactly.
          const natW = new Array<number>(cols).fill(0);
          const measure = (rows: string[][], bold: boolean) => {
            pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(FS);
            for (const r of rows) for (let c = 0; c < cols; c++) {
              const w = pdf.getTextWidth(r[c] ?? "");
              if (w > natW[c]) natW[c] = w;
            }
          };
          measure(head, true); measure(body, false);
          for (let c = 0; c < cols; c++) natW[c] = Math.min(natW[c] + padX * 2, usableW * 0.46);
          const totalNat = natW.reduce((a, b) => a + b, 0) || 1;
          const colW = natW.map((w) => (w / totalNat) * usableW);
          const colX: number[] = [];
          for (let c = 0, x = margin; c < cols; c++) { colX.push(x); x += colW[c]; }

          // Right-align genuinely numeric columns — a value that is a number
          // (with optional "up to" prefix and a short unit), NOT merely a string
          // that contains a digit (e.g. a "1×1 in × 3 mm MS" spec stays left).
          const numericCell = (s: string) => {
            const t = s.replace(/^(up to|about|approx\.?|~|≈)\s+/i, "").trim();
            return /^[\d.,]+(\s*(ft|in|mm|cm|m|sft|sq\.?\s?ft|°|%|pcs|nos|kg))?$/i.test(t);
          };
          const numericCol = new Array<boolean>(cols).fill(false);
          for (let c = 0; c < cols; c++) {
            const cells = body.map((r) => (r[c] ?? "").trim()).filter(Boolean);
            if (!cells.length) continue;
            numericCol[c] = cells.filter(numericCell).length >= cells.length * 0.7;
          }

          if (title) {
            newPage(30);
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(30);
            pdf.text(title, margin, y + 10); y += 24;
          }

          const drawRow = (cells: string[], o: { bold: boolean; fill: boolean; zebra?: boolean }) => {
            pdf.setFont("helvetica", o.bold ? "bold" : "normal"); pdf.setFontSize(FS);
            // Wrap each cell and size the row to the TALLEST cell, so a wrapped
            // cell never spills into the row below (the old fixed 16pt bug).
            const cellLines: string[][] = [];
            let maxLines = 1;
            for (let c = 0; c < cols; c++) {
              const ls = pdf.splitTextToSize(cells[c] ?? "", colW[c] - padX * 2) as string[];
              const lines = ls.length ? ls : [""];
              cellLines.push(lines);
              if (lines.length > maxLines) maxLines = lines.length;
            }
            const rowH = maxLines * lineH + rowPad;
            // Page break — repeat the header on the fresh page.
            if (y + rowH > pageH - margin) { pdf.addPage(); y = margin; if (!o.fill) drawHeader(); }
            if (o.fill) {
              pdf.setFillColor(192, 90, 47); pdf.rect(margin, y, usableW, rowH, "F");
              pdf.setTextColor(255);
            } else {
              if (o.zebra) { pdf.setFillColor(246, 245, 242); pdf.rect(margin, y, usableW, rowH, "F"); }
              pdf.setTextColor(35);
            }
            const baseTop = y + 3 + 8; // 3 top pad + ~8 ascent
            for (let c = 0; c < cols; c++) {
              const right = numericCol[c];
              const tx = right ? colX[c] + colW[c] - padX : colX[c] + padX;
              const lines = cellLines[c];
              for (let li = 0; li < lines.length; li++) {
                pdf.text(lines[li], tx, baseTop + li * lineH, right ? { align: "right" } : undefined);
              }
            }
            pdf.setDrawColor(224); pdf.line(margin, y + rowH, margin + usableW, y + rowH);
            y += rowH;
          };
          const drawHeader = () => { for (const hr of head) drawRow(hr, { bold: true, fill: true }); };

          drawHeader();
          body.forEach((br, i) => drawRow(br, { bold: false, fill: false, zebra: i % 2 === 1 }));
          y += 22; // gap before the next table
        }
      } else {
        // Non-table HTML → rasterise in an ISOLATED iframe (keeps the app's
        // oklch() out of html2canvas), timeout-guarded so it can't hang forever.
        const frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.cssText =
          "position:fixed;left:-99999px;top:0;width:900px;height:10px;border:0;background:#fff;";
        document.body.appendChild(frame);
        try {
          const html2canvasMod = await import("html2canvas");
          const html2canvas = (html2canvasMod as { default: typeof import("html2canvas").default }).default;
          const idoc = frame.contentDocument!;
          idoc.open();
          idoc.write(
            '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:16px;' +
              "background:#fff;color:#111;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;}" +
              "</style></head><body>" + el.innerHTML + "</body></html>",
          );
          idoc.close();
          await nextPaint();
          const b = idoc.body;
          frame.style.height = Math.max(b.scrollHeight, 40) + "px";
          await nextPaint();
          const canvas = await Promise.race([
            html2canvas(b, {
              scale: 2, backgroundColor: "#ffffff", useCORS: true,
              windowWidth: b.scrollWidth, windowHeight: b.scrollHeight,
            }),
            new Promise<never>((_, rej) =>
              window.setTimeout(() => rej(new Error("rendering timed out")), 20000),
            ),
          ]);
          const imgW = pageW - margin * 2;
          const pxPerPt = canvas.width / imgW;
          const sliceHpx = (pageH - margin * 2) * pxPerPt;
          let yy = 0, page = 0;
          while (yy < canvas.height - 1) {
            const hpx = Math.min(sliceHpx, canvas.height - yy);
            const slice = document.createElement("canvas");
            slice.width = canvas.width; slice.height = hpx;
            slice.getContext("2d")!.drawImage(canvas, 0, yy, canvas.width, hpx, 0, 0, canvas.width, hpx);
            if (page > 0) pdf.addPage();
            pdf.addImage(slice, "PNG", margin, margin, imgW, hpx / pxPerPt);
            yy += hpx; page++;
          }
        } finally {
          frame.remove();
        }
      }

      const bytes = pdf.output("arraybuffer");
      hidePdfBusy(); // bytes ready — drop the overlay before the save dialog
      await saveBinary(
        new Uint8Array(bytes),
        defaultName,
        "PDF document",
        ["pdf"],
        "application/pdf",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`PDF export failed: ${msg}`);
    } finally {
      hidePdfBusy();
    }
  };
}

// Intrinsic drawing size of an <svg> in user units — prefers the viewBox
// (our generated sheets always set one), falls back to width/height attrs,
// then the rendered box. Used to size the PDF page 1:1 with the drawing.
function svgIntrinsicSize(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return { width: vb.width, height: vb.height };
  const w = svg.width?.baseVal?.value;
  const h = svg.height?.baseVal?.value;
  if (w && h) return { width: w, height: h };
  const r = svg.getBoundingClientRect();
  return { width: r.width || 800, height: r.height || 600 };
}

async function exportSvgElementAsSvg(
  svg: SVGSVGElement,
  defaultName: string,
): Promise<void> {
  // Prepend the XML declaration so downstream tools (Illustrator, Inkscape)
  // recognise the file as standalone SVG.
  const text = `<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`;
  try {
    await saveText(text, defaultName, "SVG image", ["svg"], "image/svg+xml");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== "Cancelled") alert(`Export failed: ${msg}`);
  }
}

function reloadActiveTab(): void {
  // Reset the "already loaded" flags so the loaders re-fetch (and thus
  // hit the fresh svgMap via our patched fetch). Then call whichever
  // matches the currently-active tab.
  window.floorPlansLoaded = false;
  window.elevationsLoaded = false;
  window.roofPanelsLoaded = false;
  window.layoutLoaded = false;
  window.quantitiesLoaded = false;
  const activeView = document.querySelector(".view-container.active");
  if (!activeView) return;
  const id = activeView.id;
  if (id === "view-plans") void window.loadFloorPlans?.();
  else if (id === "view-elevations") void window.loadElevations?.();
  else if (id === "view-roof") void window.loadRoofPanels?.();
  else if (id === "view-layout") void window.loadLayout?.();
  else if (id === "view-quantities") void window.loadQuantities?.();
  // 3D tab reacts automatically via React subscription — no manual call.
}

// -----------------------------------------------------------------
// Header actions
// -----------------------------------------------------------------

// Brief "✓ Saved" confirmation on a Save / Save As button. The save
// path writes silently on success, so this is the only signal the user
// gets. Captures the real label once (so rapid re-clicks don't freeze
// the checkmark in) and resets the revert timer on each click.
// A dismissible warning banner pinned top-centre. Used for problems the
// recipient must notice (e.g. a shared link that failed to load). Auto-hides
// after a while, or on the ✕.
// Robustly turn the text of an opened/shared file into a HouseConfig. Handles a
// leading BOM and stray whitespace (common when files round-trip through
// messengers / file managers), and a base64-wrapped payload as a fallback. On
// failure returns an error that INCLUDES the first characters of the content, so
// a recipient can tell us exactly what arrived instead of a generic "invalid".
function readWadiText(text: string): { data?: ValidatedHouseConfig; error?: string } {
  const s = text.replace(/^﻿/, "").trim();
  const tryParse = (str: string): unknown | undefined => {
    try { return JSON.parse(str); } catch { return undefined; }
  };
  let obj = tryParse(s);
  if (obj === undefined && s && !/^[[{]/.test(s)) {
    // Some transfer paths re-encode the file as base64 — try that too.
    try { obj = tryParse(atob(s.replace(/\s+/g, ""))); } catch { /* not base64 */ }
  }
  if (obj === undefined) {
    // Show the WHOLE content (capped so a pathological blob can't wedge the UI).
    // A valid design parses above, so anything landing here is small/garbage.
    const CAP = 2000;
    const shown = s.length <= CAP ? s : `${s.slice(0, CAP)} …(+${s.length - CAP} more chars)`;
    return { error: `Couldn't read the file as a Wadi design (not valid JSON). Length ${s.length}. Content: ${JSON.stringify(shown)}` };
  }
  const parsed = validate(obj, { tolerant: true });
  if (parsed.ok && parsed.data) return { data: parsed.data };
  return { error: "The file is JSON but not a valid Wadi design — it may be from a newer version of Wadi." };
}

function showBanner(message: string): void {
  const el = document.createElement("div");
  el.setAttribute("role", "alert");
  el.style.cssText = [
    "position:fixed", "top:12px", "left:50%", "transform:translateX(-50%)",
    "z-index:3000", "max-width:min(92vw,540px)", "display:flex", "gap:10px",
    "align-items:flex-start", "background:#7c2d12", "color:#fff",
    "font-size:13px", "line-height:1.4", "padding:10px 12px",
    "border-radius:10px", "box-shadow:0 6px 24px rgba(0,0,0,0.35)",
  ].join(";");
  const span = document.createElement("span");
  span.textContent = message;
  span.style.flex = "1";
  const close = document.createElement("button");
  close.textContent = "✕";
  close.setAttribute("aria-label", "Dismiss");
  close.style.cssText =
    "background:none;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;padding:0 2px;";
  const remove = () => el.remove();
  close.addEventListener("click", remove);
  el.append(span, close);
  document.body.appendChild(el);
  window.setTimeout(remove, 14000);
}

// Geometry warnings emitted by House3D's lenient expansion drive three surfaces:
//   1. a header status chip (#btn-issues) — always visible: green "✓ OK" when
//      clean, red "⚠ N" with the count when there are issues;
//   2. an on-demand panel (#issues-panel) — opened from the chip, lists every
//      current issue and re-renders live, so the user can confirm a fix landed;
//   3. the transient banner — a one-time nudge when a NEW issue set appears.
// The warning set is republished on every re-expand (each edit), so all three
// reflect the CURRENT model, and clear the moment the geometry becomes valid.
function wireGeometryWarnings(): void {
  const chip = document.getElementById("btn-issues");
  const panel = document.getElementById("issues-panel");
  const body = document.getElementById("issues-panel-body");
  const countEl = panel?.querySelector(".ip-count") as HTMLElement | null;
  let current: string[] = [];
  let lastBannerKey = "";

  const renderPanel = () => {
    if (!body) return;
    if (countEl) {
      countEl.textContent = current.length
        ? `${current.length} geometry issue${current.length > 1 ? "s" : ""}`
        : "Geometry issues";
    }
    body.replaceChildren();
    if (current.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ip-empty";
      empty.textContent = "✓ No geometry issues — every opening and wall is valid.";
      body.appendChild(empty);
      return;
    }
    for (const msg of current) {
      const row = document.createElement("div");
      row.className = "ip-item";
      const dot = document.createElement("span");
      dot.className = "ip-dot";
      dot.textContent = "⚠";
      const text = document.createElement("span");
      text.textContent = msg;
      row.append(dot, text);
      body.appendChild(row);
    }
  };

  const setWarnings = (warnings: string[]) => {
    current = warnings;
    if (chip) {
      chip.dataset.issues = warnings.length ? "on" : "off";
      chip.textContent = warnings.length ? `⚠ ${warnings.length}` : "✓ OK";
      chip.title = warnings.length
        ? `${warnings.length} geometry issue${warnings.length > 1 ? "s" : ""} — click to view`
        : "No geometry issues — click to review";
    }
    if (panel?.dataset.open === "on") renderPanel();
    // One-time banner when a NEW non-empty set appears (not on every re-render).
    const key = warnings.join("\n");
    if (warnings.length && key !== lastBannerKey) {
      const head =
        warnings.length === 1
          ? warnings[0]
          : `${warnings.length} geometry issues — ${warnings[0]}`;
      showBanner(
        `⚠ ${head} The affected wall is shown solid (openings skipped) until you fix it in the object editor. Click ⚠ in the header to review all issues.`,
      );
    }
    lastBannerKey = key;
  };

  chip?.addEventListener("click", () => {
    if (!panel) return;
    const isOpen = panel.dataset.open === "on";
    panel.dataset.open = isOpen ? "off" : "on";
    if (!isOpen) renderPanel();
  });
  document.getElementById("issues-panel-close")?.addEventListener("click", () => {
    if (panel) panel.dataset.open = "off";
  });

  window.addEventListener("wadi-geometry-warnings", (e) =>
    setWarnings((e as CustomEvent<string[]>).detail ?? []),
  );
  // Catch-up: House3D's first render dispatches its warning event during
  // mountViewer3D, before this listener attaches — seed from what it stored.
  const stored = (window as unknown as { __geometryWarnings?: string[] }).__geometryWarnings;
  setWarnings(stored ?? []);
}

function flashSaved(btn: HTMLElement | null, text = "✓ Saved"): void {
  if (!btn) return;
  if (!btn.dataset.label) btn.dataset.label = btn.textContent ?? "";
  btn.textContent = text;
  window.clearTimeout(Number(btn.dataset.flashTimer));
  const t = window.setTimeout(() => {
    btn.textContent = btn.dataset.label ?? "";
    delete btn.dataset.label;
    delete btn.dataset.flashTimer;
  }, 1400);
  btn.dataset.flashTimer = String(t);
}

// Open a companion app by name: its own window on desktop (Tauri show_tool),
// else a new browser tab (the studio stays open behind it).
function openApp(name: string, url: string): void {
  if (isTauri()) {
    void invoke("show_tool", { name }).catch((err) => {
      console.warn(`show_tool(${name}) failed, falling back to a tab:`, err);
      window.open(url, "_blank", "noopener");
    });
  } else {
    window.open(url, "_blank", "noopener");
  }
}

// The header Apps dropdown. It renders in the browser TOP LAYER via the Popover
// API so it paints above the WebGL 3D canvas (a composited canvas otherwise
// covers normal HTML regardless of z-index). Falls back to a plain absolute
// dropdown on engines without the Popover API.
function wireAppsMenu(): void {
  const menu = document.getElementById("apps-menu");
  const btn = document.getElementById("apps-btn");
  const dropdown = document.getElementById("apps-dropdown") as
    | (HTMLElement & { showPopover?: () => void; hidePopover?: () => void })
    | null;
  if (!menu || !btn || !dropdown) return;

  const usePopover = typeof dropdown.showPopover === "function";
  if (!usePopover) {
    menu.setAttribute("data-nopopover", "");
    dropdown.removeAttribute("popover"); // inert attr → make it a normal hidden div
    dropdown.hidden = true;
  }

  const isOpen = () =>
    usePopover ? dropdown.matches(":popover-open") : !dropdown.hidden;

  const setOpen = (open: boolean) => {
    if (usePopover) {
      if (open) {
        // Anchor the fixed popover under the button (top layer is viewport-fixed).
        const b = btn.getBoundingClientRect();
        dropdown.style.top = `${Math.round(b.bottom + 6)}px`;
        dropdown.style.left = `${Math.round(b.left)}px`;
        dropdown.showPopover?.();
      } else {
        dropdown.hidePopover?.();
      }
    } else {
      dropdown.hidden = !open;
    }
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    menu.toggleAttribute("data-open", open);
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!isOpen());
  });
  for (const item of Array.from(dropdown.querySelectorAll<HTMLElement>(".apps-item"))) {
    item.addEventListener("click", () => {
      const name = item.dataset.app ?? "";
      const url = item.dataset.url ?? "/";
      setOpen(false);
      if (name) openApp(name, url);
    });
  }

  if (usePopover) {
    // popover="auto" gives light-dismiss + Escape natively; keep aria/caret in sync.
    dropdown.addEventListener("toggle", (e) => {
      const open = (e as Event & { newState?: string }).newState === "open";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      menu.toggleAttribute("data-open", open);
    });
  } else {
    document.addEventListener("click", (e) => {
      if (!dropdown.hidden && !menu.contains(e.target as Node)) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !dropdown.hidden) setOpen(false);
    });
  }
}

function wireHeaderButtons(): void {
  const btnNew = document.getElementById("btn-new");
  const btnEdit = document.getElementById("btn-edit-toggle");
  const btnLoad = document.getElementById("btn-load");
  const btnSave = document.getElementById("btn-save");
  const btnSaveAs = document.getElementById("btn-save-as");
  const btnExportWadi = document.getElementById("btn-export-wadi");
  const btnSaveLibrary = document.getElementById("btn-save-library");
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");
  const fileInput = document.getElementById("file-input-json") as HTMLInputElement | null;

  // Apps menu: the companion tools (WDL editor, Floor planner, Staircase
  // explorer). Each opens in its OWN window on desktop (Tauri show_tool) and a
  // new browser tab otherwise, so the studio stays open behind it.
  wireAppsMenu();

  // (Share-as-URL retired — a design is shared by handing over its `.wadi` bundle
  // file: Save/Export the file and send it, or save into a shared library folder.)

  // Export the current house as a .wadi file (native document that opens
  // in the desktop app). Payload is plain house_config JSON.
  btnExportWadi?.addEventListener("click", async () => {
    const cfg = useConfigStore.getState().config;
    if (!cfg) return;
    try {
      const saved = await saveAsWadi(cfg, useConfigStore.getState().wdl);
      if (saved) flashSaved(btnExportWadi, "✓ Saved .wadi");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`Export failed: ${msg}`);
    }
  });

  // Save the model as a bundle INTO the library folder, so it shows up in the
  // gallery with no separate publish step (the folder IS the catalog). On desktop
  // with a local library folder it writes straight in; otherwise it falls back to
  // Save As / a browser download (the user drops it into their Drive/R2 folder).
  // The button only makes sense as a one-tap save when a local folder is set; it
  // relabels to reflect that.
  const refreshLibraryBtn = () => {
    if (!btnSaveLibrary) return;
    const hasLocal = !!libraryDir();
    btnSaveLibrary.title = hasLocal
      ? "Save into your library folder — it shows up in your gallery"
      : "Save a .wadi to add to your library (set a local library folder to save in place)";
  };
  refreshLibraryBtn();
  btnSaveLibrary?.addEventListener("click", async () => {
    const state = useConfigStore.getState();
    const cfg = state.config;
    if (!cfg) return;
    try {
      const saved = await saveToLibrary(cfg, state.wdl, state.filename ?? undefined);
      if (saved) {
        // Written into the library folder (desktop): adopt the path + refresh the
        // gallery so the new entry appears next time it opens.
        if (libraryDir()) state.setFilePath(saved);
        state.markSaved();
      }
      flashSaved(btnSaveLibrary, libraryDir() ? "✓ In your library" : "✓ Saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`Save to library failed: ${msg}`);
    }
  });

  // Edit toggle RETIRED: form-studio editing is gone (WDL is the only edit
  // surface), so there is no edit mode to toggle — hide the button entirely.
  if (btnEdit) btnEdit.style.display = "none";

  btnNew?.addEventListener("click", () => {
    void openNewHouseModal();
  });


  btnLoad?.addEventListener("click", () => void openExistingFromDisk());

  btnSave?.addEventListener("click", async () => {
    const state = useConfigStore.getState();
    const cfg = state.config;
    if (!cfg) return;
    try {
      const saved = await saveConfig(cfg, state.filePath, state.filename ?? undefined, state.wdl);
      if (saved) state.setFilePath(saved);
      state.markSaved();
      // saveConfig is silent on success; give explicit feedback so the
      // click doesn't feel like a no-op.
      flashSaved(btnSave);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`Save failed: ${msg}`);
    }
  });

  // Save As — always prompts for a destination. Passing a null filePath
  // forces the native save dialog in Tauri (or a fresh download in the
  // browser), and we adopt the chosen path as the new working file.
  btnSaveAs?.addEventListener("click", async () => {
    const state = useConfigStore.getState();
    const cfg = state.config;
    if (!cfg) return;
    try {
      const saved = await saveConfig(cfg, null, state.filename ?? undefined, state.wdl);
      if (saved) state.setFilePath(saved);
      state.markSaved();
      flashSaved(btnSaveAs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`Save As failed: ${msg}`);
    }
  });

  btnUndo?.addEventListener("click", () => useConfigStore.temporal.getState().undo());
  btnRedo?.addEventListener("click", () => useConfigStore.temporal.getState().redo());

  // Auto-close the mobile hamburger dropdown after any action inside it,
  // so users don't have to tap ☰ twice per action. Uses delegation on
  // the buttons wrapper so it covers all current + future controls.
  const menuButtons = document.querySelector(".header-actions-buttons");
  menuButtons?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button")) {
      document.body.dataset.menu = "off";
    }
  });

  // File input isn't wired here — pickAndLoadConfig handles its own picker.
  void fileInput;

  updateHistoryButtons();
}

// Standard app keyboard shortcuts. These dispatch a click on the matching
// header button so the shortcut path is identical to the button path (same
// dialogs, error handling, "✓ Saved" flash). Works in the browser and the
// Tauri webview; we preventDefault so the browser's own ⌘S/⌘O/⌘N don't fire.
//
//   ⌘/Ctrl + S        Save (write in place / prompt if new)
//   ⌘/Ctrl + ⇧ + S    Save As
//   ⌘/Ctrl + O        Open / Load
//   ⌘/Ctrl + N        New
//   ⌘/Ctrl + Z        Undo        ⌘/Ctrl + ⇧ + Z  Redo
//   ⌘/Ctrl + Y        Redo (Windows convention)
function wireKeyboardShortcuts(): void {
  const click = (id: string) => document.getElementById(id)?.click();

  window.addEventListener("keydown", (e) => {
    // Only mod-key combos; ignore plain typing.
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || e.altKey) return;

    // Whether focus is in a text field / editable — undo/redo there should
    // stay native (undo the typing), and we shouldn't steal them.
    const el = e.target as HTMLElement | null;
    const inField =
      !!el &&
      (el.isContentEditable ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT");

    switch (e.key.toLowerCase()) {
      case "s":
        e.preventDefault();
        click(e.shiftKey ? "btn-save-as" : "btn-save");
        break;
      case "o":
        e.preventDefault();
        click("btn-load");
        break;
      case "n":
        e.preventDefault();
        click("btn-new");
        break;
      case "z":
        if (inField) return; // let the field do its own undo/redo
        e.preventDefault();
        click(e.shiftKey ? "btn-redo" : "btn-undo");
        break;
      case "y":
        if (inField) return;
        e.preventDefault();
        click("btn-redo");
        break;
      default:
        return;
    }
  });
}

function updateHistoryButtons(): void {
  const t = useConfigStore.temporal.getState();
  const btnUndo = document.getElementById("btn-undo") as HTMLButtonElement | null;
  const btnRedo = document.getElementById("btn-redo") as HTMLButtonElement | null;
  if (btnUndo) btnUndo.disabled = t.pastStates.length === 0;
  if (btnRedo) btnRedo.disabled = t.futureStates.length === 0;
}

// Apply the viewer chrome. Personas are retired: there's ONE mode with two edit
// surfaces — the configurator (left) and the WDL editor (right). This just handles
// embed mode and the (permanently off) form-studio edit flag.
function applyViewerChrome(): void {
  // Minimal-chrome / embed: `?panels=off` (or `?embed=1`) hides every side panel
  // so the model gets the full width (used when an agent drives from chat).
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("panels") === "off" || q.get("embed") === "1") {
      document.body.dataset.embed = "1";
    } else {
      delete document.body.dataset.embed;
    }
  } catch { /* no location — leave chrome as-is */ }
  // FORM-STUDIO EDITING RETIRED: the WDL editor + configurator are the only edit
  // surfaces, so the old object-tree/property-form edit mode stays off.
  document.body.dataset.editMode = "off";
}

// Collapse/expand the left panel (Gharkul configurator dock or Nakasha sidebar)
// via the header ☰. Persisted; defaults collapsed on narrow screens so the
// model is visible on mobile.
function wireLeftToggle(): void {
  const btn = document.getElementById("left-toggle");
  const setIcon = () => {
    if (btn) btn.textContent = document.body.dataset.left === "open" ? "❮" : "❯";
  };
  let stored: string | null = null;
  try { stored = localStorage.getItem(LEFT_PANEL_KEY); } catch { /* ignore */ }
  // Default OPEN so the panel is always visible on first open (on mobile it's a
  // dismissible overlay); only a stored preference collapses it.
  document.body.dataset.left = stored === "closed" ? "closed" : "open";
  setIcon();
  const narrowMq = window.matchMedia("(max-width: 900px)");
  btn?.addEventListener("click", () => {
    // On phones one panel shows at a time: selecting an object swaps the tree
    // for the property panel. Make the collapse tab step back CONSISTENTLY —
    // from the property panel back to the tree first, then collapse the tree to
    // the model — instead of invisibly toggling the already-hidden tree (which
    // used to strand the user: the tree wouldn't reappear). This is the single
    // back/collapse control on mobile (the old separate "← Tree" button is gone).
    if (narrowMq.matches && document.body.dataset.selection === "on") {
      useConfigStore.getState().select(null); // property panel → tree
      return;
    }
    const next = document.body.dataset.left === "open" ? "closed" : "open";
    document.body.dataset.left = next;
    setIcon();
    try { localStorage.setItem(LEFT_PANEL_KEY, next); } catch { /* ignore */ }
  });
}

// Populate galleryTemplates (the catalog manifest) if it hasn't been fetched
// yet — the gallery normally loads it lazily on open, but the wadi API can be
// called before the modal is ever shown.
async function ensureCatalog(): Promise<void> {
  if (galleryTemplates.length) return;
  galleryTemplates = await loadCatalog();
}

// ---- Co-design helpers: feet <-> project units + floor/room lookup ----------
// The model stores project units (per_unit, default 10 = 1 ft); the agent-facing
// tools speak FEET so a contractor's spoken sizes land where expected.
type FloorLike = { name?: string; floor_number?: number; objects?: Array<Record<string, unknown>> };
const perUnitOf = (cfg: unknown): number =>
  Number((cfg as { units?: { per_unit?: number } } | null)?.units?.per_unit) || 10;
const ftToU = (cfg: unknown, ft: unknown): number => (Number(ft) || 0) * perUnitOf(cfg);
const uToFt = (cfg: unknown, u: unknown): number =>
  Math.round(((Number(u) || 0) / perUnitOf(cfg)) * 10) / 10;
const floorsOf = (cfg: unknown): FloorLike[] => ((cfg as { floors?: FloorLike[] } | null)?.floors ?? []);

// Floor index from a name or floor_number; `fallback` (the active floor) when unset.
function resolveFloorIdx(cfg: unknown, ref: unknown, fallback: number): number {
  const floors = floorsOf(cfg);
  if (ref == null || ref === "") return Math.max(0, Math.min(fallback, floors.length - 1));
  const s = String(ref).trim().toLowerCase();
  const byName = floors.findIndex((f) => String(f.name ?? "").toLowerCase() === s);
  if (byName >= 0) return byName;
  const n = Number(ref);
  if (Number.isFinite(n)) {
    const byNum = floors.findIndex((f) => Number(f.floor_number) === n);
    if (byNum >= 0) return byNum;
    if (n >= 1 && n <= floors.length) return n - 1;
  }
  return -1;
}

// A room's {floor, object} index + the raw object, by name (case-insensitive).
function findRoomSel(cfg: unknown, name: unknown): { floor: number; object: number; room: Record<string, unknown> } | null {
  const target = String(name ?? "").trim().toLowerCase();
  const floors = floorsOf(cfg);
  for (let fi = 0; fi < floors.length; fi++) {
    const objs = floors[fi].objects ?? [];
    for (let oi = 0; oi < objs.length; oi++) {
      const o = objs[oi];
      if (o?.type === "room" && String(o.name ?? "").toLowerCase() === target) return { floor: fi, object: oi, room: o };
    }
  }
  return null;
}

// A room name not already taken (numeric suffix on collision) — connections
// reference rooms by name, so names must be unique.
function uniqueRoomName(cfg: unknown, base: string): string {
  const used = new Set<string>();
  for (const f of floorsOf(cfg)) for (const o of f.objects ?? []) if (o?.type === "room" && o.name) used.add(String(o.name).toLowerCase());
  const root = base.trim() || "Room";
  let name = root;
  let n = 1;
  while (used.has(name.toLowerCase())) { n += 1; name = `${root} ${n}`; }
  return name;
}

// ---- Door placement (wadi_add_door): find the wall two rooms share and centre
// a door on the overlap. Mirrors the C11 shared-wall geometry. ----------------
type DoorSide = "north" | "south" | "east" | "west";
const nu = (v: unknown): number => Number(v) || 0;
const rectOfRoom = (o: Record<string, unknown>) => ({ x: nu(o.x), y: nu(o.y), w: nu(o.width), l: nu(o.length) });

// Place a rect of size (w,l) flush against `ref` on `side`, aligned along the
// shared edge. Returns the top-left corner in units. Shared by add_room and the
// relative branch of edit_room so relative placement ALWAYS shares a wall (never
// a gap) — the failure mode when a room is moved by absolute coordinates instead.
function abutPosition(
  ref: { x: number; y: number; w: number; l: number },
  side: string, align: string, w: number, l: number,
): { x: number; y: number } {
  const alongY = align === "center" ? ref.y + (ref.l - l) / 2 : align === "end" ? ref.y + ref.l - l : ref.y;
  const alongX = align === "center" ? ref.x + (ref.w - w) / 2 : align === "end" ? ref.x + ref.w - w : ref.x;
  switch (side) {
    case "east": return { x: ref.x + ref.w, y: alongY };
    case "west": return { x: ref.x - w, y: alongY };
    case "south": return { x: alongX, y: ref.y + ref.l };
    case "north": return { x: alongX, y: ref.y - l };
    default: throw new Error(`side must be north|south|east|west, got '${side}'.`);
  }
}

interface CheckIssue { rule: string; message: string; floor?: number; room?: string }
interface CheckSummary {
  ok: boolean; error_count: number; warning_count: number;
  errors: CheckIssue[]; warnings: CheckIssue[]; summary: string;
}
// Run the SAME structural linter the WDL/MCP path runs (C1-C11) over the LIVE
// resolved config, so the in-page agent can actually answer "any layout errors?".
// C11 is the one that flags a declared connection whose rooms drifted apart or
// lost their door — the exact bug a coordinate move introduces.
function runCheck(cfg: unknown): CheckSummary {
  const fmt = (f: LintFinding): CheckIssue => ({ rule: f.rule, message: f.message, floor: f.floor, room: f.where });
  const none = (summary: string): CheckSummary => ({ ok: true, error_count: 0, warning_count: 0, errors: [], warnings: [], summary });
  if (!cfg) return none("No house loaded.");
  let findings: LintFinding[];
  try {
    findings = lintStructure(cfg as unknown as ValidatedHouseConfig);
  } catch (e) {
    return { ok: false, error_count: 0, warning_count: 0, errors: [], warnings: [], summary: `Check could not run: ${(e as Error).message}` };
  }
  const { errors, warnings } = partitionFindings(findings);
  return {
    ok: errors.length === 0,
    error_count: errors.length, warning_count: warnings.length,
    errors: errors.map(fmt), warnings: warnings.map(fmt),
    summary: errors.length === 0
      ? (warnings.length === 0 ? "No structural issues found." : `No errors; ${warnings.length} warning(s).`)
      : `${errors.length} error(s)${warnings.length ? `, ${warnings.length} warning(s)` : ""} — see errors[].`,
  };
}
// Compact form for mutating tools' return values: the agent gets an immediate
// heads-up (and the top messages) without a second call; details via wadi_check.
interface CheckBrief { ok: boolean; errors: number; warnings: number; summary: string; error_messages?: string[]; warning_messages?: string[] }
function checkBrief(cfg: unknown): CheckBrief {
  const c = runCheck(cfg);
  const out: CheckBrief = { ok: c.ok, errors: c.error_count, warnings: c.warning_count, summary: c.summary };
  if (c.errors.length) out.error_messages = c.errors.slice(0, 4).map((e) => e.message);
  // Warnings matter too (e.g. two rooms overlapping) — surface them so the agent
  // can decide whether to fix, not just see a count.
  if (c.warnings.length) out.warning_messages = c.warnings.slice(0, 4).map((e) => e.message);
  return out;
}

// A's facing side + the overlap span [lo, hi] along that wall, or null if the
// rooms don't share a wall. `tol` absorbs the center/outer wall-thickness overlap.
function sharedWallBetween(
  a: { x: number; y: number; w: number; l: number },
  b: { x: number; y: number; w: number; l: number },
  tol: number,
): { side: DoorSide; lo: number; hi: number } | null {
  const ax1 = a.x + a.w, ay1 = a.y + a.l, bx1 = b.x + b.w, by1 = b.y + b.l;
  const yLo = Math.max(a.y, b.y), yHi = Math.min(ay1, by1);
  const xLo = Math.max(a.x, b.x), xHi = Math.min(ax1, bx1);
  if (yHi - yLo > 0) {
    if (Math.abs(ax1 - b.x) <= tol) return { side: "east", lo: yLo, hi: yHi };
    if (Math.abs(bx1 - a.x) <= tol) return { side: "west", lo: yLo, hi: yHi };
  }
  if (xHi - xLo > 0) {
    if (Math.abs(ay1 - b.y) <= tol) return { side: "south", lo: xLo, hi: xHi };
    if (Math.abs(by1 - a.y) <= tol) return { side: "north", lo: xLo, hi: xHi };
  }
  return null;
}

// Return the room's walls as a dict with `opening` added to `side`, PRESERVING
// every other wall. A room with no `walls` field has all four, so we materialise
// all four (else adding one opening would silently delete the other three).
function wallsWithOpening(walls: unknown, side: DoorSide, opening: Record<string, unknown>): Record<string, unknown> {
  let dict: Record<string, { openings?: unknown[] }>;
  if (walls == null) dict = { north: {}, south: {}, east: {}, west: {} };
  else if (Array.isArray(walls)) { dict = {}; for (const s of walls) dict[String(s)] = {}; }
  else dict = { ...(walls as Record<string, { openings?: unknown[] }>) };
  const cur = { ...(dict[side] ?? {}) };
  cur.openings = [...(Array.isArray(cur.openings) ? cur.openings : []), opening];
  dict[side] = cur;
  return dict;
}

const OPP_SIDE: Record<DoorSide, DoorSide> = { north: "south", south: "north", east: "west", west: "east" };

// Return the room's walls as a dict with `side` OMITTED (the room is left open on
// that side), preserving every other wall + its openings. Used on the NEIGHBOUR
// when a door is placed on a shared wall: the room with the door keeps its wall,
// the neighbour opens its facing side, so the boundary is a single doored wall (the
// shipped-template pattern) instead of a door backed by the neighbour's solid wall.
function wallsWithoutSide(walls: unknown, side: DoorSide): Record<string, unknown> {
  let dict: Record<string, unknown>;
  if (walls == null) dict = { north: {}, south: {}, east: {}, west: {} };
  else if (Array.isArray(walls)) { dict = {}; for (const s of walls) dict[String(s)] = {}; }
  else dict = { ...(walls as Record<string, unknown>) };
  delete dict[side];
  return dict;
}

function uniqueOpeningName(room: Record<string, unknown>, base: string): string {
  const used = new Set<string>();
  const walls = room.walls;
  if (walls && !Array.isArray(walls) && typeof walls === "object") {
    for (const s of Object.values(walls as Record<string, { openings?: Array<{ name?: unknown }> }>))
      for (const op of s?.openings ?? []) if (op?.name) used.add(String(op.name));
  }
  let name = base;
  let n = 1;
  while (used.has(name)) { n += 1; name = `${base} ${n}`; }
  return name;
}

// ---- Graph -> floor plan (wadi_build_house): greedily lay out a room graph so
// CONNECTED rooms end up adjacent, so an agent can hand over a whole house as
// {rooms, connections} and get a real layout back. Hub-first placement: the
// most-connected room anchors, each other room abuts a placed neighbour on the
// first free side (else it appends east of the bounding box). ----------------
type LaidRect = { name: string; x: number; y: number; w: number; l: number };
const rectsOverlap = (a: LaidRect, b: LaidRect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.l && b.y < a.y + a.l;

function layoutRoomGraph(specs: { name: string; w: number; l: number }[], edges: [string, string][]): LaidRect[] {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a)!.add(b); };
  for (const [a, b] of edges) { link(a, b); link(b, a); }
  const degree = (n: string) => adj.get(n)?.size ?? 0;
  const order = [...specs].sort((a, b) => degree(b.name) - degree(a.name)); // hub first
  const placed: LaidRect[] = [];
  const byName = new Map<string, LaidRect>();
  const fits = (r: LaidRect) => !placed.some((p) => rectsOverlap(r, p));
  const put = (r: LaidRect) => { placed.push(r); byName.set(r.name, r); };

  for (const s of order) {
    if (!placed.length) { put({ name: s.name, x: 0, y: 0, w: s.w, l: s.l }); continue; }
    const neighbours = [...(adj.get(s.name) ?? [])].map((n) => byName.get(n)).filter((x): x is LaidRect => !!x);
    const anchors = neighbours.length ? neighbours : placed;
    let done = false;
    for (const anchor of anchors) {
      for (const side of ["east", "south", "west", "north"] as const) {
        const x = side === "east" ? anchor.x + anchor.w : side === "west" ? anchor.x - s.w : anchor.x;
        const y = side === "south" ? anchor.y + anchor.l : side === "north" ? anchor.y - s.l : anchor.y;
        const r = { name: s.name, x, y, w: s.w, l: s.l };
        if (fits(r)) { put(r); done = true; break; }
      }
      if (done) break;
    }
    if (!done) {
      const maxX = Math.max(...placed.map((p) => p.x + p.w));
      const minY = Math.min(...placed.map((p) => p.y));
      put({ name: s.name, x: maxX, y: minY, w: s.w, l: s.l });
    }
  }
  const minX = Math.min(...placed.map((p) => p.x));
  const minY = Math.min(...placed.map((p) => p.y));
  for (const r of placed) { r.x -= minX; r.y -= minY; }
  return placed;
}

// window.wadi — the programmatic control surface. Every method funnels through
// the SAME store mutations the owner UI uses (loadConfig / updateVariables /
// updatePoints / updateObject / insertObject) and the SAME template + view
// paths, so a client driving this API is indistinguishable from a user driving
// the controls — and the two can operate the one live model together.
function wireWadiApi(): void {
  const store = () => useConfigStore.getState();
  const layers = () => useLayerStore.getState();
  const interior = () => useInteriorStore.getState();
  const allLayerIds = (): string[] => effectiveLayers(store().config).map((l) => l.id);
  const applyPatch = (patch: ReturnType<typeof writeValue>): void => {
    if ("points" in patch && patch.points) store().updatePoints(patch.points);
    else if ("variables" in patch && patch.variables) store().updateVariables(patch.variables);
  };

  window.wadi = {
    async listTemplates() {
      await ensureCatalog();
      return galleryTemplates.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        meta: t.meta,
      }));
    },

    async chooseTemplate(id: string) {
      await ensureCatalog();
      const t = galleryTemplates.find((x) => x.id === id);
      if (!t) {
        throw new Error(
          `wadi.chooseTemplate: unknown id '${id}'. Call wadi.listTemplates() for valid ids.`,
        );
      }
      await selectTemplate(t);
      return { ok: true as const, id };
    },

    load(config: unknown) {
      const raw = typeof config === "string" ? JSON.parse(config) : config;
      const parsed = validate(raw);
      if (!parsed.ok || !parsed.data) {
        throw new Error(
          "wadi.load: config failed validation — " + JSON.stringify(parsed.errors),
        );
      }
      store().loadConfig(parsed.data, "wadi.load");
      // Count this as a chosen home so the owner welcome overlay doesn't cover it.
      document.body.dataset.homeChosen = "yes";
      return { ok: true as const };
    },

    getConfig() {
      return store().config;
    },

    setKnob(target: string, value: number) {
      const cfg = store().config;
      if (!cfg) throw new Error("wadi.setKnob: no config loaded yet");
      const v = Number(value);
      applyPatch(writeValue(cfg, target, v));
      return { ok: true as const, target, value: v };
    },

    setKnobs(record: Record<string, number>) {
      // Fold every write onto a working copy (kept typed from the store so its
      // variables/points match the update actions), then commit once so the
      // model re-renders a single time regardless of how many knobs changed.
      const cfg = store().config;
      if (!cfg) throw new Error("wadi.setKnobs: no config loaded yet");
      let working = cfg;
      let touchedVars = false;
      let touchedPts = false;
      for (const [target, value] of Object.entries(record)) {
        const patch = writeValue(working, target, Number(value));
        if ("points" in patch && patch.points) {
          working = { ...working, points: patch.points };
          touchedPts = true;
        } else if ("variables" in patch && patch.variables) {
          working = { ...working, variables: patch.variables };
          touchedVars = true;
        }
      }
      if (touchedVars) store().updateVariables(working.variables);
      if (touchedPts) store().updatePoints(working.points);
      return { ok: true as const, applied: record };
    },

    showView(view: string) {
      if (typeof window.switchView === "function") window.switchView(view);
      else throw new Error("wadi.showView: switchView is not available yet");
      return { ok: true as const, view };
    },

    listLayers() {
      const vis = layers().visible;
      return effectiveLayers(store().config).map((l) => ({
        id: l.id,
        label: l.label,
        group: l.group,
        visible: vis[l.id] !== false,
      }));
    },

    setLayers(record: Record<string, boolean>) {
      const on: string[] = [];
      const off: string[] = [];
      for (const [id, v] of Object.entries(record)) (v ? on : off).push(id);
      if (on.length) layers().setMany(on, true);
      if (off.length) layers().setMany(off, false);
      return { ok: true as const };
    },

    showOnlyLayers(ids: string[]) {
      layers().setAll(allLayerIds(), false);
      layers().setMany(ids, true);
      return { ok: true as const };
    },

    showAllLayers() {
      layers().setAll(allLayerIds(), true);
      return { ok: true as const };
    },

    listRooms() {
      return listRooms(store().config).map((r) => ({
        key: r.key,
        label: `${r.floorName}: ${r.name}`,
      }));
    },

    enterRoom(key: string) {
      const r = listRooms(store().config).find((x) => x.key === key);
      if (!r) {
        throw new Error(
          `wadi.enterRoom: unknown room '${key}'. Call wadi.listRooms() for valid keys.`,
        );
      }
      interior().enter({ key: r.key, label: `${r.floorName}: ${r.name}`, eye: r.eye });
      return { ok: true as const, key };
    },

    exitRoom() {
      interior().exit();
      return { ok: true as const };
    },

    // ---- Co-design mutations: an agent authoring the SAME live model ----------
    describeHouse() {
      const cfg = store().config as Record<string, unknown> | null;
      if (!cfg) return { loaded: false as const };
      const site = (cfg.site ?? {}) as Record<string, unknown>;
      const floors = floorsOf(cfg).map((f, fi) => {
        const objs = f.objects ?? [];
        // Blocks (true polygons) for this floor, so each declared connection can
        // report whether it is actually PASSABLE (shared wall + door/open), not
        // just declared. This is what tells the agent a move broke a connection.
        const blocks = roomBlocksOf(cfg as unknown as ValidatedHouseConfig, fi);
        return {
          floor_number: f.floor_number,
          name: f.name,
          rooms: objs
            .map((o, oi) => ({ o, oi }))
            .filter(({ o }) => o?.type === "room")
            .map(({ o, oi }) => {
              const conns = Array.isArray(o.connections) ? (o.connections as unknown[]) : [];
              const ba = blocks.find((x) => x.index === oi);
              const connections = conns.map((cn) => {
                const bIdx = objs.findIndex((x) => x?.type === "room" && x?.name === cn);
                const bb = blocks.find((x) => x.index === bIdx);
                return { to: String(cn), passable: !!(ba && bb && connectionSatisfied(ba, bb)) };
              });
              return {
                name: o.name,
                x_ft: uToFt(cfg, o.x), y_ft: uToFt(cfg, o.y),
                width_ft: uToFt(cfg, o.width), length_ft: uToFt(cfg, o.length),
                connections,
              };
            }),
        };
      });
      const roof = floorsOf(cfg)
        .flatMap((f) => (f.objects ?? []).filter((o) => o?.type === "roof"))
        .map((r) => ({ roof_type: r.roof_type, endpoint: r.default_endpoint }));
      return {
        units: "feet" as const, per_unit: perUnitOf(cfg),
        plot_width_ft: uToFt(cfg, site.plot_width), plot_length_ft: uToFt(cfg, site.plot_length),
        coord_convention: (cfg.coord_convention as string) ?? "outer",
        variables: (cfg.variables ?? {}) as Record<string, unknown>,
        floors, roof,
        // Structural check (C1-C11) of the whole house, so a single describe call
        // tells the agent if anything is wrong. Each connection above also carries
        // its own `passable` flag.
        issues: checkBrief(cfg),
      };
    },

    addRoom(input: Record<string, unknown>) {
      const cfg = store().config as Record<string, unknown> | null;
      if (!cfg) throw new Error("wadi.addRoom: no house loaded — choose a template or load a config first.");
      const name = uniqueRoomName(cfg, String(input.name ?? "Room"));
      const widthU = ftToU(cfg, input.width_ft ?? 10);
      const lengthU = ftToU(cfg, input.length_ft ?? 10);
      let fi: number, xU: number, yU: number, placed: string;

      if (input.next_to != null && input.side != null) {
        // RELATIVE placement: abut an existing room on a side (no coordinates
        // needed). This is what lets an agent lay out a whole floor by relation.
        const ref = findRoomSel(cfg, input.next_to);
        if (!ref) throw new Error(`wadi.addRoom: next_to room '${String(input.next_to)}' not found. See describeHouse().`);
        fi = ref.floor;
        const r = rectOfRoom(ref.room);
        const side = String(input.side).toLowerCase();
        const align = String(input.align ?? "start").toLowerCase();
        const alongY = align === "center" ? r.y + (r.l - lengthU) / 2 : align === "end" ? r.y + r.l - lengthU : r.y;
        const alongX = align === "center" ? r.x + (r.w - widthU) / 2 : align === "end" ? r.x + r.w - widthU : r.x;
        if (side === "east") { xU = r.x + r.w; yU = alongY; }
        else if (side === "west") { xU = r.x - widthU; yU = alongY; }
        else if (side === "south") { yU = r.y + r.l; xU = alongX; }
        else if (side === "north") { yU = r.y - lengthU; xU = alongX; }
        else throw new Error(`wadi.addRoom: side must be north|south|east|west, got '${side}'.`);
        placed = `${side} of ${String(ref.room.name)}`;
      } else {
        fi = resolveFloorIdx(cfg, input.floor, useConfigStore.getState().activeFloorIdx);
        if (fi < 0) throw new Error(`wadi.addRoom: unknown floor '${String(input.floor)}'. See describeHouse().floors.`);
        xU = ftToU(cfg, input.x_ft);
        yU = ftToU(cfg, input.y_ft);
        placed = "absolute";
      }

      const room = { type: "room", name, x: xU, y: yU, width: widthU, length: lengthU } as unknown as HouseObject;
      // Freehand rooms author at wall CENTRELINES so abutting rooms share a wall.
      if (!cfg.coord_convention) store().setCoordConvention("center");
      const sel = store().insertObject(fi, room);
      store().select(sel);
      return { ok: true as const, name, floor: floorsOf(cfg)[fi]?.name, placed };
    },

    editRoom(input: Record<string, unknown>) {
      const cfg = store().config;
      const found = findRoomSel(cfg, input.name);
      if (!found) throw new Error(`wadi.editRoom: no room named '${String(input.name)}'. See describeHouse().`);
      const patch: Record<string, unknown> = {};
      if (input.new_name != null) patch.name = uniqueRoomName(cfg, String(input.new_name));
      if (input.width_ft != null) patch.width = ftToU(cfg, input.width_ft);
      if (input.length_ft != null) patch.length = ftToU(cfg, input.length_ft);
      // RELATIVE move: snap this room flush against another (no gap). PREFER this
      // over absolute x_ft/y_ft — a coordinate move can leave the rooms separated
      // and silently break a declared connection. Uses the post-resize size.
      if (input.next_to != null && input.side != null) {
        const ref = findRoomSel(cfg, input.next_to);
        if (!ref) throw new Error(`wadi.editRoom: next_to room '${String(input.next_to)}' not found. See describeHouse().`);
        if (ref.floor !== found.floor) throw new Error("wadi.editRoom: next_to must be a room on the same floor.");
        const cur = rectOfRoom(found.room);
        const w = patch.width != null ? Number(patch.width) : cur.w;
        const l = patch.length != null ? Number(patch.length) : cur.l;
        const pos = abutPosition(
          rectOfRoom(ref.room),
          String(input.side).toLowerCase(),
          String(input.align ?? "start").toLowerCase(),
          w, l,
        );
        patch.x = pos.x; patch.y = pos.y;
      } else {
        if (input.x_ft != null) patch.x = ftToU(cfg, input.x_ft);
        if (input.y_ft != null) patch.y = ftToU(cfg, input.y_ft);
      }
      store().updateObject({ floor: found.floor, object: found.object }, patch as Partial<HouseObject>);
      // Report structural state after the edit so the agent notices immediately if
      // the move broke a connection (C11), rather than claiming "no errors".
      return { ok: true as const, name: (patch.name as string) ?? String(found.room.name), check: checkBrief(store().config) };
    },

    check() {
      return runCheck(store().config);
    },

    connectRooms(input: Record<string, unknown>) {
      const cfg = store().config;
      const a = findRoomSel(cfg, input.room_a);
      const b = findRoomSel(cfg, input.room_b);
      if (!a) throw new Error(`wadi.connectRooms: no room named '${String(input.room_a)}'.`);
      if (!b) throw new Error(`wadi.connectRooms: no room named '${String(input.room_b)}'.`);
      if (a.floor !== b.floor) throw new Error("wadi.connectRooms: the rooms are on different floors (connections are same-floor).");
      const bName = String(b.room.name);
      const existing = Array.isArray(a.room.connections) ? (a.room.connections as string[]) : [];
      const next = [...new Set([...existing, bName])];
      store().updateObject({ floor: a.floor, object: a.object }, { connections: next } as Partial<HouseObject>);
      const cfg2 = store().config;
      const blocks = cfg2 ? roomBlocksOf(cfg2, a.floor) : [];
      const ba = blocks.find((x) => x.index === a.object);
      const bb = blocks.find((x) => x.index === b.object);
      const passable = !!(ba && bb && connectionSatisfied(ba, bb));
      return {
        ok: true as const,
        connected: [String(a.room.name), bName],
        passable,
        note: passable
          ? "Connected and passable — the rooms share a wall with a door, or that wall is left off both."
          : "Connected, but not passable yet. Call wadi_add_door with these two rooms to put a door in the shared wall, or leave that wall off both for an open passage.",
      };
    },

    addDoor(input: Record<string, unknown>) {
      const cfg = store().config as Record<string, unknown> | null;
      const a = findRoomSel(cfg, input.room_a);
      const b = findRoomSel(cfg, input.room_b);
      if (!a) throw new Error(`wadi.addDoor: no room named '${String(input.room_a)}'.`);
      if (!b) throw new Error(`wadi.addDoor: no room named '${String(input.room_b)}'.`);
      if (a.floor !== b.floor) throw new Error("wadi.addDoor: the rooms are on different floors.");
      const wt = nu((cfg?.defaults as { wall_thickness?: unknown } | undefined)?.wall_thickness) || 8;
      const ra = rectOfRoom(a.room), rb = rectOfRoom(b.room);
      const sw = sharedWallBetween(ra, rb, wt + 1);
      if (!sw) throw new Error(`wadi.addDoor: ${String(a.room.name)} and ${String(b.room.name)} don't share a wall — move them so they abut first.`);
      const per = perUnitOf(cfg);
      const overlap = sw.hi - sw.lo;
      const widthU = input.width_ft != null
        ? ftToU(cfg, input.width_ft)
        : Math.max(Math.min(overlap - per / 2, 3 * per), Math.min(overlap * 0.6, 2 * per));
      const heightU = input.height_ft != null ? ftToU(cfg, input.height_ft) : Math.round(6.5 * per);
      const alongStart = sw.side === "east" || sw.side === "west" ? ra.y : ra.x;
      const wallLen = sw.side === "north" || sw.side === "south" ? ra.w : ra.l;
      const center = (sw.lo + sw.hi) / 2;
      const offset = Math.max(0, Math.min(center - alongStart - widthU / 2, wallLen - widthU));
      const doorName = uniqueOpeningName(a.room, "Door");
      const walls = wallsWithOpening(a.room.walls, sw.side, { kind: "door", name: doorName, offset, width: widthU, height: heightU });
      const existing = Array.isArray(a.room.connections) ? (a.room.connections as string[]) : [];
      const connections = [...new Set([...existing, String(b.room.name)])];
      store().updateObject({ floor: a.floor, object: a.object }, { walls, connections } as Partial<HouseObject>);
      // Open the neighbour's facing wall so the doorway is a single shared wall, not
      // a door backed by the neighbour's solid wall (the shipped-template pattern).
      const bWalls = wallsWithoutSide(b.room.walls, OPP_SIDE[sw.side]);
      store().updateObject({ floor: b.floor, object: b.object }, { walls: bWalls } as Partial<HouseObject>);
      const cfg2 = store().config;
      const blocks = cfg2 ? roomBlocksOf(cfg2, a.floor) : [];
      const ba = blocks.find((x) => x.index === a.object);
      const bb = blocks.find((x) => x.index === b.object);
      return {
        ok: true as const,
        door: doorName,
        on: `${String(a.room.name)} ${sw.side} wall`,
        between: [String(a.room.name), String(b.room.name)],
        passable: !!(ba && bb && connectionSatisfied(ba, bb)),
      };
    },

    buildHouse(input: Record<string, unknown>) {
      const per = 10; // fresh house authored in feet_inches (10 units = 1 ft)
      // Unique room names + sizes in units.
      const used = new Set<string>();
      const nameMap = new Map<string, string>();
      const specs: { name: string; w: number; l: number }[] = [];
      for (const r of (input.rooms as Array<Record<string, unknown>> | undefined) ?? []) {
        const base = String(r.name ?? "Room").trim() || "Room";
        let name = base, k = 1;
        while (used.has(name.toLowerCase())) { k += 1; name = `${base} ${k}`; }
        used.add(name.toLowerCase());
        nameMap.set(String(r.name), name);
        specs.push({ name, w: (Number(r.width_ft) || 10) * per, l: (Number(r.length_ft) || 10) * per });
      }
      if (!specs.length) throw new Error("wadi.buildHouse: provide at least one room, e.g. rooms:[{name,width_ft,length_ft}].");

      const edges: [string, string][] = [];
      for (const c of (input.connections as Array<unknown> | undefined) ?? []) {
        const a = Array.isArray(c) ? c[0] : (c as Record<string, unknown>).a;
        const b = Array.isArray(c) ? c[1] : (c as Record<string, unknown>).b;
        const an = nameMap.get(String(a)) ?? String(a);
        const bn = nameMap.get(String(b)) ?? String(b);
        if (an && bn && an !== bn) edges.push([an, bn]);
      }

      const placed = layoutRoomGraph(specs, edges);
      const rectByName = new Map(placed.map((r) => [r.name, r]));
      const roomObjs: Record<string, unknown>[] = placed.map((r) => ({
        type: "room", name: r.name, x: r.x, y: r.y, width: r.w, length: r.l,
      }));
      const objByName = new Map(roomObjs.map((o) => [o.name as string, o]));

      const wt = 8; // default wall thickness for a fresh house
      const notes: string[] = [];
      let doors = 0;
      for (const [an, bn] of edges) {
        const oa = objByName.get(an);
        if (!oa) continue;
        oa.connections = [...new Set([...((oa.connections as string[]) ?? []), bn])];
        const ra = rectByName.get(an)!, rb = rectByName.get(bn)!;
        const sw = sharedWallBetween(ra, rb, wt + 1);
        if (!sw) { notes.push(`${an} <-> ${bn}: placed apart, no door (connection kept)`); continue; }
        const overlap = sw.hi - sw.lo;
        const width = Math.max(Math.min(overlap - per / 2, 3 * per), Math.min(overlap * 0.6, 2 * per));
        const along = sw.side === "east" || sw.side === "west" ? ra.y : ra.x;
        const wallLen = sw.side === "north" || sw.side === "south" ? ra.w : ra.l;
        const center = (sw.lo + sw.hi) / 2;
        const offset = Math.max(0, Math.min(center - along - width / 2, wallLen - width));
        oa.walls = wallsWithOpening(oa.walls, sw.side, { kind: "door", name: `Door ${doors + 1}`, offset, width, height: Math.round(6.5 * per) });
        // Open the neighbour's facing wall so the doorway is one shared wall, not a
        // door backed by a solid wall (matches how the shipped templates author it).
        const ob = objByName.get(bn);
        if (ob) ob.walls = wallsWithoutSide(ob.walls, OPP_SIDE[sw.side]);
        doors += 1;
      }
      for (const o of roomObjs) if (!(o.connections as string[] | undefined)?.length) delete o.connections;

      const maxX = Math.max(...placed.map((r) => r.x + r.w));
      const maxY = Math.max(...placed.map((r) => r.y + r.l));
      const config = {
        units: { system: "feet_inches", per_unit: per },
        coord_convention: "center",
        site: { plot_width: maxX, plot_length: maxY, reference_x: 0, reference_y: 0 },
        floors: [{ floor_number: 1, name: String(input.floor_name ?? "Ground"), slab_thickness: 0, objects: roomObjs }],
      };
      // Validate + load through the store (one operation → one undo step).
      const parsed = validate(config);
      if (!parsed.ok || !parsed.data) {
        throw new Error("wadi.buildHouse: generated an invalid house — " + JSON.stringify(parsed.errors));
      }
      store().loadConfig(parsed.data, "wadi.buildHouse");
      document.body.dataset.homeChosen = "yes";
      return { ok: true as const, rooms: placed.length, doors, plot_ft: [Math.round(maxX / per), Math.round(maxY / per)], notes };
    },

    undo() { useConfigStore.temporal.getState().undo(); return { ok: true as const }; },
    redo() { useConfigStore.temporal.getState().redo(); return { ok: true as const }; },
    captureView(size?: number) { return window.wadiCapture3D?.(Number(size) || 1000) ?? null; },

    async setWdl(wdl: string) {
      const src = String(wdl ?? "");
      const res = await wdlToConfig(src);
      if (!res.ok || !res.config) return { ok: false as const, errors: res.errors };
      // Keep the agent's exact WDL as the model's source (WDL is the source of truth).
      store().loadConfig(res.config, "wadi.setWdl", null, src);
      document.body.dataset.homeChosen = "yes";
      return { loaded: true as const, ...checkBrief(store().config) };
    },
    async getWdl() {
      // The model always carries its WDL (synced in the store). Fall back to a
      // fresh decompile if the synced copy is somehow empty.
      const s = store();
      return s.wdl || configToWdlText(s.config as unknown as ValidatedHouseConfig);
    },
    async checkWdl(wdl: string) {
      const res = await wdlToConfig(String(wdl ?? ""));
      return res.ok
        ? { ok: true as const, message: "Compiles and validates. Load it with wadi_set_wdl to render it and get the structural (C1-C12) check." }
        : { ok: false as const, errors: res.errors };
    },
  };
}

// A small read-only badge overlaid on the 3D view that tells the homeowner
// which layers are currently hidden. Because the skill drives layer visibility
// (and the layer panel is hidden in ?panels=off mode), this is the only cue the
// model isn't showing everything. Auto-hides when all layers are visible.
function wireLayerStatus(): void {
  const el = document.getElementById("layer-status");
  if (!el) return;
  const render = (): void => {
    const vis = useLayerStore.getState().visible;
    const hidden = effectiveLayers(useConfigStore.getState().config).filter(
      (l) => vis[l.id] === false,
    );
    if (hidden.length === 0) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    const labels = hidden.map((l) => l.label);
    const shown = labels.slice(0, 3).join(", ");
    const more = labels.length > 3 ? ` +${labels.length - 3} more` : "";
    el.textContent = `👁 Hidden: ${shown}${more}`;
    el.hidden = false;
  };
  render();
  useLayerStore.subscribe(render);
  // Layer set can change when a different house loads — re-evaluate then too.
  useConfigStore.subscribe(render);
}

// ---- WebMCP: expose the wadi controls as agent-callable tools --------------
// document.modelContext.registerTool (W3C WebMCP; Chrome 149 origin trial) lets
// a site register JS functions any in-browser AI agent can call. We wrap the
// SAME window.wadi methods so an agent drives the model directly instead of
// clicking UI — which also sidesteps the 3D <canvas> being invisible to
// accessibility-tree agents. To try it: enable chrome://flags/#enable-webmcp-testing
// (localhost/dev) or add a production origin-trial token to viewer.html.
const WEBMCP_ROOF: Record<string, number> = { flat: 0, shed: 1, gable: 2, hip: 3 };

const WDL_PRIMER = [
  "Wadi .wdl DSL — the full authoring language for a house. A minimal valid house:",
  "",
  "house House {",
  "  convention center               // room x/y/size are wall CENTRELINES, so abutting rooms share a wall (alternative: outer)",
  "  site { plot (400, 300) }        // plot W, L in project units (10 units = 1 ft by default); values may be variables/formulas",
  "  defaults { floor_height 100 wall_height 92 slab_thickness 8 wall_thickness 8 }",
  "",
  "  floor 1 \"Ground Floor\" {",
  "    slab_thickness 0              // a floor of only rooms/walls needs slab 0 (or add a `slab`), else the walls float above the base",
  "    room Living at (0, 0) size (160, 140) material \"living\" {",
  "      wall north south west                       // several sides on one line",
  "      wall east { door D1 at 55 size (30, 84) }   // a door NEEDS a name; `at` = offset along the wall, size = (width, height)",
  "    }",
  "    room Kitchen at (160, 0) size (120, 140) {",
  "      wall north south east                       // west omitted -> open to Living's doored wall (a passage)",
  "    }",
  "  }",
  "}",
  "",
  "KEY RULES:",
  "- Names are BARE identifiers (room Living, door D1) — NOT quoted. \"strings\" are only for titles/materials.",
  "- Object types inside a floor: room, wall, pillar, beam, slab, roof, staircase, kitchen_platform, item (furniture GLB), component (reusable).",
  "- Openings live inside `wall SIDE { ... }`: `door NAME at OFFSET size (w,h) [open]`, `window NAME at OFFSET size (w,h) [sill N]`. `open` = open passage.",
  "- Two rooms are connected when they abut and the shared wall has a door on one room (and is omitted on the other), OR is omitted on both (open passage).",
  "- Coordinates: origin top-left, X right, Y DOWN. Positions/sizes are project units (10 = 1 ft by default).",
  "- Parametric: declare variables and use them / write formulas (e.g. main.x4 - main.x1) in any numeric slot; reusable components and the unified `roof` object are supported.",
  "",
  "For complete, correct examples (roofs, variables, grids, components), call wadi_choose_home then wadi_get_wdl to read a full house's WDL, edit it, and apply with wadi_set_wdl. wadi_set_wdl returns compile errors + the C1-C12 structural check so you can iterate.",
].join("\n");

function buildWadiMcpTools(): WebMcpTool[] {
  const api = () => {
    const w = window.wadi;
    if (!w) throw new Error("wadi API not ready");
    return w;
  };
  const text = (data: unknown) => ({
    content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }],
  });
  const noInput: Record<string, unknown> = { type: "object", properties: {} };

  const allTools: WebMcpTool[] = [
    // ---- WDL: the full authoring surface. An agent authors Wadi's .wdl DSL —
    // every object type, variables, formulas, components, roofs — compiled through
    // the real pipeline and rendered live. This is the powerful path; the narrower
    // tools below remain for simple owner-facing tweaks. ----
    {
      name: "wadi_wdl_reference",
      description:
        "Get a primer on Wadi's .wdl DSL (the full authoring language) before writing WDL. Returns the core syntax. For complete, correct examples, load any home with wadi_choose_home then call wadi_get_wdl to see real WDL for a full house.",
      annotations: { readOnlyHint: true },
      inputSchema: noInput,
      execute() { return text(WDL_PRIMER); },
    },
    {
      name: "wadi_get_wdl",
      description:
        "Return the CURRENT live house as .wdl source — the full, editable design. Read this first when modifying an existing house: change the WDL text, then apply it with wadi_set_wdl.",
      annotations: { readOnlyHint: true },
      async execute() { return text(await api().getWdl()); },
    },
    {
      name: "wadi_set_wdl",
      description:
        "Author the house by compiling .wdl source through Wadi's real pipeline and loading it into the live 3D model. This is the full-power tool: every object type, variables, formulas, components and roofs are available. On a compile or schema error the model is left unchanged and the errors are returned to fix. On success it returns the C1-C12 structural check (errors + warnings). Typical loop: wadi_get_wdl -> edit the text -> wadi_set_wdl -> read warnings -> repeat. Call wadi_wdl_reference first if unsure of the syntax.",
      inputSchema: {
        type: "object",
        properties: { wdl: { type: "string", description: "the complete .wdl document" } },
        required: ["wdl"],
      },
      async execute(input) { return text(await api().setWdl(String(input?.wdl ?? ""))); },
    },
    {
      name: "wadi_check_wdl",
      description:
        "Compile-check .wdl WITHOUT loading it (dry run). Returns compile/schema errors, or ok. Use to validate a draft before wadi_set_wdl.",
      inputSchema: {
        type: "object",
        properties: { wdl: { type: "string", description: "the .wdl document to check" } },
        required: ["wdl"],
      },
      async execute(input) { return text(await api().checkWdl(String(input?.wdl ?? ""))); },
    },
    {
      name: "wadi_list_homes",
      description:
        "List the ready-made home designs the user can start from (id, title, bedrooms, bathrooms, roof, style, min plot).",
      annotations: { readOnlyHint: true },
      inputSchema: noInput,
      async execute() { return text(await api().listTemplates()); },
    },
    {
      name: "wadi_choose_home",
      description:
        "Load one ready-made home by its id (from wadi_list_homes). Rebuilds the live 3D model.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "template id, e.g. family_home" } },
        required: ["id"],
      },
      async execute(input) { return text(await api().chooseTemplate(String(input.id))); },
    },
    {
      name: "wadi_set_plot",
      description:
        "Set the plot size in feet. Provide width_ft (east-west) and/or length_ft (north-south). The whole house re-flows.",
      inputSchema: {
        type: "object",
        properties: {
          width_ft: { type: "number", description: "plot width in feet" },
          length_ft: { type: "number", description: "plot length in feet" },
        },
      },
      execute(input) {
        const knobs: Record<string, number> = {};
        if (typeof input.width_ft === "number") knobs["House.W"] = input.width_ft * 10;
        if (typeof input.length_ft === "number") knobs["House.L"] = input.length_ft * 10;
        api().setKnobs(knobs);
        return text(`Plot set to ${input.width_ft ?? "?"} x ${input.length_ft ?? "?"} ft`);
      },
    },
    {
      name: "wadi_set_roof",
      description: "Set the roof style: flat, shed, gable, or hip.",
      inputSchema: {
        type: "object",
        properties: {
          style: { type: "string", enum: ["flat", "shed", "gable", "hip"], description: "roof style" },
        },
        required: ["style"],
      },
      execute(input) {
        const s = String(input.style).toLowerCase();
        const n = WEBMCP_ROOF[s];
        if (n === undefined) throw new Error(`unknown roof style '${input.style}' (use flat|shed|gable|hip)`);
        api().setKnob("roof_style", n);
        return text(`Roof set to ${s}`);
      },
    },
    {
      name: "wadi_adjust",
      description:
        "Advanced: set configurator knobs directly as a map of knob-target to raw value (e.g. {\"pctLivW\":0.38}). Prefer wadi_set_plot / wadi_set_roof for common changes.",
      inputSchema: {
        type: "object",
        properties: {
          knobs: {
            type: "object",
            additionalProperties: { type: "number" },
            description: "map of knob target -> raw value",
          },
        },
        required: ["knobs"],
      },
      execute(input) {
        const knobs = (input.knobs ?? {}) as Record<string, number>;
        api().setKnobs(knobs);
        return text({ applied: knobs });
      },
    },
    {
      name: "wadi_get_design",
      description: "Summarize the current design: plot size (ft), roof style, and rooms.",
      annotations: { readOnlyHint: true },
      inputSchema: noInput,
      execute() {
        const cfg = api().getConfig() as {
          points?: { House?: { x?: number; y?: number } };
          variables?: { roof_style?: number };
        } | null;
        const H = cfg?.points?.House;
        const rs = cfg?.variables?.roof_style;
        return text({
          plot_ft:
            H && typeof H.x === "number" && typeof H.y === "number" ? `${H.x / 10} x ${H.y / 10}` : null,
          roof: ["Flat", "Shed", "Gable", "Hip"][rs ?? -1] ?? String(rs),
          rooms: api().listRooms().map((r) => r.label),
        });
      },
    },
    {
      name: "wadi_show_layout",
      description: "Hide the roof so the room layout is visible from above.",
      inputSchema: noInput,
      execute() {
        api().setLayers({ loft: false, frame_surface: false, frame_spine: false });
        return text("Roof hidden — room layout visible.");
      },
    },
    {
      name: "wadi_show_full",
      description: "Show every part of the house again (reveal the roof).",
      inputSchema: noInput,
      execute() { api().showAllLayers(); return text("All parts of the house are visible."); },
    },
    {
      name: "wadi_list_rooms",
      description: "List the rooms the 3D camera can walk into (key + label).",
      annotations: { readOnlyHint: true },
      inputSchema: noInput,
      execute() { return text(api().listRooms()); },
    },
    {
      name: "wadi_enter_room",
      description: "Move the 3D camera inside a room for a first-person look (key from wadi_list_rooms).",
      inputSchema: {
        type: "object",
        properties: { key: { type: "string", description: "room key from wadi_list_rooms" } },
        required: ["key"],
      },
      execute(input) { return text(api().enterRoom(String(input.key))); },
    },
    {
      name: "wadi_exit_room",
      description: "Return the 3D camera to the outside view.",
      inputSchema: noInput,
      execute() { return text(api().exitRoom()); },
    },

    // ---- Co-design tools: author the SAME live model the person is editing.
    // Every mutation goes through the studio's own store actions, so agent and
    // human edits share one model and one undo history. Sizes are in FEET. ----
    {
      name: "wadi_describe_house",
      description:
        "Read the current house as structured data: each floor and its rooms (name, size and position in feet), each room's connections (with a `passable` flag = the two rooms actually share a wall with a door or open passage), the roof, plot size, design variables, and an `issues` structural summary (errors/warnings). Call this FIRST to see what you're working with, and again to confirm a change landed correctly.",
      annotations: { readOnlyHint: true },
      inputSchema: noInput,
      execute() { return text(api().describeHouse()); },
    },
    {
      name: "wadi_check",
      description:
        "Check the current house for structural problems (the same C1-C12 conventions the desktop/CLI use). Returns errors and warnings with the rule id, a message, and the room/floor. Use this whenever you are asked whether the layout is valid, and after adding/moving/resizing rooms. Read the WARNINGS too, not just errors: C12 flags two rooms that OVERLAP (occupy the same floor area) — usually a placement mistake to fix by moving one room. C11 flags a connection whose rooms drifted apart ('connected but their walls do not overlap') or lost the door ('no door'). ok=true means no errors (warnings can still need fixing).",
      annotations: { readOnlyHint: true },
      inputSchema: noInput,
      execute() { return text(api().check()); },
    },
    {
      name: "wadi_build_house",
      description:
        "Build a WHOLE house from a room graph in one call. Give a list of rooms (name + size in feet) and the connections between them; this lays connected rooms next to each other, puts a door on each connection, and shows the 3D house. Use this to turn a described house into a real design, then refine with the other tools. Replaces the current model.",
      inputSchema: {
        type: "object",
        properties: {
          rooms: {
            type: "array",
            description: "the rooms",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                width_ft: { type: "number", description: "east-west size in feet" },
                length_ft: { type: "number", description: "north-south size in feet" },
              },
              required: ["name", "width_ft", "length_ft"],
            },
          },
          connections: {
            type: "array",
            description: "which rooms open into each other, as name pairs, e.g. [[\"Living\",\"Kitchen\"],[\"Living\",\"Hall\"]]",
            items: { type: "array", items: { type: "string" } },
          },
          floor_name: { type: "string", description: "name for the floor (default Ground)" },
        },
        required: ["rooms"],
      },
      execute(input) { return text(api().buildHouse(input)); },
    },
    {
      name: "wadi_add_room",
      description:
        "Add a room. Size is width_ft (east-west) by length_ft (north-south). Place it either RELATIVELY (next_to an existing room + side) which is easiest for building a whole floor, or ABSOLUTELY (x_ft, y_ft = top-left corner, x east / y south). Rooms that touch share a wall.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "room name, e.g. Bedroom" },
          width_ft: { type: "number", description: "east-west size in feet" },
          length_ft: { type: "number", description: "north-south size in feet" },
          next_to: { type: "string", description: "relative placement: name of the room to abut" },
          side: { type: "string", enum: ["north", "south", "east", "west"], description: "which side of next_to to place this room" },
          align: { type: "string", enum: ["start", "center", "end"], description: "align along the shared edge (default start)" },
          floor: { type: "string", description: "absolute placement: floor name or number (defaults to active)" },
          x_ft: { type: "number", description: "absolute placement: left edge (east) in feet" },
          y_ft: { type: "number", description: "absolute placement: top edge (south) in feet" },
        },
        required: ["name", "width_ft", "length_ft"],
      },
      execute(input) { return text(api().addRoom(input)); },
    },
    {
      name: "wadi_edit_room",
      description:
        "Rename, move, or resize an existing room (by name). To MOVE a room, prefer RELATIVE placement (next_to + side [+ align]) so it snaps flush against its neighbour and keeps sharing a wall — e.g. to put the Veranda in front of the Living room, next_to:\"Living\", side:\"south\". Absolute x_ft/y_ft is available but can leave a gap that breaks a connection. You can also rename (new_name) or resize (width_ft/length_ft). The result includes a `check` summary so you can see if the edit broke anything.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "the room to edit" },
          new_name: { type: "string" },
          next_to: { type: "string", description: "relative move: name of the room to snap flush against" },
          side: { type: "string", enum: ["north", "south", "east", "west"], description: "which side of next_to to place this room (south = toward the front/entrance)" },
          align: { type: "string", enum: ["start", "center", "end"], description: "align along the shared edge (default start)" },
          x_ft: { type: "number", description: "absolute move: left edge (east) in feet — may leave a gap; prefer next_to" },
          y_ft: { type: "number", description: "absolute move: top edge (south) in feet — may leave a gap; prefer next_to" },
          width_ft: { type: "number" }, length_ft: { type: "number" },
        },
        required: ["name"],
      },
      execute(input) { return text(api().editRoom(input)); },
    },
    {
      name: "wadi_connect_rooms",
      description:
        "Declare that two rooms (by name, same floor) open into each other. Returns whether the connection is physically passable yet, and if not, how to fix it (add a door on the shared wall, or leave that wall off both rooms).",
      inputSchema: {
        type: "object",
        properties: { room_a: { type: "string" }, room_b: { type: "string" } },
        required: ["room_a", "room_b"],
      },
      execute(input) { return text(api().connectRooms(input)); },
    },
    {
      name: "wadi_add_door",
      description:
        "Put a door in the wall two rooms share (centred on where they overlap) and connect them. Call this ONCE per pair — it makes the doorway a single shared wall (it opens the neighbour's facing wall for you), so do NOT also add a door the other direction. Use it to make a connection passable. Optional width_ft (default ~3 ft) and height_ft (default ~6.5 ft).",
      inputSchema: {
        type: "object",
        properties: {
          room_a: { type: "string" }, room_b: { type: "string" },
          width_ft: { type: "number" }, height_ft: { type: "number" },
        },
        required: ["room_a", "room_b"],
      },
      execute(input) { return text(api().addDoor(input)); },
    },
    {
      name: "wadi_set_variable",
      description:
        "Set a design variable or plot dimension by name (see wadi_describe_house.variables). Plot width/length are 'House.W'/'House.L' in raw units (10 units = 1 ft); roof_style is 0=Flat, 1=Shed, 2=Gable, 3=Hip. The whole house re-flows.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" }, value: { type: "number" } },
        required: ["name", "value"],
      },
      execute(input) { return text(api().setKnob(String(input.name), Number(input.value))); },
    },
    {
      name: "wadi_undo",
      description: "Undo the last change. Agent and human share one undo history.",
      inputSchema: noInput,
      execute() { return text(api().undo()); },
    },
    {
      name: "wadi_redo",
      description: "Redo the last undone change.",
      inputSchema: noInput,
      execute() { return text(api().redo()); },
    },
    {
      name: "wadi_capture_view",
      description:
        "Render the current 3D model to an image so you can SEE the result of your changes (the 3D canvas is otherwise invisible to you). Optional pixel size (default 1000).",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: { size: { type: "number", description: "image size in px, default 1000" } },
      },
      execute(input) {
        const url = api().captureView(Number(input?.size) || 1000);
        if (typeof url === "string" && url.startsWith("data:")) {
          const comma = url.indexOf(",");
          const mime = /^data:([^;]+)/.exec(url)?.[1] ?? "image/png";
          return { content: [{ type: "image", data: url.slice(comma + 1), mimeType: mime }] };
        }
        return text("Could not capture a view — make sure a house is loaded and the 3D Model tab is open.");
      },
    },
  ];

  // WDL-ONLY EDITING (user directive): the model is edited exclusively by
  // authoring WDL (wadi_set_wdl). Every OTHER mutating tool is withheld from the
  // agent surface — no add/edit/connect/door, no build_house, no knob/plot/roof
  // setters. What remains: the WDL tools, plus read-only orientation, view, undo,
  // and loading a ready-made starting home. (The window.wadi methods still exist
  // for the owner configurator UI + skill; they are just not exposed as tools.)
  const NON_WDL_EDIT_TOOLS = new Set<string>([
    "wadi_build_house",
    "wadi_add_room",
    "wadi_edit_room",
    "wadi_connect_rooms",
    "wadi_add_door",
    "wadi_set_variable",
    "wadi_set_plot",
    "wadi_set_roof",
    "wadi_adjust",
  ]);
  return allTools.filter((t) => !NON_WDL_EDIT_TOOLS.has(t.name));
}

function wireWebMcpTools(): void {
  const tools = buildWadiMcpTools();
  // Expose for inspection / testing / the demo, even where WebMCP is absent.
  window.wadiMcpTools = tools;
  const mc =
    (document as unknown as { modelContext?: ModelContextLike }).modelContext ??
    (navigator as unknown as { modelContext?: ModelContextLike }).modelContext;
  if (!mc || typeof mc.registerTool !== "function") return; // no WebMCP → still on window.wadiMcpTools
  let n = 0;
  for (const tool of tools) {
    try {
      void Promise.resolve(mc.registerTool(tool)).catch((e) =>
        console.warn(`[webmcp] registerTool ${tool.name} failed:`, e),
      );
      n++;
    } catch (e) {
      console.warn(`[webmcp] registerTool ${tool.name} threw:`, e);
    }
  }
  console.info(`[webmcp] registered ${n} wadi tools on document.modelContext`);
}

// -----------------------------------------------------------------
// Template picker modal
// -----------------------------------------------------------------

interface TemplateMeta {
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  style?: string;
  roof?: string;
  minWidthFt?: number;
  minLengthFt?: number;
  parametric?: boolean;
}
interface TemplateEntry {
  id: string;
  title: string;
  description: string;
  file: string;
  meta?: TemplateMeta;
  /** Loose cover image path (relative to the catalog base) from catalog.json. */
  cover?: string;
}

// Render a template's key features as small chips so a user can pick by
// requirements (bedrooms, min plot size, style…) rather than reading prose.
function templateMetaChips(m: TemplateMeta | undefined): string {
  if (!m) return "";
  const chips: string[] = [];
  const n = (v: number | undefined) => (typeof v === "number" ? v : undefined);
  if (n(m.bedrooms) !== undefined) chips.push(`${m.bedrooms} bed`);
  if (n(m.bathrooms) !== undefined) chips.push(`${m.bathrooms} bath`);
  if (n(m.floors) !== undefined) chips.push(`${m.floors} floor${m.floors === 1 ? "" : "s"}`);
  if (m.style && m.style !== "—") chips.push(escapeHtml(m.style));
  if (m.roof && m.roof !== "—") chips.push(`${escapeHtml(m.roof)} roof`);
  if (n(m.minWidthFt) !== undefined && n(m.minLengthFt) !== undefined)
    chips.push(`min ${m.minWidthFt}×${m.minLengthFt} ft`);
  if (m.parametric) chips.push("parametric");
  return chips.length
    ? `<div class="template-card-meta">${chips
        .map((c) => `<span class="template-chip">${c}</span>`)
        .join("")}</div>`
    : "";
}
// Gallery state. Held at module scope so the filter controls can re-render the
// card grid without refetching the manifest, and thumbnails fetched once per
// template file are reused across filter changes.
let galleryTemplates: TemplateEntry[] = [];
const thumbCache = new Map<string, string[]>();
interface TemplateFilters {
  bedrooms: number; // minimum
  bathrooms: number; // minimum
  floors: number; // 0 = any, else exact
  style: string; // "" = any
  roof: string; // "" = any
  plotW: number | null; // my plot width (ft); template must fit
  plotL: number | null;
}
const emptyFilters = (): TemplateFilters => ({
  bedrooms: 0,
  bathrooms: 0,
  floors: 0,
  style: "",
  roof: "",
  plotW: null,
  plotL: null,
});
let tplFilters: TemplateFilters = emptyFilters();

async function openNewHouseModal(): Promise<void> {
  const modal = document.getElementById("new-house-modal");
  const grid = document.getElementById("new-house-modal-grid");
  if (!modal || !grid) return;
  modal.style.display = "block";

  // Source-aware framing: the DEFAULT source is Wadi's sample homes (a casual
  // visitor picks one to make their own); a user who has pointed the app at their
  // OWN models location (a local folder or Google Drive) is opening their designs.
  const samples = templateSource().kind === "default";
  const titleEl = document.getElementById("new-house-modal-title");
  const subEl = document.getElementById("new-house-modal-subtitle");
  if (titleEl) titleEl.textContent = samples ? "Choose your home" : "Open a model";
  if (subEl)
    subEl.textContent = samples
      ? "Browse ready-made homes and pick one to make your own. Filter by size and rooms, then customize everything."
      : "Open one of your saved models — or start from one and customize it.";

  // Reset filters each open so a fresh visit starts unfiltered.
  tplFilters = emptyFilters();

  // Always re-index on open — the folder listing is cheap, and caching it meant
  // users saw a stale template list until they hard-reloaded. The catalog source
  // (local folder / Drive / bundled / a cloud bucket) is resolved by
  // templateSource, which lists the folder and indexes each self-describing file.
  try {
    galleryTemplates = await loadCatalog();
  } catch (e) {
    grid.innerHTML =
      `<div class="new-house-modal-empty" style="color:#b00">
        Couldn't load models from (${escapeHtml(sourceLabel())}): ${e instanceof Error ? e.message : String(e)}
      </div>`;
    return;
  }

  // "Open a saved .wadi" — reuse the disk-load flow, close the modal on success.
  const openBtn = document.getElementById("new-house-open-existing");
  if (openBtn) {
    (openBtn as HTMLButtonElement).onclick = async () => {
      if (await openExistingFromDisk()) closeNewHouseModal();
    };
  }

  renderCatalogSourceBar();
  buildTemplateFilterBar();
  renderTemplateCards();
}

// A human label for a templates source, used in the bar and error messages.
function sourceLabel(s: TemplateSource = templateSource()): string {
  switch (s.kind) {
    case "default": return "Wadi sample homes";
    case "bundled": return "bundled with the app";
    case "local": return `folder: ${s.dir}`;
    case "url": return s.url;
    case "gdrive": return `${s.url} (Google Drive)`;
  }
}

// Footer control: shows where templates come from and lets anyone pick a source.
// A single "kind" selector drives which field(s) show, so the four source types
// (Wadi hosted / bundled / local folder / web address / Google Drive) are one
// well-defined preference instead of three overlapping settings.
function renderCatalogSourceBar(): void {
  const bar = document.getElementById("new-house-modal-source");
  if (!bar) return;
  bar.innerHTML =
    `<span class="tpl-source-label">Models: <b>${escapeHtml(sourceLabel())}</b></span>
     <button type="button" class="tpl-source-btn" id="tpl-source-set">Change location…</button>
     <button type="button" class="tpl-source-btn" id="tpl-source-refresh">↻ Refresh</button>`;
  document.getElementById("tpl-source-refresh")?.addEventListener("click", () => {
    resetCatalogSource();
    thumbCache.clear();
    void openNewHouseModal();
  });
  document.getElementById("tpl-source-set")?.addEventListener("click", () => openCatalogSourceEditor(bar));
}

function openCatalogSourceEditor(bar: HTMLElement): void {
  const cur = templateSource();
  let pickedDir = cur.kind === "local" ? cur.dir : "";
  const curUrl = cur.kind === "url" || cur.kind === "gdrive" ? cur.url : "";
  const curKey = cur.kind === "gdrive" ? cur.apiKey : "";
  const localOpt = isTauri()
    ? `<option value="local"${cur.kind === "local" ? " selected" : ""}>A folder on this computer</option>`
    : "";
  bar.innerHTML =
    `<span class="tpl-source-label">Open models from:</span>
     <select id="tpl-kind" class="tpl-source-input">
       <option value="default"${cur.kind === "default" ? " selected" : ""}>Wadi sample homes (default)</option>
       <option value="bundled"${cur.kind === "bundled" ? " selected" : ""}>Bundled with the app</option>
       ${localOpt}
       <option value="url"${cur.kind === "url" ? " selected" : ""}>A web address (R2 / jsDelivr)</option>
       <option value="gdrive"${cur.kind === "gdrive" ? " selected" : ""}>A Google Drive folder</option>
     </select>
     <span id="tpl-fields"></span>
     <button type="button" class="tpl-source-btn" id="tpl-source-save">Save</button>
     <button type="button" class="tpl-source-btn" id="tpl-source-cancel">Cancel</button>`;
  const kindSel = document.getElementById("tpl-kind") as HTMLSelectElement;
  const fields = document.getElementById("tpl-fields")!;

  const renderFields = () => {
    const kind = kindSel.value;
    if (kind === "url") {
      fields.innerHTML = `<input type="text" id="tpl-url" class="tpl-source-input"
          placeholder="https://your-host/…" value="${escapeHtml(curUrl)}" />`;
    } else if (kind === "gdrive") {
      fields.innerHTML =
        `<input type="text" id="tpl-url" class="tpl-source-input" placeholder="Drive folder share link"
                value="${escapeHtml(curUrl)}" />
         <input type="text" id="tpl-key" class="tpl-source-input" placeholder="Google Drive API key"
                value="${escapeHtml(curKey)}" />`;
    } else if (kind === "local") {
      fields.innerHTML =
        `<button type="button" class="tpl-source-btn" id="tpl-pick">Choose folder…</button>
         <span class="tpl-source-label" id="tpl-dir">${escapeHtml(pickedDir || "no folder chosen")}</span>`;
      document.getElementById("tpl-pick")?.addEventListener("click", async () => {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const picked = await open({ directory: true, title: "Choose your models folder" });
        if (typeof picked === "string") {
          pickedDir = picked;
          const dirEl = document.getElementById("tpl-dir");
          if (dirEl) dirEl.textContent = picked;
        }
      });
    } else {
      fields.innerHTML = ""; // default / bundled need no field
    }
  };
  renderFields();
  kindSel.addEventListener("change", renderFields);

  const save = () => {
    const kind = kindSel.value;
    let next: TemplateSource;
    if (kind === "url") {
      const url = (document.getElementById("tpl-url") as HTMLInputElement | null)?.value.trim() ?? "";
      if (!url) return; // nothing to save
      next = { kind: "url", url };
    } else if (kind === "gdrive") {
      const url = (document.getElementById("tpl-url") as HTMLInputElement | null)?.value.trim() ?? "";
      const apiKey = (document.getElementById("tpl-key") as HTMLInputElement | null)?.value.trim() ?? "";
      if (!url) return;
      next = { kind: "gdrive", url, apiKey };
    } else if (kind === "local") {
      if (!pickedDir) return; // need a folder
      next = { kind: "local", dir: pickedDir };
    } else if (kind === "bundled") {
      next = { kind: "bundled" };
    } else {
      next = { kind: "default" };
    }
    setTemplateSource(next);
    resetCatalogSource();
    thumbCache.clear();
    void openNewHouseModal();
  };
  document.getElementById("tpl-source-save")?.addEventListener("click", save);
  document.getElementById("tpl-source-cancel")?.addEventListener("click", () => renderCatalogSourceBar());
}

// Distinct non-placeholder values of a meta field across the loaded templates.
function distinctMeta(key: "style" | "roof"): string[] {
  const set = new Set<string>();
  for (const t of galleryTemplates) {
    const v = t.meta?.[key];
    if (v && v !== "—") set.add(v);
  }
  return [...set].sort();
}

// Build the filter controls from the loaded templates' meta. Re-invoked on
// reset so the DOM inputs reflect the (now-default) filter state.
function buildTemplateFilterBar(): void {
  const bar = document.getElementById("new-house-modal-filters");
  if (!bar) return;

  const opt = (value: string, label: string, sel: boolean) =>
    `<option value="${escapeHtml(value)}"${sel ? " selected" : ""}>${escapeHtml(label)}</option>`;
  const minSel = (id: string, label: string, cur: number, max: number) => {
    let opts = opt("0", "Any", cur === 0);
    for (let i = 1; i <= max; i++) opts += opt(String(i), `${i}+`, cur === i);
    return `<div class="tpl-filter"><label for="${id}">${label}</label><select id="${id}">${opts}</select></div>`;
  };
  const enumSel = (id: string, label: string, cur: string, values: string[]) => {
    let opts = opt("", "Any", cur === "");
    for (const v of values) opts += opt(v, v, cur === v);
    return `<div class="tpl-filter"><label for="${id}">${label}</label><select id="${id}">${opts}</select></div>`;
  };
  // Floors: exact (1 / 2 / 3), plus Any.
  const floorMax = Math.max(1, ...galleryTemplates.map((t) => t.meta?.floors ?? 1));
  let floorOpts = opt("0", "Any", tplFilters.floors === 0);
  for (let i = 1; i <= floorMax; i++)
    floorOpts += opt(String(i), i === 1 ? "1 floor" : `${i} floors`, tplFilters.floors === i);

  bar.innerHTML =
    minSel("tpl-f-bed", "Bedrooms", tplFilters.bedrooms, 4) +
    minSel("tpl-f-bath", "Bathrooms", tplFilters.bathrooms, 3) +
    `<div class="tpl-filter"><label for="tpl-f-floors">Floors</label><select id="tpl-f-floors">${floorOpts}</select></div>` +
    enumSel("tpl-f-style", "Style", tplFilters.style, distinctMeta("style")) +
    enumSel("tpl-f-roof", "Roof", tplFilters.roof, distinctMeta("roof")) +
    `<div class="tpl-filter"><label>My plot (ft)</label><div class="tpl-filter-plot">
        <input id="tpl-f-plotw" type="number" min="1" placeholder="W" value="${tplFilters.plotW ?? ""}" />
        <span>×</span>
        <input id="tpl-f-plotl" type="number" min="1" placeholder="L" value="${tplFilters.plotL ?? ""}" />
      </div></div>` +
    `<span class="tpl-filters-count" id="tpl-filters-count"></span>` +
    `<button type="button" class="tpl-filters-reset" id="tpl-filters-reset">Reset</button>`;

  const num = (id: string) => document.getElementById(id) as HTMLSelectElement | null;
  const inp = (id: string) => document.getElementById(id) as HTMLInputElement | null;
  num("tpl-f-bed")?.addEventListener("change", (e) => {
    tplFilters.bedrooms = Number((e.target as HTMLSelectElement).value);
    renderTemplateCards();
  });
  num("tpl-f-bath")?.addEventListener("change", (e) => {
    tplFilters.bathrooms = Number((e.target as HTMLSelectElement).value);
    renderTemplateCards();
  });
  num("tpl-f-floors")?.addEventListener("change", (e) => {
    tplFilters.floors = Number((e.target as HTMLSelectElement).value);
    renderTemplateCards();
  });
  num("tpl-f-style")?.addEventListener("change", (e) => {
    tplFilters.style = (e.target as HTMLSelectElement).value;
    renderTemplateCards();
  });
  num("tpl-f-roof")?.addEventListener("change", (e) => {
    tplFilters.roof = (e.target as HTMLSelectElement).value;
    renderTemplateCards();
  });
  const readPlot = () => {
    const w = parseFloat(inp("tpl-f-plotw")?.value ?? "");
    const l = parseFloat(inp("tpl-f-plotl")?.value ?? "");
    tplFilters.plotW = Number.isFinite(w) && w > 0 ? w : null;
    tplFilters.plotL = Number.isFinite(l) && l > 0 ? l : null;
    renderTemplateCards();
  };
  inp("tpl-f-plotw")?.addEventListener("input", readPlot);
  inp("tpl-f-plotl")?.addEventListener("input", readPlot);
  document.getElementById("tpl-filters-reset")?.addEventListener("click", () => {
    tplFilters = emptyFilters();
    buildTemplateFilterBar();
    renderTemplateCards();
  });
}

// Does a template satisfy the active filters?
function templatePasses(t: TemplateEntry): boolean {
  const m = t.meta;
  const f = tplFilters;
  if (f.bedrooms > 0 && (m?.bedrooms ?? 0) < f.bedrooms) return false;
  if (f.bathrooms > 0 && (m?.bathrooms ?? 0) < f.bathrooms) return false;
  if (f.floors > 0 && (m?.floors ?? 1) !== f.floors) return false;
  if (f.style && (m?.style ?? "") !== f.style) return false;
  if (f.roof && (m?.roof ?? "") !== f.roof) return false;
  // Plot fit: the template's minimum footprint must not exceed the owner's
  // plot. A missing min is treated as "fits anything" (0).
  if (f.plotW !== null && (m?.minWidthFt ?? 0) > f.plotW) return false;
  if (f.plotL !== null && (m?.minLengthFt ?? 0) > f.plotL) return false;
  return true;
}

// Render the filtered card grid. The "Blank plot" starter is hidden when browsing
// Wadi's sample homes (you're choosing a finished home, not an empty slab); it
// shows when you're browsing your own models location.
function renderTemplateCards(): void {
  const grid = document.getElementById("new-house-modal-grid");
  if (!grid) return;
  const hideBlank = templateSource().kind === "default";
  const matches = galleryTemplates.filter(
    (t) => (!hideBlank || t.id !== "blank") && templatePasses(t),
  );

  const countEl = document.getElementById("tpl-filters-count");
  if (countEl) {
    const n = matches.length;
    countEl.textContent = `${n} home${n === 1 ? "" : "s"}`;
  }

  grid.innerHTML = "";
  if (matches.length === 0) {
    grid.innerHTML =
      `<div class="new-house-modal-empty">No homes match these filters. Try widening your plot size or clearing a filter.</div>`;
    return;
  }

  for (const t of matches) {
    const card = document.createElement("div");
    card.className = "template-card";
    card.innerHTML = `
      <div class="template-card-thumb"><span class="thumb-placeholder">🏠</span></div>
      <div class="template-card-body">
        <div class="template-card-title">${escapeHtml(t.title)}</div>
        <div class="template-card-desc">${escapeHtml(t.description)}</div>
        ${templateMetaChips(t.meta)}
      </div>`;
    card.addEventListener("click", () => void selectTemplate(t));
    grid.appendChild(card);
    void loadTemplateThumb(t, card.querySelector(".template-card-thumb") as HTMLElement);
  }
}

// Encode fetched image bytes as a data URL for an <img src>, MIME by extension.
function bytesToImgUrl(bytes: Uint8Array, path: string): string {
  const mime = /\.jpe?g$/i.test(path)
    ? "image/jpeg"
    : /\.webp$/i.test(path)
      ? "image/webp"
      : "image/png";
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(bin)}`;
}

// Lazily fetch a template's preview image(s): the rich catalog's loose cover when
// present, else the file's own previews (a bundle's cover files, or a legacy
// config's embedded `thumbnails[]`). Build a mini carousel in the card. Cached
// per file so re-filtering is free. Silent on failure — the 🏠 placeholder stays.
async function loadTemplateThumb(t: TemplateEntry, thumbEl: HTMLElement | null): Promise<void> {
  if (!thumbEl) return;
  const file = t.file;
  let images = thumbCache.get(file);
  if (images === undefined) {
    // Fast path: a loose cover image named by the rich catalog.json index — one
    // small fetch, no bundle download (works across sources via the same adapter
    // dispatch). The loose covers are generated + uploaded to R2 by
    // publish-templates.sh; if one is missing (e.g. the committed bundled
    // fallback, where covers aren't tracked) we fall back to the bundle's own
    // cover file, which always ships inside the .wadi.
    if (t.cover) {
      try {
        const bytes = await fetchCatalogBytes(t.cover);
        images = [bytesToImgUrl(bytes, t.cover)];
      } catch {
        /* loose cover unavailable → fall back to the file's own previews */
      }
    }
    if (images === undefined) {
      try {
        const bytes = await fetchCatalogBytes(file);
        if (isWadiBundle(bytes)) {
          // A bundle's previews are files; resolve the cover (+ any others).
          images = await readBundleCoverUrls(bytes);
        } else {
          const raw = JSON.parse(new TextDecoder().decode(bytes)) as {
            thumbnails?: unknown;
            thumbnail?: unknown;
          };
          images = Array.isArray(raw.thumbnails)
            ? raw.thumbnails.filter((x): x is string => typeof x === "string")
            : typeof raw.thumbnail === "string"
              ? [raw.thumbnail]
              : [];
        }
      } catch {
        images = [];
      }
    }
    thumbCache.set(file, images);
  }
  if (images.length > 0 && thumbEl.isConnected) buildTemplateCarousel(thumbEl, images, t.title);
}

// Build an in-card carousel (dots + arrows when >1) with a magnify button that
// opens the full-screen lightbox. All controls stopPropagation so they don't
// trigger the card's select-template click.
function buildTemplateCarousel(thumbEl: HTMLElement, images: string[], title: string): void {
  let idx = 0;
  thumbEl.classList.add("has-carousel");
  const render = () => {
    const dots =
      images.length > 1
        ? `<div class="tpl-dots">${images
            .map((_, i) => `<span class="tpl-dot${i === idx ? " on" : ""}"></span>`)
            .join("")}</div>`
        : "";
    const arrows =
      images.length > 1
        ? `<button class="tpl-arrow tpl-prev" aria-label="Previous">‹</button>
           <button class="tpl-arrow tpl-next" aria-label="Next">›</button>`
        : "";
    thumbEl.innerHTML = `
      <img src="${images[idx]}" alt="${escapeHtml(title)} preview ${idx + 1}" loading="lazy" />
      <button class="tpl-magnify" aria-label="View larger">⤢</button>
      ${arrows}${dots}`;
    const stop = (fn: () => void) => (e: Event) => {
      e.stopPropagation();
      fn();
    };
    thumbEl.querySelector(".tpl-prev")?.addEventListener(
      "click",
      stop(() => {
        idx = (idx - 1 + images.length) % images.length;
        render();
      }),
    );
    thumbEl.querySelector(".tpl-next")?.addEventListener(
      "click",
      stop(() => {
        idx = (idx + 1) % images.length;
        render();
      }),
    );
    thumbEl.querySelector(".tpl-magnify")?.addEventListener(
      "click",
      stop(() => openTemplateLightbox(images, idx, title)),
    );
  };
  render();
}

// Full-screen lightbox to flip through a template's preview images at size —
// the clearest way for an owner to read the layout.
function openTemplateLightbox(images: string[], start: number, title: string): void {
  let idx = start;
  const overlay = document.createElement("div");
  overlay.className = "tpl-lightbox";
  const draw = () => {
    overlay.innerHTML = `
      <div class="tpl-lb-inner">
        <img src="${images[idx]}" alt="${escapeHtml(title)} preview ${idx + 1}" />
        ${images.length > 1
          ? `<button class="tpl-lb-arrow tpl-lb-prev" aria-label="Previous">‹</button>
             <button class="tpl-lb-arrow tpl-lb-next" aria-label="Next">›</button>
             <div class="tpl-lb-count">${idx + 1} / ${images.length}</div>`
          : ""}
        <button class="tpl-lb-close" aria-label="Close">✕</button>
      </div>`;
    overlay.querySelector(".tpl-lb-prev")?.addEventListener("click", (e) => {
      e.stopPropagation();
      idx = (idx - 1 + images.length) % images.length;
      draw();
    });
    overlay.querySelector(".tpl-lb-next")?.addEventListener("click", (e) => {
      e.stopPropagation();
      idx = (idx + 1) % images.length;
      draw();
    });
    overlay.querySelector(".tpl-lb-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
    });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft" && images.length > 1) {
      idx = (idx - 1 + images.length) % images.length;
      draw();
    } else if (e.key === "ArrowRight" && images.length > 1) {
      idx = (idx + 1) % images.length;
      draw();
    }
  };
  const close = () => {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  };
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  draw();
  document.body.appendChild(overlay);
}

function closeNewHouseModal(): void {
  const modal = document.getElementById("new-house-modal");
  if (modal) modal.style.display = "none";
}

// Open an existing .wadi from local disk — same picker + Zod validation the
// architect's Load button uses, exposed to owners too (from the gallery) so a
// returning owner can reopen their saved design instead of starting fresh.
// Returns true on a successful load.
async function openExistingFromDisk(): Promise<boolean> {
  try {
    if (!(await guardUnsaved("opening another model"))) return false;
    const res = await pickAndLoadConfig();
    useConfigStore.getState().loadConfig(res.config, res.filename, res.filePath, res.wdl);
    markHomeChosen();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg !== "Cancelled") alert(`Load failed: ${msg}`);
    return false;
  }
}

// Load a house from a File the user DROPPED on the app. This is the reliable path
// on iPadOS, where Safari's document picker greys out a custom `.wadi` (no UTI it
// can match) — a file dragged from the Files app arrives via dataTransfer.files
// with no such filtering, so any extension works. Also works in desktop browsers.
async function loadDroppedFile(file: File): Promise<void> {
  try {
    if (!(await guardUnsaved("opening another model"))) return;
    // Read as BYTES so a `.wadi` zip bundle is detected by its magic bytes;
    // parseConfigBytes handles both the bundle and a legacy JSON `.wadi`.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const res = await parseConfigBytes(bytes, file.name || "dropped.wadi");
    useConfigStore.getState().loadConfig(res.config, res.filename, res.filePath, res.wdl);
    markHomeChosen();
  } catch (e) {
    alert(`Couldn\u2019t load "${file.name}": ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Whole-window drag-and-drop to load a .wadi. Shows a drop overlay while a file is
// dragged over the page and loads the first file dropped. Works in desktop
// Always-on WDL editor pane. WDL is Wadi's native source: the model always carries
// its .wdl, and this pane lets a human edit it directly — compile-on-edit (debounced
// + ⌘/Ctrl+Enter), the 3D re-renders, and compile/structural errors show inline.
// WDL is kept as the SOURCE (loadConfig(..., src) preserves the author's exact text
// rather than re-decompiling). Injected into #viewer-container as a right-side pane,
// so it works in every persona; hidden in the embedded ?panels=off surface.
function wireWdlEditor(): void {
  const container = document.getElementById("viewer-container");
  if (!container || document.getElementById("viewer-wdl")) return;

  const style = document.createElement("style");
  style.textContent = `
    #viewer-wdl { width: 460px; max-width: 46vw; flex: none; display: flex; flex-direction: column;
      background: #0b1220; color: #e2e8f0; border-left: 1px solid #1e293b; }
    body[data-wdl="off"] #viewer-wdl { display: none; }
    #viewer-wdl .wdl-head { flex: none; display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; background: #111827; border-bottom: 1px solid #1e293b; font: 600 13px system-ui, sans-serif; }
    #viewer-wdl .wdl-head .sub { color: #94a3b8; font-weight: 400; font-size: 11px; margin-left: 8px; }
    #viewer-wdl textarea { flex: 1 1 auto; min-height: 0; resize: none; border: none; outline: none;
      background: #0b1220; color: #e2e8f0; font: 13px/1.55 ui-monospace, Menlo, Consolas, monospace;
      padding: 12px 14px; tab-size: 2; white-space: pre; overflow: auto; }
    #viewer-wdl .wdl-foot { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 12px;
      border-top: 1px solid #1e293b; background: #0d1526; }
    #viewer-wdl .wdl-apply { flex: none; background: #2563eb; color: #fff; border: none; border-radius: 7px;
      padding: 7px 14px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
    #viewer-wdl .wdl-apply:disabled { background: #1e293b; color: #64748b; cursor: default; }
    #viewer-wdl .wdl-apply .k { opacity: .7; font-weight: 400; margin-left: 5px; }
    body[data-wdl-dirty="on"] #viewer-wdl .wdl-apply { box-shadow: 0 0 0 2px rgba(37,99,235,.35); }
    #viewer-wdl .wdl-status { flex: 1 1 auto; min-width: 0; font: 12px/1.4 ui-monospace, monospace;
      max-height: 5.6em; overflow: auto; white-space: pre-wrap; color: #94a3b8; }
    #viewer-wdl .wdl-status.ok { color: #4ade80; } #viewer-wdl .wdl-status.warn { color: #fbbf24; }
    #viewer-wdl .wdl-status.err { color: #f87171; } #viewer-wdl .wdl-status.busy { color: #93c5fd; }
    #viewer-wdl .wdl-status.dirty { color: #93c5fd; }
    #viewer-wdl .wdl-btn { background: none; border: 1px solid #334155; color: #cbd5e1; border-radius: 6px;
      padding: 2px 9px; cursor: pointer; font: inherit; }
    #wdl-reopen { position: absolute; top: 60px; right: 0; z-index: 6; background: #111827; color: #e2e8f0;
      border: 1px solid #1e293b; border-right: none; border-radius: 8px 0 0 8px; padding: 6px 11px; cursor: pointer;
      font: 600 12px system-ui, sans-serif; display: none; }
    body[data-wdl="off"] #wdl-reopen { display: block; }`;
  document.head.appendChild(style);

  const aside = document.createElement("aside");
  aside.id = "viewer-wdl";
  aside.setAttribute("aria-label", "WDL source");
  aside.innerHTML =
    `<div class="wdl-head"><span>WDL <span class="sub">the model's source · ⌘↵ to apply</span></span>` +
    `<button class="wdl-btn" id="wdl-hide" title="Hide the WDL pane">Hide ⟩</button></div>` +
    `<textarea id="wdl-editor" spellcheck="false" placeholder="house House { … }"></textarea>` +
    `<div class="wdl-foot">` +
    `<button class="wdl-apply" id="wdl-apply" disabled>Apply changes<span class="k">⌘↵</span></button>` +
    `<span class="wdl-status" id="wdl-status"></span></div>`;
  container.appendChild(aside);

  const reopen = document.createElement("button");
  reopen.id = "wdl-reopen";
  reopen.textContent = "⟨ WDL";
  container.appendChild(reopen);

  // Always-on for humans; hidden in the embedded/agent surface (?panels=off).
  const embedded = new URLSearchParams(window.location.search).get("panels") === "off";
  document.body.dataset.wdl = embedded ? "off" : "on";

  // The 3D canvas measured the full width before this pane shrank the content
  // area. Refit it whenever the content area's size changes (pane toggled, window
  // resized, canvas mounted late) — the R3F view re-measures on a window resize.
  // A ResizeObserver makes this robust to timing (fixed timeouts missed the late
  // canvas mount). No feedback loop: the canvas resizing doesn't change the
  // content area's own size (the pane is fixed width).
  const refit = (): void => { window.dispatchEvent(new Event("resize")); };
  const contentArea = document.getElementById("viewer-content-area");
  if (contentArea && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(refit).observe(contentArea);
  }
  // The R3F canvas can mount AFTER the pane reflow with the default 300x150 size;
  // a window resize makes it re-measure. Nudge until it's actually sized (or give
  // up after ~3s), which is robust to the canvas mounting late.
  let tries = 0;
  const kick = (): void => {
    refit();
    const c = document.querySelector("#view-3d canvas") as HTMLElement | null;
    if ((!c || c.clientWidth < 50) && tries++ < 20) window.setTimeout(kick, 150);
  };
  window.setTimeout(kick, 80);

  const ta = document.getElementById("wdl-editor") as HTMLTextAreaElement;
  const status = document.getElementById("wdl-status") as HTMLElement;
  const applyBtn = document.getElementById("wdl-apply") as HTMLButtonElement;
  const setStatus = (cls: string, msg: string): void => { status.className = "wdl-status " + cls; status.textContent = msg; };

  // `applied` = the WDL currently realized in the 3D model. The editor is DIRTY
  // when its text differs. Changes are applied ONLY on demand (the Apply button or
  // ⌘/Ctrl+Enter) — never automatically — so a half-typed edit never compiles.
  let applied = useConfigStore.getState().wdl ?? "";
  const isDirty = (): boolean => ta.value !== applied;
  const reflectDirty = (): void => {
    const dirty = isDirty();
    applyBtn.disabled = !dirty;
    document.body.dataset.wdlDirty = dirty ? "on" : "off";
    if (dirty) setStatus("dirty", "Unapplied changes — Apply (⌘↵) to update the 3D.");
    else if (status.classList.contains("dirty")) setStatus("", "");
  };

  // Adopt the model's WDL when it changes from ELSEWHERE (a template load, undo) —
  // but never clobber the user's in-progress edits.
  const syncFromStore = (): void => {
    const wdl = useConfigStore.getState().wdl ?? "";
    if (wdl === applied || isDirty()) return;
    ta.value = wdl; applied = wdl; setStatus("", ""); reflectDirty();
  };
  useConfigStore.subscribe(syncFromStore);
  ta.value = applied; reflectDirty();

  const apply = async (): Promise<void> => {
    const src = ta.value;
    setStatus("busy", "Compiling…");
    const res = await wdlToConfig(src);
    if (!res.ok || !res.config) { setStatus("err", "✖ " + res.errors.join("\n")); return; }
    const st = useConfigStore.getState();
    // WDL is the SOURCE: keep the author's exact text (don't re-decompile).
    st.loadConfig(res.config, st.filename ?? undefined, st.filePath, src);
    markHomeChosen();
    applied = src; reflectDirty();
    // The scene renders on demand, and Apply is a click/keydown, but force the
    // repaint anyway (now + next frame) so the new model paints immediately.
    window.wadiInvalidate?.();
    requestAnimationFrame(() => window.wadiInvalidate?.());
    const chk = checkBrief(useConfigStore.getState().config);
    if (!chk.ok) setStatus("err", `✖ ${chk.summary}\n` + (chk.error_messages ?? []).join("\n"));
    else if (chk.warnings) setStatus("warn", `⚠ ${chk.summary}\n` + (chk.warning_messages ?? []).join("\n"));
    else setStatus("ok", "✓ Applied — no structural issues.");
  };

  ta.addEventListener("input", reflectDirty);
  ta.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (isDirty()) void apply(); }
  });
  applyBtn.onclick = () => { void apply(); };

  (document.getElementById("wdl-hide") as HTMLElement).onclick = () => { document.body.dataset.wdl = "off"; refit(); };
  reopen.onclick = () => { document.body.dataset.wdl = "on"; syncFromStore(); refit(); };
}

// browsers and iPadOS (a file dragged from the Files app arrives here regardless
// of extension, unlike the picker).
function wireFileDrop(): void {
  if (typeof window === "undefined") return;
  const hasFiles = (e: DragEvent): boolean =>
    !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");

  let overlay: HTMLElement | null = null;
  const show = (): void => {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:100000;background:rgba(37,99,235,.12);" +
      "display:flex;align-items:center;justify-content:center;pointer-events:none;";
    overlay.innerHTML =
      '<div style="background:#fff;color:#1e3a8a;border:3px dashed #2563eb;border-radius:16px;' +
      'padding:28px 40px;font:600 18px system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.25);">' +
      '\u2b07\ufe0e Drop your .wadi file to open it</div>';
    document.body.appendChild(overlay);
  };
  const hide = (): void => { overlay?.remove(); overlay = null; };

  let depth = 0;
  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth += 1;
    show();
  });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    depth -= 1;
    if (depth <= 0) { depth = 0; hide(); }
  });
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    hide();
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadDroppedFile(file);
  });
}

// Owner welcome/empty state: `body[data-home-chosen]` gates the #owner-welcome
// overlay so a fresh owner never lands on a model they didn't pick. Flipped to
// "yes" once they choose a template, open a file, or enter architect mode.
function markHomeChosen(): void {
  document.body.dataset.homeChosen = "yes";
}

function wireOwnerWelcome(): void {
  document
    .getElementById("ow-choose")
    ?.addEventListener("click", () => void openNewHouseModal());
  document
    .getElementById("ow-open")
    ?.addEventListener("click", () => void openExistingFromDisk());
}

async function selectTemplate(t: TemplateEntry): Promise<void> {
  // Loading a template replaces the current house — offer to save first.
  if (!(await guardUnsaved("creating a new house"))) return;
  try {
    // Files are named relative to the catalog base (local folder / cloud bucket /
    // Drive). Read as BYTES so a `.wadi` zip bundle is detected and compiled from
    // its model.wdl; a legacy JSON `.wadi` validates as before. parseWadiBytes
    // returns the model + (for a bundle) its WDL source and thumbnail files.
    const bytes = await fetchCatalogBytes(t.file);
    const loaded = await parseConfigBytes(bytes, t.file);
    useConfigStore
      .getState()
      .loadConfig(loaded.config, `${t.title} (template)`, null, loaded.wdl);
    markHomeChosen();
    // Clear undo history so the freshly-loaded template becomes the new
    // baseline — Ctrl+Z shouldn't revert to the pre-template state.
    useConfigStore.temporal.getState().clear();
    closeNewHouseModal();
  } catch (e) {
    alert(`Failed to load template: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Expose so the modal's inline onclick handlers (backdrop, ✕) can call it.
declare global {
  interface Window {
    closeNewHouseModal?: () => void;
  }
}
window.closeNewHouseModal = closeNewHouseModal;

// PWA (web only): register the service worker (offline support + a startup
// cache-warm) and show the in-app "Install app" button. Both are guarded to a
// secure browser context and skip the Tauri desktop app — see ./pwa.
registerServiceWorker();
setupInstallPrompt();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootViewer();
  });
} else {
  void bootViewer();
}
