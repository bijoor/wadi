// Pure geometry/graph helpers for the Graph view (Phase 2). Kept dependency-free
// and separate from the React component so they're unit-testable.

import type { HouseConfig } from "../schema/houseConfig";

type Side = "north" | "south" | "east" | "west";

export interface RoomBlock {
  index: number; // object index within the floor
  name: string;
  x: number;
  y: number;
  w: number;
  l: number;
  connections: string[];
  /** The room's raw `walls` value (dict / list / undefined) — for passability. */
  walls?: unknown;
}

const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

// Rooms on a floor, as blocks with resolved geometry + their connections.
export function roomBlocksOf(config: HouseConfig, floorIdx: number): RoomBlock[] {
  const floor = config.floors?.[floorIdx];
  if (!floor) return [];
  const out: RoomBlock[] = [];
  floor.objects.forEach((o, index) => {
    const r = o as Record<string, unknown>;
    if (r.type !== "room") return;
    out.push({
      index,
      name: String(r.name ?? `room${index}`),
      x: num(r.x),
      y: num(r.y),
      w: num(r.width, 1),
      l: num(r.length, 1),
      connections: Array.isArray(r.connections) ? (r.connections as string[]) : [],
      walls: r.walls,
    });
  });
  return out;
}

// Two room rects share a wall if they overlap on one axis and touch (gap ≤ tol) on
// the other. Handles both conventions: center (edges coincide, gap = 0) and corner
// (rooms overlap by a wall thickness, gap < 0). Corner-only touches (a shared point,
// zero overlap on both axes) do NOT count.
export function sharesWall(a: RoomBlock, b: RoomBlock, tol = 1): boolean {
  const ax1 = a.x + a.w, ay1 = a.y + a.l, bx1 = b.x + b.w, by1 = b.y + b.l;
  const xOverlap = Math.min(ax1, bx1) - Math.max(a.x, b.x);
  const yOverlap = Math.min(ay1, by1) - Math.max(a.y, b.y);
  const gapX = Math.max(a.x - bx1, b.x - ax1); // >0 separated, ≤0 touching/overlapping
  const gapY = Math.max(a.y - by1, b.y - ay1);
  const shareVertical = yOverlap > 0 && gapX <= tol; // left/right walls meet
  const shareHorizontal = xOverlap > 0 && gapY <= tol; // top/bottom walls meet
  return shareVertical || shareHorizontal;
}

const OPP: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

// The side of `a` that faces `b`, plus the overlapping span [lo, hi] along that
// wall, or null when the two rooms don't overlap on a wall. Mirrors C11.
function facing(a: RoomBlock, b: RoomBlock, tol: number): { side: Side; lo: number; hi: number } | null {
  const ax1 = a.x + a.w, ay1 = a.y + a.l, bx1 = b.x + b.w, by1 = b.y + b.l;
  const yLo = Math.max(a.y, b.y), yHi = Math.min(ay1, by1);
  const xLo = Math.max(a.x, b.x), xHi = Math.min(ax1, bx1);
  if (yHi - yLo > 0) {
    if (Math.abs(ax1 - b.x) <= tol) return { side: "east", lo: yLo, hi: yHi };
    if (Math.abs(bx1 - a.x) <= tol) return { side: "west", lo: yLo, hi: yHi };
  }
  if (xHi - xLo > 0) {
    if (Math.abs(ay1 - b.y) <= tol) return { side: "south", lo: xLo, hi: xHi };
    if (Math.abs(by1 - a.y) <= tol) return { side: "north", lo: xLo, hi: xHi };
  }
  return null;
}
function wallPresent(walls: unknown, side: Side): boolean {
  if (walls == null) return true;
  if (Array.isArray(walls)) return (walls as string[]).includes(side);
  if (typeof walls === "object") return side in (walls as object);
  return true;
}
function doorInOverlap(block: RoomBlock, side: Side, lo: number, hi: number): boolean {
  const walls = block.walls;
  if (!walls || Array.isArray(walls) || typeof walls !== "object") return false;
  const ops = (walls as Record<string, { openings?: Array<{ kind?: string; offset?: number; width?: number }> }>)[side]?.openings;
  if (!Array.isArray(ops)) return false;
  const base = side === "east" || side === "west" ? block.y : block.x;
  for (const op of ops) {
    if (op?.kind !== "door") continue;
    const dLo = base + num(op.offset), dHi = dLo + num(op.width);
    if (Math.min(dHi, hi) - Math.max(dLo, lo) > 0) return true;
  }
  return false;
}

// Is a declared connection between `a` and `b` physically realized (the C11 rule)?
// They must overlap on a wall, AND that overlap must be passable — a door lies in
// it, OR the wall is absent on BOTH rooms (an open passage). Kept in sync with
// editor/src/lint/constraints/c11_declared_connection.ts (the authoritative test).
export function connectionSatisfied(a: RoomBlock, b: RoomBlock, tol = 1): boolean {
  const f = facing(a, b, tol);
  if (!f) return false; // walls don't overlap → not adjacent
  const bSide = OPP[f.side];
  const wallThere = wallPresent(a.walls, f.side) || wallPresent(b.walls, bSide);
  if (!wallThere) return true; // open passage
  return doorInOverlap(a, f.side, f.lo, f.hi) || doorInOverlap(b, bSide, f.lo, f.hi);
}

// Undirected, deduped edges from every room's `connections` (A|B once).
export function edgeList(blocks: RoomBlock[]): Array<[RoomBlock, RoomBlock]> {
  const byName = new Map(blocks.map((b) => [b.name, b]));
  const seen = new Set<string>();
  const edges: Array<[RoomBlock, RoomBlock]> = [];
  for (const a of blocks) {
    for (const name of a.connections) {
      const b = byName.get(name);
      if (!b || b.name === a.name) continue;
      const key = [a.name, b.name].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
  }
  return edges;
}

export const center = (b: RoomBlock) => ({ cx: b.x + b.w / 2, cy: b.y + b.l / 2 });
