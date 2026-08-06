import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { resolveParametric } from "../../editor/src/param/resolve";
import { validate } from "../../editor/src/schema/houseConfig";
import { computeMergedV2Spec } from "../../editor/src/svg2d/roof/v2/computeFromHouse";

// Regression: a roof `slope` driven by a VARIABLE (`slope angle roofAngle`) must
// resolve to a number and derive real geometry. Before the fix the compiler
// inlined the raw "= roofAngle" formula string onto slope.angle_deg (bypassing
// the object's formulas map), the resolver never folded it, tan(NaN) → rise 0,
// and the roof silently derived to NOTHING ("rise must be > 0") with no error
// surfaced — the model loaded but the roof was invisible.

function build(wdl: string) {
  const compiled = compileDsl(wdl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { config } = resolveParametric(compiled as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roof = (config as any).floors
    .flatMap((f: any) => f.objects ?? [])
    .find((o: any) => o.type === "roof");
  const res = validate(config);
  expect(res.ok, JSON.stringify(res.errors)).toBe(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spec = computeMergedV2Spec((res as any).data);
  return { roof, spec };
}

const HEAD = `house T {
  convention center
  units feet_inches per_unit 10
  site { plot (400, 400) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }
  var roofAngle = 30
  floor 1 "G" height 116 slab_thickness 8 {
    slab name "S" at (0,0) size (400,400) thickness 8
    room R at (0,0) size (400,400) { wall north south east west }
  }`;

describe("roof slope from a variable", () => {
  it("resolves a symmetric `slope angle <var>` and derives geometry", () => {
    const { roof, spec } = build(`${HEAD}
  floor 2 "Roof" {
    roof pitched endpoint closed slope angle roofAngle overhang 25 {
      segment "s0" from (0,200) to (400,200) width 392
    }
  }
}`);
    // angle_deg folded to the number; the "= roofAngle" formula preserved.
    expect(roof.slope).toMatchObject({ by: "angle", angle_deg: 30 });
    expect(roof.slope.formulas).toEqual({ angle_deg: "= roofAngle" });
    expect(spec.planes.length).toBeGreaterThan(0);
  });

  it("resolves an asymmetric `slope angle (<var>, n)` on both sides", () => {
    const { roof, spec } = build(`${HEAD}
  floor 2 "Roof" {
    roof pitched endpoint open slope angle (roofAngle, 20) overhang 25 {
      segment "s0" from (0,200) to (400,200) width 392
    }
  }
}`);
    expect(roof.slope_left).toMatchObject({ by: "angle", angle_deg: 30 });
    expect(roof.slope_right).toMatchObject({ by: "angle", angle_deg: 20 });
    expect(roof.slope_left.formulas).toEqual({ angle_deg: "= roofAngle" });
    expect(spec.planes.length).toBeGreaterThan(0);
  });

  it("a literal slope still emits no formulas map (byte-parity)", () => {
    const { roof } = build(`${HEAD}
  floor 2 "Roof" {
    roof pitched endpoint closed slope angle 30 overhang 25 {
      segment "s0" from (0,200) to (400,200) width 392
    }
  }
}`);
    expect(roof.slope).toEqual({ by: "angle", angle_deg: 30 });
    expect(roof.slope.formulas).toBeUndefined();
  });
});
