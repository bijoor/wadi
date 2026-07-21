// Composite "general arrangement" sheet: the floor plan centered, with the
// four elevations placed on their respective sides (a fixed multi-view
// layout). Every sub-drawing is rendered at the SAME scale so the sheet
// reads as one coordinated drawing set.
//
// STATUS: first increment — a cross ARRANGEMENT at a shared scale. It does
// NOT yet (a) project-align the N/S elevations to the plan's X extent and
// the E/W elevations to the plan's Y extent, nor (b) rotate the E/W
// elevations so world-Y runs vertical. Those come next, along with the
// object/feature filtering. Kept deliberately simple so the layout can be
// reviewed before that investment.

import { DEFAULT_GLOBAL_CONFIG, setActiveDimFlags, scaledSpacing } from "./config";
import { generateFloorPlanSvg } from "./floorPlan";
import { generateElevationView } from "./elevationView";
import { expandRoomWalls, type HouseConfig } from "./expand";
import { applyDrawFilter, dimShowFlags, type DrawFilter } from "./drawFilter";
import { beginDimResolve, endDimResolve } from "./dimResolve";

interface Dim {
  w: number;
  h: number;
}

// Pull width/height (px) off a rendered <svg> header.
function svgDims(svg: string): Dim {
  const m = svg.match(/<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/);
  return m ? { w: parseFloat(m[1]), h: parseFloat(m[2]) } : { w: 0, h: 0 };
}

// Nest a standalone <svg> at (x, y) inside the master sheet. Nested <svg>
// elements keep their own viewBox/coordinate system, so each sub-drawing
// renders unchanged — we only position it.
function stripDecl(svg: string): string {
  // Strip BOM + leading <?xml?> declaration (invalid inside a parent <svg>).
  return svg.replace(/^﻿?\s*(<\?xml[^>]*\?>\s*)?/, "");
}

function placeSvg(svg: string, x: number, y: number): string {
  // Nest a sub-<svg> at (x, y) — keeps its own viewBox/coordinate system.
  // overflow="visible" so any content a sub-drawing paints slightly outside
  // its declared box (titles, outer dimension labels, roof overhang) isn't
  // clipped by the nested viewport.
  return stripDecl(svg).replace(
    /<svg\b/,
    `<svg x="${round(x)}" y="${round(y)}" overflow="visible"`,
  );
}

// Place a sub-<svg> of size (w, h) rotated ±90°, with its rotated bounding
// box's top-left at (boxX, boxY). `dir` = "cw" (+90) or "ccw" (−90). We wrap
// in a <g transform> and nest the sub-svg at the origin.
function placeRotated(
  svg: string,
  w: number,
  h: number,
  boxX: number,
  boxY: number,
  dir: "cw" | "ccw",
): string {
  const inner = stripDecl(svg).replace(/<svg\b/, `<svg x="0" y="0" overflow="visible"`);
  // +90° (cw): (x,y)→(-y,x) → bbox x∈[-h,0], y∈[0,w]; shift by (boxX+h, boxY).
  // −90° (ccw): (x,y)→(y,-x) → bbox x∈[0,h], y∈[-w,0]; shift by (boxX, boxY+w).
  const t =
    dir === "cw"
      ? `translate(${round(boxX + h)}, ${round(boxY)}) rotate(90)`
      : `translate(${round(boxX)}, ${round(boxY + w)}) rotate(-90)`;
  return `<g transform="${t}">${inner}</g>`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CompositeSheetOptions {
  scale?: number;
  // Filter panel state — which objects/annotations to draw. Omitted = draw
  // everything (backward compatible).
  filter?: DrawFilter | null;
}

// Render the composite sheet for one floor's plan + the building's four
// elevations. `floorNum` selects which floor's plan sits in the centre.
export function generateCompositeSheet(
  houseConfig: HouseConfig & Record<string, unknown>,
  floorNum = 0,
  opts: CompositeSheetOptions = {},
): string {
  const scale = opts.scale ?? 2.0;
  // Smart dimensioning flags (composite-only; renderer-level default OFF so
  // the standalone tabs stay byte-identical). The UI defaults these ON.
  const smart = opts.filter?.smart ?? {};
  try {
    // Object selection: pre-filter the config so the renderers only see the
    // chosen objects. Annotation toggles: set the active dimension flags.
    const selected = applyDrawFilter(houseConfig, opts.filter);
    setActiveDimFlags(dimShowFlags(opts.filter));
    // Within-view dedup + overlap resolution run through the shared resolver
    // seam in dimensions.ts. crossView is threaded separately (it suppresses
    // whole elevation blocks, not individual dims).
    beginDimResolve({ dedup: !!smart.withinView, overlap: !!smart.overlap });
    return renderSheet(
      selected as HouseConfig & Record<string, unknown>,
      floorNum,
      scale,
      { crossView: !!smart.crossView },
    );
  } finally {
    endDimResolve(); // clear resolver state — never leak to other renders
    setActiveDimFlags(null); // never leak the override to other renders
  }
}

function renderSheet(
  houseConfig: HouseConfig & Record<string, unknown>,
  floorNum: number,
  scale: number,
  smart: { crossView: boolean },
): string {
  // Both the plan and elevation renderers expect room walls expanded to the
  // legacy list form (the All* wrappers do this too). Expand once.
  const hc = expandRoomWalls(houseConfig, undefined, { lenient: true }) as HouseConfig &
    Record<string, unknown>;
  const floors = (hc.floors as Array<Record<string, unknown>> | undefined) ?? [];
  const floorConfig =
    floors.find((f) => (f.floor_number ?? 0) === floorNum) ?? floors[0];
  const wallThickness =
    (hc.defaults as { wall_thickness?: number } | undefined)?.wall_thickness ??
    DEFAULT_GLOBAL_CONFIG.wall_thickness;

  const plan = floorConfig
    ? generateFloorPlanSvg(floorConfig as never, scale, undefined, wallThickness)
    : "";
  // Elevation → compass: "front" shows the NORTH face (viewerFacingDir
  // "north"), so it sits on TOP; "back" is the SOUTH face → bottom. The
  // "front" view mirrors world-X by default, which would flip the top
  // elevation relative to the plan — pass flipX so it runs east→right and
  // aligns. "back" already runs east→right, so no flip. Elevations keep their
  // full dimension set; the gap below is sized to clear each view's
  // dimension/label overflow so nothing overlaps.
  // Cross-view dedup: the plan already carries every HORIZONTAL span (widths
  // via N/S chains, depths via E/W chains) and every opening width, so the
  // elevations suppress those and keep only their vertical HEIGHT dims (the
  // plan has no Z info). Margin math inside the elevations is untouched, so
  // the layout below stays put whether or not the flag is on.
  const ss = smart.crossView;
  const north = generateElevationView(hc, "front", scale, true, ss); // top
  const south = generateElevationView(hc, "back", scale, false, ss); // bottom
  const left = generateElevationView(hc, "left", scale, false, ss); // West (left)
  const right = generateElevationView(hc, "right", scale, false, ss); // East (right)

  const P = svgDims(plan);
  const N = svgDims(north);
  const S = svgDims(south);
  const W = svgDims(left);
  const E = svgDims(right);

  // Gap + outer padding scale with the drawing (via the elevation margin,
  // which tracks textScale) so spacing is proportional across unit systems.
  // Each elevation paints its outer dimension + roof up to `horizontalMargin`
  // (= scaledSpacing(150)) beyond its declared box; with overflow visible that
  // would spill into the neighbour. Two facing views can each overflow toward
  // the gap, so size it to ~2.5× that margin to clear both plus breathing
  // room — keeping every view's full dimensions legible and non-overlapping.
  const elevMargin = scaledSpacing(150);
  const gap = Math.max(60, Math.round(2.5 * elevMargin));
  // Padding so a view's outer dimensions / roof tip / title at the sheet edge
  // isn't clipped by the root viewBox.
  const pad = Math.max(30, Math.round(1.3 * elevMargin));

  // W/E are rotated 90°, so their footprint bbox swaps (w↔h).
  const Wbox = { w: W.h, h: W.w };
  const Ebox = { w: E.h, h: E.w };

  // 3×3 grid; only the centre + 4 mid-edge cells are filled.
  const leftColW = Wbox.w;
  const rightColW = Ebox.w;
  const centreColW = Math.max(P.w, N.w, S.w);
  const topRowH = N.h;
  const bottomRowH = S.h;
  const midRowH = Math.max(P.h, Wbox.h, Ebox.h);

  const centreColX = pad + leftColW + gap;
  const midRowY = pad + topRowH + gap;

  // Each drawing centred within its cell (precise projection-line alignment
  // is a later polish; this reads as a coordinated cross for now).
  const nX = centreColX + (centreColW - N.w) / 2;
  const nY = pad;
  const sX = centreColX + (centreColW - S.w) / 2;
  const sY = midRowY + midRowH + gap;
  const pX = centreColX + (centreColW - P.w) / 2;
  const pY = midRowY + (midRowH - P.h) / 2;
  const wBoxX = pad;
  const wBoxY = midRowY + (midRowH - Wbox.h) / 2;
  const eBoxX = centreColX + centreColW + gap;
  const eBoxY = midRowY + (midRowH - Ebox.h) / 2;

  const totalW = pad + leftColW + gap + centreColW + gap + rightColW + pad;
  const totalH = pad + topRowH + gap + midRowH + gap + bottomRowH + pad;

  // West on the left: rotate CW so its ground line faces the plan (right)
  // and north is up. East on the right: rotate CCW (mirror). We'll confirm
  // orientation visually and flip the dirs if a roof points the wrong way.
  const parts = [
    plan && placeSvg(plan, pX, pY),
    north && placeSvg(north, nX, nY),
    south && placeSvg(south, sX, sY),
    left && placeRotated(left, W.w, W.h, wBoxX, wBoxY, "cw"),
    right && placeRotated(right, E.w, E.h, eBoxX, eBoxY, "ccw"),
  ].filter(Boolean);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(totalW)}" height="${round(totalH)}" ` +
    `viewBox="0 0 ${round(totalW)} ${round(totalH)}">\n` +
    `<rect x="0" y="0" width="${round(totalW)}" height="${round(totalH)}" fill="#ffffff"/>\n` +
    parts.join("\n") +
    `\n</svg>\n`
  );
}
