// C22 — A staircase's flights and landings need something to bear on.

import { makeReport } from "./vocab";
import { footprintContains, footprintsOverlap } from "../../model/geom";
import { eachStaircaseSummary, boxFootprint } from "./stairLint";
import type { Constraint } from "./types";

export const C22: Constraint = {
  id: "C22",
  title: "A staircase needs an enclosing room or pillars to carry its landings",
  level: "warn",

  doc: {
    statement:
      "A staircase should be enclosed by a room of (at least) its own footprint, or have pillars under it — something to carry the flights and turn landings.",
    rationale:
      "Switchback landings are elevated slabs; the flights land on them. In a real build the surrounding walls (a stairwell) or columns carry that load. A free-standing staircase with no enclosing room and no pillars has landings hanging in the air. (A warning: an open stair against a structural wall may be fine, but the common agent mistake is a stair floating in open space.)",
    fix:
      "Put the staircase inside a room that covers its footprint (the walls carry the landings), or add `pillar` objects under the landings.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C22", "warn");
    const tol = Math.max(ctx.defaults.wall_thickness, 8);
    const rooms = ctx.model.byType("room");
    const pillars = ctx.model.byType("pillar");

    for (const { floorNum, summary } of eachStaircaseSummary(ctx)) {
      if (!summary.box) continue;
      const inset = boxFootprint(summary.box, tol) ?? boxFootprint(summary.box);
      const boxFp = boxFootprint(summary.box);
      if (!inset || !boxFp) continue;
      // Enclosed: a room on this floor whose footprint covers the stair box.
      const enclosed = rooms.some(
        (r) => r.floor === floorNum && footprintContains(r.footprint, inset),
      );
      if (enclosed) continue;
      // Propped: a pillar on this floor overlapping the stair box (under a landing).
      const propped = pillars.some(
        (p) => p.floor === floorNum && footprintsOverlap(p.footprint, boxFp),
      );
      if (!propped) {
        report(
          `Staircase "${summary.name}" on floor ${floorNum} is free-standing — its flights and landings have nothing to bear on. ` +
            `Enclose it in a room of the same footprint (the walls carry the landings), or add pillars under the landings.`,
          { floor: floorNum, where: summary.name },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "the staircase sits inside a stairwell room",
        config: house([
          room("Stairwell", -10, -10, 130, 320),
          stair(0, 0, 100, 300),
        ]),
      },
      {
        name: "pillars carry the landings",
        config: house([
          stair(0, 0, 100, 300),
          pillar(0, 0, 10, 10),
          pillar(90, 0, 10, 10),
          pillar(0, 290, 10, 10),
          pillar(90, 290, 10, 10),
        ]),
      },
    ],
    fail: [
      {
        name: "a free-standing staircase with no room and no pillars",
        config: house([stair(0, 0, 100, 300)]),
        expect: { count: 1, level: "warn", messageIncludes: "free-standing" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(objects: unknown[]): Record<string, unknown> {
  return { floors: [{ floor_number: 1, name: "Ground", height: 96, slab_thickness: 0, objects }] };
}
function room(name: string, x: number, y: number, width: number, length: number) {
  return { type: "room", name, x, y, width, length, walls: ["north", "south", "east", "west"] };
}
function pillar(x: number, y: number, width: number, length: number) {
  return { type: "pillar", name: "P", x, y, width, length };
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
