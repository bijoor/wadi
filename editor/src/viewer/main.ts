// Viewer bootstrap — hooks the TS SVG generators + Three.js scene into
// the existing tabbed viewer UI (docs/index.html).
//
// The viewer HTML stays vanilla JS; this module just:
//  1. Fetches ../house_config.json once on load.
//  2. Runs every 2D generator (floor plans, elevations, roof, pillars)
//     into an in-memory Map<relative-url, svg-string>.
//  3. Patches `window.fetch` so the existing loader code — which calls
//     `fetch("2d/floor_plans/…svg?t=…")` etc. — silently gets served
//     from the map instead of hitting disk.
//  4. Mounts a Three.js scene (same House3D used by the editor) into
//     the 3D tab's container, replacing the old <model-viewer> element.
//
// Hand-drawn refs, PNGs, PDFs, JSON and any other file the viewer
// requests fall through to the original fetch, so those keep loading
// from disk as before.

import { validate } from "../schema/houseConfig";
import type { HouseConfig } from "../svg2d/expand";
import { generateAllFloorPlans } from "../svg2d/floorPlansAll";
import { generateCombinedFloorPlans } from "../svg2d/floorPlansCombined";
import { generateAllElevations } from "../svg2d/elevationsAll";
import { generateCombinedElevations } from "../svg2d/elevationsCombined";
import { computeRoofSections } from "../svg2d/roof/index";
import { mountViewer3D, mountViewerLayerPanel } from "./mount3D";

const CONFIG_URL = "house_config.json";
const EAVE_CROSS_SECTION_URL = "2d/roof/roof-cross-section.svg";

async function bootViewer(): Promise<void> {
  const raw = await (await fetch(CONFIG_URL)).json();
  const parsed = validate(raw);
  if (!parsed.ok || !parsed.data) {
    console.error("viewer: house_config.json failed validation", parsed.errors);
    return;
  }
  const cfg = parsed.data as HouseConfig;

  // The roof pipeline embeds a hand-drawn eave cross-section fetched
  // from the same origin. Kick that off in parallel with the config.
  const eavePromise = fetch(EAVE_CROSS_SECTION_URL)
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");

  const svgMap = new Map<string, string>();

  // Floor plans → 2d/floor_plans/
  for (const { filename, content } of generateAllFloorPlans(cfg)) {
    svgMap.set(`2d/floor_plans/${filename}`, content);
  }
  svgMap.set(
    "2d/floor_plans/floor_plans_combined.svg",
    generateCombinedFloorPlans(cfg),
  );

  // Elevations → 2d/elevations/
  for (const { view, content } of generateAllElevations(cfg)) {
    svgMap.set(`2d/elevations/elevation_${view}.svg`, content);
  }
  svgMap.set(
    "2d/elevations/elevations_combined.svg",
    generateCombinedElevations(cfg),
  );

  // Roof — pass the fetched eave cross-section so the eave panel embeds
  // the hand-drawn detail in-memory too.
  const eaveSvg = (await eavePromise) || undefined;
  const roof = computeRoofSections(cfg, { eaveCrossSectionSvg: eaveSvg });
  if (roof) {
    svgMap.set(`2d/roof/${roof.master.filename}`, roof.master.content);
    for (const p of roof.panels) {
      svgMap.set(`2d/roof/${p.filename}`, p.content);
    }
    svgMap.set(`2d/roof/${roof.manifest.filename}`, roof.manifest.content);
  }

  // Intercept fetch() so vanilla-JS loader code (loadFloorPlans etc.)
  // gets our generated strings without any changes on that side.
  patchFetch(svgMap);

  // Mount the Three.js scene into the 3D tab's container.
  const threeContainer = document.getElementById("viewer-3d-scene");
  if (threeContainer) {
    mountViewer3D(threeContainer, cfg);
  }

  // Populate the layer-visibility checkboxes. The scene and the panel
  // share the same Zustand store — toggling here rerenders the scene.
  const layerContainer = document.getElementById("viewer-layer-list");
  if (layerContainer) {
    mountViewerLayerPanel(layerContainer);
  }
}

function patchFetch(svgMap: Map<string, string>): void {
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
    // Strip query string (the vanilla code cache-busts with ?t=)
    const clean = rawUrl.split("?")[0];
    // Try both bare and with leading "./"
    const key = clean.startsWith("./") ? clean.slice(2) : clean;
    const hit = svgMap.get(key);
    if (hit !== undefined) {
      return Promise.resolve(
        new Response(hit, {
          headers: { "Content-Type": "image/svg+xml" },
        }),
      );
    }
    return original(input, init);
  }) as typeof window.fetch;
}

// Fire once DOM is ready — the vanilla viewer script sets up its DOM on
// DOMContentLoaded too, so we run in parallel. The fetch patch only
// takes effect the first time a tab is visited, which is well after
// this module resolves.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootViewer();
  });
} else {
  void bootViewer();
}
