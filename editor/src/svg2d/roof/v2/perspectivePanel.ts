// V2 perspective (isometric) panel — projects the RoofSpec's 3D
// geometry onto a 30° isometric view as a STRUCTURAL FRAME: trusses,
// ring beam, tie beams, ridge/hip/valley + eave perimeter. The tile
// SHELL and the rafter/purlin surface layer are intentionally NOT
// drawn — this is the frame view. Self-contained SVG.
//
// Isometric projection formula (matches legacy `perspective.ts`):
//   iso_x = (x - y) * cos30
//   iso_y = z - (x + y) * sin30
//
// The result is then scaled to fit the panel and centered.
//
// With opts.dimensions, overall tape measurements are drawn ALONG the
// frame's own axes (width, length, ridge height + truss spacing) so a
// fabricator who doesn't read plans/sections can measure straight off
// the 3D picture.

import type { Point3D, RoofSpec, StraightMember } from "./model";
import { buildTrussMembers } from "./truss";
import { formatDimension } from "../../format";

const COS30 = Math.cos((30 * Math.PI) / 180);
const SIN30 = Math.sin((30 * Math.PI) / 180);
const DIM_COLOR = "#b91c1c";
const WIT_COLOR = "#e59aa0";

function iso(p: Point3D): [number, number] {
  return [(p[0] - p[1]) * COS30, p[2] - (p[0] + p[1]) * SIN30];
}

// Surface layer — a DIFFERENT layer, not part of this frame view.
const SURFACE_ROLES = new Set<StraightMember["role"]>(["rafter", "purlin"]);

// Stroke colour + width per frame member role.
const FRAME_STROKES: Partial<Record<StraightMember["role"], string>> = {
  ridge: "#3b1a05",
  hip: "#5a2e0b",
  valley: "#1e3a8a",
  ring_beam: "#166534",
  hip_beam: "#b45309",
  vent_strut: "#a16207",
  tie_beam: "#0369a1",
  truss_top_chord: "#7c3aed",
  truss_bottom_chord: "#6d28d9",
  truss_web: "#8b5cf6",
  pani_patti: "#9ca3af",
  eave_L_channel: "#6b7280",
  corner_double_angle: "#6b7280",
};
function frameWidth(role: StraightMember["role"]): number {
  if (role === "ridge") return 2.4;
  if (role === "ring_beam" || role === "hip" || role === "valley" || role === "tie_beam") return 2;
  if (role.startsWith("truss")) return 1.2;
  if (role === "pani_patti" || role === "eave_L_channel" || role === "corner_double_angle") return 1;
  return 1.6;
}

interface WLine { a: Point3D; b: Point3D; color: string; w: number; dash?: string; tick: boolean; }
interface WLabel { at: Point3D; text: string; }

// Build overall tape-measure dimensions along the frame's axes (world space,
// so they feed the panel's fit pass before scaling). Returns the dimension
// lines (+ witness lines) and their labels.
function buildFrameDimensions(spec: RoofSpec): { lines: WLine[]; labels: WLabel[] } {
  const lines: WLine[] = [];
  const labels: WLabel[] = [];

  const ring = spec.members.filter((m) => m.role === "ring_beam");
  const src = ring.length ? ring : spec.members;
  if (!src.length) return { lines, labels };

  let aX = Infinity, bX = -Infinity, aY = Infinity, bY = -Infinity, loZ = Infinity;
  for (const m of src) for (const p of [m.start, m.end]) {
    if (p[0] < aX) aX = p[0]; if (p[0] > bX) bX = p[0];
    if (p[1] < aY) aY = p[1]; if (p[1] > bY) bY = p[1];
    if (p[2] < loZ) loZ = p[2];
  }
  const baseZ = ring.length ? ring[0].start[2] : loZ;
  let apexZ = -Infinity;
  for (const m of spec.members) for (const p of [m.start, m.end]) if (p[2] > apexZ) apexZ = p[2];
  for (const t of spec.trusses) if (t.apex[2] > apexZ) apexZ = t.apex[2];
  if (!isFinite(apexZ)) apexZ = baseZ;

  const boxW = bX - aX, boxL = bY - aY, rise = apexZ - baseZ;
  const off = Math.max(0.12 * Math.max(boxW, boxL), 12);

  const addDim = (a: Point3D, b: Point3D, text: string) => {
    lines.push({ a, b, color: DIM_COLOR, w: 1, tick: true });
    labels.push({ at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], text });
  };
  const addWit = (a: Point3D, b: Point3D) =>
    lines.push({ a, b, color: WIT_COLOR, w: 0.5, dash: "3 2", tick: false });

  // WIDTH (X extent) along the front edge (y = aY), offset outward in -Y.
  {
    const dy = aY - off;
    addDim([aX, dy, baseZ], [bX, dy, baseZ], formatDimension(boxW));
    addWit([aX, aY, baseZ], [aX, dy, baseZ]);
    addWit([bX, aY, baseZ], [bX, dy, baseZ]);
  }
  // LENGTH (Y extent) along the left edge (x = aX), offset outward in -X.
  {
    const dx = aX - off;
    addDim([dx, aY, baseZ], [dx, bY, baseZ], formatDimension(boxL));
    addWit([aX, aY, baseZ], [dx, aY, baseZ]);
    addWit([aX, bY, baseZ], [dx, bY, baseZ]);
  }
  // RIDGE HEIGHT (rise, wall-top → ridge) — vertical at the front-left corner.
  {
    const cx = aX - off, cy = aY - off;
    addDim([cx, cy, baseZ], [cx, cy, apexZ], formatDimension(rise));
    addWit([aX, aY, baseZ], [cx, cy, baseZ]);
  }
  // TRUSS SPACING chain along the distribution axis, on the far (+) side.
  if (spec.trusses.length > 1) {
    const cen = spec.trusses.map((t): [number, number] => [
      (t.bottom_left[0] + t.bottom_right[0]) / 2,
      (t.bottom_left[1] + t.bottom_right[1]) / 2,
    ]);
    const spanX = Math.max(...cen.map((c) => c[0])) - Math.min(...cen.map((c) => c[0]));
    const spanY = Math.max(...cen.map((c) => c[1])) - Math.min(...cen.map((c) => c[1]));
    const axis: 0 | 1 = spanX >= spanY ? 0 : 1;
    const pos = cen.map((c) => c[axis]).sort((p, q) => p - q);
    if (axis === 1) {
      const dx = bX + off;
      const marks = [aY, ...pos, bY];
      for (let i = 0; i + 1 < marks.length; i++) {
        const g = Math.abs(marks[i + 1] - marks[i]);
        if (g < 0.5) continue;
        addDim([dx, marks[i], baseZ], [dx, marks[i + 1], baseZ], formatDimension(g));
      }
      for (const mk of marks) addWit([bX, mk, baseZ], [dx, mk, baseZ]);
    } else {
      const dy = bY + off;
      const marks = [aX, ...pos, bX];
      for (let i = 0; i + 1 < marks.length; i++) {
        const g = Math.abs(marks[i + 1] - marks[i]);
        if (g < 0.5) continue;
        addDim([marks[i], dy, baseZ], [marks[i + 1], dy, baseZ], formatDimension(g));
      }
      for (const mk of marks) addWit([mk, bY, baseZ], [mk, dy, baseZ]);
    }
  }

  return { lines, labels };
}

export function v2PerspectivePanel(
  x0: number,
  y0: number,
  width: number,
  height: number,
  spec: RoofSpec,
  opts: { title?: string; wallTopZ?: number; groundZ?: number; dimensions?: boolean } = {},
): string {
  const doDim = opts.dimensions === true;
  const titleH = opts.title ? 40 : 0;
  const innerPad = doDim ? 40 : 20;
  const drawW = width - 2 * innerPad;
  const drawH = height - titleH - 2 * innerPad;

  const dim = doDim ? buildFrameDimensions(spec) : { lines: [], labels: [] };

  // Compute iso bounds of all planes + members (+ dimension lines).
  let minIx = Infinity, maxIx = -Infinity;
  let minIy = Infinity, maxIy = -Infinity;
  const consider = (p: Point3D) => {
    const [ix, iy] = iso(p);
    if (ix < minIx) minIx = ix;
    if (ix > maxIx) maxIx = ix;
    if (iy < minIy) minIy = iy;
    if (iy > maxIy) maxIy = iy;
  };
  for (const p of spec.planes) for (const v of p.vertices) consider(v);
  for (const m of spec.members) { consider(m.start); consider(m.end); }
  for (const wl of dim.lines) { consider(wl.a); consider(wl.b); }
  if (!isFinite(minIx)) return "";

  const isoW = maxIx - minIx || 1;
  const isoH = maxIy - minIy || 1;
  const scale = Math.min(drawW / isoW, drawH / isoH);
  const offX = x0 + innerPad + (drawW - isoW * scale) / 2 - minIx * scale;
  const offY = y0 + titleH + innerPad + (drawH - isoH * scale) / 2 - minIy * scale;
  const toSvg = (p: Point3D): [number, number] => {
    const [ix, iy] = iso(p);
    // SVG y grows downward → invert iso_y by using (maxIy - iy) span.
    return [offX + ix * scale, offY + (maxIy - iy + minIy) * scale];
  };

  let svg = `<g id="v2-perspective" transform="translate(0,0)">\n`;
  svg += `<rect x="${x0}" y="${y0}" width="${width}" height="${height}" fill="#fdfcfa" stroke="#333" stroke-width="1"/>\n`;
  if (opts.title) {
    svg += `<text x="${x0 + width / 2}" y="${y0 + 24}" text-anchor="middle" font-size="14" font-weight="bold" fill="#222">${opts.title}</text>\n`;
  }

  const line = (m: StraightMember): string => {
    const [x1, y1] = toSvg(m.start);
    const [x2, y2] = toSvg(m.end);
    const stroke = FRAME_STROKES[m.role] ?? "#475569";
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="${frameWidth(m.role)}" stroke-linecap="round"/>\n`;
  };

  // Frame members — everything except the rafter/purlin surface layer
  // and the tile shell. Trusses (below) draw on top.
  for (const m of spec.members) {
    if (SURFACE_ROLES.has(m.role)) continue;
    svg += line(m);
  }

  // Trusses — expand each triangle to its chord/web members.
  for (const t of spec.trusses) {
    const members = t.members ?? buildTrussMembers(t);
    for (const m of members) svg += line(m);
  }

  // Dimensions — drawn on top of the frame.
  if (doDim) {
    const pc: [number, number] = [x0 + width / 2, y0 + height / 2];
    for (const wl of dim.lines) {
      const [x1, y1] = toSvg(wl.a);
      const [x2, y2] = toSvg(wl.b);
      svg += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${wl.color}" stroke-width="${wl.w}"${wl.dash ? ` stroke-dasharray="${wl.dash}"` : ""} stroke-linecap="round"/>\n`;
      if (wl.tick) {
        let ux = x2 - x1, uy = y2 - y1;
        const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
        const px = -uy * 4, py = ux * 4;
        for (const [tx, ty] of [[x1, y1], [x2, y2]] as const) {
          svg += `<line x1="${(tx - px).toFixed(2)}" y1="${(ty - py).toFixed(2)}" x2="${(tx + px).toFixed(2)}" y2="${(ty + py).toFixed(2)}" stroke="${wl.color}" stroke-width="${wl.w}"/>\n`;
        }
      }
    }
    for (const lb of dim.labels) {
      const [mx, my] = toSvg(lb.at);
      let dx = mx - pc[0], dy = my - pc[1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const lx = mx + dx * 12, ly = my + dy * 12;
      svg += `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${DIM_COLOR}" paint-order="stroke" stroke="#fdfcfa" stroke-width="3" stroke-linejoin="round">${lb.text}</text>\n`;
    }

    // Per-member cut lengths — the TRUE length of each central-ridge segment
    // and each hip (and valley), labelled along the member. These are cut
    // lengths, so every member is labelled even when several are identical.
    for (const m of spec.members) {
      if (m.role !== "ridge" && m.role !== "hip" && m.role !== "valley") continue;
      const L = Math.hypot(m.end[0] - m.start[0], m.end[1] - m.start[1], m.end[2] - m.start[2]);
      if (L < 1) continue;
      const [x1, y1] = toSvg(m.start);
      const [x2, y2] = toSvg(m.end);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      let deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      if (deg > 90) deg -= 180; else if (deg < -90) deg += 180;
      // Nudge the label off the member line, toward the top of the drawing.
      let nx = -(y2 - y1), ny = x2 - x1;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const lx = mx + nx * 8, ly = my + ny * 8;
      const col = FRAME_STROKES[m.role] ?? "#334155";
      svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="600" fill="${col}" paint-order="stroke" stroke="#fdfcfa" stroke-width="3" stroke-linejoin="round" transform="rotate(${deg.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${formatDimension(L)}</text>\n`;
    }

    // Legend — clarify the units + that these are the numbers to measure.
    svg += `<text x="${(x0 + 12).toFixed(1)}" y="${(y0 + height - 12).toFixed(1)}" text-anchor="start" font-size="9" fill="#b91c1c">red = overall (width × length × ridge height) + truss spacing · brown = ridge &amp; hip cut lengths</text>\n`;
  }

  svg += `</g>\n`;
  return svg;
}
