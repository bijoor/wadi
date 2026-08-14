// V2 eave cross-section detail — a dimensioned section through a typical eave,
// showing how the roof frame lands on the wall ring beam: wall, ring beam,
// rafter with its overhang, purlin, and the tile line above.
//
// Everything is derived from the RoofSpec (member sections, rafter pitch,
// overhang measured from the ring datum), so the detail tracks the model.
// Drawn in a local section frame: h runs horizontally (exterior on the LEFT,
// building interior on the RIGHT), z is height. Units are project units
// (10u = 1ft); labels use feet-inches.

import type { Point3D, RoofSpec, StraightMember } from "./model";
import { formatDimension } from "../../format";
import { dimLineH, dimLineV, escapeXml, panelFrame, sectionFtLabel } from "./panelDraw";

const lenPlan = (m: StraightMember): number =>
  Math.hypot(m.end[0] - m.start[0], m.end[1] - m.start[1]);
const rise = (m: StraightMember): number => Math.abs(m.end[2] - m.start[2]);

interface Bounds { minX: number; maxX: number; minY: number; maxY: number; }
function ringBounds(ring: StraightMember[]): Bounds | null {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const m of ring) for (const p of [m.start, m.end]) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  return isFinite(minX) ? { minX, maxX, minY, maxY } : null;
}

// Representative eave overhang: how far a rafter's low (eave) end projects
// beyond the ring beam datum edge, in plan. Uses the MEDIAN of the positive
// projections so a diagonal corner rafter (which sticks out furthest) doesn't
// overstate the typical cross-eave overhang.
function deriveOverhang(rafters: StraightMember[], b: Bounds | null): number {
  if (!b) return 0;
  const outs: number[] = [];
  for (const m of rafters) {
    const low: Point3D = m.start[2] <= m.end[2] ? m.start : m.end;
    const outside = Math.max(b.minX - low[0], low[0] - b.maxX, b.minY - low[1], low[1] - b.maxY);
    if (outside > 0.5) outs.push(outside);
  }
  if (!outs.length) return 0;
  outs.sort((p, q) => p - q);
  return outs[Math.floor(outs.length / 2)];
}

export function v2EavePanel(
  x0: number,
  y0: number,
  width: number,
  height: number,
  spec: RoofSpec,
): string {
  const titleH = 40;
  const title = "EAVE — Cross-section detail (typical)";
  let svg = panelFrame(x0, y0, width, height, titleH, title, "v2-eave");

  const ring = spec.members.filter((m) => m.role === "ring_beam");
  const rafters = spec.members.filter((m) => m.role === "rafter");
  const purlins = spec.members.filter((m) => m.role === "purlin");

  // --- Derive sizes (feet) then convert to project units for drawing. ---
  const FT = 10; // project units per foot
  const ringSec = (ring[0]?.section_size ?? [0.75, 0.75]) as [number, number];
  const rafterSec = (rafters[0]?.section_size ?? [0.17, 0.33]) as [number, number];
  const purlinSec = (purlins[0]?.section_size ?? [0.17, 0.25]) as [number, number];
  const wallT = ringSec[0] * FT;        // ring width ≈ wall thickness (datum)
  const ringD = ringSec[1] * FT;        // ring beam depth
  const rafterD = rafterSec[1] * FT;    // rafter depth (perpendicular band)

  // Pitch from a rafter (fallback to a truss top-chord, else 25°).
  let pitchDeg = 25;
  const pr = rafters.find((m) => lenPlan(m) > 1 && rise(m) > 0.1);
  if (pr) pitchDeg = (Math.atan2(rise(pr), lenPlan(pr)) * 180) / Math.PI;
  else if (spec.trusses[0]) {
    const t = spec.trusses[0];
    const run = Math.hypot(t.apex[0] - t.bottom_left[0], t.apex[1] - t.bottom_left[1]) || 1;
    pitchDeg = (Math.atan2(t.apex[2] - t.bottom_left[2], run) * 180) / Math.PI;
  }
  const th = (pitchDeg * Math.PI) / 180;
  const cos = Math.cos(th), sin = Math.sin(th), tan = Math.tan(th);

  const overhang = deriveOverhang(rafters, ringBounds(ring)) || 2 * FT;
  const wallH = Math.max(ringD * 2.4, 24);   // shown length of wall below
  // Zoom into the eave junction: overhang + ring + only a short rafter stub
  // inboard of the wall (fixed, so a large overhang doesn't shrink the detail).
  const interiorRun = wallT + Math.max(wallT * 1.2, 12);
  const battenGap = Math.max(rafterD * 0.35, 2);

  // --- Key points in local (h, z). Outer wall face at h=0; z=0 = ring top. ---
  // Rafter bottom edge passes through the outer top corner of the ring beam
  // (0, 0), sloping up to the right (interior). Tail droops out-left.
  const bottomAt = (h: number): [number, number] => [h, h * tan];
  const perpUp: [number, number] = [-sin, cos];        // normal, up-left of slope
  const top = (p: [number, number]): [number, number] => [p[0] + perpUp[0] * rafterD, p[1] + perpUp[1] * rafterD];

  const tailB = bottomAt(-overhang);
  const inB = bottomAt(interiorRun);
  const tailT = top(tailB);
  const inT = top(inB);
  // Tile line = rafter top edge lifted by battenGap, extended a touch past the tail.
  const tileOff: [number, number] = [perpUp[0] * battenGap, perpUp[1] * battenGap];
  const tileTail: [number, number] = [tailT[0] + tileOff[0] - cos * 2, tailT[1] + tileOff[1] - sin * 2];
  const tileIn: [number, number] = [inT[0] + tileOff[0], inT[1] + tileOff[1]];
  // Purlin square sitting on the rafter top, a bit inboard of the wall.
  const purlinD = purlinSec[1] * FT;
  const pAlong = wallT + Math.max(wallT * 0.5, 8);
  const pOnTop = top(bottomAt(pAlong));

  // --- Fit local geometry into the draw area. ---
  const pts: Array<[number, number]> = [
    [0, 0], [0, -ringD], [wallT, 0], [wallT, -ringD], [0, -wallH], [wallT, -wallH],
    tailB, inB, tailT, inT, tileTail, tileIn, pOnTop,
  ];
  let minH = Infinity, maxH = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [h, z] of pts) {
    if (h < minH) minH = h; if (h > maxH) maxH = h;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const padL = 60, padR = 70, padT = titleH + 26, padB = 54;
  const drawW = width - padL - padR, drawH = height - padT - padB;
  const spanH = maxH - minH || 1, spanZ = maxZ - minZ || 1;
  const scale = Math.min(drawW / spanH, drawH / spanZ);
  const offX = x0 + padL + (drawW - spanH * scale) / 2 - minH * scale;
  const offY = y0 + padT + (drawH - spanZ * scale) / 2 + maxZ * scale;
  const S = (p: [number, number]): [number, number] => [offX + p[0] * scale, offY - p[1] * scale];

  const poly = (ps: Array<[number, number]>, fill: string, stroke: string, w: number) =>
    `<polygon points="${ps.map((p) => { const q = S(p); return `${q[0].toFixed(1)},${q[1].toFixed(1)}`; }).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>\n`;
  const seg = (a: [number, number], b: [number, number], stroke: string, w: number, dash?: string) => {
    const p = S(a), q = S(b);
    return `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-linecap="round"/>\n`;
  };
  const label = (p: [number, number], text: string, anchor = "start", fill = "#334155") => {
    const q = S(p);
    return `<text x="${q[0].toFixed(1)}" y="${q[1].toFixed(1)}" text-anchor="${anchor}" font-size="10" fill="${fill}">${escapeXml(text)}</text>\n`;
  };

  // --- Wall below (hatched block) ---
  svg += poly([[0, 0], [wallT, 0], [wallT, -wallH], [0, -wallH]], "#efe7db", "#8a6a3f", 1);
  for (let hh = 1; hh < 6; hh++) {
    const zc = -wallH * (hh / 6);
    svg += seg([0, zc], [wallT, zc], "#d9c9ad", 0.5);
  }
  // --- Ring beam (the ring on the wall) ---
  svg += poly([[0, 0], [wallT, 0], [wallT, -ringD], [0, -ringD]], "#dcfce7", "#16a34a", 1.6);
  // --- Level datum at ring top ---
  svg += seg([Math.min(minH, -overhang), 0], [maxH, 0], "#94a3b8", 0.6, "5 3");

  // --- Rafter band ---
  svg += poly([tailB, inB, inT, tailT], "#e2e8f0", "#475569", 1.4);
  // --- Fascia at the tail (plumb) ---
  svg += seg(tailB, [tailB[0], tailB[1] - rafterD * 1.1], "#475569", 1.4);
  // --- Purlin square on the rafter top ---
  const pHalf = purlinD / 2;
  svg += poly([
    [pOnTop[0] - pHalf * cos, pOnTop[1] - pHalf * sin],
    [pOnTop[0] + pHalf * cos, pOnTop[1] + pHalf * sin],
    [pOnTop[0] + pHalf * cos - perpUp[0] * purlinD, pOnTop[1] + pHalf * sin - perpUp[1] * purlinD],
    [pOnTop[0] - pHalf * cos - perpUp[0] * purlinD, pOnTop[1] - pHalf * sin - perpUp[1] * purlinD],
  ], "#64748b", "#334155", 0.8);
  // --- Tile line ---
  svg += seg(tileTail, tileIn, "#b45309", 2);

  // --- Callout labels ---
  svg += label([wallT / 2, -wallH * 0.62], "WALL", "middle", "#8a6a3f");
  svg += label([wallT + 2, -ringD / 2], `RING BEAM ${sectionFtLabel(ringSec)}`, "start", "#16a34a");
  svg += label(inT, "RAFTER", "start", "#475569");
  svg += label([pOnTop[0], pOnTop[1] + 1], "PURLIN", "middle", "#334155");
  svg += label(tileIn, "TILE", "start", "#b45309");

  // --- Dimensions ---
  // Overhang (horizontal, below the tail).
  const dimY = S([0, minZ])[1] + 22;
  svg += dimLineH(S(tailB)[0], S([0, 0])[0], dimY, `overhang ${formatDimension(overhang)}`);
  svg += seg(tailB, [tailB[0], minZ - overhang * 0.02], "#94a3b8", 0.4, "2 2");
  // Wall thickness (horizontal, lower).
  svg += dimLineH(S([0, -wallH])[0], S([wallT, -wallH])[0], S([0, -wallH])[1] + 16, `wall ${formatDimension(wallT)}`);
  // Ring beam depth (vertical, right of the beam).
  svg += dimLineV(S([wallT, 0])[1], S([wallT, -ringD])[1], S([wallT, 0])[0] + 30, `${formatDimension(ringD)}`);
  // Pitch angle arc near the ring top corner.
  const o = S([0, 0]);
  const r = 26;
  const ax = o[0] + r, ay = o[1];
  const bx = o[0] + r * cos, by = o[1] - r * sin;
  svg += `<path d="M ${ax.toFixed(1)} ${ay.toFixed(1)} A ${r} ${r} 0 0 0 ${bx.toFixed(1)} ${by.toFixed(1)}" fill="none" stroke="#8B4513" stroke-width="1"/>\n`;
  svg += `<text x="${(o[0] + r + 4).toFixed(1)}" y="${(o[1] - 6).toFixed(1)}" text-anchor="start" font-size="11" font-weight="600" fill="#8B4513">${pitchDeg.toFixed(1)}°</text>\n`;

  // --- Footer note ---
  const footY = y0 + height - 12;
  svg += `<text x="${(x0 + 12).toFixed(1)}" y="${footY.toFixed(1)}" text-anchor="start" font-size="9" fill="#475569">rafter ${sectionFtLabel(rafterSec)} · purlin ${sectionFtLabel(purlinSec)} · sizes + pitch from model</text>\n`;

  svg += `</g>\n`;
  return svg;
}
