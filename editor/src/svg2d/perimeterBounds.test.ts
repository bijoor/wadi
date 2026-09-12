import { describe, expect, it } from "vitest";
import { extractFloorEdges, classifyPerimeterEdges, type RoomRect } from "./edges";
import { generateFloorPlanSvg } from "./floorPlan";
import { setActiveDimFlags } from "./config";

// An L-footprint: a main block plus a smaller room protruding at the top-right,
// so the main block's north wall (left of the protrusion) and the protrusion's
// west wall are OUTER walls at intermediate positions — a step the old min/max
// bounds test misclassified as interior.
const floor = {
  floor_number: 0,
  name: "Ground",
  objects: [
    { type: "room", name: "Main", x: 0, y: 100, width: 300, length: 200, walls: ["north", "south", "east", "west"] },
    { type: "room", name: "Wing", x: 180, y: 0, width: 120, length: 100, walls: ["north", "south", "east", "west"] },
  ],
};
const rooms: RoomRect[] = (floor.objects as { x: number; y: number; width: number; length: number }[])
  .map((o) => ({ x: o.x, y: o.y, w: o.width, l: o.length }));

describe("classifyPerimeterEdges — exposure catches step (L/T) outer walls", () => {
  const edges = extractFloorEdges(floor);
  const p = classifyPerimeterEdges(edges, rooms);
  const sources = (arr: { source: string }[]) => arr.map((e) => e.source).sort();

  it("the protruding wing's west wall is an outer (west) wall despite the step", () => {
    expect(sources(p.west)).toContain("Wing_West");
  });
  it("the main block's north wall (beside the wing) is an outer (north) wall", () => {
    expect(sources(p.north)).toContain("Main_North");
  });
  it("does NOT put the shared step edge (Wing_South, over the main block) on the perimeter", () => {
    // Wing_South is at y=100, coincident with Main_North's line but its south side
    // is inside Main and north side inside Wing → interior, not perimeter.
    const all = [...p.north, ...p.south, ...p.east, ...p.west].map((e) => e.source);
    expect(all).not.toContain("Wing_South");
  });
});

describe("generateFloorPlanSvg dimensions the step outer wall", () => {
  it("outer-only runs without error and emits perimeter dimension lines", () => {
    setActiveDimFlags({
      show_outer_dimensions: true, show_inner_dimensions: false,
      show_room_dimensions: false, show_opening_dimensions: false, show_room_names: false,
    });
    const svg = generateFloorPlanSvg(floor, 2.0);
    setActiveDimFlags(null);
    expect(svg).toMatch(/<line /);
  });
});
