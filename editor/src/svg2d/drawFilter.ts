// Draw filter for the 2D Layout view. Controls WHICH objects and WHICH
// annotations appear on the composite sheet, driven by the interactive
// panel. Object selection is applied by PRE-FILTERING the config (dropping
// objects that fail the type/layer/object test, and stripping openings when
// off) so the existing plan + elevation renderers stay untouched. Annotation
// toggles map to the renderers' dimension show-flags via config's active
// override.

import { heuristicLayerId } from "../three/layers";

export interface DrawFilter {
  // Enabled top-level object types. undefined/null = all. The pseudo-type
  // "openings" gates doors/windows (flat objects) + nested wall/room openings.
  types?: string[] | null;
  // Enabled layer ids. undefined/null = all. An object's layer is its
  // explicit `layer` or the automatic per-type/floor heuristic.
  layers?: string[] | null;
  // Object keys to HIDE (opt-out); key = `${floor_number}:${objectIndex}`.
  hiddenObjects?: string[];
  // Dimension annotation toggles (map to DimensionConfig show-flags).
  dims?: Partial<{ outer: boolean; inner: boolean; room: boolean; opening: boolean }>;
  // Room-name label toggles: whether to show room names at all, and whether
  // to draw short mnemonic keys + a legend instead of full names.
  labels?: Partial<{ roomNames: boolean; roomAbbrev: boolean }>;
  // Smart-dimensioning toggles (composite sheet only). crossView: elevations
  // drop horizontal spans the plan already carries. withinView: skip a chain
  // re-measuring an edge already dimensioned in the same view. overlap: bump
  // colliding dimension labels to stacked offset levels. Read directly by
  // compositeSheet (not via dimShowFlags).
  smart?: Partial<{ crossView: boolean; withinView: boolean; overlap: boolean }>;
  // Manual text-size multiplier (composite only). The composite auto-scales
  // fonts with the house's physical span so text stays legible at fit-to-view;
  // on a large house that can render labels oversized. This multiplies that
  // auto factor (1 = unchanged). Read by main.ts::wadiRenderLayout, not here.
  textScale?: number;
}

const OPENING_TYPES = new Set(["door", "window"]);

// Object identity used by the per-object filter + the panel's checkbox list.
export function objectKey(floorNumber: number, objectIndex: number): string {
  return `${floorNumber}:${objectIndex}`;
}

function stripOpenings(o: Record<string, unknown>): Record<string, unknown> {
  if (o.type === "room" && o.walls && !Array.isArray(o.walls)) {
    const walls: Record<string, unknown> = {};
    for (const [side, w] of Object.entries(o.walls as Record<string, unknown>)) {
      walls[side] = { ...(w as Record<string, unknown>), openings: [] };
    }
    return { ...o, walls };
  }
  if (o.type === "wall" && Array.isArray((o as { openings?: unknown }).openings)) {
    return { ...o, openings: [] };
  }
  return o;
}

// Return a shallow-cloned config whose floors' objects are limited to those
// that pass the filter (and with openings stripped when the openings type is
// off). Returns the input unchanged when there's no object-level filtering.
export function applyDrawFilter<T extends Record<string, unknown>>(
  cfg: T,
  filter: DrawFilter | null | undefined,
): T {
  if (!filter || (!filter.types && !filter.layers && !filter.hiddenObjects?.length)) {
    return cfg;
  }
  const typeSet = filter.types ? new Set(filter.types) : null;
  const layerSet = filter.layers ? new Set(filter.layers) : null;
  const hidden = new Set(filter.hiddenObjects ?? []);
  const openingsOn = !typeSet || typeSet.has("openings");

  const floors = ((cfg.floors as Array<Record<string, unknown>>) ?? []).map((f, fi) => {
    const floorNum = (f.floor_number as number | undefined) ?? fi;
    const objects = ((f.objects as Array<Record<string, unknown>>) ?? [])
      .filter((o, oi) => {
        if (hidden.has(objectKey(floorNum, oi))) return false;
        const t = o.type as string;
        if (OPENING_TYPES.has(t)) return openingsOn;
        if (typeSet && !typeSet.has(t)) return false;
        if (layerSet) {
          const layer =
            typeof o.layer === "string" && o.layer
              ? (o.layer as string)
              : heuristicLayerId(t, floorNum);
          if (!layerSet.has(layer)) return false;
        }
        return true;
      })
      .map((o) => (openingsOn ? o : stripOpenings(o)));
    return { ...f, objects };
  });
  return { ...cfg, floors };
}

// Map the filter's dimension toggles onto the renderer's DimensionConfig
// show-flags. Undefined toggles are left to the config default.
export function dimShowFlags(
  filter: DrawFilter | null | undefined,
): Partial<{
  show_outer_dimensions: boolean;
  show_inner_dimensions: boolean;
  show_room_dimensions: boolean;
  show_opening_dimensions: boolean;
  show_room_names: boolean;
  abbreviate_room_names: boolean;
}> {
  const out: Record<string, boolean> = {};
  const d = filter?.dims;
  if (d) {
    if (d.outer !== undefined) out.show_outer_dimensions = d.outer;
    if (d.inner !== undefined) out.show_inner_dimensions = d.inner;
    if (d.room !== undefined) out.show_room_dimensions = d.room;
    if (d.opening !== undefined) out.show_opening_dimensions = d.opening;
  }
  const l = filter?.labels;
  if (l) {
    if (l.roomNames !== undefined) out.show_room_names = l.roomNames;
    if (l.roomAbbrev !== undefined) out.abbreviate_room_names = l.roomAbbrev;
  }
  return out;
}
