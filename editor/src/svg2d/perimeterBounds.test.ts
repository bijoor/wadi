import { describe, expect, it } from "vitest";
import { extractFloorEdges, classifyPerimeterEdges } from "./edges";
import { generateFloorPlanSvg } from "./floorPlan";
import { setActiveDimFlags } from "./config";
import { formatDimension } from "./format";

// A room whose walls sit INSIDE a larger floor slab (a deck/plinth apron, like the
// tiny-home decks). The object bounding box is the slab; the walls are 4u inside.
const floor = {
  floor_number: 0,
  name: "Ground",
  objects: [
    { type: "floor_slab", name: "Deck", x: 0, y: 0, width: 200, length: 200 },
    { type: "room", name: "R", x: 4, y: 4, width: 192, length: 192, walls: ["north", "south", "east", "west"] },
  ],
};

describe("perimeter classification uses wall bounds, not the slab apron", () => {
  it("against the slab bounds (0..200) NO wall lands on the perimeter", () => {
    const edges = extractFloorEdges(floor);
    const p = classifyPerimeterEdges(edges, { min_x: 0, max_x: 200, min_y: 0, max_y: 200 });
    expect(p.north.length + p.south.length + p.west.length + p.east.length).toBe(0);
  });
  it("against the wall bounds (4..196) all four outer walls are perimeter", () => {
    const edges = extractFloorEdges(floor);
    const p = classifyPerimeterEdges(edges, { min_x: 4, max_x: 196, min_y: 4, max_y: 196 });
    expect(p.north.length).toBe(1);
    expect(p.south.length).toBe(1);
    expect(p.west.length).toBe(1);
    expect(p.east.length).toBe(1);
  });
});

describe("generateFloorPlanSvg dimensions the perimeter walls despite the apron", () => {
  it("outer-only dimensions a perimeter wall run, not only the slab extent", () => {
    setActiveDimFlags({
      show_outer_dimensions: true, show_inner_dimensions: false,
      show_room_dimensions: false, show_opening_dimensions: false, show_room_names: false,
    });
    const svg = generateFloorPlanSvg(floor, 2.0);
    setActiveDimFlags(null);
    const slabLabel = formatDimension(200); // the 200u slab extent
    // Side (rotated) dimension labels: the floor-extent lines give the slab value;
    // the perimeter walls (now classified against the wall bounds) add a DIFFERENT
    // one. Before the fix perim was empty, so every side label was the slab extent.
    const sideLabels = [...svg.matchAll(/rotate\(-90[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]);
    expect(sideLabels.length).toBeGreaterThan(0);
    expect(sideLabels.some((l) => l !== slabLabel)).toBe(true);
  });
});
