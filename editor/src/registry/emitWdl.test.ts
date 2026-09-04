// Dogfooding the decompile capability: our registry-driven primitives (item /
// model / spiral_staircase) carry `emitWdl` on their NodeDefinition, so the editor
// decompiles them through the SAME registry hook a contributed primitive uses.
// Two invariants:
//   1. emitNodeWdl returns a bespoke string for these types (the hook fires) and
//      undefined for types that have no node emitter (the switch still owns them).
//   2. The hook-injected decompile is BYTE-IDENTICAL to the headless switch, so
//      routing through the registry changes nothing (no drift, no regression).
import { describe, it, expect } from "vitest";
import { emitWdl } from "wadi-wdl-emitter";
import { emitNodeWdl, getNode } from "./registry";

// Ensure the builtin nodes are registered (registry.ts self-registers on import).
import "./registry";

const decompile = (cfg: Record<string, unknown>) => ({
  headless: emitWdl(cfg), // no hook — the built-in switch
  editor: emitWdl(cfg, "House", { emitObject: emitNodeWdl }), // registry hook
});

describe("registry emitWdl capability (dogfooding)", () => {
  it("our registry-driven primitives declare emitWdl", () => {
    expect(typeof getNode("item")?.emitWdl).toBe("function");
    expect(typeof getNode("model")?.emitWdl).toBe("function");
    expect(typeof getNode("spiral_staircase")?.emitWdl).toBe("function");
  });

  it("emitNodeWdl returns bespoke syntax for those types, undefined for others", () => {
    expect(emitNodeWdl({ type: "item", name: "Chair", asset: { src: "x.glb", dimensions: [1, 1, 1] }, x: 10, y: 20 }))
      .toMatch(/^item name "Chair" .* at \(10, 20\)/);
    expect(emitNodeWdl({ type: "spiral_staircase", name: "S", x: 0, y: 0, radius: 40, total_height: 108 }))
      .toMatch(/^spiral_staircase S at \(0, 0\) radius 40 total_height 108/);
    // A type with no node emitter (room lives in the switch) → hook declines.
    expect(emitNodeWdl({ type: "room", name: "Hall", x: 0, y: 0, width: 100, length: 100 })).toBeUndefined();
  });

  it("hook-injected decompile is byte-identical to the headless switch", () => {
    const cfg = {
      name: "H",
      floors: [
        {
          floor_number: 1,
          name: "Ground",
          objects: [
            { type: "room", name: "Hall", x: 20, y: 20, width: 200, length: 200, walls: ["north", "east", "south", "west"] },
            { type: "item", name: "Chair", asset: { src: "chair.glb", dimensions: [1, 1, 1] }, x: 40, y: 40, rotation: 90 },
            { type: "spiral_staircase", name: "Spiral", x: 100, y: 100, radius: 40, total_height: 108, turns: 1.5 },
            {
              type: "model", name: "Tree", asset: { src: "tree.glb", dimensions: [2, 2, 2] }, x: 5, y: 5,
              rig: [{ op: "scale", node: "Trunk", by: [1, 2, 1] }],
            },
          ],
        },
      ],
    };
    const { headless, editor } = decompile(cfg);
    expect(editor).toBe(headless); // dogfooding must not change a single byte
    // and the bespoke forms are actually present (not the generic block form)
    expect(editor).toContain('item name "Chair"');
    expect(editor).toContain("spiral_staircase Spiral at (100, 100)");
    expect(editor).toContain("model name \"Tree\"");
    expect(editor).toContain("scale \"Trunk\" (1, 2, 1)");
  });
});
