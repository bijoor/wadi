import { create } from "zustand";

// GLOBAL (device-wide) preference: which ROLE each object type defaults to when it
// has no explicit `layer`. The role + the object's floor together pick the concrete
// layer (see three/layers.ts::defaultLayerFor). Stored in localStorage — NOT in the
// .wadi (per-house layer definitions live in config.layers; this is a personal default
// for how objects get auto-assigned). A per-object `layer` override still wins.

export type LayerRole = "walls" | "structure" | "furniture" | "openings" | "site";

// Built-in role for each object type (the shipped default; the store overrides it).
export const BUILTIN_ROLE: Record<string, LayerRole> = {
  room: "walls",
  wall: "walls",
  pillar: "structure",
  beam: "structure",
  floor_slab: "structure",
  staircase: "structure",
  kitchen_platform: "structure",
  item: "furniture",
  door: "openings",
  window: "openings",
  plinth: "site",
  ground: "site",
};

const KEY = "wadi.layerDefaults";

function load(): Record<string, LayerRole> {
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Record<string, LayerRole>) : {};
  } catch {
    return {};
  }
}
function save(d: Record<string, LayerRole>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

interface LayerDefaultsState {
  // Overrides only — object types absent here fall back to BUILTIN_ROLE.
  overrides: Record<string, LayerRole>;
  setRole: (objType: string, role: LayerRole) => void;
  clearRole: (objType: string) => void;
  resetAll: () => void;
}

export const useLayerDefaultsStore = create<LayerDefaultsState>((set) => ({
  overrides: load(),
  setRole: (objType, role) =>
    set((s) => {
      const d = { ...s.overrides, [objType]: role };
      save(d);
      return { overrides: d };
    }),
  clearRole: (objType) =>
    set((s) => {
      const d = { ...s.overrides };
      delete d[objType];
      save(d);
      return { overrides: d };
    }),
  resetAll: () =>
    set(() => {
      save({});
      return { overrides: {} };
    }),
}));

/** Non-hook accessor for pure code paths (layers.ts). */
export function layerRoleOverrides(): Record<string, LayerRole> {
  return useLayerDefaultsStore.getState().overrides;
}

/** Effective role for an object type (override → built-in → "structure"). */
export function roleForType(objType: string, overrides?: Record<string, LayerRole>): LayerRole {
  return overrides?.[objType] ?? BUILTIN_ROLE[objType] ?? "structure";
}
