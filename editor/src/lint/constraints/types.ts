// The constraint module contract.
//
// A functional constraint is one self-contained module that bundles its
// metadata, its check predicate, its documentation, and the example houses that
// should (and should not) trip it. A registry of these drives the runtime linter
// (lintStructure), the generic fixture test driver, and the generated
// conventions doc. See plans/functional-constraints-testing.md.

import type { HouseConfig } from "../../schema/houseConfig";
import type { LintFinding, LintLevel } from "../structural";
import type { SpatialModel } from "../../model/spatialModel";

/** Merged, numeric house defaults a check may consult. */
export interface ResolvedDefaults {
  wall_thickness: number;
  slab_thickness: number;
  floor_height: number;
  wall_height: number;
}

/** Everything a check needs, computed once per lint run. */
export interface CheckContext {
  /** As authored (today == resolved, since callers resolve before linting). */
  raw: HouseConfig;
  /** Formulas applied. */
  resolved: HouseConfig;
  /** + components / stairs / grid flattened per floor (expandRoomWalls, lenient). */
  expanded: HouseConfig;
  defaults: ResolvedDefaults;
  /** The query layer over `expanded`. */
  model: SpatialModel;
}

/** Markdown that documents a constraint (feeds the generated conventions doc). */
export interface ConstraintDoc {
  statement: string;
  rationale: string;
  fix: string;
}

/** A loose HouseConfig-shaped fixture (the linter reads a lenient shape). */
export type PartialHouse = Record<string, unknown>;

export interface ConstraintFixtures {
  pass: Array<{ name: string; config: PartialHouse }>;
  fail: Array<{
    name: string;
    config: PartialHouse;
    expect?: { count?: number; level?: LintLevel; messageIncludes?: string };
  }>;
}

export interface Constraint {
  /** Convention id, e.g. "C1". */
  id: string;
  /** Short one-liner (was ConventionMeta.title). */
  title: string;
  /** Default severity for its findings. */
  level: LintLevel;
  doc: ConstraintDoc;
  check(ctx: CheckContext): LintFinding[];
  fixtures: ConstraintFixtures;
}
