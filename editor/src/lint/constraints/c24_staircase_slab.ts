// C24 — A staircase needs a slab under it (as well as a plinth).

import { makeReport } from "./vocab";
import { footprintUnion, footprintContains } from "../../model/geom";
import { eachStaircaseSummary, boxFootprint } from "./stairLint";
import type { Constraint } from "./types";

export const C24: Constraint = {
  id: "C24",
  title: "A staircase needs a slab under it, not just a plinth",
  level: "warn",

  doc: {
    statement:
      "When a staircase's floor has a slab (slab_thickness > 0), a slab should extend under the whole staircase footprint.",
    rationale:
      "A staircase's base rests at the floor's walking surface — its `z_offset` defaults to the floor `slab_thickness`, so it sits on TOP of the slab. If the slab does not reach under the stair (a common miss on an external stair, where the plinth was extended but the slab was not), there is a `slab_thickness` gap between the bottom of the stairs and the plinth where the slab should be. Extending only the plinth (C21) is not enough. (Skipped when the floor has no slab — `slab_thickness 0` — since the stair then rests directly on the plinth.)",
    fix:
      "Add or grow a `slab` on the staircase's floor so it covers the whole staircase footprint, matching the plinth below it.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C24", "warn");
    const model = ctx.model;
    for (const { floorNum, floorSlabThickness, summary } of eachStaircaseSummary(ctx)) {
      if (!summary.box) continue;
      if (!(floorSlabThickness > 0)) continue; // rests on the floor base — no gap
      const fp = boxFootprint(summary.box);
      if (!fp) continue;
      const slabs = model.byType("slab").filter((s) => s.floor === floorNum);
      const covered =
        slabs.length > 0 && footprintContains(footprintUnion(slabs.map((s) => s.footprint)), fp);
      if (!covered) {
        const b = summary.box;
        report(
          `Staircase "${summary.name}" on floor ${floorNum} has no slab under it — its base sits ${floorSlabThickness} above the floor datum, leaving a gap to the plinth. ` +
            `Extend a slab on this floor to cover the whole staircase footprint (${Math.round(b.width)}×${Math.round(b.length)} at (${Math.round(b.x)}, ${Math.round(b.y)})).`,
          { floor: floorNum, where: summary.name },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "a slab covers the staircase",
        config: house(8, [slab(0, 0, 400, 400), stair(100, 100, 100, 200)]),
      },
      {
        name: "no slab needed when the floor has no slab (slab_thickness 0)",
        config: house(0, [stair(100, 100, 100, 200)]),
      },
    ],
    fail: [
      {
        name: "a slab floor with the stair off the slab",
        config: house(8, [slab(0, 0, 300, 300), stair(300, 0, 100, 200)]),
        expect: { count: 1, level: "warn", messageIncludes: "no slab under it" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(slabThickness: number, objects: unknown[]): Record<string, unknown> {
  return {
    floors: [
      { floor_number: 1, name: "Ground", height: 96, slab_thickness: slabThickness, objects },
    ],
  };
}
function slab(x: number, y: number, width: number, length: number) {
  return { type: "slab", name: "Slab", x, y, width, length };
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
