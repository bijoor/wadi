// Shared staircase-lint helper: walk every (enabled) staircase in the resolved
// house and attach its resolved summary (flight count, direction, arrival
// landing, min box lengths). Used by C19 (flights) and C20 (egress).

import type { CheckContext } from "./types";
import { num, type Bag } from "./vocab";
import { summarizeStaircase, type StaircaseSummary } from "../../svg2d/stairSummary";

export interface StairEntry {
  sc: Bag;
  floorNum: number;
  summary: StaircaseSummary;
}

export function eachStaircaseSummary(ctx: CheckContext): StairEntry[] {
  const out: StairEntry[] = [];
  const resolved = ctx.resolved as unknown as Bag;
  const floors = (resolved.floors as Bag[] | undefined) ?? [];
  const dFloor = ctx.defaults.floor_height;
  const dSlab = ctx.defaults.slab_thickness;
  for (let i = 0; i < floors.length; i++) {
    const fl = floors[i];
    const floorNum = num(fl.floor_number);
    // Mirror expand.ts's staircase context computation exactly.
    const slabThickness = typeof fl.slab_thickness === "number" ? fl.slab_thickness : dSlab;
    const floorOwnHeight =
      typeof fl.height === "number" && fl.height > 0 ? fl.height : dFloor;
    const belowRaw = i > 0 ? floors[i - 1].height : undefined;
    const floorBelowHeight =
      typeof belowRaw === "number" && belowRaw > 0 ? belowRaw : dFloor;
    for (const o of (fl.objects as Bag[] | undefined) ?? []) {
      if (o.type !== "staircase" || o.enabled === false) continue;
      const summary = summarizeStaircase(o as unknown as { type: string; [k: string]: unknown }, {
        slabThickness,
        floorBelowHeight,
        floorOwnHeight,
      });
      out.push({ sc: o, floorNum, summary });
    }
  }
  return out;
}
