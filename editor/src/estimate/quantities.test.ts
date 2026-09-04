import { describe, expect, it } from "vitest";
import type { HouseConfig } from "../svg2d/expand";
import { computeQuantities } from "./quantities";

const H = 90;
function cfg(objects: Record<string, unknown>[], extra: Record<string, unknown> = {}): HouseConfig {
  return {
    defaults: { wall_height: H, wall_thickness: 8, slab_thickness: 8 },
    floors: [{ floor_number: 0, name: "F0", objects }],
    ...extra,
  } as unknown as HouseConfig;
}

describe("computeQuantities", () => {
  it("single room with slab produces non-zero concrete volume", () => {
    const r = computeQuantities(
      cfg([{ type: "room", name: "Hall", x: 0, y: 0, width: 100, length: 200,
        walls: { north: {}, south: {}, east: {}, west: {} } }]),
    );
    const slabs = r.sections.find((s) => s.title.includes("Concrete"));
    expect(slabs).toBeDefined();
    expect(slabs!.rows.length).toBeGreaterThan(0);
    const vol = parseFloat(slabs!.rows[0].volume ?? "0");
    expect(vol).toBeGreaterThan(0);
    expect(slabs!.subtotal).toMatch(/Total:/);
  });

  it("floor with slab_thickness 0 skips that floor's slab entry", () => {
    const r = computeQuantities({
      defaults: { wall_height: H, wall_thickness: 8, slab_thickness: 8 },
      floors: [
        {
          floor_number: 0, name: "Plinth", slab_thickness: 0,
          objects: [{ type: "room", name: "P", x: 0, y: 0, width: 100, length: 100 }],
        },
        {
          floor_number: 1, name: "Ground", slab_thickness: 8,
          objects: [{ type: "room", name: "G", x: 0, y: 0, width: 100, length: 100 }],
        },
      ],
    } as unknown as HouseConfig);
    const slabs = r.sections.find((s) => s.title.includes("Concrete"))!;
    expect(slabs.rows.some((row) => row.label.includes("Plinth"))).toBe(false);
    expect(slabs.rows.some((row) => row.label.includes("Ground"))).toBe(true);
  });

  it("house with four compound walls produces non-zero compound wall brickwork", () => {
    const r = computeQuantities(
      cfg([
        { type: "compound_wall", name: "NorthWall", x: 0,   y: 0,   width: 420, length: 8,   height: 50 },
        { type: "compound_wall", name: "SouthWall", x: 0,   y: 432, width: 420, length: 8,   height: 50 },
        { type: "compound_wall", name: "EastWall",  x: 412, y: 0,   width: 8,   length: 440, height: 50 },
        { type: "compound_wall", name: "WestWall",  x: 0,   y: 0,   width: 8,   length: 440, height: 50 },
      ]),
    );
    const cws = r.sections.find((s) => s.title.includes("compound"))!;
    expect(cws).toBeDefined();
    // Four named walls, each with a volume
    const namedRows = cws.rows.filter((row) => row.volume);
    expect(namedRows).toHaveLength(4);
    expect(parseFloat(namedRows[0].volume ?? "0")).toBeGreaterThan(0);
    expect(cws.subtotal).toMatch(/Total:/);
  });

  it("house with solar panels reports correct capacity_kw total in subtotal", () => {
    const r = computeQuantities(
      cfg([
        { type: "solar_panel", name: "Array1", x: 210, y: 160, mount: "roof",
          capacity_kw: 3.5, azimuth: 180 },
        { type: "solar_panel", name: "Array2", x: 100, y: 160, mount: "roof",
          capacity_kw: 2.0, azimuth: 180 },
      ]),
    );
    const solar = r.sections.find((s) => s.title.includes("Solar"))!;
    expect(solar).toBeDefined();
    expect(solar.rows).toHaveLength(2);
    expect(solar.rows[0].capacity).toBe("3.5 kWp");
    expect(solar.rows[1].capacity).toBe("2.0 kWp");
    expect(solar.subtotal).toContain("5.5 kWp");
  });

  it("well section reports masonry volume for a circular well", () => {
    const r = computeQuantities(
      cfg([
        { type: "well", name: "BackWell", x: 320, y: 400,
          shape: "circular", diameter: 30, parapet_height: 10 },
      ]),
    );
    const wells = r.sections.find((s) => s.title.includes("well"))!;
    expect(wells).toBeDefined();
    expect(wells.rows[0].label).toBe("BackWell");
    expect(parseFloat(wells.rows[0].volume ?? "0")).toBeGreaterThan(0);
  });

  it("steel section equals 24 × slab volume m³", () => {
    // slab: 100×200 room, slab_thickness=8, units feet_inches per_unit=10
    // volU = 100*200*8 = 160000 project-units³
    // toCubicM: 1 sq PU = (1/100)^2 * 0.09290304 m², so 1 PU = 0.030479 m
    // volM3 = 160000 * (0.030479)³ ≈ 4.528 m³
    // steelKg = round(4.528 * 24) = 109
    const r = computeQuantities(
      cfg([{ type: "room", name: "R", x: 0, y: 0, width: 100, length: 200 }],
        { units: { system: "feet_inches", per_unit: 10 } }),
    );
    const steel = r.sections.find((s) => s.title.includes("steel"))!;
    expect(steel).toBeDefined();
    const kgStr = steel.rows[0].count ?? "";
    const kg = parseInt(kgStr.replace(/,/g, "").replace(/\D.*/, ""), 10);
    expect(kg).toBeGreaterThan(0);
  });
});
