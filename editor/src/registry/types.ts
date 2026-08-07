// Object registry — the socket new object types plug into (blueprint: Pascal's
// NodeDefinition). Each registered node owns its whole surface in ONE file: how it's
// created, edited, rendered in 3D + on the 2D plan, and which layer it toggles with.
//
// This is ADDITIVE. The dispatchers (House3D, floorPlan, PropertyPanel, defaultFactory,
// Sidebar, layers) consult the registry FIRST and fall back to their existing per-type
// switches for the legacy object types that haven't been migrated. So a new object type
// = one registry entry, no edits scattered across the renderers.

import type { ReactNode } from "react";
import type { ComponentType } from "react";
import type { ZodTypeAny } from "zod";
import type { HouseConfig, HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
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
  /** Property-panel editor. */
  Form?: ComponentType<{ obj: HouseObject; selection: Selection }>;
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
  /** CAPABILITY — 2D plan: a full SVG fragment (project coords), richer than a
   *  footprint box. Consumed by the "plan" view (wired in P1d). */
  drawPlan?: (obj: Record<string, unknown>, ctx: NodePlanCtx) => string | null;
  /** CAPABILITY — 2D elevation: an SVG fragment for one elevation direction.
   *  Consumed by the "elevation" view (wired in P1d). */
  drawElevation?: (obj: Record<string, unknown>, ctx: NodeElevationCtx) => string | null;
}

/** The capability hooks a VIEW can consume (see capabilities.ts). */
export type CapabilityName = "render3D" | "drawPlan" | "drawElevation";
