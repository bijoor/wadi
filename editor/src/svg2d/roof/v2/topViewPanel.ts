// V2 top-view panel — renders a RoofSpec as a top-down SVG.
//
// This is the first end-to-end panel driven purely by RoofSpec.
// It proves the data model (planes + members + trusses) is
// self-sufficient for SVG generation, and replaces the legacy
// topView.ts's ~440-line switch on roof type with one code path
// that handles flat, shed, pitched (gable + hip + dutch), and any
// multi-segment combination — automatically.
//
// The panel is intentionally simple: filled polygons for planes,
// colored lines for members, tick marks for trusses. The ridge run is
// called out on the ridge line (the number builders look for first).

import type { MemberRole, RoofPlane, RoofSpec, StraightMember, TrussTriangle } from "./model";
import { formatDimension } from "../../format";

// Key-plan markers: where each OTHER roof view/detail is taken. Drawn over the
// top view so it indexes the section, eave-detail, and face drawings.
export interface TopViewMarkers {
  sections: Array<{ label: string; axis: "x" | "y"; coord: number }>;
  eaves: Array<{ sides: string[]; label: string }>;   // one per distinct eave
  faces: Array<{ label: string; planeIds: string[] }>; // F1.. per unique face
}

export interface RenderTopViewOptions {
  width: number;         // panel width in SVG units (pixels)
  height: number;        // panel height
  padding?: number;      // margin around content (default 20)
  title?: string;        // optional panel title bar
  showLegend?: boolean;  // show member-role color legend (default true)
  markers?: TopViewMarkers; // section / eave / face callouts (key plan)
}

const PLANE_FILL: Record<string, string> = {
  slope: "#bae6fd",       // sky-200
  hip_face: "#fed7aa",     // orange-200
  gable_wall: "#d9f99d",   // lime-200
  parapet: "#fde68a",       // amber-200
  flat_slab: "#bae6fd",     // sky-200
};

const MEMBER_STROKE: Record<string, string> = {
  ridge: "#dc2626",         // red-600
  hip: "#ea580c",           // orange-600
  valley: "#2563eb",        // blue-600
  ring_beam: "#16a34a",     // green-600
  rafter: "#94a3b8",        // slate-400
  purlin: "#cbd5e1",        // slate-300
  tie_beam: "#0ea5e9",      // sky-500 — wall-top tie
  hip_beam: "#eab308",      // yellow-500
  parapet_cap: "#d97706",   // amber-600
};

const LEGEND_ORDER: Array<[string, string]> = [
  ["ridge", "Ridge"],
  ["hip", "Hip"],
  ["valley", "Valley"],
  ["ring_beam", "Ring beam"],
];

interface Bounds {
  x_min: number; x_max: number; y_min: number; y_max: number;
}

// Compute the world-space bounding box from all planes + members.
export function computeSpecBounds(spec: RoofSpec): Bounds | null {
  let x_min = Infinity, x_max = -Infinity, y_min = Infinity, y_max = -Infinity;
  const touch = (x: number, y: number) => {
    if (x < x_min) x_min = x;
    if (x > x_max) x_max = x;
    if (y < y_min) y_min = y;
    if (y > y_max) y_max = y;
  };
  for (const p of spec.planes) for (const v of p.vertices) touch(v[0], v[1]);
  for (const m of spec.members) {
    touch(m.start[0], m.start[1]);
    touch(m.end[0], m.end[1]);
  }
  for (const t of spec.trusses) {
    touch(t.apex[0], t.apex[1]);
    touch(t.bottom_left[0], t.bottom_left[1]);
    touch(t.bottom_right[0], t.bottom_right[1]);
  }
  if (!Number.isFinite(x_min)) return null;
  return { x_min, x_max, y_min, y_max };
}

// Fit-to-panel transform: takes world (x, y) and returns svg (x, y).
function makeTransform(
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
  titleH: number,
): (x: number, y: number) => [number, number] {
  const worldW = bounds.x_max - bounds.x_min;
  const worldH = bounds.y_max - bounds.y_min;
  const availW = Math.max(1, width - 2 * padding);
  const availH = Math.max(1, height - titleH - 2 * padding);
  const scale = Math.min(availW / Math.max(worldW, 1e-6), availH / Math.max(worldH, 1e-6));
  const contentW = worldW * scale;
  const contentH = worldH * scale;
  const offX = padding + (availW - contentW) / 2;
  const offY = titleH + padding + (availH - contentH) / 2;
  return (x, y) => [offX + (x - bounds.x_min) * scale, offY + (y - bounds.y_min) * scale];
}

function polygonPoints(
  plane: RoofPlane,
  toSvg: (x: number, y: number) => [number, number],
): string {
  return plane.vertices
    .map((v) => {
      const [sx, sy] = toSvg(v[0], v[1]);
      return `${sx.toFixed(1)},${sy.toFixed(1)}`;
    })
    .join(" ");
}

function planeSvg(
  plane: RoofPlane,
  toSvg: (x: number, y: number) => [number, number],
): string {
  const fill = PLANE_FILL[plane.role] ?? "#e5e7eb";
  const opacity = plane.role === "gable_wall" || plane.role === "hip_face" ? 0.45 : 0.65;
  return `<polygon points="${polygonPoints(plane, toSvg)}" fill="${fill}" fill-opacity="${opacity}" stroke="#475569" stroke-width="0.5" />`;
}

function memberSvg(
  member: StraightMember,
  toSvg: (x: number, y: number) => [number, number],
): string {
  const [x1, y1] = toSvg(member.start[0], member.start[1]);
  const [x2, y2] = toSvg(member.end[0], member.end[1]);
  const stroke = MEMBER_STROKE[member.role] ?? "#64748b";
  const width =
    member.role === "ridge" || member.role === "valley" ? 2 :
    member.role === "rafter" || member.role === "purlin" ? 0.4 :
    member.role === "tie_beam" ? 1.4 :
    1;
  const dash =
    member.role === "valley" ? " stroke-dasharray=\"4,3\"" :
    member.role === "hip" ? " stroke-dasharray=\"6,2\"" :
    member.role === "tie_beam" ? " stroke-dasharray=\"3,3\"" : "";
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${width}"${dash} />`;
}

function trussSvg(
  truss: TrussTriangle,
  toSvg: (x: number, y: number) => [number, number],
): string {
  const [lx, ly] = toSvg(truss.bottom_left[0], truss.bottom_left[1]);
  const [rx, ry] = toSvg(truss.bottom_right[0], truss.bottom_right[1]);
  return `<line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${rx.toFixed(1)}" y2="${ry.toFixed(1)}" stroke="#7c3aed" stroke-width="1.2" stroke-dasharray="2,2" />`;
}

function legendSvg(x: number, y: number): string {
  const lines: string[] = [];
  lines.push(`<g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">`);
  lines.push(`<rect x="0" y="0" width="110" height="${(LEGEND_ORDER.length * 14 + 8).toString()}" fill="#ffffff" fill-opacity="0.9" stroke="#cbd5e1" stroke-width="0.5" />`);
  let yy = 6;
  for (const [role, label] of LEGEND_ORDER) {
    yy += 10;
    const color = MEMBER_STROKE[role] ?? "#64748b";
    lines.push(`<line x1="8" y1="${yy}" x2="30" y2="${yy}" stroke="${color}" stroke-width="2" />`);
    lines.push(`<text x="36" y="${yy + 3}" font-size="9" fill="#334155">${label}</text>`);
  }
  lines.push(`</g>`);
  return lines.join("");
}

// A section-marker bubble: a white disc with the section letter.
function sectionBubble(x: number, y: number, letter: string, color: string): string {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#ffffff" stroke="${color}" stroke-width="1.4" />` +
    `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${color}">${escapeXml(letter)}</text>`;
}

// An eave-detail callout: a filled disc with the compass side letter + a label.
function detailMarker(x: number, y: number, side: string, text: string, color: string, flip: boolean): string {
  const tx = flip ? x - 12 : x + 12;
  const anchor = flip ? "end" : "start";
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${color}" stroke="#ffffff" stroke-width="1" />` +
    `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#ffffff">${escapeXml(side)}</text>` +
    `<text x="${tx.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" font-size="9" font-weight="600" fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${escapeXml(text)}</text>` +
    `<text x="${tx.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" font-size="9" font-weight="600" fill="${color}">${escapeXml(text)}</text>`;
}

// A roof-face badge (F1..) with a white halo so it reads over the plane fill.
function faceTag(x: number, y: number, label: string): string {
  const common = `x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800"`;
  return `<text ${common} fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round">${escapeXml(label)}</text>` +
    `<text ${common} fill="#334155">${escapeXml(label)}</text>`;
}

// Centroid (average vertex) of a plane polygon, in world XY.
function polyCentroid(verts: ReadonlyArray<ReadonlyArray<number>>): [number, number] {
  let sx = 0, sy = 0;
  for (const v of verts) { sx += v[0]; sy += v[1]; }
  const n = verts.length || 1;
  return [sx / n, sy / n];
}

export function renderTopViewPanel(
  spec: RoofSpec,
  opts: RenderTopViewOptions,
): string {
  const { width, height } = opts;
  const padding = opts.padding ?? 20;
  const titleH = opts.title ? 24 : 0;
  const bounds = computeSpecBounds(spec);

  const body: string[] = [];
  body.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  body.push(`<rect width="${width}" height="${height}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />`);

  if (opts.title) {
    body.push(`<rect x="0" y="0" width="${width}" height="${titleH}" fill="#e2e8f0" />`);
    body.push(`<text x="${(width / 2).toFixed(1)}" y="${(titleH / 2 + 5).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="#1e293b">${escapeXml(opts.title)}</text>`);
  }

  if (bounds) {
    const toSvg = makeTransform(bounds, width, height, padding, titleH);
    // Draw order: planes first (background), then members (foreground),
    // then truss ticks. Only prominent structural members render at
    // top-view scale — eave border strips (pani_patti / L-channel /
    // corner angle) sit ON the polygon edges we've already drawn and
    // would just add visual noise here.
    for (const p of spec.planes) body.push(planeSvg(p, toSvg));
    // Members drawn in Z-order so structural spine (ridge/hip/valley/
    // ring beam) sits ON TOP of the finer surface members (rafters,
    // purlins). Otherwise rafters cross the ridge lines visually.
    const surfaceOrder: MemberRole[] = ["rafter", "purlin", "tie_beam"];
    const spineOrder: MemberRole[] = ["ring_beam", "hip", "valley", "ridge"];
    for (const role of surfaceOrder) {
      for (const m of spec.members) {
        if (m.role === role) body.push(memberSvg(m, toSvg));
      }
    }
    for (const role of spineOrder) {
      for (const m of spec.members) {
        if (m.role === role) body.push(memberSvg(m, toSvg));
      }
    }
    for (const t of spec.trusses) body.push(trussSvg(t, toSvg));
    // Ridge length callout — the overall ridge run is the number builders
    // look for first, and it was previously only on the slope face panel.
    // Label each ridge member on the plan, along the line, with a white
    // halo so it reads over the red ridge stroke and the sky-blue slope.
    for (const m of spec.members) {
      if (m.role !== "ridge") continue;
      const lenW = Math.hypot(m.end[0] - m.start[0], m.end[1] - m.start[1]);
      if (lenW < 1) continue;
      const [x1, y1] = toSvg(m.start[0], m.start[1]);
      const [x2, y2] = toSvg(m.end[0], m.end[1]);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      let dx = x2 - x1, dy = y2 - y1;
      const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const lx = mx - dy * 11, ly = my + dx * 11; // nudge perpendicular to the ridge
      let deg = Math.atan2(dy, dx) * 180 / Math.PI;
      if (deg > 90) deg -= 180; else if (deg < -90) deg += 180;
      // White halo drawn as a separate stroke-only text BEHIND the fill (not
      // paint-order:stroke — svg2pdf ignores that and would hide the label in
      // the PDF export by painting the halo over the glyph).
      const ridgeCommon =
        `x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" ` +
        `font-size="10" font-weight="700" transform="rotate(${deg.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})"`;
      const ridgeLabel = `ridge ${escapeXml(formatDimension(lenW))}`;
      body.push(`<text ${ridgeCommon} fill="none" stroke="#ffffff" stroke-width="3" stroke-linejoin="round">${ridgeLabel}</text>`);
      body.push(`<text ${ridgeCommon} fill="#b91c1c">${ridgeLabel}</text>`);
    }

    // --- Key-plan markers: index every OTHER roof drawing on this plan ---
    if (opts.markers) {
      const mk = opts.markers;
      const cx = (bounds.x_min + bounds.x_max) / 2;
      const cy = (bounds.y_min + bounds.y_max) / 2;
      const spanX = bounds.x_max - bounds.x_min || 1;
      const spanY = bounds.y_max - bounds.y_min || 1;
      const SECT = "#7c3aed", EAVE = "#0e7490";

      // Section cut lines (A-A, B-B) — a dash-dot line spanning the roof with a
      // bubble + letter at each end.
      for (const s of mk.sections) {
        const p1 = s.axis === "x" ? toSvg(s.coord, bounds.y_min) : toSvg(bounds.x_min, s.coord);
        const p2 = s.axis === "x" ? toSvg(s.coord, bounds.y_max) : toSvg(bounds.x_max, s.coord);
        let ux = p2[0] - p1[0], uy = p2[1] - p1[1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
        const e1: [number, number] = [p1[0] - ux * 18, p1[1] - uy * 18];
        const e2: [number, number] = [p2[0] + ux * 18, p2[1] + uy * 18];
        body.push(`<line x1="${e1[0].toFixed(1)}" y1="${e1[1].toFixed(1)}" x2="${e2[0].toFixed(1)}" y2="${e2[1].toFixed(1)}" stroke="${SECT}" stroke-width="1.3" stroke-dasharray="12 3 3 3" />`);
        body.push(sectionBubble(e1[0], e1[1], s.label, SECT));
        body.push(sectionBubble(e2[0], e2[1], s.label, SECT));
      }

      // Eave detail callouts on each compass side the eave occurs.
      for (const e of mk.eaves) {
        for (const side of e.sides) {
          let wx = cx, wy = cy;
          if (side === "N") { wy = bounds.y_min + spanY * 0.05; }
          else if (side === "S") { wy = bounds.y_max - spanY * 0.05; }
          else if (side === "W") { wx = bounds.x_min + spanX * 0.05; }
          else if (side === "E") { wx = bounds.x_max - spanX * 0.05; }
          const [sx, sy] = toSvg(wx, wy);
          const flip = side === "E"; // keep the text inside the panel on the right edge
          body.push(detailMarker(sx, sy, side, `${e.label} eave`, EAVE, flip));
        }
      }

      // Roof-face labels (F1..) at the centroid of every plane in the group.
      for (const f of mk.faces) {
        for (const id of f.planeIds) {
          const pl = spec.planes.find((p) => p.id === id);
          if (!pl) continue;
          const [cxw, cyw] = polyCentroid(pl.vertices);
          const [fx, fy] = toSvg(cxw, cyw);
          body.push(faceTag(fx, fy, f.label));
        }
      }

      // Compact key at the bottom-left.
      body.push(`<text x="10" y="${(height - 8).toFixed(1)}" font-size="9" fill="#475569"><tspan fill="${SECT}" font-weight="700">A</tspan>–A section cut · <tspan fill="${EAVE}" font-weight="700">●</tspan> eave detail · <tspan fill="#334155" font-weight="800">F#</tspan> roof face</text>`);
    }
  } else {
    body.push(`<text x="${(width / 2).toFixed(1)}" y="${(height / 2).toFixed(1)}" text-anchor="middle" font-size="11" fill="#94a3b8">(empty roof spec)</text>`);
  }

  if (opts.showLegend !== false && bounds) {
    body.push(legendSvg(width - 118, titleH + 6));
  }

  body.push(`</svg>`);
  return body.join("\n");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
