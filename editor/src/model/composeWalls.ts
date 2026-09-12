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
  obbRing, rectRing, ringsToFootprint, footprintUnion,
  type Vec2, type Footprint,
} from "./geom";

export interface WallInput {
  sx: number; sy: number; ex: number; ey: number;
  thickness: number;
}
export interface RoomRect { x: number; y: number; w: number; l: number }

// One straight edge of the poché boundary, classified.
export interface BoundaryEdge {
  a: Vec2; b: Vec2;      // plan endpoints
  outward: Vec2;         // unit normal pointing OUT of the wall solid
  brick: boolean;        // exposed to weather (the point just outside is in no room)
  thickness: number;     // nearest wall thickness (drove the probe distance)
}
export interface ComposedFloor { poche: Footprint; edges: BoundaryEdge[] }

const SNAP = 1e-3;   // centreline snap tolerance (Q3)
const GROW = 1e-3;   // rectangle epsilon-grow so near-coincident rects merge (Q3)
const OUT_EPS = 0.5; // tiny step to decide which side of an edge is "outside"

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

function pointSegDist(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

// Buffer each wall centreline to a thickness rectangle and union them into the
// floor poché; classify every boundary edge by exposure. Axis-agnostic (obbRing
// handles any yaw). See Q1-Q3 in plans/wall-composition.md.
export function composeWalls(walls: WallInput[], rooms: RoomRect[]): ComposedFloor {
  const rects: Footprint[] = [];
  const clean: WallInput[] = [];
  for (const w of walls) {
    const sx = snap(w.sx), sy = snap(w.sy), ex = snap(w.ex), ey = snap(w.ey);
    const dx = ex - sx, dy = ey - sy;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6 || w.thickness <= 0) continue;
    clean.push({ sx, sy, ex, ey, thickness: w.thickness });
    const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
    const rotDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    rects.push(ringsToFootprint([obbRing(cx, cy, len + GROW, w.thickness + GROW, rotDeg)]));
  }
  const poche = rects.length ? footprintUnion(rects) : new Polygon();
  const roomUnion = rooms.length
    ? footprintUnion(rooms.map((r) => ringsToFootprint([rectRing(r.x, r.y, r.w, r.l)])))
    : new Polygon();

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
    // nearest wall thickness → probe distance (Q2). We probe from the boundary
    // edge (already at the outer face), so a few units clears it.
    let bestD = Infinity, t = clean[0]?.thickness ?? 8;
    for (const w of clean) {
      const d = pointSegDist(mid, { x: w.sx, y: w.sy }, { x: w.ex, y: w.ey });
      if (d < bestD) { bestD = d; t = w.thickness; }
    }
    const probe = Math.max(3, t * 0.25);
    const brick = !roomUnion.contains(new Point(mid.x + outward.x * probe, mid.y + outward.y * probe));
    edges.push({ a, b, outward, brick, thickness: t });
  }
  return { poche, edges };
}
