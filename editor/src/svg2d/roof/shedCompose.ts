// Shed-roof detail panels + BOM contribution. Two panels per roof:
// top view (with rafter grid) and cross-section along the slope.

import type { HouseConfig } from "../expand";
import { deriveAllShedRoofs, type ShedRoofConfig, type ShedRoofGeom } from "./shedGeometry";
import { DEFAULT_GLOBAL_CONFIG } from "../config";
import { matSpec, type FrameMember } from "./htmlBom";

export interface ShedPanelFile {
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
const IN_TO_U = 10 / 12;
const RIDGE_COLOR = "#8B4513";
const EAVE_COLOR = "#666";
const RAFTER_COLOR = "#666";
const PURLIN_COLOR = "#a08a70";
const RING_COLOR = "#444";
const DIM_COLOR = "#0066cc";
const AXIS_COLOR = "#333";

function resolveFraming(cfg: ShedRoofConfig) {
  const g = DEFAULT_GLOBAL_CONFIG.roof_framing;
  const fr = (cfg.framing as Record<string, unknown> | undefined) ?? {};
  return {
    rafter_size_in: (fr.rafter_size_in as [number, number] | undefined) ?? g.rafter_size_in,
    rafter_wall_mm: (fr.rafter_wall_mm as number | undefined) ?? g.wall_thickness_mm?.rafter ?? 2,
    rafter_spacing_in: (fr.rafter_spacing_in as number | undefined) ?? g.rafter_spacing_in,
    purlin_size_in: (fr.purlin_size_in as [number, number] | undefined) ?? g.purlin_size_in,
    purlin_wall_mm: (fr.purlin_wall_mm as number | undefined) ?? g.wall_thickness_mm?.purlin ?? 1.5,
    purlin_spacing_in: (fr.purlin_spacing_in as number | undefined) ?? g.purlin_spacing_in,
    ridge_size_in: (fr.ridge_size_in as [number, number] | undefined) ?? g.ridge_size_in,
    ridge_wall_mm: (fr.ridge_wall_mm as number | undefined) ?? g.wall_thickness_mm?.ridge ?? 3,
    ring_beam_size_in: ((fr.ring_beam as { size_in?: [number, number] } | undefined)?.size_in) ?? g.ring_beam_size_in,
    ring_beam_wall_mm: (fr.ring_beam as { wall_mm?: number } | undefined)?.wall_mm ?? g.wall_thickness_mm?.ring_beam ?? 3,
  };
}

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

// Top view: rectangle + rafter lines (spanning the run direction) +
// purlin lines (perpendicular). High edge is marked.
function shedTopViewSvg(geom: ShedRoofGeom, cfg: ShedRoofConfig, title: string): string {
  const { eave_x_west: ex_w, eave_x_east: ex_e, eave_y_north: ey_n, eave_y_south: ey_s } = geom;
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

  let s = svgHeader(title);

  // Ring beam (wall rectangle, dashed)
  const rx = cfg.x ?? 0;
  const ry = cfg.y ?? 0;
  const rw = cfg.width ?? modelW - 2 * (geom.eave_x_east - geom.eave_x_west - modelW) / 2;
  const rl = cfg.length ?? modelL - 2 * (geom.eave_y_south - geom.eave_y_north - modelL) / 2;
  s += `<rect x="${px(rx)}" y="${py(ry)}" width="${rw * scale}" height="${rl * scale}" fill="none" stroke="${RING_COLOR}" stroke-width="1" stroke-dasharray="8 4"/>\n`;

  // Rafters + purlins: rafters run FROM low TO high edge. Depending
  // on slope_dir the "run" axis is X or Y.
  const rafterSpacingU = fr.rafter_spacing_in * IN_TO_U;
  const purlinSpacingU = fr.purlin_spacing_in * IN_TO_U;
  if (geom.slope_dir === "north" || geom.slope_dir === "south") {
    // Run is along Y; rafters are vertical lines at rafter-spacing along X.
    for (let x = ex_w + rafterSpacingU; x < ex_e; x += rafterSpacingU) {
      s += `<line x1="${px(x)}" y1="${py(ey_n)}" x2="${px(x)}" y2="${py(ey_s)}" stroke="${RAFTER_COLOR}" stroke-width="0.7" opacity="0.7"/>\n`;
    }
    for (let y = ey_n + purlinSpacingU; y < ey_s; y += purlinSpacingU) {
      s += `<line x1="${px(ex_w)}" y1="${py(y)}" x2="${px(ex_e)}" y2="${py(y)}" stroke="${PURLIN_COLOR}" stroke-width="0.9" opacity="0.8"/>\n`;
    }
    // Mark HIGH edge
    const highY = geom.slope_dir === "south" ? py(ey_n) : py(ey_s);
    s += `<line x1="${originX}" y1="${highY}" x2="${originX + drawW}" y2="${highY}" stroke="${RIDGE_COLOR}" stroke-width="2.4"/>\n`;
    s += `<text x="${originX + drawW - 4}" y="${highY - 4}" text-anchor="end" font-size="10" fill="${RIDGE_COLOR}">high edge</text>\n`;
  } else {
    for (let y = ey_n + rafterSpacingU; y < ey_s; y += rafterSpacingU) {
      s += `<line x1="${px(ex_w)}" y1="${py(y)}" x2="${px(ex_e)}" y2="${py(y)}" stroke="${RAFTER_COLOR}" stroke-width="0.7" opacity="0.7"/>\n`;
    }
    for (let x = ex_w + purlinSpacingU; x < ex_e; x += purlinSpacingU) {
      s += `<line x1="${px(x)}" y1="${py(ey_n)}" x2="${px(x)}" y2="${py(ey_s)}" stroke="${PURLIN_COLOR}" stroke-width="0.9" opacity="0.8"/>\n`;
    }
    const highX = geom.slope_dir === "east" ? px(ex_w) : px(ex_e);
    s += `<line x1="${highX}" y1="${originY}" x2="${highX}" y2="${originY + drawH}" stroke="${RIDGE_COLOR}" stroke-width="2.4"/>\n`;
    s += `<text x="${highX + 6}" y="${originY + drawH - 4}" font-size="10" fill="${RIDGE_COLOR}">high edge</text>\n`;
  }

  // Outer eave outline
  s += `<rect x="${px(ex_w)}" y="${py(ey_n)}" width="${drawW}" height="${drawH}" fill="none" stroke="${EAVE_COLOR}" stroke-width="1.5"/>\n`;

  // Dimensions
  const dimYbottom = py(ey_s) + 22;
  s += `<line x1="${px(ex_w)}" y1="${dimYbottom}" x2="${px(ex_e)}" y2="${dimYbottom}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${dimYbottom + 12}" text-anchor="middle" font-size="10" fill="${DIM_COLOR}">${fmtFtIn(modelW)} · ${n(modelW)} u</text>\n`;
  const dimXright = px(ex_e) + 22;
  s += `<line x1="${dimXright}" y1="${py(ey_n)}" x2="${dimXright}" y2="${py(ey_s)}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${dimXright + 6}" y="${(py(ey_n) + py(ey_s)) / 2}" font-size="10" fill="${DIM_COLOR}" dominant-baseline="middle">${fmtFtIn(modelL)} · ${n(modelL)} u</text>\n`;

  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${py(ey_n) - 6}" text-anchor="middle" font-size="10" fill="${AXIS_COLOR}">N</text>\n`;
  s += `<text x="${(px(ex_w) + px(ex_e)) / 2}" y="${py(ey_s) + 12}" text-anchor="middle" font-size="10" fill="${AXIS_COLOR}">S</text>\n`;
  s += `<text x="${px(ex_w) - 10}" y="${(py(ey_n) + py(ey_s)) / 2}" text-anchor="end" font-size="10" fill="${AXIS_COLOR}">W</text>\n`;
  s += `<text x="${px(ex_e) + 6}" y="${(py(ey_n) + py(ey_s)) / 2}" font-size="10" fill="${AXIS_COLOR}">E</text>\n`;

  const legendY = CANVAS_H - 28;
  s += `<text x="${MARGIN}" y="${legendY}" font-size="10" fill="${AXIS_COLOR}">Slope down toward ${geom.slope_dir} · Rise ${n(geom.rise)} u · Pitch ${geom.slope_angle.toFixed(1)}° · Rafters ${fr.rafter_size_in[0]}×${fr.rafter_size_in[1]}" @ ${fr.rafter_spacing_in}″ o.c. · Purlins @ ${fr.purlin_spacing_in}″ o.c.</text>\n`;
  s += `</svg>\n`;
  return s;
}

// Cross-section along the slope — right-triangle profile.
function shedSectionSvg(geom: ShedRoofGeom, cfg: ShedRoofConfig, title: string): string {
  const fr = resolveFraming(cfg);
  const run = geom.run;
  const rise = geom.rise;
  const availW = CANVAS_W - 2 * MARGIN;
  const availH = CANVAS_H - 2 * MARGIN - 40;
  const scale = Math.min(availW / run, availH / Math.max(rise + 20, 50));
  const drawW = run * scale;
  const drawH = rise * scale;
  const originX = (CANVAS_W - drawW) / 2;
  const originY = (CANVAS_H - drawH) / 2 + 10;
  const px = (r: number) => originX + r * scale;
  const py = (z: number) => originY + (rise - z) * scale;

  let s = svgHeader(title);
  // Slope surface (from low at r=0, z=0 up to high at r=run, z=rise)
  s += `<polygon points="${px(0)},${py(0)} ${px(run)},${py(rise)} ${px(run)},${py(0)}" fill="#f4dfd3" fill-opacity="0.4" stroke="${RIDGE_COLOR}" stroke-width="2"/>\n`;

  // Ridge beam at high edge
  const ridgeD = fr.ridge_size_in[1] * IN_TO_U;
  s += `<rect x="${px(run) - fr.ridge_size_in[0] * IN_TO_U * scale}" y="${py(rise)}" width="${fr.ridge_size_in[0] * IN_TO_U * scale}" height="${ridgeD * scale}" fill="${RIDGE_COLOR}"/>\n`;
  s += `<text x="${px(run) - fr.ridge_size_in[0] * IN_TO_U * scale - 4}" y="${py(rise) + 4}" text-anchor="end" font-size="10" fill="${RIDGE_COLOR}">high edge (ridge ${fr.ridge_size_in[0]}×${fr.ridge_size_in[1]}")</text>\n`;

  // Ring beam at low edge
  const ringD = fr.ring_beam_size_in[1] * IN_TO_U;
  s += `<rect x="${px(0)}" y="${py(0)}" width="${fr.ring_beam_size_in[0] * IN_TO_U * scale}" height="${ringD * scale}" fill="${RING_COLOR}" opacity="0.85"/>\n`;

  // Rafter cross-section at low + purlin dots up the slope
  const rfDpx = fr.rafter_size_in[1] * IN_TO_U * scale;
  const rfWpx = fr.rafter_size_in[0] * IN_TO_U * scale;
  s += `<rect x="${px(0)}" y="${py(0) - rfDpx}" width="${rfWpx}" height="${rfDpx}" fill="${RAFTER_COLOR}" opacity="0.9"/>\n`;
  s += `<text x="${px(0) + rfWpx + 4}" y="${py(0) - 4}" font-size="9" fill="${RAFTER_COLOR}">rafter ${fr.rafter_size_in[0]}×${fr.rafter_size_in[1]}"</text>\n`;

  // Purlins along the slope
  const slopeLen = Math.hypot(run, rise);
  const nPurl = Math.max(1, Math.floor(slopeLen / (fr.purlin_spacing_in * IN_TO_U)));
  const plWpx = fr.purlin_size_in[0] * IN_TO_U * scale;
  const plDpx = fr.purlin_size_in[1] * IN_TO_U * scale;
  for (let i = 1; i < nPurl; i++) {
    const t = i / nPurl;
    const rp = t * run;
    const zp = t * rise;
    s += `<rect x="${px(rp) - plWpx / 2}" y="${py(zp) - plDpx / 2}" width="${plWpx}" height="${plDpx}" fill="${PURLIN_COLOR}" opacity="0.9"/>\n`;
  }

  // Dimensions
  const dimYbot = py(0) + 22;
  s += `<line x1="${px(0)}" y1="${dimYbot}" x2="${px(run)}" y2="${dimYbot}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${(px(0) + px(run)) / 2}" y="${dimYbot + 12}" text-anchor="middle" font-size="10" fill="${DIM_COLOR}">Run ${fmtFtIn(run)} · ${n(run)} u</text>\n`;
  const dimXr = px(run) + 22;
  s += `<line x1="${dimXr}" y1="${py(0)}" x2="${dimXr}" y2="${py(rise)}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${dimXr + 6}" y="${(py(0) + py(rise)) / 2}" font-size="10" fill="${DIM_COLOR}" dominant-baseline="middle">Rise ${n(rise)} u</text>\n`;
  s += `<text x="${px(run / 2)}" y="${py(rise / 2)}" font-size="10" fill="${AXIS_COLOR}">pitch ≈ ${geom.slope_angle.toFixed(1)}°</text>\n`;

  s += `</svg>\n`;
  return s;
}

// ---------------------------------------------------------------
// BOM contribution
// ---------------------------------------------------------------
export function collectShedMembers(geom: ShedRoofGeom, cfg: ShedRoofConfig, roofIdx: number): FrameMember[] {
  const uToFt = (u: number) => u / 10.0;
  const fr = resolveFraming(cfg);
  const members: FrameMember[] = [];
  const rw = cfg.width ?? geom.eave_x_east - geom.eave_x_west;
  const rl = cfg.length ?? geom.eave_y_south - geom.eave_y_north;

  const slopeLen = Math.hypot(geom.run, geom.rise);
  const spanAcrossHighLow =
    geom.slope_dir === "north" || geom.slope_dir === "south" ? rw : rl;
  // Each rafter runs the FULL slope length.
  const rafterSpacingU = fr.rafter_spacing_in * IN_TO_U;
  const nRafters = Math.max(2, Math.floor(spanAcrossHighLow / rafterSpacingU) + 1);
  members.push({
    item: `Rafters (shed #${roofIdx + 1})`,
    matSpec: matSpec(fr.rafter_size_in, fr.rafter_wall_mm),
    extraNote: `${fr.rafter_spacing_in}″ o.c.`,
    count: nRafters,
    maxLenFt: uToFt(slopeLen),
    totalLenFt: uToFt(nRafters * slopeLen),
  });

  // Purlins parallel to eave — each spans the width along the eave
  // direction (perpendicular to rafters).
  const nPurl = Math.max(0, Math.floor(slopeLen / (fr.purlin_spacing_in * IN_TO_U)) - 1);
  const purlinLen = spanAcrossHighLow;
  members.push({
    item: `Purlins (shed #${roofIdx + 1})`,
    matSpec: matSpec(fr.purlin_size_in, fr.purlin_wall_mm),
    extraNote: `${fr.purlin_spacing_in}″ o.c.`,
    count: nPurl,
    maxLenFt: uToFt(purlinLen),
    totalLenFt: uToFt(nPurl * purlinLen),
  });

  // Ridge beam (at the high edge)
  const ridgeLen = spanAcrossHighLow;
  members.push({
    item: `Ridge/high beam (shed #${roofIdx + 1})`,
    matSpec: matSpec(fr.ridge_size_in, fr.ridge_wall_mm),
    extraNote: "top edge",
    count: 1,
    maxLenFt: uToFt(ridgeLen),
    totalLenFt: uToFt(ridgeLen),
  });

  // Ring beam perimeter
  members.push({
    item: `Ring beam (shed #${roofIdx + 1})`,
    matSpec: matSpec(fr.ring_beam_size_in, fr.ring_beam_wall_mm),
    extraNote: "perimeter loop",
    count: 4,
    maxLenFt: uToFt(Math.max(rw, rl)),
    totalLenFt: uToFt(2 * (rw + rl)),
  });

  return members;
}

export function collectAllShedMembers(cfg: HouseConfig): FrameMember[] {
  const out: FrameMember[] = [];
  let sheds;
  try {
    sheds = deriveAllShedRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch (e) {
    console.warn("[shedBom] derivation failed:", e);
    return out;
  }
  sheds.forEach((s, i) => out.push(...collectShedMembers(s.geom, s.config, i)));
  return out;
}

export function shedTileContribution(cfg: HouseConfig): { areaSft: number; ridgeRunFt: number } {
  let areaSft = 0;
  let ridgeRunFt = 0;
  let sheds;
  try {
    sheds = deriveAllShedRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch {
    return { areaSft: 0, ridgeRunFt: 0 };
  }
  for (const s of sheds) {
    const rw = s.config.width ?? s.geom.eave_x_east - s.geom.eave_x_west;
    const rl = s.config.length ?? s.geom.eave_y_south - s.geom.eave_y_north;
    const spanAcross = s.geom.slope_dir === "north" || s.geom.slope_dir === "south" ? rw : rl;
    const slopeLen = Math.hypot(s.geom.run, s.geom.rise);
    // One slope only.
    areaSft += (slopeLen * spanAcross) / 100;
    // Ridge run at the high edge only.
    ridgeRunFt += spanAcross / 10;
  }
  return { areaSft, ridgeRunFt };
}

// ---------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------
export function generateShedPanels(cfg: HouseConfig): ShedPanelFile[] {
  const out: ShedPanelFile[] = [];
  let sheds;
  try {
    sheds = deriveAllShedRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch (e) {
    console.warn("[shedPanels] derivation failed:", e);
    return out;
  }
  sheds.forEach((s, idx) => {
    const suffix = sheds.length > 1 ? ` ${idx + 1}` : "";
    out.push({
      id: `shed_top_${idx}`,
      title: `Shed roof${suffix} — top view`,
      filename: `roof_shed_top_${idx}.svg`,
      content: shedTopViewSvg(s.geom, s.config, `Shed roof${suffix} — framing plan (slope toward ${s.geom.slope_dir})`),
      width: CANVAS_W,
      height: CANVAS_H,
    });
    out.push({
      id: `shed_section_${idx}`,
      title: `Shed roof${suffix} — section`,
      filename: `roof_shed_section_${idx}.svg`,
      content: shedSectionSvg(s.geom, s.config, `Shed roof${suffix} — cross-section along slope`),
      width: CANVAS_W,
      height: CANVAS_H,
    });
  });
  return out;
}
