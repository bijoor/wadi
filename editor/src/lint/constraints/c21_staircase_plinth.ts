// C21 — The plinth should extend under a staircase on the lowest floor.

import { makeReport } from "./vocab";
import { footprintUnion, footprintContains } from "../../model/geom";
import { eachStaircaseSummary, boxFootprint } from "./stairLint";
import type { Constraint } from "./types";

export const C21: Constraint = {
  id: "C21",
  title: "The plinth should extend under a staircase",
  level: "warn",

  doc: {
    statement:
      "A staircase on the lowest occupied floor should sit entirely on the plinth — the plinth footprint should cover it.",
    rationale:
      "The plinth is the base the ground floor stands on. An external staircase added past the building edge has its flights and landings resting on nothing unless the plinth is extended under it. Agents routinely add a stair to the outside and forget to grow the plinth. (Checks only the lowest occupied floor, the one that sits on the plinth; upper-floor stairs bear on that floor's slab.)",
    fix:
      "Grow the plinth (its size, or the plot variables it derives from) so it covers the whole staircase footprint, or move the staircase inside the building over the plinth.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C21", "warn");
    const plinths = ctx.model.byType("plinth");
    if (plinths.length === 0) return findings; // no plinth — C13's concern
    const plinthArea = footprintUnion(plinths.map((p) => p.footprint));
    const rooms = ctx.model.byType("room");
    if (rooms.length === 0) return findings;
    const lowest = Math.min(...rooms.map((r) => r.floor));

    for (const { floorNum, summary } of eachStaircaseSummary(ctx)) {
      if (!summary.box || floorNum !== lowest) continue;
      const fp = boxFootprint(summary.box);
      if (!fp) continue;
      if (!footprintContains(plinthArea, fp)) {
        const b = summary.box;
        report(
          `Staircase "${summary.name}" on floor ${floorNum} extends beyond the plinth — its base is unsupported. ` +
            `Extend the plinth to cover the whole staircase footprint (${Math.round(b.width)}×${Math.round(b.length)} at (${Math.round(b.x)}, ${Math.round(b.y)})), or move the stair over the plinth.`,
          { floor: floorNum, where: summary.name },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "the plinth covers the staircase",
        config: house([
          floor(0, "Plinth", [plinth(0, 0, 400, 400)]),
          floor(1, "Ground", [room("Hall", 0, 0, 300, 300), stair(0, 300, 100, 80)]),
        ]),
      },
    ],
    fail: [
      {
        name: "an external staircase past the plinth",
        config: house([
          floor(0, "Plinth", [plinth(0, 0, 300, 300)]),
          floor(1, "Ground", [room("Hall", 0, 0, 300, 300), stair(300, 0, 100, 300)]),
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
  return { floor_number, name, height: 96, slab_thickness: 0, objects };
}
function room(name: string, x: number, y: number, width: number, length: number) {
  return { type: "room", name, x, y, width, length, walls: ["north", "south", "east", "west"] };
}
function plinth(x: number, y: number, width: number, length: number) {
  return { type: "plinth", name: "Plinth", x, y, width, length, height: 40 };
}
function stair(start_x: number, start_y: number, width: number, length: number) {
  return {
    type: "staircase",
    name: "Stair",
    start_x,
    start_y,
    width,
    length,
    direction: "south",
    climb: "up",
    step_rise: 6,
    step_tread: 10,
  };
}
