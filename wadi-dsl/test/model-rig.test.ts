import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

// P1 (plans/declarative-plugins.md): the `model` primitive with a node RIG, authored
// in WDL. Compiles the rig ops; rig values are constant expressions. Round-trips.

const wdl = `house H {
  floor 1 "G" {
    model name "Tank" asset { id "tank" src "https://x/tank.glb" dims (1, 2, 1) } at (200, 150) rotation 90 {
      rotate "lid" (0, 45, 0)
      visible "ladder" 1
      material "body" color "#cc5533"
      array "rung" count 6 step { translate (0, 10, 0) rotate (0, 30, 0) about (0, 0, 0) }
    }
  }
}
`;

type Obj = Record<string, unknown>;
const firstObj = (cfg: Obj) => ((cfg.floors as Obj[])[0].objects as Obj[])[0];

describe("DSL — model + node rig (P1)", () => {
  it("compiles model + rig ops to a flat object", () => {
    const cfg = compileDsl(wdl) as Obj;
    const m = firstObj(cfg);
    expect(m.type).toBe("model");
    expect(m.name).toBe("Tank");
    expect(m).toMatchObject({ x: 200, y: 150, rotation: 90 });
    expect((m.asset as Obj).src).toBe("https://x/tank.glb");
    expect(m.rig).toEqual([
      { op: "rotate", node: "lid", by: [0, 45, 0] },
      { op: "visible", node: "ladder", value: 1 },
      { op: "material", node: "body", color: "#cc5533" },
      { op: "array", node: "rung", count: 6, translate: [0, 10, 0], rotate: [0, 30, 0], about: [0, 0, 0] },
    ]);
  });

  it("round-trips: emit → recompile preserves the model + rig", () => {
    const cfg = compileDsl(wdl);
    const wdl2 = emitWdl(cfg);
    expect(wdl2).toContain("model");
    expect(wdl2).toContain('array "rung" count 6');
    const cfg2 = compileDsl(wdl2) as Obj;
    expect(firstObj(cfg2)).toEqual(firstObj(cfg));
  });

  it("rejects a non-constant rig value (parametric rig is deferred)", () => {
    const bad = `house H {
      var a = 45
      floor 1 "G" {
        model asset { id "t" src "u.glb" dims (1,1,1) } at (0,0) { rotate "lid" (0, a, 0) }
      }
    }`;
    expect(() => compileDsl(bad)).toThrow(/rig values must be constant/);
  });
});
