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

// A dimension label with a white "halo" for legibility over the frame lines.
// Emitted as TWO stacked <text> elements — white stroke behind, coloured fill on
// top — NOT via paint-order:stroke. svg2pdf (the PDF export) ignores paint-order
// and paints the halo stroke OVER the glyph, so a paint-order label renders
// white-on-white (invisible) in the PDF. Stacking two texts respects painter
// order and works in the browser, the raster, and the PDF alike.
function haloText(
  x: number,
  y: number,
  text: string,
  opts: { fill: string; size?: number; weight?: number; middle?: boolean; rotate?: number; halo?: number },
): string {
  const size = opts.size ?? 10;
  const weight = opts.weight ?? 600;
  const halo = opts.halo ?? 3;
  const xf = x.toFixed(1), yf = y.toFixed(1);
  const rot = opts.rotate != null ? ` transform="rotate(${opts.rotate.toFixed(1)} ${xf} ${yf})"` : "";
  const mid = opts.middle ? ` dominant-baseline="middle"` : "";
  const base = `x="${xf}" y="${yf}" text-anchor="middle"${mid} font-size="${size}" font-weight="${weight}"${rot}`;
  return (
    `<text ${base} fill="none" stroke="#fdfcfa" stroke-width="${halo}" stroke-linejoin="round">${text}</text>\n` +
    `<text ${base} fill="${opts.fill}">${text}</text>\n`
  );
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
      svg += haloText(lx, ly + 3, lb.text, { fill: DIM_COLOR, size: 11, weight: 700 });
    }

    // Per-SEGMENT cut lengths on the ridge / hips / valleys. A ridge/hip is
    // one member, but a fabricator welds it in segments between the STRUCTURAL
    // nodes that land on it: truss apexes where the RIDGE is spliced, and the
    // wall (ring-beam) corner where a HIP bears — which splits the hip into its
    // structural run (apex→wall) and its overhang (wall→eave tip). We split at
    // those major nodes and label each sub-segment's true length, with a
    // division tick at each node.
    const majorEnds: Point3D[] = [];
    for (const t of spec.trusses) majorEnds.push(t.apex);
    for (const mm of spec.members) {
      if (mm.role === "ridge" || mm.role === "hip" || mm.role === "valley"
        || mm.role === "ring_beam") {
        majorEnds.push(mm.start); majorEnds.push(mm.end);
      }
    }
    // Interior split parameters t∈(0,1) where a major node lands on member m.
    const segNodes = (m: StraightMember): number[] => {
      const d: Point3D = [m.end[0] - m.start[0], m.end[1] - m.start[1], m.end[2] - m.start[2]];
      const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
      const len = Math.sqrt(len2);
      if (len < 1e-6) return [0, 1];
      const raw: number[] = [];
      for (const p of majorEnds) {
        const t = ((p[0] - m.start[0]) * d[0] + (p[1] - m.start[1]) * d[1] + (p[2] - m.start[2]) * d[2]) / len2;
        if (t <= 0.02 || t >= 0.98) continue;
        const proj: Point3D = [m.start[0] + t * d[0], m.start[1] + t * d[1], m.start[2] + t * d[2]];
        if (Math.hypot(p[0] - proj[0], p[1] - proj[1], p[2] - proj[2]) < 1.0) raw.push(t);
      }
      raw.sort((a, b) => a - b);
      const mid: number[] = [];
      for (const t of raw) if (!mid.length || (t - mid[mid.length - 1]) * len > 2) mid.push(t);
      return [0, ...mid, 1];
    };

    const lerp = (a: Point3D, b: Point3D, t: number): Point3D =>
      [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

    for (const m of spec.members) {
      if (m.role !== "ridge" && m.role !== "hip" && m.role !== "valley") continue;
      const L = Math.hypot(m.end[0] - m.start[0], m.end[1] - m.start[1], m.end[2] - m.start[2]);
      if (L < 1) continue;
      const col = FRAME_STROKES[m.role] ?? "#334155";
      const nodes = segNodes(m);
      // Division ticks at interior nodes.
      for (let k = 1; k < nodes.length - 1; k++) {
        const [nx0, ny0] = toSvg(lerp(m.start, m.end, nodes[k]));
        const [ex, ey] = toSvg(m.end); const [sx, sy] = toSvg(m.start);
        let ux = ex - sx, uy = ey - sy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
        svg += `<line x1="${(nx0 + uy * 4).toFixed(1)}" y1="${(ny0 - ux * 4).toFixed(1)}" x2="${(nx0 - uy * 4).toFixed(1)}" y2="${(ny0 + ux * 4).toFixed(1)}" stroke="${col}" stroke-width="1.2"/>\n`;
      }
      // One label per sub-segment.
      for (let k = 0; k + 1 < nodes.length; k++) {
        const segLen = (nodes[k + 1] - nodes[k]) * L;
        if (segLen < 1) continue;
        const [x1, y1] = toSvg(lerp(m.start, m.end, nodes[k]));
        const [x2, y2] = toSvg(lerp(m.start, m.end, nodes[k + 1]));
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        let deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        if (deg > 90) deg -= 180; else if (deg < -90) deg += 180;
        let nx = -(y2 - y1), ny = x2 - x1;
        const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        if (ny > 0) { nx = -nx; ny = -ny; }
        const lx = mx + nx * 8, ly = my + ny * 8;
        svg += haloText(lx, ly, formatDimension(segLen), { fill: col, size: 10, weight: 600, middle: true, rotate: deg });
      }
    }

    // Eave length + overhang offset from the wall, for the two FRONT
    // (viewer-facing) eaves. The eave line is the pani-patti strip; the wall
    // is the ring beam. Overhang = the horizontal gap between them.
    const eaves = spec.members.filter((m) => m.role === "pani_patti");
    if (eaves.length) {
      let rminX = Infinity, rmaxX = -Infinity, rminY = Infinity, rmaxY = -Infinity, wallTopZ = -Infinity;
      for (const m of spec.members) if (m.role === "ring_beam") for (const p of [m.start, m.end]) {
        if (p[0] < rminX) rminX = p[0]; if (p[0] > rmaxX) rmaxX = p[0];
        if (p[1] < rminY) rminY = p[1]; if (p[1] > rmaxY) rmaxY = p[1];
        if (p[2] > wallTopZ) wallTopZ = p[2];
      }
      // Overhang is measured to the WALL OUTER FACE, not the ring centreline, so
      // the isometric agrees with the top view + eave cross-section (both use
      // eavePanel.groupEaves, which grows the ring box by half the wall). The
      // ring beam sits on the wall centreline; grow the box by half the wall so
      // the same eave does not read half-a-wall longer here than everywhere else.
      const halfWall = (spec.framing?.wall_thickness_u ?? 0) / 2;
      rminX -= halfWall; rmaxX += halfWall; rminY -= halfWall; rmaxY += halfWall;
      const cx0 = (rminX + rmaxX) / 2, cy0 = (rminY + rmaxY) / 2;
      // Two front eaves = largest midpoint (x+y) → nearest the viewer in iso.
      const front = eaves
        .map((m) => ({ m, key: (m.start[0] + m.end[0]) / 2 + (m.start[1] + m.end[1]) / 2 }))
        .sort((a, b) => b.key - a.key).slice(0, 2).map((s) => s.m);
      const EAVE = "#0e7490";
      for (const m of front) {
        const L = Math.hypot(m.end[0] - m.start[0], m.end[1] - m.start[1], m.end[2] - m.start[2]);
        // --- Eave length label, along the eave, nudged toward the interior. ---
        const [x1, y1] = toSvg(m.start), [x2, y2] = toSvg(m.end);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        let deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
        if (deg > 90) deg -= 180; else if (deg < -90) deg += 180;
        let tx = mx - pc[0], ty = my - pc[1]; const tl = Math.hypot(tx, ty) || 1;
        const lx = mx - (tx / tl) * 12, ly = my - (ty / tl) * 12;
        svg += haloText(lx, ly, `eave ${formatDimension(L)}`, { fill: EAVE, size: 10, weight: 700, middle: true, rotate: deg });

        // --- Overhang: horizontal gap from the eave to the wall face. ---
        const vertical = Math.abs(m.start[0] - m.end[0]) < 1; // constant X → runs along Y
        const s = lerp(m.start, m.end, 0.28);
        let inward: Point3D, oh: number;
        if (vertical) {
          const X = m.start[0]; const wallX = X > cx0 ? rmaxX : rminX; oh = Math.abs(X - wallX);
          inward = [wallX, s[1], s[2]];
        } else {
          const Y = m.start[1]; const wallY = Y > cy0 ? rmaxY : rminY; oh = Math.abs(Y - wallY);
          inward = [s[0], wallY, s[2]];
        }
        const [ex, ey] = toSvg(s), [ix, iy] = toSvg(inward);
        svg += `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${ix.toFixed(1)}" y2="${iy.toFixed(1)}" stroke="${EAVE}" stroke-width="1"/>\n`;
        for (const [tx2, ty2] of [[ex, ey], [ix, iy]] as const) {
          let ux = ix - ex, uy = iy - ey; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
          svg += `<line x1="${(tx2 - uy * 3).toFixed(1)}" y1="${(ty2 + ux * 3).toFixed(1)}" x2="${(tx2 + uy * 3).toFixed(1)}" y2="${(ty2 - ux * 3).toFixed(1)}" stroke="${EAVE}" stroke-width="1"/>\n`;
        }
        // Witness up the wall face so the overhang clearly references the wall.
        const [wx, wy] = toSvg([inward[0], inward[1], wallTopZ]);
        svg += `<line x1="${ix.toFixed(1)}" y1="${iy.toFixed(1)}" x2="${wx.toFixed(1)}" y2="${wy.toFixed(1)}" stroke="${EAVE}" stroke-width="0.5" stroke-dasharray="2 2"/>\n`;
        const omx = (ex + ix) / 2, omy = (ey + iy) / 2;
        svg += haloText(omx, omy - 4, `↤ ${formatDimension(oh)}`, { fill: EAVE, size: 9, weight: 600, halo: 2.5 });
      }
    }

    // Legend — clarify the units + that these are the numbers to measure.
    svg += `<text x="${(x0 + 12).toFixed(1)}" y="${(y0 + height - 12).toFixed(1)}" text-anchor="start" font-size="9" fill="#b91c1c">red = overall + truss spacing · brown = ridge &amp; hip segments · <tspan fill="#0e7490">teal = front eave length + overhang from wall</tspan></text>\n`;
  }

  svg += `</g>\n`;
  return svg;
}
