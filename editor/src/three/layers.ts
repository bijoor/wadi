import { create } from "zustand";
import { layerRoleOverrides, roleForType, type LayerRole } from "../state/layerDefaults";

// A 3D visibility layer. Objects are tagged with a layer id; the 📚 menu toggles
// whole GROUPS (and individual layers) on/off.
//
// Layer scheme (floor-primary): every habitable floor is its own GROUP (by the floor's
// name), split into role sub-layers — Walls / Structure / Furniture / Doors & windows —
// with ids `f{floorNumber}_{role}`. Cross-floor groups: "Site" (plinth, ground) and
// "Roof" (shell/purlins/trusses — code-managed, NOT exposed to the layer editor).
export interface LayerDef {
  id: string;
  label: string;
  color: string;
  group?: string;
}

// Per-floor role sub-layers, in menu order within a floor group.
export const ROLES: LayerRole[] = ["walls", "structure", "furniture", "openings"];
const ROLE_LABEL: Record<string, string> = {
  walls: "Walls",
  structure: "Structure",
  furniture: "Furniture",
  openings: "Doors & windows",
};
const ROLE_COLOR: Record<string, string> = {
  walls: "#f5c9a0",
  structure: "#b8b8b8",
  // Distinct muted teal so furniture reads apart from the warm tan walls (and
  // the terracotta roof / green plot) — both in the layer menu and the 3D
  // placeholder (see FurnitureItem GhostBox).
  furniture: "#4f8f86",
  openings: "#7ab6ff",
};

// Fixed, non-floor layers. Roof ids are code-managed (the roof engine pushes to them);
// they appear in the menu but are NOT editable in House settings.
const STATIC_META: Record<string, LayerDef> = {
  plinth: { id: "plinth", label: "Plinth", color: "#a0826d", group: "Site" },
  ground: { id: "ground", label: "Ground", color: "#5c7346", group: "Site" },
  loft: { id: "loft", label: "Roof shell", color: "#e88968", group: "Roof" },
  frame_surface: { id: "frame_surface", label: "Purlins & rafters", color: "#8a8a8a", group: "Roof" },
  frame_spine: { id: "frame_spine", label: "Ridges & trusses", color: "#5a5a5a", group: "Roof" },
};
export const ROOF_LAYER_IDS = ["loft", "frame_surface", "frame_spine"] as const;

// Static fallback set (Site + Roof), kept for any consumer that wants a baseline.
export const DEFAULT_LAYERS: LayerDef[] = [
  STATIC_META.plinth,
  STATIC_META.ground,
  STATIC_META.loft,
  STATIC_META.frame_surface,
  STATIC_META.frame_spine,
];

interface LayerState {
  // Per-layer visibility. Missing id ⇒ visible (call sites use `visible[id] !== false`).
  visible: Record<string, boolean>;
  toggle: (id: string) => void;
  setAll: (ids: string[], visible: boolean) => void;
  setMany: (ids: string[], visible: boolean) => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  visible: {},
  toggle: (id) =>
    set((s) => ({ visible: { ...s.visible, [id]: !(s.visible[id] ?? true) } })),
  setAll: (ids, visible) =>
    set(() => ({ visible: Object.fromEntries(ids.map((id) => [id, visible])) })),
  setMany: (ids, visible) =>
    set((s) => ({
      visible: { ...s.visible, ...Object.fromEntries(ids.map((id) => [id, visible])) },
    })),
}));

const ROOF_TYPES = new Set(["roof"]);

// The DEFAULT layer id for an object with no explicit `layer`: its floor + its role.
// role = per-device override (localStorage) → built-in role for the type. "site" role →
// the shared plinth/ground layers; every other role → `f{floor}_{role}`.
export function defaultLayerFor(
  objType: string,
  floorNum: number,
  overrides?: Record<string, LayerRole>,
): string {
  const role = roleForType(objType, overrides ?? layerRoleOverrides());
  if (role === "site") return objType === "ground" ? "ground" : "plinth";
  return `f${floorNum}_${role}`;
}

// Back-compat alias (older call sites).
export const heuristicLayerId = defaultLayerFor;

// Look up a layer's label/color/group from its id (+ the config, for floor names).
export function layerMetaForId(id: string, config: unknown): LayerDef {
  const st = STATIC_META[id];
  if (st) return st;
  const m = /^f(\d+)_([a-z_]+)$/.exec(id);
  if (m) {
    const n = Number(m[1]);
    const role = m[2];
    const floors =
      (config as { floors?: Array<{ floor_number?: number; name?: string }> } | null)?.floors ?? [];
    const floor = floors.find((f) => (typeof f.floor_number === "number" ? f.floor_number : -999) === n);
    const group = floor?.name && floor.name.trim() ? floor.name : `Floor ${n}`;
    return { id, label: ROLE_LABEL[role] ?? role, color: ROLE_COLOR[role] ?? "#888888", group };
  }
  return { id, label: id, color: "#888888" };
}

// The full ordered layer set for a config: config.layers (the per-house source of
// truth, if present) plus any layer the scene actually needs — per habitable floor's
// role sub-layers, each object's resolved layer, the Site layers, and the roof layers
// when a roof exists. So the scene and the menu never drift.
export function effectiveLayers(config: unknown, overrides?: Record<string, LayerRole>): LayerDef[] {
  const ov = overrides ?? layerRoleOverrides();
  const configLayers = resolveLayers(config);
  const byId = new Map(configLayers.map((d) => [d.id, d]));
  const order: LayerDef[] = [...configLayers];
  const ensure = (id: string | null | undefined) => {
    if (!id || byId.has(id)) return;
    const def = layerMetaForId(id, config);
    byId.set(id, def);
    order.push(def);
  };

  const floors =
    (config as { floors?: Array<{ floor_number?: number; objects?: Array<Record<string, unknown>> }> } | null)
      ?.floors ?? [];
  const hasRoof = floors.some((f) =>
    (f.objects ?? []).some((o) => ROOF_TYPES.has(o.type as string)),
  );

  // Default (non-materialized) order mirrors the physical stack, TOP → BOTTOM:
  // Roof on top, then floors highest-first, then the shared Site layers at the
  // bottom. Anything already in config.layers keeps its stored order (it comes
  // first, above) — this only positions the auto-added layers.
  if (hasRoof) for (const id of ROOF_LAYER_IDS) ensure(id);

  const floorsByHeight = floors
    .map((f, fi) => ({ f, n: typeof f.floor_number === "number" ? f.floor_number : fi }))
    .sort((a, b) => b.n - a.n);
  for (const { f, n } of floorsByHeight) {
    // Predictable per-floor role sub-layers (so each floor group is complete).
    if (n >= 1) for (const r of ROLES) ensure(`f${n}_${r}`);
    for (const o of f.objects ?? []) {
      const t = o.type as string;
      if (ROOF_TYPES.has(t)) continue;
      const id = (typeof o.layer === "string" && o.layer ? o.layer : null) ?? defaultLayerFor(t, n, ov);
      // Defer the shared Site layers so they land at the bottom.
      if (id !== "plinth" && id !== "ground") ensure(id);
    }
  }
  ensure("plinth");
  ensure("ground");

  return order;
}

// Resolve the house's OWN layer list (config.layers), normalized. Empty when absent —
// callers that want the complete set use effectiveLayers.
export function resolveLayers(config: unknown): LayerDef[] {
  const raw = (config as { layers?: unknown } | null)?.layers;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((l, i) => {
      const o = (l ?? {}) as { id?: unknown; label?: unknown; color?: unknown; group?: unknown };
      const id = typeof o.id === "string" && o.id ? o.id : `layer${i}`;
      return {
        id,
        label: typeof o.label === "string" && o.label ? o.label : id,
        color: typeof o.color === "string" && o.color ? o.color : "#888888",
        group: typeof o.group === "string" && o.group ? o.group : undefined,
      };
    });
  }
  return [];
}

// Roll the effective layers into groups (floor names, Site, Roof) in first-appearance
// order for the "Show/hide layers" menu. A layer with no group is its own group.
export interface LayerGroup {
  label: string;
  layerIds: string[];
}
export function layerGroups(config: unknown, overrides?: Record<string, LayerRole>): LayerGroup[] {
  const order: string[] = [];
  const byLabel = new Map<string, string[]>();
  for (const l of effectiveLayers(config, overrides)) {
    const g = l.group && l.group.trim() ? l.group : l.label;
    let ids = byLabel.get(g);
    if (!ids) {
      ids = [];
      byLabel.set(g, ids);
      order.push(g);
    }
    ids.push(l.id);
  }
  return order.map((label) => ({ label, layerIds: byLabel.get(label) ?? [] }));
}

// True for the code-managed roof layers (not editable in House settings).
export function isRoofLayer(id: string): boolean {
  return (ROOF_LAYER_IDS as readonly string[]).includes(id);
}
