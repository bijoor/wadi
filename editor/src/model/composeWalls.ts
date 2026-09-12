// Whole-model wall composition (P0 of plans/wall-composition.md).
//
// Instead of stamping a 4-sided ring per room and giving each room-side box one
// external/internal verdict, compose ONE wall solid (the "poché") per floor by
// buffering every wall CENTRELINE to its thickness and UNIONing the rectangles,
// then classify each boundary edge on its own merits (brick iff the point just
// beyond it is open to weather). The union does by itself what ownership +
// corner-inset did by hand: coincident walls merge, junctions fill at any angle.
//
// This module is the geometry core (pure, angle-agnostic). Rendering (3D) and
// the estimator consume ComposedFloor. Openings are cut in CENTRELINE space by
// the consumer (Q1), so they are not represented here.

import { Point, Polygon } from "@flatten-js/core";
import {
  obbRing, rectRing, ringsToFootprint, footprintUnion, footprintSubtract,
  type Vec2, type Footprint,
} from "./geom";

export interface WallInput {
  sx: number; sy: number; ex: number; ey: number;
  thickness: number;
  height: number;        // wall height (drives the 3D extrude + estimator area)
}
export interface RoomRect { x: number; y: number; w: number; l: number }

// One straight edge of the poché boundary, classified.
export interface BoundaryEdge {
  a: Vec2; b: Vec2;      // plan endpoints
  outward: Vec2;         // unit normal pointing OUT of the wall solid
  brick: boolean;        // exposed to weather (the point just outside is in no room)
  thickness: number;     // nearest wall thickness (drove the probe distance)
  height: number;        // nearest wall height (uniform within a WallGroup)
}
// Walls that share a height compose together into one sub-poché extruded to that
// height. Collinear same-thickness walls with DIFFERENT heights land in different
// groups, so the union never fuses them into one uniform-height block.
export interface WallGroup { height: number; poche: Footprint; edges: BoundaryEdge[] }
export interface ComposedFloor {
  poche: Footprint;      // union of ALL walls, height-agnostic (drives the 2D plan)
  edges: BoundaryEdge[]; // boundary edges of the full poché
  groups: WallGroup[];   // per-height sub-pochés (drive the 3D extrude + estimator)
}

const SNAP = 1e-2;   // centreline snap tolerance (Q3)
// Grow each rectangle so ABUTTING walls (a shared boundary with zero overlap —
// e.g. two rooms' back-to-back side walls, or a T-junction) actually overlap.
// flatten's polygon boolean is fragile on edge-touching-only inputs and throws
// ("Cannot complete boolean operation"); a small overlap makes the union robust.
// Half a unit inflates the poché imperceptibly (walls are ~8 units thick).
const GROW = 0.5;    // rectangle grow so abutting/near-coincident rects merge (Q3)
const OUT_EPS = 0.5; // tiny step to decide which side of an edge is "outside"

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

function pointSegDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

// Union one set of walls into a poché and classify its boundary edges by exposure.
// `probeWalls` supplies the nearest-wall thickness/height (the whole floor for the
// full poché, or just the group's walls for a per-height sub-poché). Axis-agnostic
// (obbRing handles any yaw). See Q1-Q3 in plans/wall-composition.md.
function composeGroup(walls: WallInput[], roomUnion: Footprint, probeWalls: WallInput[]): { poche: Footprint; edges: BoundaryEdge[] } {
  const rects: Footprint[] = [];
  for (const w of walls) {
    const dx = w.ex - w.sx, dy = w.ey - w.sy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6 || w.thickness <= 0) continue;
    const cx = (w.sx + w.ex) / 2, cy = (w.sy + w.ey) / 2;
    const rotDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    rects.push(ringsToFootprint([obbRing(cx, cy, len + GROW, w.thickness + GROW, rotDeg)]));
  }
  const poche = rects.length ? footprintUnion(rects) : new Polygon();
  const edges: BoundaryEdge[] = [];
  for (const e of poche.edges) {
    const a: Vec2 = { x: e.start.x, y: e.start.y };
    const b: Vec2 = { x: e.end.x, y: e.end.y };
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;
    const mid: Vec2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const perp: Vec2 = { x: -dy / L, y: dx / L };
    // outward = the perp direction whose tiny step leaves the poché solid
    const inPlus = poche.contains(new Point(mid.x + perp.x * OUT_EPS, mid.y + perp.y * OUT_EPS));
    const outward: Vec2 = inPlus ? { x: -perp.x, y: -perp.y } : perp;
    // nearest wall thickness/height → probe distance (Q2). We probe from the
    // boundary edge (already at the outer face), so a few units clears it.
    let bestD = Infinity, t = probeWalls[0]?.thickness ?? 8, h = probeWalls[0]?.height ?? 90;
    for (const w of probeWalls) {
      const d = pointSegDist(mid, { x: w.sx, y: w.sy }, { x: w.ex, y: w.ey });
      if (d < bestD) { bestD = d; t = w.thickness; h = w.height; }
    }
    const probe = Math.max(3, t * 0.25);
    const brick = !roomUnion.contains(new Point(mid.x + outward.x * probe, mid.y + outward.y * probe));
    edges.push({ a, b, outward, brick, thickness: t, height: h });
  }
  return { poche, edges };
}

// Buffer every wall centreline to a thickness rectangle and union them into the
// floor poché, then ALSO compose one sub-poché per distinct wall height so the 3D
// extrude and the estimator honour per-wall height (collinear same-thickness walls
// of different height stay separate — the split the owner asked for). The full
// poché (all heights unioned) drives the height-agnostic 2D plan. See
// plans/wall-composition.md.
export function composeWalls(walls: WallInput[], rooms: RoomRect[]): ComposedFloor {
  const clean: WallInput[] = [];
  for (const w of walls) {
    const sx = snap(w.sx), sy = snap(w.sy), ex = snap(w.ex), ey = snap(w.ey);
    if (Math.hypot(ex - sx, ey - sy) < 1e-6 || w.thickness <= 0) continue;
    clean.push({ sx, sy, ex, ey, thickness: w.thickness, height: w.height });
  }
  const roomUnion = rooms.length
    ? footprintUnion(rooms.map((r) => ringsToFootprint([rectRing(r.x, r.y, r.w, r.l)])))
    : new Polygon();

  const full = composeGroup(clean, roomUnion, clean);

  // Partition by snapped height; each height composes its own sub-poché.
  const byHeight = new Map<number, WallInput[]>();
  for (const w of clean) {
    const key = snap(w.height);
    const g = byHeight.get(key);
    if (g) g.push(w); else byHeight.set(key, [w]);
  }
  const groups: WallGroup[] = [];
  for (const [height, ws] of byHeight) {
    const { poche, edges } = composeGroup(ws, roomUnion, ws);
    groups.push({ height, poche, edges });
  }

  return { poche: full.poche, edges: full.edges, groups };
}

// Signed area of a ring (plan coords). >0 and <0 distinguish outer vs hole.
function signedArea(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

// Standard even-odd point-in-polygon.
function pointInRing(px: number, py: number, ring: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, yi = ring[i].y, xj = ring[j].x, yj = ring[j].y;
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// An opening as an axis-aligned cut (P0 is axis-aligned): `axis` = the wall run,
// (cx,cy) = opening centre in plan, `span` = width along the wall.
export interface ComposedOpening {
  axis: "x" | "y"; cx: number; cy: number; span: number; height: number; sill: number; thickness: number;
  kind: "door" | "window" | "gap";
  open: boolean; // no leaf/pane — a bare hole (always true for a gap; a door flagged open)
}

type FloorObj = { type: string;[k: string]: unknown };

// The compose-walls flag. Composition is the DEFAULT wall path (P3); a config can
// opt OUT with `compose_walls:false` (keeping the legacy per-room path as a
// fallback), and the `window.__composeWalls` runtime toggle can force either way
// for A/B comparison. Node/parity has no `window`, so the golden is rendered with
// composition on (the P3 baseline).
export function composeWallsFlag(config: unknown): boolean {
  const cw = config && typeof config === "object"
    ? (config as { compose_walls?: unknown }).compose_walls : undefined;
  if (cw === false) return false;
  if (cw === true) return true;
  if (typeof window !== "undefined") {
    const w = (window as unknown as { __composeWalls?: boolean }).__composeWalls;
    if (w === false) return false;
    if (w === true) return true;
  }
  return true; // default on
}

// Extract composeWalls inputs from a floor's expanded objects: each room's four
// FULL-SPAN side centrelines (no inset — the union fills the corners), standalone
// walls, room footprints, and openings (door/window/gap) as axis-aligned cuts.
// Shared by the 3D renderer and the estimator so they can never disagree.
export function composedFloorInputs(objects: FloorObj[], defaultT: number, wallHeight: number): {
  walls: WallInput[]; rooms: RoomRect[]; openings: ComposedOpening[];
} {
  const walls: WallInput[] = [];
  const rooms: RoomRect[] = [];
  const openings: ComposedOpening[] = [];
  for (const o of objects) {
    if (o.enabled === false) continue;
    if (o.type === "room") {
      const rx = o.x as number, ry = o.y as number, rw = o.width as number, rl = o.length as number;
      const t = (o.wall_thickness as number | undefined) ?? defaultT;
      rooms.push({ x: rx, y: ry, w: rw, l: rl });
      // Per-wall height (drives the 3D extrude split): a room-side height override
      // (room.wall_heights[side], a number or {height}) wins, else the room's own
      // height, else the floor wall height. Mirrors House3D's roomWallHeight().
      const roomH = (o.height as number | undefined) ?? wallHeight;
      const wh = (o.wall_heights as Record<string, unknown> | undefined) ?? {};
      const sideHeight = (side: string): number => {
        const entry = wh[side];
        if (typeof entry === "number") return entry;
        if (entry && typeof entry === "object") {
          const hh = (entry as { height?: number }).height;
          if (typeof hh === "number") return hh;
        }
        return roomH;
      };
      const raw = o.walls as string[] | Record<string, unknown> | undefined;
      const sides = raw ? (Array.isArray(raw) ? raw : Object.keys(raw)) : ["north", "south", "east", "west"];
      for (const sRaw of sides) {
        const s = String(sRaw).toLowerCase();
        const h = sideHeight(s);
        if (s === "north") walls.push({ sx: rx, sy: ry + t / 2, ex: rx + rw, ey: ry + t / 2, thickness: t, height: h });
        else if (s === "south") walls.push({ sx: rx, sy: ry + rl - t / 2, ex: rx + rw, ey: ry + rl - t / 2, thickness: t, height: h });
        else if (s === "west") walls.push({ sx: rx + t / 2, sy: ry, ex: rx + t / 2, ey: ry + rl, thickness: t, height: h });
        else if (s === "east") walls.push({ sx: rx + rw - t / 2, sy: ry, ex: rx + rw - t / 2, ey: ry + rl, thickness: t, height: h });
      }
    } else if (o.type === "wall") {
      const t = (o.thickness as number | undefined) ?? defaultT;
      const h = (o.height as number | undefined) ?? wallHeight;
      walls.push({ sx: o.start_x as number, sy: o.start_y as number, ex: o.end_x as number, ey: o.end_y as number, thickness: t, height: h });
    } else if (o.type === "door" || o.type === "window" || o.type === "gap") {
      const dir = String((o.direction as string | undefined) ?? "").toLowerCase();
      const t = defaultT;
      const w = o.width as number, h = (o.height as number | undefined) ?? wallHeight;
      const sill = o.type === "window" ? ((o.sill_height as number | undefined) ?? 0) : 0;
      const ox = o.x as number, oy = o.y as number;
      const kind = o.type as "door" | "window" | "gap";
      // A gap is inherently a bare hole; a door flagged `open` is left as one too
      // (no leaf) — matching the per-room path's `if (m.open) continue`.
      const open = kind === "gap" || (kind === "door" && o.open === true);
      if (dir === "east" || dir === "west") {
        openings.push({ axis: "y", cx: ox + t / 2, cy: oy + w / 2, span: w, height: h, sill, thickness: t, kind, open });
      } else {
        openings.push({ axis: "x", cx: ox + w / 2, cy: oy + t / 2, span: w, height: h, sill, thickness: t, kind, open });
      }
    }
  }
  return { walls, rooms, openings };
}

const GAP_OVERCUT = 2; // extend a gap notch past both wall faces so it fully breaks the poché

// Compose a floor's wall poché for 2D plan rendering: the union boundary with
// `gap` openings notched out (a gap is an open passage — it breaks the poché so
// the slab shows through). Doors/windows do NOT notch the poché (they are drawn
// as symbols on top, matching the per-room 2D path). Pure — returns contours
// ready to stroke as SVG. Shared with the 3D/estimator composeWalls pipeline so
// the plan poché and the model can never disagree on wall extent.
export function composedPoche(objects: FloorObj[], defaultT: number): PocheShape[] {
  const { walls, rooms, openings } = composedFloorInputs(objects, defaultT, 90);
  if (!walls.length) return [];
  const { poche } = composeWalls(walls, rooms);
  let poly = poche;
  for (const op of openings) {
    if (op.kind !== "gap") continue;
    const across = op.thickness + GAP_OVERCUT;
    const w = op.axis === "x" ? op.span : across;
    const h = op.axis === "x" ? across : op.span;
    const rect = ringsToFootprint([rectRing(op.cx - w / 2, op.cy - h / 2, w, h)]);
    poly = footprintSubtract(poly, rect);
  }
  return pocheContours(poly);
}

export interface PocheShape { outer: Vec2[]; holes: Vec2[][] }

// Extract the poché as a set of {outer, holes} rings for extrusion. Outer
// contours have positive signed area, holes negative (flatten's convention for
// a union result); each hole is assigned to the outer that contains it.
export function pocheContours(poche: Footprint): PocheShape[] {
  const outers: Vec2[][] = [];
  const holes: Vec2[][] = [];
  for (const face of poche.faces) {
    const pts: Vec2[] = [];
    let e = face.first, guard = 0;
    if (!e) continue;
    do { pts.push({ x: e.start.x, y: e.start.y }); e = e.next; guard++; } while (e && e !== face.first && guard < 100000);
    if (pts.length < 3) continue;
    (signedArea(pts) >= 0 ? outers : holes).push(pts);
  }
  const shapes: PocheShape[] = outers.map((outer) => ({ outer, holes: [] }));
  for (const h of holes) {
    const c = h[0];
    const owner = shapes.find((s) => pointInRing(c.x, c.y, s.outer));
    (owner ?? shapes[0])?.holes.push(h);
  }
  return shapes;
}
