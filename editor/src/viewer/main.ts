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
import type { HouseConfig } from "../svg2d/expand";
import { generateAllFloorPlans } from "../svg2d/floorPlansAll";
import { generateCombinedFloorPlans } from "../svg2d/floorPlansCombined";
import { generateCompositeSheet } from "../svg2d/compositeSheet";
import type { DrawFilter } from "../svg2d/drawFilter";
import { objectKey } from "../svg2d/drawFilter";
import { effectiveLayers, heuristicLayerId } from "../three/layers";
import { generateAllElevations } from "../svg2d/elevationsAll";
import { generateCombinedElevations } from "../svg2d/elevationsCombined";
import { computeRoofSections } from "../svg2d/roof/index";
import { computeAllRoofs } from "../svg2d/roof/geometry";
import { generateGablePanels } from "../svg2d/roof/gableCompose";
import { collectAllGableMembers, gableTileContribution } from "../svg2d/roof/gableBom";
import { generateFlatPanels, collectAllFlatMembers, flatTileContribution } from "../svg2d/roof/flatCompose";
import { generateShedPanels, collectAllShedMembers, shedTileContribution } from "../svg2d/roof/shedCompose";
import { frameBomHtml, metalBomHtml, roofMaterialBomHtml, readTileDensities, readMetalStock } from "../svg2d/roof/htmlBom";
import { collectV2AsLegacyFrameMembers } from "../svg2d/roof/v2/computeFromHouse";
import { computeMergedV2Spec } from "../svg2d/roof/v2/computeFromHouse";
import { ridgeRunFt, slopeAreaSft } from "../svg2d/roof/v2/bom";
import { expandRoomWalls } from "../svg2d/expand";
import { generateAllPillarSvgs } from "../svg2d/pillar/index";
import { computeWallAreas } from "../estimate/wallArea";
import { wallAreaHtml } from "../estimate/wallAreaHtml";
import { setDimensionUnits } from "../svg2d/format";
import { setTextScale, computeTextScale, houseSpanUnits } from "../svg2d/config";
import {
  pickAndLoadConfig,
  loadConfigFromPath,
  saveConfig,
  saveAsWadi,
  saveText,
  saveBinary,
} from "../io/fileIO";
import {
  encodeConfigToHash,
  decodeConfigFromHash,
  buildShareUrl,
} from "../io/shareLink";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeText as tauriClipboardWrite } from "@tauri-apps/plugin-clipboard-manager";
import { Sidebar } from "../components/Sidebar";
import { PropertyPanel } from "../components/PropertyPanel";
import { mountViewer3D, mountViewerLayerPanel, mountViewerLightingPanel, mountViewerInteriorPanel } from "./mount3D";
import { startConfigWatcher } from "./configWatcher";

// Root-absolute so they resolve to the site root no matter where the app
// is served from (it lives at /app/, its data assets stay at the root).
// The generated 2d/ tab content is intercepted by patchFetch and never
// hits the network, so only these real-file fetches need the leading "/".
const CONFIG_URL = "/house_config.json";
const EAVE_CROSS_SECTION_URL = "/2d/roof/roof-cross-section.svg";
const EDIT_MODE_KEY = "wadi:edit-mode";

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
  if (!loadedFromOpenFile && location.hash.length > 1) {
    const looksLikeShareLink = /^#w1=/.test(location.hash);
    const raw = await decodeConfigFromHash(location.hash);
    if (raw) {
      const parsed = validate(raw);
      if (parsed.ok && parsed.data) {
        useConfigStore.getState().loadConfig(parsed.data, "shared link");
        loadedFromHash = true;
      } else {
        console.warn("viewer: shared-link config failed validation", parsed.errors);
        shareLinkError =
          "This shared link couldn't be opened — it may have been created with a newer version of Wadi. Showing the default house instead.";
      }
    } else if (looksLikeShareLink) {
      shareLinkError =
        "This shared link is corrupt or truncated and couldn't be opened. Showing the default house instead.";
    }
  }

  // Auto-load the JSON if it's next to the viewer (docs/house_config.json)
  // — unless a shared link already provided one. We validate and stuff
  // into useConfigStore so both the edit UI and the SVG generators pick
  // it up.
  if (!loadedFromOpenFile && !loadedFromHash) {
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

  // Mount the Three.js scene + layer panel. Both subscribe to
  // useConfigStore internally, so property-panel edits re-render the
  // scene automatically.
  const threeContainer = document.getElementById("viewer-3d-scene");
  if (threeContainer) mountViewer3D(threeContainer);
  const layerContainer = document.getElementById("viewer-layer-list");
  if (layerContainer) mountViewerLayerPanel(layerContainer);
  const lightingContainer = document.getElementById("viewer-lighting-list");
  if (lightingContainer) mountViewerLightingPanel(lightingContainer);
  const interiorContainer = document.getElementById("viewer-interior-panel");
  if (interiorContainer) mountViewerInteriorPanel(interiorContainer);

  // Mount the editor's Sidebar (object tree) and PropertyPanel
  // (per-object form) into the two edit slots. React state via
  // useConfigStore is shared with everything else, so an edit here
  // rebuilds the SVGs + re-renders the 3D scene via subscribeConfig
  // below.
  mountEditPanels();

  // Reactivity: whenever config mutates, rebuild the SVG map and
  // force the currently-visible tab to reload from the fresh strings.
  subscribeConfig();

  // Header buttons: Edit toggle, Load, Save, Undo, Redo.
  wireHeaderButtons();
  // Standard keyboard shortcuts (⌘/Ctrl + S / ⇧S / O / N / Z / ⇧Z, ⌘Y).
  wireKeyboardShortcuts();
  // Offer to save unsaved changes before the app/tab closes.
  wireCloseGuard();
  // Expose window.exportCurrentSvg for the inline lightbox toolbar.
  wireExports();
  // Expose the on-demand Layout render + panel metadata.
  wireLayoutApi();
  // Surface geometry warnings (invalid openings dropped during expansion)
  // as a banner instead of silently blanking the 3D model.
  wireGeometryWarnings();
  applyStoredEditMode();

  // Live-preview loop (Tauri only): poll the loaded config file and
  // reload the model when an external editor (Claude Code / MCP) writes
  // it. No-op in a plain browser tab.
  startConfigWatcher();
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
    useConfigStore.getState().loadConfig(res.config, res.filename, res.filePath);
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
    const saved = await saveConfig(st.config, st.filePath, st.filename ?? undefined);
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
  // Roof pipeline throws on incomplete hip_roof configs (e.g. missing
  // trusses.positions). Swallow the error so a partial config still
  // renders floor plans + elevations — the roof tab will just show its
  // empty state until the user fills in the required fields.
  // Publish result to window.__roofBomDebug so the on-screen debug badge
  // (🐞) can surface why the roof is missing without needing DevTools.
  let roof: ReturnType<typeof computeRoofSections> = null;
  // Snapshot the actual hip_roof object post-validate — so the debug
  // badge can show whether `trusses` survived the schema pass and
  // whether the fields the compute needs are there.
  let hipRoofSnapshot: Record<string, unknown> | null = null;
  for (const f of cfg.floors ?? []) {
    for (const o of f.objects ?? []) {
      if ((o as { type?: string }).type === "hip_roof") {
        hipRoofSnapshot = o as unknown as Record<string, unknown>;
        break;
      }
    }
    if (hipRoofSnapshot) break;
  }
  try {
    roof = computeRoofSections(cfg, { eaveCrossSectionSvg: eaveSvg });
    (window as unknown as { __roofBomDebug?: unknown }).__roofBomDebug = {
      status: roof ? "ok" : "no-roof",
      hipRoofInConfig: !!hipRoofSnapshot,
      hipRoofKeys: hipRoofSnapshot ? Object.keys(hipRoofSnapshot) : [],
      hipRoofSnapshot,
      panelCount: roof?.panels.length ?? 0,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[roof] compute failed, skipping roof panels:", msg, e);
    (window as unknown as { __roofBomDebug?: unknown }).__roofBomDebug = {
      status: "error",
      hipRoofInConfig: !!hipRoofSnapshot,
      hipRoofKeys: hipRoofSnapshot ? Object.keys(hipRoofSnapshot) : [],
      hipRoofSnapshot,
      error: msg,
    };
    window.roofBomManifest = [];
  }
  // Hip pipeline output (SVG panels + master + manifest). May be null
  // when there's no hip_roof or the config is incomplete.
  if (roof) {
    svgMap.set(`2d/roof/${roof.master.filename}`, roof.master.content);
    for (const p of roof.panels) {
      svgMap.set(`2d/roof/${p.filename}`, p.content);
    }
  }
  // Gable panels — MVP top view + cross-section per gable_roof. Runs
  // regardless of whether hip_roof exists; the two sets are merged
  // into the same roof_panels.json manifest below.
  const gablePanels = generateGablePanels(cfg);
  for (const gp of gablePanels) {
    svgMap.set(`2d/roof/${gp.filename}`, gp.content);
  }
  const flatPanels = generateFlatPanels(cfg);
  for (const p of flatPanels) {
    svgMap.set(`2d/roof/${p.filename}`, p.content);
  }
  const shedPanels = generateShedPanels(cfg);
  for (const p of shedPanels) {
    svgMap.set(`2d/roof/${p.filename}`, p.content);
  }
  // Always publish a roof_panels.json — hip + gable + flat + shed
  // entries merged into one manifest so the viewer's loadRoofPanels
  // loop finds them all. Empty = viewer's own empty state.
  const hipManifestEntries: Array<Record<string, unknown>> = roof
    ? (JSON.parse(roof.manifest.content) as Array<Record<string, unknown>>)
    : [];
  const toManifest = (p: { id: string; title: string; filename: string; width: number; height: number }) => ({
    id: p.id, title: p.title, file: p.filename, width: p.width, height: p.height,
  });
  const mergedManifest = [
    ...hipManifestEntries,
    ...gablePanels.map(toManifest),
    ...flatPanels.map(toManifest),
    ...shedPanels.map(toManifest),
  ];
  svgMap.set(
    "2d/roof/roof_panels.json",
    JSON.stringify(mergedManifest, null, 2),
  );

  // HTML BOM cards — Phase 1b + Phase 2: aggregates across every
  // hip_roof (via computeAllRoofs → RoofComputed[]) AND every
  // gable_roof (via collectAllGableMembers). Emitted whenever there's
  // at least one roof of either type.
  const expanded = expandRoomWalls(cfg, undefined, { lenient: true });
  const allRoofs = computeAllRoofs(expanded);
  const gableMembers = collectAllGableMembers(cfg);
  const flatMembers = collectAllFlatMembers(cfg);
  const shedMembers = collectAllShedMembers(cfg);
  // v2 roof contributions (type: "roof" only — legacy types are
  // already counted by the paths above). Emits members as legacy
  // FrameMember shape so the existing BOM tables can consume them.
  const v2Members = collectV2AsLegacyFrameMembers(cfg);
  const gableTiles = gableTileContribution(cfg);
  const flatTiles = flatTileContribution(cfg);
  const shedTiles = shedTileContribution(cfg);
  const extraMembers = [...gableMembers, ...flatMembers, ...shedMembers, ...v2Members];
  // v2 tile contribution — slope area + ridge run for type:"roof" objects.
  const v2Spec = computeMergedV2Spec(cfg, { filter: "v2Only" });
  const v2Area = slopeAreaSft(v2Spec);
  const v2RidgeRun = ridgeRunFt(v2Spec);
  const extraArea = gableTiles.areaSft + flatTiles.areaSft + shedTiles.areaSft + v2Area;
  const extraRidgeRun = gableTiles.ridgeRunFt + shedTiles.ridgeRunFt + v2RidgeRun;
  const hasAnyRoof = allRoofs.length > 0 || extraMembers.length > 0;
  if (hasAnyRoof) {
    const densities = readTileDensities(cfg);
    const stock = readMetalStock(cfg);
    svgMap.set("2d/roof/frame_bom.html", frameBomHtml(allRoofs, extraMembers));
    svgMap.set("2d/roof/metal_bom.html", metalBomHtml(allRoofs, stock, extraMembers));
    svgMap.set(
      "2d/roof/roof_material_bom.html",
      roofMaterialBomHtml(allRoofs, densities, extraArea, extraRidgeRun),
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
  const sidebar = document.getElementById("viewer-sidebar");
  const props = document.getElementById("viewer-property-panel");
  if (sidebar) createRoot(sidebar).render(createElement(Sidebar));
  if (props) createRoot(props).render(createElement(PropertyPanel));
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
    // HTML → PDF (BOM / quantities cards) — raster via html2canvas since the
    // content is HTML tables, not SVG. Same native-save path as the SVG export.
    exportHtmlElementAsPdf?: (el: HTMLElement, defaultName: string) => Promise<void>;
    // On-demand Layout composite render, driven by the filter panel.
    // Returns the composite SVG string for `floorNum` with `filter`
    // applied (object/type/layer selection + dimension toggles).
    wadiRenderLayout?: (floorNum: number, filter?: DrawFilter | null) => string;
    // Panel metadata: the floors, object types, layers, and per-object
    // list the filter panel builds its checkbox groups from.
    wadiLayoutMeta?: () => LayoutMeta | null;
  }
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
  gable_roof: "Roofs",
  hip_roof: "Roofs",
  flat_roof: "Roofs",
  shed_roof: "Roofs",
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
      "pillar", "gable_roof", "hip_roof", "flat_roof", "shed_roof", "openings",
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
    }
  };

  // HTML → PDF for the BOM / quantities cards. window.print() is a no-op in
  // the desktop WKWebview, so rasterise the card with html2canvas and place it
  // on A4 pages (paginating when the table is taller than one page), then save
  // via the native dialog — same path as the SVG export above.
  window.exportHtmlElementAsPdf = async (el: HTMLElement, defaultName: string) => {
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = (html2canvasMod as { default: typeof import("html2canvas").default }).default;
      const canvas = await html2canvas(el, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true,
        windowWidth: el.scrollWidth, windowHeight: el.scrollHeight,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const imgW = pw - margin * 2;
      const pxPerPt = canvas.width / imgW;     // source px per PDF point
      const sliceHpx = (ph - margin * 2) * pxPerPt; // page-worth of source px
      let y = 0, page = 0;
      while (y < canvas.height - 1) {
        const hpx = Math.min(sliceHpx, canvas.height - y);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = hpx;
        slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, hpx, 0, 0, canvas.width, hpx);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice, "PNG", margin, margin, imgW, hpx / pxPerPt);
        y += hpx;
        page++;
      }
      const bytes = pdf.output("arraybuffer");
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
function showBanner(message: string): void {
  const el = document.createElement("div");
  el.setAttribute("role", "alert");
  el.style.cssText = [
    "position:fixed", "top:12px", "left:50%", "transform:translateX(-50%)",
    "z-index:1000", "max-width:min(92vw,540px)", "display:flex", "gap:10px",
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

// Copy text to the clipboard, cross-target. The async Clipboard API is
// the happy path in a browser, but it throws in the Tauri WKWebView; there
// we fall back to a hidden-textarea execCommand("copy"), which WKWebView
// does support. (window.prompt is NOT an option — WKWebView throws on it.)
async function copyText(text: string): Promise<boolean> {
  // In the Tauri desktop app both web clipboard paths are unavailable in
  // WKWebView (async Clipboard API throws; execCommand("copy") is a
  // no-op), so go straight to the native clipboard plugin.
  if (isTauri()) {
    try {
      await tauriClipboardWrite(text);
      return true;
    } catch {
      /* fall through to the web paths (harmless if they also fail) */
    }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy execCommand path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function wireHeaderButtons(): void {
  const btnNew = document.getElementById("btn-new");
  const btnEdit = document.getElementById("btn-edit-toggle");
  const btnLoad = document.getElementById("btn-load");
  const btnSave = document.getElementById("btn-save");
  const btnSaveAs = document.getElementById("btn-save-as");
  const btnShare = document.getElementById("btn-share");
  const btnExportWadi = document.getElementById("btn-export-wadi");
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");
  const fileInput = document.getElementById("file-input-json") as HTMLInputElement | null;

  // Share: pack the current house into a '#'-fragment link and copy it.
  // Anyone opening the link loads this exact design on the web app (no
  // backend); if they have the desktop app we can later offer to hand
  // off to it. Falls back to a manual-copy prompt where the async
  // clipboard API is blocked (e.g. non-secure / file:// contexts).
  btnShare?.addEventListener("click", async () => {
    const cfg = useConfigStore.getState().config;
    if (!cfg) return;
    try {
      const url = buildShareUrl(await encodeConfigToHash(cfg));
      if (await copyText(url)) {
        flashSaved(btnShare, "✓ Link copied");
      } else {
        // Extremely rare (both clipboard paths failed). Don't use
        // window.prompt — WKWebView doesn't support it.
        console.info("[share] link:", url);
        alert("Couldn't copy automatically — the link was logged to the console.");
      }
    } catch (e) {
      alert(`Share failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  // Export the current house as a .wadi file (native document that opens
  // in the desktop app). Payload is plain house_config JSON.
  btnExportWadi?.addEventListener("click", async () => {
    const cfg = useConfigStore.getState().config;
    if (!cfg) return;
    try {
      const saved = await saveAsWadi(cfg);
      if (saved) flashSaved(btnExportWadi, "✓ Saved .wadi");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`Export failed: ${msg}`);
    }
  });

  btnEdit?.addEventListener("click", () => {
    const next = document.body.dataset.editMode === "on" ? "off" : "on";
    document.body.dataset.editMode = next;
    try { localStorage.setItem(EDIT_MODE_KEY, next); } catch { /* ignore */ }
  });

  btnNew?.addEventListener("click", () => {
    void openNewHouseModal();
  });

  btnLoad?.addEventListener("click", async () => {
    // Uses the same file picker + Zod validation the editor's TopBar does.
    try {
      if (!(await guardUnsaved("opening another model"))) return;
      const res = await pickAndLoadConfig();
      useConfigStore.getState().loadConfig(res.config, res.filename, res.filePath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "Cancelled") alert(`Load failed: ${msg}`);
    }
  });

  btnSave?.addEventListener("click", async () => {
    const state = useConfigStore.getState();
    const cfg = state.config;
    if (!cfg) return;
    try {
      const saved = await saveConfig(cfg, state.filePath, state.filename ?? undefined);
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
      const saved = await saveConfig(cfg, null, state.filename ?? undefined);
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

  // Mobile back button: clears the selection so the tree returns.
  document.getElementById("btn-back-to-tree")?.addEventListener("click", () => {
    useConfigStore.getState().select(null);
  });

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

function applyStoredEditMode(): void {
  let stored: string | null = null;
  try { stored = localStorage.getItem(EDIT_MODE_KEY); } catch { /* ignore */ }
  document.body.dataset.editMode = stored === "on" ? "on" : "off";
}

// -----------------------------------------------------------------
// Template picker modal
// -----------------------------------------------------------------

interface TemplateEntry {
  id: string;
  title: string;
  description: string;
  file: string;
}
async function openNewHouseModal(): Promise<void> {
  const modal = document.getElementById("new-house-modal");
  const grid = document.getElementById("new-house-modal-grid");
  if (!modal || !grid) return;
  modal.style.display = "block";

  // Always refetch on open — the manifest is small, and caching it
  // meant users saw a stale template list until they hard-reloaded.
  // Cache-buster on the URL side-steps browser HTTP caching too.
  let templates: TemplateEntry[];
  try {
    const r = await fetch(`/templates/index.json?t=${Date.now()}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const parsed = (await r.json()) as { templates: TemplateEntry[] };
    templates = parsed.templates;
  } catch (e) {
    grid.innerHTML =
      `<div style="grid-column: 1 / -1; color: #b00; padding: 1rem;">
        Failed to load templates/index.json: ${e instanceof Error ? e.message : String(e)}
      </div>`;
    return;
  }

  grid.innerHTML = "";
  for (const t of templates) {
    const card = document.createElement("div");
    card.className = "template-card";
    card.innerHTML = `
      <div class="template-card-title">${escapeHtml(t.title)}</div>
      <div class="template-card-desc">${escapeHtml(t.description)}</div>`;
    card.addEventListener("click", () => void selectTemplate(t));
    grid.appendChild(card);
  }
}

function closeNewHouseModal(): void {
  const modal = document.getElementById("new-house-modal");
  if (modal) modal.style.display = "none";
}

async function selectTemplate(t: TemplateEntry): Promise<void> {
  // Loading a template replaces the current house — offer to save first.
  if (!(await guardUnsaved("creating a new house"))) return;
  try {
    // index.json lists files relative to the site root (e.g.
    // "templates/blank.json"); anchor them at "/" so they resolve there
    // and not under /app/ where the designer is served.
    const r = await fetch(`/${t.file.replace(/^\//, "")}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();
    const parsed = validate(raw);
    if (!parsed.ok || !parsed.data) {
      alert(
        `Template "${t.title}" failed validation:\n` +
        (parsed.errors ?? []).slice(0, 5).map((e) => `• ${e.path}: ${e.message}`).join("\n"),
      );
      return;
    }
    useConfigStore.getState().loadConfig(parsed.data, `${t.title} (template)`);
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootViewer();
  });
} else {
  void bootViewer();
}
