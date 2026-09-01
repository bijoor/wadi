// C23 — A staircase's steps should be a realistic real-world size.

import { makeReport, num, type Bag } from "./vocab";
import { eachStaircaseSummary } from "./stairLint";
import type { Constraint } from "./types";

// Feet spanned by ONE display unit, per system (mirrors svg2d/format.ts).
const FEET_PER_DISPLAY_UNIT: Record<string, number> = {
  feet_inches: 1,
  feet: 1,
  meters: 3.280839895,
  centimeters: 0.032808399,
  millimeters: 0.003280839,
};

interface Units {
  system?: string;
  per_unit?: number;
}

function perUnitOf(u: Units | undefined): number {
  return u?.per_unit && u.per_unit > 0 ? u.per_unit : 10;
}
function unitsToInches(len: number, u: Units | undefined): number {
  const feet = (len / perUnitOf(u)) * (FEET_PER_DISPLAY_UNIT[u?.system ?? "feet_inches"] ?? 1);
  return feet * 12;
}

// Generous human bounds (inches). A real step is ~6-7in rise / ~10-12in going;
// these are wide enough that no sane stair trips, but a units mismatch (a stair
// authored in metres dropped into a feet model, or vice-versa) always does.
const RISE_MIN = 3, RISE_MAX = 10;
const GOING_MIN = 7, GOING_MAX = 16;

export const C23: Constraint = {
  id: "C23",
  title: "A staircase's steps should be a realistic size",
  level: "warn",

  doc: {
    statement:
      "A staircase's `step_rise` and `step_tread`, converted to real-world size, should fall in the human range — about a 6-7 in rise and a 10-12 in going.",
    rationale:
      "Stair steps are physically fixed regardless of the house, so they are the reliable tell for a scale mistake. Agents often copy a staircase from another example that is in different units (metres vs feet), producing steps that are absurdly large or tiny. This converts the steps to inches using the model's `units` and flags anything outside a generous human range.",
    fix:
      "Rescale the staircase to THIS model's units. The warning gives the sensible `step_rise`/`step_tread` for this model (1 ft = `per_unit` units by default 10, so about `step_rise 6`, `step_tread 10`).",
  },

  check(ctx) {
    const { findings, report } = makeReport("C23", "warn");
    const units = ((ctx.resolved as unknown as Bag).units as Units | undefined);
    const per = perUnitOf(units);
    for (const { sc, summary } of eachStaircaseSummary(ctx)) {
      const rise = num(sc.step_rise);
      const tread = num(sc.step_tread);
      if (!(rise > 0) || !(tread > 0)) continue;
      const riseIn = unitsToInches(rise, units);
      const goingIn = unitsToInches(tread, units);
      const bad =
        riseIn < RISE_MIN || riseIn > RISE_MAX || goingIn < GOING_MIN || goingIn > GOING_MAX;
      if (bad) {
        report(
          `Staircase "${summary.name}" has an unrealistic step size: rise ≈ ${riseIn.toFixed(1)} in, going ≈ ${goingIn.toFixed(1)} in ` +
            `(a real step is about a 6-7 in rise and a 10-12 in going). This usually means the dimensions were copied from a model in ` +
            `different units. In THIS model 1 ft = ${per} units, so use about \`step_rise ${Math.round(per * 0.55)}\` and \`step_tread ${Math.round(per * 0.92)}\`.`,
          { where: summary.name },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "a normal stair in a feet model (10 units = 1 ft)",
        config: house({ per_unit: 10 }, 6, 10),
      },
    ],
    fail: [
      {
        name: "metre-scale step numbers dropped into a feet model",
        config: house({ per_unit: 10 }, 18, 28),
        expect: { count: 1, level: "warn", messageIncludes: "unrealistic step size" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(units: Units, stepRise: number, stepTread: number): Record<string, unknown> {
  return {
    units: { system: "feet_inches", ...units },
    floors: [
      {
        floor_number: 1,
        name: "Ground",
        height: 96,
        slab_thickness: 0,
        objects: [
          {
            type: "staircase",
            name: "Stair",
            start_x: 0,
            start_y: 0,
            width: 100,
            length: 300,
            direction: "south",
            climb: "up",
            step_rise: stepRise,
            step_tread: stepTread,
          },
        ],
      },
    ],
  };
}
