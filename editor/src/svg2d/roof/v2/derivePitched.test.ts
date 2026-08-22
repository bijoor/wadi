import { describe, expect, it } from "vitest";
import {
  derivePitchedRoof,
  pitchedRidge,
  pitchedSlopeFootprint,
} from "./derivePitched";
import type { RoofConfig } from "./model";

// Y-axis segment: N→S, cx=150, y∈[0,500], width=300. Modelled after
// the classical "27 × 45 ft" Konkan-house roof rectangle.
const yAxisCfg = (overrides: Partial<RoofConfig> = {}): RoofConfig => ({
  type: "roof",
  roof_type: "pitched",
  segments: [
    { id: "s0", start: [150, 0], end: [150, 500], width: 300 },
  ],
  slope: { by: "height", ridge_h: 50 },
  min_overhang: 25,
  default_endpoint: "closed",
  ...overrides,
});

// X-axis segment: W→E, cy=100, x∈[0,600], width=200.
const xAxisCfg = (overrides: Partial<RoofConfig> = {}): RoofConfig => ({
  type: "roof",
  roof_type: "pitched",
  segments: [
    { id: "s0", start: [0, 100], end: [600, 100], width: 200 },
  ],
  slope: { by: "height", ridge_h: 50 },
  min_overhang: 25,
  default_endpoint: "closed",
  ...overrides,
});

describe("derivePitchedRoof — ridge vent extension cover", () => {
  it("a closed endpoint with hip_ridge_extension gets shell cover planes", () => {
    const cfg = yAxisCfg({
      segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300,
        hip_ridge_extension_start: 40, hip_ridge_extension_end: 40 }],
    });
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const covers = spec.planes.filter((p) => p.id.includes("vent_cover"));
    // 2 ends × 2 sides = 4 triangular cover faces (role hip_face → shelled).
    expect(covers.length).toBe(4);
    expect(covers.every((p) => p.role === "hip_face" && p.vertices.length === 3)).toBe(true);
    // one apex + one ridge tip (both at ridge height) per cover
    const struts = spec.members.filter((m) => m.role === "vent_strut");
    expect(struts.length).toBe(4);
  });

  it("no extension → no vent cover planes", () => {
    const spec = derivePitchedRoof(yAxisCfg(), { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.id.includes("vent_cover")).length).toBe(0);
  });
});

describe("derivePitchedRoof — basic", () => {
  it("empty segments → empty spec", () => {
    const spec = derivePitchedRoof(
      { type: "roof", roof_type: "pitched", segments: [] },
      { wallTopZ: 100 },
    );
    expect(spec.planes.length).toBe(0);
    expect(spec.members.length).toBe(0);
  });

  it("throws when called with wrong roof_type", () => {
    expect(() =>
      derivePitchedRoof(
        { type: "roof", roof_type: "flat", segments: [] },
        { wallTopZ: 100 },
      ),
    ).toThrow(/expected roof_type/);
  });

  it("throws when slope missing", () => {
    expect(() =>
      derivePitchedRoof(yAxisCfg({ slope: undefined }), { wallTopZ: 100 }),
    ).toThrow(/slope spec required/);
  });

  it("throws when min_overhang <= 0", () => {
    expect(() =>
      derivePitchedRoof(yAxisCfg({ min_overhang: 0 }), { wallTopZ: 100 }),
    ).toThrow(/min_overhang/);
  });
});

describe("derivePitchedRoof — pure gable (all open)", () => {
  it("emits 2 slopes + 2 gable_walls + 0 hip members", () => {
    const cfg = yAxisCfg({ default_endpoint: "open" });
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "slope").length).toBe(2);
    expect(spec.planes.filter((p) => p.role === "gable_wall").length).toBe(2);
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(0);
    expect(spec.members.filter((m) => m.role === "hip").length).toBe(0);
    expect(spec.members.filter((m) => m.role === "ridge").length).toBe(1);
  });

  it("open ends default to gable_overhang = min_overhang (eave extends past wall)", () => {
    // Segment (150, 0) → (150, 500), min_overhang 25. With no
    // explicit gable_overhang, open ends should extend by 25.
    const cfg = yAxisCfg({ default_endpoint: "open" });
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    // Ridge extends 25u past each end.
    expect(ridge.start[1]).toBeCloseTo(-25, 6);
    expect(ridge.end[1]).toBeCloseTo(525, 6);
    // Slope footprint Y extents also reach past the wall by 25u.
    const fp = pitchedSlopeFootprint(spec)!;
    expect(fp.y_min).toBeCloseTo(-25, 6);
    expect(fp.y_max).toBeCloseTo(525, 6);
  });

  it("explicit gable_overhang = 0 disables the overhang", () => {
    const cfg = yAxisCfg({ default_endpoint: "open" });
    cfg.segments[0].gable_overhang_start = 0;
    cfg.segments[0].gable_overhang_end = 0;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    expect(ridge.start[1]).toBeCloseTo(0, 6);
    expect(ridge.end[1]).toBeCloseTo(500, 6);
  });

  it("ridge runs the full segment length + gable_overhang past each end", () => {
    // cfg has segments[0].gable_overhang_{start,end} = 10 → ridge extends 10 past.
    const cfg = yAxisCfg({ default_endpoint: "open" });
    cfg.segments[0].gable_overhang_start = 10;
    cfg.segments[0].gable_overhang_end = 10;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    expect(ridge.start[1]).toBeCloseTo(-10, 6);   // y = 0 - 10
    expect(ridge.end[1]).toBeCloseTo(510, 6);     // y = 500 + 10
    expect(ridge.start[0]).toBeCloseTo(150, 6);   // cx
    expect(ridge.end[0]).toBeCloseTo(150, 6);
    expect(ridge.start[2]).toBeCloseTo(150, 6);   // wallTop + ridge_h = 100+50
  });

  it("eave drop = min_overhang · ridge_h / (width/2) for pure gable", () => {
    // width/2 = 150, min_overhang = 25, ridge_h = 50 →
    // eaveDrop = 25·50/150 ≈ 8.333. eaveZ = 100 - 8.333 = 91.666.
    const cfg = yAxisCfg({ default_endpoint: "open" });
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const fp = pitchedSlopeFootprint(spec)!;
    expect(fp.eave_z).toBeCloseTo(100 - (25 * 50) / 150, 6);
    expect(fp.ridge_z).toBeCloseTo(150, 6);
  });
});

describe("derivePitchedRoof — ridge vent extension", () => {
  it("hip_ridge_extension_start/end extends the RIDGE MEMBER past the hip apex", () => {
    const cfg = yAxisCfg();
    // Default hip: setback 150 → ridge y ∈ [150, 350]. Add 50u
    // extension at both ends → ridge should span [100, 400].
    cfg.segments[0].hip_ridge_extension_start = 50;
    cfg.segments[0].hip_ridge_extension_end = 50;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    expect(ridge.start[1]).toBeCloseTo(100, 6);
    expect(ridge.end[1]).toBeCloseTo(400, 6);
  });

  it("hip diagonals still meet at the true apex (not the extended ridge)", () => {
    const cfg = yAxisCfg();
    cfg.segments[0].hip_ridge_extension_start = 50;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const hipDiag = spec.members.find((m) => m.id === "s0.hip.start.left")!;
    // Apex of the north hip is at (cx, seg.start.y + hipSetback, ridgeZ)
    // = (150, 150, 150) — NOT (150, 100, 150).
    const apexEnd = hipDiag.start[2] > hipDiag.end[2] ? hipDiag.start : hipDiag.end;
    expect(apexEnd[1]).toBeCloseTo(150, 6);
  });

  it("no extension by default (hip roof behaves as before)", () => {
    const cfg = yAxisCfg();
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    expect(ridge.start[1]).toBeCloseTo(150, 6);
    expect(ridge.end[1]).toBeCloseTo(350, 6);
  });

  it("open (gable) endpoint ignores the extension (only applies to closed)", () => {
    const cfg = yAxisCfg({ default_endpoint: "open" });
    cfg.segments[0].hip_ridge_extension_start = 999;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    // Open end: ridge extends by gable_overhang (default = min_overhang = 25),
    // NOT by 999. So ridge start = 0 - 25 = -25.
    expect(ridge.start[1]).toBeCloseTo(-25, 6);
  });

  it("emits 2 vent struts per closed endpoint with extension > 0", () => {
    const cfg = yAxisCfg();
    cfg.segments[0].hip_ridge_extension_start = 50;
    cfg.segments[0].hip_ridge_extension_end = 30;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const struts = spec.members.filter((m) => m.role === "vent_strut");
    expect(struts.length).toBe(4);   // 2 per end × 2 ends
  });

  it("vent struts start at the ridge tip and end on the hip diagonals", () => {
    const cfg = yAxisCfg();
    cfg.segments[0].hip_ridge_extension_start = 50;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const struts = spec.members.filter(
      (m) => m.role === "vent_strut" && m.id.includes(".start."),
    );
    expect(struts.length).toBe(2);
    // Both start at the ridge tip (which is at y = 100 = seg.start.y +
    // hip_setback − extension = 0 + 150 − 50).
    for (const s of struts) {
      expect(s.start[1]).toBeCloseTo(100, 6);
      expect(s.start[2]).toBeCloseTo(150, 6);   // ridge Z
      // Ends are on the hip diagonals — Z lower than ridge Z.
      expect(s.end[2]).toBeLessThan(150);
    }
  });

  it("no vent struts when extension is 0 (default)", () => {
    const spec = derivePitchedRoof(yAxisCfg(), { wallTopZ: 100 });
    const struts = spec.members.filter((m) => m.role === "vent_strut");
    expect(struts.length).toBe(0);
  });
});

describe("derivePitchedRoof — pure hip (all closed)", () => {
  // Use hip_setback = width/2 (150) which is the default → equal-pitch pyramid.
  it("emits 2 slopes + 2 hip_faces + 4 hip members", () => {
    const spec = derivePitchedRoof(yAxisCfg(), { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "slope").length).toBe(2);
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(2);
    expect(spec.planes.filter((p) => p.role === "gable_wall").length).toBe(0);
    expect(spec.members.filter((m) => m.role === "hip").length).toBe(4);
  });

  it("ridge is trimmed inward by hip_setback at each end", () => {
    const cfg = yAxisCfg();
    // Override setback to 75 (less than default 150) → steeper hips.
    cfg.segments[0].hip_setback_start = 75;
    cfg.segments[0].hip_setback_end = 75;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    expect(ridge.start[1]).toBeCloseTo(75, 6);    // y = 0 + 75
    expect(ridge.end[1]).toBeCloseTo(425, 6);     // y = 500 - 75
  });

  it("eave drop uses dCrit = min(width/2, hip_setback_start, hip_setback_end)", () => {
    const cfg = yAxisCfg();
    cfg.segments[0].hip_setback_start = 75;   // smaller than width/2 = 150
    cfg.segments[0].hip_setback_end = 100;
    // dCrit = 75. eaveDrop = 25·50/75 ≈ 16.667.
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const fp = pitchedSlopeFootprint(spec)!;
    expect(fp.eave_z).toBeCloseTo(100 - (25 * 50) / 75, 6);
  });
});

describe("derivePitchedRoof — dutch gable (mixed)", () => {
  it("open start + closed end → 1 gable_wall + 1 hip_face + 2 hip members", () => {
    const cfg = yAxisCfg({ default_endpoint: undefined });
    cfg.segments[0].start_endpoint = "open";
    cfg.segments[0].end_endpoint = "closed";
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.planes.filter((p) => p.role === "gable_wall").length).toBe(1);
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(1);
    expect(spec.members.filter((m) => m.role === "hip").length).toBe(2);
  });

  it("ridge start extends past segment; ridge end trimmed inward", () => {
    const cfg = yAxisCfg({ default_endpoint: undefined });
    cfg.segments[0].start_endpoint = "open";
    cfg.segments[0].end_endpoint = "closed";
    cfg.segments[0].gable_overhang_start = 5;
    cfg.segments[0].hip_setback_end = 100;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    expect(ridge.start[1]).toBeCloseTo(-5, 6);    // open + gable overhang
    expect(ridge.end[1]).toBeCloseTo(400, 6);     // closed, trimmed inward
  });
});

describe("derivePitchedRoof — x-axis ridge", () => {
  it("x-axis hip: same footprint math as y-axis, rotated 90°", () => {
    // xAxisCfg has segment along X, width=200 → cross half = 100.
    // For pure hip (default): dCrit = min(100, 100, 100) = 100.
    // eaveDrop = 25·50/100 = 12.5. eaveZ = 100 - 12.5 = 87.5.
    // Overhangs symmetric: 25 all around.
    const spec = derivePitchedRoof(xAxisCfg(), { wallTopZ: 100 });
    const fp = pitchedSlopeFootprint(spec)!;
    // Segment at cy=100, x∈[0,600]. Rectangle: y∈[0,200], x∈[0,600].
    // With hip_setback = 100 default = crossHalf, oStart = oEnd = 25 = oCross.
    // Slope + hip_face together span x∈[-25, 625], y∈[-25, 225].
    expect(fp.x_min).toBeCloseTo(-25, 6);
    expect(fp.x_max).toBeCloseTo(625, 6);
    expect(fp.y_min).toBeCloseTo(-25, 6);
    expect(fp.y_max).toBeCloseTo(225, 6);
    expect(fp.eave_z).toBeCloseTo(87.5, 6);
    expect(fp.ridge_z).toBeCloseTo(150, 6);
  });

  it("x-axis gable: ridge runs along X, extends by gable overhang", () => {
    const cfg = xAxisCfg({ default_endpoint: "open" });
    cfg.segments[0].gable_overhang_start = 15;
    cfg.segments[0].gable_overhang_end = 15;
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const ridge = pitchedRidge(spec)!;
    expect(ridge.start[0]).toBeCloseTo(-15, 6);
    expect(ridge.end[0]).toBeCloseTo(615, 6);
    expect(ridge.start[1]).toBeCloseTo(100, 6);   // cy
    expect(ridge.end[1]).toBeCloseTo(100, 6);
  });
});

describe("derivePitchedRoof — trusses", () => {
  it("emits one truss triangle per position", () => {
    const cfg = yAxisCfg();
    cfg.trusses = [
      { segment_id: "s0", type: "fink", positions_along: [100, 250, 400] },
    ];
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    expect(spec.trusses.length).toBe(3);
    for (const t of spec.trusses) {
      expect(t.apex[2]).toBeCloseTo(150, 6);         // ridge Z
      expect(t.bottom_left[2]).toBeCloseTo(100, 6);  // wall top Z
      expect(t.bottom_right[2]).toBeCloseTo(100, 6);
    }
    // Apexes on ridge line at Y = 100, 250, 400, X = 150 (cx).
    expect(spec.trusses[0].apex[1]).toBeCloseTo(100, 6);
    expect(spec.trusses[1].apex[1]).toBeCloseTo(250, 6);
    expect(spec.trusses[2].apex[1]).toBeCloseTo(400, 6);
  });

  it("no truss entry → 0 truss triangles", () => {
    const spec = derivePitchedRoof(yAxisCfg(), { wallTopZ: 100 });
    expect(spec.trusses.length).toBe(0);
  });
});

describe("derivePitchedRoof — angle-based slope", () => {
  it("min_pitch_deg produces rise = (width/2) · tan(angle)", () => {
    const cfg = yAxisCfg({ slope: { by: "angle", angle_deg: 30 } });
    // rise = 150 · tan30 ≈ 86.6
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    const expectedRise = 150 * Math.tan(Math.PI / 6);
    expect(pitchedRidge(spec)!.start[2]).toBeCloseTo(100 + expectedRise, 6);
  });
});

describe("derivePitchedRoof — joint endpoints", () => {
  it("shared endpoint gets treated as closed regardless of style config", () => {
    // Two collinear segments sharing an endpoint. Even if user asks
    // for open, joint endpoints must NOT emit gable_wall / hip_face.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [
        { id: "a", start: [150, 0], end: [150, 250], width: 300, end_endpoint: "open" },
        { id: "b", start: [150, 250], end: [150, 500], width: 300, start_endpoint: "open" },
      ],
      slope: { by: "height", ridge_h: 50 },
      min_overhang: 25,
      default_endpoint: "closed",
    };
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100 });
    // Joint endpoint at (150, 250) is shared: 0 endcaps emitted for it.
    // Each segment has 1 leaf endpoint (closed by default) → 2 hip_faces
    // total across both segments.
    expect(spec.planes.filter((p) => p.role === "hip_face").length).toBe(2);
    expect(spec.planes.filter((p) => p.role === "gable_wall").length).toBe(0);
  });
});

describe("derivePitchedRoof — gable walls (thickness + gable band)", () => {
  it("open ends carry the wall thickness on their gable_wall planes", () => {
    const cfg = yAxisCfg({ default_endpoint: "open" });
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100, wallThickness: 8 });
    const gws = spec.planes.filter((p) => p.role === "gable_wall");
    expect(gws.length).toBe(2);
    expect(gws.every((p) => p.thickness === 8)).toBe(true);
  });

  it("roof-level gable_wall_thickness overrides the house wall thickness", () => {
    const cfg = yAxisCfg({ default_endpoint: "open", gable_wall_thickness: 12 });
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100, wallThickness: 8 });
    const gws = spec.planes.filter((p) => p.role === "gable_wall");
    expect(gws.every((p) => p.thickness === 12)).toBe(true);
  });

  it("each open end emits 2 gable_band members (rake edges); closed ends emit none", () => {
    const open = derivePitchedRoof(yAxisCfg({ default_endpoint: "open" }), {
      wallTopZ: 100,
      wallThickness: 8,
    });
    expect(open.members.filter((m) => m.role === "gable_band").length).toBe(4);

    const closed = derivePitchedRoof(yAxisCfg({ default_endpoint: "closed" }), {
      wallTopZ: 100,
      wallThickness: 8,
    });
    expect(closed.members.filter((m) => m.role === "gable_band").length).toBe(0);
  });

  it("open ends carry an inward extrusion vector; the flat end ring member is dropped", () => {
    const open = derivePitchedRoof(yAxisCfg({ default_endpoint: "open" }), {
      wallTopZ: 100,
      wallThickness: 8,
    });
    const gws = open.planes.filter((p) => p.role === "gable_wall");
    expect(gws.every((p) => Array.isArray(p.inward) && p.inward.length === 3)).toBe(true);
    // Open ends: the two END cross ring members (.back/.front) are gone;
    // only the two side eaves (.left/.right) remain.
    const rings = open.members.filter((m) => m.role === "ring_beam");
    expect(rings.length).toBe(2);
    expect(rings.some((m) => m.id.endsWith(".back") || m.id.endsWith(".front"))).toBe(false);

    // Closed (hip) ends keep all 4 ring members (the hip sits on them).
    const closed = derivePitchedRoof(yAxisCfg({ default_endpoint: "closed" }), {
      wallTopZ: 100,
      wallThickness: 8,
    });
    expect(closed.members.filter((m) => m.role === "ring_beam").length).toBe(4);
  });

  it("gable band runs from wall top up to the ridge apex", () => {
    const cfg = yAxisCfg({ default_endpoint: "open" }); // ridge_h = 50
    const spec = derivePitchedRoof(cfg, { wallTopZ: 100, wallThickness: 8 });
    const bands = spec.members.filter((m) => m.role === "gable_band");
    for (const b of bands) {
      // one endpoint at wall top (z=100), one at ridge (z=150).
      const zs = [b.start[2], b.end[2]].sort((a, c) => a - c);
      expect(zs[0]).toBeCloseTo(100);
      expect(zs[1]).toBeCloseTo(150);
    }
  });
});

describe("derivePitchedRoof — per-eave overhang (left/right) + unified end keywords", () => {
  it("extends one eave independently (left/west), dropping its edge along the same pitch", () => {
    // yAxisCfg: N→S segment cx=150 width 300 → left eave = west (x<150).
    // ridge_h 50, min_overhang 25, dCrit=150 (open gable). overhang_left 60.
    const cfg = yAxisCfg({
      default_endpoint: "open",
      segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300, overhang_left: 60 }],
    });
    const fp = pitchedSlopeFootprint(derivePitchedRoof(cfg, { wallTopZ: 100 }))!;
    expect(fp.x_min).toBeCloseTo(-60);   // west eave: 150 - (150 + 60)
    expect(fp.x_max).toBeCloseTo(325);   // east eave default 25: 150 + (150 + 25)
    expect(fp.eave_z).toBeCloseTo(80);   // west eave dropped 60·50/150 = 20 below wallTop 100
  });

  it("omitting per-eave == the uniform min_overhang (existing roofs unchanged)", () => {
    const a = pitchedSlopeFootprint(derivePitchedRoof(yAxisCfg({ default_endpoint: "open" }), { wallTopZ: 100 }))!;
    const b = pitchedSlopeFootprint(derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open", segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300, overhang_left: 25, overhang_right: 25 }] }),
      { wallTopZ: 100 })!)!;
    expect(b).toEqual(a);
  });

  it("overhang_end aliases gable_overhang_end on an open (gable) end", () => {
    const viaAlias = pitchedRidge(derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open", segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300, overhang_end: 70 }] }),
      { wallTopZ: 100 }))!;
    const viaGable = pitchedRidge(derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open", segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300, gable_overhang_end: 70 }] }),
      { wallTopZ: 100 }))!;
    expect(viaAlias.end[1]).toBeCloseTo(viaGable.end[1]);
    expect(viaAlias.end[1]).toBeCloseTo(570); // 500 + 70
  });
});

describe("derivePitchedRoof — asymmetric per-side slopes (saltbox gable)", () => {
  // yAxis segment runs +Y; its LEFT normal points −X (west), so slope_left is the
  // WEST slope (eave at x=0), slope_right the EAST slope (eave at x=300).
  it("two angles → an offset ridge, each side taking its own pitch", () => {
    const cfg = yAxisCfg({
      default_endpoint: "open",
      slope: undefined,
      slope_left: { by: "angle", angle_deg: 45 },
      slope_right: { by: "angle", angle_deg: 30 },
      min_overhang: 0.001,
    });
    const ridge = pitchedRidge(derivePitchedRoof(cfg, { wallTopZ: 100 }))!;
    const H = ridge.start[2] - 100;
    expect(H).toBeCloseTo(109.8, 0);
    // Ridge shifts toward the steeper (left/west) eave: from centre x=150 to ~109.8.
    expect(ridge.start[0]).toBeCloseTo(109.8, 0);
    const leftRun = ridge.start[0] - 0;      // ridge → west eave
    const rightRun = 300 - ridge.start[0];   // ridge → east eave
    expect((Math.atan(H / leftRun) * 180) / Math.PI).toBeCloseTo(45, 0);
    expect((Math.atan(H / rightRun) * 180) / Math.PI).toBeCloseTo(30, 0);
    // The truss apex sits over the offset ridge (asymmetric truss).
    const truss = derivePitchedRoof(
      { ...cfg, trusses: [{ segment_id: "s0", positions_along: [250] }] },
      { wallTopZ: 100 },
    ).trusses[0];
    expect(truss.apex[0]).toBeCloseTo(109.8, 0);
    expect(truss.bottom_left[0]).toBeCloseTo(0);   // eaves stay at the walls
    expect(truss.bottom_right[0]).toBeCloseTo(300);
  });

  it("equal left/right angles == the symmetric slope (ridge stays centred)", () => {
    const asym = derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open", slope: undefined,
        slope_left: { by: "angle", angle_deg: 40 }, slope_right: { by: "angle", angle_deg: 40 } }),
      { wallTopZ: 100 },
    );
    const sym = derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open", slope: { by: "angle", angle_deg: 40 } }),
      { wallTopZ: 100 },
    );
    expect(pitchedRidge(asym)!.start[0]).toBeCloseTo(150); // centred
    // Same footprint (the two pitch formulas agree to fp precision).
    const a = pitchedSlopeFootprint(asym)!, s = pitchedSlopeFootprint(sym)!;
    for (const k of Object.keys(s) as (keyof typeof s)[]) expect(a[k]).toBeCloseTo(s[k]);
  });

  it("only ONE side set → ignored, falls back to symmetric slope", () => {
    const oneSide = pitchedSlopeFootprint(derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open", slope_left: { by: "angle", angle_deg: 60 } }),
      { wallTopZ: 100 }))!;
    const plain = pitchedSlopeFootprint(derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open" }), { wallTopZ: 100 }))!;
    expect(oneSide).toEqual(plain);
  });
});

describe("derivePitchedRoof — explicit per-side widths (off-centre ridge)", () => {
  // yAxis segment runs +Y; LEFT normal points −X (west). width_left is the WEST
  // run (to the eave at x=0), width_right the EAST run (to the eave at x=300).
  it("width_left/width_right offset the ridge; eaves stay at the walls; each side takes its own pitch", () => {
    const cfg = yAxisCfg({
      default_endpoint: "open",
      slope: { by: "height", ridge_h: 50 },
      min_overhang: 0.001,
      segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300, width_left: 100, width_right: 200 }],
    });
    const ridge = pitchedRidge(derivePitchedRoof(cfg, { wallTopZ: 100 }))!;
    const H = ridge.start[2] - 100;
    expect(H).toBeCloseTo(50, 5);                 // ridge height from `slope: height`
    expect(ridge.start[0]).toBeCloseTo(100, 5);   // ridge sits width_left from the west eave
    // Eaves stay at the walls; the truss apex sits over the offset ridge.
    const truss = derivePitchedRoof(
      { ...cfg, trusses: [{ segment_id: "s0", positions_along: [250] }] },
      { wallTopZ: 100 },
    ).trusses[0];
    expect(truss.apex[0]).toBeCloseTo(100);
    expect(truss.bottom_left[0]).toBeCloseTo(0);
    expect(truss.bottom_right[0]).toBeCloseTo(300);
    // Each side takes its own pitch (rise 50 over its own run).
    expect((Math.atan(H / 100) * 180) / Math.PI).toBeCloseTo(26.57, 1);
    expect((Math.atan(H / 200) * 180) / Math.PI).toBeCloseTo(14.04, 1);
  });

  it("equal widths (width/2 each) == the plain symmetric `width` (ridge centred)", () => {
    const split = derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open",
        segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300, width_left: 150, width_right: 150 }] }),
      { wallTopZ: 100 });
    const plain = derivePitchedRoof(yAxisCfg({ default_endpoint: "open" }), { wallTopZ: 100 });
    expect(pitchedRidge(split)!.start[0]).toBeCloseTo(150);
    const a = pitchedSlopeFootprint(split)!, s = pitchedSlopeFootprint(plain)!;
    for (const k of Object.keys(s) as (keyof typeof s)[]) expect(a[k]).toBeCloseTo(s[k]);
  });

  it("widths take precedence over slope_left/right (position from widths, not the angles)", () => {
    const ridge = pitchedRidge(derivePitchedRoof(
      yAxisCfg({ default_endpoint: "open",
        slope: { by: "height", ridge_h: 50 },
        slope_left: { by: "angle", angle_deg: 60 }, slope_right: { by: "angle", angle_deg: 20 },
        segments: [{ id: "s0", start: [150, 0], end: [150, 500], width: 300, width_left: 100, width_right: 200 }] }),
      { wallTopZ: 100 }))!;
    expect(ridge.start[0]).toBeCloseTo(100);
  });
});
