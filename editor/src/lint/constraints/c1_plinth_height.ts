// C1 — The plinth floor's height must match the plinth block height.
//
// Floor N+1 sits at the running sum of floor `height`s; the plinth block rises
// to its own `height`. If they differ, the floor above floats/sinks.

import { activeObjects, cap, floorLabel, makeReport, num, objLabel, type Bag } from "./vocab";
import { DEFAULT_GLOBAL_CONFIG } from "../../svg2d/config";
import type { Constraint } from "./types";

export const C1: Constraint = {
  id: "C1",
  title: "The plinth floor's height must match the plinth block height",
  level: "error",

  doc: {
    statement:
      "A floor that carries a `plinth` object (the Plinth floor) must set an explicit `height`, and that height must equal the plinth block's `height`.",
    rationale:
      "The floor above is stacked at `plinth-floor.height`; the plinth block rises to `plinth.height`. If they differ, the floor above floats above the plinth (`floor.height > plinth.height`) or sinks into it (`<`). If the floor `height` is omitted it silently defaults to `100`, almost never the plinth height.",
    fix:
      "```wdl\nfloor 0 \"Plinth\" height 40 {          // == the plinth block height below\n  ground name \"Ground\" at (0,0) size (500,500)\n  plinth name \"Plinth\" at (…) size (…) height 40\n}\n```\n\n(If the plinth block omits its own `height`, it follows the floor height and is consistent by construction — but set the floor `height` explicitly anyway, so the stack is not left to the default.)",
  },

  check(ctx) {
    const { findings, report } = makeReport("C1", "error");
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    for (const fl of floors) {
      const objs = activeObjects(fl);
      const fnum = num(fl.floor_number);
      const plinths = objs.filter((o) => o.type === "plinth");
      if (!plinths.length) continue;

      const fh = fl.height;
      if (fh == null) {
        report(
          `${cap(floorLabel(fl))} carries a plinth but sets no explicit floor \`height\`; it falls back to the ` +
            `default (${DEFAULT_GLOBAL_CONFIG.floor_height}), so the floor above will not sit on the plinth. ` +
            `Set this floor's \`height\` equal to the plinth height.`,
          { floor: fnum },
        );
      }
      for (const p of plinths) {
        const ph = p.height;
        if (ph == null) continue; // plinth with no height follows the floor height — consistent
        if (fh != null && Math.abs(num(fh) - num(ph)) > 1e-3) {
          const diff = num(fh) - num(ph);
          report(
            `${cap(floorLabel(fl))}: floor \`height\` (${num(fh)}) ≠ plinth ${objLabel(p)} height (${num(ph)}). ` +
              `The floor above ${diff > 0 ? "floats" : "sinks into the plinth by"} ${Math.abs(diff)} units. ` +
              `Make the floor height and the plinth height equal.`,
            { floor: fnum, where: objLabel(p) },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "floor height equals the plinth height",
        config: house([plinthFloor({ height: 40 })]),
      },
    ],
    fail: [
      {
        name: "plinth floor sets no explicit height",
        config: house([plinthFloor({})]),
        expect: { count: 1, level: "error" },
      },
      {
        name: "floor height ≠ plinth height (floor above floats)",
        config: house([plinthFloor({ height: 100 })]),
        expect: { count: 1, level: "error", messageIncludes: "float" },
      },
    ],
  },
};

// ---- fixture helpers -------------------------------------------------------

function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function plinthFloor(extra: Record<string, unknown>) {
  return {
    floor_number: 0,
    name: "Plinth",
    objects: [{ type: "plinth", name: "P", x: 0, y: 0, width: 100, length: 100, height: 40 }],
    ...extra,
  };
}
