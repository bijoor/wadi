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
import { anchorItem, anchorFacing, type RoomRect } from "./furnitureAnchor";

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

  // Centreline convention (plans/grid-convention.md): in "center" mode a rect
  // object's x/y/width/length are wall CENTRELINES, and a point object (pillar)
  // sits CENTRED on its coordinate — both reference the grid directly.
  //   • room / floor_slab / plinth — grow each to the OUTER face (−t/2 origin,
  //     +t extent) so the wall-drawing below (which insets inward by t) lands the
  //     wall centred on the boundary; two rooms sharing a centreline produce the
  //     same wall (one shared wall). Rooms ABUT on grid lines, no overlap, no math.
  //   • pillar — NOT adjusted. A pillar's (x,y) is its TOP-LEFT CORNER in BOTH
  //     conventions (columns align to corners; author them where the corner
  //     should sit). To CENTRE a column on a grid node/point, subtract half its
  //     own footprint in the formula: `x:"= main.x1 - pillarW/2"`. Size is the
  //     physical column, never grown by t.
  if ((hc as { coord_convention?: string }).coord_convention === "center" && hc.floors) {
    const RECT_TYPES = new Set(["room", "floor_slab", "plinth"]);
    for (const fl of hc.floors) {
      for (const o of (fl.objects ?? []) as Obj[]) {
        const r = o as Record<string, unknown>;
        if (RECT_TYPES.has(o.type as string)) {
          const ot = (typeof r.wall_thickness === "number" ? (r.wall_thickness as number) : t);
          if (typeof r.x === "number") r.x = (r.x as number) - ot / 2;
          if (typeof r.y === "number") r.y = (r.y as number) - ot / 2;
          if (typeof r.width === "number") r.width = (r.width as number) + ot;
          if (typeof r.length === "number") r.length = (r.length as number) + ot;
        } else if (o.type === "roof") {
          // A roof segment's start→end is its ridge/axis and `width` its span
          // CENTRED on that axis (svg2d/roof/v2/segments.ts segmentRect). In
          // "center" mode those coordinates are wall CENTRELINES — so a roof
          // drawn on the same grid as the rooms sits t/2 short of the outer wall
          // face on every side. Grow each segment to the outer face exactly like
          // a room: extend the axis by t/2 at each end and widen by t. Overhang
          // then extends further out from the outer face, as expected. (Without
          // this the roof lands half a wall-thickness inside the walls.)
          const segs = r.segments as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(segs)) {
            const half = t / 2;
            for (const s of segs) {
              const st = s.start as unknown;
              const en = s.end as unknown;
              if (
                Array.isArray(st) && Array.isArray(en) &&
                typeof st[0] === "number" && typeof st[1] === "number" &&
                typeof en[0] === "number" && typeof en[1] === "number"
              ) {
                const dx = (en[0] as number) - (st[0] as number);
                const dy = (en[1] as number) - (st[1] as number);
                const len = Math.hypot(dx, dy);
                if (len > 0) {
                  const ux = dx / len;
                  const uy = dy / len;
                  s.start = [(st[0] as number) - ux * half, (st[1] as number) - uy * half];
                  s.end = [(en[0] as number) + ux * half, (en[1] as number) + uy * half];
                }
              }
              if (typeof s.width === "number") s.width = (s.width as number) + t;
            }
          }
        }
      }
    }
  }

  const floorList = (hc.floors ?? []) as Floor[];
  // Scope (variables + points) for resolving furniture-item `= formula` fields.
  // Nested room items aren't reached by resolveParametric, so we evaluate their
  // rotation/scale/gap/z_offset formulas here; free items are already resolved
  // top-level (re-eval is idempotent).
  const { scope: itemScope } = buildScope(houseConfig as Parameters<typeof buildScope>[0]);
  const ITEM_FORMULA_FIELDS = ["rotation", "scale", "z_offset", "gap_x", "gap_y"] as const;
  const resolveItemFormulas = (spec: Obj): Obj => {
    const fm = spec.formulas as Record<string, string> | undefined;
    if (!fm) return spec;
    const out: Obj = { ...spec };
    for (const f of ITEM_FORMULA_FIELDS) {
      const src = fm[f];
      if (!src) continue;
      const r = evalFormula(src, itemScope);
      if (r.value !== null) (out as Record<string, unknown>)[f] = r.value;
      else if (opts?.lenient) {
        opts.onWarning?.(`item '${(spec.name as string) ?? "?"}' ${f}: ${r.error ?? "invalid formula"}`);
      }
    }
    return out;
  };
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
    // Room footprints on this floor, for furniture anchoring (nested items + free
    // items with `anchor_to`). Rooms are already resolved to concrete x/y/w/l.
    const units = (hc as { units?: { system?: string; per_unit?: number } }).units;
    const roomRects = new Map<string, RoomRect>();
    for (const o of objs) {
      if (o.type === "room" && typeof o.name === "string") {
        roomRects.set(o.name, {
          x: o.x as number,
          y: o.y as number,
          w: o.width as number,
          l: o.length as number,
        });
      }
    }
    // Build a flattened `item` from an anchor spec relative to a room rect. Resolves
    // the spec's `= formula` fields (rotation/scale/gap/z_offset) first.
    const anchoredItem = (rect: RoomRect, specIn: Obj): Obj => {
      const spec = resolveItemFormulas(specIn);
      // An anchored piece with no explicit `rotation` faces AWAY from its wall,
      // into the room (anchorFacing). An explicit rotation always wins. The
      // resolved rotation is written back onto the flattened item, so the plan
      // notch, the 3D view and anything reading the config all show the same
      // orientation — the anchor never silently changes facing behind the model.
      const rotation =
        (spec.rotation as number | undefined) ?? anchorFacing(spec.anchor as string | undefined);
      const p = anchorItem(
        rect,
        {
          anchor: spec.anchor as string | undefined,
          gapX: spec.gap_x as number | undefined,
          gapY: spec.gap_y as number | undefined,
          rotation,
          scale: spec.scale as number | undefined,
          dimensions: (spec.asset as { dimensions: [number, number, number] }).dimensions,
        },
        t,
        units,
      );
      return {
        type: "item",
        name: spec.name,
        asset: spec.asset,
        x: p.x,
        y: p.y,
        rotation,
        scale: spec.scale,
        z_offset: spec.z_offset,
        layer: spec.layer,
      } as Obj;
    };
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
      // A free-standing item may anchor to a named room — derive its x/y from that
      // room's footprint so it follows a parametric resize. Absolute otherwise.
      if (obj.type === "item") {
        const at = (obj as { anchor_to?: string }).anchor_to;
        if (at) {
          const rr = roomRects.get(at);
          if (rr) {
            const p = anchoredItem(rr, obj);
            obj.x = p.x;
            obj.y = p.y;
            obj.rotation = (p as { rotation?: number }).rotation; // explicit, else anchor-derived
          } else if (opts?.lenient) {
            opts.onWarning?.(`item '${obj.name ?? "?"}': anchor_to room '${at}' not found`);
          }
        }
        head.push(obj);
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
      // Flatten a room's nested furniture into absolute-positioned `item`s, anchored
      // to the (resolved) room footprint. Renderers only ever see the flat items.
      if (obj.type === "room" && Array.isArray((obj as { items?: unknown[] }).items)) {
        const rr: RoomRect = {
          x: obj.x as number,
          y: obj.y as number,
          w: obj.width as number,
          l: obj.length as number,
        };
        for (const it of activeObjects((obj as { items?: Obj[] }).items)) {
          head.push(anchoredItem(rr, it));
        }
        delete (first as { items?: unknown }).items; // strip from the expanded room
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
  params?: Array<{ name?: string; default?: number }>;
  variables?: Record<string, number | string>;
  points?: Record<string, { x: number | string; y: number | string }>;
};

// Objects whose x/y is a TOP-LEFT box corner (not a centre) — rotated via their
// centre so the box stays axis-aligned at right angles.
const BOX_TYPES = new Set(["room", "pillar", "beam", "floor_slab", "plinth", "ground"]);
// Objects that can rotate to ANY angle (points / segments). Everything else is
// only exact at a right angle (see placeComponent's guard).
const ANY_ANGLE_TYPES = new Set(["item", "wall"]);

const SIDE_NORMAL: Record<Side, [number, number]> = {
  north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0],
};
// Rotate a cardinal side by (cos,sin) [clockwise, Y-down] and snap to a cardinal.
// Exact at right angles (cos/sin are 0/±1); a diagonal snaps to the nearer axis.
function rotateSide(side: Side, cos: number, sin: number): Side {
  const [nx, ny] = SIDE_NORMAL[side];
  const rx = nx * cos + ny * sin;
  const ry = -nx * sin + ny * cos;
  if (Math.abs(rx) >= Math.abs(ry)) return rx >= 0 ? "east" : "west";
  return ry >= 0 ? "south" : "north";
}
const isSide = (s: unknown): s is Side => typeof s === "string" && SIDES.includes(s as Side);

// Place a set of already-resolved component objects: ROTATE each about the
// component's local origin by `deg` (clockwise, matching item yaw: 0=south,
// 90=east), then translate by (dx, dy) and lift by dz. A rigid rotation, so every
// object keeps its relationship to the others; box types re-derive their corner
// from the rotated centre (dims swap at 90/270), rooms/openings remap their
// cardinal sides/direction, and items add `deg` to their yaw. `wallThickness`
// resolves a pillar's auto (unset) dimension before the box rotates. Strips
// resolved `formulas` so nothing undoes the placement.
function placeComponent(objs: Obj[], dx: number, dy: number, dz: number, deg: number, wallThickness: number): Obj[] {
  const norm = ((deg % 360) + 360) % 360;
  const rad = (norm * Math.PI) / 180;
  const clean = (v: number) => Math.round(v * 1e12) / 1e12; // kill fp dust so 90° is exact
  const cos = clean(Math.cos(rad));
  const sin = clean(Math.sin(rad));
  const swap = norm === 90 || norm === 270;
  const rp = (x: number, y: number): [number, number] => [x * cos + y * sin, -x * sin + y * cos];

  return objs.map((o) => {
    const n = { ...o } as Obj & Record<string, unknown>;
    if (norm !== 0) {
      if (BOX_TYPES.has(n.type as string)) {
        const w = typeof n.width === "number" ? n.width : wallThickness;
        const l = typeof n.length === "number" ? n.length : wallThickness;
        const [rcx, rcy] = rp((n.x as number) + w / 2, (n.y as number) + l / 2);
        const w2 = swap ? l : w, l2 = swap ? w : l;
        n.x = rcx - w2 / 2; n.y = rcy - l2 / 2; n.width = w2; n.length = l2;
      } else if (typeof n.x === "number" && typeof n.y === "number") {
        [n.x, n.y] = rp(n.x, n.y); // item centre, door/window anchor
      }
      if (typeof n.start_x === "number" && typeof n.start_y === "number") [n.start_x, n.start_y] = rp(n.start_x, n.start_y);
      if (typeof n.end_x === "number" && typeof n.end_y === "number") [n.end_x, n.end_y] = rp(n.end_x, n.end_y);
      if (Array.isArray(n.path)) n.path = (n.path as unknown[]).map((pt) => (Array.isArray(pt) && pt.length >= 2 ? rp(pt[0] as number, pt[1] as number) : pt));
      if (isSide(n.direction)) n.direction = rotateSide(n.direction, cos, sin);
      if (isSide(n.facing)) n.facing = rotateSide(n.facing, cos, sin);
      if (Array.isArray(n.walls)) n.walls = (n.walls as unknown[]).map((s) => (isSide(s) ? rotateSide(s, cos, sin) : s));
      if (n.wall_heights && typeof n.wall_heights === "object") {
        const wh: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(n.wall_heights as Record<string, unknown>)) wh[isSide(k) ? rotateSide(k, cos, sin) : k] = v;
        n.wall_heights = wh;
      }
      if (n.type === "item") n.rotation = (((typeof n.rotation === "number" ? n.rotation : 0) + norm) % 360 + 360) % 360;
    }
    // translate
    if (typeof n.x === "number") n.x += dx;
    if (typeof n.y === "number") n.y += dy;
    if (typeof n.start_x === "number") n.start_x += dx;
    if (typeof n.end_x === "number") n.end_x += dx;
    if (typeof n.start_y === "number") n.start_y += dy;
    if (typeof n.end_y === "number") n.end_y += dy;
    if (Array.isArray(n.path)) n.path = (n.path as unknown[]).map((pt) => (Array.isArray(pt) && pt.length >= 2 ? [(pt[0] as number) + dx, (pt[1] as number) + dy] : pt));
    if (dz !== 0) n.z_offset = (typeof n.z_offset === "number" ? n.z_offset : 0) + dz;
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

  // Declared `param` defaults seed the component's scope so a formula field that
  // references an un-overridden param (e.g. `max_run run` with `param run = 200`)
  // resolves to the default. Precedence: param defaults < component `var`s <
  // instance overrides.
  const paramDefaults: Record<string, number> = {};
  for (const p of (def.params ?? []) as Array<{ name?: string; default?: number }>) {
    if (p.name && typeof p.default === "number") paramDefaults[p.name] = p.default;
  }

  const subConfig = {
    components: hostConfig.components,
    variables: { ...paramDefaults, ...(def.variables ?? {}), ...overrides },
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
  const deg = typeof inst.rotation === "number" ? inst.rotation : 0;

  // A non-right angle only rotates points/segments exactly; a room / pillar /
  // beam / slab / staircase / door / window can't tilt its axis-aligned footprint
  // to an arbitrary angle. Reject it clearly rather than silently desync the
  // furniture from its walls. (Arbitrary structural rotation is a future need.)
  if (((deg % 90) + 90) % 90 !== 0) {
    const bad = bodyObjs.find((b) => !ANY_ANGLE_TYPES.has(String(b.type)));
    if (bad) {
      throw new Error(
        `component '${ref}' rotation ${deg}° is not a right angle — its ${String(bad.type)}` +
          `${bad.name ? ` '${String(bad.name)}'` : ""} can't rotate to a non-right angle. ` +
          `Use 0/90/180/270 for structural components; free angles are for furniture-only components.`,
      );
    }
  }
  return placeComponent(bodyObjs, dx, dy, dz, deg, wallThickness);
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
