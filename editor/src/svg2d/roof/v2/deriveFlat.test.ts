import { describe, expect, it } from "vitest";
import { deriveFlatRoof, flatSlabFootprint } from "./deriveFlat";
import type { RoofConfig } from "./model";

const baseCfg = (): RoofConfig => ({
  type: "roof",
  roof_type: "flat",
  segments: [
    {
      id: "seg0",
      start: [160, 20],           // matches an oldRectRoofToSegments output
      end: [160, 420],            // 400u long, cx=160 → width=300 originally
      width: 300,
    },
  ],
  min_overhang: 5,
  slab_thickness: 6,
  parapet_height: 0,
});

describe("deriveFlatRoof", () => {
  it("empty segments → empty spec", () => {
    const cfg: RoofConfig = { type: "roof", roof_type: "flat", segments: [] };
    const spec = deriveFlatRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes).toEqual([]);
    expect(spec.members).toEqual([]);
    expect(spec.trusses).toEqual([]);
  });

  it("single segment → one flat_slab plane", () => {
    const spec = deriveFlatRoof(baseCfg(), { wallTopZ: 100 });
    const slabs = spec.planes.filter((p) => p.role === "flat_slab");
    expect(slabs.length).toBe(1);
    expect(slabs[0].vertices.length).toBe(4);
  });

  it("throws when called with non-flat cfg", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [0, 0], end: [10, 0], width: 5 }],
    };
    expect(() => deriveFlatRoof(cfg, { wallTopZ: 100 })).toThrow(
      /expected roof_type/,
    );
  });

  it("overhang extends slab past the segment rectangle on all four sides", () => {
    // Segment cx=160, y∈[20, 420], width=300 → rect x∈[10, 310], y∈[20, 420].
    // overhang 5 → slab x∈[5, 315], y∈[15, 425].
    const spec = deriveFlatRoof(baseCfg(), { wallTopZ: 100 });
    const fp = flatSlabFootprint(spec)!;
    expect(fp.x_min).toBeCloseTo(5, 6);
    expect(fp.x_max).toBeCloseTo(315, 6);
    expect(fp.y_min).toBeCloseTo(15, 6);
    expect(fp.y_max).toBeCloseTo(425, 6);
  });

  it("slab Z = wallTopZ (sits at the eave like every other roof; no slab-thickness offset)", () => {
    const spec = deriveFlatRoof(baseCfg(), { wallTopZ: 100 });
    const fp = flatSlabFootprint(spec)!;
    expect(fp.z).toBeCloseTo(100, 6);
  });

  it("parapet_height > 0 emits 4 parapet planes + 4 caps", () => {
    const cfg = baseCfg();
    cfg.parapet_height = 30;
    cfg.parapet_thickness = 8;
    const spec = deriveFlatRoof(cfg, { wallTopZ: 100 });
    const parapets = spec.planes.filter((p) => p.role === "parapet");
    expect(parapets.length).toBe(4);
    const caps = spec.members.filter((m) => m.role === "parapet_cap");
    expect(caps.length).toBe(4);
    // Parapet planes must span [eaveZ, eaveZ + parapet_height] in Z,
    // with eaveZ = wallTopZ (100).
    for (const p of parapets) {
      const zs = p.vertices.map((v) => v[2]);
      expect(Math.min(...zs)).toBeCloseTo(100, 6);
      expect(Math.max(...zs)).toBeCloseTo(130, 6);
    }
  });

  it("parapet_height = 0 emits no parapet planes", () => {
    const spec = deriveFlatRoof(baseCfg(), { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "parapet").length).toBe(0);
    expect(spec.members.length).toBe(0);
  });

  it("respects DeriveFlatOptions fallbacks when config omits values", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "flat",
      segments: [baseCfg().segments[0]],
    };
    const spec = deriveFlatRoof(cfg, {
      wallTopZ: 200,
      defaultOverhang: 10,
      defaultParapetHeight: 0,
    });
    const fp = flatSlabFootprint(spec)!;
    expect(fp.z).toBeCloseTo(200, 6);
    // overhang 10 → x_min = 10-10 = 0
    expect(fp.x_min).toBeCloseTo(0, 6);
  });

  it("diagonal segment produces a rotated rectangle (area = length × (width+2·overhang))", () => {
    // 3-4-5 diagonal from (0,0), width 20, overhang 5.
    // Expected slab area = (5 + 2·5) × (20 + 2·5) = 15 × 30 = 450.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "flat",
      segments: [{ id: "s", start: [0, 0], end: [3, 4], width: 20 }],
      min_overhang: 5,
      slab_thickness: 6,
      parapet_height: 0,
    };
    const spec = deriveFlatRoof(cfg, { wallTopZ: 100 });
    const slab = spec.planes[0];
    const pts = slab.vertices.map((v) => [v[0], v[1]] as [number, number]);
    // Shoelace over 4 CCW points.
    let area2 = 0;
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % 4];
      area2 += x1 * y2 - x2 * y1;
    }
    expect(Math.abs(area2 / 2)).toBeCloseTo(15 * 30, 6);
  });

  it("multi-segment L-shape → one plane per segment (no joint resolution in Phase 1)", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "flat",
      segments: [
        { id: "a", start: [50, 0], end: [50, 100], width: 100 },
        { id: "b", start: [0, 50], end: [100, 50], width: 100 },
      ],
      min_overhang: 0,
      slab_thickness: 6,
      parapet_height: 0,
    };
    const spec = deriveFlatRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "flat_slab").length).toBe(2);
  });
});
