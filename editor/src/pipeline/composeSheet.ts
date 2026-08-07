// The compositor's SVG VIEW LEAVES as terminal Stages (P1½b;
// plans/primitive-componentization.md §2.5c). Kept separate from compose.ts so the
// store (which only needs composeResolve) does not pull in the SVG generators.
//
// Structure of the DAG: resolve → units → { plans, elevations, roofTop }. The view
// stages are pure functions of the resolved config (the generators still expand
// internally for now — deduping that shared expand is a later refinement). `units`
// is a side-effecting stage that sets the SVG modules' global dimension/text scale
// preamble BEFORE any view runs — mirroring exactly what every SVG caller does
// today, so output stays byte-identical.

import { resolveStage, type ComposeCtx } from "./compose";
import { runStages, type Stage } from "./stageRunner";
import type { HouseConfig } from "../schema/houseConfig";
import { setDimensionUnits } from "../svg2d/format";
import { setTextScale, computeTextScale, houseSpanUnits } from "../svg2d/config";
import { generateCombinedFloorPlans } from "../svg2d/floorPlansCombined";
import { generateCombinedElevations } from "../svg2d/elevationsCombined";
import { computeRoofSections } from "../svg2d/roof/index";

export type SheetView = "plans" | "elevations" | "roof";

/** Set the SVG modules' global unit/text-scale preamble. Side-effecting (bridges
 *  the existing global-state design); ordered before the view stages via deps. */
export const unitsStage: Stage<ComposeCtx> = {
  id: "units",
  dependsOn: ["resolve"],
  run: (ctx) => {
    const cfg = (ctx.resolved ?? ctx.config) as never;
    setDimensionUnits((cfg as { units?: unknown }).units as never);
    setTextScale(computeTextScale(houseSpanUnits(cfg)));
  },
};

export const planStage: Stage<ComposeCtx> = {
  id: "plan",
  dependsOn: ["units"],
  run: (ctx) => ({ plans: generateCombinedFloorPlans((ctx.resolved ?? ctx.config) as never) }),
};

export const elevationStage: Stage<ComposeCtx> = {
  id: "elevation",
  dependsOn: ["units"],
  run: (ctx) => ({ elevations: generateCombinedElevations((ctx.resolved ?? ctx.config) as never) }),
};

export const roofTopStage: Stage<ComposeCtx> = {
  id: "roofTop",
  dependsOn: ["units"],
  run: (ctx) => {
    const sections = computeRoofSections((ctx.resolved ?? ctx.config) as never) as
      | { panels?: { filename: string; content: string }[] }
      | undefined;
    const top = sections?.panels?.find((p) => p.filename === "roof_top_view.svg");
    return { roofTop: top?.content };
  },
};

const VIEW_STAGE: Record<SheetView, Stage<ComposeCtx>> = {
  plans: planStage,
  elevations: elevationStage,
  roof: roofTopStage,
};

/** Render the requested SVG views THROUGH the Stage DAG. Byte-identical to the
 *  resolve → preamble → generate sequence every SVG caller runs today. */
export function composeSheet(
  config: HouseConfig,
  views: readonly SheetView[] = ["plans", "elevations", "roof"],
): ComposeCtx {
  const stages: Stage<ComposeCtx>[] = [resolveStage, unitsStage];
  for (const v of views) stages.push(VIEW_STAGE[v]);
  return runStages(stages, { config });
}
