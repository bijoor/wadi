import { describe, expect, it } from "vitest";
import { derivePitchedRoof } from "./derivePitched";
import { deriveShedRoof } from "./deriveShed";
import type { RoofConfig } from "./model";
import {
  jointMembers,
  resolveJoints,
  ridgeZFromConfig,
} from "./resolveJoints";

const commonProps = {
  slope: { by: "height", ridge_h: 50 } as const,
  min_overhang: 25,
};

describe("resolveJoints — L-shape (2 segments, 1 valley)", () => {
  const cfg: RoofConfig = {
    type: "roof",
    roof_type: "pitched",
    segments: [
      { id: "a", start: [150, 0], end: [150, 250], width: 300 },
      { id: "b", start: [150, 250], end: [500, 250], width: 200 },
    ],
    default_endpoint: "closed",
    ...commonProps,
  };
  const wallTopZ = 100;
  const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);

  it("emits 1 valley and 1 outside-hip member per L joint", () => {
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    expect(jointMembers(spec, "valley").length).toBe(1);
    // Outside hip closes the convex corner opposite the valley.
    expect(jointMembers(spec, "hip").length).toBe(1);
  });

  it("valley runs from joint apex to INSIDE-EAVE corner (extended past wall to eave Z)", () => {
    // A's east eave line: x = 150 + halfW + oCross. B's north eave: y = 250 - halfW - oCross.
    // With A width=300, B width=200, min_overhang=25, global dCrit = 100 (min halfW):
    //   oCross_A = 25*150/100 = 37.5 → A east eave at x = 150+150+37.5 = 337.5
    //   oCross_B = 25*100/100 = 25 → B north eave at y = 250-100-25 = 125
    // Intersect: (337.5, 125), Z = eaveZ.
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    const valley = jointMembers(spec, "valley")[0]!;
    expect(valley.start[0]).toBeCloseTo(150, 6);
    expect(valley.start[1]).toBeCloseTo(250, 6);
    expect(valley.start[2]).toBeCloseTo(ridgeZ, 6);
    expect(valley.end[0]).toBeCloseTo(337.5, 3);
    expect(valley.end[1]).toBeCloseTo(125, 3);
    expect(valley.end[2]).toBeLessThan(wallTopZ);   // eave Z < wall top
  });

  it("existing members are preserved (ridges + ring beams still present)", () => {
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const before = spec0.members.length;
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    // Added per L-joint: 1 valley + 1 outside hip = 2.
    expect(spec.members.length).toBe(before + 2);
    expect(spec.members.filter((m) => m.role === "ridge").length).toBe(2);
    expect(spec.members.filter((m) => m.role === "ring_beam").length).toBe(8);
  });

  it("annotates the two joint-facing slope planes with the valley ID", () => {
    // A points +Y, joint on A's RIGHT (east, insideA=-1). So A's
    // "right" slope should be annotated.
    // B points +X, joint on B's RIGHT (north, insideB=-1). So B's
    // "right" slope should be annotated.
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    const jointId = jointMembers(spec, "valley")[0].id;
    const annotated = spec.planes.filter((p) =>
      p.joint_edges?.includes(jointId),
    );
    expect(annotated.length).toBe(2);
    const segIds = annotated.map((p) => p.source_segment_id).sort();
    expect(segIds).toEqual(["a", "b"]);
  });

  it("does not annotate non-joint-facing slopes", () => {
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    // A's LEFT slope + B's LEFT slope should NOT be annotated.
    const unannotated = spec.planes.filter(
      (p) => p.role === "slope" && !p.joint_edges,
    );
    expect(unannotated.length).toBe(2);
  });
});

describe("resolveJoints — courtyard (4 segments, 4 valleys)", () => {
  const cfg: RoofConfig = {
    type: "roof",
    roof_type: "pitched",
    segments: [
      { id: "n", start: [0, 0], end: [400, 0], width: 100 },
      { id: "e", start: [400, 0], end: [400, 400], width: 100 },
      { id: "s", start: [400, 400], end: [0, 400], width: 100 },
      { id: "w", start: [0, 400], end: [0, 0], width: 100 },
    ],
    default_endpoint: "closed",
    ...commonProps,
  };
  const wallTopZ = 100;
  const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);

  it("emits exactly 4 valley members (one per corner joint)", () => {
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    expect(jointMembers(spec, "valley").length).toBe(4);
  });

  it("each valley terminates at an INSIDE-EAVE corner of the courtyard hole", () => {
    // Width 100 → halfW=50. min_overhang=25, global dCrit=50 → oCross=25.
    // Inside eave offset = halfW + oCross = 75. Inside eave corners at
    // (75, 75), (325, 75), (325, 325), (75, 325).
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    const cornerXys = jointMembers(spec, "valley")
      .map((v) => `${v.end[0].toFixed(0)},${v.end[1].toFixed(0)}`)
      .sort();
    expect(cornerXys).toEqual(["325,325", "325,75", "75,325", "75,75"]);
  });

  it("each valley starts at a joint apex on the outside corner of the courtyard (segment endpoint)", () => {
    // Joints are at (0,0), (400,0), (400,400), (0,400) — segment endpoints.
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    const apexXys = jointMembers(spec, "valley")
      .map((v) => `${v.start[0].toFixed(0)},${v.start[1].toFixed(0)}`)
      .sort();
    expect(apexXys).toEqual(["0,0", "0,400", "400,0", "400,400"]);
  });
});

describe("resolveJoints — single segment (no joints)", () => {
  it("emits 0 valley/hip members for a solo pitched roof", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [150, 0], end: [150, 500], width: 300 }],
      default_endpoint: "closed",
      ...commonProps,
    };
    const wallTopZ = 100;
    const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    expect(jointMembers(spec).length).toBe(0);
  });
});

describe("resolveJoints — collinear joint (no valley/hip)", () => {
  it("two collinear segments meeting head-to-head → no member", () => {
    // Straight continuation. Cross product = 0 → skip.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [
        { id: "a", start: [150, 0], end: [150, 250], width: 300 },
        { id: "b", start: [150, 250], end: [150, 500], width: 300 },
      ],
      default_endpoint: "closed",
      ...commonProps,
    };
    const wallTopZ = 100;
    const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
    const spec0 = derivePitchedRoof(cfg, { wallTopZ });
    const spec = resolveJoints(cfg, spec0, { wallTopZ, ridgeZ });
    expect(jointMembers(spec).length).toBe(0);
  });
});

describe("resolveJoints — flat roof (no-op in Phase 1)", () => {
  it("flat roof returns spec unchanged", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "flat",
      segments: [{ id: "s", start: [0, 50], end: [200, 50], width: 100 }],
    };
    const spec = { members: [], planes: [], trusses: [] };
    const out = resolveJoints(cfg, spec, { wallTopZ: 100, ridgeZ: 100 });
    expect(out).toEqual(spec);
  });
});

describe("resolveJoints — shed-shed L-shape joints", () => {
  // Classic L-shape with BOTH highs meeting at the inside corner
  //   A: segment along +X, y=50, width 100 (rect y∈[0,100]). high on
  //     "right" means high side is -Y (north, y=0).
  //   B: segment along +Y from (200,50) to (200,250), width 100
  //     (rect x∈[150,250]). high on "left" means high side is -X
  //     (west, x=150).
  // Wait actually with these choices, A's high edge is at y=0 (north)
  // and B's high edge is at x=150 (west). Those don't meet — they're
  // in opposite corners.
  //
  // For "both highs meet at inside corner (200,50) via extended walls"
  // we need A's high on the side facing B (=+Y=south for A pointing
  // +X, that's "left") and B's high on the side facing A (=-X=west
  // for B pointing +Y, that's "left").
  // But (200,50) is at joint = segment endpoint = the meeting point
  // of the two centrelines. It's not really an "inside corner" in the
  // conventional L-sense — that would be at (150,100) or similar.
  //
  // Skip this literal example and test the two variants that DO produce
  // a hip vs a valley cleanly.
  it("both LOWS meet at inside corner → valley member", () => {
    // A along +X, y-centre=50, width 100 → rect y∈[0,100]. high on LEFT
    // means high side is +Y=south (y=100). Low side is north (y=0).
    // B along +Y from (200,50) width 100 → rect x∈[150,250]. high on
    // RIGHT means high side is +X=east (x=250). Low side is west (x=150).
    // A's low edge (y=0) and B's low edge (x=150) both extend past the
    // segment endpoints. Their extensions meet at (150, 0) — outside
    // corner of the L. And they also converge near the joint region at
    // the interior corner (150, 100). This is a valley scenario:
    // both low edges are on the inside of the L, water pools at the
    // inside corner.
    // Note: A's inside side (facing B) is RIGHT (-Y=north, since B is
    // north-of-A-midpoint). B's inside side (facing A) is LEFT (-X=west,
    // since A is west-of-B-midpoint). Wait let me recompute.
    // A_mid = (100, 50). B_mid = (200, 150).
    // For A pointing +X, leftN = (0, 1). Vector to B_mid = (100, 100).
    // dot((100,100), (0,1)) = 100 > 0 → insideA = +1 (LEFT = south).
    // For B pointing +Y, leftN = (-1, 0). Vector to A_mid = (-100, -100).
    // dot((-100,-100), (-1,0)) = 100 > 0 → insideB = +1 (LEFT = west).
    // A's inside side is south (=high side for A_high=left, so INSIDE
    // is where the HIGH is). B's inside side is west (=LOW side for
    // B_high=right). So HIGH side of A meets LOW side of B at joint —
    // that's a MISMATCH, planes won't align at the corner.
    //
    // Restart with a config where both LOW sides are inside (facing each
    // other):
    //   A high on RIGHT (north, y=0). A's low = south (y=100) = inside.
    //   B high on LEFT (east, x=250). B's low = west (x=150) = inside.
    // Now both low edges are inside; they extend outward past segments.
    // Inside corner = (150, 100) as computed by the wall-line intersect.
    // Both planes at (150, 100): A's plane z = wall_top + 0 * rise = wall_top
    // (since at low edge). B same: wall_top. They agree. Corner z = wall_top.
    // At joint (200, 50): A plane z = wall_top + (perpDistFromLow_A / 100) * rise.
    //   PerpFromLow for A pointing +X, low on south (+Y=+leftN), pt=(200,50):
    //   perpSigned = (200-0)*0 + (50-50)*1 = 0. distFromLow = 0 - (+w/2) if
    //   highSide=right → 0 - 50 = -50. Fraction = -50/100 = -0.5. z = wall_top - rise/2.
    // Hmm negative fraction — pt at segment centreline is above the LOW edge by w/2 toward
    // HIGH edge. Actually for highSide=right: distFromLow = w/2 - perpSigned = 50 - 0 = 50.
    // Fraction = 50/100 = 0.5. z = wall_top + rise/2. Matches architecturally
    // (centreline is halfway between low + high). ✓
    // Same for B at joint: z = wall_top + rise/2.
    // So endpoint_z = wall_top + rise/2, corner_z = wall_top.
    // corner_z (wall_top) < endpoint_z (wall_top + rise/2) → VALLEY ✓
    // Both LOWS inside (facing each other) requires BOTH highs to be
    // on the OUTSIDE side. For A pointing +X, inside=LEFT=south, so
    // outside=RIGHT=north → shed_high_side="right". For B pointing +Y,
    // inside=LEFT=west, so outside=RIGHT=east → shed_high_side="right".
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "shed",
      segments: [
        { id: "a", start: [0, 50], end: [200, 50], width: 100, shed_high_side: "right" },
        { id: "b", start: [200, 50], end: [200, 250], width: 100, shed_high_side: "right" },
      ],
      slope: { by: "height", ridge_h: 20 },
      min_overhang: 15,
    };
    const spec = deriveShedRoof(cfg, { wallTopZ: 100 });
    const out = resolveJoints(cfg, spec, { wallTopZ: 100, ridgeZ: 100 });
    const valleys = jointMembers(out, "valley");
    const hips = jointMembers(out, "hip");
    expect(valleys.length + hips.length).toBe(1);
    expect(valleys.length).toBe(1);
    // valley from (150, 100, 100) to (200, 50, 110)
    const v = valleys[0]!;
    expect(v.start[0]).toBeCloseTo(150, 4);
    expect(v.start[1]).toBeCloseTo(100, 4);
    expect(v.start[2]).toBeCloseTo(100, 4);
    expect(v.end[0]).toBeCloseTo(200, 4);
    expect(v.end[1]).toBeCloseTo(50, 4);
    expect(v.end[2]).toBeCloseTo(110, 4);
  });

  it("both HIGHS meet at inside corner → hip member", () => {
    // A high on LEFT (south, y=100). Inside = LEFT (south=+Y) = HIGH side.
    // B high on RIGHT (west, x=150). Inside = LEFT (west=-X). But B's
    // high is on RIGHT (east=+X)... hmm. Let me pick the OTHER pair.
    //
    // Actually: for BOTH highs to be on the inside side:
    //   A high on LEFT (south=+Y) — south is A's inside → high inside ✓
    //   B high on LEFT (west=-X) — west is B's inside → high inside ✓
    // Corner at (150, 100). A's high edge is at y=100 (south wall line).
    //   z_A at (150, 100) = wall_top + rise (at high edge). ✓
    // B's high edge is at x=150 (west wall line).
    //   z_B at (150, 100) = wall_top + rise. ✓
    // Endpoint (200, 50): both planes give centreline z = wall_top + rise/2.
    // corner_z (wall_top + rise) > endpoint_z (wall_top + rise/2) → HIP ✓
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
    const out = resolveJoints(cfg, spec, { wallTopZ: 100, ridgeZ: 100 });
    const hips = jointMembers(out, "hip");
    expect(hips.length).toBe(1);
    const h = hips[0]!;
    // hip apex at inside corner (150, 100) at wall_top + rise = 120
    expect(h.start[0]).toBeCloseTo(150, 4);
    expect(h.start[1]).toBeCloseTo(100, 4);
    expect(h.start[2]).toBeCloseTo(120, 4);
    // hip base at joint endpoint (200, 50) at mid z = 110
    expect(h.end[0]).toBeCloseTo(200, 4);
    expect(h.end[1]).toBeCloseTo(50, 4);
    expect(h.end[2]).toBeCloseTo(110, 4);
  });

  it("mismatched high sides → skipped with warning (no joint member)", () => {
    // A high south (LEFT), B high east (RIGHT). At corner (150, 100):
    //   A high side is south (y=100) → z_A = wall_top + rise = 120
    //   B high side is east (x=250) → at (150, 100) B is at LOW side (x=150) → z_B = wall_top
    // 120 vs 100 don't agree → skip joint.
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "shed",
      segments: [
        { id: "a", start: [0, 50], end: [200, 50], width: 100, shed_high_side: "left" },
        { id: "b", start: [200, 50], end: [200, 250], width: 100, shed_high_side: "right" },
      ],
      slope: { by: "height", ridge_h: 20 },
      min_overhang: 15,
    };
    const spec = deriveShedRoof(cfg, { wallTopZ: 100 });
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (msg: string) => warns.push(msg);
    try {
      const out = resolveJoints(cfg, spec, { wallTopZ: 100, ridgeZ: 100 });
      expect(jointMembers(out).length).toBe(0);
      expect(warns.some((w) => w.includes("planes disagree"))).toBe(true);
    } finally {
      console.warn = orig;
    }
  });
});

describe("ridgeZFromConfig — per-side (asymmetric) pitch, no `slope`", () => {
  // A pitched roof authored as `slope angle (L, R)` sets slope_left/slope_right
  // and leaves `slope` undefined. This used to throw at joint resolution and the
  // whole (multi-segment) roof vanished. It must now resolve a ridge Z.
  it("resolves a finite ridge Z from slope_left + slope_right (was: throw)", () => {
    const cfg: RoofConfig = {
      type: "roof",
      roof_type: "pitched",
      segments: [{ id: "s", start: [100, 0], end: [100, 300], width: 200 }],
      slope_left: { by: "angle", angle_deg: 45 },
      slope_right: { by: "angle", angle_deg: 25 },
      min_overhang: 25,
    };
    const z = ridgeZFromConfig(cfg, 100);
    expect(Number.isFinite(z)).toBe(true);
    // H = width·tanL·tanR/(tanL+tanR), width 200, 45°/25° → ≈ 63.6 above wallTop.
    expect(z).toBeCloseTo(100 + (200 * Math.tan(Math.PI / 4) * Math.tan((25 * Math.PI) / 180)) /
      (Math.tan(Math.PI / 4) + Math.tan((25 * Math.PI) / 180)), 1);
  });

  it("still throws when there is no slope at all", () => {
    const cfg: RoofConfig = {
      type: "roof", roof_type: "pitched",
      segments: [{ id: "s", start: [100, 0], end: [100, 300], width: 200 }],
      min_overhang: 25,
    };
    expect(() => ridgeZFromConfig(cfg, 100)).toThrow(/slope/);
  });
});
