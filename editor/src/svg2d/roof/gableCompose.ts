// MVP gable-roof detail panels for the viewer's Roof Details tab.
// Two panels per gable_roof:
//   - Top view: rectangle showing the roof footprint (eave outline)
//     with the ridge line down the middle + width / length dimensions
//   - Cross-section: perpendicular slice showing the triangular gable
//     profile with eave, wall top, ridge, half-transverse and rise
//     dimensions
//
// Panels are keyed by the gable's floor + object index so multiple
// gables get unique filenames + titles.

import type { HouseConfig } from "../expand";
import { deriveAllGableRoofs, type GableRoofConfig, type GableRoofGeom } from "./gableGeometry";
import { DEFAULT_GLOBAL_CONFIG } from "../config";

export interface GablePanelFile {
  id: string;                    // e.g. "gable_top_0"
  title: string;                 // Human-readable panel title
  filename: string;              // "roof_gable_top_0.svg"
  content: string;               // SVG XML
  width: number;
  height: number;
}

const AXIS_COLOR = "#333";
const RIDGE_COLOR = "#8B4513";
const EAVE_COLOR = "#666";
const DIM_COLOR = "#0066cc";
const RAFTER_COLOR = "#666";
const PURLIN_COLOR = "#a08a70";
const RING_COLOR = "#444";
const TRUSS_COLOR = "#B85028";

// Resolve the framing chain: roof.framing.X → GC.roof_framing.X.
function resolveFraming(cfg: GableRoofConfig) {
  const g = DEFAULT_GLOBAL_CONFIG.roof_framing;
  const fr = (cfg.framing as Record<string, unknown> | undefined) ?? {};
  return {
    rafter_size_in: (fr.rafter_size_in as [number, number] | undefined) ?? g.rafter_size_in,
    rafter_spacing_in: (fr.rafter_spacing_in as number | undefined) ?? g.rafter_spacing_in,
    purlin_size_in: (fr.purlin_size_in as [number, number] | undefined) ?? g.purlin_size_in,
    purlin_spacing_in: (fr.purlin_spacing_in as number | undefined) ?? g.purlin_spacing_in,
    ridge_size_in: (fr.ridge_size_in as [number, number] | undefined) ?? g.ridge_size_in,
    ring_beam_size_in:
      ((fr.ring_beam as { size_in?: [number, number] } | undefined)?.size_in) ??
      g.ring_beam_size_in,
  };
}

// 1 inch → project units. 10 units = 1 ft = 12 in.
const IN_TO_U = 10 / 12;

// Fixed pixel canvas for each panel. The house model is scaled to fit
// with a margin. Two panels per gable keeps card sizes consistent
// in the grid layout.
const CANVAS_W = 720;
const CANVAS_H = 480;
const MARGIN = 60;

function svgHeader(w: number, h: number, title: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n` +
    `<title>${escapeAttr(title)}</title>\n` +
    `<defs>\n` +
    `  <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n` +
    `    <path d="M0,0 L10,5 L0,10 z" fill="${DIM_COLOR}"/>\n` +
    `  </marker>\n` +
    `  <style>text { font-family: -apple-system, Arial, sans-serif; }</style>\n` +
    `</defs>\n` +
    `<rect width="${w}" height="${h}" fill="#fafafa"/>\n` +
    `<text x="${w / 2}" y="28" text-anchor="middle" font-size="18" font-weight="600" fill="#222">${escapeAttr(title)}</text>\n`
  );
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

// Format project-unit length as "X'-Y" (feet-inches). 10 units = 1 ft.
function fmtFtIn(units: number): string {
  const inches = Math.round((units / 10) * 12);
  const ft = Math.floor(inches / 12);
  const rem = inches % 12;
  if (rem === 0) return `${ft}'`;
  return `${ft}'-${rem}"`;
}

function n(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// ---------------------------------------------------------------
// Top view: rectangle + ridge + rafters + ring beam + trusses
// ---------------------------------------------------------------
function gableTopViewSvg(
  geom: GableRoofGeom,
  cfg: GableRoofConfig,
  title: string,
): string {
  const { eave_x_west: ex_w, eave_x_east: ex_e, eave_y_north: ey_n, eave_y_south: ey_s,
    ridge_y_start: rys, ridge_y_end: rye } = geom;
  const fr = resolveFraming(cfg);
  const modelW = ex_e - ex_w;
  const modelL = ey_s - ey_n;
  const availW = CANVAS_W - 2 * MARGIN;
  const availH = CANVAS_H - 2 * MARGIN - 20;
  const scale = Math.min(availW / modelW, availH / modelL);
  const drawW = modelW * scale;
  const drawH = modelL * scale;
  const originX = (CANVAS_W - drawW) / 2;
  const originY = (CANVAS_H - drawH) / 2 + 10;
  const px = (wx: number) => originX + (wx - ex_w) * scale;
  const py = (wy: number) => originY + (wy - ey_n) * scale;

  let s = svgHeader(CANVAS_W, CANVAS_H, title);

  // Ring beam — perimeter loop at wall top. For roofs with x/y/width/length
  // set, that's the roof's own rectangle (inside the eave overhang).
  // Fall back to the eave rectangle if unavailable.
  const rx = (cfg as { x?: number }).x;
  const ry = (cfg as { y?: number }).y;
  const rw = (cfg as { width?: number }).width;
  const rl = (cfg as { length?: number }).length;
  if (rx !== undefined && ry !== undefined && rw !== undefined && rl !== undefined) {
    s += `<rect x="${px(rx)}" y="${py(ry)}" width="${(rw) * scale}" height="${(rl) * scale}" fill="none" stroke="${RING_COLOR}" stroke-width="1" stroke-dasharray="8 4"/>\n`;
    s += `<text x="${px(rx + rw) - 4}" y="${py(ry) + 12}" text-anchor="end" font-size="9" fill="${RING_COLOR}">ring beam ${fr.ring_beam_size_in[0]}×${fr.ring_beam_size_in[1]}"</text>\n`;
  }

  // Rafters — from ridge down to eave on both slopes, spaced at
  // rafter_spacing_in along Y. Drawn as thin light-grey lines from
  // west eave to ridge (repeated for east) at each Y position.
  const rafterSpacingU = fr.rafter_spacing_in * IN_TO_U;
  const ridgeXpx = px((ex_w + ex_e) / 2);
  const rafterYs: number[] = [];
  for (let y = rys; y <= rye + 1e-6; y += rafterSpacingU) rafterYs.push(y);
  if (rafterYs[rafterYs.length - 1] < rye - 1e-6) rafterYs.push(rye);
  for (const y of rafterYs) {
    const yp = py(y);
    s += `<line x1="${px(ex_w)}" y1="${yp}" x2="${ridgeXpx}" y2="${yp}" stroke="${RAFTER_COLOR}" stroke-width="0.6" opacity="0.55"/>\n`;
    s += `<line x1="${ridgeXpx}" y1="${yp}" x2="${px(ex_e)}" y2="${yp}" stroke="${RAFTER_COLOR}" stroke-width="0.6" opacity="0.55"/>\n`;
  }

  // Purlins — parallel to ridge, one line per purlin per slope,
  // projected to the top view. Space along the slope surface at
  // purlin_spacing_in; project each to its X position between ridge
  // and eave. Drawn bolder than rafters so the two grids are
  // distinguishable at a glance.
  const halfTrans = modelW / 2;
  const shellRise = geom.ridge_h + geom.wall_top_above_eave;
  const slopeLen = Math.hypot(halfTrans, shellRise);
  const purlinSpacingU = fr.purlin_spacing_in * IN_TO_U;
  const nPurlins = Math.max(1, Math.floor(slopeLen / purlinSpacingU));
  const ridgeXworld = (ex_w + ex_e) / 2;
  // Skip i=0 (that's the ridge line itself) and i=nPurlins (that's the eave).
  for (let i = 1; i < nPurlins; i++) {
    const t = i / nPurlins; // 0 at ridge, 1 at eave
    const xW = ridgeXworld - t * halfTrans; // west slope purlin X
    const xE = ridgeXworld + t * halfTrans;
    const xWpx = px(xW);
    const xEpx = px(xE);
    s += `<line x1="${xWpx}" y1="${py(rys)}" x2="${xWpx}" y2="${py(rye)}" stroke="${PURLIN_COLOR}" stroke-width="1" opacity="0.9"/>\n`;
    s += `<line x1="${xEpx}" y1="${py(rys)}" x2="${xEpx}" y2="${py(rye)}" stroke="${PURLIN_COLOR}" stroke-width="1" opacity="0.9"/>\n`;
  }

  // Eave outline (on top of rafters so it reads)
  s += `<rect x="${px(ex_w)}" y="${py(ey_n)}" width="${drawW}" height="${drawH}" fill="none" stroke="${EAVE_COLOR}" stroke-width="1.5"/>\n`;

  // Ridge (bold, on top of everything)
  s += `<line x1="${ridgeXpx}" y1="${py(rys)}" x2="${ridgeXpx}" y2="${py(rye)}" stroke="${RIDGE_COLOR}" stroke-width="2.4"/>\n`;
  s += `<text x="${ridgeXpx + 8}" y="${py((rys + rye) / 2)}" font-size="10" fill="${RIDGE_COLOR}">ridge</text>\n`;

  // Truss positions — if configured, draw across-the-slope lines at
  // each Y with a small marker. These are the same positions the 3D
  // frame renderer consumes.
  const trusses = (cfg as { trusses?: { positions?: number[] } }).trusses;
  const tPositions = trusses?.positions ?? [];
  for (const tp of tPositions) {
    const yp = py(tp);
    s += `<line x1="${px(ex_w)}" y1="${yp}" x2="${px(ex_e)}" y2="${yp}" stroke="${TRUSS_COLOR}" stroke-width="1.6" opacity="0.85"/>\n`;
    s += `<text x="${px(ex_e) + 4}" y="${yp + 3}" font-size="9" fill="${TRUSS_COLOR}">truss</text>\n`;
  }

  // Dimensions
  const dimYbottom = py(ey_s) + 22;
  s += `<line x1="${px(ex_w)}" y1="${dimYbottom}" x2="${px(ex_e)}" y2="${dimYbottom}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${dimYbottom + 12}" text-anchor="middle" font-size="10" fill="${DIM_COLOR}">${fmtFtIn(modelW)} (W ${n(modelW)})</text>\n`;
  const dimXright = px(ex_e) + 22;
  s += `<line x1="${dimXright}" y1="${py(ey_n)}" x2="${dimXright}" y2="${py(ey_s)}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${dimXright + 6}" y="${(py(ey_n) + py(ey_s)) / 2}" font-size="10" fill="${DIM_COLOR}" dominant-baseline="middle">${fmtFtIn(modelL)} (L ${n(modelL)})</text>\n`;

  // N/S/E/W labels
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${py(ey_n) - 6}" text-anchor="middle" font-size="10" fill="${AXIS_COLOR}">N</text>\n`;
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${py(ey_s) + 12}" text-anchor="middle" font-size="10" fill="${AXIS_COLOR}">S</text>\n`;
  s += `<text x="${px(ex_w) - 10}" y="${(py(ey_n) + py(ey_s)) / 2}" text-anchor="end" font-size="10" fill="${AXIS_COLOR}">W</text>\n`;
  s += `<text x="${px(ex_e) + 6}" y="${(py(ey_n) + py(ey_s)) / 2}" font-size="10" fill="${AXIS_COLOR}">E</text>\n`;

  // Legend / spec block
  const legendY = CANVAS_H - 42;
  s += `<text x="${MARGIN}" y="${legendY}" font-size="10" fill="${AXIS_COLOR}">Rafters ${fr.rafter_size_in[0]}×${fr.rafter_size_in[1]}" @ ${fr.rafter_spacing_in}″ o.c. · ${rafterYs.length} shown</text>\n`;
  s += `<text x="${MARGIN}" y="${legendY + 14}" font-size="10" fill="${AXIS_COLOR}">Purlins ${fr.purlin_size_in[0]}×${fr.purlin_size_in[1]}" @ ${fr.purlin_spacing_in}″ o.c. · ${nPurlins - 1} per slope · Ridge ${fr.ridge_size_in[0]}×${fr.ridge_size_in[1]}" · Ring beam ${fr.ring_beam_size_in[0]}×${fr.ring_beam_size_in[1]}"</text>\n`;
  if (tPositions.length > 0) {
    s += `<text x="${MARGIN}" y="${legendY + 28}" font-size="10" fill="${TRUSS_COLOR}">Trusses × ${tPositions.length} (${(trusses as { type?: string }).type ?? "fink"})</text>\n`;
  }

  s += `</svg>\n`;
  return s;
}

// ---------------------------------------------------------------
// Cross-section: triangular profile perpendicular to the ridge
// ---------------------------------------------------------------
function gableCrossSectionSvg(
  geom: GableRoofGeom,
  cfg: GableRoofConfig,
  wallTopZ: number,
  title: string,
): string {
  const { eave_x_west: ex_w, eave_x_east: ex_e, eave_z: eaveZ } = geom;
  const ridgeZ = wallTopZ + geom.ridge_h;
  const fr = resolveFraming(cfg);
  const modelW = ex_e - ex_w;
  const modelH = ridgeZ - eaveZ;
  const availW = CANVAS_W - 2 * MARGIN;
  const availH = CANVAS_H - 2 * MARGIN - 20;
  const scale = Math.min(availW / modelW, availH / modelH);
  const drawW = modelW * scale;
  const drawH = modelH * scale;
  const originX = (CANVAS_W - drawW) / 2;
  const originY = (CANVAS_H - drawH) / 2 + 10;
  const px = (wx: number) => originX + (wx - ex_w) * scale;
  const py = (wz: number) => originY + (ridgeZ - wz) * scale;

  const ridgeX = (ex_w + ex_e) / 2;
  let s = svgHeader(CANVAS_W, CANVAS_H, title);

  // Roof profile (soft laterite wash)
  s += `<polygon points="${px(ex_w)},${py(eaveZ)} ${px(ridgeX)},${py(ridgeZ)} ${px(ex_e)},${py(eaveZ)}" fill="#f4dfd3" fill-opacity="0.35" stroke="${RIDGE_COLOR}" stroke-width="2"/>\n`;

  // Frame stack: ridge beam at peak, rafter cross-sections, purlin
  // cross-sections marching up each slope, ring beam at wall top.
  const halfTrans = modelW / 2;
  const slopeLen = Math.hypot(halfTrans, geom.ridge_h + geom.wall_top_above_eave);

  // Ring beam (west + east sections, at wall top)
  if (wallTopZ > eaveZ) {
    const rbW = fr.ring_beam_size_in[0] * IN_TO_U;
    const rbD = fr.ring_beam_size_in[1] * IN_TO_U;
    // Ring beams sit at inner wall edges — approximate as at wall top
    // Z, spanning wallInsetTrans on each side. Show as two small boxes.
    const wallInset = Math.max(0, halfTrans * 0.05); // small inset for visibility
    const rbYtop = py(wallTopZ + rbD);
    const rbYbot = py(wallTopZ);
    const rbWpx = rbW * scale;
    // West ring beam
    s += `<rect x="${px(ex_w + wallInset)}" y="${rbYtop}" width="${rbWpx}" height="${rbYbot - rbYtop}" fill="${RING_COLOR}" opacity="0.75"/>\n`;
    // East ring beam
    s += `<rect x="${px(ex_e - wallInset) - rbWpx}" y="${rbYtop}" width="${rbWpx}" height="${rbYbot - rbYtop}" fill="${RING_COLOR}" opacity="0.75"/>\n`;
    s += `<line x1="${px(ex_w) + 20}" y1="${py(wallTopZ)}" x2="${px(ex_e) - 20}" y2="${py(wallTopZ)}" stroke="${AXIS_COLOR}" stroke-width="0.6" stroke-dasharray="4 3"/>\n`;
    s += `<text x="${px(ex_e) - 24}" y="${py(wallTopZ) - 3}" text-anchor="end" font-size="9" fill="${AXIS_COLOR}">wall top</text>\n`;
  }

  // Ridge beam cross-section (small box at peak)
  const ridgeW = fr.ridge_size_in[0] * IN_TO_U;
  const ridgeD = fr.ridge_size_in[1] * IN_TO_U;
  const rdgWpx = ridgeW * scale;
  const rdgDpx = ridgeD * scale;
  s += `<rect x="${px(ridgeX) - rdgWpx / 2}" y="${py(ridgeZ)}" width="${rdgWpx}" height="${rdgDpx}" fill="${RIDGE_COLOR}"/>\n`;
  s += `<text x="${px(ridgeX) + 6}" y="${py(ridgeZ) - 4}" font-size="10" fill="${RIDGE_COLOR}">ridge ${fr.ridge_size_in[0]}×${fr.ridge_size_in[1]}"</text>\n`;

  // Rafter cross-section — draw one small filled box at each eave to
  // show the section, and a diagonal centreline running from eave up
  // to ridge to indicate rafter direction.
  const rfD = fr.rafter_size_in[1] * IN_TO_U;
  const rfW = fr.rafter_size_in[0] * IN_TO_U;
  const rfDpx = rfD * scale;
  const rfWpx = rfW * scale;
  // West rafter section (just above eave)
  s += `<rect x="${px(ex_w)}" y="${py(eaveZ) - rfDpx}" width="${rfWpx}" height="${rfDpx}" fill="${RAFTER_COLOR}" opacity="0.9"/>\n`;
  s += `<rect x="${px(ex_e) - rfWpx}" y="${py(eaveZ) - rfDpx}" width="${rfWpx}" height="${rfDpx}" fill="${RAFTER_COLOR}" opacity="0.9"/>\n`;
  s += `<text x="${px(ex_w) + rfWpx + 3}" y="${py(eaveZ) - 4}" font-size="9" fill="${RAFTER_COLOR}">rafter ${fr.rafter_size_in[0]}×${fr.rafter_size_in[1]}" @ ${fr.rafter_spacing_in}″ o.c.</text>\n`;

  // Purlin cross-sections — evenly spaced along the slope from eave
  // to ridge. Small squares at intervals.
  const purlinSpacingU = fr.purlin_spacing_in * IN_TO_U;
  const nPurlins = Math.max(1, Math.floor(slopeLen / purlinSpacingU));
  const plW = fr.purlin_size_in[0] * IN_TO_U;
  const plD = fr.purlin_size_in[1] * IN_TO_U;
  const plWpx = plW * scale;
  const plDpx = plD * scale;
  for (let i = 1; i < nPurlins; i++) {
    const t = i / nPurlins;
    const xW = ridgeX - halfTrans + t * halfTrans; // west slope purlin X
    const xE = ridgeX + halfTrans - t * halfTrans;
    const zP = eaveZ + t * (ridgeZ - eaveZ);
    s += `<rect x="${px(xW) - plWpx / 2}" y="${py(zP) - plDpx / 2}" width="${plWpx}" height="${plDpx}" fill="${PURLIN_COLOR}" opacity="0.85"/>\n`;
    s += `<rect x="${px(xE) - plWpx / 2}" y="${py(zP) - plDpx / 2}" width="${plWpx}" height="${plDpx}" fill="${PURLIN_COLOR}" opacity="0.85"/>\n`;
  }
  s += `<text x="${px(ex_w) + rfWpx + 3}" y="${py(eaveZ) - 18}" font-size="9" fill="${PURLIN_COLOR}">purlins ${fr.purlin_size_in[0]}×${fr.purlin_size_in[1]}" @ ${fr.purlin_spacing_in}″ o.c. · ${nPurlins - 1} shown</text>\n`;

  // Truss silhouette — sits INSIDE the walls, so top chords must end
  // at the actual wall corners (roof.x / roof.x + roof.width), not at
  // the eave. Peak sits just under the ridge beam.
  const trusses = (cfg as { trusses?: { positions?: number[]; chord_size_in?: [number, number]; web_size_in?: [number, number] } }).trusses;
  if (trusses?.positions && trusses.positions.length > 0) {
    const chordS = trusses.chord_size_in ?? [2, 4];
    const webS = trusses.web_size_in ?? [2, 2];
    const chordCentreZ = wallTopZ + (chordS[1] * IN_TO_U) / 2;
    // Wall X coords in world units. If x/width aren't set the roof
    // effectively spans the plot, so fall back to the eave with a
    // small inward inset so the truss still reads as inside.
    const roofXcfg = (cfg as { x?: number }).x;
    const roofWcfg = (cfg as { width?: number }).width;
    const wallXwest = roofXcfg !== undefined ? roofXcfg : ex_w + (ex_e - ex_w) * 0.05;
    const wallXeast = roofXcfg !== undefined && roofWcfg !== undefined
      ? roofXcfg + roofWcfg
      : ex_e - (ex_e - ex_w) * 0.05;
    const peakZ = ridgeZ - ridgeD; // top chord's top face kisses ridge bottom
    // Bottom chord (at wall top, between the two walls)
    s += `<line x1="${px(wallXwest)}" y1="${py(chordCentreZ)}" x2="${px(wallXeast)}" y2="${py(chordCentreZ)}" stroke="${TRUSS_COLOR}" stroke-width="${(chordS[1] * IN_TO_U * scale).toFixed(2)}" opacity="0.65"/>\n`;
    // Top chords
    s += `<line x1="${px(wallXwest)}" y1="${py(chordCentreZ)}" x2="${px(ridgeX)}" y2="${py(peakZ)}" stroke="${TRUSS_COLOR}" stroke-width="${(chordS[1] * IN_TO_U * scale).toFixed(2)}" opacity="0.65"/>\n`;
    s += `<line x1="${px(wallXeast)}" y1="${py(chordCentreZ)}" x2="${px(ridgeX)}" y2="${py(peakZ)}" stroke="${TRUSS_COLOR}" stroke-width="${(chordS[1] * IN_TO_U * scale).toFixed(2)}" opacity="0.65"/>\n`;
    // King post
    s += `<line x1="${px(ridgeX)}" y1="${py(chordCentreZ)}" x2="${px(ridgeX)}" y2="${py(peakZ)}" stroke="${TRUSS_COLOR}" stroke-width="${(webS[1] * IN_TO_U * scale).toFixed(2)}" opacity="0.55"/>\n`;
    s += `<text x="${px(ridgeX) + 12}" y="${py(chordCentreZ) - 4}" font-size="9" fill="${TRUSS_COLOR}">truss (typ.)</text>\n`;
  }

  // Ridge + eave markers on top
  s += `<circle cx="${px(ex_w)}" cy="${py(eaveZ)}" r="2.5" fill="${EAVE_COLOR}"/>\n`;
  s += `<circle cx="${px(ex_e)}" cy="${py(eaveZ)}" r="2.5" fill="${EAVE_COLOR}"/>\n`;

  // Dimensions
  const dimYbottom = py(eaveZ) + 22;
  s += `<line x1="${px(ex_w)}" y1="${dimYbottom}" x2="${px(ex_e)}" y2="${dimYbottom}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${dimYbottom + 12}" text-anchor="middle" font-size="10" fill="${DIM_COLOR}">${fmtFtIn(modelW)} · ${n(modelW)} u</text>\n`;
  const dimXleft = px(ex_w) - 22;
  const rh = ridgeZ - wallTopZ;
  s += `<line x1="${dimXleft}" y1="${py(wallTopZ)}" x2="${dimXleft}" y2="${py(ridgeZ)}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${dimXleft - 6}" y="${(py(wallTopZ) + py(ridgeZ)) / 2}" text-anchor="end" font-size="10" fill="${DIM_COLOR}" dominant-baseline="middle">ridge_h ${n(rh)} u</text>\n`;
  // Pitch angle
  const halfBase = modelW / 2;
  const pitchDeg = (Math.atan2(rh, halfBase) * 180) / Math.PI;
  s += `<text x="${(px(ex_w) + px(ridgeX)) / 2}" y="${(py(eaveZ) + py(ridgeZ)) / 2}" font-size="10" fill="${AXIS_COLOR}">pitch ≈ ${pitchDeg.toFixed(1)}°</text>\n`;

  s += `</svg>\n`;
  return s;
}

// ---------------------------------------------------------------
// Slope-face framing view — the outer face of one slope, unrolled
// flat. Width = ridge length (Y extent). Height = slope surface
// length from eave to ridge. Shows both grids on the same slope:
//   - Rafters run perpendicular to the ridge, so on the unrolled
//     face they appear as VERTICAL lines at rafter_spacing_in
//     along Y.
//   - Purlins run parallel to the ridge, so they appear as
//     HORIZONTAL lines at purlin_spacing_in up the slope surface.
//   - Ridge beam at top, eave at bottom.
// This replaces the earlier "longitudinal section" which was just
// a silhouette without frame detail.
// ---------------------------------------------------------------
function gableSlopeFramingSvg(
  geom: GableRoofGeom,
  cfg: GableRoofConfig,
  wallTopZ: number,
  title: string,
): string {
  const { ridge_y_start: rys, ridge_y_end: rye, eave_x_west: ex_w, eave_x_east: ex_e } = geom;
  const fr = resolveFraming(cfg);

  // Slope surface length: sqrt((halfTrans)² + (ridge_h + wall_top_above_eave)²).
  const halfTrans = (ex_e - ex_w) / 2;
  const shellRise = geom.ridge_h + geom.wall_top_above_eave;
  const slopeLen = Math.hypot(halfTrans, shellRise);
  const modelL = rye - rys;

  const availW = CANVAS_W - 2 * MARGIN;
  const availH = CANVAS_H - 2 * MARGIN - 40;
  const scale = Math.min(availW / modelL, availH / slopeLen);
  const drawW = modelL * scale;
  const drawH = slopeLen * scale;
  const originX = (CANVAS_W - drawW) / 2;
  const originY = (CANVAS_H - drawH) / 2 + 10;
  // Unrolled slope local coords: x runs along Y (ridge length),
  // y runs along the slope surface from ridge (top) to eave (bottom).
  const px = (yWorld: number) => originX + (yWorld - rys) * scale;
  const py = (slopeYfromRidge: number) => originY + slopeYfromRidge * scale;

  let s = svgHeader(CANVAS_W, CANVAS_H, title);

  // Slope face background (soft laterite wash)
  s += `<rect x="${originX}" y="${originY}" width="${drawW}" height="${drawH}" fill="#f4dfd3" fill-opacity="0.35" stroke="${RIDGE_COLOR}" stroke-width="1.5"/>\n`;

  // Ring beam projected (dashed) — the wall top isn't on the slope
  // surface itself, but its horizontal projection lands at
  //   slopeY = (wall_top_above_eave / shellRise) * slopeLen
  //          = slopeLen * wte / shellRise
  // measuring from the eave. So from the ridge that's slopeLen minus
  // that.
  const wteRatio = geom.wall_top_above_eave / Math.max(1e-9, shellRise);
  const ringSlopeY = (1 - wteRatio) * slopeLen;
  s += `<line x1="${originX}" y1="${py(ringSlopeY)}" x2="${originX + drawW}" y2="${py(ringSlopeY)}" stroke="${RING_COLOR}" stroke-width="1" stroke-dasharray="4 3" opacity="0.75"/>\n`;
  s += `<text x="${originX + drawW - 4}" y="${py(ringSlopeY) - 3}" text-anchor="end" font-size="9" fill="${RING_COLOR}">ring beam (wall top proj.)</text>\n`;

  // Purlins — horizontal lines, one per purlin. Position along slope
  // = i * purlin_spacing (measured from ridge). Skip 0 (ridge) and
  // slopeLen (eave) to avoid overlaps with the border.
  const purlinSpacingU = fr.purlin_spacing_in * IN_TO_U;
  const nPurlins = Math.max(1, Math.floor(slopeLen / purlinSpacingU));
  for (let i = 1; i < nPurlins; i++) {
    const t = i / nPurlins;
    const sy = t * slopeLen;
    s += `<line x1="${originX}" y1="${py(sy)}" x2="${originX + drawW}" y2="${py(sy)}" stroke="${PURLIN_COLOR}" stroke-width="1" opacity="0.85"/>\n`;
  }
  s += `<text x="${originX + 4}" y="${py(slopeLen * 0.5) - 3}" font-size="9" fill="${PURLIN_COLOR}">purlins ${fr.purlin_size_in[0]}×${fr.purlin_size_in[1]}" @ ${fr.purlin_spacing_in}″ o.c. · ${nPurlins - 1} shown</text>\n`;

  // Rafters — vertical lines at rafter_spacing_in along Y.
  const rafterSpacingU = fr.rafter_spacing_in * IN_TO_U;
  const rafterYs: number[] = [];
  for (let y = rys; y <= rye + 1e-6; y += rafterSpacingU) rafterYs.push(y);
  if (rafterYs[rafterYs.length - 1] < rye - 1e-6) rafterYs.push(rye);
  for (const y of rafterYs) {
    const xp = px(y);
    s += `<line x1="${xp}" y1="${originY}" x2="${xp}" y2="${originY + drawH}" stroke="${RAFTER_COLOR}" stroke-width="0.9" opacity="0.75"/>\n`;
  }
  s += `<text x="${originX + drawW - 4}" y="${py(slopeLen * 0.5) - 3}" text-anchor="end" font-size="9" fill="${RAFTER_COLOR}">rafters ${fr.rafter_size_in[0]}×${fr.rafter_size_in[1]}" @ ${fr.rafter_spacing_in}″ o.c. · ${rafterYs.length} shown</text>\n`;

  // Ridge beam — bold band along the top edge
  const ridgeD = fr.ridge_size_in[1] * IN_TO_U * scale;
  s += `<rect x="${originX}" y="${originY - ridgeD}" width="${drawW}" height="${ridgeD}" fill="${RIDGE_COLOR}"/>\n`;
  s += `<text x="${originX - 4}" y="${originY - 4}" text-anchor="end" font-size="10" fill="${RIDGE_COLOR}">ridge beam</text>\n`;

  // Eave edge — thin dashed line at the bottom
  s += `<text x="${originX - 4}" y="${originY + drawH + 4}" text-anchor="end" font-size="10" fill="${EAVE_COLOR}">eave</text>\n`;

  // Truss verticals — one per truss position, from ridge to ring beam
  // projection (only on the slope face — top-chord segment).
  const trusses = (cfg as { trusses?: { positions?: number[]; web_size_in?: [number, number] } }).trusses;
  const positions = trusses?.positions ?? [];
  const webS = trusses?.web_size_in ?? [2, 2];
  const trussWpx = Math.max(3, webS[0] * IN_TO_U * scale);
  for (const p of positions) {
    if (p < rys || p > rye) continue;
    s += `<rect x="${px(p) - trussWpx / 2}" y="${originY}" width="${trussWpx}" height="${py(ringSlopeY) - originY}" fill="${TRUSS_COLOR}" opacity="0.6"/>\n`;
    s += `<text x="${px(p)}" y="${originY + drawH + 14}" text-anchor="middle" font-size="9" fill="${TRUSS_COLOR}">${fmtFtIn(p - rys)}</text>\n`;
  }

  // Ridge-length dimension
  const dimY = originY + drawH + 30;
  s += `<line x1="${px(rys)}" y1="${dimY}" x2="${px(rye)}" y2="${dimY}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${(px(rys) + px(rye)) / 2}" y="${dimY + 12}" text-anchor="middle" font-size="10" fill="${DIM_COLOR}">Ridge ${fmtFtIn(modelL)} · ${n(modelL)} u</text>\n`;

  // Slope-length dimension (right side)
  const dimX = originX + drawW + 22;
  s += `<line x1="${dimX}" y1="${originY}" x2="${dimX}" y2="${originY + drawH}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${dimX + 6}" y="${(originY + originY + drawH) / 2}" font-size="10" fill="${DIM_COLOR}" dominant-baseline="middle">Slope ${fmtFtIn(slopeLen)}</text>\n`;

  // Legend
  const legendY = CANVAS_H - 12;
  s += `<text x="${MARGIN}" y="${legendY}" font-size="10" fill="${AXIS_COLOR}">One slope unrolled flat — same slope + same members drawn on the E face too.</text>\n`;

  void wallTopZ;
  s += `</svg>\n`;
  return s;
}

// ---------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------
export function generateGablePanels(cfg: HouseConfig): GablePanelFile[] {
  const out: GablePanelFile[] = [];
  let gables;
  try {
    gables = deriveAllGableRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch (e) {
    console.warn("[gablePanels] derivation failed:", e);
    return out;
  }
  gables.forEach((g, idx) => {
    const geom = g.geom;
    const eaveZ = geom.eave_z;
    const wallTopZ = eaveZ + geom.wall_top_above_eave;
    const suffix = gables.length > 1 ? ` ${idx + 1}` : "";
    out.push({
      id: `gable_top_${idx}`,
      title: `Gable roof${suffix} — framing plan`,
      filename: `roof_gable_top_${idx}.svg`,
      content: gableTopViewSvg(geom, g.config, `Gable roof${suffix} — framing plan (rafters, purlins, ridge, ring beam)`),
      width: CANVAS_W,
      height: CANVAS_H,
    });
    out.push({
      id: `gable_section_${idx}`,
      title: `Gable roof${suffix} — cross-section`,
      filename: `roof_gable_section_${idx}.svg`,
      content: gableCrossSectionSvg(geom, g.config, wallTopZ, `Gable roof${suffix} — cross-section (transverse to ridge)`),
      width: CANVAS_W,
      height: CANVAS_H,
    });
    out.push({
      id: `gable_slope_${idx}`,
      title: `Gable roof${suffix} — slope framing`,
      filename: `roof_gable_slope_${idx}.svg`,
      content: gableSlopeFramingSvg(geom, g.config, wallTopZ, `Gable roof${suffix} — slope framing (unrolled: rafters + purlins on one slope)`),
      width: CANVAS_W,
      height: CANVAS_H,
    });
  });
  return out;
}
