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
import { computeAll, computeAllRoofs } from "../svg2d/roof/geometry";
import { generateGablePanels } from "../svg2d/roof/gableCompose";
import { collectAllGableMembers, gableTileContribution } from "../svg2d/roof/gableBom";
import { generateFlatPanels, collectAllFlatMembers, flatTileContribution } from "../svg2d/roof/flatCompose";
import { generateShedPanels, collectAllShedMembers, shedTileContribution } from "../svg2d/roof/shedCompose";
import { frameBomHtml, metalBomHtml, roofMaterialBomHtml, readTileDensities, readMetalStock } from "../svg2d/roof/htmlBom";
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
  const expanded = expandRoomWalls(cfg);
  const allRoofs = computeAllRoofs(expanded);
  const gableMembers = collectAllGableMembers(cfg);
  const flatMembers = collectAllFlatMembers(cfg);
  const shedMembers = collectAllShedMembers(cfg);
  const gableTiles = gableTileContribution(cfg);
  const flatTiles = flatTileContribution(cfg);
  const shedTiles = shedTileContribution(cfg);
  const extraMembers = [...gableMembers, ...flatMembers, ...shedMembers];
  const extraArea = gableTiles.areaSft + flatTiles.areaSft + shedTiles.areaSft;
  const extraRidgeRun = gableTiles.ridgeRunFt + shedTiles.ridgeRunFt;
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
  const btnNew = document.getElementById("btn-new");
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

  btnNew?.addEventListener("click", () => {
    void openNewHouseModal();
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

// -----------------------------------------------------------------
// Template picker modal
// -----------------------------------------------------------------

interface TemplateEntry {
  id: string;
  title: string;
  description: string;
  file: string;
}
// Cache the manifest between opens so we don't refetch every click.
let templateManifestCache: TemplateEntry[] | null = null;

async function openNewHouseModal(): Promise<void> {
  const modal = document.getElementById("new-house-modal");
  const grid = document.getElementById("new-house-modal-grid");
  if (!modal || !grid) return;
  modal.style.display = "block";

  if (!templateManifestCache) {
    try {
      const r = await fetch("templates/index.json");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const parsed = (await r.json()) as { templates: TemplateEntry[] };
      templateManifestCache = parsed.templates;
    } catch (e) {
      grid.innerHTML =
        `<div style="grid-column: 1 / -1; color: #b00; padding: 1rem;">
          Failed to load templates/index.json: ${e instanceof Error ? e.message : String(e)}
        </div>`;
      return;
    }
  }

  grid.innerHTML = "";
  for (const t of templateManifestCache) {
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
  // Undo history is our proxy for "has unsaved edits". If the user has
  // pushed any past states since loading, warn before wiping.
  const hasEdits = useConfigStore.temporal.getState().pastStates.length > 0;
  if (hasEdits) {
    const ok = confirm(
      `Loading "${t.title}" will replace your current work. Continue?\n\n` +
      `Tip: click Cancel and use 💾 Save first if you want to keep it.`,
    );
    if (!ok) return;
  }
  try {
    const r = await fetch(t.file);
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
