// V2 section panel — vertical cross-section through the RoofSpec.
//
// A section cut is a vertical plane parallel to one horizontal axis.
// Cut axis = "y" (a section A-A parallel to the Y axis, cutting at
// X = cutCoord) or "x" (a section B-B parallel to X, cutting at
// Y = cutCoord). The panel draws the intersection LINES of each
// roof plane with the cut plane, projected onto the section view.
//
// Section view axes:
//   horizontal = the axis PARALLEL to the cut plane (i.e. NOT the
//                axis whose coord is fixed). "y" cut → horizontal is Y.
//   vertical   = Z (world height).

import type { Point3D, RoofPlane, RoofSpec, StraightMember, TrussTriangle } from "./model";
import { buildFinkTrussMembers, buildMonoPitchTrussMembers } from "./truss";
import { dimLineH, dimLineV } from "./panelDraw";
import { formatDimension } from "../../format";

export type SectionAxis = "x" | "y";   // the axis whose coord is FIXED

// Intersect one polygon with a vertical plane (axis-aligned). Returns
// the set of line segments produced by the intersection (each is a
// pair of 3D points that lie ON the polygon's plane AND on the cut
// plane). For a convex planar polygon this yields 0 or 1 segments.
function planePolygonSectionSegments(
  poly: Point3D[],
  cutAxis: SectionAxis,
  cutCoord: number,
): Array<[Point3D, Point3D]> {
  if (poly.length < 3) return [];
  const idx = cutAxis === "x" ? 0 : 1;
  const hits: Point3D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = a[idx] - cutCoord;
    const db = b[idx] - cutCoord;
    if (Math.abs(da) < 1e-6) {
      hits.push([a[0], a[1], a[2]]);
      continue;
    }
    // Sign-change edge — interpolate intersection.
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      const p: Point3D = [
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2]),
      ];
      hits.push(p);
    }
  }
  // Deduplicate near-identical points that come from vertices exactly
  // on the cut plane (touched twice by adjacent edges).
  const dedup: Point3D[] = [];
  for (const h of hits) {
    const last = dedup[dedup.length - 1];
    if (last
      && Math.abs(last[0] - h[0]) < 1e-3
      && Math.abs(last[1] - h[1]) < 1e-3
      && Math.abs(last[2] - h[2]) < 1e-3) continue;
    dedup.push(h);
  }
  if (dedup.length < 2) return [];
  // For a convex polygon, exactly 2 hits form the section segment.
  // For higher counts (rare), pair consecutive.
  const segs: Array<[Point3D, Point3D]> = [];
  for (let i = 0; i + 1 < dedup.length; i += 2) {
    segs.push([dedup[i], dedup[i + 1]]);
  }
  return segs;
}

interface SectionOpts {
  title?: string;
  cutAxis: SectionAxis;
  cutCoord: number;
  wallTopZ?: number;
  groundZ?: number;
  // When true, overlay the profile of the truss that spans along this
  // section's horizontal axis, so the cut reads as a truss profile (the
  // classic "Section A-A = truss" drawing).
  overlayTruss?: boolean;
  // When true, draw the eave datum + wall stubs and dimension the section
  // (eave-to-eave span, wall span, overhangs, ridge rise).
  dimensions?: boolean;
}

// Members of a truss: pre-populated set, else rebuild by kind.
function trussMembers(t: TrussTriangle): StraightMember[] {
  if (t.members && t.members.length) return t.members;
  return (t.kind === "mono_pitch" ? buildMonoPitchTrussMembers : buildFinkTrussMembers)(t);
}

// Pick the truss whose bottom chord runs most closely ALONG the section's
// horizontal axis (so its elevation projects cleanly onto the section view).
// Returns null when no truss is well-aligned.
function trussForSection(spec: RoofSpec, cutAxis: SectionAxis): TrussTriangle | null {
  const horIdx = cutAxis === "x" ? 1 : 0;
  let best: TrussTriangle | null = null;
  let bestScore = 0.7; // require a decent alignment
  for (const t of spec.trusses) {
    const dx = t.bottom_right[0] - t.bottom_left[0];
    const dy = t.bottom_right[1] - t.bottom_left[1];
    const len = Math.hypot(dx, dy) || 1;
    const along = Math.abs((horIdx === 0 ? dx : dy) / len);
    if (along > bestScore) { bestScore = along; best = t; }
  }
  return best;
}

const PLANE_STROKES: Record<string, string> = {
  slope: "#8B4513",
  hip_face: "#8B4513",
  gable_wall: "#8a6a3f",
  flat_slab: "#5a5854",
  parapet: "#5a5854",
};

export function v2SectionPanel(
  x0: number,
  y0: number,
  width: number,
  height: number,
  spec: RoofSpec,
  opts: SectionOpts,
): string {
  const titleH = opts.title ? 40 : 0;
  const innerPad = 20;
  // Reserve room on the left (ridge-rise dim) + bottom (span dims) when dimensioned.
  const dimL = opts.dimensions ? 46 : 0;
  const dimB = opts.dimensions ? 58 : 0;
  const drawW = width - 2 * innerPad - dimL;
  const drawH = height - titleH - 2 * innerPad - dimB;

  // Collect section segments across all roof planes.
  const allSegs: Array<{ role: RoofPlane["role"]; seg: [Point3D, Point3D] }> = [];
  for (const p of spec.planes) {
    if (p.role === "parapet") continue;
    for (const s of planePolygonSectionSegments(p.vertices, opts.cutAxis, opts.cutCoord)) {
      allSegs.push({ role: p.role, seg: s });
    }
  }

  // Compute 2D bounds. Horizontal axis is the OTHER axis (not the cut).
  const horIdx = opts.cutAxis === "x" ? 1 : 0;
  let minH = Infinity, maxH = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const { seg: [a, b] } of allSegs) {
    for (const p of [a, b]) {
      if (p[horIdx] < minH) minH = p[horIdx];
      if (p[horIdx] > maxH) maxH = p[horIdx];
      if (p[2] < minZ) minZ = p[2];
      if (p[2] > maxZ) maxZ = p[2];
    }
  }
  if (opts.groundZ != null && opts.groundZ < minZ) minZ = opts.groundZ;
  if (opts.wallTopZ != null) {
    if (opts.wallTopZ < minZ) minZ = opts.wallTopZ;
    if (opts.wallTopZ > maxZ) maxZ = opts.wallTopZ;
  }
  if (!isFinite(minH)) return "";
  const horSpan = maxH - minH || 1;
  const zSpan = maxZ - minZ || 1;
  const scale = Math.min(drawW / horSpan, drawH / zSpan);
  const offX = x0 + innerPad + dimL + (drawW - horSpan * scale) / 2 - minH * scale;
  const offY = y0 + titleH + innerPad + (drawH - zSpan * scale) / 2 + maxZ * scale;
  const toSvg = (p: Point3D): [number, number] => [
    offX + p[horIdx] * scale,
    offY - p[2] * scale,
  ];

  let svg = `<g id="v2-section-${opts.cutAxis}">\n`;
  svg += `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="#fdfcfa" stroke="#333" stroke-width="1"/>\n`;
  if (opts.title) {
    svg += `<text x="${x0 + width / 2}" y="${y0 + 24}" text-anchor="middle" font-size="14" font-weight="bold" fill="#222">${opts.title}</text>\n`;
  }

  // Optional wall-top reference line.
  if (opts.wallTopZ != null) {
    const [x1, y1] = toSvg([minH, minH, opts.wallTopZ] as Point3D);
    const [x2, y2] = toSvg([maxH, maxH, opts.wallTopZ] as Point3D);
    svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#999" stroke-width="0.5" stroke-dasharray="4,2"/>\n`;
  }

  // Section segments (plane cuts).
  for (const { role, seg } of allSegs) {
    const [a, b] = seg;
    const [x1, y1] = toSvg(a);
    const [x2, y2] = toSvg(b);
    const stroke = PLANE_STROKES[role] ?? "#8B4513";
    svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="2"/>\n`;
  }

  // Framing member CROSSINGS at the cut plane — draw small squares
  // (member cross-sections) wherever a rafter/purlin/ridge/hip/valley/
  // ring-beam crosses the cut plane. For linear members, "crosses"
  // means the fixed-axis coord of one endpoint is on the opposite
  // side of cutCoord from the other.
  const memberIdx = opts.cutAxis === "x" ? 0 : 1;
  for (const m of spec.members) {
    if (!MEMBER_MARK_ROLES.has(m.role)) continue;
    const c1 = m.start[memberIdx];
    const c2 = m.end[memberIdx];
    const d1 = c1 - opts.cutCoord;
    const d2 = c2 - opts.cutCoord;
    // Same-side (both sign) → member doesn't cross the plane. Skip.
    if (Math.sign(d1) === Math.sign(d2) && Math.abs(d1) > 1e-6 && Math.abs(d2) > 1e-6) continue;
    // Interpolate crossing point.
    const t = Math.abs(d1) < 1e-6 ? 0
            : Math.abs(d2) < 1e-6 ? 1
            : d1 / (d1 - d2);
    const px: [number, number, number] = [
      m.start[0] + t * (m.end[0] - m.start[0]),
      m.start[1] + t * (m.end[1] - m.start[1]),
      m.start[2] + t * (m.end[2] - m.start[2]),
    ];
    const [sx, sy] = toSvg(px);
    const color = MEMBER_MARK_COLORS[m.role] ?? "#334155";
    // Small square (~ member depth) centered on the crossing.
    const half = 3;
    svg += `<rect x="${(sx - half).toFixed(2)}" y="${(sy - half).toFixed(2)}" width="${(half * 2).toFixed(2)}" height="${(half * 2).toFixed(2)}" fill="${color}" stroke="#111" stroke-width="0.4"/>\n`;
  }

  // Truss profile overlay — the truss that spans along this section's
  // horizontal axis, drawn as a dashed reference profile so the cut reads
  // as a truss elevation. Chords bold, webs light.
  if (opts.overlayTruss) {
    const t = trussForSection(spec, opts.cutAxis);
    if (t) {
      const kindLabel = (t.kind ?? "fink") === "mono_pitch" ? "mono-pitch" : "fink";
      for (const m of trussMembers(t)) {
        const isChord = m.role === "truss_top_chord" || m.role === "truss_bottom_chord";
        const [x1, y1] = toSvg(m.start);
        const [x2, y2] = toSvg(m.end);
        svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${isChord ? "#7c2d12" : "#b45309"}" stroke-width="${isChord ? 1.8 : 1}" stroke-dasharray="${isChord ? "6 3" : "3 3"}" stroke-linecap="round"/>\n`;
      }
      svg += `<text x="${(x0 + width - 12).toFixed(1)}" y="${(y0 + height - 12).toFixed(1)}" text-anchor="end" font-size="9" fill="#7c2d12">— — ${kindLabel} truss profile at this bay (see truss drawing for member lengths)</text>\n`;
    }
  }

  // --- Eave datum + dimensions (comparable to the plan / iso) ---
  if (opts.dimensions) {
    // A point at (h along the section axis, height z).
    const hz = (h: number, z: number): Point3D => {
      const p: [number, number, number] = [0, 0, z];
      p[horIdx] = h;
      return p;
    };
    // Horizontal: eave-to-eave (the profile) vs the WALL outer face. The ring
    // beam sits on the wall centreline, so the wall face = ring ± half the wall
    // thickness. Overhang and wall stubs reference the wall face.
    const ringHs: number[] = [];
    for (const m of spec.members) if (m.role === "ring_beam") ringHs.push(m.start[horIdx], m.end[horIdx]);
    const half = (spec.framing?.wall_thickness_u ?? 0) / 2;
    const eMinH = minH, eMaxH = maxH;
    const rMinH = (ringHs.length ? Math.min(...ringHs) : eMinH) - half;
    const rMaxH = (ringHs.length ? Math.max(...ringHs) : eMaxH) + half;
    // z levels from the actual plane cuts (not padded ground/wall).
    let segMinZ = Infinity, segMaxZ = -Infinity;
    for (const { seg: [a, b] } of allSegs) for (const p of [a, b]) {
      if (p[2] < segMinZ) segMinZ = p[2];
      if (p[2] > segMaxZ) segMaxZ = p[2];
    }
    const eaveZ = isFinite(segMinZ) ? segMinZ : minZ;
    const ridgeZ = isFinite(segMaxZ) ? segMaxZ : maxZ;
    const wtZ = opts.wallTopZ ?? eaveZ;
    const EAVE = "#0e7490";

    // Eave datum line at eave level.
    const el = toSvg(hz(eMinH, eaveZ)), er = toSvg(hz(eMaxH, eaveZ));
    svg += `<line x1="${el[0].toFixed(1)}" y1="${el[1].toFixed(1)}" x2="${er[0].toFixed(1)}" y2="${er[1].toFixed(1)}" stroke="${EAVE}" stroke-width="1" stroke-dasharray="4 2"/>\n`;
    // Wall stubs at the ring edges (from wall top down).
    const drop = (wtZ - eaveZ) + Math.max((ridgeZ - eaveZ) * 0.18, 8);
    for (const h of [rMinH, rMaxH]) {
      const a = toSvg(hz(h, wtZ)), b = toSvg(hz(h, wtZ - drop));
      svg += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#8a6a3f" stroke-width="1.4"/>\n`;
    }

    // Dimension baselines below everything drawn.
    const wallBottomY = toSvg(hz(rMinH, wtZ - drop))[1];
    const y1 = Math.max(el[1], wallBottomY) + 22;
    const y2 = y1 + 22;
    const sx = (h: number) => toSvg(hz(h, eaveZ))[0];
    if (rMinH - eMinH > 0.5) svg += dimLineH(sx(eMinH), sx(rMinH), y1, formatDimension(rMinH - eMinH));
    if (eMaxH - rMaxH > 0.5) svg += dimLineH(sx(rMaxH), sx(eMaxH), y1, formatDimension(eMaxH - rMaxH));
    svg += dimLineH(sx(rMinH), sx(rMaxH), y1, `wall ${formatDimension(rMaxH - rMinH)}`);
    svg += dimLineH(sx(eMinH), sx(eMaxH), y2, `eave ${formatDimension(eMaxH - eMinH)}`);
    // Ridge rise (vertical, left of the profile).
    if (ridgeZ - wtZ > 0.5) {
      const riseX = Math.min(el[0], er[0]) - 26;
      svg += dimLineV(toSvg(hz(eMinH, wtZ))[1], toSvg(hz(eMinH, ridgeZ))[1], riseX, `rise ${formatDimension(ridgeZ - wtZ)}`);
    }
    svg += `<text x="${(x0 + 12).toFixed(1)}" y="${(y0 + height - 12).toFixed(1)}" text-anchor="start" font-size="9" fill="${EAVE}">— — eave datum · brown = wall</text>\n`;
  }

  svg += `</g>\n`;
  return svg;
}

// Roles rendered as crossing marks in section views.
const MEMBER_MARK_ROLES = new Set<string>([
  "rafter", "purlin", "ring_beam", "ridge", "hip", "valley", "tie_beam",
]);
const MEMBER_MARK_COLORS: Record<string, string> = {
  rafter: "#94a3b8",       // slate
  purlin: "#64748b",       // slate darker
  ring_beam: "#16a34a",    // green
  ridge: "#dc2626",        // red
  hip: "#ea580c",          // orange
  valley: "#2563eb",       // blue
  tie_beam: "#0ea5e9",     // sky — wall-top tie
};
