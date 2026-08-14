// V2 truss-elevation panel — a fabrication drawing of ONE truss, in true
// elevation, with every member's real length plus the overall span and rise.
// These are the numbers a fabricator measures while welding, so all lengths
// are the true 3D member lengths (project units → feet-inches via formatDimension).
//
// Identical trusses (same kind + span + rise) are grouped so a symmetric roof
// shows one drawing labelled "× N identical trusses" instead of N copies.
//
// A truss is planar and vertical, so its elevation is exact: the horizontal
// axis (u) runs along the bottom chord (bottom_left → bottom_right, projected to
// the ground plane) and the vertical axis (v) is height above the bottom chord.

import type { Point3D, RoofSpec, StraightMember, TrussTriangle } from "./model";
import {
  buildFinkTrussMembers,
  buildMonoPitchTrussMembers,
  DEFAULT_TRUSS_SECTION,
} from "./truss";
import { formatDimension } from "../../format";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&#39;" : "&quot;",
  );
}

const len3 = (a: Point3D, b: Point3D): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Members of a truss: use the pre-populated set, else rebuild by kind.
function trussMembers(t: TrussTriangle): StraightMember[] {
  if (t.members && t.members.length) return t.members;
  return (t.kind === "mono_pitch" ? buildMonoPitchTrussMembers : buildFinkTrussMembers)(
    { ...t, id: t.id, source_segment_id: t.source_segment_id },
  );
}

interface TrussGeom {
  span: number; // bottom-chord length (horizontal)
  rise: number; // apex height above the bottom chord
  kind: "fink" | "mono_pitch";
}

function trussGeom(t: TrussTriangle): TrussGeom {
  const bl = t.bottom_left, br = t.bottom_right;
  const span = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const rise = t.apex[2] - bl[2];
  return { span, rise, kind: t.kind ?? "fink" };
}

// ------------------------------------------------------------------
// Grouping — dedupe by kind + span + rise (rounded to 0.1 units).
// ------------------------------------------------------------------

export interface TrussGroup {
  signature: string;
  rep: TrussTriangle;
  members: StraightMember[];
  geom: TrussGeom;
  count: number;
}

export function groupTrusses(spec: RoofSpec): TrussGroup[] {
  const groups = new Map<string, TrussGroup>();
  for (const t of spec.trusses) {
    const g = trussGeom(t);
    const r = (x: number) => Math.round(x * 10) / 10;
    const sig = `${g.kind}|${r(g.span)}|${r(g.rise)}`;
    const existing = groups.get(sig);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(sig, { signature: sig, rep: t, members: trussMembers(t), geom: g, count: 1 });
    }
  }
  // Widest span first.
  return [...groups.values()].sort((a, b) => b.geom.span - a.geom.span);
}

// ------------------------------------------------------------------
// Elevation rendering — one panel per unique truss group.
// ------------------------------------------------------------------

export function v2TrussPanel(
  x0: number,
  y0: number,
  width: number,
  height: number,
  group: TrussGroup,
): string {
  const titleH = 40;
  const innerPad = 34;
  const drawW = width - 2 * innerPad;
  const drawH = height - titleH - 2 * innerPad - 20;

  const t = group.rep;
  const bl = t.bottom_left;
  const br = t.bottom_right;
  const { span, rise, kind } = group.geom;

  // Elevation basis: u along the (horizontal) bottom chord, v = height above it.
  const dx = br[0] - bl[0], dy = br[1] - bl[1];
  const horiz = Math.hypot(dx, dy) || 1;
  const ux = dx / horiz, uy = dy / horiz;
  const baseZ = bl[2];
  const toUV = (p: Point3D): [number, number] => [
    (p[0] - bl[0]) * ux + (p[1] - bl[1]) * uy,
    p[2] - baseZ,
  ];

  const scale = Math.min(drawW / (span || 1), drawH / (rise || 1)) * 0.8;
  const cx = x0 + width / 2;
  const cy = y0 + titleH + innerPad + drawH / 2;
  const toSvg = (uv: [number, number]): [number, number] => [
    cx + (uv[0] - span / 2) * scale,
    cy - (uv[1] - rise / 2) * scale,
  ];

  const pitchDeg = (Math.atan2(rise, span / 2) * 180) / Math.PI; // top-chord pitch (fink)
  const nice = kind === "mono_pitch" ? "MONO-PITCH TRUSS" : "FINK TRUSS";
  const title = `${nice} — Elevation${group.count > 1 ? `  (× ${group.count} identical)` : ""}`;

  let svg = `<g class="v2-truss-panel">\n`;
  svg += `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="#fdfcfa" stroke="#333" stroke-width="1"/>\n`;
  svg += `<rect x="${x0}" y="${y0}" width="${width}" height="${titleH}" fill="#f2ede4" stroke="#333" stroke-width="1"/>\n`;
  svg += `<text x="${cx}" y="${y0 + 26}" text-anchor="middle" font-size="14" font-weight="600" fill="#222">${escapeXml(title)}</text>\n`;

  // Members — chords bold, webs light. Draw first so dimensions sit on top.
  const isChord = (m: StraightMember) =>
    m.role === "truss_top_chord" || m.role === "truss_bottom_chord";
  for (const m of group.members) {
    const [x1, y1] = toSvg(toUV(m.start));
    const [x2, y2] = toSvg(toUV(m.end));
    const stroke = isChord(m) ? "#5a2e0b" : "#b45309";
    const sw = isChord(m) ? 2.2 : 1.2;
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>\n`;
  }

  // Member length labels — the true 3D length at each member's midpoint, rotated
  // to run along the member. Dedupe identical (length, angle) labels so mirrored
  // webs don't double up. These are what the welder measures.
  const seen = new Set<string>();
  for (const m of group.members) {
    const L = len3(m.start, m.end);
    if (L < 1) continue;
    const a = toSvg(toUV(m.start));
    const b = toSvg(toUV(m.end));
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    if (deg > 90) deg -= 180; else if (deg < -90) deg += 180;
    // nudge off the member line, perpendicular
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if (ny > 0) { nx = -nx; ny = -ny; } // prefer labels above the line
    const lx = mx + nx * 9, ly = my + ny * 9;
    const key = `${Math.round(L)}|${Math.round(Math.abs(deg))}`;
    if (seen.has(key) && isChord(m) === false) continue;
    seen.add(key);
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#7c2d12" transform="rotate(${deg.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${formatDimension(L)}</text>\n`;
  }

  // ---- Overall SPAN dimension line (below the bottom chord) ----
  const blS = toSvg(toUV(bl));
  const brS = toSvg(toUV(br));
  const spanY = Math.max(blS[1], brS[1]) + 26;
  svg += dimLineH(blS[0], brS[0], spanY, `span ${formatDimension(span)}`);
  // witness ticks up to the chord ends
  svg += `<line x1="${blS[0].toFixed(1)}" y1="${blS[1].toFixed(1)}" x2="${blS[0].toFixed(1)}" y2="${spanY.toFixed(1)}" stroke="#94a3b8" stroke-width="0.5"/>\n`;
  svg += `<line x1="${brS[0].toFixed(1)}" y1="${brS[1].toFixed(1)}" x2="${brS[0].toFixed(1)}" y2="${spanY.toFixed(1)}" stroke="#94a3b8" stroke-width="0.5"/>\n`;

  // ---- RISE dimension (vertical, at the apex) ----
  const apexS = toSvg(toUV(t.apex));
  const baseAtApex = toSvg([span / 2, 0]); // bottom chord directly under apex
  const riseX = apexS[0] + (kind === "mono_pitch" ? 22 : Math.min(brS[0] - apexS[0] + 22, 40));
  svg += dimLineV(apexS[1], baseAtApex[1], riseX, `rise ${formatDimension(rise)}`);
  svg += `<line x1="${apexS[0].toFixed(1)}" y1="${apexS[1].toFixed(1)}" x2="${riseX.toFixed(1)}" y2="${apexS[1].toFixed(1)}" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="2 2"/>\n`;
  svg += `<line x1="${baseAtApex[0].toFixed(1)}" y1="${baseAtApex[1].toFixed(1)}" x2="${riseX.toFixed(1)}" y2="${baseAtApex[1].toFixed(1)}" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="2 2"/>\n`;

  // ---- Notes: pitch, section sizes, quantity ----
  svg += `<text x="${cx}" y="${(y0 + titleH + 18).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="600" fill="#8B4513">TOP-CHORD PITCH: ${pitchDeg.toFixed(1)}°</text>\n`;

  const chord = group.members.find(isChord)?.section_size ?? DEFAULT_TRUSS_SECTION.chord_size_in;
  const web = group.members.find((m) => m.role === "truss_web")?.section_size ?? DEFAULT_TRUSS_SECTION.web_size_in;
  const secStr = (s: [number, number]) => `${s[0]}"×${s[1]}"`;
  const footY = y0 + height - 12;
  svg += `<text x="${(x0 + 12).toFixed(1)}" y="${footY.toFixed(1)}" text-anchor="start" font-size="10" fill="#475569">chord ${secStr(chord as [number, number])} · web ${secStr(web as [number, number])}${group.rep.members?.[0]?.material ? " · " + escapeXml(group.rep.members[0].material) : ""}</text>\n`;
  svg += `<text x="${(x0 + width - 12).toFixed(1)}" y="${footY.toFixed(1)}" text-anchor="end" font-size="9" fill="#94a3b8">lengths = true member lengths (for fabrication)</text>\n`;

  svg += `</g>\n`;
  return svg;
}

// A horizontal dimension line with end ticks and a centered label above it.
function dimLineH(x1: number, x2: number, y: number, label: string): string {
  const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
  return (
    `<line x1="${lo.toFixed(1)}" y1="${y.toFixed(1)}" x2="${hi.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<line x1="${lo.toFixed(1)}" y1="${(y - 3).toFixed(1)}" x2="${lo.toFixed(1)}" y2="${(y + 3).toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<line x1="${hi.toFixed(1)}" y1="${(y - 3).toFixed(1)}" x2="${hi.toFixed(1)}" y2="${(y + 3).toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<text x="${((lo + hi) / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#334155">${escapeXml(label)}</text>\n`
  );
}

// A vertical dimension line with end ticks and a rotated label.
function dimLineV(y1: number, y2: number, x: number, label: string): string {
  const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
  return (
    `<line x1="${x.toFixed(1)}" y1="${lo.toFixed(1)}" x2="${x.toFixed(1)}" y2="${hi.toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<line x1="${(x - 3).toFixed(1)}" y1="${lo.toFixed(1)}" x2="${(x + 3).toFixed(1)}" y2="${lo.toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<line x1="${(x - 3).toFixed(1)}" y1="${hi.toFixed(1)}" x2="${(x + 3).toFixed(1)}" y2="${hi.toFixed(1)}" stroke="#334155" stroke-width="0.8"/>\n` +
    `<text x="${(x + 4).toFixed(1)}" y="${((lo + hi) / 2).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#334155" transform="rotate(-90 ${(x + 4).toFixed(1)} ${((lo + hi) / 2).toFixed(1)})">${escapeXml(label)}</text>\n`
  );
}
