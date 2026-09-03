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
  pickAndReadWdl,
  saveConfig,
  saveText,
  saveBinary,
} from "../io/fileIO";
import {
  supportsDirectoryPicker,
  pickModelsDirectory,
  restoreModelsDirectory,
  modelsDirName,
  modelsDirNeedsPermission,
  reconnectModelsDir,
  adoptModelsDirFile,
} from "../io/fsAccess";
import { wdlToConfig, configToWdlText } from "../io/wdl";
import { summarizeStaircase } from "../svg2d/stairSummary";
import { isTauri, invoke } from "@tauri-apps/api/core";
import {
  fetchCatalogBytes,
  loadCatalog,
  listCatalogFiles,
  entryFromBundleBytes,
  templateSource,
  setTemplateSource,
  resetCatalogSource,
  localCatalogFilePath,
  withSource,
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
const WDL_PANEL_KEY = "wadi:wdl-panel";

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

  // Restore a browser models FOLDER (File System Access) picked in a prior session
  // so its name shows in the gallery bar; permission is re-granted on first use.
  void restoreModelsDirectory();

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
  // Push user WDL edits to a live co-editing session when one is active (Phase 2).
  wireLiveSessionSync();
  // Expose the 2D capture bridges (architect "take a shot" + auto floor plan).
  wireCaptureBridges();
  // Surface geometry warnings (invalid openings dropped during expansion)
  // as a banner instead of silently blanking the 3D model.
  wireGeometryWarnings();
  // A small always-visible chip that shows the model's structural check even when
  // the WDL editor / configurator panels are hidden (e.g. during agent editing).
  wireIssuesChip();

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
    void openNewModal();
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
    useConfigStore.getState().loadConfig(res.config, res.filename, res.filePath, res.wdl, res.modules);
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
  // Unapplied WDL-editor edits don't mark the STORE dirty (they change no config
  // until Apply), so also guard on the WDL editor's own dirty flag — otherwise a
  // New/Open/Close would silently drop them.
  const wdlDirty = document.body.dataset.wdlDirty === "on";
  if ((!st.dirty && !wdlDirty) || !st.config) return true;
  const choice = await confirmUnsaved(actionLabel);
  if (choice === "cancel") return false;
  if (choice === "discard") return true;
  if (!(await flushWdlBeforeSave())) return false;
  try {
    const saved = await saveConfig(st.config, st.filePath, st.filename ?? undefined, st.wdl, st.modules);
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
    // WebMCP tool descriptors — also registered via navigator.modelContext when
    // the browser supports WebMCP. Exposed for inspection/testing/demo.
    wadiMcpTools?: WebMcpTool[];
    // Force a (re)registration of the WebMCP tools now — handy to call from a
    // browser agent's console if the API attached late. Returns true if registered.
    wadiRegisterMcp?: () => boolean;
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
  /** Read a template's .wdl WITHOUT loading it — study an example without
   *  disturbing the user's current live model. */
  getTemplateWdl: (id: string) => Promise<string>;
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
  /** Show/hide both side panels (configurator + WDL editor) so the 3D model has the
   *  full surface. Auto-called (hidden) on agent edits; call with `true` to reveal. */
  setPanels: (visible: boolean) => { ok: true; visible: boolean };
  /** The current live model decompiled to editable .wdl text. */
  getWdl: () => Promise<string>;
  /** Compile-check .wdl WITHOUT loading it (dry run) — returns errors or ok. */
  checkWdl: (wdl: string) => Promise<unknown>;
  // --- Component modules: the custom `.wdl` files the model imports. They travel
  // INSIDE the saved .wadi, so registering one here makes an `import "ref"` in the
  // main WDL resolve and keeps the model self-contained. Inbuilt packs (furniture,
  // konkan) are always available and are NOT listed/stored here. ---
  /** The custom modules currently registered (import ref + source size). */
  listModules: () => Array<{ ref: string; chars: number }>;
  /** Register (or replace) a component module by its import ref, then recompile the
   *  live model so an `import "ref"` resolves. Returns the structural check. */
  addModule: (ref: string, wdl: string) => Promise<unknown>;
  /** Remove a custom module and recompile. */
  removeModule: (ref: string) => Promise<unknown>;
  /** A self-contained primer for an AI agent driving this page: the window.wadi
   *  authoring loop plus the .wdl syntax. Call this first, then follow it. */
  help: () => string;
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
  registerTool: (tool: WebMcpTool, opts?: { signal?: AbortSignal }) => Promise<void> | void;
  // Some builds also expose a declarative bulk form; used as a fallback.
  provideContext?: (ctx: { tools: WebMcpTool[] }) => void;
  getTools?: () => unknown[];
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

// Geometry warnings emitted by House3D's lenient expansion (skipped openings, bad
// walls) surface in two places, both fed by the `wadi-geometry-warnings` event:
//   1. a one-time transient banner — a nudge when a NEW issue set appears (here);
//   2. the WDL editor's compile-status panel — lists the current issues (wired in
//      wireWdlEditor, listening to the same event).
// The old always-visible header chip + floating panel are retired. The warning set
// is republished on every re-expand, so both surfaces reflect the CURRENT model.
function wireGeometryWarnings(): void {
  let lastBannerKey = "";
  const onWarnings = (warnings: string[]) => {
    // One-time banner when a NEW non-empty set appears (not on every re-render).
    const key = warnings.join("\n");
    if (warnings.length && key !== lastBannerKey) {
      const head =
        warnings.length === 1
          ? warnings[0]
          : `${warnings.length} geometry issues — ${warnings[0]}`;
      showBanner(
        `⚠ ${head} The affected wall is shown solid (openings skipped) until you fix it. Open the WDL editor's status (⚠) to review all issues.`,
      );
    }
    lastBannerKey = key;
  };
  window.addEventListener("wadi-geometry-warnings", (e) =>
    onWarnings((e as CustomEvent<string[]>).detail ?? []),
  );
  // Catch-up: House3D's first render dispatches its warning event during
  // mountViewer3D, before this listener attaches — seed from what it stored.
  const stored = (window as unknown as { __geometryWarnings?: string[] }).__geometryWarnings;
  onWarnings(stored ?? []);
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
      if (item.id === "apps-item-agent") {
        void copyAgentPrompt();
        return; // keep the menu open long enough to show the "Copied" cue
      }
      if (item.id === "apps-item-coedit") {
        setOpen(false);
        startLiveSession();
        return;
      }
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

// The prompt copied by the "Use with your AI agent" menu item. One prompt that works
// for any kind of agent: it tells the agent to first work out how much access it has to
// wadi.house and then take the best of four paths (WebMCP tools, the window.wadi JS API,
// clicking the UI like a person, or, with no page access, just writing .wdl for the user
// to paste). The detailed per-path instructions still come from the app (help() / llms.txt),
// so the copied text stays short.
const AGENT_PROMPT =
  "You are helping someone design a house on wadi.house, a live 3D home designer. " +
  "Wadi houses are written in a small text design language called .wdl. Start from a ready-made " +
  "home and customize it for the user; do not build a whole house from scratch (full houses are " +
  "hard to get right: wall alignment across floors, roof sizing, cantilever support, plinth, staircase).\n" +
  "\n" +
  "FIRST work out how much access you have to the page, then take the best path you can:\n" +
  "1) WebMCP TOOLS (best). If you have tools named wadi_* (wadi_list_homes, wadi_get_wdl, " +
  "wadi_set_wdl, ...), use them. Start with wadi_wdl_reference.\n" +
  "2) JAVASCRIPT on the page. If you can run JS in the page but have no wadi_* tools, use the " +
  "window.wadi API: run `await window.wadi.help()` and follow it (listTemplates, chooseTemplate(id), " +
  "getWdl, setWdl(newWdl) which returns compile errors + a structural check, captureView).\n" +
  "3) BROWSER UI ONLY (you can see and click the page but not run code, e.g. Gemini in Chrome). " +
  "Drive it like a person: open the apps / \"Choose your home\" menu and load the closest home; " +
  "click the vertical \"WDL\" tab on the right edge to open the WDL panel; edit the .wdl text shown " +
  "there (or paste new .wdl); click \"Apply changes\" (Cmd/Ctrl+Enter) and read the status pill for " +
  "errors and warnings; use \"Load .wdl\" / \"Save .wdl\" to open or keep a file.\n" +
  "4) NO PAGE ACCESS (chat only). You cannot touch the app, so WRITE the .wdl for the user to paste. " +
  "Get the syntax and rules from https://wadi.house/llms.txt (if you cannot browse, ask the user to paste " +
  "that page in), produce a complete .wdl, then tell the user: open wadi.house, click the \"WDL\" tab on the " +
  "right, paste the .wdl in, and click \"Apply changes\" (or use \"Load .wdl\" for a file).\n" +
  "\n" +
  "However you drive it: work ONE STEP AT A TIME. When there is a choice (which home, room sizes, layout, " +
  "roof style, where the stairs go), show 2-3 options and ASK before applying. After each change, read the " +
  "structural warnings and fix them before telling the user it is ready.";

async function copyAgentPrompt(): Promise<void> {
  const sub = document.getElementById("apps-item-agent-sub");
  const original = sub?.textContent ?? "";
  let ok = false;
  try {
    await navigator.clipboard.writeText(AGENT_PROMPT);
    ok = true;
  } catch {
    // Clipboard API can be blocked (permission / insecure context) — fall back to
    // a hidden textarea + execCommand so the copy still works.
    try {
      const ta = document.createElement("textarea");
      ta.value = AGENT_PROMPT;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch {
      ok = false;
    }
  }
  if (sub) {
    sub.textContent = ok ? "Copied — paste into your AI agent" : "Copy failed — select window.wadi.help() manually";
    window.setTimeout(() => { if (sub.textContent?.startsWith("Copied") || sub.textContent?.startsWith("Copy failed")) sub.textContent = original; }, 2600);
  }
}

// ============================================================================
// Live co-editing (Phase 2). The app connects to a session on the hosted relay
// (mcp.wadi.house), pushes the current model in, and RE-RENDERS whenever the agent
// pushes an edit via the wadi_session_set MCP tool — so you watch the design build
// as the agent works. The app keeps owning Save. See plans/remote-mcp-server.md.
// ============================================================================
const MCP_ORIGIN = "https://mcp.wadi.house";

function randomSessionCode(): string {
  // 8 chars from an unambiguous base32 alphabet — the unguessable session capability.
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => abc[n % abc.length]).join("");
}

interface LiveSession {
  code: string;
  ws: WebSocket;
  lastWdl: string; // the last WDL sent OR applied — guards the echo loop
  updates: number;
  connected: boolean;
  error?: string; // set when an agent's pushed WDL fails to load in the app
}
let liveSession: LiveSession | null = null;

const liveSessionPrompt = (code: string): string =>
  `You are connected to a LIVE Wadi co-editing session (wadi.house). Use the Wadi MCP ` +
  `server at ${MCP_ORIGIN}/mcp with session code "${code}": call ` +
  `wadi_session_get({session:"${code}"}) to read the current model, edit the .wdl, and ` +
  `wadi_session_set({session:"${code}", wdl}) to push each change — I am watching it render ` +
  `live in the Wadi app. Call wadi_wdl_reference first if unsure of the syntax.`;

function startLiveSession(): void {
  if (liveSession) return;
  const code = randomSessionCode();
  const ws = new WebSocket(`${MCP_ORIGIN.replace(/^http/, "ws")}/session/${code}/ws`);
  liveSession = { code, ws, lastWdl: "", updates: 0, connected: false };

  ws.addEventListener("open", () => {
    if (!liveSession) return;
    liveSession.connected = true;
    // Seed the session with the current model so the agent can read it.
    const wdl = useConfigStore.getState().wdl;
    if (wdl) { liveSession.lastWdl = wdl; try { ws.send(JSON.stringify({ type: "wdl", wdl })); } catch { /* */ } }
    renderLivePanel();
  });
  ws.addEventListener("message", (evt) => {
    if (!liveSession) return;
    try {
      const msg = JSON.parse(typeof evt.data === "string" ? evt.data : "") as { type?: string; wdl?: string };
      if (msg?.type === "wdl" && typeof msg.wdl === "string" && msg.wdl !== liveSession.lastWdl) {
        liveSession.lastWdl = msg.wdl; // set BEFORE applying so our store subscriber doesn't echo it back
        liveSession.updates++;
        void applyIncomingWdl(msg.wdl);
        renderLivePanel(true);
      }
    } catch { /* ignore malformed frames */ }
  });
  ws.addEventListener("close", () => { if (liveSession) { liveSession.connected = false; renderLivePanel(); } });
  ws.addEventListener("error", () => { if (liveSession) { liveSession.connected = false; renderLivePanel(); } });
  renderLivePanel();
}

// Apply an agent's pushed WDL to the live model; on a compile/schema failure,
// record the error so the panel can show it (instead of silently doing nothing —
// which looks like "agent edited" but no change).
async function applyIncomingWdl(wdl: string): Promise<void> {
  const res = (await window.wadi?.setWdl(wdl)) as { ok?: boolean; errors?: string[] } | undefined;
  if (!liveSession) return;
  liveSession.error = res && res.ok === false
    ? "the agent's edit didn't load: " + (res.errors?.[0] ?? "compile error")
    : undefined;
  renderLivePanel();
}

function stopLiveSession(): void {
  if (!liveSession) return;
  try { liveSession.ws.close(); } catch { /* */ }
  liveSession = null;
  const panel = document.getElementById("live-session-panel");
  if (panel) panel.hidden = true;
}

// Push a user-made WDL change to the session (guarded so an applied incoming edit
// isn't echoed back). Called from the store subscription.
function pushLiveSession(wdl: string): void {
  if (!liveSession || !liveSession.connected) return;
  if (!wdl || wdl === liveSession.lastWdl) return;
  liveSession.lastWdl = wdl;
  try { liveSession.ws.send(JSON.stringify({ type: "wdl", wdl })); } catch { /* */ }
}

function renderLivePanel(flash = false): void {
  const panel = document.getElementById("live-session-panel");
  if (!panel || !liveSession) return;
  panel.hidden = false;
  const status = !liveSession.connected
    ? "connecting…"
    : liveSession.updates > 0
      ? `agent edited · ${liveSession.updates} update${liveSession.updates === 1 ? "" : "s"}`
      : "waiting for the agent…";
  const statusHtml = liveSession.error
    ? `<div class="live-status live-error" id="live-status">${escapeHtml(liveSession.error)}</div>`
    : `<div class="live-status" id="live-status">${status}</div>`;
  panel.innerHTML = `
    <div class="live-dot${liveSession.error ? " err" : liveSession.connected ? " on" : ""}"></div>
    <div class="live-body">
      <div class="live-title">Live session <code>${liveSession.code}</code></div>
      ${statusHtml}
    </div>
    <button type="button" id="live-copy" class="live-btn" title="Copy a prompt for your AI agent">Copy prompt</button>
    <button type="button" id="live-stop" class="live-btn live-stop" title="End the live session">Stop</button>`;
  panel.querySelector("#live-copy")?.addEventListener("click", async () => {
    const s = panel.querySelector("#live-status") as HTMLElement | null;
    try { await navigator.clipboard.writeText(liveSessionPrompt(liveSession!.code)); if (s) { const t = s.textContent; s.textContent = "Prompt copied — paste into your agent"; window.setTimeout(() => { if (s.textContent?.startsWith("Prompt copied")) s.textContent = t ?? ""; }, 2400); } } catch { /* */ }
  });
  panel.querySelector("#live-stop")?.addEventListener("click", () => stopLiveSession());
  if (flash) { panel.classList.remove("live-flash"); void panel.offsetWidth; panel.classList.add("live-flash"); }
}

// Push any user-made WDL change to the live session (the echo guard in
// pushLiveSession skips edits that came FROM the session). Registered once.
function wireLiveSessionSync(): void {
  let lastWdl = useConfigStore.getState().wdl;
  useConfigStore.subscribe((state) => {
    if (state.wdl === lastWdl) return;
    lastWdl = state.wdl;
    pushLiveSession(state.wdl);
  });
}

function wireHeaderButtons(): void {
  const btnNew = document.getElementById("btn-new");
  const btnLoad = document.getElementById("btn-load");
  const btnSave = document.getElementById("btn-save");
  const btnSaveAs = document.getElementById("btn-save-as");
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");
  const fileInput = document.getElementById("file-input-json") as HTMLInputElement | null;

  // Apps menu: the companion tools (WDL editor, Floor planner, Staircase
  // explorer). Each opens in its OWN window on desktop (Tauri show_tool) and a
  // new browser tab otherwise, so the studio stays open behind it.
  wireAppsMenu();

  // (Share-as-URL retired — a design is shared by handing over its `.wadi` bundle
  // file: Save/Export the file and send it, or save into a shared library folder.)


  btnNew?.addEventListener("click", () => {
    void openNewModal();
  });


  btnLoad?.addEventListener("click", () => void openMyModelsModal());

  btnSave?.addEventListener("click", async () => {
    if (!(await flushWdlBeforeSave())) return;
    const state = useConfigStore.getState();
    const cfg = state.config;
    if (!cfg) return;
    try {
      const saved = await saveConfig(cfg, state.filePath, state.filename ?? undefined, state.wdl, state.modules);
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
    if (!(await flushWdlBeforeSave())) return;
    const state = useConfigStore.getState();
    const cfg = state.config;
    if (!cfg) return;
    try {
      const saved = await saveConfig(cfg, null, state.filename ?? undefined, state.wdl, state.modules);
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
    if (!btn) return;
    const glyph = document.body.dataset.left === "open" ? "❮" : "❯";
    const arw = btn.querySelector(".lt-arw");
    if (arw) arw.textContent = glyph; else btn.textContent = glyph;
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

// Show/hide BOTH side panels (the configurator dock + the WDL code editor) so the
// 3D model has the whole surface. Used to keep the model visible while an agent
// edits — the WDL code and knobs would otherwise overlap the model, especially in
// a small embedded browser (e.g. ChatGPT's). Hiding it is what preserves the
// "watch the model change" effect; the human toggles (☰ / ❮❯) still work to reopen.
function setViewerPanels(visible: boolean): void {
  if (visible) {
    document.body.dataset.left = "open";
  } else {
    document.body.dataset.wdl = "off";
    document.body.dataset.left = "closed";
  }
  const lbtn = document.getElementById("left-toggle");
  if (lbtn) {
    const g = document.body.dataset.left === "open" ? "❮" : "❯";
    const a = lbtn.querySelector(".lt-arw");
    if (a) a.textContent = g; else lbtn.textContent = g;
  }
  // Re-fit the 3D canvas to the freed width.
  window.dispatchEvent(new Event("resize"));
}

// A small, always-visible chip reporting the current model's structural check
// (errors/warnings). It stays visible even when the WDL editor + configurator
// panels are hidden — which is the default and what agent edits force — so a
// person watching the model still sees the C-warnings an agent's setWdl produced.
// The full messages live inside the (hidden) WDL editor pill; this is the visible
// entry point to them. Hidden entirely when the model is clean.
function wireIssuesChip(): void {
  const style = document.createElement("style");
  style.textContent =
    "#wadi-issues{position:fixed;top:118px;left:50%;transform:translateX(-50%);z-index:40;display:none;" +
    "font:600 12.5px/1.3 system-ui,-apple-system,sans-serif;}" +
    "#wadi-issues[data-state='warn'],#wadi-issues[data-state='err']{display:block;}" +
    "#wadi-issues .chip{display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:999px;" +
    "cursor:pointer;border:1px solid;box-shadow:0 2px 10px rgba(20,15,10,.18);backdrop-filter:blur(8px);white-space:nowrap;}" +
    "#wadi-issues[data-state='warn'] .chip{color:#92610a;background:rgba(251,191,36,.22);border-color:rgba(251,191,36,.6);}" +
    "#wadi-issues[data-state='err'] .chip{color:#b91c1c;background:rgba(248,113,113,.22);border-color:rgba(248,113,113,.6);}" +
    "#wadi-issues .list{display:none;margin:7px auto 0;max-width:min(560px,92vw);max-height:44vh;overflow:auto;" +
    "background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-radius:12px;padding:11px 13px;" +
    "box-shadow:0 10px 34px rgba(20,15,10,.22);white-space:pre-wrap;text-align:left;font-weight:500;}" +
    "#wadi-issues.open .list{display:block;}" +
    "@media (prefers-color-scheme:dark){#wadi-issues .list{background:#0f172a;color:#e2e8f0;border-color:#1e293b;}}";
  document.head.appendChild(style);

  const el = document.createElement("div");
  el.id = "wadi-issues";
  el.innerHTML =
    "<div class='chip' role='button' tabindex='0'><span class='g'></span><span class='t'></span>" +
    "<span style='opacity:.6'>▾</span></div><div class='list'></div>";
  document.body.appendChild(el);
  const chip = el.querySelector(".chip") as HTMLElement;
  const g = el.querySelector(".g") as HTMLElement;
  const t = el.querySelector(".t") as HTMLElement;
  const list = el.querySelector(".list") as HTMLElement;
  const toggle = (): void => { el.classList.toggle("open"); };
  chip.addEventListener("click", toggle);
  chip.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });

  let lastCfg: unknown = null;
  const render = (): void => {
    const cfg = useConfigStore.getState().config;
    if (cfg === lastCfg) return; // only re-lint when the model actually changed
    lastCfg = cfg;
    if (!cfg) { el.dataset.state = ""; return; }
    const chk = checkBrief(cfg); // full — the user can scroll the popover
    if (!chk.ok) {
      el.dataset.state = "err";
      g.textContent = "✖";
      const parts: string[] = [`${chk.errors} error${chk.errors === 1 ? "" : "s"}`];
      if (chk.warnings) parts.push(`${chk.warnings} warning${chk.warnings === 1 ? "" : "s"}`);
      t.textContent = parts.join(", ");
      // Errors first, then warnings below them.
      let body = (chk.error_messages ?? []).join("\n\n");
      if (chk.warnings) body += (body ? "\n\n" : "") + "— Warnings —\n\n" + (chk.warning_messages ?? []).join("\n\n");
      list.textContent = body;
    } else if (chk.warnings) {
      el.dataset.state = "warn";
      g.textContent = "⚠";
      t.textContent = `${chk.warnings} structural warning${chk.warnings === 1 ? "" : "s"}`;
      list.textContent = (chk.warning_messages ?? []).join("\n\n");
    } else {
      el.dataset.state = "";
      el.classList.remove("open");
    }
  };
  useConfigStore.subscribe(render);
  render();
}

// Populate galleryTemplates (the catalog manifest) if it hasn't been fetched
// yet — the gallery normally loads it lazily on open, but the wadi API can be
// called before the modal is ever shown.
async function ensureCatalog(): Promise<void> {
  if (galleryTemplates.length) return;
  // The programmatic template API (listTemplates / chooseTemplate) is about the
  // SAMPLES, so load them from the default source even if the user has a folder set.
  galleryTemplates = await withSource({ kind: "default" }, () => loadCatalog());
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
// Max messages per rule in the AGENT-facing check result (WebMCP), so one noisy
// category (e.g. many furniture overlaps) can't crowd the others out of the agent's
// context. The in-app pill / chip the user sees are never capped.
const AGENT_CHECK_CAP = 3;

// Order issues so cosmetic furniture-overlap (C7) noise sits LAST, keeping the
// registry order otherwise (Array.sort is stable). So a structural warning like an
// unsupported staircase never hides behind a flood of furniture overlaps.
function orderIssues(issues: CheckIssue[]): CheckIssue[] {
  return [...issues].sort((a, b) => (a.rule === "C7" ? 1 : 0) - (b.rule === "C7" ? 1 : 0));
}

// Flatten issues to messages. With `perCategory` set, cap each rule to that many
// messages and add an "…and N more [rule]" line — used for the AGENT-facing result
// (WebMCP) so one noisy category can't crowd the others out. Without it, every
// message is returned (the in-app pill / chip, which the user can scroll).
function issueMessages(issues: CheckIssue[], perCategory?: number): string[] {
  const ordered = orderIssues(issues);
  if (!perCategory) return ordered.map((e) => e.message);
  const seen = new Map<string, number>();
  const out: string[] = [];
  const overflow = new Map<string, number>();
  for (const it of ordered) {
    const n = seen.get(it.rule) ?? 0;
    if (n < perCategory) out.push(it.message);
    else overflow.set(it.rule, (overflow.get(it.rule) ?? 0) + 1);
    seen.set(it.rule, n + 1);
  }
  for (const [rule, extra] of overflow) out.push(`…and ${extra} more like [${rule}]`);
  return out;
}

// `perCategory` caps each rule's messages for the AGENT-facing result; omit it for
// the in-app surfaces, which show everything.
function checkBrief(cfg: unknown, perCategory?: number): CheckBrief {
  const c = runCheck(cfg);
  const out: CheckBrief = { ok: c.ok, errors: c.error_count, warnings: c.warning_count, summary: c.summary };
  if (c.errors.length) out.error_messages = issueMessages(c.errors, perCategory);
  if (c.warnings.length) out.warning_messages = issueMessages(c.warnings, perCategory);
  return out;
}

// The WDL-editor status pill's colour + body for a check result: ERRORS first, then
// warnings below them, so nothing important is hidden by ordering.
function statusFromCheck(chk: CheckBrief): { cls: string; body: string } {
  if (!chk.ok) {
    let body = `✖ ${chk.summary}\n` + (chk.error_messages ?? []).join("\n");
    if (chk.warnings) body += "\n\nWarnings:\n" + (chk.warning_messages ?? []).join("\n");
    return { cls: "err", body };
  }
  if (chk.warnings) return { cls: "warn", body: `⚠ ${chk.summary}\n` + (chk.warning_messages ?? []).join("\n") };
  return { cls: "", body: "" };
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
  // Recompile the current model against its (just-changed) module set so an
  // `import "ref"` resolves and the 3D re-renders. Preserves the module list.
  const recompileWithModules = async (): Promise<unknown> => {
    const s = store();
    const res = await wdlToConfig(s.wdl, s.modules);
    if (!res.ok || !res.config) return { ok: false as const, errors: res.errors };
    s.loadConfig(res.config, s.filename ?? undefined, s.filePath, s.wdl, s.modules);
    window.wadiInvalidate?.();
    return { loaded: true as const, ...checkBrief(store().config, AGENT_CHECK_CAP) };
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
      setViewerPanels(false); // agent chose a home — keep the model full-screen
      return { ok: true as const, id };
    },

    // Read a ready-made home's .wdl WITHOUT loading it — so an agent can study an
    // example without disturbing the user's current live model.
    async getTemplateWdl(id: string) {
      await ensureCatalog();
      const t = galleryTemplates.find((x) => x.id === id);
      if (!t) {
        throw new Error(
          `wadi.getTemplateWdl: unknown id '${id}'. Call wadi.listTemplates() for valid ids.`,
        );
      }
      const bytes = await fetchCatalogBytes(t.file, { kind: "default" });
      const loaded = await parseConfigBytes(bytes, t.file);
      // Bundles carry model.wdl; legacy JSON has none — decompile as a fallback.
      return loaded.wdl || configToWdlText(loaded.config as unknown as ValidatedHouseConfig);
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
      // Count this as a chosen home so the owner welcome overlay + New dialog clear.
      markHomeChosen();
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
      // Staircases: the RESOLVED summary (flights, climb direction, and the top
      // landing where you step onto the floor) so an agent can size the box and
      // leave a way off the stair without guessing. Coordinates are PROJECT UNITS
      // (the same units the .wdl uses), not feet.
      const stairCtx = (fi: number) => {
        const list = floorsOf(cfg);
        const fl = (list[fi] ?? {}) as Record<string, unknown>;
        const defs = (cfg.defaults ?? {}) as Record<string, unknown>;
        const dFloor = typeof defs.floor_height === "number" && defs.floor_height > 0 ? defs.floor_height : 100;
        const dSlab = typeof defs.slab_thickness === "number" ? defs.slab_thickness : 8;
        const own = typeof fl.height === "number" && fl.height > 0 ? fl.height : dFloor;
        const belowRaw = fi > 0 ? ((list[fi - 1] ?? {}) as Record<string, unknown>).height : undefined;
        const below = typeof belowRaw === "number" && belowRaw > 0 ? belowRaw : dFloor;
        const slab = typeof fl.slab_thickness === "number" ? fl.slab_thickness : dSlab;
        return { slabThickness: slab, floorBelowHeight: below, floorOwnHeight: own };
      };
      const staircases = floorsOf(cfg).flatMap((f, fi) =>
        (f.objects ?? [])
          .filter((o) => o?.type === "staircase" && o.enabled !== false)
          .map((o) => {
            const s = summarizeStaircase(
              o as unknown as { type: string; [k: string]: unknown },
              stairCtx(fi),
            );
            return {
              name: s.name,
              floor: f.floor_number,
              flights: s.numFlights,
              direction: s.direction,
              climb: s.climb,
              units: "project_units" as const,
              arrival: s.arrival
                ? {
                    x: Math.round(s.arrival.x),
                    y: Math.round(s.arrival.y),
                    width: Math.round(s.arrival.width),
                    length: Math.round(s.arrival.length),
                    facing: s.arrival.facing,
                  }
                : null,
              min_length_for_1_flight: s.minBoxLengthFor1,
              min_length_for_2_flights: s.minBoxLengthFor2,
              ...(s.error ? { note: s.error } : {}),
            };
          }),
      );
      return {
        units: "feet" as const, per_unit: perUnitOf(cfg),
        plot_width_ft: uToFt(cfg, site.plot_width), plot_length_ft: uToFt(cfg, site.plot_length),
        coord_convention: (cfg.coord_convention as string) ?? "outer",
        variables: (cfg.variables ?? {}) as Record<string, unknown>,
        floors, roof, staircases,
        // Structural check (C1-C11) of the whole house, so a single describe call
        // tells the agent if anything is wrong. Each connection above also carries
        // its own `passable` flag.
        issues: checkBrief(cfg, AGENT_CHECK_CAP),
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
      return { ok: true as const, name: (patch.name as string) ?? String(found.room.name), check: checkBrief(store().config, AGENT_CHECK_CAP) };
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
      markHomeChosen();
      return { ok: true as const, rooms: placed.length, doors, plot_ft: [Math.round(maxX / per), Math.round(maxY / per)], notes };
    },

    undo() { useConfigStore.temporal.getState().undo(); return { ok: true as const }; },
    redo() { useConfigStore.temporal.getState().redo(); return { ok: true as const }; },
    captureView(size?: number) { return window.wadiCapture3D?.(Number(size) || 1000) ?? null; },

    setPanels(visible: boolean) { setViewerPanels(!!visible); return { ok: true as const, visible: !!visible }; },

    async setWdl(wdl: string) {
      const src = String(wdl ?? "");
      // Resolve imports against the model's custom modules; preserve them across the
      // edit (loadConfig omits `modules`), since the agent edited the MAIN file.
      const res = await wdlToConfig(src, store().modules);
      if (!res.ok || !res.config) return { ok: false as const, errors: res.errors };
      // Keep the agent's exact WDL as the model's source (WDL is the source of truth);
      // preserve the current module list across the edit.
      store().loadConfig(res.config, "wadi.setWdl", null, src, store().modules);
      markHomeChosen(); // dismiss the New dialog if it's still up
      setViewerPanels(false); // agent edit — keep the model visible, hide code/knobs
      return { loaded: true as const, ...checkBrief(store().config, AGENT_CHECK_CAP) };
    },
    async getWdl() {
      // The model always carries its WDL (synced in the store). Fall back to a
      // fresh decompile if the synced copy is somehow empty.
      const s = store();
      return s.wdl || configToWdlText(s.config as unknown as ValidatedHouseConfig);
    },
    async checkWdl(wdl: string) {
      const res = await wdlToConfig(String(wdl ?? ""), store().modules);
      return res.ok
        ? { ok: true as const, message: "Compiles and validates. Load it with wadi_set_wdl to render it and get the structural (C1-C12) check." }
        : { ok: false as const, errors: res.errors };
    },
    listModules() {
      const m = store().modules;
      return Object.keys(m).sort().map((ref) => ({ ref, chars: m[ref].length }));
    },
    async addModule(ref: string, wdl: string) {
      const key = String(ref ?? "").trim();
      if (!key) return { ok: false as const, errors: ["a module ref (the import name) is required"] };
      store().addModule(key, String(wdl ?? ""));
      return recompileWithModules();
    },
    async removeModule(ref: string) {
      store().removeModule(String(ref ?? "").trim());
      return recompileWithModules();
    },
    help() { return WADI_AGENT_HELP; },
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
  "  floor 1 \"Ground Floor\" height 92 slab_thickness 0 {   // floor fields go in the HEADER, before the '{', NOT in the body.",
  "                                                          // slab_thickness 0 = walls sit on the base (else they float on an 8-thick slab);",
  "                                                          // height 92 = wall_height + slab_thickness, so the roof above sits flush (no gap).",
  "    room Living at (0, 0) size (160, 140) material \"living\" {",
  "      wall north south west                       // several sides on one line",
  "      wall east { door D1 at 55 size (30, 84) }   // a door NEEDS a name; `at` = offset along the wall, size = (width, height)",
  "    }",
  "    room Kitchen at (160, 0) size (120, 140) {",
  "      wall north south east                       // west omitted -> open to Living's doored wall (a passage)",
  "    }",
  "  }",
  "",
  "  // A ROOF sits on its OWN floor stacked ABOVE the walls' floor, so it rests on top of them.",
  "  floor 2 \"Roof\" {",
  "    roof name \"Hip\" pitched endpoint closed slope height 60 overhang 12 material \"roof\" {",
  "      segment \"s0\" from (140, 0) to (140, 140) width 280   // ridge centreline down the 280x140 footprint; width = span across",
  "    }",
  "  }",
  "}",
  "",
  "KEY RULES:",
  "- Names are BARE identifiers (room Living, door D1) — NOT quoted. \"strings\" are only for titles/materials.",
  "- Object types inside a floor: room, wall, pillar, beam, slab, roof, staircase, kitchen_platform, item (furniture GLB), component (reusable).",
  "- Floor-level fields (`height`, `wall_height`, `slab_thickness`, `enabled`) go in the floor HEADER, before the `{` — e.g. `floor 1 \"Ground\" height 92 slab_thickness 0 { … }`. Only OBJECT declarations go inside the `{ }` body; putting `slab_thickness 0` inside the body is a parse error.",
  "- A ROOF goes on its OWN floor stacked ABOVE the rooms' floor (add a top `floor N \"Roof\"` and put the `roof` there). A roof on the SAME floor as the walls renders at floor level, not on top. A `roof` holds one or more `segment` lines (ridge centreline `from`→`to`, `width` = the span). Endpoint style: `pitched endpoint closed` = hip, `pitched endpoint open` = gable, `shed`, `flat`.",
  "- Openings live inside `wall SIDE { ... }`: `door NAME at OFFSET size (w,h) [open]`, `window NAME at OFFSET size (w,h) [sill N]`. `open` = open passage.",
  "- Two rooms are connected when they abut and the shared wall has a door on one room (and is omitted on the other), OR is omitted on both (open passage).",
  "- Coordinates: origin top-left, X right, Y DOWN. Positions/sizes are project units (10 = 1 ft by default).",
  "- Parametric: declare variables and use them / write formulas (e.g. main.x4 - main.x1) in any numeric slot; reusable components and the unified `roof` object are supported.",
  "",
  "For complete, correct examples (roofs, variables, grids, components), call wadi_choose_home then wadi_get_wdl to read a full house's WDL, edit it, and apply with wadi_set_wdl. wadi_set_wdl returns compile errors + the C1-C12 structural check so you can iterate.",
].join("\n");

// A self-contained primer for an AI agent driving this page from JavaScript (the
// window.wadi API). Handed out by window.wadi.help(), the "Use with your AI agent"
// prompt, and /llms.txt — so an agent that can run JS on the page can author a
// house without any WebMCP tool discovery.
const WADI_AGENT_HELP = [
  "Wadi (wadi.house) — edit a live 3D house from JavaScript (window.wadi API).",
  "",
  "STRONGLY PREFERRED: EDIT A TEMPLATE — DO NOT BUILD FROM SCRATCH.",
  "Authoring a whole house from a blank .wdl is error-prone (wall alignment across",
  "floors, roof sizing, cantilever support, plinth, staircase). Instead, start from the",
  "ready-made home CLOSEST to what the user wants and change it:",
  "  const homes = await window.wadi.listTemplates();          // pick the closest by title/meta",
  "  await window.wadi.chooseTemplate(homes[i].id);            // load it as your starting point",
  "  const wdl = await window.wadi.getWdl();                   // read its .wdl",
  "  // …EDIT the wdl: resize, rename, add/remove rooms. Prefer adjusting a parametric",
  "  //   template's variables (the whole house re-flows) over rewriting geometry…",
  "  const res = await window.wadi.setWdl(newWdl);             // apply; renders live",
  "Only build from scratch if NO template fits.",
  "",
  "STUDY OTHER EXAMPLES WITHOUT DISTURBING THE LIVE MODEL: to see how another home does a",
  "roof, staircase, grid, etc., READ it — do NOT load it. `await window.wadi.getTemplateWdl(id)`",
  "returns that home's .wdl as text and leaves the user's current model untouched. Only use",
  "chooseTemplate when you actually want to START from that home.",
  "",
  "WORK WITH THE USER — ONE STEP AT A TIME. Do NOT do everything in one shot and leave",
  "the user to fix your guesses.",
  "  • When a request involves a CHOICE — which template, how many rooms and their sizes,",
  "    the layout, roof style, where the stairs go, add vs. move a room — present 2-3",
  "    concrete options and ASK the user to pick BEFORE applying anything.",
  "  • Make ONE meaningful change per step, show the result (captureView / describeHouse),",
  "    and confirm with the user before the next change.",
  "  • Prefer small, reversible edits over regenerating the whole house.",
  "  • State any assumption you had to make and invite the user to correct it.",
  "",
  "KEEP THE MODEL VISIBLE: the WDL editor and configurator panels auto-hide when you apply",
  "a change (setWdl / chooseTemplate), so the user watches the 3D model change, not code or",
  "knobs — important in a small embedded browser. Leave them hidden. (window.wadi.setPanels(true)",
  "reveals them, false hides; the user can also reopen them with the on-screen ☰ / ❮❯ tabs.)",
  "",
  "AFTER EVERY CHANGE: read `res` (or call window.wadi.check()) and FIX the warnings",
  "before telling the user it's ready. setWdl returns { loaded, errors, warnings, summary }",
  "from the structural check; a compile/schema error returns { ok:false, errors } and leaves",
  "the model UNCHANGED. Use window.wadi.checkWdl(wdl) for a dry run.",
  "",
  "IF you must build structure from scratch, follow this ORDER (and re-check as you go):",
  "  1. a plinth on the lowest floor",
  "  2. ground-floor rooms; give each floor a slab",
  "  3. upper floors laid OVER the floor below — walls ALIGNED to the walls beneath them",
  "     (only small partition walls may lack support); give each a slab",
  "  4. pillars under any cantilever (a room past the floor below); a pillar that carries a",
  "     slab OR a staircase landing above it must reach it — a short one leaves a gap (C25).",
  "     A pillar supporting only the roof (or with nothing above) needs no such check.",
  "  5. a roof covering the WHOLE top floor (not just the middle). ONE roof per area:",
  "     extend an existing roof's segments to cover more, never add a second roof over an",
  "     already-covered area (C18). Orient each hip segment's ridge along the LONGER side —",
  "     if the span (width) exceeds the ridge run it collapses to a pyramid (C17).",
  "  6. a staircase with enough run to climb in 1-2 flights — a cramped box forces extra",
  "     switchback flights (C19). Set `direction` so the TOP landing faces the room you want",
  "     to reach, and leave that room's wall open (or add a door) at the landing so there's a",
  "     way off the stair onto the floor (C20). Keep the stair over the plinth — extend the",
  "     plinth AND the slab under an exterior stair (C21, C24) — and enclose it in a room OR put pillars under",
  "     it so the flights and landings are carried (C22). Author the steps in THIS model's",
  "     units — don't copy stair sizes from another example without rescaling; in the default",
  "     10-units-per-foot scale use ~ `step_rise 6`, `step_tread 10` (C23).",
  "",
  "REUSABLE COMPONENTS (MODULES): to reuse a `component` across models, put it in a module",
  "and import it, instead of pasting the same block into every house. A module is a `.wdl`",
  "holding `component Name { … }` definitions (LOCAL coords, no `house`). Register it with",
  "`window.wadi.addModule(\"ref\", moduleWdl)`, then in the main WDL `import \"ref\" as ns` and",
  "place it with `use ns.Name at (x,y)`. Custom modules are saved INSIDE the `.wadi`, so the",
  "design stays self-contained. `window.wadi.listModules()` shows what's registered;",
  "`removeModule(\"ref\")` drops one (also delete its `import`). Inbuilt packs (std-furniture,",
  "konkan/base) are always available and need no addModule.",
  "",
  "SEE THE RESULT / INSPECT:",
  "  window.wadi.captureView()      // -> a JPEG data URL of the current 3D view",
  "  window.wadi.describeHouse()    // rooms + roof + STAIRCASES: each stair's flight count,",
  "                                 //   climb direction, the top-landing rectangle (where you",
  "                                 //   step onto the floor) + its facing, and the min box",
  "                                 //   length for 1 and 2 flights. Use it to size + orient stairs.",
  "  window.wadi.listRooms(); window.wadi.enterRoom(key); window.wadi.exitRoom();  // interior views",
  "",
  "Then follow the .wdl syntax below.",
  "",
  WDL_PRIMER,
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
        "Compile .wdl through Wadi's real pipeline and load it into the live 3D model. STRONGLY PREFER EDITING A TEMPLATE over building from scratch: wadi_list_homes -> wadi_choose_home (closest match) -> wadi_get_wdl -> edit -> wadi_set_wdl. Authoring a whole house from a blank .wdl is error-prone (wall alignment across floors, roof sizing, cantilever support, plinth, staircase); only do it if no template fits. On a compile/schema error the model is left unchanged and errors are returned; on success it returns the structural check — READ IT AND FIX WARNINGS before telling the user it is ready. Loop: choose -> get -> edit -> set -> fix -> repeat. Call wadi_wdl_reference first if unsure of the syntax.",
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
    // ---- Component modules: register reusable component .wdl files the main WDL
    // imports. They save INSIDE the .wadi, so the design stays self-contained. This
    // is the in-browser twin of writing a component file on disk: add the module,
    // then `import "ref" as ns` in the main WDL (wadi_set_wdl) and `use ns.Component`. ----
    {
      name: "wadi_list_modules",
      description:
        "List the custom component modules registered for the current model (import ref + source size). These are the reusable component .wdl files saved inside the .wadi. Inbuilt packs (furniture, konkan) are always available and are not listed.",
      annotations: { readOnlyHint: true },
      inputSchema: noInput,
      execute() { return text(api().listModules()); },
    },
    {
      name: "wadi_add_module",
      description:
        "Register (or replace) a reusable component module by its import ref, then recompile the live model. Use this to add a component .wdl the main WDL imports: the module holds one or more `component Name { … }` definitions in LOCAL coords; then in the main WDL `import \"ref\" as ns` and place it with `use ns.Name at (x,y)`. The module is saved inside the .wadi so the design is self-contained. Returns the structural check.",
      inputSchema: {
        type: "object",
        properties: {
          ref: { type: "string", description: "the import ref, e.g. \"dining-set\" (matches `import \"dining-set\"`)" },
          wdl: { type: "string", description: "the module's .wdl source (component definitions, no `house` block)" },
        },
        required: ["ref", "wdl"],
      },
      async execute(input) { return text(await api().addModule(String(input?.ref ?? ""), String(input?.wdl ?? ""))); },
    },
    {
      name: "wadi_remove_module",
      description:
        "Remove a custom component module by its import ref and recompile. (Does not touch the main WDL's import line — remove that too if the component is no longer used.)",
      inputSchema: {
        type: "object",
        properties: { ref: { type: "string", description: "the import ref to remove" } },
        required: ["ref"],
      },
      async execute(input) { return text(await api().removeModule(String(input?.ref ?? ""))); },
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
      name: "wadi_read_home",
      description:
        "Return a ready-made home's .wdl source WITHOUT loading it — study an example (how it does a roof, a staircase, a grid, etc.) without disturbing the user's current model. Use this to look things up; use wadi_choose_home only when you actually want to start from that home. Ids come from wadi_list_homes.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "template id, e.g. family_home" } },
        required: ["id"],
      },
      async execute(input) { return text(await api().getTemplateWdl(String(input.id))); },
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
        "Read the current house as structured data: each floor and its rooms (name, size and position in feet), each room's connections (with a `passable` flag = the two rooms actually share a wall with a door or open passage), the roof, plot size, design variables, a `staircases` array (each stair's flight count, climb direction, the top-landing rectangle where you step onto the floor + its facing, and the min box length for 1 and 2 flights), and an `issues` structural summary (errors/warnings). Call this FIRST to see what you're working with, and again to confirm a change landed correctly.",
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

// The modelContext object we last registered on. WebMCP can attach LATE and can
// be REPLACED: an in-browser agent (e.g. Claude for Chrome) injects
// navigator.modelContext via an extension, often only when the user activates it
// on the tab — well after our init. A one-shot check at load therefore misses it
// (the symptom: the agent sees navigator.modelContext but getTools() is empty).
// So we register whenever a modelContext appears, and re-register if the object
// identity changes (a fresh injection replaces an earlier one).
let registeredMc: ModelContextLike | null = null;

function currentModelContext(): ModelContextLike | undefined {
  const mc =
    (navigator as unknown as { modelContext?: ModelContextLike }).modelContext ??
    (document as unknown as { modelContext?: ModelContextLike }).modelContext;
  return mc && (typeof mc.registerTool === "function" || typeof mc.provideContext === "function")
    ? mc
    : undefined;
}

// Register the wadi tools on the live modelContext. Idempotent per object: a
// no-op if we've already registered on this exact object. Returns true if the
// tools are registered (now or already).
function registerWadiMcpTools(): boolean {
  const mc = currentModelContext();
  if (!mc) return false;
  if (mc === registeredMc) return true;
  const tools = window.wadiMcpTools ?? buildWadiMcpTools();
  let n = 0;
  if (typeof mc.registerTool === "function") {
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
  } else if (typeof mc.provideContext === "function") {
    try {
      mc.provideContext({ tools });
      n = tools.length;
    } catch (e) {
      console.warn("[webmcp] provideContext failed:", e);
    }
  }
  if (n > 0) {
    registeredMc = mc;
    console.info(`[webmcp] registered ${n} wadi tools on navigator.modelContext`);
    return true;
  }
  return false;
}

function wireWebMcpTools(): void {
  // The EARLY inline boot in viewer.html already registered the tools (synchronously
  // at load, so agent tool-detectors discover them). Don't double-register here.
  if ((window as unknown as { __wadiWebmcpBooted?: boolean }).__wadiWebmcpBooted) return;

  // Expose for inspection / testing / the demo, even where WebMCP is absent, and a
  // manual trigger an agent can call from the console if the API attached late.
  window.wadiMcpTools = buildWadiMcpTools();
  window.wadiRegisterMcp = registerWadiMcpTools;

  registerWadiMcpTools(); // register now if the API is already present

  // Catch a LATE or REPLACED modelContext: poll for a few minutes as a backstop,
  // and (cheaply, forever) re-check whenever the tab regains focus/visibility —
  // which is when an agent extension typically injects or refreshes the API.
  let tries = 0;
  const iv = setInterval(() => {
    if (registerWadiMcpTools() || ++tries > 200) clearInterval(iv); // ~5 min backstop
  }, 1500);
  const recheck = () => void registerWadiMcpTools();
  document.addEventListener("visibilitychange", recheck);
  window.addEventListener("focus", recheck);
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
  tags?: string[];
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
// Bumped on every catalog (re)load so a SLOW load (a cloud folder whose dataless
// files must download before they can be indexed) can't overwrite a newer one, and
// the gallery shows a loading state instead of freezing on the previous list.
let catalogLoadSeq = 0;
// The gallery modal serves two DISTINCT intents (one screen, two framings):
//   "new"  — start a fresh design from Wadi's SAMPLES (always samples, never the
//            user's folder). Opened by the New button / "Choose your home".
//   "open" — open the user's OWN work: their models folder (if set), plus opening a
//            single .wadi from disk. Never shows samples. Opened by the Open button.
let galleryMode: "new" | "open" = "new";
// Downloaded bytes per folder file, cached so previewing then opening (or opening a
// second time) doesn't re-download. Keyed by file name within the current folder.
const folderBytesCache = new Map<string, Uint8Array>();

// The WDL editor registers a "flush" here: apply its unapplied edits (compile the
// current text) so a Save writes what's in the editor, not the last-applied WDL.
// Returns true when store.wdl is current afterwards (nothing pending, or the
// pending edit compiled); false when the pending edit FAILS to compile. Null when
// the WDL editor isn't wired (embedded surface).
let flushWdlEditor: (() => Promise<boolean>) | null = null;

// Call before any Save/Save As. Flushes the WDL editor; if the pending edit won't
// compile, asks whether to save the last applied version instead. Returns true to
// proceed with the save, false to abort so the user can fix the WDL.
async function flushWdlBeforeSave(): Promise<boolean> {
  if (!flushWdlEditor) return true;
  if (await flushWdlEditor()) return true;
  // Unapplied WDL edits that don't compile — a bundle's model.wdl must compile, so
  // don't silently bake a broken source. Let the user save the last good version.
  return window.confirm(
    "Your latest WDL edits have errors and weren't applied — see the ✖ Errors panel. " +
      "Save the last applied version instead? Your unapplied edits won't be included.",
  );
}
interface TemplateFilters {
  bedrooms: number; // minimum
  bathrooms: number; // minimum
  floors: number; // 0 = any, else exact
  style: string; // "" = any
  roof: string; // "" = any
  plotW: number | null; // my plot width (ft); template must fit
  plotL: number | null;
  tags: string[]; // selected free-form tags; a template must carry ALL of them
}
const emptyFilters = (): TemplateFilters => ({
  bedrooms: 0,
  bathrooms: 0,
  floors: 0,
  style: "",
  roof: "",
  plotW: null,
  plotL: null,
  tags: [],
});
let tplFilters: TemplateFilters = emptyFilters();

// New = start a fresh design from Wadi's SAMPLES (always, regardless of the user's
// configured folder). Open = the user's own models (their folder, plus open-a-file).
function openNewModal(): Promise<void> { galleryMode = "new"; return refreshGallery(); }
function openMyModelsModal(): Promise<void> { galleryMode = "open"; return refreshGallery(); }

async function refreshGallery(): Promise<void> {
  const modal = document.getElementById("new-house-modal");
  const grid = document.getElementById("new-house-modal-grid");
  if (!modal || !grid) return;
  modal.style.display = "block";
  tplFilters = emptyFilters(); // a fresh open starts unfiltered

  const titleEl = document.getElementById("new-house-modal-title");
  const subEl = document.getElementById("new-house-modal-subtitle");
  const openRow = document.querySelector(".new-house-open-row") as HTMLElement | null;
  const sourceBar = document.getElementById("new-house-modal-source");

  if (galleryMode === "new") {
    // ---- NEW: Wadi's sample homes, forced regardless of the models folder. ----
    if (titleEl) titleEl.textContent = "Choose your home";
    if (subEl) subEl.textContent =
      "Browse ready-made homes and pick one to make your own. Filter by size and rooms, then customize everything.";
    if (openRow) openRow.style.display = "none"; // "start fresh" — no open-existing here
    if (sourceBar) sourceBar.innerHTML = ""; // no folder controls in New
    const seq = ++catalogLoadSeq;
    grid.innerHTML = `<div class="new-house-modal-empty">Loading homes…</div>`;
    let loaded: TemplateEntry[];
    try {
      loaded = await withSource({ kind: "default" }, () => loadCatalog());
    } catch (e) {
      if (seq !== catalogLoadSeq) return;
      grid.innerHTML = `<div class="new-house-modal-empty" style="color:#b00">Couldn't load the sample homes: ${escapeHtml(e instanceof Error ? e.message : String(e))}</div>`;
      return;
    }
    if (seq !== catalogLoadSeq) return;
    galleryTemplates = loaded;
    buildTemplateFilterBar();
    renderTemplateCards();
    return;
  }

  // ---- OPEN: the user's own models. NEVER shows samples. ----
  if (titleEl) titleEl.textContent = "Open a model";
  if (subEl) subEl.textContent = "Open one of your saved designs — from a folder, or a single .wadi file.";
  if (openRow) openRow.style.display = "";
  const openBtn = document.getElementById("new-house-open-existing");
  if (openBtn) (openBtn as HTMLButtonElement).onclick = async () => {
    if (await openExistingFromDisk()) closeNewHouseModal();
  };
  renderOpenSourceBar();

  const src = templateSource();
  if (src.kind === "default") {
    // No models folder chosen → offer to open a file (above) or pick a folder. No
    // samples, and no filter bar (there's nothing to filter). Drop any stale
    // gallery entries so a leftover sample list can't render filters.
    galleryTemplates = [];
    const filterBar = document.getElementById("new-house-modal-filters");
    if (filterBar) filterBar.innerHTML = "";
    const folderBtn = canPickFolder()
      ? `<button type="button" class="tpl-source-btn" id="tpl-choose-folder" style="margin-top:12px">📁 Choose a folder of your designs</button>`
      : `<div style="margin-top:10px;font-size:.85em;opacity:.7">Choosing a folder needs the desktop app or Chrome / Edge.</div>`;
    grid.innerHTML =
      `<div class="new-house-modal-empty">No models folder chosen yet.<br>
       Open a single <b>.wadi</b> file above, or point at a folder of your designs.<br>${folderBtn}</div>`;
    document.getElementById("tpl-choose-folder")?.addEventListener("click", () =>
      isTauri() ? void pickLocalModelsFolder() : void pickBrowserModelsFolder(),
    );
    return;
  }

  // A browser folder restored from a previous session needs a one-time permission
  // re-grant (a user gesture) — show a Reconnect prompt instead of failing the scan.
  if (src.kind === "browser-dir" && (await modelsDirNeedsPermission())) {
    grid.innerHTML =
      `<div class="new-house-modal-empty">Reconnect <b>${escapeHtml(modelsDirName() ?? "your folder")}</b> to list your models.<br>
       <button type="button" class="tpl-source-btn" id="tpl-reconnect" style="margin-top:10px">Reconnect folder</button></div>`;
    document.getElementById("tpl-reconnect")?.addEventListener("click", async () => {
      if (await reconnectModelsDir()) { resetCatalogSource(); void openMyModelsModal(); }
    });
    return;
  }

  // List the folder's file NAMES only — the fast, local part (directory metadata).
  // We deliberately do NOT download/index each file for thumbnails + meta: a cloud
  // folder's files are dataless, so eager indexing would download every bundle up
  // front and set an expectation cloud latency can't meet. The user clicks a file
  // to load it (one download, bound by their click). Rich cards + thumbnails are for
  // the SAMPLES gallery (New), where they help recognise UNFAMILIAR homes.
  const filterBar = document.getElementById("new-house-modal-filters");
  if (filterBar) filterBar.innerHTML = ""; // no per-file meta → nothing to filter
  galleryTemplates = [];
  const seq = ++catalogLoadSeq;
  grid.innerHTML = `<div class="new-house-modal-empty">Listing files…</div>`;
  let names: string[];
  try {
    names = await listCatalogFiles();
  } catch (e) {
    if (seq !== catalogLoadSeq) return;
    grid.innerHTML =
      `<div class="new-house-modal-empty" style="color:#b00">Couldn't list (${escapeHtml(sourceLabel())}): ${escapeHtml(e instanceof Error ? e.message : String(e))}</div>`;
    return;
  }
  if (seq !== catalogLoadSeq) return;
  renderFolderFileList(names);
}

// A MASTER-DETAIL browser for the user's models folder: a LIST of file names (no
// downloads to list), and a single PREVIEW pane showing the SELECTED file's
// thumbnail — reusing the templates carousel. The thumbnail loads on demand, but
// "Open this model" is available IMMEDIATELY, so a file can be opened without
// waiting for its (cloud-downloaded) thumbnail.
function renderFolderFileList(names: string[]): void {
  const grid = document.getElementById("new-house-modal-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const files = names.filter((n) => /\.(wadi|json)$/i.test(n)).sort((a, b) => a.localeCompare(b));
  if (!files.length) {
    grid.innerHTML =
      `<div class="new-house-modal-empty">This folder has no <b>.wadi</b> files yet.<br>Save a design into it, or choose a different folder.</div>`;
    return;
  }
  const browser = document.createElement("div");
  browser.className = "folder-browser";
  const list = document.createElement("div");
  list.className = "folder-list";
  for (const name of files) {
    const pretty = name.replace(/\.(wadi|json)$/i, "");
    const row = document.createElement("button");
    row.type = "button";
    row.className = "folder-row";
    row.innerHTML = `<span class="file-icon">🏠</span><span class="file-name">${escapeHtml(pretty)}</span>`;
    row.addEventListener("click", () => selectFolderFile(name, row));
    list.appendChild(row);
  }
  const preview = document.createElement("div");
  preview.className = "folder-preview";
  preview.id = "folder-preview";
  preview.innerHTML = `<div class="folder-preview-empty">Select a design to preview it,<br>or open it directly.</div>`;
  browser.append(list, preview);
  grid.appendChild(browser);
}

// Select a file: highlight it and show its preview as the SAME gallery card
// (thumbnail + title + description + meta chips). The card + thumbnail load async,
// but "Open this model" is ready right away, so you needn't wait.
function selectFolderFile(name: string, row: HTMLElement): void {
  row.parentElement?.querySelectorAll(".folder-row.sel").forEach((r) => r.classList.remove("sel"));
  row.classList.add("sel");
  const preview = document.getElementById("folder-preview");
  if (!preview) return;
  const pretty = name.replace(/\.(wadi|json)$/i, "");
  // Skeleton (same card shell, filename as title) + an Open button that works now.
  preview.innerHTML =
    `<div class="folder-preview-card" id="folder-preview-card">
       <div class="template-card">
         <div class="template-card-thumb"><span class="folder-preview-badge">Loading preview…</span></div>
         <div class="template-card-body"><div class="template-card-title">${escapeHtml(pretty)}</div></div>
       </div>
     </div>
     <button type="button" class="file-preview-open" id="folder-preview-open">Open this model</button>`;
  const openBtn = document.getElementById("folder-preview-open") as HTMLButtonElement;
  openBtn.addEventListener("click", () => void openFolderFile(name, openBtn));
  void fillFolderPreviewCard(name);
}

// Fill the preview with the selected file's full gallery card (title/description/
// meta from its manifest + the thumbnail carousel). Guarded: a newer selection
// detaches the holder, so a slow load can't overwrite it.
async function fillFolderPreviewCard(name: string): Promise<void> {
  const holder = document.getElementById("folder-preview-card");
  if (!holder) return;
  try {
    const bytes = await folderFileBytes(name);
    if (!holder.isConnected) return; // a different file was selected meanwhile
    const entry = await entryFromBundleBytes(name, bytes);
    if (!holder.isConnected) return;
    const card = buildTemplateCardEl(entry); // identical to a gallery card (no click)
    holder.replaceChildren(card);
    const thumb = card.querySelector(".template-card-thumb") as HTMLElement;
    const covers = isWadiBundle(bytes) ? await readBundleCoverUrls(bytes) : [];
    if (holder.isConnected && thumb && covers.length) buildTemplateCarousel(thumb, covers, entry.title);
  } catch (e) {
    if (holder.isConnected)
      holder.innerHTML = `<div class="folder-preview-noimg">Preview unavailable<br><span>${escapeHtml(e instanceof Error ? e.message : String(e))}</span></div>`;
  }
}

// Cached download of a folder file (so preview → open, or re-selecting it, is free).
async function folderFileBytes(name: string): Promise<Uint8Array> {
  const hit = folderBytesCache.get(name);
  if (hit) return hit;
  const bytes = await fetchCatalogBytes(name);
  folderBytesCache.set(name, bytes);
  return bytes;
}

// The Open button — download (cached from the preview if it loaded) + open the file
// as a document. Shows a brief "Opening…" until the model loads and the modal closes.
async function openFolderFile(name: string, btn?: HTMLButtonElement): Promise<void> {
  if (!(await guardUnsaved("opening a model"))) return;
  const label = btn?.textContent;
  if (btn) { btn.textContent = "Opening…"; btn.disabled = true; }
  try {
    const bytes = await folderFileBytes(name);
    const loaded = await parseConfigBytes(bytes, name);
    await applyLoadedFolderModel(name, loaded);
  } catch (e) {
    if (btn) { btn.textContent = label ?? "Open →"; btn.disabled = false; }
    alert(`Couldn't open ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Load a parsed folder model into the editor as a DOCUMENT: real filename + a
// writable target (a local path, or the browser folder's file handle) so Save
// writes back to the SAME file. Closes the modal.
async function applyLoadedFolderModel(
  name: string,
  loaded: Awaited<ReturnType<typeof parseConfigBytes>>,
): Promise<void> {
  const src = templateSource();
  let filePath: string | null;
  if (src.kind === "browser-dir") {
    await adoptModelsDirFile(name);
    filePath = name;
  } else {
    filePath = localCatalogFilePath(name);
  }
  useConfigStore.getState().loadConfig(loaded.config, name, filePath, loaded.wdl, loaded.modules);
  markHomeChosen();
  useConfigStore.temporal.getState().clear();
  closeNewHouseModal();
}

// A human label for a templates source, used in the bar and error messages.
function sourceLabel(s: TemplateSource = templateSource()): string {
  switch (s.kind) {
    case "default": return "Wadi sample homes";
    case "bundled": return "bundled with the app";
    case "local": return `folder: ${s.dir}`;
    case "browser-dir": return modelsDirName() ? `folder: ${modelsDirName()}` : "a local folder";
    case "url": return s.url;
    case "gdrive": return `${s.url} (Google Drive)`;
  }
}

// A local folder is available on the desktop (Tauri) and in Chromium browsers
// (File System Access directory picker).
function canPickFolder(): boolean {
  return isTauri() || supportsDirectoryPicker();
}

// The OPEN modal's source bar. When a folder IS configured it shows the folder +
// Change / Close / Refresh. When NONE is configured, the bar is EMPTY — the single
// "Choose a folder" affordance lives in the grid's empty state (one, not two). It
// never mentions samples (those live in the New modal).
function renderOpenSourceBar(): void {
  const bar = document.getElementById("new-house-modal-source");
  if (!bar) return;
  const hasFolder = templateSource().kind !== "default";
  if (!hasFolder) {
    bar.innerHTML = ""; // no folder → the empty-state's "Choose a folder" is the only one
    return;
  }
  const changeBtn = canPickFolder()
    ? `<button type="button" class="tpl-source-btn" id="tpl-source-set">📁 Change folder…</button>`
    : "";
  // sourceLabel already reads "folder: X" — strip the prefix so the bar isn't "Folder: folder: X".
  const folder = sourceLabel().replace(/^folder:\s*/i, "");
  bar.innerHTML =
    `<span class="tpl-source-label">Folder: <b>${escapeHtml(folder)}</b></span>
     ${changeBtn}
     <button type="button" class="tpl-source-btn" id="tpl-source-reset">✕ Close folder</button>
     <button type="button" class="tpl-source-btn" id="tpl-source-refresh">↻ Refresh</button>`;
  document.getElementById("tpl-source-refresh")?.addEventListener("click", () => {
    resetCatalogSource();
    thumbCache.clear();
    folderBytesCache.clear();
    void openMyModelsModal();
  });
  document.getElementById("tpl-source-set")?.addEventListener("click", () =>
    isTauri() ? void pickLocalModelsFolder() : void pickBrowserModelsFolder(),
  );
  document.getElementById("tpl-source-reset")?.addEventListener("click", () => {
    setTemplateSource({ kind: "default" }); // "default" here means: no folder set
    resetCatalogSource();
    thumbCache.clear();
    folderBytesCache.clear();
    void openMyModelsModal();
  });
}

// Pick a LOCAL folder as the models location (desktop only) — the single supported
// custom source. On pick, the gallery re-scans it and lists its .wadi files.
async function pickLocalModelsFolder(): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, title: "Choose your models folder" });
  if (typeof picked !== "string") return; // cancelled
  setTemplateSource({ kind: "local", dir: picked });
  resetCatalogSource();
  thumbCache.clear();
    folderBytesCache.clear();
  void openMyModelsModal();
}

// Browser (Chromium) equivalent: pick a folder via the File System Access API.
// Its handle is persisted (IndexedDB) so it survives reloads; a return visit
// re-grants permission with one click (the reconnect prompt in the Open modal).
async function pickBrowserModelsFolder(): Promise<void> {
  let name: string | null;
  try {
    name = await pickModelsDirectory();
  } catch (e) {
    alert(`Couldn't open that folder: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  if (!name) return; // cancelled
  setTemplateSource({ kind: "browser-dir" });
  resetCatalogSource();
  thumbCache.clear();
    folderBytesCache.clear();
  void openMyModelsModal();
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

// The union of all free-form tags across the loaded templates — the tag filter is
// built dynamically from these, so tags need no fixed vocabulary.
function distinctTags(): string[] {
  const set = new Set<string>();
  for (const t of galleryTemplates) for (const tag of t.meta?.tags ?? []) {
    const s = String(tag).trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
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

  // Tag chips — dynamic, from whatever tags the loaded templates carry. No fixed
  // vocabulary; the row is omitted entirely when no template declares a tag.
  const tags = distinctTags();
  const tagChips = tags.length
    ? `<div class="tpl-tag-filters">` +
      tags
        .map((tag) => {
          const on = tplFilters.tags.includes(tag);
          return `<button type="button" class="tpl-tag-chip${on ? " on" : ""}" data-tag="${escapeHtml(tag)}" aria-pressed="${on}">${escapeHtml(tag)}</button>`;
        })
        .join("") +
      `</div>`
    : "";

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
    `<button type="button" class="tpl-filters-reset" id="tpl-filters-reset">Reset</button>` +
    tagChips;

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
  bar.querySelectorAll<HTMLButtonElement>(".tpl-tag-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const tag = chip.dataset.tag ?? "";
      if (!tag) return;
      const i = tplFilters.tags.indexOf(tag);
      if (i >= 0) tplFilters.tags.splice(i, 1);
      else tplFilters.tags.push(tag);
      const on = tplFilters.tags.includes(tag);
      chip.classList.toggle("on", on);
      chip.setAttribute("aria-pressed", String(on));
      renderTemplateCards();
    });
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
  // Tags: the template must carry every selected tag (AND — each added tag
  // narrows, like the other filters).
  if (f.tags.length) {
    const have = new Set((m?.tags ?? []).map((s) => String(s).trim()));
    for (const tag of f.tags) if (!have.has(tag)) return false;
  }
  return true;
}

// Render the filtered card grid. The "Blank plot" starter is hidden when browsing
// Wadi's sample homes (you're choosing a finished home, not an empty slab); it
// shows when you're browsing your own models location.
function renderTemplateCards(): void {
  const grid = document.getElementById("new-house-modal-grid");
  if (!grid) return;
  // Hide the "blank" starter in the SAMPLES gallery (New); show every file when
  // browsing the user's own folder (Open).
  const hideBlank = galleryMode === "new";
  const matches = galleryTemplates.filter(
    (t) => (!hideBlank || t.id !== "blank") && templatePasses(t),
  );

  const countEl = document.getElementById("tpl-filters-count");
  if (countEl) {
    const n = matches.length;
    countEl.textContent = `${n} home${n === 1 ? "" : "s"}`;
  }

  grid.innerHTML = "";
  // In the New gallery, lead with a "Start from scratch" card so there's an obvious
  // way to begin with an empty plot (the blank starter is otherwise not shown). It
  // stays regardless of the tag/size filters.
  if (galleryMode === "new") grid.appendChild(buildStartBlankCard());

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "new-house-modal-empty";
    empty.textContent = "No homes match these filters. Try widening your plot size or clearing a filter.";
    grid.appendChild(empty);
    return;
  }

  for (const t of matches) {
    const card = buildTemplateCardEl(t, () => void selectTemplate(t));
    grid.appendChild(card);
    void loadTemplateThumb(t, card.querySelector(".template-card-thumb") as HTMLElement);
  }
}

// A "Start from scratch" card for the New gallery: loads the empty plot so the user
// (or an agent) can build the whole house in the WDL editor.
function buildStartBlankCard(): HTMLElement {
  const card = document.createElement("div");
  card.className = "template-card start-blank";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.innerHTML = `
      <div class="template-card-thumb start-blank-thumb"><span class="start-blank-plus" aria-hidden="true">+</span></div>
      <div class="template-card-body">
        <div class="template-card-title">Start from scratch</div>
        <div class="template-card-desc">An empty plot with a ground slab. Build the whole house in the WDL editor, or with an AI agent.</div>
      </div>`;
  const go = () => void startBlank();
  card.addEventListener("click", go);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
  });
  return card;
}

// Load the empty starter model as a fresh, untitled house (no file yet, so Save
// asks where to put it). Same load path as picking a template, minus the "(template)"
// framing.
async function startBlank(): Promise<void> {
  if (!(await guardUnsaved("creating a new house"))) return;
  try {
    const blank = galleryTemplates.find((t) => t.id === "blank");
    const bytes = await fetchCatalogBytes(blank?.file ?? "blank.wadi", { kind: "default" });
    const loaded = await parseConfigBytes(bytes, "blank.wadi");
    useConfigStore.getState().loadConfig(loaded.config, "Untitled house", null, loaded.wdl);
    markHomeChosen();
    useConfigStore.temporal.getState().clear();
    closeNewHouseModal();
  } catch (e) {
    alert(`Couldn't start a blank house: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// The gallery card component (thumbnail + title + description + meta chips), shared
// by the samples gallery and the folder-Open preview so both look identical.
function buildTemplateCardEl(t: TemplateEntry, onClick?: () => void): HTMLElement {
  const card = document.createElement("div");
  card.className = "template-card";
  card.innerHTML = `
      <div class="template-card-thumb"><span class="thumb-placeholder">🏠</span></div>
      <div class="template-card-body">
        <div class="template-card-title">${escapeHtml(t.title)}</div>
        <div class="template-card-desc">${escapeHtml(t.description)}</div>
        ${templateMetaChips(t.meta)}
      </div>`;
  if (onClick) card.addEventListener("click", onClick);
  return card;
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
    // Sample cards ALWAYS load from Wadi's DEFAULT source (R2), even if the user
    // has an Open FOLDER configured — otherwise we'd look for the sample's cover in
    // their folder and 404 (leaving the 🏠 placeholder). An explicit source arg (not
    // the withSource override) is race-safe here: thumbnails load concurrently.
    const SAMPLES: TemplateSource = { kind: "default" };
    if (t.cover) {
      try {
        const bytes = await fetchCatalogBytes(t.cover, SAMPLES);
        images = [bytesToImgUrl(bytes, t.cover)];
      } catch {
        /* loose cover unavailable → fall back to the file's own previews */
      }
    }
    if (images === undefined) {
      try {
        const bytes = await fetchCatalogBytes(file, SAMPLES);
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
    // Cache only a SUCCESSFUL (non-empty) result. Caching an empty [] would poison
    // the thumbnail for the whole session on a TRANSIENT miss (e.g. a cover still
    // propagating on R2 right after publish) — the card would keep its 🏠
    // placeholder until a reload. Leaving a miss uncached lets the next open retry.
    if (images.length > 0) thumbCache.set(file, images);
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
    useConfigStore.getState().loadConfig(res.config, res.filename, res.filePath, res.wdl, res.modules);
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
    useConfigStore.getState().loadConfig(res.config, res.filename, res.filePath, res.wdl, res.modules);
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
    /* Three widths via data-wdl = off | on | max: hidden / docked (460px) / full
       (fills the row minus the configurator, hiding the centre 3D/tabs). One
       stepped edge control (❮ grow / ❯ shrink) walks between them. */
    body[data-wdl="off"] #viewer-wdl { display: none; }
    body[data-wdl="max"] #viewer-wdl { flex: 1 1 auto; width: auto; max-width: none; }
    body[data-wdl="max"] #viewer-content-area { display: none; }
    #viewer-wdl .wdl-head { flex: none; display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; background: #111827; border-bottom: 1px solid #1e293b; font: 600 13px system-ui, sans-serif; }
    #viewer-wdl .wdl-head .sub { color: #94a3b8; font-weight: 400; font-size: 11px; margin-left: 8px; }
    /* Monaco editor host — fills the pane; Monaco paints its own dark theme. */
    #viewer-wdl #wdl-editor { flex: 1 1 auto; min-height: 0; width: 100%; background: #1e1e1e; }
    #viewer-wdl .wdl-foot { flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 12px;
      border-top: 1px solid #1e293b; background: #0d1526; }
    #viewer-wdl .wdl-apply { flex: none; background: #2563eb; color: #fff; border: none; border-radius: 7px;
      padding: 7px 14px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
    #viewer-wdl .wdl-apply:disabled { background: #1e293b; color: #64748b; cursor: default; }
    #viewer-wdl .wdl-apply .k { opacity: .7; font-weight: 400; margin-left: 5px; }
    body[data-wdl-dirty="on"] #viewer-wdl .wdl-apply { box-shadow: 0 0 0 2px rgba(37,99,235,.35); }
    #viewer-wdl .wdl-btn { background: none; border: 1px solid #334155; color: #cbd5e1; border-radius: 6px;
      padding: 2px 9px; cursor: pointer; font: inherit; }
    /* Head action group: the compile-status pill + the reference button. */
    #viewer-wdl .wdl-head-actions { flex: none; display: flex; align-items: center; gap: 8px; }
    /* Compile-status pill — a state-coloured glyph+label that highlights on
       warnings/errors and opens the status slide-over (full messages) on click.
       Replaces the old cramped footer status line. */
    #viewer-wdl .wdl-status-btn { flex: none; display: inline-flex; align-items: center; gap: 5px;
      background: none; border: 1px solid #334155; color: #cbd5e1; border-radius: 6px;
      padding: 2px 9px; cursor: pointer; font: 600 12px system-ui, sans-serif; }
    #viewer-wdl .wdl-status-btn:hover { background: #1e293b; }
    #viewer-wdl .wdl-status-btn .sg { font-size: 12px; line-height: 1; }
    #viewer-wdl .wdl-status-btn[data-state="ok"]    { color: #4ade80; border-color: #14532d; }
    #viewer-wdl .wdl-status-btn[data-state="busy"]  { color: #93c5fd; border-color: #1e3a5f; }
    #viewer-wdl .wdl-status-btn[data-state="dirty"] { color: #93c5fd; border-color: #1e3a5f; }
    #viewer-wdl .wdl-status-btn[data-state="warn"]  { color: #fbbf24; border-color: #78350f; background: rgba(251,191,36,.10); }
    #viewer-wdl .wdl-status-btn[data-state="err"]   { color: #f87171; border-color: #7f1d1d; background: rgba(248,113,113,.14); }
    .wdl-status-body { margin: 0; white-space: pre-wrap; word-break: break-word;
      font: 12px/1.55 ui-monospace, Menlo, Consolas, monospace; color: #94a3b8; }
    .wdl-status-body.ok { color: #4ade80; } .wdl-status-body.warn { color: #fbbf24; }
    .wdl-status-body.err { color: #f87171; } .wdl-status-body.busy { color: #93c5fd; }
    .wdl-status-body.dirty { color: #93c5fd; }
    /* Stepped edge control on the WDL's LEFT edge: ❮ grows one step (off→on→max),
       ❯ shrinks one step (max→on→off). It follows the pane's inner edge (screen
       edge when closed, 460px in when docked, the configurator's right edge when
       maximised beside an open configurator). Offset BELOW centre so it never
       overlaps the configurator's own toggle (offset ABOVE centre) when they share
       an X. Hidden in the embedded surface. */
    #wdl-ctl { position: fixed; top: calc(50% + 44px); right: 0; transform: translateY(-50%);
      z-index: 55; display: flex; flex-direction: column; align-items: flex-end; }
    #wdl-ctl .tab-lbl { writing-mode: vertical-rl; text-orientation: upright;
      font-size: 8.5px; font-weight: 800; letter-spacing: 0.5px; color: #93c5fd; background: #0d1526;
      border: 1px solid #1e293b; border-right: none; border-radius: 10px 0 0 0; width: 24px; padding: 7px 0 5px;
      text-align: center; box-shadow: -2px 0 10px rgba(0,0,0,.25); }
    #wdl-ctl .tab-lbl + button#wdl-grow { border-radius: 0; }
    #wdl-ctl button { width: 24px; height: 30px; display: flex; align-items: center; justify-content: center;
      border: 1px solid #1e293b; border-right: none; background: #0d1526; color: #93c5fd;
      font-size: 0.95rem; line-height: 1; cursor: pointer; box-shadow: -2px 0 10px rgba(0,0,0,0.25); padding: 0; }
    #wdl-ctl button:hover { background: #14203a; color: #bfdbfe; }
    #wdl-grow { border-radius: 10px 0 0 0; }
    #wdl-shrink { border-radius: 0 0 0 10px; border-top: none; }
    /* Single-visible-button states round the whole tab. */
    body[data-wdl="off"] #wdl-shrink { display: none; }
    body[data-wdl="off"] #wdl-grow { border-radius: 10px 0 0 10px; }
    body[data-wdl="max"] #wdl-grow { display: none; }
    body[data-wdl="max"] #wdl-shrink { border-radius: 10px 0 0 10px; border-top: none; }
    /* Position the control at the pane's inner (left) edge for each width. */
    body[data-wdl="on"] #wdl-ctl { right: min(460px, 46vw); }
    body[data-wdl="max"] #wdl-ctl { right: auto; left: 0; }
    body[data-wdl="max"][data-config="on"][data-left="open"] #wdl-ctl { left: 288px; }
    body[data-embed="1"] #wdl-ctl { display: none; }
    /* Language reference — a 📖 button in the head opens a slide-over cheat-sheet
       over the editor (the in-editor Langium LSP still supplies live completion/
       hover; this is the browsable overview). Scoped inside the WDL pane. */
    #viewer-wdl .wdl-head .wdl-ref-btn { flex: none; background: none; border: 1px solid #334155;
      color: #cbd5e1; border-radius: 6px; padding: 2px 9px; cursor: pointer; font: 600 12px system-ui, sans-serif; }
    #viewer-wdl .wdl-head .wdl-ref-btn:hover { background: #1e293b; color: #e2e8f0; }
    /* Shared slide-over over the editor (language reference + compile status). */
    .wdl-slideover { position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 96%);
      background: #0b1220; border-left: 1px solid #1e293b; box-shadow: -8px 0 24px rgba(0,0,0,.45);
      overflow-y: auto; z-index: 30; padding: 0 18px 40px; color: #e2e8f0; }
    .wdl-slideover[hidden] { display: none; }
    .wdl-slideover .ref-head { position: sticky; top: 0; background: #0b1220; padding: 10px 0 8px;
      display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; margin-bottom: 8px; }
    .wdl-slideover .ref-head strong { font: 600 13px system-ui, sans-serif; color: #93c5fd; }
    .wdl-slideover .ref-close { background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; line-height: 1; }
    .wdl-slideover .ref-close:hover { color: #e2e8f0; }
    #wdl-reference h2 { font-size: 1.02rem; margin: 6px 0 4px; }
    #wdl-reference h3 { font-size: .9rem; margin: 18px 0 6px; color: #60a5fa; }
    #wdl-reference .ref-dim { color: #94a3b8; font-weight: 400; font-size: .8rem; }
    #wdl-reference p { font-size: .84rem; line-height: 1.5; margin: 6px 0; }
    #wdl-reference p.ref-note { color: #94a3b8; font-size: .82rem; }
    #wdl-reference code { background: #1e293b; padding: 1px 5px; border-radius: 4px; font-size: .82em; }
    #wdl-reference pre { background: #0d1526; border: 1px solid #1e293b; border-radius: 6px; padding: 10px 12px;
      overflow-x: auto; font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; color: #d7d0c6; white-space: pre; }
    #wdl-reference pre b { color: #e0a97a; font-weight: 700; }
    #wdl-mods-btn .mods-badge { display: inline-block; margin-left: 6px; min-width: 16px; padding: 0 5px;
      border-radius: 9px; background: #b45309; color: #fff; font: 700 10px system-ui, sans-serif; line-height: 16px; text-align: center; }
    #wdl-mods-btn .mods-badge[hidden] { display: none; }
    #wdl-modules-body { font: 13px/1.5 system-ui, sans-serif; }
    #wdl-modules-body p.mod-intro { color: #94a3b8; font-size: .84rem; margin: 8px 0 4px; }
    #wdl-modules-body .mod-sec { margin: 16px 0 4px; color: #93c5fd; font-weight: 700; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; }
    #wdl-modules-body .mod-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid #1e293b; }
    #wdl-modules-body .mod-ref { font: 600 12.5px ui-monospace, Menlo, Consolas, monospace; color: #e2e8f0; word-break: break-all; flex: 1; }
    #wdl-modules-body .mod-tag { flex: none; font: 700 10px system-ui, sans-serif; padding: 2px 7px; border-radius: 999px; }
    #wdl-modules-body .mod-tag.ok { background: #14532d; color: #86efac; }
    #wdl-modules-body .mod-tag.std { background: #1e293b; color: #93c5fd; }
    #wdl-modules-body .mod-tag.missing { background: #7f1d1d; color: #fecaca; }
    #wdl-modules-body .mod-act { flex: none; background: none; border: 1px solid #334155; color: #cbd5e1;
      border-radius: 6px; padding: 3px 9px; cursor: pointer; font: 600 11px system-ui, sans-serif; }
    #wdl-modules-body .mod-act:hover { background: #1e293b; color: #e2e8f0; }
    #wdl-modules-body .mod-empty { color: #94a3b8; font-size: .85rem; margin: 6px 0; }
    #wdl-modules-body .mod-add { margin-top: 12px; margin-right: 8px; background: #2563eb; color: #fff; border: none;
      border-radius: 7px; padding: 8px 14px; cursor: pointer; font: 600 12px system-ui, sans-serif; }
    #wdl-modules-body .mod-add:hover { background: #1d4ed8; }
    #wdl-modules-body .mod-add.ghost { background: none; border: 1px solid #334155; color: #cbd5e1; }
    #wdl-modules-body .mod-add.ghost:hover { background: #1e293b; color: #e2e8f0; }
    #wdl-modules-body .mod-editor { display: flex; flex-direction: column; gap: 7px; }
    #wdl-modules-body .mod-editor label { color: #94a3b8; font-size: .78rem; font-weight: 600; margin-top: 4px; }
    #wdl-modules-body .mod-editor input { background: #0d1526; border: 1px solid #334155; color: #e2e8f0;
      border-radius: 6px; padding: 7px 9px; font: 600 12.5px ui-monospace, Menlo, Consolas, monospace; }
    #wdl-modules-body .mod-editor input[readonly] { opacity: .6; }
    #wdl-modules-body .mod-mon { height: 340px; border: 1px solid #334155; border-radius: 6px; overflow: hidden; }
    #wdl-modules-body .mod-editor-actions { display: flex; gap: 8px; margin-top: 4px; }
    #wdl-modules-body .mod-cancel { background: none; border: 1px solid #334155; color: #cbd5e1;
      border-radius: 7px; padding: 8px 14px; cursor: pointer; font: 600 12px system-ui, sans-serif; }
    #wdl-modules-body .mod-cancel:hover { background: #1e293b; color: #e2e8f0; }
    #wdl-modules-body .mod-err { color: #fecaca; font-size: .8rem; white-space: pre-wrap; margin-top: 2px; }
    #wdl-modules-body .mod-err[hidden] { display: none; }`;
  document.head.appendChild(style);

  const aside = document.createElement("aside");
  aside.id = "viewer-wdl";
  aside.setAttribute("aria-label", "WDL source");
  aside.innerHTML =
    `<div class="wdl-head"><span>WDL <span class="sub">the model's source · ⌘↵ to apply</span></span>` +
    `<div class="wdl-head-actions">` +
    `<button class="wdl-status-btn" id="wdl-status-btn" data-state="ok" title="Compile status">` +
    `<span class="sg">✓</span><span class="sl">OK</span></button>` +
    `<button class="wdl-ref-btn" id="wdl-mods-btn" title="Component modules this model imports">🧩 Modules<span class="mods-badge" id="wdl-mods-badge" hidden></span></button>` +
    `<button class="wdl-ref-btn" id="wdl-ref-btn" title="Language reference (.wdl cheat-sheet)">📖 Reference</button>` +
    `</div></div>` +
    `<div id="wdl-editor"></div>` +
    `<div class="wdl-foot">` +
    `<button class="wdl-apply" id="wdl-apply" disabled>Apply changes<span class="k">⌘↵</span></button>` +
    `<button class="wdl-btn" id="wdl-load" title="Load a .wdl file into the editor">📂 Load .wdl</button>` +
    `<button class="wdl-btn" id="wdl-save" title="Save the WDL source as a .wdl file">💾 Save .wdl</button></div>` +
    `<div id="wdl-reference" class="wdl-slideover" hidden><div class="ref-head"><strong>.wdl language reference</strong>` +
    `<button class="ref-close" id="wdl-ref-close" title="Close" aria-label="Close reference">×</button></div>` +
    `<div id="wdl-ref-body"></div></div>` +
    `<div id="wdl-status-panel" class="wdl-slideover" hidden><div class="ref-head">` +
    `<strong id="wdl-status-title">Compile status</strong>` +
    `<button class="ref-close" id="wdl-status-close" title="Close" aria-label="Close status">×</button></div>` +
    `<pre class="wdl-status-body ok" id="wdl-status-body">The WDL compiles cleanly — no issues.</pre></div>` +
    `<div id="wdl-modules-panel" class="wdl-slideover" hidden><div class="ref-head">` +
    `<strong>Component modules</strong>` +
    `<button class="ref-close" id="wdl-modules-close" title="Close" aria-label="Close modules">×</button></div>` +
    `<div id="wdl-modules-body"></div></div>`;
  container.appendChild(aside);

  // Stepped right-edge control: ❮ grows (off→on→max), ❯ shrinks (max→on→off).
  // One control handles BOTH visibility and full-width — no separate maximize
  // button. Offset below centre so it never overlaps the configurator's toggle.
  const wdlCtl = document.createElement("div");
  wdlCtl.id = "wdl-ctl";
  wdlCtl.innerHTML =
    `<span class="tab-lbl" aria-hidden="true">WDL</span>` +
    `<button id="wdl-grow" type="button" title="Widen the WDL editor" aria-label="Widen the WDL editor">❮</button>` +
    `<button id="wdl-shrink" type="button" title="Narrow / close the WDL editor" aria-label="Narrow the WDL editor">❯</button>`;
  container.appendChild(wdlCtl);

  // Always-on for humans; hidden in the embedded/agent surface (?panels=off).
  const embedded = new URLSearchParams(window.location.search).get("panels") === "off";
  let storedWdl: string | null = null;
  try { storedWdl = localStorage.getItem(WDL_PANEL_KEY); } catch { /* ignore */ }
  // Default CLOSED (the configurator is the everyday surface; grow the WDL editor
  // with ❮). A stored "on"/"max" preference reopens it; embed hides it.
  const initWdl = storedWdl === "on" || storedWdl === "max" ? storedWdl : "off";
  document.body.dataset.wdl = embedded ? "off" : initWdl;

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

  const host = document.getElementById("wdl-editor") as HTMLElement;
  const applyBtn = document.getElementById("wdl-apply") as HTMLButtonElement;

  // Compile status lives in a HEADER pill (a state-coloured glyph+label) plus a
  // slide-over that shows the full message — freeing the footer and giving parse
  // errors real room. The pill highlights on warnings/errors; the panel auto-opens
  // on an error so the message is seen without a click.
  const statusBtn = document.getElementById("wdl-status-btn") as HTMLButtonElement;
  const statusPanel = document.getElementById("wdl-status-panel") as HTMLElement;
  const statusBody = document.getElementById("wdl-status-body") as HTMLElement;
  const statusTitle = document.getElementById("wdl-status-title") as HTMLElement;
  const refPanel = document.getElementById("wdl-reference") as HTMLElement;
  const STATUS_META: Record<string, { glyph: string; label: string; title: string }> = {
    "":    { glyph: "✓", label: "OK",        title: "Compile status" },
    ok:    { glyph: "✓", label: "OK",        title: "No issues" },
    busy:  { glyph: "⋯", label: "…",         title: "Compiling" },
    dirty: { glyph: "●", label: "Unapplied", title: "Unapplied changes" },
    warn:  { glyph: "⚠", label: "Warnings",  title: "Warnings" },
    err:   { glyph: "✖", label: "Errors",    title: "Errors" },
  };
  // The pill folds TWO signals: the WDL compile result (from Apply / dirty
  // tracking) and the model's geometry-expansion warnings (from House3D — the old
  // header chip's job, now shown here). A compile error dominates; otherwise
  // geometry issues raise the pill to ⚠ and list in the panel.
  let compileCls = "";
  let compileMsg = "";
  let geomWarnings: string[] = [];
  const effectiveState = (): string => {
    if (compileCls === "busy") return "busy";
    if (compileCls === "err") return "err";
    if (compileCls === "dirty") return "dirty";
    if (geomWarnings.length) return "warn"; // compile ok/warn/idle + geometry issues
    return compileCls; // "", "ok", or "warn"
  };
  const paintStatus = (): void => {
    const eff = effectiveState();
    const m = STATUS_META[eff] ?? STATUS_META[""];
    statusBtn.dataset.state = eff || "ok";
    statusBtn.innerHTML = `<span class="sg">${m.glyph}</span><span class="sl">${m.label}</span>`;
    statusBtn.title = compileMsg ? compileMsg.split("\n")[0] : m.title;
    statusTitle.textContent = m.title;
    let body = compileMsg || (geomWarnings.length ? "" : "The WDL compiles cleanly — no issues.");
    if (geomWarnings.length) {
      body =
        (body ? body + "\n\n" : "") +
        `⚠ Geometry (${geomWarnings.length}) — openings/walls dropped during expansion:\n` +
        geomWarnings.map((w) => `  • ${w}`).join("\n");
    }
    statusBody.textContent = body;
    statusBody.className = "wdl-status-body " + (eff || "ok");
  };
  const setStatus = (cls: string, msg: string): void => {
    compileCls = cls; compileMsg = msg;
    paintStatus();
    // Auto-open the panel on a fresh compile ERROR so a parse error is seen at once;
    // a warning just highlights the pill (the message is a click away).
    if (cls === "err") { refPanel.hidden = true; statusPanel.hidden = false; statusPanel.scrollTop = 0; }
  };
  const setGeomWarnings = (list: string[]): void => { geomWarnings = list; paintStatus(); };
  // Toggle the status slide-over; mutually exclusive with the reference panel.
  (statusBtn).onclick = () => {
    if (!statusPanel.hidden) { statusPanel.hidden = true; return; }
    refPanel.hidden = true;
    statusPanel.hidden = false;
    statusPanel.scrollTop = 0;
  };
  (document.getElementById("wdl-status-close") as HTMLButtonElement).onclick = () => {
    statusPanel.hidden = true;
  };
  // Fold House3D's geometry-expansion warnings into this status surface (the old
  // header chip is retired). Same `wadi-geometry-warnings` event + stored seed.
  window.addEventListener("wadi-geometry-warnings", (e) =>
    setGeomWarnings((e as CustomEvent<string[]>).detail ?? []),
  );
  setGeomWarnings(
    (window as unknown as { __geometryWarnings?: string[] }).__geometryWarnings ?? [],
  );

  // The code editor is Monaco (syntax highlighting + Langium completion/hover/
  // go-to-def/rename), reused from the DSL playground and LAZY-loaded on first
  // open. Until it mounts, the text lives in `pending`; get/set go through the
  // handle once it's up. See wdlMonaco.ts.
  let handle: import("./wdlMonaco").WdlEditorHandle | null = null;
  let mounting = false;
  let pending = useConfigStore.getState().wdl ?? "";
  const getVal = (): string => (handle ? handle.getValue() : pending);
  const setVal = (v: string): void => { pending = v; handle?.setValue(v); };

  // `applied` = the WDL currently realized in the 3D model. The editor is DIRTY
  // when its text differs. Changes are applied ONLY on demand (the Apply button or
  // ⌘/Ctrl+Enter) — never automatically — so a half-typed edit never compiles.
  let applied = useConfigStore.getState().wdl ?? "";
  const isDirty = (): boolean => getVal() !== applied;
  const reflectDirty = (): void => {
    const dirty = isDirty();
    applyBtn.disabled = !dirty;
    document.body.dataset.wdlDirty = dirty ? "on" : "off";
    if (dirty) setStatus("dirty", "Unapplied changes — Apply (⌘↵) to update the 3D.");
    else if (compileCls === "dirty") setStatus("", "");
  };

  // Adopt the model's WDL when it changes from ELSEWHERE (a template load, undo, a
  // screenshot adding a thumbnail path) — but never clobber the user's in-progress
  // edits.
  const syncFromStore = (): void => {
    const wdl = useConfigStore.getState().wdl ?? "";
    if (wdl === applied || isDirty()) return;
    setVal(wdl); applied = wdl;
    // Surface the structural check of the newly-adopted model (an agent's setWdl,
    // a template load, undo) in the pill — otherwise warnings only ever appeared
    // on a manual Apply, so an agent's edit looked clean here.
    const s = statusFromCheck(checkBrief(useConfigStore.getState().config));
    setStatus(s.cls, s.body);
    reflectDirty();
  };
  useConfigStore.subscribe(syncFromStore);
  reflectDirty();

  // Lazily bring up Monaco the first time the pane is shown. Heavy (Monaco +
  // Langium LSP), so it never loads for a visitor who leaves the WDL pane closed.
  const ensureMounted = async (): Promise<void> => {
    if (handle || mounting) return;
    mounting = true;
    setStatus("busy", "Loading the code editor…");
    try {
      const { mountWdlMonaco } = await import("./wdlMonaco");
      handle = mountWdlMonaco(host, pending);
      handle.onChange(() => { pending = handle!.getValue(); reflectDirty(); });
      handle.onApplyShortcut(() => { if (isDirty()) void apply(); });
      setStatus("", "");
      syncFromStore(); // adopt anything that changed while loading
      reflectDirty();
      handle.focus();
    } catch (e) {
      setStatus("err", "Couldn't load the code editor: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      mounting = false;
    }
  };

  const apply = async (): Promise<void> => {
    const src = getVal();
    setStatus("busy", "Compiling…");
    // Compile against the model's custom modules so imports resolve. loadConfig omits
    // `modules` (below) so the current module list is preserved across an Apply.
    const res = await wdlToConfig(src, useConfigStore.getState().modules);
    if (!res.ok || !res.config) { setStatus("err", "✖ " + res.errors.join("\n")); return; }
    const st = useConfigStore.getState();
    // WDL is the SOURCE: keep the author's exact text (don't re-decompile). Pass the
    // current modules back so an Apply preserves the model's custom module list.
    st.loadConfig(res.config, st.filename ?? undefined, st.filePath, src, st.modules);
    markHomeChosen();
    applied = src; reflectDirty();
    // The scene renders on demand, and Apply is a click/keydown, but force the
    // repaint anyway (now + next frame) so the new model paints immediately.
    window.wadiInvalidate?.();
    requestAnimationFrame(() => window.wadiInvalidate?.());
    const s = statusFromCheck(checkBrief(useConfigStore.getState().config));
    if (s.cls === "") setStatus("ok", "✓ Applied — no structural issues.");
    else setStatus(s.cls, s.body);
  };

  applyBtn.onclick = () => { void apply(); };

  // Register the flush hook so a header Save writes what's in THIS editor: apply
  // any unapplied edit (compile it → store.wdl updates) before the bundle is
  // written. Returns true when store.wdl is current (nothing pending, or the
  // pending edit compiled), false when the pending edit fails to compile.
  flushWdlEditor = async (): Promise<boolean> => {
    if (!isDirty()) return true;
    await apply();
    return !isDirty(); // apply() clears dirty only on a successful compile
  };

  // Save the WDL source itself as a standalone `.wdl` file (raw code, no
  // thumbnails) — the in-viewer editor replaces the retired DSL playground, so it
  // owns saving the source. Saves exactly what's in the editor (unapplied edits
  // included). The whole model + previews still save as a `.wadi` bundle via the
  // header Save.
  const saveWdlBtn = document.getElementById("wdl-save") as HTMLButtonElement;
  saveWdlBtn.onclick = async () => {
    const base = (useConfigStore.getState().filename ?? "house")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .replace(/\.(wadi|json|wdl)$/i, "")
      .trim() || "house";
    try {
      const saved = await saveText(getVal(), `${base}.wdl`, "WDL source", ["wdl"], "text/plain");
      setStatus("ok", saved ? `✓ Saved ${base}.wdl` : "✓ Downloaded .wdl");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") setStatus("err", `Save failed: ${msg}`);
    }
  };

  // Load a .wdl file from disk INTO the editor, then compile + load it as the live
  // model. A plain file input works in the browser and the Tauri webview alike.
  const loadWdlBtn = document.getElementById("wdl-load") as HTMLButtonElement;
  loadWdlBtn.onclick = async () => {
    // In the desktop app this picks via the native dialog and returns the file's
    // absolute path, so we can watch it: a coding agent editing that `.wdl` on disk
    // (via the offline MCP server) then live-updates the app. In a browser there is
    // no path, so no local watch (agent edits reach the web app over the MCP relay).
    let picked: { text: string; filename: string; filePath: string | null; modules: Record<string, string> } | null;
    try {
      picked = await pickAndReadWdl();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m !== "Cancelled") setStatus("err", "Couldn't read that file.");
      return;
    }
    if (!picked) return;
    const { text, filename, filePath, modules } = picked;
    // Loading replaces the current house — offer to save unsaved work first.
    if (!(await guardUnsaved("loading a .wdl file"))) return;
    setVal(text);
    pending = text;
    setStatus("busy", "Compiling…");
    // `modules` are the component .wdl files found next to this one (desktop); they let
    // `import "…"` resolve and get bundled into a later Save.
    const res = await wdlToConfig(text, modules);
    if (!res.ok || !res.config) {
      // Leave the (bad) WDL in the editor so the user can see + fix the error.
      applied = "";
      reflectDirty();
      setStatus("err", "✖ " + res.errors.join("\n"));
      return;
    }
    const base = filename.replace(/\.wdl$/i, "") || "house";
    useConfigStore.getState().loadConfig(res.config, `${base}.wdl`, filePath, text, modules);
    markHomeChosen();
    closeNewHouseModal();
    // Fresh file = new baseline; Ctrl+Z shouldn't revert to the previous model.
    useConfigStore.temporal.getState().clear();
    applied = text;
    reflectDirty();
    window.wadiInvalidate?.();
    const s = statusFromCheck(checkBrief(useConfigStore.getState().config));
    if (s.cls === "") {
      setStatus("ok", filePath ? `✓ Loaded ${base}.wdl (watching for changes)` : `✓ Loaded ${base}.wdl`);
    } else {
      setStatus(s.cls, s.body);
    }
  };

  // Language-reference slide-over: a browsable .wdl cheat-sheet over the editor.
  // The content is a chunky static string, lazy-loaded on first open so it never
  // weighs on a closed pane. The in-editor Langium LSP still gives live
  // completion/hover; this is the at-a-glance overview.
  // (refPanel is declared with the status wiring above.)
  const refBody = document.getElementById("wdl-ref-body") as HTMLElement;
  let refLoaded = false;
  const toggleReference = async (): Promise<void> => {
    if (!refPanel.hidden) { refPanel.hidden = true; return; }
    if (!refLoaded) {
      refBody.innerHTML = "<p class=\"ref-note\">Loading…</p>";
      try {
        const { REFERENCE_HTML } = await import("./wdlReference");
        refBody.innerHTML = REFERENCE_HTML;
        refLoaded = true;
      } catch (e) {
        refBody.innerHTML = "<p class=\"ref-note\">Couldn't load the reference: " +
          (e instanceof Error ? e.message : String(e)) + "</p>";
      }
    }
    statusPanel.hidden = true; // mutually exclusive with the status slide-over
    refPanel.hidden = false;
    refPanel.scrollTop = 0;
  };
  (document.getElementById("wdl-ref-btn") as HTMLButtonElement).onclick = () => { void toggleReference(); };
  (document.getElementById("wdl-ref-close") as HTMLButtonElement).onclick = () => { refPanel.hidden = true; };

  // ---- Component modules panel ----------------------------------------------
  // Lists the modules the current WDL `import`s, tags each (bundled custom / inbuilt
  // std / missing), and lets a human add a component `.wdl` (which the resolver then
  // uses and a save writes into the `.wadi`). The agent path (WebMCP/MCP add-module)
  // is Phase 2; this is the manual surface.
  const modsBtn = document.getElementById("wdl-mods-btn") as HTMLButtonElement;
  const modsBadge = document.getElementById("wdl-mods-badge") as HTMLElement;
  const modsPanel = document.getElementById("wdl-modules-panel") as HTMLElement;
  const modsBody = document.getElementById("wdl-modules-body") as HTMLElement;

  // The std-pack resolver (std-furniture, konkan/base) is ~24KB of `.wdl` text, so it
  // loads lazily to keep it out of the eager viewer bundle. Until it lands, a std
  // import shows as "missing" for a few ms, then the badge/panel refresh.
  let stdResolve: ((ref: string) => string | undefined) | null = null;
  void import("../io/stdModules").then((m) => { stdResolve = m.stdResolveModule; updateModsBadge(); });

  // The module code editor's Monaco instance (when the editor view is open). Disposed
  // whenever we leave that view so it never leaks.
  let moduleEditor: import("./wdlMonaco").WdlEditorHandle | null = null;
  const disposeModuleEditor = (): void => { moduleEditor?.dispose(); moduleEditor = null; };

  const importRefs = (): string[] => {
    const out: string[] = [];
    const re = /^\s*import\s+"([^"]+)"/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(getVal())) !== null) out.push(m[1]);
    return Array.from(new Set(out));
  };
  const modStatus = (ref: string): "ok" | "std" | "missing" => {
    if (ref in useConfigStore.getState().modules) return "ok";
    return stdResolve?.(ref) !== undefined ? "std" : "missing";
  };
  const updateModsBadge = (): void => {
    const missing = importRefs().filter((r) => modStatus(r) === "missing").length;
    if (missing > 0) { modsBadge.textContent = String(missing); modsBadge.hidden = false; }
    else modsBadge.hidden = true;
  };

  const pickModuleInto = async (ref?: string): Promise<void> => {
    let picked: { text: string; filename: string; filePath: string | null } | null;
    try {
      picked = await pickAndReadWdl();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") setStatus("err", "Couldn't read that file.");
      return;
    }
    if (!picked) return;
    const key = ref ?? picked.filename.replace(/\.wdl$/i, "");
    useConfigStore.getState().addModule(key, picked.text);
    renderModules();
    void apply(); // recompile so the new module resolves and the model updates
  };

  const escMod = (s: string): string =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

  // The code editor for a module — the SAME Monaco WDL editor (highlighting + LSP) as
  // the main pane, mounted into the panel. Create a new module or edit an existing
  // custom one. Saving stores the module and re-applies, so any error in the component
  // surfaces in the compile status.
  const openModuleEditor = (ref?: string, initialSrc?: string): void => {
    disposeModuleEditor();
    const isEdit = ref !== undefined && ref in useConfigStore.getState().modules;
    const src0 =
      initialSrc ??
      (ref ? useConfigStore.getState().modules[ref] ?? "" :
        `component MyComponent {\n  // Reusable objects in LOCAL coords (origin 0,0):\n  //   item, room, wall, slab, beam, pillar, staircase, …\n}\n`);
    modsBody.innerHTML =
      `<div class="mod-sec">${isEdit ? "Edit module" : "New module"}</div>` +
      `<div class="mod-editor">` +
      `<label for="mod-ed-ref">Module name (the import ref)</label>` +
      `<input id="mod-ed-ref" type="text" placeholder="e.g. dining-set" value="${escMod(ref ?? "")}" ${isEdit ? "readonly" : ""}/>` +
      `<label>Component <code>.wdl</code> source</label>` +
      `<div id="mod-ed-editor" class="mod-mon"></div>` +
      `<div class="mod-err" id="mod-ed-err" hidden></div>` +
      `<div class="mod-editor-actions">` +
      `<button class="mod-add" id="mod-ed-save">Save module<span class="k" style="opacity:.7;font-weight:400;margin-left:5px">⌘↵</span></button>` +
      `<button class="mod-cancel" id="mod-ed-cancel">Cancel</button>` +
      `</div></div>`;
    const errEl = document.getElementById("mod-ed-err") as HTMLElement;
    const refInput = document.getElementById("mod-ed-ref") as HTMLInputElement;
    const saveModule = (): void => {
      const key = refInput.value.trim();
      const code = moduleEditor ? moduleEditor.getValue() : src0;
      if (!key) { errEl.hidden = false; errEl.textContent = "Give the module a name (the import ref)."; return; }
      if (!code.trim()) { errEl.hidden = false; errEl.textContent = "The module source is empty."; return; }
      useConfigStore.getState().addModule(key, code);
      disposeModuleEditor();
      renderModules();
      void apply();
    };
    (document.getElementById("mod-ed-cancel") as HTMLButtonElement).onclick = () => { disposeModuleEditor(); renderModules(); };
    (document.getElementById("mod-ed-save") as HTMLButtonElement).onclick = () => saveModule();
    // Mount the shared Monaco WDL editor lazily (same code-split chunk as the main pane).
    const host = document.getElementById("mod-ed-editor") as HTMLElement;
    void import("./wdlMonaco").then(({ mountWdlMonaco }) => {
      // The view may have changed while the chunk loaded; only mount if still present.
      if (!host.isConnected) return;
      moduleEditor = mountWdlMonaco(host, src0);
      moduleEditor.onApplyShortcut(() => saveModule());
      moduleEditor.focus();
    });
  };

  const renderModules = (): void => {
    disposeModuleEditor(); // leaving the editor view (if any)
    const store = useConfigStore.getState();
    const refs = importRefs();
    const orphans = Object.keys(store.modules).filter((r) => !refs.includes(r));
    let html =
      `<p class="mod-intro">Component <code>.wdl</code> files this model imports. Custom modules are saved inside the <code>.wadi</code> so the design stays self-contained; inbuilt packs (furniture, konkan) are always available.</p>` +
      `<div class="mod-sec">Imports in this model</div>`;
    if (!refs.length) html += `<p class="mod-empty">No <code>import</code> statements yet.</p>`;
    for (const ref of refs) {
      const st = modStatus(ref);
      const tag =
        st === "ok" ? `<span class="mod-tag ok">bundled</span>`
        : st === "std" ? `<span class="mod-tag std">inbuilt</span>`
        : `<span class="mod-tag missing">missing</span>`;
      let act = "";
      if (st === "missing") {
        act = `<button class="mod-act" data-new="${escMod(ref)}">Create</button>` +
          `<button class="mod-act" data-add="${escMod(ref)}">Add .wdl</button>`;
      } else if (st === "ok") {
        act = `<button class="mod-act" data-edit="${escMod(ref)}">Edit</button>` +
          `<button class="mod-act" data-add="${escMod(ref)}">Replace</button>` +
          `<button class="mod-act" data-remove="${escMod(ref)}">Remove</button>`;
      }
      html += `<div class="mod-row"><span class="mod-ref">${escMod(ref)}</span>${tag}${act}</div>`;
    }
    if (orphans.length) {
      html += `<div class="mod-sec">Added, not imported</div>`;
      for (const ref of orphans) {
        html += `<div class="mod-row"><span class="mod-ref">${escMod(ref)}</span><span class="mod-tag ok">bundled</span>` +
          `<button class="mod-act" data-edit="${escMod(ref)}">Edit</button>` +
          `<button class="mod-act" data-remove="${escMod(ref)}">Remove</button></div>`;
      }
    }
    html += `<button class="mod-add" id="wdl-mod-new">＋ New module (edit code)</button>` +
      `<button class="mod-add ghost" id="wdl-mod-add">Add a .wdl file</button>`;
    modsBody.innerHTML = html;
    modsBody.querySelectorAll<HTMLElement>("[data-add]").forEach((b) => {
      b.onclick = () => void pickModuleInto(b.dataset.add);
    });
    modsBody.querySelectorAll<HTMLElement>("[data-edit]").forEach((b) => {
      b.onclick = () => openModuleEditor(b.dataset.edit);
    });
    modsBody.querySelectorAll<HTMLElement>("[data-new]").forEach((b) => {
      // A missing import → author it now, ref pre-filled from the import.
      b.onclick = () => openModuleEditor(b.dataset.new);
    });
    modsBody.querySelectorAll<HTMLElement>("[data-remove]").forEach((b) => {
      b.onclick = () => {
        useConfigStore.getState().removeModule(b.dataset.remove!);
        renderModules();
        void apply();
      };
    });
    (document.getElementById("wdl-mod-new") as HTMLButtonElement).onclick = () => openModuleEditor();
    (document.getElementById("wdl-mod-add") as HTMLButtonElement).onclick = () => void pickModuleInto();
  };

  const toggleModules = (): void => {
    if (!modsPanel.hidden) { disposeModuleEditor(); modsPanel.hidden = true; return; }
    renderModules();
    refPanel.hidden = true;
    statusPanel.hidden = true;
    modsPanel.hidden = false;
    modsPanel.scrollTop = 0;
  };
  modsBtn.onclick = () => toggleModules();
  (document.getElementById("wdl-modules-close") as HTMLButtonElement).onclick = () => { disposeModuleEditor(); modsPanel.hidden = true; };
  // Keep the badge (missing-import count) live as the model/modules change.
  useConfigStore.subscribe(() => updateModsBadge());
  updateModsBadge();

  // The stepped control. ❮ grows one step (off→on→max), ❯ shrinks one step
  // (max→on→off). CSS shows/hides each button per state (❯ hidden when off, ❮
  // hidden when max). The width state persists in one key.
  const setWdl = (s: "off" | "on" | "max"): void => {
    document.body.dataset.wdl = s;
    try { localStorage.setItem(WDL_PANEL_KEY, s); } catch { /* ignore */ }
    if (s !== "off") { void ensureMounted(); syncFromStore(); }
    refit();
    handle?.layout();
  };
  const grow = (): void => setWdl(document.body.dataset.wdl === "off" ? "on" : "max");
  const shrink = (): void => setWdl(document.body.dataset.wdl === "max" ? "on" : "off");
  (document.getElementById("wdl-grow") as HTMLButtonElement).onclick = grow;
  (document.getElementById("wdl-shrink") as HTMLButtonElement).onclick = shrink;

  // If the pane is open on load (a stored on/max preference), bring Monaco up now.
  if (document.body.dataset.wdl !== "off") void ensureMounted();
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
  // A model was loaded (by the user OR programmatically, e.g. an agent's setWdl or
  // a live co-edit push). Dismiss the "Choose your home" dialog if it's still up,
  // so the loaded model is visible instead of hidden behind it.
  closeNewHouseModal();
}

function wireOwnerWelcome(): void {
  document
    .getElementById("ow-choose")
    ?.addEventListener("click", () => void openNewModal());
  document
    .getElementById("ow-open")
    ?.addEventListener("click", () => void openMyModelsModal());
}

// Pick a SAMPLE from the New gallery. Samples always come from Wadi's DEFAULT
// source (R2), even when the user has an Open FOLDER configured — otherwise we'd
// look for the sample in their folder (File System Access) and hit "file not
// found". A sample is a TEMPLATE: a new, unsaved house (no filePath → Save is Save
// As). Opening the user's OWN files goes through openFolderFile, not here.
async function selectTemplate(t: TemplateEntry): Promise<void> {
  // Loading a model replaces the current house — offer to save first.
  if (!(await guardUnsaved("creating a new house"))) return;
  try {
    const bytes = await fetchCatalogBytes(t.file, { kind: "default" });
    const loaded = await parseConfigBytes(bytes, t.file);
    useConfigStore.getState().loadConfig(loaded.config, `${t.title} (template)`, null, loaded.wdl);
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
