// The model query layer.
//
// Builds a render-free spatial index over a resolved+expanded HouseConfig and
// answers inter-object geometry questions (near a point, overlap, intersection,
// containment, distance, openings on a wall line). Constraints and, over time,
// the estimator call into this instead of re-deriving geometry.
//
// Footprints come from the registry facets first (so custom primitives are
// queryable for free), then fall back to raw positional fields. Each object also
// carries a vertical Z band from the floor stack, so "intersect" = plan overlap
// AND z-band overlap. All geometry math lives in geom.ts (the flatten-js adapter).

import { facetsFor } from "../registry/registry";
import { computeFloorZBands } from "../three/coords";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import {
  rectRing,
  obbRing,
  ringsToFootprint,
  aabbOf,
  footprintsOverlap,
  footprintIntersection,
  footprintContains,
  footprintDistance,
  pointToFootprint,
  segmentToFootprintDistance,
  bandsOverlap,
  type Footprint,
  type AABB,
  type ZBand,
  type Vec2,
  type Ring,
} from "./geom";

type Obj = Record<string, unknown>;

const num = (v: unknown, d = 0): number =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && v !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : d;

export interface ModelNode {
  /** Stable object id (name → type#index fallback). */
  id: string;
  type: string;
  /** floor_number of the owning floor. */
  floor: number;
  layer?: string;
  footprint: Footprint;
  aabb: AABB;
  z: ZBand;
  /** The resolved+expanded object this node was built from. */
  raw: Obj;
}

export interface NearOpts {
  types?: string[];
  floor?: number;
}
export interface PairOpts {
  types?: string[];
  sameFloor?: boolean;
}

export interface SpatialModel {
  nodes: ModelNode[];
  byType(...t: string[]): ModelNode[];
  onFloor(n: number): ModelNode[];
  byLayer(id: string): ModelNode[];
  /** Nodes whose footprint is within `radius` of point `p`. */
  near(p: Vec2, radius: number, opts?: NearOpts): ModelNode[];
  /** Plan overlap AND z-band overlap. */
  overlaps(a: ModelNode, b: ModelNode): boolean;
  /** All other nodes that overlap `a`. */
  overlapping(a: ModelNode, opts?: { types?: string[] }): ModelNode[];
  /** Plan intersection region (ignores Z), or null. */
  intersection(a: ModelNode, b: ModelNode): Footprint | null;
  /** `inner`'s footprint lies within `outer`'s (plan only). */
  within(inner: ModelNode, outer: ModelNode): boolean;
  /** Minimum plan separation (0 if overlapping). */
  distance(a: ModelNode, b: ModelNode): number;
  /** Nodes whose footprint touches the given segment within `tol` (default 1). */
  onSegment(seg: [Vec2, Vec2], opts?: { types?: string[]; tol?: number }): ModelNode[];
  /** Unordered node pairs, optionally filtered. */
  pairs(opts?: PairOpts): [ModelNode, ModelNode][];
}

// ---- footprint resolution --------------------------------------------------

/** Rings for an object, from registry facets first, then raw fields. Null = not indexable. */
function footprintRings(type: string, obj: Obj): Ring[] | null {
  const facets = facetsFor(type) as {
    footprintPoly?: (o: Obj) => Ring[] | null;
    footprint?: (o: Obj) => { cx: number; cy: number; w: number; d: number; rot?: number } | null;
    bbox?: (o: Obj) => { x: number; y: number; w: number; d: number } | null;
  };
  const poly = facets.footprintPoly?.(obj);
  if (poly && poly.length) return poly;
  const fp = facets.footprint?.(obj);
  if (fp) return [obbRing(fp.cx, fp.cy, fp.w, fp.d, fp.rot ?? 0)];
  const bb = facets.bbox?.(obj);
  if (bb) return [rectRing(bb.x, bb.y, bb.w, bb.d)];

  // Raw-field fallbacks for the core (not-yet-registry-driven) primitives.
  if (type === "wall") return wallRings(obj);
  const w = num(obj.width, num(obj.w, NaN));
  const l = num(obj.length, num(obj.l, num(obj.depth, num(obj.d, NaN))));
  const x = num(obj.x, NaN);
  const y = num(obj.y, NaN);
  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(l)) {
    return [rectRing(x, y, w, l)];
  }
  return null; // roof, staircase, openings etc. — no clean box; skipped for now
}

/** A wall's plan footprint: a thin oriented quad from its endpoints + thickness. */
function wallRings(obj: Obj): Ring[] | null {
  const sx = num(obj.start_x, NaN);
  const sy = num(obj.start_y, NaN);
  const ex = num(obj.end_x, NaN);
  const ey = num(obj.end_y, NaN);
  if (![sx, sy, ex, ey].every(Number.isFinite)) return null;
  const t = num(obj.thickness, num(DEFAULT_GLOBAL_CONFIG.wall_thickness, 8));
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const nx = (-dy / len) * (t / 2); // normal, half-thickness
  const ny = (dx / len) * (t / 2);
  return [
    [
      { x: sx + nx, y: sy + ny },
      { x: ex + nx, y: ey + ny },
      { x: ex - nx, y: ey - ny },
      { x: sx - nx, y: sy - ny },
    ],
  ];
}

// ---- z band ----------------------------------------------------------------

// z_offset is referenced to the floor base; its default differs by type (the
// unified z_offset convention): deck-like objects sit at the base, everything
// else sits on the slab.
const BASE_Z_TYPES = new Set(["floor_slab", "slab", "beam", "roof", "gable_roof", "ground"]);

function zBandOf(type: string, obj: Obj, band: { slabZ: number; slabThickness: number; wallHeight: number }): ZBand {
  const zOffDefault = BASE_Z_TYPES.has(type) ? 0 : band.slabThickness;
  const z0 = band.slabZ + num(obj.z_offset, zOffDefault);
  const h = num(obj.height, NaN) || num(obj.thickness, NaN) || band.wallHeight;
  return { lo: z0, hi: z0 + h };
}

// ---- build -----------------------------------------------------------------

export function buildSpatialModel(config: unknown): SpatialModel {
  const cfg = (config ?? {}) as Obj;
  const floors = (Array.isArray(cfg.floors) ? cfg.floors : []) as Obj[];
  const d = (cfg.defaults ?? {}) as Obj;
  const bands = computeFloorZBands(
    floors as Array<Record<string, unknown>>,
    num(d.slab_thickness, DEFAULT_GLOBAL_CONFIG.floor_slab_thickness),
    num(d.floor_height, DEFAULT_GLOBAL_CONFIG.floor_height),
    num(d.wall_height, DEFAULT_GLOBAL_CONFIG.wall_height),
  );

  const nodes: ModelNode[] = [];
  floors.forEach((floor, fi) => {
    const floorNum = num(floor.floor_number, fi);
    const objs = (Array.isArray(floor.objects) ? floor.objects : []) as Obj[];
    const band = bands[fi];
    objs.forEach((obj, oi) => {
      const type = String(obj.type ?? "");
      const rings = footprintRings(type, obj);
      if (!rings) return;
      const footprint = ringsToFootprint(rings);
      if (footprint.area() <= 1e-6) return;
      nodes.push({
        id: String(obj.name ?? `${type}#${oi}`),
        type,
        floor: floorNum,
        layer: obj.layer as string | undefined,
        footprint,
        aabb: aabbOf(footprint),
        z: zBandOf(type, obj, band),
        raw: obj,
      });
    });
  });

  const model: SpatialModel = {
    nodes,
    byType: (...t) => nodes.filter((n) => t.includes(n.type)),
    onFloor: (n) => nodes.filter((x) => x.floor === n),
    byLayer: (id) => nodes.filter((x) => x.layer === id),
    near: (p, radius, opts) =>
      nodes.filter(
        (n) =>
          (!opts?.types || opts.types.includes(n.type)) &&
          (opts?.floor === undefined || n.floor === opts.floor) &&
          pointToFootprint(p, n.footprint) <= radius,
      ),
    overlaps: (a, b) =>
      a !== b && bandsOverlap(a.z, b.z) && footprintsOverlap(a.footprint, b.footprint),
    overlapping: (a, opts) =>
      nodes.filter(
        (b) =>
          b !== a &&
          (!opts?.types || opts.types.includes(b.type)) &&
          bandsOverlap(a.z, b.z) &&
          footprintsOverlap(a.footprint, b.footprint),
      ),
    intersection: (a, b) => footprintIntersection(a.footprint, b.footprint),
    within: (inner, outer) => footprintContains(outer.footprint, inner.footprint),
    distance: (a, b) => footprintDistance(a.footprint, b.footprint),
    onSegment: (seg, opts) => {
      const tol = opts?.tol ?? 1;
      return nodes.filter(
        (n) =>
          (!opts?.types || opts.types.includes(n.type)) &&
          segmentToFootprintDistance(seg[0], seg[1], n.footprint) <= tol,
      );
    },
    pairs: (opts) => {
      const pool = opts?.types ? nodes.filter((n) => opts.types!.includes(n.type)) : nodes;
      const out: [ModelNode, ModelNode][] = [];
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          if (opts?.sameFloor && pool[i].floor !== pool[j].floor) continue;
          out.push([pool[i], pool[j]]);
        }
      }
      return out;
    },
  };
  return model;
}
