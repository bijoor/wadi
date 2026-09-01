// C19 — Prefer one or two flights per floor when there is room.

import { makeReport } from "./vocab";
import { eachStaircaseSummary } from "./stairLint";
import type { Constraint } from "./types";

export const C19: Constraint = {
  id: "C19",
  title: "Prefer one or two flights per floor when space allows",
  level: "warn",

  doc: {
    statement:
      "A staircase should climb a floor in one or two flights unless the floor space is genuinely tight.",
    rationale:
      "A box-model staircase derives its flight count from the run it is given: too short a box forces extra switchback flights. Agents routinely under-size the box and get cramped 3-4 flight stairs where the floor had room for a straight run or a single U-turn. Fewer flights are easier to build and to walk. (A warning, since a tight plot may legitimately need a compact switchback.)",
    fix:
      "Lengthen the staircase along its run axis (the box `length` for a N/S stair, `width` for E/W) to the reported minimum, or reduce `landing_depth`. The warning gives the exact length for one and two flights.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C19", "warn");
    for (const { summary } of eachStaircaseSummary(ctx)) {
      if (summary.error) continue; // doesn't fit at all — a geometry error, not this
      if (summary.numFlights > 2) {
        const hint =
          summary.minBoxLengthFor2 != null
            ? ` Extend the box along its ${summary.runAxis.toUpperCase()} axis to at least ${summary.minBoxLengthFor2} for two flights (${summary.minBoxLengthFor1} for a single straight run).`
            : ` Allocate more run (a longer box, or a larger max_run) so it needs fewer flights.`;
        report(
          `Staircase "${summary.name}" climbs one floor in ${summary.numFlights} flights (direction ${summary.direction}).` +
            hint +
            ` Compact switchbacks are only needed when the floor space is tight.`,
          { floor: undefined, where: summary.name },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "a long box climbs in a single flight",
        config: house(stair(300)),
      },
    ],
    fail: [
      {
        name: "a short box forces three flights",
        config: house(stair(160)),
        expect: { count: 1, level: "warn", messageIncludes: "flights" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(...objects: unknown[]): Record<string, unknown> {
  return {
    floors: [{ floor_number: 1, name: "Ground", height: 96, slab_thickness: 0, objects }],
  };
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
