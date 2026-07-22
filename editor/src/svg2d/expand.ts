// TypeScript port of house_expand.py — rewrites nested `room.walls[side]`
// and `wall.openings` into the flat schema that the SVG generators
// consume. Idempotent (marks the config with `_walls_expanded: true`).
// Non-destructive: input is deep-cloned before rewrite.
//
// Numeric-type preservation matters: the Python port keeps int in → int
// out so downstream SVG formatting emits "110" not "110.0". JavaScript
// only has one number type so this is a non-issue in TS.

import { DEFAULT_GLOBAL_CONFIG } from "./config";
import { activeObjects } from "../schema/enabled";
import { resolveParametric } from "../param/resolve";
import { buildScope } from "../param/resolve";
import { evalFormula } from "../param/formula";
import { expandStaircase } from "./stairExpand";

type Side = "north" | "south" | "east" | "west";
const SIDES: readonly Side[] = ["north", "south", "east", "west"];

type Opening = {
  kind: "door" | "window";
  name?: string;
  offset: number;
  width: number;
  height: number;
  sill_height?: number;
  direction?: Side;
  facing?: Side;
};

type RoomWallSide = {
  height?: number;
  height_end?: number;
  openings?: Opening[];
};

type RoomWalls =
  | Side[]
  | {
      north?: RoomWallSide;
      south?: RoomWallSide;
      east?: RoomWallSide;
      west?: RoomWallSide;
    };

type Room = {
  type: "room";
  name: string;
  x: number;
  y: number;
  width: number;
  length: number;
  walls?: RoomWalls;
  wall_heights?: Record<string, unknown>;
  [key: string]: unknown;
};

type Wall = {
  type: "wall";
  name: string;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  facing?: Side;
  openings?: Opening[];
  [key: string]: unknown;
};

// Loose typing for the SVG stage — the editor's Zod schema enforces
// stricter shapes upstream; here we operate on the same JSON blob the
// Python side does, without imposing extra constraints.
type Obj = { type: string; [key: string]: unknown };
type Floor = { objects: Obj[]; [key: string]: unknown };
export type HouseConfig = {
  floors: Floor[];
  _walls_expanded?: boolean;
  [key: string]: unknown;
};

export interface ExpandOptions {
  // When true, a wall/room whose openings fail validation (out-of-range,
  // diagonal wall, zero length, overlap…) is emitted WITHOUT its openings
  // — rendered as a solid wall — instead of aborting the whole expansion.
  // The error message is reported via `onWarning`. This keeps a single bad
  // object (e.g. a wall mid-edit) from blanking the entire 3D scene.
  lenient?: boolean;
  onWarning?: (message: string) => void;
}

export function expandRoomWalls(
  houseConfig: HouseConfig,
  wallThickness?: number,
  opts?: ExpandOptions,
  // Internal: component-instance nesting depth (guards against a component that
  // references itself / a cycle). Callers never pass this.
  _depth = 0,
): HouseConfig {
  if (houseConfig._walls_expanded) return houseConfig;
  const t =
    (houseConfig.defaults as { wall_thickness?: number } | undefined)?.wall_thickness ??
    wallThickness ??
    DEFAULT_GLOBAL_CONFIG.wall_thickness;

  const hc = structuredClone(houseConfig);
  // Drop switched-off FLOORS entirely (a floor `enabled === false`/`0`, e.g.
  // driven by "= has_upper_floor") — every 2D/3D/roof consumer reads hc.floors,
  // and the 3D z-band stacking is computed from this same list, so a disabled
  // upper floor simply doesn't exist and the house becomes single-storey.
  if (hc.floors) hc.floors = activeObjects(hc.floors);
  const floorList = (hc.floors ?? []) as Floor[];
  for (let fi = 0; fi < floorList.length; fi++) {
    const floor = floorList[fi];
    // Drop switched-off objects up front, so they generate no walls and reach
    // no downstream view (3D / roof / bounds / dimensions).
    floor.objects = activeObjects(floor.objects as Obj[] | undefined);
    const objs = floor.objects ?? [];
    const head: Obj[] = [];
    const deferredDoors: Obj[] = [];
    const deferredWindows: Obj[] = [];
    // Effective slab thickness for THIS floor — the default TOP height of a
    // staircase (see stairExpand). Mirrors computeFloorZBands' resolution.
    const houseDefaults = hc.defaults as
      | { slab_thickness?: number; floor_height?: number }
      | undefined;
    const floorSlabThickness =
      (floor.slab_thickness as number | undefined) ??
      houseDefaults?.slab_thickness ??
      DEFAULT_GLOBAL_CONFIG.floor_slab_thickness;
    // Height of the floor immediately BELOW this one (array order = stack) — the
    // default `rise_height` for a staircase that owns this floor and descends to
    // it. Falls back to the house/global default floor height.
    const belowHeightRaw = fi > 0 ? floorList[fi - 1].height : undefined;
    const floorBelowHeight =
      typeof belowHeightRaw === "number" && belowHeightRaw > 0
        ? belowHeightRaw
        : houseDefaults?.floor_height ?? DEFAULT_GLOBAL_CONFIG.floor_height;
    for (const obj of objs) {
      // A component instance expands into a whole set of already-flattened
      // primitives (resolve the referenced component with param+placement
      // overrides → recurse → offset). Distribute them like any expanded
      // objects: doors/windows last, everything else in head order.
      if (obj.type === "component") {
        let comp: Obj[];
        try {
          comp = expandComponent(obj, houseConfig, t, opts, _depth);
        } catch (e) {
          if (!opts?.lenient) throw e;
          opts.onWarning?.(e instanceof Error ? e.message : String(e));
          comp = [];
        }
        for (const c of comp) {
          if (c.type === "door") deferredDoors.push(c);
          else if (c.type === "window") deferredWindows.push(c);
          else head.push(c);
        }
        continue;
      }
      // A staircase is TOP-anchored and descends: expand to single-flight
      // staircase(s) + any switchback landings, with num_steps derived from
      // rise_height (defaulting to the floor-below height).
      if (obj.type === "staircase") {
        let flights: Obj[];
        try {
          flights = expandStaircase(obj, floorSlabThickness, floorBelowHeight);
        } catch (e) {
          if (!opts?.lenient) throw e;
          opts.onWarning?.(e instanceof Error ? e.message : String(e));
          flights = [obj];
        }
        for (const f of flights) head.push(f);
        continue;
      }
      let first: Obj;
      let extras: Obj[];
      try {
        [first, extras] = expandObject(obj, t);
      } catch (e) {
        // Strict (default): propagate — preserves the parity harness and
        // any caller that wants hard failures. Lenient: drop this object's
        // openings so it still renders as a solid wall, and report why.
        if (!opts?.lenient) throw e;
        opts.onWarning?.(e instanceof Error ? e.message : String(e));
        [first, extras] = expandObject(stripOpenings(obj), t);
      }
      head.push(first);
      for (const e of extras) {
        (e.type === "door" ? deferredDoors : deferredWindows).push(e);
      }
    }
    floor.objects = [...head, ...deferredDoors, ...deferredWindows];
  }
  hc._walls_expanded = true;
  return hc;
}

// Return a copy of a wall/room object with all openings removed, so it can
// be expanded without hitting opening validation. Non-wall/room objects are
// returned unchanged.
function stripOpenings(obj: Obj): Obj {
  if (obj.type === "wall") {
    const { openings: _drop, ...rest } = obj as Wall;
    return rest as Obj;
  }
  if (obj.type === "room") {
    const walls = (obj as Room).walls;
    if (walls && !Array.isArray(walls) && typeof walls === "object") {
      const cleaned: Record<string, RoomWallSide> = {};
      for (const [side, wc] of Object.entries(walls as Record<string, RoomWallSide>)) {
        const { openings: _drop, ...restSide } = wc ?? {};
        cleaned[side] = restSide;
      }
      return { ...obj, walls: cleaned } as Obj;
    }
  }
  return obj;
}

const MAX_COMPONENT_DEPTH = 8;

type ComponentDefLoose = {
  objects: Obj[];
  variables?: Record<string, number | string>;
  points?: Record<string, { x: number | string; y: number | string }>;
};

// Shift a set of already-resolved objects by (dx, dy) in plan and lift them by
// dz. Handles every positional field — x/y, wall/staircase endpoints, kitchen
// path points — and composes z_offset. Strips resolved `formulas` so the offset
// can't be undone by a later resolve. Never touches sizes (width/length/height).
function offsetObjects(objs: Obj[], dx: number, dy: number, dz: number): Obj[] {
  return objs.map((o) => {
    const n: Obj = { ...o };
    if (typeof n.x === "number") n.x = n.x + dx;
    if (typeof n.y === "number") n.y = n.y + dy;
    if (typeof n.start_x === "number") n.start_x = n.start_x + dx;
    if (typeof n.end_x === "number") n.end_x = n.end_x + dx;
    if (typeof n.start_y === "number") n.start_y = n.start_y + dy;
    if (typeof n.end_y === "number") n.end_y = n.end_y + dy;
    if (Array.isArray(n.path)) {
      n.path = (n.path as unknown[]).map((pt) =>
        Array.isArray(pt) && pt.length >= 2
          ? [(pt[0] as number) + dx, (pt[1] as number) + dy]
          : pt,
      );
    }
    if (dz !== 0) {
      n.z_offset = (typeof n.z_offset === "number" ? n.z_offset : 0) + dz;
    }
    if ("formulas" in n) delete n.formulas;
    return n;
  });
}

// Expand a `component` instance into concrete, placed primitives:
//  1. look up hostConfig.components[ref];
//  2. resolve the component's own sub-config with its input variables overridden
//     by the instance `params` (a "= …" param is evaluated in the HOST scope, so
//     it can reference the host's variables/points);
//  3. recursively expandRoomWalls the body (rooms→walls, nested components…);
//  4. offset every result by the instance (x, y, z_offset).
function expandComponent(
  inst: Obj,
  hostConfig: HouseConfig,
  wallThickness: number,
  opts: ExpandOptions | undefined,
  depth: number,
): Obj[] {
  if (depth >= MAX_COMPONENT_DEPTH) {
    throw new Error(`component nesting too deep (ref '${String(inst.ref)}')`);
  }
  const library = (hostConfig.components ?? {}) as Record<string, ComponentDefLoose>;
  const ref = String(inst.ref ?? "");
  const def = library[ref];
  if (!def) throw new Error(`unknown component '${ref}'`);

  // Resolve param overrides against the HOST scope (a "= …" param may reference
  // the host's variables/points; a number is used directly).
  const hostScope = buildScope(hostConfig as never).scope;
  const overrides: Record<string, number | string> = {};
  const params = (inst.params ?? {}) as Record<string, number | string>;
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") {
      const r = evalFormula(v, hostScope);
      if (r.value !== null) overrides[k] = r.value;
      else opts?.onWarning?.(`component '${ref}' param '${k}': ${r.error ?? "bad formula"}`);
    } else {
      overrides[k] = v;
    }
  }

  const subConfig = {
    components: hostConfig.components,
    variables: { ...(def.variables ?? {}), ...overrides },
    points: def.points,
    floors: [{ floor_number: 0, name: ref, objects: structuredClone(def.objects) }],
  } as unknown as HouseConfig;

  const resolved = resolveParametric(
    subConfig as never,
  ).config as unknown as HouseConfig;
  const expanded = expandRoomWalls(resolved, wallThickness, opts, depth + 1);
  const bodyObjs = (expanded.floors ?? []).flatMap((f) => (f.objects ?? []) as Obj[]);

  const dx = typeof inst.x === "number" ? inst.x : 0;
  const dy = typeof inst.y === "number" ? inst.y : 0;
  const dz = typeof inst.z_offset === "number" ? inst.z_offset : 0;
  return offsetObjects(bodyObjs, dx, dy, dz);
}

function expandObject(obj: Obj, wallThickness: number): [Obj, Obj[]] {
  if (obj.type === "room") return expandRoom(obj as Room, wallThickness);
  if (obj.type === "wall") return expandWall(obj as Wall, wallThickness);
  return [obj, []];
}

function expandRoom(room: Room, wallThickness: number): [Obj, Obj[]] {
  const walls = room.walls;
  // Old list-form or absent → nothing to expand.
  if (walls === undefined || Array.isArray(walls)) return [room, []];
  if (typeof walls !== "object") {
    throw new Error(
      `Room '${room.name}': walls must be a list, dict, or omitted.`,
    );
  }

  const rname = room.name;
  for (const side of Object.keys(walls)) {
    if (!SIDES.includes(side as Side)) {
      throw new Error(
        `Room '${rname}': unknown wall side '${side}' — expected one of ${SIDES.join(",")}.`,
      );
    }
  }

  // Rebuild the room object without the nested walls dict.
  const { walls: _dropWalls, ...rest } = room;
  const newRoom: Room = {
    ...(rest as Room),
    walls: Object.keys(walls) as Side[],
  };

  // Merge per-wall heights into wall_heights (nested overrides win).
  const mergedHeights: Record<string, unknown> = { ...(room.wall_heights ?? {}) };
  for (const side of Object.keys(walls) as Side[]) {
    const wc = walls[side];
    const h: { height?: number; height_end?: number } = {};
    if (wc?.height !== undefined) h.height = wc.height;
    if (wc?.height_end !== undefined) h.height_end = wc.height_end;
    if (Object.keys(h).length > 0) {
      const existing = { ...((mergedHeights[side] as object) ?? {}) } as {
        height?: number;
        height_end?: number;
      };
      if (h.height !== undefined && existing.height === undefined) {
        existing.height = h.height;
      }
      if (h.height_end !== undefined && existing.height_end === undefined) {
        existing.height_end = h.height_end;
      }
      mergedHeights[side] = existing;
    }
  }
  if (Object.keys(mergedHeights).length > 0) {
    newRoom.wall_heights = mergedHeights;
  }

  // Emit doors first, then windows — matches the original hand-written
  // flat-schema ordering that groups by kind.
  const rx = room.x,
    ry = room.y,
    rw = room.width,
    rl = room.length;
  const doorExtras: Obj[] = [];
  const windowExtras: Obj[] = [];
  const t = ((room as { wall_thickness?: number }).wall_thickness ??
    wallThickness) as number;

  for (const side of Object.keys(walls) as Side[]) {
    const wc = walls[side];
    const openings = wc?.openings ?? [];
    if (openings.length === 0) continue;
    const wallLength = side === "north" || side === "south" ? rw : rl;
    validateOpenings(openings, `Room '${rname}' ${side} wall`, wallLength);
    for (let i = 0; i < openings.length; i++) {
      const flat = roomOpeningToFlat(rname, side, t, rx, ry, rw, rl, openings[i], i);
      (flat.type === "door" ? doorExtras : windowExtras).push(flat);
    }
  }

  return [newRoom, [...doorExtras, ...windowExtras]];
}

function roomOpeningToFlat(
  rname: string,
  side: Side,
  t: number,
  rx: number,
  ry: number,
  rw: number,
  rl: number,
  op: Opening,
  index: number,
): Obj {
  const kind = op.kind;
  if (kind !== "door" && kind !== "window") {
    throw new Error(
      `Room '${rname}' ${side} opening #${index}: kind must be 'door' or 'window'.`,
    );
  }
  const { offset, width, height } = op;
  let x: number, y: number, direction: Side;
  if (side === "north") {
    x = rx + offset;
    y = ry;
    direction = "north";
  } else if (side === "south") {
    x = rx + offset;
    y = ry + rl - t;
    direction = "south";
  } else if (side === "west") {
    x = rx;
    y = ry + offset;
    direction = "west";
  } else {
    x = rx + rw - t;
    y = ry + offset;
    direction = "east";
  }
  if (op.direction) direction = op.direction;

  const name =
    op.name ??
    `${rname}_${side.charAt(0).toUpperCase() + side.slice(1)}_${
      kind.charAt(0).toUpperCase() + kind.slice(1)
    }_${index + 1}`;

  const flat: Obj = {
    type: kind,
    name,
    x,
    y,
    width,
    height,
    direction,
    room: rname,
  };
  if (kind === "window") flat.sill_height = op.sill_height ?? 0;
  for (const [k, v] of Object.entries(op)) {
    if (["kind", "name", "offset", "width", "height", "sill_height", "direction", "formulas"].includes(k)) {
      continue;
    }
    if (!(k in flat)) flat[k] = v;
  }
  return flat;
}

function expandWall(wall: Wall, wallThickness: number): [Obj, Obj[]] {
  const openings = wall.openings;
  if (!openings || openings.length === 0) {
    if ("openings" in wall) {
      const { openings: _drop, ...rest } = wall;
      return [rest as Obj, []];
    }
    return [wall, []];
  }

  // Preserve numeric types (input is JSON, all numbers).
  const sx = wall.start_x,
    sy = wall.start_y,
    ex = wall.end_x,
    ey = wall.end_y;
  const dx = ex - sx,
    dy = ey - sy;
  const length = Math.sqrt(dx * dx + dy * dy);
  const wallName = wall.name ?? "Wall";
  if (length <= 0) throw new Error(`Wall '${wallName}' has zero length.`);
  const ux = dx / length,
    uy = dy / length;

  const defaultFacing = inferDefaultFacing(dx, dy, wallName, wall.facing);
  validateOpenings(openings, `Wall '${wallName}'`, length);

  // Use the house's resolved wall thickness (not the code default) so the
  // opening's normal-shift matches how the 3D renderer un-shifts it — a
  // mismatch pushes the opening off the wall past the match tolerance and
  // it silently fails to render. A per-wall `thickness` still overrides.
  const wallT = ((wall as { thickness?: number }).thickness ??
    wallThickness) as number;

  const { openings: _drop, ...rest } = wall;
  const newWall: Obj = rest as Obj;
  const doorExtras: Obj[] = [];
  const windowExtras: Obj[] = [];
  for (let i = 0; i < openings.length; i++) {
    const flat = wallOpeningToFlat(
      wallName,
      sx,
      sy,
      ux,
      uy,
      wallT,
      openings[i].facing ?? defaultFacing,
      openings[i],
      i,
    );
    (flat.type === "door" ? doorExtras : windowExtras).push(flat);
  }
  return [newWall, [...doorExtras, ...windowExtras]];
}

function inferDefaultFacing(
  dx: number,
  dy: number,
  wallName: string,
  explicit: Side | undefined,
): Side {
  if (explicit !== undefined) {
    if (!SIDES.includes(explicit)) {
      throw new Error(
        `Wall '${wallName}': facing must be one of ${SIDES.join(",")}.`,
      );
    }
    return explicit;
  }
  const axisRatio = Math.abs(dx) / Math.max(Math.abs(dy), 1e-9);
  if (axisRatio > 10) return "north";
  if (axisRatio < 0.1) return "east";
  throw new Error(
    `Wall '${wallName}' is diagonal (dx=${dx}, dy=${dy}); openings need explicit facing.`,
  );
}

function wallOpeningToFlat(
  wallName: string,
  sx: number,
  sy: number,
  ux: number,
  uy: number,
  wallThickness: number,
  direction: Side,
  op: Opening,
  index: number,
): Obj {
  const kind = op.kind;
  if (kind !== "door" && kind !== "window") {
    throw new Error(
      `Wall '${wallName}' opening #${index}: kind must be 'door' or 'window'.`,
    );
  }
  const { offset, width, height } = op;
  const halfT = wallThickness / 2;
  let x: number, y: number;
  if (Math.abs(uy) > Math.abs(ux)) {
    const step = uy > 0 ? 1 : -1;
    x = sx - halfT;
    y = sy + offset * step;
  } else if (Math.abs(ux) > Math.abs(uy)) {
    const step = ux > 0 ? 1 : -1;
    x = sx + offset * step;
    y = sy - halfT;
  } else {
    x = sx + offset * ux;
    y = sy + offset * uy;
  }

  const name =
    op.name ??
    `${wallName}_${kind.charAt(0).toUpperCase() + kind.slice(1)}_${index + 1}`;

  const flat: Obj = {
    type: kind,
    name,
    x,
    y,
    width,
    height,
    direction,
    wall: wallName,
  };
  if (kind === "window") flat.sill_height = op.sill_height ?? 0;
  for (const [k, v] of Object.entries(op)) {
    if (["kind", "name", "offset", "width", "height", "sill_height", "facing", "formulas"].includes(k)) {
      continue;
    }
    if (!(k in flat)) flat[k] = v;
  }
  return flat;
}

function validateOpenings(
  openings: Opening[],
  ctx: string,
  wallLength: number,
): void {
  const seen: [number, number, string][] = [];
  for (let i = 0; i < openings.length; i++) {
    const op = openings[i];
    if (typeof op !== "object" || op === null) {
      throw new Error(`${ctx}: opening #${i} must be an object.`);
    }
    const start = Number(op.offset);
    const width = Number(op.width);
    if (!Number.isFinite(start) || !Number.isFinite(width)) {
      throw new Error(`${ctx}: opening #${i} needs numeric offset and width.`);
    }
    const end = start + width;
    const name = op.name ?? `#${i}`;
    if (start < -0.001) {
      throw new Error(`${ctx}: opening '${name}' has negative offset ${start}.`);
    }
    if (end > wallLength + 0.001) {
      throw new Error(
        `${ctx}: opening '${name}' ends at ${end.toFixed(2)} but the wall is only ${wallLength.toFixed(2)} units long.`,
      );
    }
    for (const [otherStart, otherEnd, otherName] of seen) {
      if (
        !(end <= otherStart + 0.001 || start >= otherEnd - 0.001)
      ) {
        throw new Error(
          `${ctx}: openings '${name}' (${start.toFixed(2)}-${end.toFixed(2)}) and '${otherName}' (${otherStart.toFixed(2)}-${otherEnd.toFixed(2)}) overlap.`,
        );
      }
    }
    seen.push([start, end, name]);
  }
}
