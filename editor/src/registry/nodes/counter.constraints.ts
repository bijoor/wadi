// Structural constraints CONTRIBUTED BY the `counter` primitive.
//
// CT1 — a counter that carries both a sink and a hob must be long enough to hold
// both side by side. The render auto-separates them (sink in the left half, hob in
// the right), so if the run is shorter than their combined width they can't both fit
// without overlapping. Uses the same GLB-derived widths as the 3D render.

import { makeReport, num, objLabel, type Bag } from "../../lint/constraints/vocab";
import type { Constraint } from "../../lint/constraints/types";
import { furnitureSpec } from "../../furniture/catalog";
import { metersToUnits, type UnitsRef } from "../../three/units";

const SINK_SCALE = 0.8; // must match counter.tsx
const SINK_M = furnitureSpec("kitchen_sink_bare")?.dimensions[0] ?? 0.55;
const HOB_M = furnitureSpec("cooktop_hob")?.dimensions[0] ?? 0.58;

/** CT1 — a counter with both a sink and a hob must be long enough for both. */
export const COUNTER_SINK_HOB_FIT: Constraint = {
  id: "CT1",
  title: "A counter with both a sink and a hob must be long enough for both",
  level: "error",

  doc: {
    statement:
      "A `counter` that has both a `sink` and a `hob` must have `length` ≥ the combined width of the two fixtures.",
    rationale:
      "The sink and hob sit side by side along the run (the render auto-separates them). If the counter is shorter than their combined width there is no room for both — they overlap.",
    fix: "Increase the counter `length`, or drop the sink or the hob.",
  },

  check(ctx) {
    const { findings, report } = makeReport("CT1", "error");
    const units = (ctx.expanded as unknown as Bag).units as UnitsRef | undefined;
    const need = SINK_SCALE * metersToUnits(SINK_M, units) + metersToUnits(HOB_M, units);
    const floors = ((ctx.expanded as unknown as Bag).floors as Bag[] | undefined) ?? [];
    for (const fl of floors) {
      for (const o of (fl.objects as Bag[] | undefined) ?? []) {
        if (o.type !== "counter" || o.enabled === false) continue;
        if (!o.sink || !o.hob) continue;
        const length = num(o.length);
        if (length > 0 && length < need) {
          report(
            `Counter ${objLabel(o)}: length (${Math.round(length)}) is too short for both a sink and a hob ` +
              `(needs ~${Math.round(need)}). Lengthen the counter, or drop the sink or the hob.`,
            { floor: num(fl.floor_number), where: objLabel(o) },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      { name: "long counter with sink + hob", config: counter({ length: 80, sink: true, hob: true }) },
      { name: "short counter, sink only", config: counter({ length: 20, sink: true }) },
      { name: "short counter, hob only", config: counter({ length: 20, hob: true }) },
    ],
    fail: [
      {
        name: "short counter with both a sink and a hob",
        config: counter({ length: 20, sink: true, hob: true }),
        expect: { count: 1, level: "error" },
      },
    ],
  },
};

function counter(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    floors: [
      {
        floor_number: 1,
        name: "Ground",
        objects: [{ type: "counter", name: "Counter", x: 100, y: 100, depth: 22, height: 36, ...extra }],
      },
    ],
  };
}
