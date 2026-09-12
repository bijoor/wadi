// Wall-area estimator: external (weather-facing) and internal (room-facing)
// wall surface areas for a house config, net of door/window openings, plus
// gable-end triangles above the eaves. Pure + synchronous — no bpy, no DOM —
// so it can run in the viewer panel builder, in Node tests, or a CLI.
//
// Definitions are FACE-based (a wall may have one face outside and one inside):
//   * EXTERNAL area = the OUTSIDE (weather-facing) faces of perimeter walls —
//     what exterior paint covers — plus gable-end triangles.
//   * INTERNAL area = the protected INSIDE faces: the inner face of perimeter
//     walls plus BOTH faces of interior partitions — what interior paint covers.
// A wall face is classified by sampling a point just beyond it: if that point
// lies inside a room on ANY floor it is protected/interior (so double-height
// voids and covered verandahs read as interior); otherwise it faces outside.
// The per-wall inventory then labels each wall external (has a weather face) or
// internal (fully protected) — one row per wall, not per face.
//
// Coordinates are Inkscape-style (X-right, Y-down); areas are accumulated in
// square project units and converted for display via the config `units` block
// (default 10 units = 1 ft), mirroring svg2d/format.ts.

import { computeMergedV2Spec } from "../svg2d/roof/v2/computeFromHouse";
import { expandRoomWalls, type HouseConfig } from "../svg2d/expand";
import { composeWalls, composedFloorInputs, type ComposedOpening } from "../model/composeWalls";

type Bag = Record<string, unknown>;
const num = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);

// ---- units -----------------------------------------------------------------

type UnitSystem = "feet_inches" | "feet" | "meters" | "centimeters" | "millimeters";
const M2_PER_DISPLAY: Record<UnitSystem, number> = {
  feet_inches: 0.09290304, // 1 sq ft
  feet: 0.09290304,
  meters: 1,
  centimeters: 1e-4,
  millimeters: 1e-6,
};
const SQ_LABEL: Record<UnitSystem, string> = {
  feet_inches: "sq ft",
  feet: "sq ft",
  meters: "m²",
  centimeters: "cm²",
  millimeters: "mm²",
};

export interface AreaUnits {
  perUnit: number; // project units per ONE display unit (e.g. 10 for feet)
  system: UnitSystem;
  sqLabel: string; // e.g. "sq ft"
  toDisplay(areaUnits: number): number; // sq project-units -> sq display-units
  toSqm(areaUnits: number): number; // sq project-units -> m^2
}

function readUnits(config: HouseConfig): AreaUnits {
  const u = (config as Bag).units as { system?: UnitSystem; per_unit?: number } | undefined;
  const system: UnitSystem = u?.system ?? "feet_inches";
  const perUnit = num(u?.per_unit, system === "feet_inches" || system === "feet" ? 10 : 1) || 1;
  const m2 = M2_PER_DISPLAY[system] ?? M2_PER_DISPLAY.feet_inches;
  return {
    perUnit,
    system,
    sqLabel: SQ_LABEL[system] ?? "sq ft",
    toDisplay: (a) => a / (perUnit * perUnit),
    toSqm: (a) => (a / (perUnit * perUnit)) * m2,
  };
}

// ---- geometry helpers ------------------------------------------------------

export interface Rect { x: number; y: number; w: number; l: number }
export type Side = "north" | "south" | "east" | "west";

// Is (px,py) inside any room interior? `eps` insets each rect so a point exactly
// on a shared edge is not counted as inside.
function inAnyRoom(rects: ReadonlyArray<Rect>, px: number, py: number, eps = 1): boolean {
  for (const r of rects) {
    if (px > r.x + eps && px < r.x + r.w - eps && py > r.y + eps && py < r.y + r.l - eps) return true;
  }
  return false;
}

// Outward normal (unit) for a room side.
const OUT_NORMAL: Record<Side, [number, number]> = {
  north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0],
};
// A room footprint tagged with the index of the floor it sits on, so wall
// coverage can require the covering room to be on the SAME floor or HIGHER (a
// room BELOW a wall doesn't shelter its outer face — the wall rises above that
// lower room's roof and faces outside).
export interface RoomRect extends Rect { floor: number }

// All room rectangles across every floor, each tagged with its floor index.
export function buildRoomRects(config: HouseConfig): RoomRect[] {
  const out: RoomRect[] = [];
  const floors = ((config as Bag).floors ?? []) as Bag[];
  for (let fi = 0; fi < floors.length; fi++) {
    for (const o of ((floors[fi].objects ?? []) as Bag[])) {
      if (o.type !== "room" || o.enabled === false) continue;
      out.push({ x: num(o.x), y: num(o.y), w: num(o.width), l: num(o.length), floor: fi });
    }
  }
  return out;
}

function probeDist(wallT: number): number {
  return Math.max(6, wallT * 1.5);
}

// Robust "open to the weather" test for a WHOLE room side, for structural
// linting. Samples several points along the side and reports it external only
// if NONE of them has a room just beyond — so a side sheltered by rooms above
// (even where two rooms meet exactly at this side's midpoint) is not mistaken
// for an exposed exterior wall the way a single centre probe can be.
export function roomSideOpenToWeather(
  rects: Rect[], rx: number, ry: number, rw: number, rl: number, side: Side, wallT: number,
): boolean {
  const probe = probeDist(wallT);
  const [nx, ny] = OUT_NORMAL[side];
  const horizontal = side === "north" || side === "south";
  const fixed = side === "south" ? ry + rl : side === "north" ? ry : side === "east" ? rx + rw : rx;
  for (const f of [0.25, 0.5, 0.75]) {
    const cx = horizontal ? rx + rw * f : fixed;
    const cy = horizontal ? fixed : ry + rl * f;
    if (inAnyRoom(rects, cx + nx * probe, cy + ny * probe)) return false; // sheltered somewhere
  }
  return true;
}

// ---- report types ----------------------------------------------------------

export interface AreaTriple { gross: number; openings: number; net: number } // sq project-units
export interface FloorAreas {
  floor: number;
  name: string;
  external: AreaTriple;
  internal: AreaTriple;
}
// One row per WALL (a room side or a standalone wall), not per face — so the
// inventory reads "this wall is external / internal" once. A wall's two faces
// are split into the exterior-paint area (its weather-facing outside, if any)
// and the interior-paint area (its protected inside face(s)).
export interface WallInvRow {
  floor: number;
  room: string; // owning room, or the standalone wall's name
  wall: string; // side ("north"…) or "(wall)"
  type: "external" | "internal"; // does it have a weather-facing (outside) face?
  lengthU: number;
  heightU: number;
  extAreaU: number; // exterior-paint area (outside face), net openings
  intAreaU: number; // interior-paint area (inside face(s)), net openings
}
export interface GableRow { segment: string; side: string; baseU: number; heightU: number; areaU: number }

export interface WallAreaReport {
  external: AreaTriple; // exterior-paint faces (perimeter outsides). gables → grandExternal
  internal: AreaTriple; // interior-paint faces (all insides + both faces of partitions)
  gables: { area: number; rows: GableRow[] };
  grandExternal: number; // external.net + gables.area
  perFloor: FloorAreas[];
  inventory: WallInvRow[]; // one row per wall
  units: AreaUnits;
}

function triple(): AreaTriple { return { gross: 0, openings: 0, net: 0 }; }
function add(t: AreaTriple, gross: number, openings: number) {
  const g = Math.max(0, gross), o = Math.min(g, Math.max(0, openings));
  t.gross += g; t.openings += o; t.net += g - o;
}

// ---- composed (per-face) variant (plans/wall-composition.md, P1) -----------
//
// Same report shape as computeWallAreas, but the wall faces come from the
// composed poché (composeWalls): each boundary EDGE is one face, classified
// brick (external) or interior on its own merits. Openings are cut in centreline
// space (both faces of their host wall). This is the more-correct baseline — it
// counts e.g. an upper-floor wall facing an open terrace as external, which the
// per-room path misses. Gables are roof-derived and carried over unchanged.

// Area of the openings that fall on one boundary edge (each opening cuts both
// faces of its wall, so it is subtracted from whichever face(s) it lands on).
function edgeOpeningArea(
  e: { a: { x: number; y: number }; b: { x: number; y: number } },
  openings: ComposedOpening[], wallH: number,
): number {
  const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const midX = (e.a.x + e.b.x) / 2, midY = (e.a.y + e.b.y) / 2;
  let cut = 0;
  for (const op of openings) {
    const opH = Math.min(op.height, wallH);
    if (op.axis === "x" && horizontal) {
      if (Math.abs(midY - op.cy) > op.thickness / 2 + 2) continue; // not a face of this wall band
      const eLo = Math.min(e.a.x, e.b.x), eHi = Math.max(e.a.x, e.b.x);
      const ov = Math.max(0, Math.min(eHi, op.cx + op.span / 2) - Math.max(eLo, op.cx - op.span / 2));
      cut += ov * opH;
    } else if (op.axis === "y" && !horizontal) {
      if (Math.abs(midX - op.cx) > op.thickness / 2 + 2) continue;
      const eLo = Math.min(e.a.y, e.b.y), eHi = Math.max(e.a.y, e.b.y);
      const ov = Math.max(0, Math.min(eHi, op.cy + op.span / 2) - Math.max(eLo, op.cy - op.span / 2));
      cut += ov * opH;
    }
  }
  return cut;
}

export function composedWallAreas(config: HouseConfig): WallAreaReport {
  const units = readUnits(config);
  const defaults = (config as Bag).defaults as Bag | undefined;
  const defWallH = num(defaults?.wall_height, 90);
  const wallT = num(defaults?.wall_thickness, 8);

  // Expand room-wall openings into flat door/window/gap objects (same as the 3D
  // renderer consumes), so composedFloorInputs sees openings and cuts them —
  // and so the estimate matches the composed render by construction.
  const expanded = expandRoomWalls(config, wallT, { lenient: true });

  const external = triple(), internal = triple();
  const inventory: WallInvRow[] = [];
  const perFloor: FloorAreas[] = [];
  const floors = (expanded.floors ?? []) as Bag[];
  for (let fi = 0; fi < floors.length; fi++) {
    const fl = floors[fi];
    const floorWallH = num(fl.wall_height, defWallH);
    const fExt = triple(), fInt = triple();
    const { walls, rooms, openings } = composedFloorInputs(
      (fl.objects ?? []) as unknown as Parameters<typeof composedFloorInputs>[0],
      wallT, floorWallH,
    );
    if (walls.length) {
      // Iterate per-height groups so each edge's area uses ITS wall height, not a
      // single floor height (a 30-high verandah wall no longer counts as 90).
      const { groups } = composeWalls(walls, rooms);
      for (const g of groups) {
        for (const e of g.edges) {
          const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
          const gross = len * g.height;
          const op = edgeOpeningArea(e, openings, g.height);
          if (e.brick) { add(external, gross, op); add(fExt, gross, op); }
          else { add(internal, gross, op); add(fInt, gross, op); }
        }
      }
    }
    perFloor.push({ floor: num(fl.floor_number, fi), name: String(fl.name ?? `Floor ${fi}`), external: fExt, internal: fInt });
  }

  const gables = computeGables(config);
  return {
    external, internal, gables,
    grandExternal: external.net + gables.area,
    perFloor, inventory, units,
  };
}
// Gable-end triangles above the eaves (external), uniform across V2 + legacy
// roofs. area = 0.5 * base * (ridge rise) from each `gable_wall` plane.
function computeGables(config: HouseConfig): { area: number; rows: GableRow[] } {
  const rows: GableRow[] = [];
  let area = 0;
  try {
    const spec = computeMergedV2Spec(config, { filter: "all" });
    for (const p of spec.planes) {
      if (p.role !== "gable_wall") continue;
      const v = p.vertices;
      if (!v || v.length < 3) continue;
      const zs = v.map((q) => q[2]);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const base = v.filter((q) => q[2] === minZ);
      if (base.length < 2) continue;
      const baseLen = Math.hypot(base[0][0] - base[1][0], base[0][1] - base[1][1]);
      const height = maxZ - minZ;
      const a = 0.5 * baseLen * height;
      area += a;
      rows.push({ segment: p.source_segment_id ?? p.id, side: p.side_of_segment ?? "", baseU: baseLen, heightU: height, areaU: a });
    }
  } catch {
    // roof geometry failure must not blank the whole report
  }
  return { area, rows };
}
