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

// Types the sidebar exposes via "+" buttons. Roofs are intentionally
// omitted — one hip_roof per house is the norm, and its structure is
// too rich for a one-click default.
export type AddableObjectType =
  | "floor_slab"
  | "room"
  | "wall"
  | "pillar"
  | "staircase"
  | "door"
  | "window"
  | "hip_roof"
  | "gable_roof";

export const ADDABLE_TYPES: AddableObjectType[] = [
  "floor_slab",
  "room",
  "wall",
  "pillar",
  "staircase",
  "door",
  "window",
  "hip_roof",
  "gable_roof",
];

export const ADDABLE_TYPE_LABEL: Record<AddableObjectType, string> = {
  floor_slab: "Floor slab",
  room: "Room",
  wall: "Wall",
  pillar: "Pillar",
  staircase: "Staircase",
  door: "Door",
  window: "Window",
  hip_roof: "Hip roof",
  gable_roof: "Gable roof",
};

// Build a default object of the given type. `existing` is the current
// floor's object list so name-uniqueness can be enforced without a
// clash. Plot dims (from cfg.site) size the floor_slab default so a
// single-click add produces the full-plot slab.
export function makeDefault(
  type: AddableObjectType,
  cfg: HouseConfig,
  existing: HouseObject[],
): HouseObject {
  const plotW = cfg.site.plot_width;
  const plotL = cfg.site.plot_length;

  switch (type) {
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
      return {
        type: "staircase",
        start_x: 0,
        start_y: 0,
        num_steps: 12,
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
  }
}

// Ensures the new object's name doesn't collide with anything already
// on the floor. Appends _1, _2, … until free.
function uniqueName(existing: HouseObject[], base: string): string {
  const taken = new Set<string>();
  for (const o of existing) {
    const n = (o as { name?: unknown }).name;
    if (typeof n === "string") taken.add(n);
  }
  let i = 1;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

// Default shape for a fresh floor added via "+ Floor". Includes a
// full-plot floor_slab so the user has something visible in the 3D
// scene right away.
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
