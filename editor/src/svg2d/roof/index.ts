// Public entry points for the roof SVG generator port.
//
// The end-to-end pipeline mirrors svg_2d.py::generate_roof_sections_svg —
// it produces one master `roof_plan.svg` (all panels stitched onto a single
// canvas) plus 13 individual per-panel SVGs cropped from that master, plus
// a `roof_panels.json` manifest.
//
// This file exposes two shapes:
//   - `computeRoofSections(cfg)` returns everything in memory (browser-safe
//     — no fs, no Node built-ins). Used by the editor's Roof preview tab.
//   - `generateRoofSectionsSvg(cfg, outDir)` writes those same outputs to
//     disk. Used by the parity harness and `scripts/dump-svgs.mjs`. The
//     Node `fs` / `path` imports are lazy so importing this module from a
//     browser bundle stays side-effect-free until you call the disk-writing
//     function.

import type { HouseConfig } from "../expand";
import { computeV2RoofSections } from "./v2/compose";

export interface RoofPanelFile {
  filename: string;
  content: string;
  id: string;
  title: string;
  width: number;
  height: number;
}

export interface RoofSectionsResult {
  master: { filename: "roof_plan.svg"; content: string };
  panels: RoofPanelFile[];
  manifest: { filename: "roof_panels.json"; content: string };
}

export interface ComputeRoofOptions {
  // Raw contents of docs/2d/roof/roof-cross-section.svg (hand-drawn
  // detail embedded into the eave-cross-section panel). Node callers
  // read it from disk; browser callers fetch it over HTTP. Omit and
  // the eave panel becomes a "not found" stub.
  eaveCrossSectionSvg?: string;
}

// Pure, in-memory version. Safe for browsers.
//
// v2-only: computes the unified roof (type: "roof") pipeline. Returns
// null when the config has no roof objects.
export function computeRoofSections(
  cfg: HouseConfig,
  _options: ComputeRoofOptions = {},
): RoofSectionsResult | null {
  const v2 = computeV2RoofSections(cfg);
  if (!v2) return null;
  // Manifest is a FLAT ARRAY — callers use it directly in Array spread
  // and Object-form would blow up with "s is not iterable".
  const manifestArray = v2.panels.map((p) => ({
    id: p.id,
    title: p.title,
    file: p.filename,
    width: p.width,
    height: p.height,
  }));
  return {
    master: v2.master,
    panels: v2.panels,
    manifest: {
      filename: "roof_panels.json",
      content: JSON.stringify(manifestArray, null, 2),
    },
  };
}

// Disk-writing version. Only usable from Node (parity harness, dump-svgs
// script). fs/path imports are deferred so this module can be bundled
// for the browser without pulling in the Node built-ins. Reads the
// hand-drawn eave cross section from ../../../../docs/2d/roof/ relative
// to this file so the pipeline can embed it into the master.
export async function generateRoofSectionsSvg(
  cfg: HouseConfig,
  outDir: string,
): Promise<void> {
  // Dynamic imports so the browser bundle stays free of Node built-ins.
  // The app tsconfig doesn't have @types/node in `types`, so silence the
  // "cannot find module" complaints — the paths are correct at runtime.
  // @ts-expect-error node built-in unavailable in browser tsconfig
  const fs = await import("node:fs");
  // @ts-expect-error node built-in unavailable in browser tsconfig
  const path = await import("node:path");
  // @ts-expect-error node built-in unavailable in browser tsconfig
  const { fileURLToPath } = await import("node:url");

  const here = path.dirname(fileURLToPath(import.meta.url));
  // editor/src/svg2d/roof → blender/docs/2d/roof
  const externalPath = path.resolve(
    here, "..", "..", "..", "..", "docs", "2d", "roof", "roof-cross-section.svg",
  );
  let eaveCrossSectionSvg: string | undefined;
  try { eaveCrossSectionSvg = fs.readFileSync(externalPath, "utf8"); } catch { /* file missing → falls back to "not found" stub */ }

  const result = computeRoofSections(cfg, { eaveCrossSectionSvg });
  if (!result) return;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, result.master.filename),
    result.master.content,
    "utf8",
  );
  for (const p of result.panels) {
    fs.writeFileSync(path.join(outDir, p.filename), p.content, "utf8");
  }
  fs.writeFileSync(
    path.join(outDir, result.manifest.filename),
    result.manifest.content,
    "utf8",
  );
}
