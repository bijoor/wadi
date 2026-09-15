// Furnish a room: run the placement engine for one room and write the result into its
// `furniture` container (plans/room-templates-in-wadi.md, Phase 3). Headless + pure — the
// studio "furnish room" command is a thin wrapper over this. This is the RE-CONFIGURE step:
// the furniture body changes only here, never at render.
//
// It resolves the block's layout SOURCE (the room's native `type`; an explicit `type`; or a
// `room` ref — a same-house sibling to clone, or a module template to pin), reads the room's
// resolved geometry + door/gap intervals (via resolveParametric + expandRoomWalls, so the
// placement matches what the pipeline draws), places the pieces, and materialises them into
// the block — honoring `locked` (a locked block is never touched; locked items are kept).

import { resolveParametric } from "../param/resolve";
import { expandRoomWalls } from "../svg2d/expand";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import {
  autoplaceRoom,
  openingIntervals,
  type Layout,
  type FlatOpening,
  type Units,
  type SideIntervals,
} from "./autoplace";
import type { RoomRect } from "../svg2d/furnitureAnchor";
import { layoutFromRoom } from "./roomLayouts";

type Obj = Record<string, unknown>;
type Config = { floors?: Array<{ floor_number?: number; objects?: Obj[] }>; defaults?: { wall_thickness?: number }; units?: Units };

export interface FurnishResult {
  furnished: boolean;
  reason?: string; // when not furnished: "locked" | "no-source" | "no-layout" | "no-geometry" | "not-found"
  template?: string | null;
  kept?: number;
}

// The resolved geometry the engine needs for a room, read from a resolved + expanded copy so
// the door/gap intervals and inner-face inset match the rendered model exactly.
function roomGeometry(config: Config, roomName: string): { rect: RoomRect; wallT: number; units?: Units; doors: SideIntervals; gaps: SideIntervals } | null {
  let resolved: Config;
  try {
    resolved = expandRoomWalls(resolveParametric(structuredClone(config) as never).config as never) as unknown as Config;
  } catch {
    return null;
  }
  let room: Obj | undefined;
  // Collect EVERY opening on the floor (with its owning room), then attribute the ones that
  // physically lie on this room's walls — including doors OWNED by the adjacent room on a
  // shared wall. Without this the furnish never sees a neighbour's door and drops furniture
  // straight on top of it (with no error), which is exactly the reported bug.
  const allOpenings: Array<{ type: string; x: number; y: number; width: number; direction: FlatOpening["direction"]; own: boolean }> = [];
  for (const f of resolved.floors ?? []) {
    for (const o of f.objects ?? []) {
      if (o.type === "room" && o.name === roomName) room = o;
      else if (o.type === "door" || o.type === "gap") {
        allOpenings.push({
          type: o.type as string,
          x: o.x as number,
          y: o.y as number,
          width: o.width as number,
          direction: o.direction as FlatOpening["direction"],
          own: o.room === roomName,
        });
      }
    }
  }
  if (!room || typeof room.x !== "number" || typeof room.width !== "number") return null;
  const rect: RoomRect = { x: room.x as number, y: room.y as number, w: room.width as number, l: room.length as number };
  const wallT =
    (typeof room.wall_thickness === "number" ? (room.wall_thickness as number) : undefined) ??
    config.defaults?.wall_thickness ??
    DEFAULT_GLOBAL_CONFIG.wall_thickness;
  // A neighbour's opening counts when its segment sits on one of this room's four wall lines
  // (within a wall thickness) and overlaps that wall's span — remapped to THIS room's side.
  const rx0 = rect.x, ry0 = rect.y, rx1 = rect.x + rect.w, ry1 = rect.y + rect.l;
  const edgeTol = wallT + 4;
  const openings: FlatOpening[] = [];
  for (const op of allOpenings) {
    if (op.own) {
      openings.push({ type: op.type, x: op.x, y: op.y, width: op.width, direction: op.direction });
      continue;
    }
    const horiz = op.direction === "north" || op.direction === "south";
    if (horiz) {
      if (!(op.x + op.width > rx0 && op.x < rx1)) continue; // no span overlap on this wall
      if (Math.abs(op.y - ry0) <= edgeTol) openings.push({ type: op.type, x: op.x, y: op.y, width: op.width, direction: "north" });
      else if (Math.abs(op.y - ry1) <= edgeTol) openings.push({ type: op.type, x: op.x, y: op.y, width: op.width, direction: "south" });
    } else {
      if (!(op.y + op.width > ry0 && op.y < ry1)) continue;
      if (Math.abs(op.x - rx0) <= edgeTol) openings.push({ type: op.type, x: op.x, y: op.y, width: op.width, direction: "west" });
      else if (Math.abs(op.x - rx1) <= edgeTol) openings.push({ type: op.type, x: op.x, y: op.y, width: op.width, direction: "east" });
    }
  }
  const { doorIntervals, gapIntervals } = openingIntervals(openings);
  return { rect, wallT, units: config.units, doors: doorIntervals, gaps: gapIntervals };
}

function findRoom(config: Config, name: string): Obj | undefined {
  for (const f of config.floors ?? []) for (const o of f.objects ?? []) if (o.type === "room" && o.name === name) return o;
  return undefined;
}

// Resolve the block's layout SOURCE to a candidate pool + the type to match. A `room` ref
// (sibling clone or pinned module template) yields ONE exact layout; its target size is
// zeroed so it always fits (the user chose it explicitly — anchored items reflow to size).
function resolveSource(config: Config, room: Obj, fb: Obj, layouts: Layout[]): { pool: Layout[]; roomType: string } | null {
  const exact = (l: Layout): { pool: Layout[]; roomType: string } => ({ pool: [{ ...l, w: 0, l: 0 }], roomType: l.type });
  if (typeof fb.auto_type === "string" && fb.auto_type) return { pool: layouts, roomType: fb.auto_type };
  if (typeof fb.auto_room === "string" && fb.auto_room) {
    if (typeof fb.auto_room_module === "string" && fb.auto_room_module) {
      // Pin a module template. (The passed `layouts` is the module pool for now; multi-module
      // resolution by namespace is a later refinement.)
      const found = layouts.find((l) => l.id === fb.auto_room);
      return found ? exact(found) : null;
    }
    // Clone a same-house sibling room's furniture arrangement.
    const sib = findRoom(config, fb.auto_room);
    return sib ? exact(layoutFromRoom(sib as never)) : null;
  }
  if (typeof room.room_type === "string" && room.room_type) return { pool: layouts, roomType: room.room_type as string };
  return null;
}

// Furnish `roomName` on floor `floorNumber` from the layout pack `layouts`. Returns a NEW
// config (the input is not mutated) plus a result summary.
export function furnishRoom(config: Config, floorNumber: number, roomName: string, layouts: Layout[]): { config: Config; result: FurnishResult } {
  const out = structuredClone(config) as Config;
  const floor = (out.floors ?? []).find((f, i) => (f.floor_number ?? i + 1) === floorNumber);
  const room = floor?.objects?.find((o) => o.type === "room" && o.name === roomName);
  if (!room) return { config: out, result: { furnished: false, reason: "not-found" } };

  const fb = (room.furniture && typeof room.furniture === "object" ? (room.furniture as Obj) : {}) as Obj;
  if (fb.locked) return { config: out, result: { furnished: false, reason: "locked" } };

  const src = resolveSource(out, room, fb, layouts);
  if (!src) return { config: out, result: { furnished: false, reason: "no-source" } };

  const geom = roomGeometry(config, roomName);
  if (!geom) return { config: out, result: { furnished: false, reason: "no-geometry" } };

  // Any locked items already in the block are always kept (rule 4).
  const existing = Array.isArray(fb.items) ? (fb.items as Obj[]) : [];
  const lockedKept = existing.filter((it) => it.locked);

  const res = autoplaceRoom(src.pool, src.roomType, {
    rect: geom.rect,
    wallT: geom.wallT,
    units: geom.units,
    doorIntervals: geom.doors,
    gapIntervals: geom.gaps,
  });
  if (!res.template && !res.items.length) {
    // Nothing fits this room (e.g. it was shrunk below every template's target). CLEAR the
    // engine-managed items so the room doesn't keep furniture too big for it — but keep any
    // locked pieces. If there were no auto items to clear, report unchanged (not-furnished),
    // so callers/counters don't over-report a no-op.
    if (existing.length > lockedKept.length) {
      room.furniture = { ...fb, auto: true, items: lockedKept };
      return { config: out, result: { furnished: true, template: null, kept: lockedKept.length } };
    }
    return { config: out, result: { furnished: false, reason: "no-layout" } };
  }

  // Materialise into the block, KEEPING any locked items already there. Mark the block `auto`
  // so it stays tool-managed.
  room.furniture = { ...fb, auto: true, items: [...lockedKept, ...res.items] };

  return { config: out, result: { furnished: true, template: res.template, kept: res.items.length } };
}
