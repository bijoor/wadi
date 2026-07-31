// V2 face-diagram panel — draws one panel per UNIQUE face shape in a
// RoofSpec. Identical faces (same dimensions) are grouped so a
// symmetric hip roof shows two diagrams (main slope + hip end) instead
// of four.
//
// Each panel shows:
//   - Face outline (trapezoid for slopes, triangle for hip_faces,
//     arbitrary polygon after joint trim / outside-corner extension).
//   - Rafters + purlins that live on this face (from the RoofSpec's
//     `source_plane_id`-tagged members).
//   - Dimension labels: eave, ridge, height, hip-side (if any).
//   - Pitch angle.
//   - Title lists all the face IDs that share this shape.
//
// Face-shape signature (for grouping) is derived from the polygon's
// plane-local (u, v) projection: bounding-box width/height + edge
// count + eave/ridge-edge lengths, rounded to a stable tolerance.

import type { Point3D, RoofPlane, RoofSpec, StraightMember } from "./model";
import { formatDimension } from "../../format";

// ------------------------------------------------------------------
// Plane-local geometry (matches rafters.ts convention).
// ------------------------------------------------------------------

interface PlaneBasis {
  origin: Point3D;
  uAxis: Point3D;  // horizontal in-plane (parallel to ridge for slope)
  vAxis: Point3D;  // up-slope in-plane (+Z component)
}

function polygonNormalNewell(poly: Point3D[]): Point3D | null {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-9) return null;
  return [nx / len, ny / len, nz / len];
}

function planeBasis(verts: Point3D[]): PlaneBasis | null {
  const n = polygonNormalNewell(verts);
  if (!n) return null;
  const horLen = Math.hypot(n[0], n[1]);
  if (horLen < 1e-6) {
    return { origin: [...verts[0]], uAxis: [1, 0, 0], vAxis: [0, 1, 0] };
  }
  const uAxis: Point3D = [-n[1] / horLen, n[0] / horLen, 0];
  const vRaw: Point3D = [
    n[1] * uAxis[2] - n[2] * uAxis[1],
    n[2] * uAxis[0] - n[0] * uAxis[2],
    n[0] * uAxis[1] - n[1] * uAxis[0],
  ];
  const vAxis: Point3D = vRaw[2] >= 0
    ? vRaw
    : [-vRaw[0], -vRaw[1], -vRaw[2]];
  return { origin: [...verts[0]], uAxis, vAxis };
}

function projectToUV(basis: PlaneBasis, p: Point3D): [number, number] {
  const dx = p[0] - basis.origin[0];
  const dy = p[1] - basis.origin[1];
  const dz = p[2] - basis.origin[2];
  return [
    dx * basis.uAxis[0] + dy * basis.uAxis[1] + dz * basis.uAxis[2],
    dx * basis.vAxis[0] + dy * basis.vAxis[1] + dz * basis.vAxis[2],
  ];
}

// ------------------------------------------------------------------
// Face measurements + shape signature.
// ------------------------------------------------------------------

interface FaceGeom {
  uv: [number, number][];       // polygon in plane-local coords
  uMin: number; uMax: number;
  vMin: number; vMax: number;
  eaveLen: number;              // length of the horizontal edge at v = vMin
  ridgeLen: number;             // length of the horizontal edge at v = vMax (0 for triangular)
  height: number;               // vMax - vMin (slant height, along up-slope)
  pitchDeg: number;             // angle of the plane from horizontal
}

function faceGeometry(plane: RoofPlane): FaceGeom | null {
  const uniqueVerts = dedupe(plane.vertices);
  if (uniqueVerts.length < 3) return null;
  const basis = planeBasis(uniqueVerts);
  if (!basis) return null;
  const uv = uniqueVerts.map((v) => projectToUV(basis, v));
  const uMin = Math.min(...uv.map((p) => p[0]));
  const uMax = Math.max(...uv.map((p) => p[0]));
  const vMin = Math.min(...uv.map((p) => p[1]));
  const vMax = Math.max(...uv.map((p) => p[1]));

  // Edge lengths at v = vMin (eave) and v = vMax (ridge) — sum of
  // edges whose both endpoints sit at that v (within tol).
  const eaveLen = sumHorizontalEdges(uv, vMin);
  const ridgeLen = sumHorizontalEdges(uv, vMax);

  // Pitch angle: rise = vertical Z change from v=vMin to v=vMax; run =
  // horizontal distance. Since vAxis has (horizontal, +Z) components,
  // the pitch = angle of vAxis from horizontal.
  const uAxis = basis.uAxis; void uAxis;
  const vAxis = basis.vAxis;
  const vAxisHor = Math.hypot(vAxis[0], vAxis[1]);
  const pitchDeg = Math.atan2(vAxis[2], vAxisHor) * 180 / Math.PI;

  return { uv, uMin, uMax, vMin, vMax, eaveLen, ridgeLen, height: vMax - vMin, pitchDeg };
}

function sumHorizontalEdges(uv: [number, number][], vTarget: number): number {
  const tol = 0.5;
  let total = 0;
  for (let i = 0; i < uv.length; i++) {
    const a = uv[i];
    const b = uv[(i + 1) % uv.length];
    if (Math.abs(a[1] - vTarget) < tol && Math.abs(b[1] - vTarget) < tol) {
      total += Math.abs(b[0] - a[0]);
    }
  }
  return total;
}

function dedupe(verts: Point3D[]): Point3D[] {
  const out: Point3D[] = [];
  for (const v of verts) {
    const last = out[out.length - 1];
    if (last
      && Math.abs(last[0] - v[0]) < 1e-3
      && Math.abs(last[1] - v[1]) < 1e-3
      && Math.abs(last[2] - v[2]) < 1e-3) continue;
    out.push(v);
  }
  if (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-3
     && Math.abs(f[1] - l[1]) < 1e-3
     && Math.abs(f[2] - l[2]) < 1e-3) out.pop();
  }
  return out;
}

// Rounded signature so tiny numeric differences don't produce phantom
// unique shapes. All lengths rounded to 0.1 project units.
function faceSignature(g: FaceGeom): string {
  const r = (x: number) => Math.round(x * 10) / 10;
  return [
    r(g.eaveLen), r(g.ridgeLen), r(g.height),
    r(g.uMax - g.uMin), r(g.vMax - g.vMin),
    r(g.pitchDeg),
  ].join("|");
}

// ------------------------------------------------------------------
// Grouping — dedupe faces by shape signature.
// ------------------------------------------------------------------

export interface FaceGroup {
  signature: string;
  geom: FaceGeom;
  planes: RoofPlane[];
  members: StraightMember[];     // rafters + purlins on this face (from ONE representative plane)
}

export function groupFaces(spec: RoofSpec): FaceGroup[] {
  const groups = new Map<string, FaceGroup>();
  for (const p of spec.planes) {
    if (p.role !== "slope" && p.role !== "hip_face") continue;
    const g = faceGeometry(p);
    if (!g) continue;
    const sig = faceSignature(g);
    const existing = groups.get(sig);
    if (existing) {
      existing.planes.push(p);
    } else {
      const members = spec.members.filter(
        (m) => m.source_plane_id === p.id
          && (m.role === "rafter" || m.role === "purlin"),
      );
      groups.set(sig, {
        signature: sig,
        geom: g,
        planes: [p],
        members,
      });
    }
  }
  // Order: main slopes (bigger) first, then hip faces.
  return [...groups.values()].sort(
    (a, b) => (b.geom.uMax - b.geom.uMin) - (a.geom.uMax - a.geom.uMin),
  );
}

// ------------------------------------------------------------------
// Diagram rendering — one panel per unique group.
// ------------------------------------------------------------------

export function v2FacePanel(
  x0: number,
  y0: number,
  width: number,
  height: number,
  group: FaceGroup,
): string {
  const titleH = 40;
  const innerPad = 30;
  const drawW = width - 2 * innerPad;
  const drawH = height - titleH - 2 * innerPad - 24;   // 24 for bottom dimension

  const g = group.geom;
  const uSpan = g.uMax - g.uMin;
  const vSpan = g.vMax - g.vMin;
  const scale = Math.min(drawW / (uSpan || 1), drawH / (vSpan || 1)) * 0.82;
  const cx = x0 + width / 2;
  const cy = y0 + titleH + innerPad + drawH / 2;
  // Convert (u, v) to SVG (x, y). SVG y grows downward — flip v.
  const toSvg = (uv: [number, number]): [number, number] => [
    cx + (uv[0] - (g.uMin + uMax()) / 2) * scale,
    cy - (uv[1] - (g.vMin + g.vMax) / 2) * scale,
  ];
  function uMax() { return g.uMax; }

  const title = buildTitle(group);

  let svg = `<g class="v2-face-panel">\n`;
  svg += `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="#fdfcfa" stroke="#333" stroke-width="1"/>\n`;
  svg += `<rect x="${x0}" y="${y0}" width="${width}" height="${titleH}" fill="#f2ede4" stroke="#333" stroke-width="1"/>\n`;
  svg += `<text x="${x0 + width / 2}" y="${y0 + 26}" text-anchor="middle" font-size="14" font-weight="600" fill="#222">${escapeXml(title)}</text>\n`;

  // Face outline.
  const outlinePts = g.uv.map(toSvg).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  svg += `<polygon points="${outlinePts}" fill="#f5e0c9" stroke="#5a2e0b" stroke-width="1.5" fill-opacity="0.5"/>\n`;

  // Rafters + purlins — project each member's 3D endpoints via the
  // representative plane's basis, then map to SVG.
  const repPlane = group.planes[0];
  const basis = planeBasis(dedupe(repPlane.vertices));
  if (basis) {
    for (const m of group.members) {
      const auv = projectToUV(basis, m.start);
      const buv = projectToUV(basis, m.end);
      const [x1, y1] = toSvg(auv);
      const [x2, y2] = toSvg(buv);
      const stroke = m.role === "rafter" ? "#94a3b8" : "#cbd5e1";
      const sw = m.role === "rafter" ? 1 : 0.6;
      svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}"/>\n`;
    }
  }

  // ---- True-shape dimensions: every side length + every corner angle ----
  // The (u, v) projection uses an orthonormal basis, so lengths and angles
  // measured in (u, v) are the REAL lengths/angles on the sloping roof plane
  // — exactly the numbers needed to verify the bill of materials (rafter,
  // hip, ridge, eave, rake cut lengths + their cut angles).
  // formatDimension converts project units → feet-inches (e.g. 519.7 u → "52'").
  const svgPts = g.uv.map(toSvg);
  const nPts = svgPts.length;
  const gcx = svgPts.reduce((s, p) => s + p[0], 0) / nPts;
  const gcy = svgPts.reduce((s, p) => s + p[1], 0) / nPts;
  const LEVEL_TOL = 0.5;

  // Side lengths — one label per polygon edge, rotated to run along the edge
  // and nudged to the outside, with a short tick tying it to the edge.
  for (let i = 0; i < nPts; i++) {
    const a = g.uv[i], b = g.uv[(i + 1) % nPts];
    const lenU = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (lenU < 1) continue; // skip degenerate edges
    const [ax, ay] = svgPts[i], [bx, by] = svgPts[(i + 1) % nPts];
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    let dx = bx - ax, dy = by - ay;
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    // Outward normal (point away from the centroid).
    let nx = -dy, ny = dx;
    if ((mx - gcx) * nx + (my - gcy) * ny < 0) { nx = -nx; ny = -ny; }
    const lx = mx + nx * 15, ly = my + ny * 15;
    let deg = Math.atan2(dy, dx) * 180 / Math.PI;
    if (deg > 90) deg -= 180; else if (deg < -90) deg += 180; // keep upright
    // Name the two horizontal edges (helps map the numbers to the roof).
    const bothLo = Math.abs(a[1] - g.vMin) < LEVEL_TOL && Math.abs(b[1] - g.vMin) < LEVEL_TOL;
    const bothHi = Math.abs(a[1] - g.vMax) < LEVEL_TOL && Math.abs(b[1] - g.vMax) < LEVEL_TOL;
    const prefix = bothLo ? "eave " : bothHi ? "ridge " : "";
    svg += `<line x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${(mx + nx * 6).toFixed(1)}" y2="${(my + ny * 6).toFixed(1)}" stroke="#94733f" stroke-width="0.6"/>\n`;
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#5a2e0b" transform="rotate(${deg.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${prefix}${formatDimension(lenU)}</text>\n`;
  }

  // Corner angles — interior angle at each vertex, nudged toward the centroid.
  for (let i = 0; i < nPts; i++) {
    const prev = g.uv[(i - 1 + nPts) % nPts], cur = g.uv[i], next = g.uv[(i + 1) % nPts];
    const p1x = prev[0] - cur[0], p1y = prev[1] - cur[1];
    const p2x = next[0] - cur[0], p2y = next[1] - cur[1];
    const m1 = Math.hypot(p1x, p1y), m2 = Math.hypot(p2x, p2y);
    if (m1 < 1e-6 || m2 < 1e-6) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (p1x * p2x + p1y * p2y) / (m1 * m2)))) * 180 / Math.PI;
    if (Math.abs(ang - 180) < 3 || ang < 1) continue; // skip near-collinear (trim artifacts)
    const [vx, vy] = svgPts[i];
    let ix = gcx - vx, iy = gcy - vy;
    const il = Math.hypot(ix, iy) || 1; ix /= il; iy /= il;
    svg += `<text x="${(vx + ix * 20).toFixed(1)}" y="${(vy + iy * 20).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#2563eb">${ang.toFixed(0)}°</text>\n`;
  }

  // Pitch + area + member counts — same style as legacy slopePanel.
  const areaSft = faceAreaSft(g);
  const nFaces = group.planes.length;
  const nRafter = group.members.filter((m) => m.role === "rafter").length;
  const nPurlin = group.members.filter((m) => m.role === "purlin").length;

  const pitchY = y0 + titleH + 20;
  svg += `<text x="${cx}" y="${pitchY.toFixed(1)}" text-anchor="middle" font-size="15" font-weight="600" fill="#8B4513">ROOF PITCH: ${g.pitchDeg.toFixed(1)}°</text>\n`;
  const areaLabel = nFaces > 1
    ? `AREA: ${areaSft.toFixed(0)} sft per face   (× ${nFaces} = ${(areaSft * nFaces).toFixed(0)} sft)`
    : `AREA: ${areaSft.toFixed(0)} sft`;
  svg += `<text x="${cx}" y="${(pitchY + 18).toFixed(1)}" text-anchor="middle" font-size="13" fill="#333">${areaLabel}</text>\n`;

  // Rafter / purlin counts (top-right corner).
  const noteX = x0 + width - 12;
  const noteY = y0 + titleH + 20;
  svg += `<text x="${noteX}" y="${noteY.toFixed(1)}" text-anchor="end" font-size="11" fill="#333">${nRafter} rafter${nRafter === 1 ? "" : "s"}</text>\n`;
  svg += `<text x="${noteX}" y="${(noteY + 15).toFixed(1)}" text-anchor="end" font-size="11" fill="#333">${nPurlin} purlin${nPurlin === 1 ? "" : "s"}</text>\n`;

  // Footnotes: keep the slant height (common-rafter run) explicit — it is an
  // internal measure, not a polygon edge — and a legend for the annotations.
  const footY = y0 + height - 10;
  svg += `<text x="${(x0 + 12).toFixed(1)}" y="${footY.toFixed(1)}" text-anchor="start" font-size="10" fill="#475569">slant height (rafter run): ${formatDimension(g.height)}</text>\n`;
  svg += `<text x="${(x0 + width - 12).toFixed(1)}" y="${footY.toFixed(1)}" text-anchor="end" font-size="9" fill="#94a3b8">sides = true lengths · ° = corner angles</text>\n`;

  svg += `</g>\n`;
  return svg;
}

// Area in square feet — 10 project units = 1 ft, so 100 sq units = 1 sft.
// Trapezoid: 0.5*(base+top)*height. Triangle: 0.5*base*height.
function faceAreaSft(g: FaceGeom): number {
  const sqU = g.ridgeLen > 0.5
    ? 0.5 * (g.eaveLen + g.ridgeLen) * g.height
    : 0.5 * g.eaveLen * g.height;
  return sqU / 100;
}

function buildTitle(group: FaceGroup): string {
  const first = group.planes[0];
  const shape = group.geom.ridgeLen > 0.5 ? "TRAPEZOID" : "TRIANGLE";
  const n = group.planes.length;
  if (n === 1) return `${first.role.toUpperCase()} (${shape}) — ${first.id}`;
  const ids = group.planes.map((p) => p.id).join(", ");
  return `${first.role.toUpperCase()}S (${shape}, ${n} identical) — ${ids}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
