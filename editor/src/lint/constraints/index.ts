// The constraint registry. Adding a functional constraint = write one file and
// add it here; its runtime enforcement, tests, and (P3) doc all follow.
//
// `allConstraints()` is the single seam every consumer iterates — lintStructure,
// the generic test driver, and the doc generator — so a future per-primitive
// source (NodeDefinition.constraints) merges in here without touching them.

import type { Constraint } from "./types";
import { allNodes } from "../../registry/registry";
import { C1 } from "./c1_plinth_height";
import { C2 } from "./c2_exterior_walls";
import { C3 } from "./c3_slab_thickness";
import { C4 } from "./c4_floor_height";
import { C5 } from "./c5_staircase_ground";
import { C6 } from "./c6_opening_overlap";
import { C7 } from "./c7_furniture_overlap";
import { C8 } from "./c8_interior_partition";
import { C9 } from "./c9_slab_thickness_match";
import { C10 } from "./c10_roof_coverage";
import { C11 } from "./c11_declared_connection";
import { C12 } from "./c12_room_overlap";
import { C13 } from "./c13_plinth_lowest_floor";
import { C14 } from "./c14_roof_highest_floor";
import { C15 } from "./c15_plinth_covers_rooms";
import { C16 } from "./c16_cantilever_support";
import { C17 } from "./c17_roof_span_run";
import { C18 } from "./c18_roof_redundant";
import { C19 } from "./c19_staircase_flights";
import { C20 } from "./c20_staircase_egress";
import { C21 } from "./c21_staircase_plinth";
import { C22 } from "./c22_staircase_support";
import { C23 } from "./c23_staircase_scale";

/** House-level constraints, in convention-id order. */
export const CONSTRAINTS: Constraint[] = [
  C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16, C17,
  C18, C19, C20, C21, C22, C23,
];

/** Every active constraint: the house-level registry + any per-primitive
 *  constraints contributed by registered primitives (NodeDefinition.constraints). */
export function allConstraints(): Constraint[] {
  const primitive = allNodes().flatMap((n) => (n.constraints ?? []) as Constraint[]);
  return [...CONSTRAINTS, ...primitive];
}
