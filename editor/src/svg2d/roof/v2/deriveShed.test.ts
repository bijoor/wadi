import { describe, expect, it } from "vitest";
import { deriveShedRoof, shedSlopeFootprint } from "./deriveShed";
import type { RoofConfig } from "./model";

// Base config: segment along X, W→E, high side = left (=south in
// Inkscape frame where +Y = down = south). One segment, single-story.
const baseCfg = (overrides: Partial<RoofConfig> = {}): RoofConfig => ({
  type: "roof",
  roof_type: "shed",
  segments: [
    {
      id: "s0",
      start: [0, 50],
      end: [200, 50],
      width: 100,
      shed_high_side: "left",
    },
  ],
  slope: { by: "height", ridge_h: 20 },
  min_overhang: 15,
  ...overrides,
});

describe("deriveShedRoof", () => {
  it("empty segments → empty spec", () => {
    const spec = deriveShedRoof(
      { type: "roof", roof_type: "shed", segments: [] },
      { wallTopZ: 100 },
    );
    expect(spec.planes.length).toBe(0);
    expect(spec.members.length).toBe(0);
  });

  it("throws when called with wrong roof_type", () => {
    const cfg: RoofConfig = { type: "roof", roof_type: "flat", segments: [] };
    expect(() => deriveShedRoof(cfg, { wallTopZ: 100 })).toThrow(
      /expected roof_type/,
    );
  });

  it("throws when slope missing", () => {
    const cfg = baseCfg({ slope: undefined });
    expect(() => deriveShedRoof(cfg, { wallTopZ: 100 })).toThrow(/slope spec required/);
  });

  it("throws when min_overhang <= 0", () => {
    expect(() =>
      deriveShedRoof(baseCfg({ min_overhang: 0 }), { wallTopZ: 100 }),
    ).toThrow(/min_overhang/);
  });

  it("one segment → 1 slope + 1 ridge + 3 gable_walls (2 raking ends + 1 high infill)", () => {
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "slope").length).toBe(1);
    const gws = spec.planes.filter((p) => p.role === "gable_wall");
    // 2 raking triangles (start/end) + 1 high-eave rectangular infill.
    expect(gws.length).toBe(3);
    expect(gws.filter((p) => p.vertices.length === 3).length).toBe(2);
    expect(gws.filter((p) => p.id.endsWith(".high")).length).toBe(1);
    expect(spec.members.filter((m) => m.role === "ridge").length).toBe(1);
  });

  it("slope footprint spans overhang past segment rectangle on all 4 sides", () => {
    // Segment: (0,50) → (200,50), width 100 → segment rect x∈[0,200], y∈[0,100].
    // overhang 15 → slope rect x∈[-15,215], y∈[-15,115].
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100 });
    const fp = shedSlopeFootprint(spec)!;
    expect(fp.x_min).toBeCloseTo(-15, 6);
    expect(fp.x_max).toBeCloseTo(215, 6);
    expect(fp.y_min).toBeCloseTo(-15, 6);
    expect(fp.y_max).toBeCloseTo(115, 6);
  });

  it("high edge Z = wall_top + rise + eaveDrop; low = wall_top - eaveDrop", () => {
    // rise=20, run=width=100, overhang=15 → eaveDrop = 15·20/100 = 3.
    // wall_top=100 → low_z = 97, high_z = 100+20+3 = 123.
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100 });
    const fp = shedSlopeFootprint(spec)!;
    expect(fp.low_z).toBeCloseTo(97, 6);
    expect(fp.high_z).toBeCloseTo(123, 6);
  });

  it("min_pitch_deg produces same rise as rise=run·tan(angle)", () => {
    // 30° pitch, run=100 → rise = 100·tan30 ≈ 57.735.
    const cfg = baseCfg({ slope: { by: "angle", angle_deg: 30 } });
    const spec = deriveShedRoof(cfg, { wallTopZ: 100 });
    const fp = shedSlopeFootprint(spec)!;
    const expectedRise = 100 * Math.tan(Math.PI / 6);
    const expectedEaveDrop = (15 * expectedRise) / 100;
    expect(fp.high_z).toBeCloseTo(100 + expectedRise + expectedEaveDrop, 6);
    expect(fp.low_z).toBeCloseTo(100 - expectedEaveDrop, 6);
  });

  it("shed_high_side=right mirrors the slope Z placement", () => {
    // Same segment, but high on the -Y (north) side. Slope footprint
    // still spans the same XY bounds; Z values are unchanged (rise +
    // eaveDrop depend only on width + rise + overhang).
    const cfg = baseCfg({
      segments: [
        {
          id: "s0",
          start: [0, 50],
          end: [200, 50],
          width: 100,
          shed_high_side: "right",
        },
      ],
    });
    const spec = deriveShedRoof(cfg, { wallTopZ: 100 });
    const fp = shedSlopeFootprint(spec)!;
    expect(fp.low_z).toBeCloseTo(97, 6);
    expect(fp.high_z).toBeCloseTo(123, 6);
    // High-Z vertices should now be on the -Y side.
    const slope = spec.planes.find((p) => p.role === "slope")!;
    const highY = slope.vertices.filter((v) => v[2] > 100).map((v) => v[1]);
    for (const y of highY) expect(y).toBeLessThan(50);
  });

  it("ridge member matches high-edge extent", () => {
    // For a W→E shed with high on left (+Y), the ridge sits at the
    // extended high edge — y = 50 + w/2 + overhang = 115, x spans
    // [-15, 215] after along-extension by overhang.
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100 });
    const ridge = spec.members.find((m) => m.role === "ridge")!;
    expect(ridge.start[0]).toBeCloseTo(-15, 6);
    expect(ridge.end[0]).toBeCloseTo(215, 6);
    expect(ridge.start[1]).toBeCloseTo(115, 6);
    expect(ridge.end[1]).toBeCloseTo(115, 6);
    expect(ridge.start[2]).toBeCloseTo(123, 6);
  });

  it("raking gable_wall at open endpoints has correct 3 vertices", () => {
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100 });
    // Only the two RAKING end walls are triangles; the high-eave infill
    // (`.high`) is a rectangle — exclude it.
    const walls = spec.planes.filter(
      (p) => p.role === "gable_wall" && !p.id.endsWith(".high"),
    );
    expect(walls.length).toBe(2);
    for (const w of walls) {
      expect(w.vertices.length).toBe(3);
      // Two vertices at wall_top_z (100), one at wall_top + rise (120).
      const zs = w.vertices.map((v) => v[2]).sort((a, b) => a - b);
      expect(zs[0]).toBeCloseTo(100, 6);
      expect(zs[1]).toBeCloseTo(100, 6);
      expect(zs[2]).toBeCloseTo(120, 6);
    }
  });

  it("high-eave infill is a rectangle from wall_top to wall_top+rise", () => {
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100 });
    const high = spec.planes.find(
      (p) => p.role === "gable_wall" && p.id.endsWith(".high"),
    )!;
    expect(high.vertices.length).toBe(4);
    const zs = high.vertices.map((v) => v[2]).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(100, 6); // base at wall_top
    expect(zs[3]).toBeCloseTo(120, 6); // top at wall_top + rise
  });

  it("high-eave infill is inset by wall thickness at each raking (leaf) end", () => {
    // seg x∈[0,200], high side +Y. Both ends leaf → both raking walls own
    // their corner columns, so the high wall spans x∈[8,192], not [0,200].
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100, wallThickness: 8 });
    const high = spec.planes.find(
      (p) => p.role === "gable_wall" && p.id.endsWith(".high"),
    )!;
    const xs = high.vertices.map((v) => v[0]);
    expect(Math.min(...xs)).toBeCloseTo(8, 6);
    expect(Math.max(...xs)).toBeCloseTo(192, 6);
  });

  it("joint endpoint (not leaf) does not emit a raking gable_wall", () => {
    // Two segments sharing an endpoint at (200, 50). Only 2 leaves →
    // 2 raking walls (not 4), plus 1 high infill per segment.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "shed",
      segments: [
        { id: "a", start: [0, 50], end: [200, 50], width: 100, shed_high_side: "left" },
        { id: "b", start: [200, 50], end: [400, 50], width: 100, shed_high_side: "left" },
      ],
      slope: { by: "height", ridge_h: 20 },
      min_overhang: 15,
    };
    const spec = deriveShedRoof(cfg, { wallTopZ: 100 });
    const gws = spec.planes.filter((p) => p.role === "gable_wall");
    // 2 raking (leaf ends only) + 2 high infills (one per segment).
    expect(gws.filter((p) => !p.id.endsWith(".high")).length).toBe(2);
    expect(gws.filter((p) => p.id.endsWith(".high")).length).toBe(2);
    expect(spec.planes.filter((p) => p.role === "slope").length).toBe(2);
  });

  it("ring beam: raking-end members dropped; high eave rides wall_top+rise", () => {
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100 });
    const rings = spec.members.filter((m) => m.role === "ring_beam");
    // Both raking-end cross members suppressed → only the 2 side eaves.
    expect(rings.length).toBe(2);
    const zs = rings.map((m) => m.start[2]).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(100, 6); // low eave at wall_top
    expect(zs[1]).toBeCloseTo(120, 6); // high eave raised to wall_top + rise
  });

  it("multi-segment L-shape shed: 3 ring beams per segment (6 total)", () => {
    // Each segment has ONE leaf end (its raking cross member dropped) and
    // one joint end (kept) → 3 members each.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "shed",
      segments: [
        { id: "a", start: [0, 50], end: [200, 50], width: 100, shed_high_side: "left" },
        { id: "b", start: [200, 50], end: [200, 250], width: 100, shed_high_side: "left" },
      ],
      slope: { by: "height", ridge_h: 20 },
      min_overhang: 15,
    };
    const spec = deriveShedRoof(cfg, { wallTopZ: 100 });
    expect(spec.members.filter((m) => m.role === "ring_beam").length).toBe(6);
  });
});

describe("deriveShedRoof — gable walls (thickness + gable band)", () => {
  it("all gable walls (2 raking + 1 high) carry wall thickness; override wins", () => {
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100, wallThickness: 8 });
    const gws = spec.planes.filter((p) => p.role === "gable_wall");
    expect(gws.length).toBe(3);
    expect(gws.every((p) => p.thickness === 8)).toBe(true);
    // Every gable wall carries an inward extrusion vector.
    expect(gws.every((p) => Array.isArray(p.inward) && p.inward.length === 3)).toBe(true);

    const over = deriveShedRoof(baseCfg({ gable_wall_thickness: 12 }), {
      wallTopZ: 100,
      wallThickness: 8,
    });
    expect(over.planes.filter((p) => p.role === "gable_wall").every((p) => p.thickness === 12)).toBe(
      true,
    );
  });

  it("each open leaf end emits 1 gable_band member along its rake", () => {
    const spec = deriveShedRoof(baseCfg(), { wallTopZ: 100, wallThickness: 8 });
    // baseCfg has 2 leaf endpoints → 1 band each.
    const bands = spec.members.filter((m) => m.role === "gable_band");
    expect(bands.length).toBe(2);
    // rake runs low@wallTop (z=100) → high@wallTop+rise (z=120).
    for (const b of bands) {
      const zs = [b.start[2], b.end[2]].sort((a, c) => a - c);
      expect(zs[0]).toBeCloseTo(100);
      expect(zs[1]).toBeCloseTo(120);
    }
  });
});
