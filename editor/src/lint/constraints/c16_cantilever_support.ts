// C16 — A room overhanging the floor below should have pillars supporting it.

import { makeReport, objLabel } from "./vocab";
import { footprintUnion, footprintContains, type Footprint } from "../../model/geom";
import type { Constraint } from "./types";

export const C16: Constraint = {
  id: "C16",
  title: "A room overhanging the floor below should have pillars under it",
  level: "warn",

  doc: {
    statement:
      "If a room on floor N extends beyond the rooms of the floor below (a cantilever), there should be pillars supporting the overhang.",
    rationale:
      "An upper-floor room that sticks out past the walls below has nothing under its overhang. In a real build that extension needs columns at its outside edge. This warns when an overhanging room has no pillar anywhere near it. (A style guide — a genuinely cantilevered slab design is allowed; the warning just flags the missing support.)",
    fix:
      "Add `pillar` objects at the outside of the extension (under the overhanging edge), or pull the room back over the floor below.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C16", "warn");
    const model = ctx.model;
    const tol = Math.max(ctx.defaults.wall_thickness * 2, 12);

    const rooms = model.byType("room");
    if (rooms.length === 0) return findings;
    const pillars = model.byType("pillar");

    // Room-bearing floors, low → high.
    const roomFloors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
    if (roomFloors.length < 2) return findings; // single occupied storey — no cantilever possible

    for (let i = 1; i < roomFloors.length; i++) {
      const n = roomFloors[i];
      const below = roomFloors[i - 1];
      const belowRooms = rooms.filter((r) => r.floor === below);
      if (belowRooms.length === 0) continue;
      const support: Footprint = footprintUnion(belowRooms.map((r) => r.footprint));

      for (const room of rooms.filter((r) => r.floor === n)) {
        if (footprintContains(support, room.footprint)) continue; // fully over the floor below
        // Overhangs. Supported if any pillar sits under/beside it.
        const supported = pillars.some((p) => model.distance(room, p) <= tol);
        if (!supported) {
          report(
            `Room ${objLabel(room.raw)} on floor ${n} overhangs the floor below (floor ${below}) but has no ` +
              `pillar supporting the overhang. Add pillars at the outside of the extension, or pull the room ` +
              `back over the floor below.`,
            { floor: n, where: objLabel(room.raw) },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "upper room sits within the floor below",
        config: house([
          floor(1, "Ground", [room("G", 0, 0, 300, 400)]),
          floor(2, "First", [room("U", 20, 20, 260, 360)]),
        ]),
      },
      {
        name: "overhanging room has a pillar under the extension",
        config: house([
          floor(1, "Ground", [room("G", 0, 0, 200, 400)]),
          floor(2, "First", [room("U", 0, 0, 300, 400), pillar(292, 0, 8, 8), pillar(292, 392, 8, 8)]),
        ]),
      },
    ],
    fail: [
      {
        name: "overhanging room with no pillar support",
        config: house([
          floor(1, "Ground", [room("G", 0, 0, 200, 400)]),
          floor(2, "First", [room("U", 0, 0, 300, 400)]),
        ]),
        expect: { count: 1, level: "warn", messageIncludes: "overhangs" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function floor(floor_number: number, name: string, objects: unknown[]) {
  return { floor_number, name, slab_thickness: 0, objects };
}
function room(name: string, x: number, y: number, width: number, length: number) {
  return { type: "room", name, x, y, width, length, walls: ["north", "south", "east", "west"] };
}
function pillar(x: number, y: number, width: number, length: number) {
  return { type: "pillar", name: "P", x, y, width, length };
}
