// V2 eave cross-section detail — a dimensioned section through ONE eave,
// showing how the roof frame lands on the wall: masonry wall, steel ring beam,
// rafter with its overhang, purlin, and the tile line above.
//
// Member SECTIONS come from the roof's `framing` config carried on the spec
// (spec.framing) — the SAME sizes the materials take-off / BOM uses — so the
// detail is consistent with the rest of the drawings, not per-member guesses.
//
// A hip roof's eaves are NOT identical: the main slopes and the two hip ends
// have different pitches and overhangs, so `groupEaves` returns one entry per
// DISTINCT eave and the sheet draws a detail for each.
//
// Drawn in a local section frame: h runs horizontally (exterior on the LEFT,
// building interior on the RIGHT), z is height. Units are project units
// (10u = 1ft); linear dims use feet-inches, sections use inches.

import type { Point3D, RoofPlane, RoofSpec } from "./model";
import { formatDimension } from "../../format";
import { dimLineH, escapeXml, panelFrame } from "./panelDraw";

const IN_TO_U = 10 / 12; // project units per inch (10u = 1ft)
const sub = (a: Point3D, b: Point3D): Point3D => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point3D, b: Point3D): Point3D =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Point3D): number => Math.hypot(a[0], a[1], a[2]);
const secInLabel = (s: [number, number]): string =>
  `${Math.round(s[0] * 10) / 10}"×${Math.round(s[1] * 10) / 10}"`;

// Angle (deg) between a plane and horizontal, from its unit normal.
function planePitch(vs: Point3D[]): number {
  if (vs.length < 3) return 0;
  // Use the widest-spread triple to avoid a degenerate normal.
  const n = cross(sub(vs[1], vs[0]), sub(vs[2], vs[0]));
  const nl = norm(n) || 1;
  const nz = Math.abs(n[2] / nl);
  return (Math.acos(Math.min(1, nz)) * 180) / Math.PI;
}

// Midpoint of a plane's lowest (eave) edge.
function lowEdgeMid(vs: Point3D[]): Point3D | null {
  const minZ = Math.min(...vs.map((v) => v[2]));
  const low = vs.filter((v) => Math.abs(v[2] - minZ) < 1);
  if (low.length < 2) return null;
  return [(low[0][0] + low[1][0]) / 2, (low[0][1] + low[1][1]) / 2, minZ];
}

export interface EaveGroup {
  signature: string;
  roleLabel: string; // "Main slope" | "Hip end" | "Eave"
  pitchDeg: number;
  overhang: number; // project units
  count: number;
  sides: string[]; // compass hints, e.g. ["W", "E"]
}

// One entry per DISTINCT eave (role + pitch + overhang), so the sheet shows a
// detail for the main slopes and for each hip end.
export function groupEaves(spec: RoofSpec): EaveGroup[] {
  const eaves = spec.members.filter((m) => m.role === "pani_patti");
  if (!eaves.length) return [];

  // Wall OUTER face = ring beam (on the wall centreline) grown by half the wall
  // thickness. Overhang is the rafter projection beyond the WALL FACE, so we
  // measure to this, not to the ring centreline.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const m of spec.members) if (m.role === "ring_beam") for (const p of [m.start, m.end]) {
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
  }
  if (!isFinite(minX)) return [];
  const halfWall = (spec.framing?.wall_thickness_u ?? 0) / 2;
  minX -= halfWall; maxX += halfWall; minY -= halfWall; maxY += halfWall;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  const facePlanes = spec.planes.filter((p) => p.role === "slope" || p.role === "hip_face");
  const faceInfo = facePlanes
    .map((p) => ({ role: p.role, pitch: planePitch(p.vertices), mid: lowEdgeMid(p.vertices) }))
    .filter((f): f is { role: RoofPlane["role"]; pitch: number; mid: Point3D } => f.mid != null);

  const groups = new Map<string, EaveGroup>();
  for (const e of eaves) {
    const emid: Point3D = [(e.start[0] + e.end[0]) / 2, (e.start[1] + e.end[1]) / 2, (e.start[2] + e.end[2]) / 2];
    // Overhang: axis-aligned distance from the eave to the parallel ring edge.
    const vertical = Math.abs(e.start[0] - e.end[0]) < 1; // constant X → runs along Y
    let overhang: number, side: string;
    if (vertical) {
      const X = e.start[0]; const wallX = X > cx ? maxX : minX;
      overhang = Math.abs(X - wallX); side = X > cx ? "E" : "W";
    } else {
      const Y = e.start[1]; const wallY = Y > cy ? maxY : minY;
      overhang = Math.abs(Y - wallY); side = Y > cy ? "S" : "N";
    }
    // Nearest face plane by low-edge midpoint → its role + pitch.
    let best: { role: RoofPlane["role"]; pitch: number } | null = null;
    let bestD = Infinity;
    for (const f of faceInfo) {
      const d = Math.hypot(f.mid[0] - emid[0], f.mid[1] - emid[1]);
      if (d < bestD) { bestD = d; best = { role: f.role, pitch: f.pitch }; }
    }
    const roleLabel = best?.role === "hip_face" ? "Hip end" : best?.role === "slope" ? "Main slope" : "Eave";
    const pitchDeg = best?.pitch ?? 0;
    const sig = `${roleLabel}|${Math.round(pitchDeg)}|${Math.round(overhang)}`;
    const existing = groups.get(sig);
    if (existing) { existing.count += 1; if (!existing.sides.includes(side)) existing.sides.push(side); }
    else groups.set(sig, { signature: sig, roleLabel, pitchDeg, overhang, count: 1, sides: [side] });
  }
  // Main slopes first, then hip ends; larger overhang first within a role.
  return [...groups.values()].sort((a, b) =>
    (a.roleLabel === b.roleLabel ? b.overhang - a.overhang : a.roleLabel < b.roleLabel ? -1 : 1));
}

export function v2EavePanel(
  x0: number,
  y0: number,
  width: number,
  height: number,
  spec: RoofSpec,
  group: EaveGroup,
): string {
  const titleH = 40;
  const sidesStr = group.sides.length ? ` (${group.sides.join(", ")})` : "";
  const title = `EAVE — ${group.roleLabel}${group.count > 1 ? ` × ${group.count}` : ""}${sidesStr}`;
  let svg = panelFrame(x0, y0, width, height, titleH, title, "v2-eave");

  // --- Sections from the framing config (inches → project units). ---
  const ringIn = (spec.framing?.ring_beam_size_in ?? [4, 2]) as [number, number];
  const rafterIn = (spec.framing?.rafter_size_in ?? [2, 4]) as [number, number];
  const purlinIn = (spec.framing?.purlin_size_in ?? [2, 1]) as [number, number];
  const ringW = ringIn[0] * IN_TO_U;     // ring beam width (along the section)
  const ringD = ringIn[1] * IN_TO_U;     // ring beam depth (height)
  const rafterD = rafterIn[1] * IN_TO_U; // rafter depth (perpendicular band)
  const purlinD = purlinIn[1] * IN_TO_U;
  const wallT = spec.framing?.wall_thickness_u ?? 7.5; // masonry wall thickness
  const ringH0 = Math.max(0, (wallT - ringW) / 2);     // ring beam centred on the wall

  const pitchDeg = group.pitchDeg || 25;
  const th = (pitchDeg * Math.PI) / 180;
  const cos = Math.cos(th), sin = Math.sin(th), tan = Math.tan(th);
  const overhang = group.overhang || 2 * 10;
  const wallH = Math.max(ringD * 4, 20);                 // shown wall stub below
  const interiorRun = wallT + Math.max(wallT * 1.2, 12); // rafter stub inboard
  const battenGap = Math.max(rafterD * 0.35, 2);

  // --- Key points in local (h, z): outer wall face at h=0; z=0 = wall top =
  // ring-beam underside. The ring beam sits ON the wall (z: 0 → +ringD) and the
  // steel rafter is welded onto the ring's outer-top corner, sloping up inboard —
  // the frame is carried by the ring, NOT resting on the masonry. ---
  const bottomAt = (h: number): [number, number] => [h, ringD + (h - ringH0) * tan];
  const perpUp: [number, number] = [-sin, cos];
  const top = (p: [number, number]): [number, number] => [p[0] + perpUp[0] * rafterD, p[1] + perpUp[1] * rafterD];
  const tailB = bottomAt(-overhang);
  const inB = bottomAt(interiorRun);
  const tailT = top(tailB), inT = top(inB);
  const tileOff: [number, number] = [perpUp[0] * battenGap, perpUp[1] * battenGap];
  const tileTail: [number, number] = [tailT[0] + tileOff[0] - cos * 2, tailT[1] + tileOff[1] - sin * 2];
  const tileIn: [number, number] = [inT[0] + tileOff[0], inT[1] + tileOff[1]];
  const pAlong = wallT + Math.max(wallT * 0.5, 8);
  const pOnTop = top(bottomAt(pAlong));

  // --- Fit local geometry into the draw area. ---
  const pts: Array<[number, number]> = [
    [0, 0], [wallT, 0], [0, -wallH], [wallT, -wallH],
    [ringH0, 0], [ringH0 + ringW, 0], [ringH0, ringD], [ringH0 + ringW, ringD],
    tailB, inB, tailT, inT, tileTail, tileIn, pOnTop,
  ];
  let minH = Infinity, maxH = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [h, z] of pts) {
    if (h < minH) minH = h; if (h > maxH) maxH = h;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const padL = 60, padR = 74, padT = titleH + 26, padB = 54;
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

  // --- Wall (hatched masonry block) ---
  svg += poly([[0, 0], [wallT, 0], [wallT, -wallH], [0, -wallH]], "#efe7db", "#8a6a3f", 1);
  for (let hh = 1; hh < 6; hh++) {
    const zc = -wallH * (hh / 6);
    svg += seg([0, zc], [wallT, zc], "#d9c9ad", 0.5);
  }
  // --- Ring beam (steel), sitting ON TOP of the wall, centred on it (z: 0→ringD) ---
  svg += poly([[ringH0, 0], [ringH0 + ringW, 0], [ringH0 + ringW, ringD], [ringH0, ringD]], "#dcfce7", "#16a34a", 1.6);
  // --- Wall-top datum (ring-beam seating level) ---
  svg += seg([Math.min(minH, -overhang), 0], [maxH, 0], "#94a3b8", 0.6, "5 3");

  // --- Rafter band ---
  svg += poly([tailB, inB, inT, tailT], "#e2e8f0", "#475569", 1.4);
  // --- Fascia at the tail ---
  svg += seg(tailB, [tailB[0], tailB[1] - rafterD * 1.1], "#475569", 1.4);
  // --- Purlin on the rafter top ---
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
  svg += label([wallT / 2, -wallH * 0.66], "WALL", "middle", "#8a6a3f");
  svg += label([ringH0 + ringW + 1.5, ringD / 2], `RING BEAM ${secInLabel(ringIn)}`, "start", "#16a34a");
  svg += label(inT, "RAFTER", "start", "#475569");
  svg += label([pOnTop[0], pOnTop[1] + 1], "PURLIN", "middle", "#334155");
  svg += label(tileIn, "TILE", "start", "#b45309");

  // --- Dimensions ---
  const dimY = S([0, minZ])[1] + 22;
  svg += dimLineH(S(tailB)[0], S([0, 0])[0], dimY, `overhang ${formatDimension(overhang)}`);
  svg += seg(tailB, [tailB[0], minZ - overhang * 0.02], "#94a3b8", 0.4, "2 2");
  svg += dimLineH(S([0, -wallH])[0], S([wallT, -wallH])[0], S([0, -wallH])[1] + 16, `wall ${formatDimension(wallT)}`);
  // Pitch arc at the rafter's bearing point on the ring's outer-top corner.
  const o = S([ringH0, ringD]);
  const r = 26;
  svg += `<path d="M ${(o[0] + r).toFixed(1)} ${o[1].toFixed(1)} A ${r} ${r} 0 0 0 ${(o[0] + r * cos).toFixed(1)} ${(o[1] - r * sin).toFixed(1)}" fill="none" stroke="#8B4513" stroke-width="1"/>\n`;
  svg += `<text x="${(o[0] + r + 4).toFixed(1)}" y="${(o[1] - 6).toFixed(1)}" text-anchor="start" font-size="11" font-weight="600" fill="#8B4513">${pitchDeg.toFixed(1)}°</text>\n`;

  // --- Footer ---
  const footY = y0 + height - 12;
  svg += `<text x="${(x0 + 12).toFixed(1)}" y="${footY.toFixed(1)}" text-anchor="start" font-size="9" fill="#475569">rafter ${secInLabel(rafterIn)} · purlin ${secInLabel(purlinIn)} · sizes from the roof framing</text>\n`;

  svg += `</g>\n`;
  return svg;
}
