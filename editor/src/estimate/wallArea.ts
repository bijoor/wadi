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
import type { HouseConfig } from "../svg2d/expand";

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

// Room rectangles across ALL floors — the building footprint used to decide
// whether a wall face looks onto interior space (a room below counts, so
// double-height voids read as interior).
function allRoomRects(config: HouseConfig): Rect[] {
  const rects: Rect[] = [];
  for (const fl of (config.floors ?? []) as Bag[]) {
    for (const o of ((fl.objects ?? []) as Bag[])) {
      if (o.type !== "room") continue;
      if (o.enabled === false) continue;
      rects.push({ x: num(o.x), y: num(o.y), w: num(o.width), l: num(o.length) });
    }
  }
  return rects;
}

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
const OPPOSITE: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

function openingsArea(wc: Bag | undefined): number {
  const ops = (wc?.openings as Bag[] | undefined) ?? [];
  let a = 0;
  for (const op of ops) a += num(op.width) * num(op.height);
  return a;
}

// ---- external/internal wall classification (shared with the 3D renderer) ----
// The same face-probing rule computeWallAreas uses, exposed so House3D can
// texture external walls and leave internal partitions plain-painted, without
// duplicating the geometry logic.

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

// A room side's OUTSIDE face is external (weather-facing) iff the point just
// beyond it doesn't fall inside any room on any floor.
export function roomSideIsExternal(
  rects: Rect[], rx: number, ry: number, rw: number, rl: number, side: Side, wallT: number,
): boolean {
  const probe = probeDist(wallT);
  const [nx, ny] = OUT_NORMAL[side];
  const cx = side === "east" ? rx + rw : side === "west" ? rx : rx + rw / 2;
  const cy = side === "south" ? ry + rl : side === "north" ? ry : ry + rl / 2;
  return !inAnyRoom(rects, cx + nx * probe, cy + ny * probe);
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

// Split a wall run [lo,hi] (varying along `alongAxis`) into exposed/covered
// segments, based on which sub-intervals have a room JUST BEYOND the outer face.
// `beyond` is the fixed perpendicular coordinate of the sample line (already a
// probe distance past the face). A partially-covered wall (e.g. one a porch or
// balcony covers over part of its length, or that has a room/terrace above part
// of it) therefore reads as exterior finish where it's exposed and interior
// finish where it's protected — instead of the whole wall taking one verdict
// from a single centre sample.
export function splitWallByCoverage(
  rects: ReadonlyArray<Rect & { floor?: number }>,
  alongAxis: "x" | "y",
  beyond: number,
  lo: number,
  hi: number,
  minFloor = -Infinity,
): Array<{ s: number; e: number; external: boolean }> {
  const EPS = 0.5;
  const covered: Array<[number, number]> = [];
  for (const r of rects) {
    // Only rooms on the same floor or higher shelter this wall's outer face.
    if ((r.floor ?? 0) < minFloor) continue;
    // The rect's span on the axis the sample line is fixed on.
    const perpLo = alongAxis === "x" ? r.y : r.x;
    const perpHi = alongAxis === "x" ? r.y + r.l : r.x + r.w;
    if (beyond <= perpLo + EPS || beyond >= perpHi - EPS) continue; // line not inside this rect
    const aLo = alongAxis === "x" ? r.x : r.y;
    const aHi = alongAxis === "x" ? r.x + r.w : r.y + r.l;
    const s = Math.max(aLo, lo), e = Math.min(aHi, hi);
    if (e - s > EPS) covered.push([s, e]);
  }
  covered.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const iv of covered) {
    const last = merged[merged.length - 1];
    if (last && iv[0] <= last[1] + EPS) last[1] = Math.max(last[1], iv[1]);
    else merged.push([iv[0], iv[1]]);
  }
  const out: Array<{ s: number; e: number; external: boolean }> = [];
  let cur = lo;
  for (const [cs, ce] of merged) {
    if (cs > cur + EPS) out.push({ s: cur, e: cs, external: true });
    out.push({ s: Math.max(cs, cur), e: ce, external: false });
    cur = Math.max(cur, ce);
  }
  if (cur < hi - EPS) out.push({ s: cur, e: hi, external: true });
  return out.filter((g) => g.e - g.s > EPS);
}

// A standalone wall is external iff EITHER of its faces is weather-facing.
export function standaloneWallIsExternal(
  rects: Rect[], sx: number, sy: number, ex: number, ey: number, wallT: number,
): boolean {
  return classifyStandaloneWall(rects, sx, sy, ex, ey, wallT).external;
}

// Classify a standalone wall AND report which of its two faces is the weather
// face, expressed as the sign of the wall's LOCAL +Z (thickness) axis. The
// wall's local +Z maps to the world perpendicular (-dy, dx) (see the rotY the
// 3D renderer uses), so:
//   +1  → the local +Z face is the weather face
//   -1  → the local -Z face is the weather face
//    0  → both faces weather-facing (freestanding), or neither (internal)
export function classifyStandaloneWall(
  rects: ReadonlyArray<Rect & { floor?: number }>,
  sx: number, sy: number, ex: number, ey: number, wallT: number, minFloor = -Infinity,
): { external: boolean; outerSign: 1 | -1 | 0 } {
  const len = Math.hypot(ex - sx, ey - sy);
  if (len <= 0) return { external: false, outerSign: 0 };
  rects = rects.filter((r) => (r.floor ?? 0) >= minFloor);
  const probe = probeDist(wallT);
  const mx = (sx + ex) / 2, my = (sy + ey) / 2;
  const dx = (ex - sx) / len, dy = (ey - sy) / len;
  // Local +Z ↔ perpendicular (-dy, dx); local -Z ↔ (dy, -dx).
  const plusExt = !inAnyRoom(rects, mx + -dy * probe, my + dx * probe);
  const minusExt = !inAnyRoom(rects, mx + dy * probe, my + -dx * probe);
  const external = plusExt || minusExt;
  const outerSign: 1 | -1 | 0 = plusExt && !minusExt ? 1 : minusExt && !plusExt ? -1 : 0;
  return { external, outerSign };
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

// ---- main ------------------------------------------------------------------

export function computeWallAreas(config: HouseConfig): WallAreaReport {
  const units = readUnits(config);
  const defaults = (config as Bag).defaults as Bag | undefined;
  const defWallH = num(defaults?.wall_height, 90);
  const wallT = num(defaults?.wall_thickness, 8);
  const probe = Math.max(6, wallT * 1.5);
  const rects = allRoomRects(config);

  const external = triple(), internal = triple();
  const inventory: WallInvRow[] = [];
  const perFloor: FloorAreas[] = [];

  const floors = (config.floors ?? []) as Bag[];
  for (let fi = 0; fi < floors.length; fi++) {
    const fl = floors[fi];
    const floorWallH = num(fl.wall_height, defWallH);
    const fExt = triple(), fInt = triple();
    const objs = (fl.objects ?? []) as Bag[];

    // sides declared on this floor's rooms — used to skip an interior outward
    // face when the neighbour models the same partition from its own side.
    const declared = objs
      .filter((o) => o.type === "room" && o.enabled !== false)
      .map((o) => ({ rect: { x: num(o.x), y: num(o.y), w: num(o.width), l: num(o.length) }, sides: roomSides(o) }));

    for (const o of objs) {
      if (o.enabled === false) continue;

      if (o.type === "room") {
        const rx = num(o.x), ry = num(o.y), rw = num(o.width), rl = num(o.length);
        const roomH = o.height !== undefined ? num(o.height) : undefined;
        const sides = roomSides(o);
        for (const side of Object.keys(sides) as Side[]) {
          const wc = sides[side];
          const h = wc?.height !== undefined ? num(wc.height) : roomH ?? floorWallH;
          const len = side === "north" || side === "south" ? rw : rl;
          const face = len * h;
          const op = openingsArea(wc);
          const faceNet = Math.max(0, face - op);
          // INSIDE (room-facing) face is always interior.
          add(internal, face, op); add(fInt, face, op);
          let extA = 0, intA = faceNet;
          // OUTSIDE face — classify.
          const [nx, ny] = OUT_NORMAL[side];
          const cx = side === "east" ? rx + rw : side === "west" ? rx : rx + rw / 2;
          const cy = side === "south" ? ry + rl : side === "north" ? ry : ry + rl / 2;
          const px = cx + nx * probe, py = cy + ny * probe;
          let type: "external" | "internal";
          if (inAnyRoom(rects, px, py)) {
            type = "internal"; // outside face is protected (another room / void)
            // Count the far face too, unless the neighbour models the same
            // partition (then its inner face already counts this surface).
            if (!neighbourDeclares(declared, { x: rx, y: ry, w: rw, l: rl }, side, px, py, wallT)) {
              add(internal, face, op); add(fInt, face, op);
              intA += faceNet;
            }
          } else {
            type = "external"; // outside face is weather-facing
            add(external, face, op); add(fExt, face, op);
            extA = faceNet;
          }
          inventory.push({ floor: fi, room: String(o.name ?? "Room"), wall: side, type, lengthU: len, heightU: h, extAreaU: extA, intAreaU: intA });
        }
      } else if (o.type === "wall") {
        const sx = num(o.start_x), sy = num(o.start_y), ex = num(o.end_x), ey = num(o.end_y);
        const len = Math.hypot(ex - sx, ey - sy);
        if (len <= 0) continue;
        const h = o.height !== undefined ? num(o.height) : floorWallH;
        const face = len * h;
        const op = openingsArea(o);
        const faceNet = Math.max(0, face - op);
        const mx = (sx + ex) / 2, my = (sy + ey) / 2;
        // unit perpendicular
        const dx = (ex - sx) / len, dy = (ey - sy) / len;
        const perps: [number, number][] = [[-dy, dx], [dy, -dx]];
        let extA = 0, intA = 0, anyExt = false;
        for (const [pnx, pny] of perps) {
          const px = mx + pnx * probe, py = my + pny * probe;
          if (inAnyRoom(rects, px, py)) { add(internal, face, op); add(fInt, face, op); intA += faceNet; }
          else { add(external, face, op); add(fExt, face, op); extA += faceNet; anyExt = true; }
        }
        inventory.push({ floor: fi, room: String(o.name ?? "Wall"), wall: "(wall)", type: anyExt ? "external" : "internal", lengthU: len, heightU: h, extAreaU: extA, intAreaU: intA });
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

const ALL_SIDES: readonly Side[] = ["north", "south", "east", "west"];

// Normalise a room's `walls` (dict {side:cfg}, array of side names, or OMITTED)
// to a side→config map. A declared block (dict or array) is a whitelist of the
// sides that exist. An ABSENT block means all four walls — because that is what
// the 3D renderer builds (emitRoomWalls defaults undefined → [n,s,e,w]); the
// wall-area report must count the walls the model actually draws, or a bare room
// shows a full box in 3D but zero wall area in Quantities.
function roomSides(o: Bag): Partial<Record<Side, Bag>> {
  const w = o.walls;
  const out: Partial<Record<Side, Bag>> = {};
  if (Array.isArray(w)) {
    for (const s of w) if (isSide(s)) out[s] = {};
  } else if (w && typeof w === "object") {
    for (const s of Object.keys(w as Bag)) if (isSide(s)) out[s] = (w as Bag)[s] as Bag;
  } else {
    for (const s of ALL_SIDES) out[s] = {}; // no block → enclosed (all four)
  }
  return out;
}
function isSide(s: unknown): s is Side {
  return s === "north" || s === "south" || s === "east" || s === "west";
}

// Does the room containing the sample point declare a wall on the side facing
// back toward us, at nearly the same location? If so, that neighbour's inner
// face already accounts for this surface → we skip our outer face.
function neighbourDeclares(
  declared: { rect: Rect; sides: Partial<Record<Side, Bag>> }[],
  self: Rect, side: Side, px: number, py: number, wallT: number,
): boolean {
  const back = OPPOSITE[side];
  const tol = wallT * 1.5 + 2;
  for (const d of declared) {
    if (d.rect === self || (d.rect.x === self.x && d.rect.y === self.y && d.rect.w === self.w && d.rect.l === self.l)) continue;
    // must contain the sample point
    if (!(px > d.rect.x && px < d.rect.x + d.rect.w && py > d.rect.y && py < d.rect.y + d.rect.l)) continue;
    if (!d.sides[back]) continue;
    const edge = back === "north" ? d.rect.y : back === "south" ? d.rect.y + d.rect.l : back === "west" ? d.rect.x : d.rect.x + d.rect.w;
    const ours = side === "north" ? self.y : side === "south" ? self.y + self.l : side === "west" ? self.x : self.x + self.w;
    if (Math.abs(edge - ours) <= tol) return true;
  }
  return false;
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
