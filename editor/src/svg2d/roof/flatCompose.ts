// Flat-roof detail panels + BOM contribution.
// One panel per flat_roof: top view + cross-section.

import type { HouseConfig } from "../expand";
import { deriveAllFlatRoofs, type FlatRoofConfig, type FlatRoofGeom } from "./flatGeometry";
import { DEFAULT_GLOBAL_CONFIG } from "../config";
import { matSpec, type FrameMember } from "./htmlBom";

export interface FlatPanelFile {
  id: string;
  title: string;
  filename: string;
  content: string;
  width: number;
  height: number;
}

const CANVAS_W = 720;
const CANVAS_H = 480;
const MARGIN = 60;
const RING_COLOR = "#444";
const SLAB_COLOR = "#8a8a8a";
const PARAPET_COLOR = "#c9b892";
const DIM_COLOR = "#0066cc";
const AXIS_COLOR = "#333";

function svgHeader(title: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">\n` +
    `<title>${escapeAttr(title)}</title>\n` +
    `<defs>\n` +
    `  <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n` +
    `    <path d="M0,0 L10,5 L0,10 z" fill="${DIM_COLOR}"/>\n` +
    `  </marker>\n` +
    `  <style>text { font-family: -apple-system, Arial, sans-serif; }</style>\n` +
    `</defs>\n` +
    `<rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#fafafa"/>\n` +
    `<text x="${CANVAS_W / 2}" y="28" text-anchor="middle" font-size="18" font-weight="600" fill="#222">${escapeAttr(title)}</text>\n`
  );
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function fmtFtIn(units: number): string {
  const inches = Math.round((units / 10) * 12);
  const ft = Math.floor(inches / 12);
  const rem = inches % 12;
  return rem === 0 ? `${ft}'` : `${ft}'-${rem}"`;
}
function n(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function flatTopViewSvg(geom: FlatRoofGeom, cfg: FlatRoofConfig, title: string): string {
  const { eave_x_west: ex_w, eave_x_east: ex_e, eave_y_north: ey_n, eave_y_south: ey_s } = geom;
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

  let s = svgHeader(title);
  // Outer eave outline
  s += `<rect x="${px(ex_w)}" y="${py(ey_n)}" width="${drawW}" height="${drawH}" fill="none" stroke="${SLAB_COLOR}" stroke-width="1.5"/>\n`;
  // Wall/roof rectangle (inside the overhang)
  const rx = (cfg.x ?? 0);
  const ry = (cfg.y ?? 0);
  const rw = (cfg.width ?? modelW - 2 * (geom.overhang ?? 0));
  const rl = (cfg.length ?? modelL - 2 * (geom.overhang ?? 0));
  s += `<rect x="${px(rx)}" y="${py(ry)}" width="${rw * scale}" height="${rl * scale}" fill="none" stroke="${RING_COLOR}" stroke-width="1" stroke-dasharray="8 4"/>\n`;
  // Parapet inset outline (parapet_thickness inside the wall edge)
  if (geom.parapet_height > 0) {
    const pt = geom.parapet_thickness;
    s += `<rect x="${px(rx + pt)}" y="${py(ry + pt)}" width="${(rw - 2 * pt) * scale}" height="${(rl - 2 * pt) * scale}" fill="${PARAPET_COLOR}" fill-opacity="0.3" stroke="${PARAPET_COLOR}" stroke-width="1.5"/>\n`;
    s += `<text x="${px(rx + rw / 2)}" y="${py(ry + pt / 2) + 4}" text-anchor="middle" font-size="9" fill="${RING_COLOR}">parapet ${n(geom.parapet_thickness)} u × ${n(geom.parapet_height)} u tall</text>\n`;
  }

  // Dimensions
  const dimYbottom = py(ey_s) + 22;
  s += `<line x1="${px(ex_w)}" y1="${dimYbottom}" x2="${px(ex_e)}" y2="${dimYbottom}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${dimYbottom + 12}" text-anchor="middle" font-size="10" fill="${DIM_COLOR}">${fmtFtIn(modelW)} · ${n(modelW)} u incl. overhang</text>\n`;
  const dimXright = px(ex_e) + 22;
  s += `<line x1="${dimXright}" y1="${py(ey_n)}" x2="${dimXright}" y2="${py(ey_s)}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${dimXright + 6}" y="${(py(ey_n) + py(ey_s)) / 2}" font-size="10" fill="${DIM_COLOR}" dominant-baseline="middle">${fmtFtIn(modelL)} · ${n(modelL)} u</text>\n`;

  // N/S/E/W
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${py(ey_n) - 6}" text-anchor="middle" font-size="10" fill="${AXIS_COLOR}">N</text>\n`;
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${py(ey_s) + 12}" text-anchor="middle" font-size="10" fill="${AXIS_COLOR}">S</text>\n`;
  s += `<text x="${px(ex_w) - 10}" y="${(py(ey_n) + py(ey_s)) / 2}" text-anchor="end" font-size="10" fill="${AXIS_COLOR}">W</text>\n`;
  s += `<text x="${px(ex_e) + 6}" y="${(py(ey_n) + py(ey_s)) / 2}" font-size="10" fill="${AXIS_COLOR}">E</text>\n`;

  // Legend
  const legendY = CANVAS_H - 28;
  s += `<text x="${MARGIN}" y="${legendY}" font-size="10" fill="${AXIS_COLOR}">Slab ${n(geom.slab_thickness)} u thick · Overhang ${n(geom.overhang)} u · Parapet ${geom.parapet_height > 0 ? `${n(geom.parapet_height)} u` : "none"}</text>\n`;
  s += `</svg>\n`;
  return s;
}

function flatSectionSvg(geom: FlatRoofGeom, cfg: FlatRoofConfig, title: string): string {
  const { eave_x_west: ex_w, eave_x_east: ex_e } = geom;
  const modelW = ex_e - ex_w;
  const modelH = geom.slab_thickness + geom.parapet_height + 20;
  const availW = CANVAS_W - 2 * MARGIN;
  const availH = CANVAS_H - 2 * MARGIN - 40;
  const scale = Math.min(availW / modelW, availH / Math.max(20, modelH));
  const drawW = modelW * scale;
  const drawH = modelH * scale;
  const originX = (CANVAS_W - drawW) / 2;
  const originY = (CANVAS_H - drawH) / 2 + 20;
  const px = (wx: number) => originX + (wx - ex_w) * scale;
  const py = (dz: number) => originY + (modelH - dz) * scale; // dz measured from bottom

  let s = svgHeader(title);

  // Slab (horizontal band)
  const slabZbot = 0;
  const slabZtop = geom.slab_thickness;
  s += `<rect x="${px(ex_w)}" y="${py(slabZtop)}" width="${drawW}" height="${(slabZtop - slabZbot) * scale}" fill="${SLAB_COLOR}" opacity="0.85"/>\n`;
  s += `<text x="${originX - 6}" y="${py(slabZtop / 2) + 4}" text-anchor="end" font-size="9" fill="${SLAB_COLOR}">slab ${n(geom.slab_thickness)} u</text>\n`;

  // Parapet — two vertical bars at east + west ends
  if (geom.parapet_height > 0) {
    const pt = geom.parapet_thickness;
    const roofX = cfg.x ?? 0;
    const roofW = cfg.width ?? modelW - 2 * geom.overhang;
    const parapetBottom = slabZtop;
    const parapetTop = parapetBottom + geom.parapet_height;
    // West parapet
    s += `<rect x="${px(roofX)}" y="${py(parapetTop)}" width="${pt * scale}" height="${geom.parapet_height * scale}" fill="${PARAPET_COLOR}"/>\n`;
    // East parapet
    s += `<rect x="${px(roofX + roofW - pt)}" y="${py(parapetTop)}" width="${pt * scale}" height="${geom.parapet_height * scale}" fill="${PARAPET_COLOR}"/>\n`;
    s += `<text x="${px(roofX + roofW / 2)}" y="${py(parapetTop) - 3}" text-anchor="middle" font-size="9" fill="${AXIS_COLOR}">parapet ${n(geom.parapet_height)} u tall × ${n(pt)} u thick</text>\n`;
  }

  // Wall projection (dashed vertical lines at roof.x / roof.x + width)
  const rx = cfg.x ?? 0;
  const rw = cfg.width ?? modelW - 2 * geom.overhang;
  s += `<line x1="${px(rx)}" y1="${py(slabZtop)}" x2="${px(rx)}" y2="${py(-15)}" stroke="${AXIS_COLOR}" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.6"/>\n`;
  s += `<line x1="${px(rx + rw)}" y1="${py(slabZtop)}" x2="${px(rx + rw)}" y2="${py(-15)}" stroke="${AXIS_COLOR}" stroke-width="0.5" stroke-dasharray="3 3" opacity="0.6"/>\n`;
  s += `<text x="${px(rx) + 3}" y="${py(-6)}" font-size="9" fill="${AXIS_COLOR}">wall</text>\n`;
  s += `<text x="${px(rx + rw) - 3}" y="${py(-6)}" text-anchor="end" font-size="9" fill="${AXIS_COLOR}">wall</text>\n`;

  // Width dimension
  const dimY = py(-25);
  s += `<line x1="${px(ex_w)}" y1="${dimY}" x2="${px(ex_e)}" y2="${dimY}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${dimY + 12}" text-anchor="middle" font-size="10" fill="${DIM_COLOR}">${fmtFtIn(modelW)} · ${n(modelW)} u incl. overhang</text>\n`;

  s += `</svg>\n`;
  return s;
}

// ---------------------------------------------------------------
// BOM contribution
// ---------------------------------------------------------------
function resolveRingBeamSize(cfg: FlatRoofConfig): [number, number] {
  const g = DEFAULT_GLOBAL_CONFIG.roof_framing;
  const fr = cfg.framing ?? {};
  return ((fr.ring_beam as { size_in?: [number, number] } | undefined)?.size_in) ?? g.ring_beam_size_in;
}
function resolveRingBeamWall(cfg: FlatRoofConfig): number {
  const g = DEFAULT_GLOBAL_CONFIG.roof_framing;
  const fr = cfg.framing ?? {};
  return (fr.ring_beam as { wall_mm?: number } | undefined)?.wall_mm ?? g.wall_thickness_mm?.ring_beam ?? 3;
}

export function collectFlatMembers(geom: FlatRoofGeom, cfg: FlatRoofConfig, roofIdx: number): FrameMember[] {
  const uToFt = (u: number) => u / 10.0;
  const out: FrameMember[] = [];
  const rw = cfg.width ?? (geom.eave_x_east - geom.eave_x_west - 2 * geom.overhang);
  const rl = cfg.length ?? (geom.eave_y_south - geom.eave_y_north - 2 * geom.overhang);
  const ringSize = resolveRingBeamSize(cfg);
  const ringWall = resolveRingBeamWall(cfg);
  // Ring beam / lintel band around the top of the walls.
  out.push({
    item: `Ring beam (flat #${roofIdx + 1})`,
    matSpec: matSpec(ringSize, ringWall),
    extraNote: "perimeter loop",
    count: 4,
    maxLenFt: uToFt(Math.max(rw, rl)),
    totalLenFt: uToFt(2 * (rw + rl)),
  });
  return out;
}

export function collectAllFlatMembers(cfg: HouseConfig): FrameMember[] {
  const out: FrameMember[] = [];
  let flats;
  try {
    flats = deriveAllFlatRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch (e) {
    console.warn("[flatBom] derivation failed:", e);
    return out;
  }
  flats.forEach((f, i) => out.push(...collectFlatMembers(f.geom, f.config, i)));
  return out;
}

// Flat roof adds its slab area to the total tile-covered area only if
// the config specifies a covering (e.g. water-proofing tiles). By
// default we DO include it — flat roofs typically get tile / water-
// proofing membrane which counts against the ceiling-tile budget.
export function flatTileContribution(cfg: HouseConfig): { areaSft: number } {
  let areaSft = 0;
  let flats;
  try {
    flats = deriveAllFlatRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch {
    return { areaSft: 0 };
  }
  for (const f of flats) {
    const w = f.config.width ?? f.geom.eave_x_east - f.geom.eave_x_west - 2 * f.geom.overhang;
    const l = f.config.length ?? f.geom.eave_y_south - f.geom.eave_y_north - 2 * f.geom.overhang;
    areaSft += (w * l) / 100;
  }
  return { areaSft };
}

// ---------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------
export function generateFlatPanels(cfg: HouseConfig): FlatPanelFile[] {
  const out: FlatPanelFile[] = [];
  let flats;
  try {
    flats = deriveAllFlatRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch (e) {
    console.warn("[flatPanels] derivation failed:", e);
    return out;
  }
  flats.forEach((f, idx) => {
    const suffix = flats.length > 1 ? ` ${idx + 1}` : "";
    out.push({
      id: `flat_top_${idx}`,
      title: `Flat roof${suffix} — top view`,
      filename: `roof_flat_top_${idx}.svg`,
      content: flatTopViewSvg(f.geom, f.config, `Flat roof${suffix} — top view (slab + parapet)`),
      width: CANVAS_W,
      height: CANVAS_H,
    });
    out.push({
      id: `flat_section_${idx}`,
      title: `Flat roof${suffix} — section`,
      filename: `roof_flat_section_${idx}.svg`,
      content: flatSectionSvg(f.geom, f.config, `Flat roof${suffix} — cross-section`),
      width: CANVAS_W,
      height: CANVAS_H,
    });
  });
  return out;
}
