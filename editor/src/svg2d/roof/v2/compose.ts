// V2 roof master-sheet compose.
//
// Assembles a master SVG canvas with all v2 roof panels. Each panel
// is a self-contained SVG fragment (topView, perspective, section A-A,
// section B-B, elevation front/back/left/right, ...). This is the v2
// counterpart to legacy `compose.ts`, which was hard-coded around
// `RoofComputed` (per-rectangle hip roofs).
//
// Layout is a simple grid: top row for top-view + perspective, middle
// rows for elevations, bottom row for sections. Each panel is a fixed
// tile size for now; can be per-config-tuned later.

import { expandRoomWalls, type HouseConfig } from "../../expand";
import { computeMergedV2Spec } from "./computeFromHouse";
import { renderTopViewPanel } from "./topViewPanel";
import { v2PerspectivePanel } from "./perspectivePanel";
import { v2SectionPanel } from "./sectionPanel";
import { v2FacePanel, groupFaces } from "./facePanel";
import { v2TrussPanel, groupTrusses } from "./trussPanel";
import { v2FrameDimPanel } from "./frameDimPanel";
import { v2EavePanel } from "./eavePanel";
import { roofMaxZ } from "./projections";
import type { RoofSpec } from "./model";

export interface V2RoofMasterResult {
  master: { filename: "roof_plan.svg"; content: string };
  panels: Array<{
    filename: string;
    content: string;
    id: string;
    title: string;
    width: number;
    height: number;
  }>;
}

// Panel-tile size (project units within the master canvas). All
// panels use the same tile so the grid stays uniform; individual
// panels center their content inside the tile.
const TILE_W = 900;
const TILE_H = 600;
const OUTER_PAD = 40;
const GRID_GAP = 30;
const TITLE_H = 60;
const MASTER_BG = "#faf8f4";

interface PanelDef {
  id: string;
  title: string;
  render: (x0: number, y0: number, w: number, h: number) => string;
}

// Return null when the config has no v2 roofs (caller falls back to
// legacy compose or shows an empty state).
export function computeV2RoofSections(cfg: HouseConfig): V2RoofMasterResult | null {
  const hc = expandRoomWalls(cfg);
  const spec = computeMergedV2Spec(hc, { filter: "v2Only" });
  if (spec.planes.length === 0 && spec.members.length === 0) return null;

  const bounds = specBounds(spec);
  const cutX = (bounds.minX + bounds.maxX) / 2;
  const cutY = (bounds.minY + bounds.maxY) / 2;
  const zMax = roofMaxZ(spec);
  const wallTopZ = inferWallTopZ(spec);

  const defs: PanelDef[] = [
    {
      id: "top_view",
      title: "Top View",
      // renderTopViewPanel returns a full <svg> — nest it inside our
      // master via a positioned <svg> wrapper. Inner viewBox handles
      // its own scaling; outer x/y positions it in the master grid.
      render: (x0, y0, w, h) => {
        const inner = renderTopViewPanel(spec, {
          width: w, height: h, padding: 20, title: "Top View",
        });
        // Strip outer <svg ...> and </svg> so we can re-wrap.
        const stripped = inner
          .replace(/^\s*<svg[^>]*>/, "")
          .replace(/<\/svg>\s*$/, "");
        return `<svg x="${x0}" y="${y0}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${stripped}</svg>`;
      },
    },
    {
      id: "perspective",
      title: "Frame (isometric)",
      render: (x0, y0, w, h) => v2PerspectivePanel(x0, y0, w, h, spec, { title: "Frame (isometric)", dimensions: true }),
    },
    {
      id: "section_a_a",
      title: `Section A-A (cut at X=${cutX.toFixed(0)})`,
      render: (x0, y0, w, h) => v2SectionPanel(x0, y0, w, h, spec, {
        title: `Section A-A (cut at X=${cutX.toFixed(0)})`,
        cutAxis: "x",
        cutCoord: cutX,
        wallTopZ,
        overlayTruss: true,
      }),
    },
    {
      id: "section_b_b",
      title: `Section B-B (cut at Y=${cutY.toFixed(0)})`,
      render: (x0, y0, w, h) => v2SectionPanel(x0, y0, w, h, spec, {
        title: `Section B-B (cut at Y=${cutY.toFixed(0)})`,
        cutAxis: "y",
        cutCoord: cutY,
        wallTopZ,
        overlayTruss: true,
      }),
    },
    {
      id: "frame_dims",
      title: "Main frame — fabrication dimensions",
      render: (x0, y0, w, h) => v2FrameDimPanel(x0, y0, w, h, spec),
    },
    {
      id: "eave_detail",
      title: "Eave — cross-section detail",
      render: (x0, y0, w, h) => v2EavePanel(x0, y0, w, h, spec),
    },
  ];

  // Add one panel per UNIQUE face shape (main slopes, hip ends, and
  // any extension polygons deduplicated by shape signature).
  const groups = groupFaces(spec);
  groups.forEach((group, idx) => {
    const id = `face_${idx}`;
    // Title lists which planes share this shape.
    const shape = group.geom.ridgeLen > 0.5 ? "trapezoid" : "triangle";
    const nice = group.planes.length === 1
      ? `Face ${idx + 1} (${shape}) — ${group.planes[0].id}`
      : `Face ${idx + 1} (${shape}, ${group.planes.length} identical)`;
    defs.push({
      id,
      title: nice,
      render: (x0, y0, w, h) => v2FacePanel(x0, y0, w, h, group),
    });
  });

  // Add one dimensioned elevation per UNIQUE truss (fabrication drawing). Identical
  // trusses are grouped and labelled "× N identical".
  groupTrusses(spec).forEach((group, idx) => {
    defs.push({
      id: `truss_${idx}`,
      title: `${group.geom.kind === "mono_pitch" ? "Mono-pitch" : "Fink"} truss ${idx + 1} (elevation${group.count > 1 ? `, × ${group.count}` : ""})`,
      render: (x0, y0, w, h) => v2TrussPanel(x0, y0, w, h, group),
    });
  });

  // Grid: 2 columns × N rows.
  const cols = 2;
  const rows = Math.ceil(defs.length / cols);
  const masterW = OUTER_PAD * 2 + cols * TILE_W + (cols - 1) * GRID_GAP;
  const masterH = OUTER_PAD * 2 + TITLE_H + rows * TILE_H + (rows - 1) * GRID_GAP;

  const panels: V2RoofMasterResult["panels"] = [];
  let masterInner = "";
  defs.forEach((d, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x0 = OUTER_PAD + c * (TILE_W + GRID_GAP);
    const y0 = OUTER_PAD + TITLE_H + r * (TILE_H + GRID_GAP);
    const fragment = d.render(x0, y0, TILE_W, TILE_H);
    masterInner += fragment + "\n";
    // Each panel also emitted as a standalone SVG (origin at 0,0).
    const standalone = wrapStandaloneSvg(
      d.render(0, 0, TILE_W, TILE_H),
      TILE_W, TILE_H, d.title,
    );
    panels.push({
      filename: `roof_${d.id}.svg`,
      content: standalone,
      id: d.id,
      title: d.title,
      width: TILE_W,
      height: TILE_H,
    });
  });

  const master = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${masterW}" height="${masterH}" viewBox="0 0 ${masterW} ${masterH}">
<title>Roof Plan (v2)</title>
<rect width="${masterW}" height="${masterH}" fill="${MASTER_BG}"/>
<text x="${masterW / 2}" y="${OUTER_PAD + 30}" text-anchor="middle" font-size="24" font-weight="bold" fill="#222">Roof Plan (v2)</text>
${masterInner}
</svg>`;

  void zMax;
  return {
    master: { filename: "roof_plan.svg", content: master },
    panels,
  };
}

// (wrapPanel currently unused — kept for future detail panels that
// need a border+title decorator around a fragment.)

function wrapStandaloneSvg(
  inner: string,
  w: number,
  h: number,
  title: string,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<title>${title}</title>
<rect width="${w}" height="${h}" fill="${MASTER_BG}"/>
${inner}
</svg>`;
}

function specBounds(spec: RoofSpec) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const p of spec.planes) {
    for (const v of p.vertices) {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    }
  }
  return { minX, maxX, minY, maxY };
}

// Infer the wall-top Z from ring beam members (they're always at
// wall-top). Returns null if no ring beams.
function inferWallTopZ(spec: RoofSpec): number | undefined {
  for (const m of spec.members) {
    if (m.role === "ring_beam") return m.start[2];
  }
  return undefined;
}
