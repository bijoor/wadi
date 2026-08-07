import { describe, it, expect } from "vitest";
import { registerExposedComponents } from "./promote";
import { getNode } from "./registry";
import { resolveParametric } from "../param/resolve";
import { expandRoomWalls } from "../svg2d/expand";
import type { HouseConfig } from "../schema/houseConfig";

// P2 (plans/declarative-plugins.md): promoting a component that CONTAINS a rigged
// `model` falls out of P0 (promotion) + P1 (the model primitive + rig) with no new
// machinery — the promoted primitive stamps its body, offsetting the model and
// carrying its rig through, and a right-angle placement adds yaw to the model.

const tankDef = {
  params: [{ name: "rungs", default: 6, kind: "int" }],
  objects: [
    { type: "floor_slab", x: 0, y: 0, width: 40, length: 40, thickness: 6 },
    {
      type: "model",
      name: "Tank",
      asset: { id: "tank", src: "https://x/tank.glb", dimensions: [4, 6, 4] },
      x: 10,
      y: 10,
      rotation: 0,
      rig: [{ op: "array", node: "rung", count: 6, translate: [0, 1, 0] }],
    },
  ],
  expose: { type: "pack.water_tank", layer: "structure", label: "Water tank" },
};

const placedConfig = (inst: Record<string, unknown>) =>
  ({
    floors: [{ floor_number: 1, name: "G", objects: [{ type: "pack.water_tank", ...inst }] }],
    components: { WaterTank: tankDef },
  }) as unknown as HouseConfig;

const expandModel = (inst: Record<string, unknown>) => {
  const config = placedConfig(inst);
  registerExposedComponents(config);
  const resolved = resolveParametric(config as never).config as unknown as HouseConfig;
  const objs = (expandRoomWalls(resolved, 8).floors?.[0]?.objects ?? []) as Record<string, unknown>[];
  return objs;
};

describe("declarative plugins — promote a rigged-model component (P2)", () => {
  it("registers and stamps the body: the model is offset and its rig survives", () => {
    const objs = expandModel({ x: 200, y: 150 });
    expect(getNode("pack.water_tank")).toBeTruthy();
    // the promoted instance is gone; its body took its place
    expect(objs.some((o) => o.type === "pack.water_tank")).toBe(false);
    expect(objs.some((o) => o.type === "floor_slab")).toBe(true);

    const model = objs.find((o) => o.type === "model");
    expect(model).toBeTruthy();
    // local (10,10) offset by the placement (200,150)
    expect(model).toMatchObject({ type: "model", x: 210, y: 160 });
    // the rig travels with the model, untouched
    expect(model!.rig).toEqual([{ op: "array", node: "rung", count: 6, translate: [0, 1, 0] }]);
    // the asset survives so the 3D node can load and rig the GLB
    expect((model!.asset as Record<string, unknown>).src).toBe("https://x/tank.glb");
  });

  it("a right-angle placement rotates the model's position AND adds its yaw", () => {
    const objs = expandModel({ x: 200, y: 150, rotation: 90 });
    const model = objs.find((o) => o.type === "model")!;
    // rp(10,10) at 90° → (10,-10), then + (200,150) → (210,140)
    expect(model).toMatchObject({ x: 210, y: 140, rotation: 90 });
    // rig unaffected by placement rotation (it lives in the GLB's own node space)
    expect(model.rig).toEqual([{ op: "array", node: "rung", count: 6, translate: [0, 1, 0] }]);
  });
});
