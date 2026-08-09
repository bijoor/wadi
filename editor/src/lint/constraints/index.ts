// The constraint registry. Adding a functional constraint = write one file and
// add it here; its runtime enforcement, tests, and (P3) doc all follow.
//
// `allConstraints()` is the single seam every consumer iterates — lintStructure,
// the generic test driver, and the doc generator — so a future per-primitive
// source (NodeDefinition.constraints) merges in here without touching them.

import type { Constraint } from "./types";
import { C1 } from "./c1_plinth_height";
import { C2 } from "./c2_exterior_walls";
import { C3 } from "./c3_slab_thickness";
import { C4 } from "./c4_floor_height";
import { C5 } from "./c5_staircase_ground";
import { C6 } from "./c6_opening_overlap";
import { C7 } from "./c7_furniture_overlap";

/** House-level constraints, in convention-id order. */
export const CONSTRAINTS: Constraint[] = [C1, C2, C3, C4, C5, C6, C7];

/** Every active constraint (house-level today; per-primitive sources merge here later). */
export function allConstraints(): Constraint[] {
  return CONSTRAINTS;
}
