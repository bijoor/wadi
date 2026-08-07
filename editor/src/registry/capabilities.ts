// Capability + View registry — the domain-neutral seam between primitives and
// output surfaces (plans/primitive-componentization.md §2.4).
//
// A primitive implements CAPABILITIES (render3D / drawPlan / drawElevation). A VIEW
// is an output surface that CONSUMES one capability. The mapping is data, not a
// hardcoded switch: the kernel treats capability names as opaque, and a different
// DSL product would register its own views (render-schematic, …) with no kernel
// change. Wadi registers the three views below.
//
// P1 keeps typed per-capability hooks on NodeDefinition (their signatures differ:
// ReactNode vs SVG string), so this module records the capability↔view mapping and
// answers "which views can render this primitive" — the basis for editor-tab
// enablement and the "unrenderable in <view>" skip-warning. A uniform generic
// dispatch is not forced here; that can come at kernel extraction (P4).

import type { CapabilityName } from "./types";
import { getNode } from "./registry";

export interface ViewDef {
  /** Stable view id (matches the app's preview tabs). */
  id: string;
  /** Human label. */
  label: string;
  /** The primitive capability this view renders from. */
  capability: CapabilityName;
}

const VIEWS = new Map<string, ViewDef>();

export function registerView(v: ViewDef): void {
  VIEWS.set(v.id, v);
}

export function allViews(): ViewDef[] {
  return [...VIEWS.values()];
}

/** Does this primitive implement the capability the given view consumes? */
export function primitiveHandlesView(type: string, viewId: string): boolean {
  const view = VIEWS.get(viewId);
  const def = getNode(type);
  return !!(view && def && typeof def[view.capability] === "function");
}

/** The views that CAN render a given primitive type (it implements their capability). */
export function viewsFor(type: string): ViewDef[] {
  const def = getNode(type);
  if (!def) return [];
  return allViews().filter((v) => typeof def[v.capability] === "function");
}

// --- Wadi's built-in views (the app's output surfaces) -----------------------
registerView({ id: "3d", label: "3D Model", capability: "render3D" });
registerView({ id: "plan", label: "Floor Plans", capability: "drawPlan" });
registerView({ id: "elevation", label: "Elevations", capability: "drawElevation" });
