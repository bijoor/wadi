import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

// P2 (plans/declarative-plugins.md): a `component … expose as <ns.type>` whose body
// contains a rigged `model` (P1) compiles and round-trips with no extra machinery —
// the model + rig live inside the component def, and the promoted type is used via
// the generic ObjectDecl path. Registration + placement are covered editor-side
// (editor/src/registry/promote-model.test.ts).

const wdl = `house H {
  component WaterTank expose as pack.water_tank layer "structure" label "Water tank" {
    param rungs = 6 kind int
    slab at (0, 0) size (40, 40)
    model name "Tank" asset { id "tank" src "https://x/tank.glb" dims (4, 6, 4) } at (10, 10) {
      array "rung" count 6 step { translate (0, 1, 0) }
    }
  }
  floor 1 "G" {
    pack.water_tank "T1" { x 200 y 150 rungs 8 }
  }
}
`;

type Obj = Record<string, unknown>;

describe("DSL — promote a component containing a rigged model (P2)", () => {
  it("the component body holds the model + rig alongside the expose marker", () => {
    const cfg = compileDsl(wdl) as Obj;
    const def = (cfg.components as Record<string, Obj>).WaterTank;
    expect(def.expose).toEqual({ type: "pack.water_tank", layer: "structure", label: "Water tank" });
    const model = (def.objects as Obj[]).find((o) => o.type === "model")!;
    expect(model).toMatchObject({ type: "model", name: "Tank", x: 10, y: 10 });
    expect((model.asset as Obj).src).toBe("https://x/tank.glb");
    expect(model.rig).toEqual([{ op: "array", node: "rung", count: 6, translate: [0, 1, 0] }]);
  });

  it("the promoted type is used generically", () => {
    const cfg = compileDsl(wdl) as Obj;
    const obj = ((cfg.floors as Obj[])[0].objects as Obj[])[0];
    expect(obj).toMatchObject({ type: "pack.water_tank", name: "T1", x: 200, y: 150, rungs: 8 });
  });

  const modelOf = (cfg: Obj) =>
    ((cfg.components as Record<string, Obj>).WaterTank.objects as Obj[]).find((o) => o.type === "model");

  it("round-trips: emit → recompile preserves the model-in-component", () => {
    const cfg = compileDsl(wdl) as Obj;
    const wdl2 = emitWdl(cfg);
    expect(wdl2).toContain("expose as pack.water_tank");
    expect(wdl2).toContain("model");
    const cfg2 = compileDsl(wdl2) as Obj;
    expect(modelOf(cfg2)).toEqual(modelOf(cfg));
    expect((cfg2.components as Record<string, Obj>).WaterTank.expose).toEqual(
      (cfg.components as Record<string, Obj>).WaterTank.expose,
    );
  });
});
