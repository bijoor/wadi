// V2 main-frame fabrication-dimension panel — a dimensioned PLAN of the
// structural steel frame referenced to the wall ring beam.
//
// This is the drawing a fabricator measures against while welding: it shows
// the ring beam (the "ring on the wall") as the datum, every truss station
// dimensioned along the ring as a running chain from a reference corner, the
// truss-to-truss spacings, the ridge line, and the overall ring width × length.
// All lengths are true plan distances (project units → feet-inches).

import type { Point3D, RoofSpec, StraightMember } from "./model";
import { formatDimension } from "../../format";
import { dimLineH, dimLineV, escapeXml, panelFrame, sectionFtLabel } from "./panelDraw";

interface Bounds { minX: number; maxX: number; minY: number; maxY: number; }

function membersBounds(members: StraightMember[]): Bounds | null {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const m of members) {
    for (const p of [m.start, m.end]) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
  }
  if (!isFinite(minX)) return null;
  return { minX, maxX, minY, maxY };
}

// True plan (horizontal) length of a member.
const planLen = (m: StraightMember): number =>
  Math.hypot(m.end[0] - m.start[0], m.end[1] - m.start[1]);

export function v2FrameDimPanel(
  x0: number,
  y0: number,
  width: number,
  height: number,
  spec: RoofSpec,
): string {
  const titleH = 40;
  // Extra room on the left + bottom for the ring, eave, and truss dim chains.
  const padL = 104, padR = 40, padT = titleH + 30, padB = 96;
  const drawW = width - padL - padR;
  const drawH = height - padT - padB;

  const ring = spec.members.filter((m) => m.role === "ring_beam");
  const ridges = spec.members.filter((m) => m.role === "ridge");
  const hips = spec.members.filter((m) => m.role === "hip");
  const ties = spec.members.filter((m) => m.role === "tie_beam");
  const eaves = spec.members.filter((m) => m.role === "pani_patti"); // roof edge
  const trusses = spec.trusses;

  // Datum = the ring beam's plan extent (what the dimensions measure). Fall back
  // to the whole frame if a roof has no explicit ring (shouldn't happen).
  const datum = membersBounds(ring.length ? ring : spec.members);
  if (!datum) return panelFrame(x0, y0, width, height, titleH, "Main frame — dimensions", "v2-frame-dim") + "</g>\n";
  const { minX, maxX, minY, maxY } = datum;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  // Fit the FULL frame — ring + hips (which run out to the eave corners) + ridge
  // — so the hip diagonals draw full-length to the eaves rather than clipped at
  // the ring. The ring stays the measured datum; it just sits inset.
  const fit = membersBounds([...ring, ...hips, ...ridges, ...ties, ...eaves]) ?? datum;
  const fSpanX = (fit.maxX - fit.minX) || 1;
  const fSpanY = (fit.maxY - fit.minY) || 1;
  const scale = Math.min(drawW / fSpanX, drawH / fSpanY);
  const offX = x0 + padL + (drawW - fSpanX * scale) / 2 - fit.minX * scale;
  const offY = y0 + padT + (drawH - fSpanY * scale) / 2 - fit.minY * scale;
  const toSvg = (p: Point3D | readonly [number, number]): [number, number] => [
    offX + p[0] * scale,
    offY + p[1] * scale,
  ];

  const title = "MAIN FRAME — Fabrication dimensions (plan, referenced to wall ring)";
  let svg = panelFrame(x0, y0, width, height, titleH, title, "v2-frame-dim");

  const line = (a: [number, number], b: [number, number], stroke: string, w: number, dash?: string) =>
    `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-linecap="round"/>\n`;

  // Ring-datum corners (measured) + full-extent corners (for the dim chains,
  // which sit BEYOND the hips so they don't collide with them).
  const c0 = toSvg([minX, minY]);
  const c1 = toSvg([maxX, maxY]);
  const f0 = toSvg([fit.minX, fit.minY]);
  const f1 = toSvg([fit.maxX, fit.maxY]);
  const ringBottom = Math.max(c0[1], c1[1]), ringLeft = Math.min(c0[0], c1[0]);
  const fullBottom = Math.max(f0[1], f1[1]), fullLeft = Math.min(f0[0], f1[0]);

  // --- Ring beam datum: light fill + bold green outline of its plan extent ---
  const rectX = Math.min(c0[0], c1[0]), rectY = Math.min(c0[1], c1[1]);
  const rectW = Math.abs(c1[0] - c0[0]), rectH = Math.abs(c1[1] - c0[1]);
  svg += `<rect x="${rectX.toFixed(1)}" y="${rectY.toFixed(1)}" width="${rectW.toFixed(1)}" height="${rectH.toFixed(1)}" fill="#ecfdf5" stroke="none"/>\n`;
  for (const m of ring) svg += line(toSvg(m.start), toSvg(m.end), "#16a34a", 3);
  // Eave perimeter — the actual roof edge, joining the hip tips so the overall
  // roof footprint (walls + overhang) reads at a glance.
  for (const m of eaves) svg += line(toSvg(m.start), toSvg(m.end), "#94a3b8", 1.2);
  // Hips run full-length to the eave corners (welded ring-corner → eave tip).
  for (const m of hips) svg += line(toSvg(m.start), toSvg(m.end), "#ea580c", 1.4, "5 3");
  for (const m of ridges) svg += line(toSvg(m.start), toSvg(m.end), "#dc2626", 2, "6 3");
  for (const m of ties) svg += line(toSvg(m.start), toSvg(m.end), "#0ea5e9", 1.2, "3 3");

  // --- Which axis distributes the trusses? Use the spread of truss centroids. ---
  const centroid = (i: number): number => {
    const t = trusses[i];
    return ((t.bottom_left[0] + t.bottom_right[0] + t.apex[0]) / 3);
  };
  const centroidY = (i: number): number => {
    const t = trusses[i];
    return ((t.bottom_left[1] + t.bottom_right[1] + t.apex[1]) / 3);
  };
  let spreadX = 0, spreadY = 0;
  if (trusses.length > 1) {
    const xs = trusses.map((_, i) => centroid(i));
    const ys = trusses.map((_, i) => centroidY(i));
    spreadX = Math.max(...xs) - Math.min(...xs);
    spreadY = Math.max(...ys) - Math.min(...ys);
  }
  const distAxis: 0 | 1 = spreadX >= spreadY ? 0 : 1; // axis trusses march along

  // Ordered truss stations = coordinate on the distribution axis.
  const stations = trusses
    .map((t, i) => ({ i, pos: distAxis === 0 ? centroid(i) : centroidY(i), t }))
    .sort((a, b) => a.pos - b.pos);

  // --- Draw each truss plan line (bottom_left → bottom_right) + label T1.. ---
  stations.forEach((s, k) => {
    const a = toSvg(s.t.bottom_left);
    const b = toSvg(s.t.bottom_right);
    svg += line(a, b, "#7c2d12", 2);
    const lx = (a[0] + b[0]) / 2, ly = (a[1] + b[1]) / 2;
    svg += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="8" fill="#fff7ed" stroke="#7c2d12" stroke-width="0.8"/>\n`;
    svg += `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#7c2d12">T${k + 1}</text>\n`;
  });

  // --- Running dimension chain along the distribution axis (beyond the eaves) ---
  const chainY = fullBottom + 20;
  const edgeLo = distAxis === 0 ? minX : minY;
  const edgeHi = distAxis === 0 ? maxX : maxY;
  const svgOf = (pos: number): number =>
    distAxis === 0 ? toSvg([pos, minY])[0] : toSvg([minX, pos])[1];

  if (distAxis === 0) {
    // Stations distributed along X → horizontal chain.
    const marks = [edgeLo, ...stations.map((s) => s.pos), edgeHi];
    for (let j = 0; j + 1 < marks.length; j++) {
      const gap = Math.abs(marks[j + 1] - marks[j]);
      if (gap < 0.5) continue;
      svg += dimLineH(svgOf(marks[j]), svgOf(marks[j + 1]), chainY, formatDimension(gap));
    }
    // witness ticks from the ring station out to the chain
    for (const mk of marks) {
      const sx = svgOf(mk);
      svg += line([sx, ringBottom], [sx, chainY], "#94a3b8", 0.5, "2 2");
    }
    // overall ring width, one line lower
    svg += dimLineH(svgOf(edgeLo), svgOf(edgeHi), chainY + 22, `RING WIDTH ${formatDimension(spanX)}`);
    // overall ring length on the left, beyond the eaves
    svg += dimLineV(Math.min(c0[1], c1[1]), Math.max(c0[1], c1[1]), fullLeft - 24, `RING LENGTH ${formatDimension(spanY)}`);
  } else {
    // Stations distributed along Y → vertical chain on the left, beyond the eaves.
    const chainX = fullLeft - 20;
    const marks = [edgeLo, ...stations.map((s) => s.pos), edgeHi];
    for (let j = 0; j + 1 < marks.length; j++) {
      const gap = Math.abs(marks[j + 1] - marks[j]);
      if (gap < 0.5) continue;
      svg += dimLineV(svgOf(marks[j]), svgOf(marks[j + 1]), chainX, formatDimension(gap));
    }
    for (const mk of marks) {
      const sy = svgOf(mk);
      svg += line([ringLeft, sy], [chainX, sy], "#94a3b8", 0.5, "2 2");
    }
    svg += dimLineV(svgOf(edgeLo), svgOf(edgeHi), chainX - 22, `RING LENGTH ${formatDimension(spanY)}`);
    svg += dimLineH(Math.min(c0[0], c1[0]), Math.max(c0[0], c1[0]), fullBottom + 20, `RING WIDTH ${formatDimension(spanX)}`);
  }

  // --- Eave (roof edge) overall + per-side overhang, to compare with the iso ---
  if (eaves.length) {
    const eW = fit.maxX - fit.minX, eL = fit.maxY - fit.minY;
    const ringL = Math.min(c0[0], c1[0]), ringR = Math.max(c0[0], c1[0]);
    const ringT = Math.min(c0[1], c1[1]), ringBot = Math.max(c0[1], c1[1]);
    const midXsvg = (ringL + ringR) / 2, midYsvg = (ringT + ringBot) / 2;
    // Overall eave dimensions — the outermost lines (roof footprint incl overhang).
    svg += dimLineH(f0[0], f1[0], fullBottom + 42, `EAVE WIDTH ${formatDimension(eW)}`);
    svg += dimLineV(f0[1], f1[1], fullLeft - 66, `EAVE LENGTH ${formatDimension(eL)}`);
    // Per-side overhang (ring edge → eave edge), mid of each side.
    const ohL = minX - fit.minX, ohR = fit.maxX - maxX, ohT = minY - fit.minY, ohB = fit.maxY - maxY;
    if (ohL > 0.5) svg += dimLineH(f0[0], ringL, midYsvg, formatDimension(ohL));
    if (ohR > 0.5) svg += dimLineH(ringR, f1[0], midYsvg, formatDimension(ohR));
    if (ohT > 0.5) svg += dimLineV(f0[1], ringT, midXsvg, formatDimension(ohT));
    if (ohB > 0.5) svg += dimLineV(ringBot, f1[1], midXsvg, formatDimension(ohB));
  }

  // --- Representative truss clear span (ring-to-ring the truss must fit) ---
  if (stations.length) {
    const rep = stations[Math.floor(stations.length / 2)].t;
    const span = Math.hypot(rep.bottom_right[0] - rep.bottom_left[0], rep.bottom_right[1] - rep.bottom_left[1]);
    const a = toSvg(rep.bottom_left);
    const b = toSvg(rep.bottom_right);
    const midY = Math.min(a[1], b[1]) - 12;
    svg += dimLineH(a[0], b[0], midY, `truss span ${formatDimension(span)}`);
  }

  // --- Notes: member sections + datum reminder ---
  // Ring beam / ridge sections come from the authoritative framing config (in
  // inches), the SAME source the BOM uses — not per-member fallbacks.
  const inLabel = (s?: [number, number]): string | null =>
    s ? `${Math.round(s[0] * 10) / 10}"×${Math.round(s[1] * 10) / 10}"` : null;
  const ringSec = inLabel(spec.framing?.ring_beam_size_in) ?? sectionFtLabel(ring[0]?.section_size);
  const ridgeSec = inLabel(spec.framing?.ridge_size_in) ?? sectionFtLabel(ridges[0]?.section_size);
  const footY = y0 + height - 12;
  const parts: string[] = [];
  if (ringSec) parts.push(`ring beam ${ringSec}`);
  if (ridgeSec) parts.push(`ridge ${ridgeSec}`);
  parts.push(`${stations.length} truss station${stations.length === 1 ? "" : "s"}`);
  svg += `<text x="${(x0 + 12).toFixed(1)}" y="${footY.toFixed(1)}" text-anchor="start" font-size="10" fill="#475569">${escapeXml(parts.join("  ·  "))}</text>\n`;
  svg += `<text x="${(x0 + width - 12).toFixed(1)}" y="${footY.toFixed(1)}" text-anchor="end" font-size="9" fill="#475569"><tspan fill="#16a34a">green = wall ring beam</tspan> · grey = roof edge (eave)</text>\n`;

  svg += `</g>\n`;
  return svg;
}
