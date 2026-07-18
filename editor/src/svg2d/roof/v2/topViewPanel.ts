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
// colored lines for members, tick marks for trusses. It's not
// dimensioned (that comes with the full panel port).

import type { MemberRole, RoofPlane, RoofSpec, StraightMember, TrussTriangle } from "./model";

export interface RenderTopViewOptions {
  width: number;         // panel width in SVG units (pixels)
  height: number;        // panel height
  padding?: number;      // margin around content (default 20)
  title?: string;        // optional panel title bar
  showLegend?: boolean;  // show member-role color legend (default true)
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
    1;
  const dash =
    member.role === "valley" ? " stroke-dasharray=\"4,3\"" :
    member.role === "hip" ? " stroke-dasharray=\"6,2\"" : "";
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
    const surfaceOrder: MemberRole[] = ["rafter", "purlin"];
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
