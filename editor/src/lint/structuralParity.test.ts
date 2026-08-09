// Findings-parity safety net for the C2-C7 migration (P2).
//
// Captures lintStructure's EXACT output (rule + level + message + floor + where)
// on a house that trips each convention, as a sorted set. Migrating a rule from
// the legacy body into a constraint module must not change this snapshot. Order
// is intentionally normalised away (the registry groups by rule, the legacy body
// interleaved by floor) — only the CONTENT of the findings is guarded.

import { describe, it, expect } from "vitest";
import { lintStructure } from "./structural";

const plinth = (h: number) => ({ type: "plinth", name: "P", x: 0, y: 0, width: 100, length: 100, height: h });
const enclosed = ["north", "south", "east", "west"];

const HOUSES: Record<string, unknown> = {
  C1_float: { floors: [{ floor_number: 0, name: "Plinth", height: 100, objects: [plinth(40)] }] },

  C3_noslab: {
    floors: [{ floor_number: 1, name: "Ground", objects: [{ type: "room", name: "R", x: 4, y: 4, width: 200, length: 200, walls: enclosed }] }],
  },

  C4_gap: {
    floors: [
      { floor_number: 1, name: "Ground", height: 120, wall_height: 108, slab_thickness: 8, objects: [
        { type: "floor_slab", x: 0, y: 0, width: 200, length: 200 },
        { type: "room", name: "R", x: 4, y: 4, width: 190, length: 190, walls: enclosed },
      ] },
      { floor_number: 2, name: "Upper", objects: [] },
    ],
  },

  C5_buried: {
    floors: [
      { floor_number: 0, name: "Plinth", height: 30, objects: [plinth(30)] },
      { floor_number: 1, name: "Ground", height: 108, slab_thickness: 0, objects: [
        { type: "room", name: "R", x: 4, y: 4, width: 90, length: 90, walls: enclosed },
        { type: "staircase", name: "S", start_x: 20, start_y: 80, step_rise: 7, step_tread: 11, step_width: 44, direction: "north", rise_height: 108 },
      ] },
    ],
  },

  C2_open: {
    floors: [{ floor_number: 1, name: "Ground", slab_thickness: 0, objects: [
      { type: "room", name: "Studio", x: 4, y: 4, width: 200, length: 200, walls: ["north", "south"] },
    ] }],
  },

  C6_overlap: {
    floors: [{ floor_number: 1, name: "Ground", slab_thickness: 0, objects: [
      { type: "room", name: "Hall", x: 0, y: 0, width: 300, length: 200, walls: {
        north: {}, east: {}, west: {},
        south: { openings: [
          { kind: "door", name: "D1", offset: 40, width: 40 },
          { kind: "window", name: "W1", offset: 60, width: 40 },
        ] },
      } },
    ] }],
  },

  C7_furniture: {
    floors: [{ floor_number: 1, name: "Ground", slab_thickness: 0, objects: [
      { type: "item", name: "Bed A", x: 100, y: 100, asset: { id: "bed", src: "/f/bed.glb", dimensions: [2, 1, 2] } },
      { type: "item", name: "Bed B", x: 110, y: 100, asset: { id: "bed", src: "/f/bed.glb", dimensions: [2, 1, 2] } },
    ] }],
  },
};

// Deterministic, order-independent view of the findings.
function canonical(house: unknown) {
  return lintStructure(house as never)
    .map((f) => ({ rule: f.rule, level: f.level, floor: f.floor, where: f.where, message: f.message }))
    .sort((a, b) => (a.rule + a.message).localeCompare(b.rule + b.message));
}

describe("structural lint — findings parity (C1-C7)", () => {
  for (const [name, house] of Object.entries(HOUSES)) {
    it(`${name} findings are stable`, () => {
      expect(canonical(house)).toMatchSnapshot();
    });
  }
});
