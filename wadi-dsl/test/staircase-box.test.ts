import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

const HEAD = `house T {
  convention center
  units feet_inches per_unit 10
  site { plot (400, 500) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }
  floor 1 "G" height 116 slab_thickness 8 {
    slab name "S" at (0,0) size (400,500) thickness 8
    room R at (0,0) size (400,500) { wall north south east west }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stairOf = (cfg: any) =>
  cfg.floors.flatMap((f: any) => f.objects ?? []).find((o: any) => o.type === "staircase");

describe("staircase box model (DSL)", () => {
  it("compiles `box (w, l)` + 2-arg step → width/length, no step_width", () => {
    const wdl = `${HEAD}
    staircase name "Main" at (10, 545) box (190, 280) step (18, 25) direction south climb up
      total_height 300 landing_depth 90 turn clockwise flight_gap 10
  }
}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = stairOf(compileDsl(wdl) as any);
    expect(sc.width).toBe(190);
    expect(sc.length).toBe(280);
    expect(sc.step_width).toBeUndefined();
    expect(sc.step_rise).toBe(18);
    expect(sc.step_tread).toBe(25);
  });

  it("decompiles back to `box (…)` + 2-arg step", () => {
    const wdl = `${HEAD}
    staircase name "Main" at (10, 545) box (190, 280) step (18, 25) direction south climb up total_height 300
  }
}`;
    const out = emitWdl(compileDsl(wdl), "T");
    expect(out).toContain("box (190, 280)");
    expect(out).toMatch(/step \(18, 25\)/);
    expect(out).not.toMatch(/step \(18, 25, /); // no third arg
  });

  it("legacy `step (rise, tread, width)` + max_run still compiles", () => {
    const wdl = `${HEAD}
    staircase name "Old" at (10, 545) step (18, 25, 90) direction south climb up total_height 300 max_run 200
  }
}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sc = stairOf(compileDsl(wdl) as any);
    expect(sc.step_width).toBe(90);
    expect(sc.max_run).toBe(200);
    expect(sc.width).toBeUndefined();
  });
});
