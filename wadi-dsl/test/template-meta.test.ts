import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

// A `.wdl` can carry the catalog metadata that makes its compiled `.wadi`
// self-describing (title/description/style/roof/min plot), so an author writes the
// template's gallery details in their source. Compiles to the config's `template`
// block; round-trips through the decompiler.

const wdl = `house H {
  site { plot (300, 300) }
  template {
    title "Coastal cottage"
    description "Breezy 2-bed on the grid."
    style "Konkan"
    roof "Gable"
    min_plot (22, 34)
  }
  floor 1 "G" slab_thickness 0 {
    room Bed at (20, 20) size (160, 160) { wall north east south west }
  }
}
`;

type Obj = Record<string, unknown>;

describe("DSL — template catalog metadata block", () => {
  it("compiles to the config's `template` block", () => {
    const cfg = compileDsl(wdl) as Obj;
    expect(cfg.template).toEqual({
      title: "Coastal cottage",
      description: "Breezy 2-bed on the grid.",
      style: "Konkan",
      roof: "Gable",
      minWidthFt: 22,
      minLengthFt: 34,
    });
  });

  it("round-trips: emit → recompile preserves the block", () => {
    const cfg = compileDsl(wdl);
    const wdl2 = emitWdl(cfg);
    expect(wdl2).toContain("template {");
    expect(wdl2).toContain('title "Coastal cottage"');
    expect(wdl2).toContain("min_plot (22, 34)");
    expect((compileDsl(wdl2) as Obj).template).toEqual((cfg as Obj).template);
  });

  it("is optional — a house with no block has no `template` key", () => {
    const cfg = compileDsl(`house H { floor 1 "G" slab_thickness 0 { room R at (0,0) size (100,100) { wall north } } }`) as Obj;
    expect("template" in cfg).toBe(false);
  });
});
