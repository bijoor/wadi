import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

// Off-centre ridge via `widths (left, right)` + first-class rafter/purlin pitch.
const WDL = `house T {
  convention center
  units feet_inches per_unit 10
  site { plot (400, 500) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }
  floor 1 "G" height 116 slab_thickness 8 {
    slab name "S" at (0,0) size (400,500) thickness 8
    room R at (0,0) size (400,500) { wall north south east west }
  }
  floor 2 "Roof" height 0 {
    roof name "Main" pitched endpoint open slope height 70 rafter_pitch 24 purlin_pitch 8 {
      segment "seg0" from (0, 250) to (400, 250) widths (180, 270)
    }
  }
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const roofOf = (cfg: any) =>
  cfg.floors.flatMap((f: any) => f.objects ?? []).find((o: any) => o.type === "roof");

describe("roof widths + rafter/purlin pitch (DSL)", () => {
  it("compiles `widths` → width_left/width_right + summed span, `*_pitch` → framing", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roof = roofOf(compileDsl(WDL) as any);
    const seg = roof.segments[0];
    expect(seg.width_left).toBe(180);
    expect(seg.width_right).toBe(270);
    expect(seg.width).toBe(450); // span = left + right
    expect(roof.framing.rafter_spacing_in).toBe(24);
    expect(roof.framing.purlin_spacing_in).toBe(8);
  });

  it("decompiles back to `widths (…)` and keeps the framing spacings", () => {
    const wdl = emitWdl(compileDsl(WDL), "T");
    expect(wdl).toContain("widths (180, 270)");
    expect(wdl).toContain("rafter_spacing_in");
  });

  it("plain `width` still compiles to a centred span (no width_left/right)", () => {
    const plain = WDL.replace("widths (180, 270)", "width 450");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seg = roofOf(compileDsl(plain) as any).segments[0];
    expect(seg.width).toBe(450);
    expect(seg.width_left).toBeUndefined();
    expect(seg.width_right).toBeUndefined();
  });
});
