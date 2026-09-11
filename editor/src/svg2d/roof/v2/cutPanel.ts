// Fabrication cut panels for the Roof Details sheet.
//
// renderCutPanel draws ONE end cut into a tile: the compound angles, an
// isometric of the finished end (dashed hidden edges, A/B/C/D corner badges,
// long "toe"), and a wrap-around template whose corner badges match the
// isometric. renderCutKeyPlan draws the top-view key plan that maps each
// coloured/numbered group of rafters to its cut panel.

import type { RoofSpec, Point3D } from "./model";
import type { RafterCut, HipCut } from "./cutGeometry";
import { formatDimension } from "../../format";

const f1 = (n: number) => Number(n).toFixed(1);
const CORNMAP: Record<string, string> = { A: "up/−", B: "up/+", C: "dn/+", D: "dn/−" };

function badge(x: number, y: number, letter: string, color = "#334155"): string {
  return `<circle cx="${f1(x)}" cy="${f1(y)}" r="8" fill="#ffffff" stroke="${color}" stroke-width="1.7"/>`
    + `<text x="${f1(x)}" y="${f1(y + 3.6)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${color}">${letter}</text>`;
}

// Isometric of the finished end. `sec` = [w,d] inches (on edge: larger vertical).
function isoCut(ox: number, oy: number, rel: Record<string, number>, sec: [number, number], scale: number): string {
  const V = Math.max(sec[0], sec[1]) / 2, Hh = Math.min(sec[0], sec[1]) / 2;
  const L = Math.max(rel.A, rel.B, rel.C, rel.D) + 3;
  const eA = [1.0, -0.34], eU = [0, -1], eW = [0.52, 0.44];
  const P = (a: number, u: number, w: number): [number, number] =>
    [ox + (a * eA[0] + u * eU[0] + w * eW[0]) * scale, oy + (a * eA[1] + u * eU[1] + w * eW[1]) * scale];
  const cor: Record<string, [number, number]> = { A: [+V, -Hh], B: [+V, +Hh], C: [-V, +Hh], D: [-V, -Hh] };
  const cut: Record<string, [number, number]> = {}, back: Record<string, [number, number]> = {};
  for (const k of ["A", "B", "C", "D"]) { const [u, w] = cor[k]; cut[k] = P(-rel[k], u, w); back[k] = P(-L, u, w); }
  const poly = (ps: [number, number][], fill: string) =>
    `<polygon points="${ps.map((p) => `${f1(p[0])},${f1(p[1])}`).join(" ")}" fill="${fill}" stroke="none"/>`;
  const line = (p: [number, number], q: [number, number], dash?: boolean) =>
    `<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="#3a4654" stroke-width="1.2"${dash ? ' stroke-dasharray="4 3"' : ""}/>`;
  let s = "";
  s += poly([cut.A, cut.B, back.B, back.A], "#e9eef3");
  s += poly([cut.B, cut.C, back.C, back.B], "#d5dce4");
  s += poly([cut.A, cut.B, cut.C, cut.D], "#f7cccc");
  for (const [p, q] of [[back.C, back.D], [back.D, back.A], [cut.D, back.D]] as [number, number][][]) s += line(p, q, true);
  const solid: [number, number][][] = [[cut.A, cut.B], [cut.B, cut.C], [cut.C, cut.D], [cut.D, cut.A],
    [back.A, back.B], [back.B, back.C], [cut.A, back.A], [cut.B, back.B], [cut.C, back.C]];
  for (const [p, q] of solid) s += line(p, q, false);
  s += `<polygon points="${["A", "B", "C", "D"].map((k) => `${f1(cut[k][0])},${f1(cut[k][1])}`).join(" ")}" fill="none" stroke="#b91c1c" stroke-width="2"/>`;
  const toeK = ["A", "B", "C", "D"].reduce((m, k) => (rel[k] < rel[m] ? k : m), "A");
  s += `<text x="${f1(cut[toeK][0])}" y="${f1(cut[toeK][1] - 13)}" text-anchor="middle" font-size="10" fill="#0f766e" font-weight="700">toe</text>`;
  for (const k of ["A", "B", "C", "D"]) s += badge(cut[k][0], cut[k][1], k, "#b91c1c");
  return s;
}

export interface CutPanelOpts { index?: number; headerColor?: string; sub?: string; countNote?: string; }

export function renderCutPanel(
  x0: number, y0: number, w: number, h: number,
  cut: HipCut, sec: [number, number], opts: CutPanelOpts = {},
): string {
  const color = opts.headerColor ?? "#0f766e";
  const rel = cut.rel;
  let s = `<g transform="translate(${x0},${y0})">`;
  s += `<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" stroke="#94a3b8" stroke-width="1.3" rx="6"/>`;
  s += `<rect x="0" y="0" width="${w}" height="34" fill="${color}" rx="6"/>`;
  s += `<text x="16" y="23" font-size="16" font-weight="700" fill="#fff">${opts.index != null ? `${opts.index}. ` : ""}${cut.label}</text>`;
  if (opts.sub) s += `<text x="16" y="58" font-size="12" fill="#555">${opts.sub}</text>`;
  s += `<text x="16" y="84" font-size="17" font-weight="700" fill="${color}">BEVEL ${cut.bevel.toFixed(1)}°</text>`;
  s += `<text x="180" y="84" font-size="17" font-weight="700" fill="${color}">MITRE ${cut.mitre.toFixed(1)}°</text>`;
  s += `<text x="16" y="104" font-size="11.5" fill="#666">bevel = plumb cut (= face slope) · mitre = side/cheek cut${opts.countNote ? ` · ${opts.countNote}` : ""}</text>`;
  if (cut.overshootIn != null && cut.topCorner) {
    s += `<text x="16" y="124" font-size="11.5" fill="#b45309" font-weight="700">Assembly: align the hip's BOTTOM edge with the ridge bottom (clean line). Corner ${cut.topCorner} then sits ${cut.overshootIn.toFixed(2)}" proud of the ridge top (cut face ${cut.faceHeightIn?.toFixed(1)}" tall vs 6" section).</text>`;
  }

  // Isometric on the right third (vertically centred, hidden edges dashed).
  s += `<text x="${w - 275}" y="${h - 330}" font-size="12" font-weight="700" fill="#334">Isometric of the cut end</text>`;
  s += isoCut(w - 265, h - 215, rel, sec, 28);

  // Wrap template on the left ~two thirds.
  const isTall = sec[0] >= sec[1] ? sec[0] : sec[1]; // vertical inches
  const isWide = sec[0] >= sec[1] ? sec[1] : sec[0]; // horizontal inches
  const faces: [string, number][] = [["Top", isWide], ["Side +", isTall], ["Bottom", isWide], ["Side −", isTall]];
  const perim = isWide * 2 + isTall * 2;
  const seq = ["A", "B", "C", "D", "A2"];
  const off: Record<string, number> = { A: rel.A, B: rel.B, C: rel.C, D: rel.D, A2: rel.A };
  const wrapW = w - 360;
  const sx = (wrapW - 60) / perim;
  const x0w = 60; const wy = 150;
  const maxOff = Math.max(rel.A, rel.B, rel.C, rel.D);
  const osc = Math.min(26, 150 / Math.max(maxOff, 0.1));
  const yb = wy + 62;
  s += `<text x="16" y="${wy}" font-size="13" font-weight="700" fill="#111">Wrap template</text>`;
  s += `<text x="16" y="${wy + 18}" font-size="11" fill="#666">Square a line around the tube at the long toe (0"). Mark each corner back by its distance, join, cut.</text>`;
  let cx = x0w; const ex: Record<string, number> = { A: cx };
  faces.forEach(([nm, wd], i) => {
    const nx = cx + wd * sx; ex[seq[i + 1]] = nx;
    s += `<line x1="${f1(cx)}" y1="${f1(yb - 10)}" x2="${f1(cx)}" y2="${f1(yb + maxOff * osc + 16)}" stroke="#e2e8f0"/>`;
    const lx = (cx + nx) / 2; const lc = `x="${f1(lx)}" y="${f1(yb - 14)}" text-anchor="middle" font-size="9.5"`;
    s += `<text ${lc} fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round">${nm} ${wd}"</text><text ${lc} fill="#64748b">${nm} ${wd}"</text>`;
    cx = nx;
  });
  s += `<line x1="${f1(cx)}" y1="${f1(yb - 10)}" x2="${f1(cx)}" y2="${f1(yb + maxOff * osc + 16)}" stroke="#e2e8f0"/>`;
  s += `<line x1="${f1(x0w)}" y1="${f1(yb)}" x2="${f1(cx)}" y2="${f1(yb)}" stroke="#334" stroke-width="1" stroke-dasharray="3 2"/>`;
  s += `<text x="${f1(cx + 4)}" y="${f1(yb + 3)}" font-size="9" fill="#334">0"</text>`;
  const pts = seq.map((k) => [ex[k], yb + off[k] * osc] as [number, number]);
  s += `<polyline points="${pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(" ")}" fill="none" stroke="#b91c1c" stroke-width="2.4"/>`;
  const upC: Record<string, boolean> = { A: true, B: true, C: false, D: false };
  seq.slice(0, 4).forEach((k, i) => {
    const p = pts[i]; const dy = upC[k] ? -16 : 25;
    const lc = `x="${f1(p[0])}" y="${f1(p[1] + dy)}" text-anchor="middle" font-size="11.5" font-weight="700"`;
    s += `<text ${lc} fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round">${off[k].toFixed(2)}"</text><text ${lc} fill="#b91c1c">${off[k].toFixed(2)}"</text>`;
    s += badge(p[0], p[1], k, "#b91c1c");
  });
  seq.forEach((k) => { const kk = k === "A2" ? "A" : k; s += `<text x="${f1(ex[k])}" y="${f1(yb + maxOff * osc + 32)}" text-anchor="middle" font-size="8.5" fill="#94a3b8">${kk} · ${CORNMAP[kk]}</text>`; });
  s += "</g>";
  return s;
}

// Top-view key plan: rafters coloured + numbered by cut group, ridge/hip drawn,
// plus a compact index. groupOfRafterId maps a rafter member id → group index.
export function renderCutKeyPlan(
  x0: number, y0: number, w: number, h: number,
  spec: RoofSpec, cuts: RafterCut[], groupOfRafterId: Map<string, number>,
): string {
  let s = `<g transform="translate(${x0},${y0})">`;
  s += `<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff" stroke="#94a3b8" stroke-width="1.3" rx="6"/>`;
  s += `<rect x="0" y="0" width="${w}" height="34" fill="#334155" rx="6"/>`;
  s += `<text x="16" y="23" font-size="16" font-weight="700" fill="#fff">Rafter cuts — key plan (which cut for which rafters)</text>`;

  // plan area (left) + index (right)
  const planW = Math.round(w * 0.6), planX = 14, planY = 48, planH = h - 70;
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const p of spec.planes) { if (!(p.role === "slope" || p.role === "hip_face")) continue; for (const v of p.vertices) { xmin = Math.min(xmin, v[0]); xmax = Math.max(xmax, v[0]); ymin = Math.min(ymin, v[1]); ymax = Math.max(ymax, v[1]); } }
  if (!Number.isFinite(xmin)) { s += "</g>"; return s; }
  const wX = xmax - xmin || 1, wY = ymax - ymin || 1;
  // draw with the longer footprint axis horizontal
  const flip = wY >= wX;
  const spanH = flip ? wY : wX, spanV = flip ? wX : wY;
  const sc = Math.min((planW - 40) / spanH, (planH - 40) / spanV);
  const P = (x: number, y: number): [number, number] => flip
    ? [planX + 20 + (y - ymin) * sc, planY + 20 + (x - xmin) * sc]
    : [planX + 20 + (x - xmin) * sc, planY + 20 + (y - ymin) * sc];
  s += `<rect x="${planX}" y="${planY}" width="${planW}" height="${planH}" fill="#f8fafc" stroke="#cbd5e1" rx="4"/>`;
  for (const p of spec.planes) { if (!(p.role === "slope" || p.role === "hip_face")) continue; const pts = p.vertices.map((v) => P(v[0], v[1])); s += `<polygon points="${pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join(" ")}" fill="#eef2f6" stroke="#cbd5e1" stroke-width="0.6"/>`; }
  const gpts: Record<number, [number, number][]> = {};
  for (const r of spec.members) {
    if (r.role !== "rafter") continue;
    const g = groupOfRafterId.get(r.id); if (g == null) continue;
    const a = P(r.start[0], r.start[1]), b = P(r.end[0], r.end[1]);
    s += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${cuts[g]?.color ?? "#94a3b8"}" stroke-width="1.6"/>`;
    (gpts[g] = gpts[g] || []).push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  const ridge = spec.members.find((m) => m.role === "ridge");
  if (ridge) { const a = P(ridge.start[0], ridge.start[1]), b = P(ridge.end[0], ridge.end[1]); s += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="#111" stroke-width="3"/>`; }
  for (const hp of spec.members.filter((m) => m.role === "hip")) { const a = P(hp.start[0], hp.start[1]), b = P(hp.end[0], hp.end[1]); s += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="#475569" stroke-width="2" stroke-dasharray="6 3"/>`; }
  for (const gk of Object.keys(gpts)) { const g = Number(gk); const arr = gpts[g].slice().sort((p, q) => p[0] - q[0]); const cc = arr[Math.floor(arr.length / 2)]; s += `<circle cx="${f1(cc[0])}" cy="${f1(cc[1])}" r="13" fill="${cuts[g]?.color ?? "#94a3b8"}" stroke="#fff" stroke-width="2.2"/><text x="${f1(cc[0])}" y="${f1(cc[1] + 4.8)}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${g + 1}</text>`; }
  s += `<text x="${planX + planW / 2}" y="${planY + planH - 8}" text-anchor="middle" font-size="10" fill="#64748b">black = central ridge · dashed = hip (corner) ridges · numbers = cut panel</text>`;

  // index
  const ix = planX + planW + 18, iy = planY + 6;
  s += `<text x="${ix}" y="${iy + 12}" font-size="13" font-weight="700" fill="#111">Cut index</text>`;
  cuts.forEach((c, i) => { const yy = iy + 34 + i * 46; s += `<rect x="${ix}" y="${yy}" width="22" height="22" fill="${c.color}" rx="3"/>`; s += `<text x="${ix + 32}" y="${yy + 11}" font-size="12.5" font-weight="700" fill="#111">${i + 1}. ${c.label}</text>`; s += `<text x="${ix + 32}" y="${yy + 27}" font-size="11" fill="#555">bevel ${c.bevel.toFixed(1)}° · mitre ${c.mitre.toFixed(1)}° · ×${c.count}</text>`; });
  s += "</g>";
  return s;
}

// (imported to keep a stable dep on the length formatter for future use)
void formatDimension;
export type { Point3D };
