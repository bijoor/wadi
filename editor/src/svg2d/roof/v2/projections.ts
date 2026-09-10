// V2 roof projections for elevation + floor-plan views.
//
// Elevation projection (side view): drop one axis, plot the remaining
// two. Viewer sees the roof edge-on if the plane is parallel to the
// view direction; sees the plane's silhouette otherwise.
//
// Floor-plan projection (top-down): drop Z, plot (X, Y). Draw the
// eave outline of each roof and the ridge/hip/valley lines from
// above.

import type { RoofSpec } from "./model";

export type ElevationView = "front" | "back" | "left" | "right";

// Utility: for each elevation view, which axis is the "along" axis
// visible on the SVG horizontal (matches legacy `worldToSvgX` input
// contract). front/back → X (east-west); left/right → Y (north-south).
export function alongAxisFor(view: ElevationView): "x" | "y" {
  return view === "front" || view === "back" ? "x" : "y";
}

// The maximum Z the roof reaches (for canvas height sizing). Includes
// all planes and members; returns 0 for empty specs.
export function roofMaxZ(spec: RoofSpec): number {
  let max = 0;
  for (const p of spec.planes) {
    for (const v of p.vertices) {
      if (v[2] > max) max = v[2];
    }
  }
  for (const m of spec.members) {
    if (m.start[2] > max) max = m.start[2];
    if (m.end[2] > max) max = m.end[2];
  }
  return max;
}

// Render one plane's outline projected onto the elevation view.
// Returns "" if the projected polygon degenerates (all vertices
// collapse to <= 1 unique 2D point).
export function projectPlaneToElevation(
  vertices: ReadonlyArray<readonly [number, number, number]>,
  view: ElevationView,
): Array<[number, number]> {
  const along = alongAxisFor(view);
  const out: Array<[number, number]> = [];
  for (const v of vertices) {
    const alongCoord = along === "x" ? v[0] : v[1];
    out.push([alongCoord, v[2]]);
  }
  return out;
}

// Render the whole v2 spec as an elevation-view SVG fragment (to be
// injected into an outer elevation canvas via caller-provided
// worldToSvgX + zToY transforms). Draws:
//   - Slope + hip_face planes as filled polygons (terracotta)
//   - Gable_wall planes as filled polygons (matches wall color)
//   - Flat_slab planes as filled rectangles (RCC grey)
//   - Parapet planes as filled rectangles
//   - Ridge / hip / valley / ring_beam members as lines (skipped
//     when nearly perpendicular to the view — edge-on → single pixel)
export function renderV2ToElevation(
  spec: RoofSpec,
  view: ElevationView,
  worldToSvgX: (coord: number, objWidth?: number) => number,
  zToY: (z: number) => number,
  roofThickness: number,
): string {
  const out: string[] = [];

  const planeColor: Record<string, string> = {
    slope: "#8B4513",         // saddle brown (matches legacy roof outline)
    hip_face: "#8B4513",
    gable_wall: "#C19A6B",    // matches wall color in legacy elevation
    flat_slab: "#8b8680",     // RCC grey
    parapet: "#8b8680",
  };

  for (const p of spec.planes) {
    const projected = projectPlaneToElevation(p.vertices, view);
    // De-duplicate near-identical points (edge-on planes collapse).
    const dedup: Array<[number, number]> = [];
    for (const [a, z] of projected) {
      const last = dedup[dedup.length - 1];
      if (!last || Math.abs(last[0] - a) > 0.01 || Math.abs(last[1] - z) > 0.01) {
        dedup.push([a, z]);
      }
    }
    if (dedup.length < 3) continue;   // degenerate — skip
    const pts = dedup.map(([a, z]) => `${worldToSvgX(a).toFixed(2)},${zToY(z).toFixed(2)}`).join(" ");
    const fill = planeColor[p.role] ?? "#8B4513";
    out.push(`<polygon points="${pts}" fill="${fill}" stroke="#5a2e0b" stroke-width="0.5" fill-opacity="0.85"/>`);
  }

  // Draw ridge / hip / valley members as outlines on top. Skip
  // members whose XY projection is degenerate for this view.
  for (const m of spec.members) {
    if (m.role !== "ridge" && m.role !== "hip" && m.role !== "valley" && m.role !== "mid_ring") continue;
    const along = alongAxisFor(view);
    const a1 = along === "x" ? m.start[0] : m.start[1];
    const a2 = along === "x" ? m.end[0] : m.end[1];
    if (Math.abs(a1 - a2) < 0.5 && Math.abs(m.start[2] - m.end[2]) < 0.5) continue;
    const x1 = worldToSvgX(a1).toFixed(2);
    const x2 = worldToSvgX(a2).toFixed(2);
    const y1 = zToY(m.start[2]).toFixed(2);
    const y2 = zToY(m.end[2]).toFixed(2);
    const stroke = m.role === "ridge" ? "#3b1a05"
      : m.role === "hip" ? "#5a2e0b"
      : m.role === "mid_ring" ? "#0d9488"
      : "#1e3a8a";
    out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${roofThickness}"/>`);
  }

  return out.join("\n");
}

// ---------------------------------------------------------------
// Floor plan projection — top-down (drop Z, plot X-Y).
// ---------------------------------------------------------------

// Render the v2 spec as a top-down SVG fragment for a floor plan.
// Draws each roof's slope + endcap planes as translucent polygons
// (so underlying floor plan is still visible), plus ridge / hip /
// valley member lines.
export function renderV2ToFloorPlan(
  spec: RoofSpec,
  xy: (x: number, y: number) => [number, number],
): string {
  const out: string[] = [];

  const planeStroke: Record<string, string> = {
    slope: "#8B4513",
    hip_face: "#8B4513",
    gable_wall: "#C19A6B",
    flat_slab: "#8b8680",
    parapet: "#8b8680",
  };

  for (const p of spec.planes) {
    // Skip parapet vertical rectangles — they'd show as edge-on lines
    // in top-down view and clutter the plan.
    if (p.role === "parapet") continue;
    const pts = p.vertices
      .map(([x, y]) => xy(x, y))
      .map(([sx, sy]) => `${sx.toFixed(2)},${sy.toFixed(2)}`)
      .join(" ");
    const stroke = planeStroke[p.role] ?? "#8B4513";
    out.push(`<polygon points="${pts}" fill="none" stroke="${stroke}" stroke-width="1" stroke-dasharray="4,2"/>`);
  }

  for (const m of spec.members) {
    if (m.role !== "ridge" && m.role !== "hip" && m.role !== "valley" && m.role !== "mid_ring") continue;
    const [x1, y1] = xy(m.start[0], m.start[1]);
    const [x2, y2] = xy(m.end[0], m.end[1]);
    const stroke = m.role === "ridge" ? "#dc2626"
      : m.role === "hip" ? "#ea580c"
      : m.role === "mid_ring" ? "#0d9488"
      : "#2563eb";
    const dash = m.role === "valley" ? ' stroke-dasharray="4,3"'
      : m.role === "hip" ? ' stroke-dasharray="6,2"' : "";
    out.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="1.5"${dash}/>`);
  }

  return out.join("\n");
}
