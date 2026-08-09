// Geometry adapter for the model query layer.
//
// A thin wrapper over `@flatten-js/core` so the rest of the codebase never
// imports the geometry engine directly — the SpatialModel facade and every
// constraint go through these functions, keeping the library swappable behind
// one seam (see plans/functional-constraints-testing.md).
//
// Footprints are TRUE plan polygons (concave / holes / multi-part supported),
// not bounding boxes. The AABB here is only a broad-phase reject.

import { Polygon, Point, Segment, BooleanOperations } from "@flatten-js/core";

export interface Vec2 {
  x: number;
  y: number;
}
/** One polygon ring in world plan coords (project units). */
export type Ring = Vec2[];
/** A plan footprint: a flatten Polygon (a general, possibly holed/multi area). */
export type Footprint = Polygon;
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
/** Vertical extent of an object in world Z. */
export interface ZBand {
  lo: number;
  hi: number;
}

const AREA_EPS = 1e-6;

// ---- ring / footprint construction ----------------------------------------

/** Axis-aligned rectangle ring from a top-left corner + size (CW in screen coords). */
export function rectRing(x: number, y: number, w: number, l: number): Ring {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + l },
    { x, y: y + l },
  ];
}

/** Oriented (yaw-rotated) box ring: centre (cx,cy), size (w,d), rotation degrees. */
export function obbRing(cx: number, cy: number, w: number, d: number, rotDeg = 0): Ring {
  const hw = w / 2;
  const hd = d / 2;
  const t = (rotDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, ly]) => ({ x: cx + lx * c - ly * s, y: cy + lx * s + ly * c }));
}

// A single ring as a SOLID flatten face, regardless of the caller's winding.
// flatten treats a face as solid or a hole by orientation; we normalise to
// solid by checking whether an interior sample point is contained, and reverse
// if not — so callers never have to reason about winding conventions.
function solidFace(ring: Ring): Polygon {
  const pts = ring.map((p) => new Point(p.x, p.y));
  const poly = new Polygon(pts);
  const c = interiorPoint(ring);
  if (!poly.contains(new Point(c.x, c.y))) {
    return new Polygon([...pts].reverse());
  }
  return poly;
}

// A point guaranteed inside a convex ring (vertex average). Rings passed here
// are convex in practice (rects, OBBs, roof segments, expanded stair parts);
// concave shapes arrive as multiple convex rings, so this stays valid.
function interiorPoint(ring: Ring): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ring.length, y: y / ring.length };
}

/**
 * Build a footprint from rings. The first ring is the outer boundary; any
 * further rings punch holes. Rings with fewer than 3 points are skipped.
 */
export function ringsToFootprint(rings: Ring[]): Footprint {
  const valid = rings.filter((r) => r && r.length >= 3);
  if (valid.length === 0) return new Polygon();
  let poly = solidFace(valid[0]);
  for (let i = 1; i < valid.length; i++) {
    poly = BooleanOperations.subtract(poly, solidFace(valid[i]));
  }
  return poly;
}

// ---- predicates / measures -------------------------------------------------

/** True iff the two footprints share positive area (touching edges do not count). */
export function footprintsOverlap(a: Footprint, b: Footprint): boolean {
  if (!aabbsOverlap(aabbOf(a), aabbOf(b))) return false;
  return BooleanOperations.intersect(a, b).area() > AREA_EPS;
}

/** The overlap region, or null if they do not overlap with positive area. */
export function footprintIntersection(a: Footprint, b: Footprint): Footprint | null {
  if (!aabbsOverlap(aabbOf(a), aabbOf(b))) return null;
  const r = BooleanOperations.intersect(a, b);
  return r.area() > AREA_EPS ? r : null;
}

/** Union of several footprints (empty polygon if none). */
export function footprintUnion(fs: Footprint[]): Footprint {
  if (fs.length === 0) return new Polygon();
  return fs.reduce((acc, f) => BooleanOperations.unify(acc, f));
}

/** True iff `inner` lies entirely within `outer` (inner minus outer is empty). */
export function footprintContains(outer: Footprint, inner: Footprint): boolean {
  if (inner.area() <= AREA_EPS) return false;
  return BooleanOperations.subtract(inner, outer).area() < AREA_EPS;
}

/** Minimum separation between two footprints (0 if they touch or overlap). */
export function footprintDistance(a: Footprint, b: Footprint): number {
  return a.distanceTo(b)[0];
}

/** Distance from a point to a footprint (0 if inside). */
export function pointToFootprint(p: Vec2, a: Footprint): number {
  const pt = new Point(p.x, p.y);
  if (a.contains(pt)) return 0;
  return pt.distanceTo(a)[0];
}

/** Distance from a line segment to a footprint (0 if the segment touches it). */
export function segmentToFootprintDistance(p: Vec2, q: Vec2, a: Footprint): number {
  const seg = new Segment(new Point(p.x, p.y), new Point(q.x, q.y));
  return seg.distanceTo(a)[0];
}

/** Broad-phase bounding box of a footprint. */
export function aabbOf(a: Footprint): AABB {
  const b = a.box;
  return { minX: b.xmin, minY: b.ymin, maxX: b.xmax, maxY: b.ymax };
}

export function aabbsOverlap(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

/** True iff two vertical bands share positive extent (touching planes do not count). */
export function bandsOverlap(a: ZBand, b: ZBand): boolean {
  return Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > AREA_EPS;
}
