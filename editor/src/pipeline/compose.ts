// Wadi's compositor expressed as Stages on the generic runner (P1½b;
// plans/primitive-componentization.md §2.5c). This is the DOMAIN layer that names
// the concrete stages + their context; `stageRunner.ts` is the domain-neutral
// engine underneath. The shared derivation prefix (resolve → expand) lives here as
// registered stages; view leaves (plan/elevation/3D) become terminal stages in
// later increments. Helpers below are byte-identical drop-ins for the direct calls
// the app makes today, so a caller can be routed through the runner with no
// behaviour change (parity-gated).

import { resolveParametric } from "../param/resolve";
import { expandRoomWalls } from "../svg2d/expand";
import type { HouseConfig } from "../schema/houseConfig";
import { runStages, type Stage } from "./stageRunner";

type ResolveOut = ReturnType<typeof resolveParametric>;

export interface ComposeCtx {
  config: HouseConfig;
  resolved?: HouseConfig;
  warnings?: ResolveOut["warnings"];
  expanded?: ReturnType<typeof expandRoomWalls>;
}

/** Fold formulas/variables/points → concrete numbers (the parametric pass). */
export const resolveStage: Stage<ComposeCtx> = {
  id: "resolve",
  run: (ctx) => {
    const r = resolveParametric(ctx.config as never);
    return { resolved: r.config as HouseConfig, warnings: r.warnings };
  },
};

/** Decompose rooms→walls, staircases→flights, components→primitives, etc. */
export const expandStage: Stage<ComposeCtx> = {
  id: "expand",
  dependsOn: ["resolve"],
  run: (ctx) => ({ expanded: expandRoomWalls((ctx.resolved ?? ctx.config) as never) }),
};

// The typed Stage registry for the compose DAG (mirrors the primitive registry).
// Seeded with the base stages; a domain feature (or a view leaf) registers more.
const COMPOSE_STAGES: Stage<ComposeCtx>[] = [resolveStage, expandStage];
export function registerComposeStage(s: Stage<ComposeCtx>): void {
  COMPOSE_STAGES.push(s);
}
export function composeStages(): readonly Stage<ComposeCtx>[] {
  return COMPOSE_STAGES;
}

/** Resolve a config THROUGH the runner. Drop-in for resolveParametric — same
 *  `{ config, warnings }` shape, so call sites swap with zero behaviour change. */
export function composeResolve(config: HouseConfig): {
  config: HouseConfig;
  warnings: ResolveOut["warnings"];
} {
  const ctx = runStages([resolveStage], { config });
  return { config: ctx.resolved ?? config, warnings: ctx.warnings ?? [] };
}

/** Resolve + expand THROUGH the runner (byte-identical to the direct sequence). */
export function composeExpanded(config: HouseConfig): ReturnType<typeof expandRoomWalls> {
  const ctx = runStages([resolveStage, expandStage], { config });
  return ctx.expanded as ReturnType<typeof expandRoomWalls>;
}
