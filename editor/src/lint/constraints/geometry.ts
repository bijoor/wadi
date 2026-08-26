// Shared plan-geometry helpers for the structural constraints (C2/C6/C7).
//
// Moved verbatim out of structural.ts during the P2 migration so each constraint
// file can consume exactly the pieces it needs. These are the bespoke helpers
// the legacy linter used; over time some will be replaced by ctx.model queries,
// but they are kept as-is now to preserve byte-identical findings.

import type { Side } from "../../estimate/wallArea";
import { openingStartOffset, type OpeningAnchor } from "../../svg2d/openingAnchor";
import { num, objLabel, activeObjects, type Bag } from "./vocab";

export type { Side };
export const ALL_SIDES: Side[] = ["north", "south", "east", "west"];

// A room shows exactly the walls it declares; a room with NO `walls` field is
// enclosed on all four sides.
export function declaredSides(walls: unknown): "all" | Set<Side> {
  if (walls == null) return "all";
  if (Array.isArray(walls)) return new Set(walls as Side[]);
  if (typeof walls === "object") return new Set(Object.keys(walls as object) as Side[]);
  return "all";
}

// An axis-aligned wall segment: a line (horizontal or vertical) at `at`, spanning
// [lo, hi] along the other axis.
export interface Seg {
  horiz: boolean;
  at: number;
  lo: number;
  hi: number;
}
export function sideSegment(x: number, y: number, w: number, l: number, side: Side): Seg {
  if (side === "north") return { horiz: true, at: y, lo: x, hi: x + w };
  if (side === "south") return { horiz: true, at: y + l, lo: x, hi: x + w };
  if (side === "west") return { horiz: false, at: x, lo: y, hi: y + l };
  return { horiz: false, at: x + w, lo: y, hi: y + l }; // east
}

// Every wall segment present in the config: each room's DECLARED sides and every
// standalone wall.
export function collectWallSegments(floors: Bag[]): Seg[] {
  const segs: Seg[] = [];
  for (const fl of floors) {
    for (const o of activeObjects(fl)) {
      if (o.type === "room") {
        const declared = declaredSides(o.walls);
        const sides: Side[] = declared === "all" ? ALL_SIDES : [...declared];
        const x = num(o.x), y = num(o.y), w = num(o.width), l = num(o.length);
        for (const s of sides) segs.push(sideSegment(x, y, w, l, s));
      } else if (o.type === "wall") {
        const sx = num(o.start_x), sy = num(o.start_y), ex = num(o.end_x), ey = num(o.end_y);
        if (Math.abs(sy - ey) < 1) segs.push({ horiz: true, at: sy, lo: Math.min(sx, ex), hi: Math.max(sx, ex) });
        else if (Math.abs(sx - ex) < 1) segs.push({ horiz: false, at: sx, lo: Math.min(sy, ey), hi: Math.max(sy, ey) });
      }
    }
  }
  return segs;
}

// Is there already a wall on this side's line, covering it?
export function sideHasWall(segs: Seg[], seg: Seg): boolean {
  for (const s of segs) {
    if (s.horiz !== seg.horiz) continue;
    if (Math.abs(s.at - seg.at) > 1.5) continue;
    if (Math.min(s.hi, seg.hi) - Math.max(s.lo, seg.lo) > 2) return true;
  }
  return false;
}

// ---- C6/C7 geometry helpers ------------------------------------------------

// One opening, projected onto its wall's world line.
export interface OpSeg {
  horiz: boolean;
  at: number;
  lo: number;
  hi: number;
  owner: string;
  label: string;
}
function openLabel(op: Bag): string {
  const kind = typeof op.kind === "string" ? op.kind : "opening";
  const nm = typeof op.name === "string" && op.name ? ` "${op.name}"` : "";
  return `${kind}${nm}`;
}
export function collectOpeningSegs(objs: Bag[]): OpSeg[] {
  const out: OpSeg[] = [];
  for (const o of objs) {
    if (o.type === "room") {
      const walls = o.walls;
      if (!walls || typeof walls !== "object" || Array.isArray(walls)) continue;
      const rx = num(o.x), ry = num(o.y), rw = num(o.width), rl = num(o.length);
      for (const side of ALL_SIDES) {
        const ops = (walls as Record<string, { openings?: Bag[] }>)[side]?.openings;
        if (!Array.isArray(ops)) continue;
        // north/south run along the room WIDTH; east/west along its LENGTH.
        const wallLen = side === "north" || side === "south" ? rw : rl;
        for (const op of ops) {
          const w = num(op.width);
          // Resolve the `anchor` (start | center | end) to a start-based offset,
          // exactly as expand.ts does before rendering — otherwise a `from center`
          // / `from end` opening is placed at the wrong span here.
          const off = openingStartOffset(op.anchor as OpeningAnchor | undefined, num(op.offset), w, wallLen);
          const owner = `room ${objLabel(o)} ${side}`;
          const label = openLabel(op);
          if (side === "north") out.push({ horiz: true, at: ry, lo: rx + off, hi: rx + off + w, owner, label });
          else if (side === "south") out.push({ horiz: true, at: ry + rl, lo: rx + off, hi: rx + off + w, owner, label });
          else if (side === "west") out.push({ horiz: false, at: rx, lo: ry + off, hi: ry + off + w, owner, label });
          else out.push({ horiz: false, at: rx + rw, lo: ry + off, hi: ry + off + w, owner, label });
        }
      }
    } else if (o.type === "wall") {
      const ops = o.openings;
      if (!Array.isArray(ops)) continue;
      const sx = num(o.start_x), sy = num(o.start_y), ex = num(o.end_x), ey = num(o.end_y);
      const horiz = Math.abs(sy - ey) < 1, vert = Math.abs(sx - ex) < 1;
      if (!horiz && !vert) continue; // diagonal wall — skip
      const start = horiz ? Math.min(sx, ex) : Math.min(sy, ey);
      const wallLen = horiz ? Math.abs(ex - sx) : Math.abs(ey - sy);
      for (const op of ops as Bag[]) {
        const w = num(op.width);
        const off = openingStartOffset(op.anchor as OpeningAnchor | undefined, num(op.offset), w, wallLen);
        out.push({ horiz, at: horiz ? sy : sx, lo: start + off, hi: start + off + w, owner: `wall ${objLabel(o)}`, label: openLabel(op) });
      }
    }
  }
  return out;
}

// Convert a metric length to project units using the config's own display units.
const FEET_PER_METER = 3.280839895;
const FEET_PER_DISPLAY: Record<string, number> = {
  feet_inches: 1, feet: 1, meters: 3.280839895, centimeters: 0.032808399, millimeters: 0.003280839,
};
function itemMetersToUnits(m: number, units?: { system?: string; per_unit?: number }): number {
  const perUnit = units?.per_unit ?? 10;
  const fpu = FEET_PER_DISPLAY[units?.system ?? "feet_inches"] ?? 1;
  return m * (perUnit / fpu) * FEET_PER_METER;
}
// Axis-aligned footprint (plan) of a resolved item, accounting for yaw.
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export function itemBox(it: Bag, units?: { system?: string; per_unit?: number }): Box | null {
  const asset = it.asset as { dimensions?: [number, number, number] } | undefined;
  if (!asset?.dimensions) return null;
  const scale = it.scale != null ? num(it.scale) : 1;
  const fw = itemMetersToUnits(asset.dimensions[0], units) * scale;
  const fd = itemMetersToUnits(asset.dimensions[2], units) * scale;
  const th = (num(it.rotation) * Math.PI) / 180;
  const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
  const hx = (fw / 2) * c + (fd / 2) * s;
  const hy = (fw / 2) * s + (fd / 2) * c;
  const cx = num(it.x), cy = num(it.y);
  return { x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy };
}
