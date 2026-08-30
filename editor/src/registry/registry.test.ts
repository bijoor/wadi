import { describe, expect, it } from "vitest";
import { getNode, allNodes, addableNodeTypes } from "./registry";
import { object as houseObject } from "../schema/houseConfig";

describe("node registry", () => {
  it("registers the item (GLB furniture) node with a full surface", () => {
    const def = getNode("item");
    expect(def).toBeTruthy();
    expect(def!.addable).toBe(true);
    expect(def!.label).toBe("Furniture");
    expect(def!.defaultLayerId).toBe("furniture");
    expect(typeof def!.makeDefault).toBe("function");
    expect(typeof def!.render3D).toBe("function");
    expect(typeof def!.planFootprint).toBe("function");
    // (Form retired — property-panel editing is gone; WDL is the only edit surface.)
  });

  it("exposes item as an addable type", () => {
    expect(addableNodeTypes()).toContain("item");
    expect(allNodes().some((d) => d.type === "item")).toBe(true);
  });

  it("makeDefault produces a schema-valid item at plot centre", () => {
    const def = getNode("item")!;
    const cfg = { site: { plot_width: 300, plot_length: 400 } } as never;
    const obj = def.makeDefault!(cfg, []);
    expect(obj.type).toBe("item");
    expect((obj as { x: number }).x).toBe(150);
    expect((obj as { y: number }).y).toBe(200);
    // The produced object validates against the schema.
    expect(() => houseObject.parse(obj)).not.toThrow();
  });

  it("planFootprint returns the metric footprint in project units", () => {
    const def = getNode("item")!;
    const fp = def.planFootprint!({
      x: 10,
      y: 20,
      rotation: 30,
      name: "Bed",
      asset: { src: "/f/bed.glb", dimensions: [1.6, 0.5, 2.0] },
    });
    expect(fp).toBeTruthy();
    expect(fp!.cx).toBe(10);
    expect(fp!.cy).toBe(20);
    expect(fp!.rot).toBe(30);
    expect(fp!.label).toBe("Bed");
    // 1.6 m × 32.808 units/m ≈ 52.5 (default feet_inches/per_unit=10).
    expect(fp!.w).toBeCloseTo(52.49, 1);
    expect(fp!.d).toBeCloseTo(65.62, 1);
  });
});
