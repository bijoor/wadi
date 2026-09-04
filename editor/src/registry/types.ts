// Object registry — the socket new object types plug into (blueprint: Pascal's
// NodeDefinition). Each registered node owns its whole surface in ONE file: how it's
// created, edited, rendered in 3D + on the 2D plan, and which layer it toggles with.
//
// This is ADDITIVE. The dispatchers (House3D, floorPlan, defaultFactory, layers)
// consult the registry FIRST and fall back to their existing per-type switches for
// the legacy object types that haven't been migrated. So a new object type = one
// registry entry, no edits scattered across the renderers.

import type { ReactNode } from "react";
import type { ZodTypeAny } from "zod";
import type { FieldSpec } from "./fieldSchema";
import type { HouseConfig, HouseObject } from "../schema/houseConfig";
import type { LayerRole } from "../state/layerDefaults";
import type { FloorZBounds, PlotBounds } from "../three/coords";

// Context handed to a node's 3D renderer — the per-floor/plot info a House3D branch
// needs. The node returns what to draw; House3D pushes it into the right layer group.
export interface NodeRender3DCtx {
  band: FloorZBounds;
  plot: PlotBounds;
  unitsRef?: { system?: string; per_unit?: number };
  floorNum: number;
  key: string;
}

export interface Node3DOutput {
  layerId: string;
  node: ReactNode;
}

// A node's footprint on the 2D floor plan, in PROJECT UNITS. cx,cy = plan centre.
export interface NodePlanFootprint {
  cx: number;
  cy: number;
  w: number; // X extent
  d: number; // Y extent
  rot?: number; // yaw, degrees
  label?: string;
}

// Context for the (optional) expand hook — a primitive may decompose into child
// objects before any view renders (staircase→flights+landings, component→stamp).
// Shape mirrors what expandRoomWalls already computes per floor.
export interface NodeExpandCtx {
  floorNum: number;
  floorSlabThickness: number;
  floorBelowHeight: number;
  lenient?: boolean;
  onWarning?: (msg: string) => void;
  // A composition primitive (a promoted component) expands by stamping its body;
  // that needs the host config (to resolve param formulas against the host scope
  // and look up nested components), the house wall thickness, and the current
  // recursion depth (for the nesting-depth guard). Populated by expandRoomWalls.
  // Typed `unknown` because expandRoomWalls carries its own loose HouseConfig shape,
  // not the strict schema one; the consumer (registry/promote.ts) casts it.
  houseConfig?: unknown;
  wallThickness?: number;
  depth?: number;
}

// Context for the 2D-plan / elevation draw hooks. These are placeholders that get
// firmed up in P1d when floorPlan.ts / elevationView.ts are converted to consult
// the registry; declared now so the descriptor shape is stable.
export interface NodePlanCtx {
  units?: { system?: string; per_unit?: number };
}
export interface NodeElevationCtx {
  direction: "north" | "south" | "east" | "west";
}

/** Plan-space axis-aligned bounding box, in PROJECT UNITS. */
export interface PlanAABB {
  x: number;
  y: number;
  w: number;
  d: number;
}

// Typed geometry FACETS a primitive exposes for the compositor's STAGES to consume
// (plans/primitive-componentization.md §2.5c). A stage reads only the facet it
// needs — dimensioning → bbox/edges, layout → footprint — so a primitive never
// knows its neighbours and a cross-object stage never reaches into a primitive's
// internals. The set grows as new stages need new facets.
export interface NodeFacets {
  /** Plan-space AABB (layout, perimeter dimensioning). */
  bbox?: (obj: Record<string, unknown>) => PlanAABB | null;
  /** Plan footprint (also surfaced via `planFootprint` for back-compat). */
  footprint?: (obj: Record<string, unknown>) => NodePlanFootprint | null;
  /** TRUE plan polygon for a non-box primitive (roof segments, a concave model):
   *  an array of rings, first = outer boundary, rest = holes. Consumed by the
   *  model query layer (editor/src/model); box facets are used when this is absent. */
  footprintPoly?: (obj: Record<string, unknown>) => Array<Array<{ x: number; y: number }>> | null;
}

// The descriptor a primitive registers — one file owns its whole surface. Named
// NodeDefinition for now; the plan (plans/primitive-componentization.md) renames it
// PrimitiveDefinition at kernel-extraction (P4). The render3D / drawPlan /
// drawElevation hooks are the "capabilities" that VIEWS consume (see capabilities.ts).
export interface NodeDefinition {
  /** The object `type` discriminator this definition handles. */
  type: string;
  /** Menu / tree label. */
  label: string;
  /** Offer it in the "+ Add object" menu. */
  addable?: boolean;
  /** Build a default instance for the "+ Add" menu. */
  makeDefault?: (cfg: HouseConfig, existing: HouseObject[]) => HouseObject;
  /** Declarative fields (P2). Drive the generated schema + docs. (These also once
   *  drove the property-panel form, which is retired — WDL is the only edit
   *  surface — but `fields` remain the source of the schema.) */
  fields?: FieldSpec[];
  /** Zod schema for this object type (a z.object whose `type` is a literal). Used
   *  to build the config discriminated union from the registry (P1e). */
  schema?: ZodTypeAny;
  /** Default layer ROLE when the object has no explicit `layer` (feeds the
   *  per-type role map). `defaultLayerId` still overrides for a concrete id. */
  layerRole?: LayerRole;
  /** Default 3D layer id when the object has no explicit `layer`. */
  defaultLayerId?: string | ((obj: Record<string, unknown>, floorNum: number) => string);
  /** Decompose into child objects before rendering. Return null to leave as-is. */
  expand?: (obj: Record<string, unknown>, ctx: NodeExpandCtx) => HouseObject[] | null;
  /** CAPABILITY — 3D: what to draw + which layer. Return null to draw nothing. */
  render3D?: (obj: Record<string, unknown>, ctx: NodeRender3DCtx) => Node3DOutput | null;
  /** 2D plan footprint (project units) for bounds + drawing. Return null to skip. */
  planFootprint?: (obj: Record<string, unknown>) => NodePlanFootprint | null;
  /** Geometry facets this primitive exposes to compositor stages (§2.5c). */
  facets?: NodeFacets;
  /** CAPABILITY — 2D plan: a full SVG fragment (project coords), richer than a
   *  footprint box. Consumed by the "plan" view (wired in P1d). */
  drawPlan?: (obj: Record<string, unknown>, ctx: NodePlanCtx) => string | null;
  /** CAPABILITY — 2D elevation: an SVG fragment for one elevation direction.
   *  Consumed by the "elevation" view (wired in P1d). */
  drawElevation?: (obj: Record<string, unknown>, ctx: NodeElevationCtx) => string | null;
  /** CAPABILITY — decompile: emit this object's bespoke `.wdl` for the given
   *  instance, so a contributed primitive owns its own round-trip syntax instead
   *  of the generic `type Name { field value … }` form. Return the WDL block
   *  (one or more lines; relative indentation is preserved), or undefined/null to
   *  fall back to the generic decompiler. Consulted by `fromHouseConfig` via the
   *  editor's injected emitter map; headless callers keep the generic form. */
  emitWdl?: (obj: Record<string, unknown>) => string | null | undefined;
  /** Structural constraints this primitive contributes, checked alongside the
   *  house-level C-rules (merged into allConstraints() by the lint registry).
   *  Typed `unknown[]` here to avoid a value dependency on the lint package;
   *  the lint side casts to Constraint[]. See plans/functional-constraints-testing.md. */
  constraints?: unknown[];
}

/** The capability hooks a VIEW can consume (see capabilities.ts). */
export type CapabilityName = "render3D" | "drawPlan" | "drawElevation";
