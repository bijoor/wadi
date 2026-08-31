// C11 — a declared room connection must be physically realized: the two rooms
// must OVERLAP on a wall (adjacent), AND that overlap must be passable — either a
// DOOR lies in it, or the wall is ABSENT on BOTH rooms (an open passage).
//
// A `connect` is design intent + a functional test, never geometry — the
// renderer ignores it (plans/floor-planner-graph-integration.md §5/§7). This
// constraint is what verifies the intent holds. Two error modes per declared
// pair: the rooms' walls don't overlap at all, or they overlap but a wall with no
// door in the overlap blocks the way (and it isn't left open on both sides).
//
// Coords: we read `ctx.resolved` (authored coords — `expand` clones before it
// converts, so `resolved` still carries the authored `center`/`outer` values).
// In `center` a connected pair shares a centreline exactly (edges coincide); in
// `outer` they abut or overlap by a wall thickness. `tol` (a wall thickness)
// absorbs that overlap, so the same test reads both conventions.

import { num, cap, floorLabel, objLabel, activeObjects, makeReport, type Bag } from "./vocab";
import { openingStartOffset } from "../../svg2d/openingAnchor";
import type { Constraint } from "./types";

type Side = "north" | "south" | "east" | "west";
const OPP: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };

interface Rect { x: number; y: number; w: number; l: number }
const rectOf = (o: Bag): Rect => ({ x: num(o.x), y: num(o.y), w: num(o.width), l: num(o.length) });

// The side of A that faces B and the shared wall span [lo, hi] along that wall's
// tangential axis (Y for east/west, X for north/south). null when not adjacent.
// `tol` absorbs the wall-thickness overlap of the `outer`/`center` conventions.
function sharedWall(a: Rect, b: Rect, tol: number): { side: Side; lo: number; hi: number } | null {
  const ax1 = a.x + a.w, ay1 = a.y + a.l, bx1 = b.x + b.w, by1 = b.y + b.l;
  const yLo = Math.max(a.y, b.y), yHi = Math.min(ay1, by1);
  const xLo = Math.max(a.x, b.x), xHi = Math.min(ax1, bx1);
  if (yHi - yLo > 0) { // overlap along Y → a vertical (east/west) shared wall is possible
    if (Math.abs(ax1 - b.x) <= tol) return { side: "east", lo: yLo, hi: yHi };
    if (Math.abs(bx1 - a.x) <= tol) return { side: "west", lo: yLo, hi: yHi };
  }
  if (xHi - xLo > 0) { // overlap along X → a horizontal (north/south) shared wall is possible
    if (Math.abs(ay1 - b.y) <= tol) return { side: "south", lo: xLo, hi: xHi };
    if (Math.abs(by1 - a.y) <= tol) return { side: "north", lo: xLo, hi: xHi };
  }
  return null;
}

// Does `room` carry a door on `side` whose span overlaps the shared wall [lo, hi]?
// The along-wall origin is the room's y (east/west) or x (north/south) corner. The
// door's `offset` is anchored (start | center | end) against the WALL length — the
// room's length for east/west, its width for north/south — the same conversion
// expand.ts applies (openingAnchor.ts). A door authored `from end`/`from center`
// must be resolved here too, or its span is read at the wrong place (a `from end`
// door was mis-read as start-based and flagged as "no door in the overlap").
function doorOnShared(room: Bag, side: Side, lo: number, hi: number): boolean {
  const walls = room.walls;
  if (!walls || Array.isArray(walls) || typeof walls !== "object") return false;
  const ops = (walls as Record<string, { openings?: Bag[] }>)[side]?.openings;
  if (!Array.isArray(ops)) return false;
  const vertical = side === "east" || side === "west";
  const base = vertical ? num(room.y) : num(room.x);
  const wallLength = vertical ? num(room.length) : num(room.width);
  for (const op of ops) {
    if (op?.kind !== "door") continue;
    const start = openingStartOffset(
      op.anchor as "start" | "center" | "end" | undefined,
      num(op.offset),
      num(op.width),
      wallLength,
    );
    const dLo = base + start, dHi = dLo + num(op.width);
    if (Math.min(dHi, hi) - Math.max(dLo, lo) > 0) return true; // door lies on the shared span
  }
  return false;
}

// Does `room` have a wall on `side`? A room with no `walls` field is enclosed on
// all four sides; a dict/list names exactly the sides that exist, so a side not
// named there is absent (the room is open on it). Mirrors declaredSides().
function wallPresent(room: Bag, side: Side): boolean {
  const walls = room.walls;
  if (walls == null) return true;
  if (Array.isArray(walls)) return (walls as string[]).includes(side);
  if (typeof walls === "object") return side in (walls as object);
  return true;
}

export const C11: Constraint = {
  id: "C11",
  title: "A declared connection must overlap on a wall and be passable (door or open)",
  level: "error",
  doc: {
    statement:
      "For every `connect`ion a room declares, the two rooms must **overlap on a wall** (not necessarily the whole wall), and that overlap must be **passable**: either a **door** lies in it, or the wall is **left off both rooms** (an open passage).",
    rationale:
      "A connection is a FUNCTIONAL requirement — `Living` opens into `Kitchen`. It is design intent, not geometry (the renderer never draws it), so this constraint is what verifies the intent is physically realized. It fails two ways: the rooms' walls don't overlap at all, or they overlap but a solid wall (present on either room, no door in the overlap) blocks the way. No door is ever generated — a room authors its own openings, or omits the shared wall to leave the rooms open to each other.",
    fix: "Overlap the two rooms on a wall, then EITHER put a door in the overlap (on either room), OR omit that wall on both:\n\n```wdl\n// door in the shared wall\nroom Living  at (…) size (…) { connect Kitchen  wall east { door D at 80 size (40,210) } }\nroom Kitchen at (…) size (…)\n\n// open passage — neither room walls the shared side\nroom Living  at (…) size (…) { connect Kitchen  wall north south west }\nroom Kitchen at (…) size (…) { wall north south east }\n```",
  },
  check(ctx) {
    const { findings, report } = makeReport("C11", "error");
    const config = ctx.resolved as unknown as Bag;
    const floors = (config.floors as Bag[] | undefined) ?? [];
    const tol = ctx.defaults.wall_thickness + 1;

    for (const fl of floors) {
      const fnum = num(fl.floor_number);
      const rooms = activeObjects(fl).filter((o) => o.type === "room");
      const byName = new Map(rooms.map((r) => [String(r.name), r]));
      const seen = new Set<string>(); // one finding per undirected pair

      for (const a of rooms) {
        const conns = Array.isArray(a.connections) ? (a.connections as unknown[]) : [];
        for (const raw of conns) {
          const name = String(raw);
          const key = [String(a.name), name].sort().join(" ↔ ");
          if (seen.has(key)) continue;
          seen.add(key);

          const b = byName.get(name);
          if (!b) {
            report(
              `${cap(floorLabel(fl))}: room ${objLabel(a)} declares a connection to "${name}", which is not an active room on this floor.`,
              { floor: fnum, where: objLabel(a) },
            );
            continue;
          }
          const sw = sharedWall(rectOf(a), rectOf(b), tol);
          if (!sw) {
            report(
              `${cap(floorLabel(fl))}: ${objLabel(a)} and ${objLabel(b)} are connected but their walls do not overlap (not adjacent) — no wall they could pass through.`,
              { floor: fnum, where: objLabel(a) },
            );
            continue;
          }
          // The barrier over the overlap is passable if a door lies in it, OR the
          // wall is absent on BOTH rooms (an open passage). A wall present on
          // either side, with no door in the overlap, blocks the connection.
          const bSide = OPP[sw.side];
          const wallThere = wallPresent(a, sw.side) || wallPresent(b, bSide);
          const doorThere = doorOnShared(a, sw.side, sw.lo, sw.hi) || doorOnShared(b, bSide, sw.lo, sw.hi);
          if (wallThere && !doorThere) {
            report(
              `${cap(floorLabel(fl))}: ${objLabel(a)} and ${objLabel(b)} are connected and their walls overlap, but no door lies in the overlap — add a door there, or omit that wall on BOTH rooms for an open passage.`,
              { floor: fnum, where: objLabel(a) },
            );
          }
        }
      }
    }
    return findings;
  },
  fixtures: {
    pass: [
      {
        name: "adjacent rooms with a door on the shared wall",
        config: house([
          {
            type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200,
            connections: ["Kitchen"],
            walls: { east: { openings: [{ kind: "door", name: "D1", offset: 80, width: 40 }] } },
          },
          { type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 200 },
        ]),
      },
      {
        name: "door authored on the neighbour's side of the shared wall",
        config: house([
          { type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200, connections: ["Kitchen"] },
          {
            type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 200,
            walls: { west: { openings: [{ kind: "door", name: "D1", offset: 80, width: 40 }] } },
          },
        ]),
      },
      {
        name: "open passage — neither room walls the shared side",
        config: house([
          {
            type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200,
            connections: ["Kitchen"],
            walls: { north: {}, south: {}, west: {} }, // no east wall (open toward Kitchen)
          },
          {
            type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 200,
            walls: { north: {}, south: {}, east: {} }, // no west wall (open toward Living)
          },
        ]),
      },
      {
        name: "partial wall overlap with a door in the overlap",
        config: house([
          {
            type: "room", name: "Living", x: 0, y: 0, width: 200, length: 100,
            connections: ["Kitchen"],
            // overlap with Kitchen is y 0..100; door at y 30..70 sits inside it.
            walls: { east: { openings: [{ kind: "door", name: "D1", offset: 30, width: 40 }] } },
          },
          { type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 300 },
        ]),
      },
      {
        name: "door anchored `from end` lands in the overlap (anchor honoured)",
        config: house([
          {
            type: "room", name: "Living", x: 0, y: 0, width: 200, length: 500,
            connections: ["Kitchen"],
            // Living's east wall runs y 0..500; the overlap with Kitchen is y 300..500.
            // `end` anchor: start-offset = 500 - 80 - 30 = 390, so the door is y 390..470
            // — inside the overlap. (Read as start-based it would be y 30..110, a miss.)
            walls: { east: { openings: [{ kind: "door", name: "D1", offset: 30, width: 80, anchor: "end" }] } },
          },
          { type: "room", name: "Kitchen", x: 200, y: 300, width: 200, length: 400 },
        ]),
      },
      {
        name: "rooms with no declared connections are not checked",
        config: house([
          { type: "room", name: "A", x: 0, y: 0, width: 100, length: 100 },
          { type: "room", name: "B", x: 300, y: 0, width: 100, length: 100 },
        ]),
      },
    ],
    fail: [
      {
        name: "connected rooms are not adjacent",
        config: house([
          { type: "room", name: "Living", x: 0, y: 0, width: 100, length: 100, connections: ["Kitchen"] },
          { type: "room", name: "Kitchen", x: 300, y: 0, width: 100, length: 100 },
        ]),
        expect: { count: 1, level: "error", messageIncludes: "not adjacent" },
      },
      {
        name: "adjacent but no door on the shared wall",
        config: house([
          { type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200, connections: ["Kitchen"] },
          { type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 200 },
        ]),
        expect: { count: 1, level: "error", messageIncludes: "no door" },
      },
      {
        name: "door on the shared wall is outside the shared span",
        config: house([
          {
            type: "room", name: "Living", x: 0, y: 0, width: 200, length: 100,
            connections: ["Kitchen"],
            // Living's east wall runs y 0..100 and the shared span with Kitchen is
            // y 0..100 — but the door sits at y 120..160, off the shared segment.
            walls: { east: { openings: [{ kind: "door", name: "D1", offset: 120, width: 40 }] } },
          },
          { type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 300 },
        ]),
        expect: { count: 1, level: "error", messageIncludes: "no door" },
      },
      {
        name: "one room walls the shared side (no door) while the other leaves it open — still blocked",
        config: house([
          // Living has all four walls by default (east present, no door).
          { type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200, connections: ["Kitchen"] },
          // Kitchen omits its west wall, but Living's solid east wall still blocks.
          { type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 200, walls: { north: {}, south: {}, east: {} } },
        ]),
        expect: { count: 1, level: "error", messageIncludes: "no door" },
      },
      {
        name: "door anchored `from end` still lands OUTSIDE the overlap (anchor honoured)",
        config: house([
          {
            type: "room", name: "Living", x: 0, y: 0, width: 200, length: 500,
            connections: ["Kitchen"],
            // `end` anchor: start-offset = 500 - 80 - 30 = 390 → door y 390..470, but
            // the overlap with Kitchen is only y 0..100 → genuinely no door in it.
            walls: { east: { openings: [{ kind: "door", name: "D1", offset: 30, width: 80, anchor: "end" }] } },
          },
          { type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 100 },
        ]),
        expect: { count: 1, level: "error", messageIncludes: "no door" },
      },
      {
        name: "connection to a room that does not exist",
        config: house([
          { type: "room", name: "Living", x: 0, y: 0, width: 100, length: 100, connections: ["Ghost"] },
        ]),
        expect: { count: 1, level: "error", messageIncludes: "not an active room" },
      },
    ],
  },
};

function house(objects: unknown[]): Record<string, unknown> {
  return { floors: [{ floor_number: 1, name: "Ground", slab_thickness: 0, objects }] };
}
