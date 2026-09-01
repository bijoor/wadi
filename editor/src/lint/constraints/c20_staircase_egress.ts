// C20 — A staircase's top landing must reach a room.

import { makeReport } from "./vocab";
import { rectRing, ringsToFootprint, footprintDistance } from "../../model/geom";
import { eachStaircaseSummary } from "./stairLint";
import type { Constraint } from "./types";

export const C20: Constraint = {
  id: "C20",
  title: "A staircase's top landing must reach a room",
  level: "warn",

  doc: {
    statement:
      "The top landing of a staircase should abut (or sit inside) a room on the floor it arrives at, so there is a way off the stair onto the floor.",
    rationale:
      "A switchback's arrival landing lands wherever the run ends, which is hard to predict and easy to get wrong (often the direction is simply flipped). When the top landing ends against a blank wall or in open space, the stair reaches the next level but there is no way onto the floor. This checks the resolved arrival rectangle against the rooms of the arrival floor. (A warning, since a landing that opens onto an outdoor terrace may not overlap a room.)",
    fix:
      "Place the staircase so its top landing meets a room (leave that room's wall open there or add a door), or flip the `direction`/`turn` so the landing ends on the room side. The warning reports the arrival rectangle and which way it faces.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C20", "warn");
    const rooms = ctx.model.byType("room");
    const tol = ctx.defaults.wall_thickness || 8;
    for (const { floorNum, summary } of eachStaircaseSummary(ctx)) {
      if (summary.error || !summary.arrival) continue; // no landing emitted (e.g. a non-box single flight)
      const a = summary.arrival;
      const fp = ringsToFootprint([rectRing(a.x, a.y, a.width, a.length)]);
      // Rooms on the stair's own floor or the one above (the arrival level).
      const candidates = rooms.filter((r) => r.floor === floorNum || r.floor === floorNum + 1);
      const reaches = candidates.some((r) => footprintDistance(fp, r.footprint) <= tol);
      if (!reaches) {
        report(
          `Staircase "${summary.name}" top landing (a ${Math.round(a.width)}×${Math.round(a.length)} strip on its ${a.facing} side, near (${Math.round(a.x)}, ${Math.round(a.y)})) reaches no room — there is no way off the stair onto the floor. ` +
            `Place the stair so its top landing abuts a room (leave that wall open or add a door), or flip its direction/turn so the landing ends on the room side.`,
          { floor: floorNum, where: summary.name },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "the stairwell room covers the arrival landing",
        config: house([
          room("Stairwell", 0, 0, 100, 160),
          stair(160),
        ]),
      },
    ],
    fail: [
      {
        name: "a switchback lands in open space with no room",
        config: house([stair(160)]),
        expect: { count: 1, level: "warn", messageIncludes: "no way off" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(objects: unknown[]): Record<string, unknown> {
  return {
    floors: [
      { floor_number: 1, name: "Ground", height: 96, slab_thickness: 0, objects },
    ],
  };
}
function room(name: string, x: number, y: number, width: number, length: number) {
  return { type: "room", name, x, y, width, length, walls: ["north", "south", "east", "west"] };
}
function stair(length: number) {
  return {
    type: "staircase",
    name: "Stair",
    start_x: 0,
    start_y: 0,
    width: 100,
    length,
    direction: "south",
    climb: "up",
    step_rise: 6,
    step_tread: 10,
  };
}
