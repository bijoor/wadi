import { describe, it, expect } from "vitest";
import { generateElevationView } from "./elevationView";
import type { HouseConfig } from "../schema/houseConfig";

// Regression: the plinth elevation rectangle must be drawn at the plinth
// object's own FOOTPRINT (projected onto the view axis), matching the 3D model
// and sitting under the walls — NOT spanning the full plot width. The plinth
// rect is the filled #A0826D rectangle.
const plinthRect = (svg: string) =>
  svg.match(/<rect x="([\d.]+)"[^>]*width="([\d.]+)"[^>]*fill="#A0826D"/);

// Plot 300×300; a 208×248 plinth (already expanded) on the Plinth floor.
const cfg = (): HouseConfig =>
  ({
    site: { plot_width: 300, plot_length: 300, reference_x: 0, reference_y: 0 },
    defaults: { wall_thickness: 8, floor_height: 120 },
    floors: [
      {
        floor_number: 0,
        name: "Plinth",
        height: 40,
        objects: [
          { type: "ground", name: "G", x: 0, y: 0, width: 300, length: 300 },
          { type: "plinth", name: "P", x: 0, y: 0, width: 208, length: 248, height: 40 },
        ],
      },
      {
        floor_number: 1,
        name: "Ground",
        objects: [{ type: "room", name: "R", x: 0, y: 0, width: 208, length: 248 }],
      },
    ],
    _walls_expanded: true,
  }) as unknown as HouseConfig;

describe("plinth elevation footprint", () => {
  it("front view: plinth width = its own width (208), not the plot width (300)", () => {
    const m = plinthRect(generateElevationView(cfg(), "front"))!;
    expect(Number(m[2])).toBeCloseTo(208);
    // front is mirrored: worldToSvgX(0, 208) = 300 - 208 = 92 → sits under the walls.
    expect(Number(m[1])).toBeCloseTo(92);
  });

  it("side view: plinth width = its own LENGTH (248), not the plot length (300)", () => {
    const m = plinthRect(generateElevationView(cfg(), "left"))!;
    expect(Number(m[2])).toBeCloseTo(248);
    expect(Number(m[1])).toBeCloseTo(0);
  });
});
