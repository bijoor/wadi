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
import type { HouseConfig, HouseObject } from "../schema/houseConfig";
import type { Selection } from "../state/configStore";
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
  /** Default 3D layer id when the object has no explicit `layer`. */
  defaultLayerId?: string | ((obj: Record<string, unknown>, floorNum: number) => string);
  /** 3D: what to draw + which layer. Return null to draw nothing. */
  render3D?: (obj: Record<string, unknown>, ctx: NodeRender3DCtx) => Node3DOutput | null;
  /** 2D plan footprint (project units) for bounds + drawing. Return null to skip. */
  planFootprint?: (obj: Record<string, unknown>) => NodePlanFootprint | null;
}
