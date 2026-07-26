import { describe, expect, it } from "vitest";
import { object as houseObject } from "./houseConfig";
import { expandRoomWalls } from "../svg2d/expand";
import { generateAllFloorPlans } from "../svg2d/floorPlansAll";
import { metersToUnits } from "../three/units";

const bed = {
  type: "item",
  name: "Bed",
  asset: { id: "bed_double", name: "Double bed", src: "/furniture/bed_double.glb", dimensions: [1.6, 0.6, 2.0] },
  x: 100,
  y: 120,
  rotation: 45,
};

const house = (objects: unknown[]) =>
  ({
    site: { reference_x: 0, reference_y: 0, plot_width: 300, plot_length: 400 },
    floors: [{ floor_number: 1, name: "Ground Floor", objects }],
  }) as never;

describe("item (GLB furniture) object", () => {
  it("validates against the object schema with an inline asset", () => {
    const parsed = houseObject.parse(bed);
    expect(parsed.type).toBe("item");
  });

  it("rejects a non-strict extra key and a bad dimensions tuple", () => {
    expect(() => houseObject.parse({ ...bed, bogus: 1 })).toThrow();
    expect(() =>
      houseObject.parse({ ...bed, asset: { ...bed.asset, dimensions: [1, 2] } }),
    ).toThrow();
  });

  it("passes through expansion untouched (renderers see it directly)", () => {
    const out = expandRoomWalls(house([bed]), 8, { lenient: true });
    const objs = out.floors[0].objects as Array<Record<string, unknown>>;
    const item = objs.find((o) => o.type === "item")!;
    expect(item).toBeTruthy();
    expect(item.x).toBe(100);
    expect((item.asset as { id: string }).id).toBe("bed_double");
  });

  it("draws a furniture footprint on the floor plan", () => {
    const files = generateAllFloorPlans(house([bed]));
    const svg = files.map((f) => f.content).join("\n");
    // Translucent, unlabelled footprint (see-through so plan details show), rotated.
    expect(svg).toContain("#e8d8c0");
    expect(svg).toContain('fill-opacity="0.2"');
    expect(svg).not.toContain(">Bed<");
    expect(svg).toContain("rotate(45");
  });
});

describe("metersToUnits (3D scale)", () => {
  it("defaults to feet_inches/per_unit=10 → 32.8 units per metre", () => {
    expect(metersToUnits(1)).toBeCloseTo(32.808, 2);
    // A 1.6 m bed reads ~52.5 units wide.
    expect(metersToUnits(1.6)).toBeCloseTo(52.49, 1);
  });

  it("scales with per_unit and metric systems", () => {
    // meters system, per_unit=100 → 100 units = 1 m.
    expect(metersToUnits(1, { system: "meters", per_unit: 100 })).toBeCloseTo(100, 5);
  });
});
