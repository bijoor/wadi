import { create } from "zustand";
import { getNode } from "../registry/registry";

// Visibility layers roughly match the ones used in docs/index.html's GLB
// viewer. Each object we render gets tagged with a layer id; the layer
// panel toggles whole groups on/off. Colors here are hints for future
// use (e.g. material override or legend swatches).
export interface LayerDef {
  id: string;
  label: string;
  color: string;
  // Friendly group this layer rolls up into for the "Show/hide layers" menu
  // (owners toggle whole groups; the granular layers sit under them). Editable
  // per-house via the config's `layers` array; these are the defaults.
  group?: string;
}

export const DEFAULT_LAYERS: LayerDef[] = [
  { id: "loft", label: "Roof shell", color: "#e88968", group: "Roof" },
  { id: "frame_surface", label: "Purlins & rafters", color: "#8a8a8a", group: "Roof" },
  { id: "frame_spine", label: "Ridges & trusses", color: "#5a5a5a", group: "Roof" },
  { id: "f1_beam", label: "First floor top beams", color: "#b8b8b8", group: "Structure" },
  { id: "f1", label: "First floor walls", color: "#f5c9a0", group: "Walls" },
  { id: "f1_slab", label: "First floor slab", color: "#b8b8b8", group: "Structure" },
  { id: "f0", label: "Ground floor walls", color: "#f5c9a0", group: "Walls" },
  { id: "openings", label: "Doors & windows", color: "#7ab6ff", group: "Doors & windows" },
  { id: "pillars", label: "Pillars", color: "#ffffff", group: "Structure" },
  { id: "plinth", label: "Plinth", color: "#a0826d", group: "Site" },
  { id: "ground", label: "Ground", color: "#5c7346", group: "Site" },
  { id: "furniture", label: "Furniture", color: "#c7a17a", group: "Furniture" },
];

interface LayerState {
  // Per-layer visibility. Missing id ⇒ treated as visible (call sites use
  // `visible[id] !== false`), so a new layer starts shown without seeding.
  // The layer LIST itself lives in the config (see effectiveLayers) — the
  // store only tracks which are toggled on/off.
  visible: Record<string, boolean>;
  toggle: (id: string) => void;
  setAll: (ids: string[], visible: boolean) => void;
  // Set a subset of layers on/off without disturbing the rest (group toggles).
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

// The built-in fallback: which layer id an object lands in when it has no
// explicit `layer`. MUST match the ids House3D pushes to (all present in
// DEFAULT_LAYERS). Shared by House3D (grouping) and effectiveLayers (menu)
// so the two never drift.
// NOTE: the plinth is floor 0; the ground floor is floor 1. The historical
// "floor 0 → plinth/f0" branches therefore key on floorNum === 1 now.
export function heuristicLayerId(objType: string, floorNum: number): string {
  // Registry-driven types (item, + future ports) declare their default layer.
  const def = getNode(objType);
  if (def?.defaultLayerId) {
    return typeof def.defaultLayerId === "function"
      ? def.defaultLayerId({}, floorNum)
      : def.defaultLayerId;
  }
  switch (objType) {
    case "plinth":
      return "plinth";
    case "ground":
      return "ground";
    case "floor_slab":
      return floorNum === 1 ? "plinth" : "f1_slab";
    case "beam":
      return "f1_beam";
    case "pillar":
      return "pillars";
    case "room":
    case "wall":
      return floorNum === 1 ? "f0" : "f1";
    case "staircase":
    case "kitchen_platform":
      return floorNum === 1 ? "plinth" : "f1_slab";
    default:
      return "ground";
  }
}

const ROOF_TYPES = new Set([
  "hip_roof",
  "gable_roof",
  "flat_roof",
  "shed_roof",
  "roof",
]);

// The full set of layers to show in the menu for a config — derived purely
// from the config so the scene and menu stay in lockstep without any
// cross-component publishing. Starts from the configured list (or the
// defaults), then guarantees an entry for every layer the scene actually
// renders into: the plinth + ground, each object's resolved layer (explicit
// `layer` or the heuristic), and the roof-internal layers when a roof
// exists. Labels/colors come from the configured list, else DEFAULT_LAYERS,
// else the raw id.
export function effectiveLayers(config: unknown): LayerDef[] {
  const defs = resolveLayers(config);
  const byId = new Map(defs.map((d) => [d.id, d]));
  const order: LayerDef[] = [...defs];
  const ensure = (id: string) => {
    if (byId.has(id)) return;
    const fb =
      DEFAULT_LAYERS.find((d) => d.id === id) ??
      ({ id, label: id, color: "#888888" } as LayerDef);
    byId.set(id, fb);
    order.push(fb);
  };

  ensure("plinth");
  ensure("ground");

  const floors =
    (config as { floors?: Array<{ floor_number?: number; objects?: Array<Record<string, unknown>> }> } | null)
      ?.floors ?? [];
  let hasRoof = false;
  floors.forEach((f, fi) => {
    const floorNum = typeof f.floor_number === "number" ? f.floor_number : fi;
    for (const o of f.objects ?? []) {
      const t = o.type as string;
      if (ROOF_TYPES.has(t)) {
        hasRoof = true;
        continue;
      }
      if (t === "door" || t === "window") continue; // rendered with their wall
      const explicit = typeof o.layer === "string" && o.layer ? o.layer : null;
      ensure(explicit ?? heuristicLayerId(t, floorNum));
    }
  });
  if (hasRoof) {
    ensure("loft");
    ensure("frame_spine");
    ensure("frame_surface");
  }

  return order;
}

// Resolve the layer list for a house config: its own `layers` (normalized)
// or the built-in defaults. Colors default to grey when omitted.
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
  return DEFAULT_LAYERS;
}

// Roll the effective layers up into friendly groups for the "Show/hide layers"
// menu, in first-appearance order. A layer with no `group` becomes its own
// single-member group (labelled by the layer), so nothing is ever hidden from
// the menu. The membership is fully config-driven (see LayerDef.group).
export interface LayerGroup {
  label: string;
  layerIds: string[];
}
export function layerGroups(config: unknown): LayerGroup[] {
  const order: string[] = [];
  const byLabel = new Map<string, string[]>();
  for (const l of effectiveLayers(config)) {
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

// Which layer a per-floor object belongs to. Ground floor rooms/walls
// land in "f0"; first-floor in "f1"; slabs above ground in "f1_slab";
// beams above first floor walls in "f1_beam". Pillars are their own
// bucket (they span multiple floors visually).
export function layerForObject(
  objType: string,
  floorNumber: number,
): string {
  if (objType === "plinth") return "plinth";
  if (objType === "ground") return "ground";
  if (objType === "pillar") return "pillars";
  if (objType === "item") return "furniture";
  if (objType === "hip_roof" || objType === "gable_roof") return "loft";
  if (objType === "door" || objType === "window") return "openings";
  // Plinth is floor 0; ground floor is 1 (historical floor-0 branches → 1).
  if (objType === "floor_slab") {
    return floorNumber === 1 ? "plinth" : "f1_slab";
  }
  if (objType === "beam") return "f1_beam";
  if (objType === "room" || objType === "wall") {
    return floorNumber === 1 ? "f0" : "f1";
  }
  return "ground";
}
