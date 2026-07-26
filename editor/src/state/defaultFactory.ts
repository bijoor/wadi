// Minimum-viable object shapes for each `HouseObject` type. Used by the
// Sidebar's "+" buttons: clicking + Room drops a room with these defaults
// into the current floor's objects[], selects it, and opens the property
// panel for immediate editing.
//
// Defaults aim to be "visible + valid":
//  - Names are unique per floor (Room_1, Room_2, …) so the tree stays
//    readable and the schema's `name: string` requirement is satisfied.
//  - Positions default to (0, 0) — the user can nudge afterwards.
//  - Sizes are large enough to see in the 3D scene but small enough to
//    fit inside any starter plot.

import type { HouseConfig, HouseObject } from "../schema/houseConfig";
import { getNode } from "../registry/registry";
import { uniqueName } from "./naming";

export { uniqueName };

// Types the sidebar exposes via "+" buttons. Roofs are intentionally
// omitted — one hip_roof per house is the norm, and its structure is
// too rich for a one-click default.
export type AddableObjectType =
  | "component"
  | "item"
  | "ground"
  | "plinth"
  | "floor_slab"
  | "room"
  | "wall"
  | "pillar"
  | "staircase"
  | "door"
  | "window"
  | "kitchen_platform"
  | "hip_roof"
  | "gable_roof"
  | "flat_roof"
  | "shed_roof"
  | "roof";

export const ADDABLE_TYPES: AddableObjectType[] = [
  "component",
  "item",
  "ground",
  "plinth",
  "floor_slab",
  "room",
  "wall",
  "pillar",
  "staircase",
  "door",
  "window",
  "kitchen_platform",
  "roof",         // v2 unified — the ONLY roof type in the "+" menu
  // Legacy hip_roof / gable_roof / flat_roof / shed_roof are still
  // parseable by the schema so old configs load, but they're no longer
  // offered as add options — v2 has full coverage and legacy code
  // paths will be removed soon.
];

export const ADDABLE_TYPE_LABEL: Record<AddableObjectType, string> = {
  component: "Component",
  item: "Furniture",
  ground: "Ground",
  plinth: "Plinth",
  floor_slab: "Floor slab",
  room: "Room",
  wall: "Wall",
  pillar: "Pillar",
  staircase: "Staircase",
  door: "Door",
  window: "Window",
  kitchen_platform: "Kitchen platform",
  roof: "Roof",   // v2 unified — the ONLY roof type for new configs
  hip_roof: "Hip roof (legacy)",
  gable_roof: "Gable roof (legacy)",
  flat_roof: "Flat roof (legacy)",
  shed_roof: "Shed roof (legacy)",
};

// Build a default object of the given type. `existing` is the current
// floor's object list so name-uniqueness can be enforced without a
// clash. Plot dims (from cfg.site) size the floor_slab default so a
// single-click add produces the full-plot slab.
export function makeDefault(
  type: AddableObjectType | string,
  cfg: HouseConfig,
  existing: HouseObject[],
): HouseObject {
  // Registry-driven object types own their own default (item, + future ports).
  const def = getNode(type);
  if (def?.makeDefault) return def.makeDefault(cfg, existing);

  const plotW = cfg.site.plot_width;
  const plotL = cfg.site.plot_length;

  switch (type as AddableObjectType) {
    case "component": {
      // Default to the first library component if one exists; otherwise an empty
      // ref the user fills in via the form.
      const firstRef = Object.keys(
        (cfg as { components?: Record<string, unknown> }).components ?? {},
      )[0] ?? "";
      return {
        type: "component",
        name: uniqueName(existing, "Component"),
        ref: firstRef,
        x: 0,
        y: 0,
      };
    }
    case "ground":
      return {
        type: "ground",
        name: uniqueName(existing, "Ground"),
        layer: "ground",
        x: 0,
        y: 0,
        width: plotW,
        length: plotL,
      };
    case "plinth":
      return {
        type: "plinth",
        name: uniqueName(existing, "Plinth"),
        layer: "plinth",
        x: 0,
        y: 0,
        width: plotW,
        length: plotL,
        height: 30,
      };
    case "floor_slab":
      return {
        type: "floor_slab",
        x: 0,
        y: 0,
        width: plotW,
        length: plotL,
      };
    case "room":
      return {
        type: "room",
        name: uniqueName(existing, "Room"),
        x: 0,
        y: 0,
        width: Math.min(100, plotW),
        length: Math.min(100, plotL),
      };
    case "wall":
      return {
        type: "wall",
        name: uniqueName(existing, "Wall"),
        start_x: 0,
        start_y: 0,
        end_x: Math.min(100, plotW),
        end_y: 0,
        height: 100,
      };
    case "pillar":
      return {
        type: "pillar",
        name: uniqueName(existing, "Pillar"),
        x: 10,
        y: 10,
        width: 10,
        length: 10,
        height: 100,
      };
    case "staircase":
      // rise_height omitted → auto-sizes to the floor below (the floor this
      // stair descends to). Placed on the destination (upper) floor.
      return {
        type: "staircase",
        start_x: 0,
        start_y: 0,
        step_rise: 6,
        step_tread: 10,
        step_width: 40,
        direction: "north",
      };
    case "door":
      return {
        type: "door",
        name: uniqueName(existing, "Door"),
        x: 10,
        y: 0,
        width: 40,
        height: 80,
        direction: "north",
      };
    case "window":
      return {
        type: "window",
        name: uniqueName(existing, "Window"),
        x: 10,
        y: 0,
        width: 50,
        height: 50,
        sill_height: 30,
        direction: "north",
      };
    case "hip_roof":
      // All geometry in project units (10 units = 1 ft). Position + size
      // cover the full plot by default; trusses at 20 / 50 / 80 % of Y.
      return {
        type: "hip_roof",
        x: 0,
        y: 0,
        width: plotW,
        length: plotL,
        ridge_axis: "y",
        ridge_h: 70,           // 7 ft
        min_overhang: 25,      // 2.5 ft
        trusses: {
          type: "fink",
          positions: [plotL * 0.2, plotL * 0.5, plotL * 0.8],
        },
      } as unknown as HouseObject;
    case "gable_roof":
      return {
        type: "gable_roof",
        x: 0,
        y: 0,
        width: plotW,
        length: plotL,
        ridge_axis: "y",
        ridge_h: 70,           // 7 ft
        min_overhang: 25,      // 2.5 ft
        gable_overhang: 10,    // 1 ft
      } as unknown as HouseObject;
    case "flat_roof":
      return {
        type: "flat_roof",
        x: 0,
        y: 0,
        width: plotW,
        length: plotL,
        slab_thickness: 6,      // 0.6 ft ≈ RCC deck
        overhang: 5,
        parapet_height: 30,     // 3 ft
        parapet_thickness: 8,   // 0.8 ft
      } as unknown as HouseObject;
    case "shed_roof":
      return {
        type: "shed_roof",
        x: 0,
        y: 0,
        width: plotW,
        length: plotL,
        slope_dir: "south",
        rise: 30,                // 3 ft rise across the longitudinal span
        min_overhang: 20,        // 2 ft
      } as unknown as HouseObject;
    case "roof":
      // v2 unified roof. Default is a single-segment pitched (hip) roof
      // spanning the plot along the Y-axis. Users can add more segments
      // for L / U / courtyard configs; switch roof_type for flat / shed;
      // flip per-endpoint styles for dutch gables. See
      // svg2d/roof/v2/model.ts for the full RoofConfig schema.
      return {
        type: "roof",
        roof_type: "pitched",
        default_endpoint: "closed",   // hip appearance by default
        segments: [
          {
            id: "seg0",
            start: [plotW / 2, 0],
            end: [plotW / 2, plotL],
            width: plotW,
          },
        ],
        slope: { by: "height", ridge_h: 70 },  // 7 ft rise
        min_overhang: 25,                       // 2.5 ft
      } as unknown as HouseObject;
    case "kitchen_platform":
      // Simple straight run near the plot's NW corner as a starting
      // point — user picks it up in the property panel and drags the
      // path to fit their walls. Depth 24u (~2ft) + height 32u
      // (~3.2ft) are typical counter dimensions.
      return {
        type: "kitchen_platform",
        name: uniqueName(existing, "KitchenPlatform"),
        path: [[10, 10], [Math.min(150, plotW - 10), 10]],
        side: "right",
        depth: 24,
        height: 32,
      };
    default:
      throw new Error(`makeDefault: unknown object type "${type}"`);
  }
}

// Default shape for a fresh floor added via "+ Floor". Includes a
// full-plot floor_slab so the user has something visible in the 3D
// scene right away. Per-floor heights are omitted so the floor inherits
// house.defaults.floor_height / .wall_height / .slab_thickness.
export function makeDefaultFloor(cfg: HouseConfig, floorNumber: number) {
  return {
    floor_number: floorNumber,
    name: floorNumber === 0
      ? "Ground Floor"
      : floorNumber === 1
        ? "First Floor"
        : `Floor ${floorNumber}`,
    objects: [
      {
        type: "floor_slab" as const,
        x: 0,
        y: 0,
        width: cfg.site.plot_width,
        length: cfg.site.plot_length,
      },
    ],
  };
}

// Default `defaults` block for a fresh house — the four independent
// per-floor dimensions with the values documented in
// project_floor_height_semantics memory.
export const DEFAULT_HOUSE_DEFAULTS = {
  floor_height: 98,
  wall_height: 90,
  slab_thickness: 8,
};
