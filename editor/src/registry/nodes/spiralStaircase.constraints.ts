// Structural constraints CONTRIBUTED BY the spiral_staircase primitive (P5).
//
// Proves the per-primitive hook: a custom primitive ships its own rule, which
// merges into allConstraints() and flows through the whole mechanism — the
// runtime linter, the generic fixture driver, and the generated conventions doc —
// with no change to any of them. A primitive constraint is an ordinary Constraint
// (it may use ctx.model like any other); it is scoped to its own object type.

import { makeReport, num, objLabel, type Bag } from "../../lint/constraints/vocab";
import type { Constraint } from "../../lint/constraints/types";

/** SP1 — a spiral staircase's central pole must be smaller than its outer radius. */
export const SPIRAL_POLE: Constraint = {
  id: "SP1",
  title: "A spiral staircase's central pole must be smaller than its radius",
  level: "error",

  doc: {
    statement: "A `spiral_staircase`'s `pole_radius` must be less than its outer `radius`.",
    rationale:
      "The treads run from the central pole out to the outer radius. If the pole is as wide as (or wider than) the stair, there is no tread left to stand on — the geometry collapses.",
    fix: "Reduce `pole_radius` below `radius` (a pole is typically a small fraction of the radius).",
  },

  check(ctx) {
    const { findings, report } = makeReport("SP1", "error");
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    for (const fl of floors) {
      for (const o of (fl.objects as Bag[] | undefined) ?? []) {
        if (o.type !== "spiral_staircase" || o.enabled === false) continue;
        if (o.pole_radius == null) continue;
        const pole = num(o.pole_radius);
        const radius = num(o.radius);
        if (radius > 0 && pole >= radius) {
          report(
            `Spiral staircase ${objLabel(o)}: pole_radius (${pole}) ≥ radius (${radius}) — no tread width left. ` +
              `Reduce pole_radius below the radius.`,
            { floor: num(fl.floor_number), where: objLabel(o) },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      { name: "pole smaller than radius", config: spiral({ radius: 40, pole_radius: 5 }) },
      { name: "no pole_radius set", config: spiral({ radius: 40 }) },
    ],
    fail: [
      {
        name: "pole as wide as the radius",
        config: spiral({ radius: 40, pole_radius: 40 }),
        expect: { count: 1, level: "error" },
      },
    ],
  },
};

function spiral(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    floors: [
      {
        floor_number: 1,
        name: "Ground",
        objects: [{ type: "spiral_staircase", name: "Spiral", x: 100, y: 100, total_height: 108, ...extra }],
      },
    ],
  };
}
