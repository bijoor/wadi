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
import { generateAllElevations } from "../svg2d/elevationsAll";
import { generateCombinedElevations } from "../svg2d/elevationsCombined";
import { computeRoofSections } from "../svg2d/roof/index";
import { computeAll } from "../svg2d/roof/geometry";
import { frameBomHtml, roofMaterialBomHtml, readTileDensities } from "../svg2d/roof/htmlBom";
import { expandRoomWalls } from "../svg2d/expand";
import { generateAllPillarSvgs } from "../svg2d/pillar/index";
import { pickAndLoadConfig, downloadConfig } from "../io/fileIO";
import { Sidebar } from "../components/Sidebar";
import { PropertyPanel } from "../components/PropertyPanel";
import { mountViewer3D, mountViewerLayerPanel } from "./mount3D";

const CONFIG_URL = "house_config.json";
const EAVE_CROSS_SECTION_URL = "2d/roof/roof-cross-section.svg";
const EDIT_MODE_KEY = "konkan-viewer:edit-mode";

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

  // Auto-load the JSON if it's next to the viewer (docs/house_config.json).
  // We validate and stuff into useConfigStore so both the edit UI and
  // the SVG generators pick it up.
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

  eaveSvg = (await eavePromise) || undefined;

  // First SVG map build using whatever ended up in the store.
  rebuildSvgMap();

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
  applyStoredEditMode();
}

function rebuildSvgMap(): void {
  const cfg = useConfigStore.getState().config as HouseConfig | null;
  svgMap.clear();
  if (!cfg) return;

  for (const { filename, content } of generateAllFloorPlans(cfg)) {
    svgMap.set(`2d/floor_plans/${filename}`, content);
  }
  svgMap.set(
    "2d/floor_plans/floor_plans_combined.svg",
    generateCombinedFloorPlans(cfg),
  );
  for (const { view, content } of generateAllElevations(cfg)) {
    svgMap.set(`2d/elevations/elevation_${view}.svg`, content);
  }
  svgMap.set(
    "2d/elevations/elevations_combined.svg",
    generateCombinedElevations(cfg),
  );
  const roof = computeRoofSections(cfg, { eaveCrossSectionSvg: eaveSvg });
  if (roof) {
    svgMap.set(`2d/roof/${roof.master.filename}`, roof.master.content);
    for (const p of roof.panels) {
      svgMap.set(`2d/roof/${p.filename}`, p.content);
    }
    svgMap.set(`2d/roof/${roof.manifest.filename}`, roof.manifest.content);
    // HTML BOM cards — replace the old consolidated_bom / tile_roofing
    // SVG panels in the viewer. Frame BOM is computed from the same
    // RoofComputed the SVG panels used; tile BOM reads tile densities
    // from `hip_roof.tile_density` on the config, with defaults.
    const expanded = expandRoomWalls(cfg);
    const computed = computeAll(expanded);
    if (computed) {
      const densities = readTileDensities(cfg);
      svgMap.set("2d/roof/frame_bom.html", frameBomHtml(computed));
      svgMap.set("2d/roof/roof_material_bom.html", roofMaterialBomHtml(computed, densities));
      window.roofBomManifest = [
        { filename: "2d/roof/frame_bom.html", displayName: "Frame BOM" },
        { filename: "2d/roof/roof_material_bom.html", displayName: "Roof material BOM" },
      ];
    }
  }
  // Pillar elevations + cross-sections. The section files depend on the
  // house's row/col count, so we publish a manifest on window for the
  // vanilla loader in viewer.html to iterate — it doesn't have to know
  // the count up front.
  const pillars = generateAllPillarSvgs(cfg);
  const pillarManifest: { filename: string; displayName: string }[] = [];
  for (const p of pillars) {
    const url = `2d/pillars/${p.filename}`;
    svgMap.set(url, p.content);
    pillarManifest.push({ filename: url, displayName: p.label });
  }
  window.pillarSvgManifest = pillarManifest;
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
    rebuildSvgMap();
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
    loadFloorPlans?: () => Promise<void>;
    loadElevations?: () => Promise<void>;
    loadRoofPanels?: () => Promise<void>;
    // Published from rebuildSvgMap so the elevations loader can iterate
    // pillar cards without hard-coding the row/col count.
    pillarSvgManifest?: { filename: string; displayName: string }[];
    // Published from rebuildSvgMap so the roof-panels loader can render
    // the two HTML BOM cards after the SVG panels.
    roofBomManifest?: { filename: string; displayName: string }[];
  }
}

function reloadActiveTab(): void {
  // Reset the "already loaded" flags so the loaders re-fetch (and thus
  // hit the fresh svgMap via our patched fetch). Then call whichever
  // matches the currently-active tab.
  window.floorPlansLoaded = false;
  window.elevationsLoaded = false;
  window.roofPanelsLoaded = false;
  const activeView = document.querySelector(".view-container.active");
  if (!activeView) return;
  const id = activeView.id;
  if (id === "view-plans") void window.loadFloorPlans?.();
  else if (id === "view-elevations") void window.loadElevations?.();
  else if (id === "view-roof") void window.loadRoofPanels?.();
  // 3D tab reacts automatically via React subscription — no manual call.
}

// -----------------------------------------------------------------
// Header actions
// -----------------------------------------------------------------

function wireHeaderButtons(): void {
  const btnEdit = document.getElementById("btn-edit-toggle");
  const btnLoad = document.getElementById("btn-load");
  const btnSave = document.getElementById("btn-save");
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");
  const fileInput = document.getElementById("file-input-json") as HTMLInputElement | null;

  btnEdit?.addEventListener("click", () => {
    const next = document.body.dataset.editMode === "on" ? "off" : "on";
    document.body.dataset.editMode = next;
    try { localStorage.setItem(EDIT_MODE_KEY, next); } catch { /* ignore */ }
  });

  btnLoad?.addEventListener("click", async () => {
    // Uses the same file picker + Zod validation the editor's TopBar does.
    try {
      const res = await pickAndLoadConfig();
      useConfigStore.getState().loadConfig(res.config, res.filename);
    } catch (e) {
      alert(`Load failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  btnSave?.addEventListener("click", () => {
    const cfg = useConfigStore.getState().config;
    if (cfg) downloadConfig(cfg, "house_config.json");
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootViewer();
  });
} else {
  void bootViewer();
}
