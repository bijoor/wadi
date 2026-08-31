// C15 — The plinth should cover the rooms that rest on it.

import { makeReport, objLabel } from "./vocab";
import { footprintUnion, footprintContains, type Footprint } from "../../model/geom";
import type { Constraint } from "./types";

export const C15: Constraint = {
  id: "C15",
  title: "The plinth should cover the rooms that rest on it",
  level: "warn",

  doc: {
    statement:
      "The plinth footprint should contain every room on the lowest occupied floor — no ground-floor room sticking out past the plinth.",
    rationale:
      "The plinth is the base the ground floor stands on. A room whose footprint extends beyond the plinth has part of its floor unsupported by the base. (Upper floors that cantilever past the plinth are a different case — those want pillars; see the cantilever guidance. This checks only the floor that sits directly on the plinth.)",
    fix:
      "Grow the plinth (its size, or the plot variables it derives from) to cover the room, or pull the room back within the plinth.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C15", "warn");
    const model = ctx.model;

    const plinths = model.byType("plinth");
    if (plinths.length === 0) return findings; // no plinth — C13's concern, not this one
    const plinthArea: Footprint = footprintUnion(plinths.map((p) => p.footprint));

    const rooms = model.byType("room");
    if (rooms.length === 0) return findings;
    const groundFloor = Math.min(...rooms.map((r) => r.floor));

    for (const room of rooms.filter((r) => r.floor === groundFloor)) {
      if (!footprintContains(plinthArea, room.footprint)) {
        report(
          `Room ${objLabel(room.raw)} on floor ${room.floor} extends beyond the plinth — the plinth does not ` +
            `cover it. Grow the plinth to cover the room (or pull the room within the plinth).`,
          { floor: room.floor, where: objLabel(room.raw) },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "plinth covers the ground-floor room",
        config: house([
          floor(0, "Plinth", [plinth(0, 0, 300, 400)]),
          floor(1, "Ground", [room(10, 10, 280, 380)]),
        ]),
      },
    ],
    fail: [
      {
        name: "ground room sticks out past the plinth",
        config: house([
          floor(0, "Plinth", [plinth(0, 0, 200, 200)]),
          floor(1, "Ground", [room(0, 0, 300, 400)]),
        ]),
        expect: { count: 1, level: "warn", messageIncludes: "beyond the plinth" },
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
function room(x: number, y: number, width: number, length: number) {
  return { type: "room", name: "R", x, y, width, length, walls: ["north", "south", "east", "west"] };
}
function plinth(x: number, y: number, width: number, length: number) {
  return { type: "plinth", name: "Plinth", x, y, width, length, height: 40 };
}
