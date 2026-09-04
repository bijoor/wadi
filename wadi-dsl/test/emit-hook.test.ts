// The decompiler's per-primitive emit hook (`emitWdl(cfg, name, { emitObject })`).
// A contributed primitive can own its bespoke `.wdl` via this hook, which the
// editor injects from the registry's NodeDefinition.emitWdl capability. Headless
// callers omit it and keep the generic ObjectDecl form. These tests lock in that
// the hook is consulted at every object site, wins over the generic form, and
// never disturbs the built-in bespoke emitters or types the hook declines.

import { describe, it, expect } from "vitest";
import { emitWdl, type EmitObjectHook } from "../src/generator/fromHouseConfig.js";

// A hook that owns two contributed types with a compact bespoke syntax and
// declines everything else (returns undefined → generic / built-in path).
const hook: EmitObjectHook = (o) => {
  if (o.type === "compound_wall")
    return `compound_wall ${o.name} at (${o.x}, ${o.y}) size (${o.width}, ${o.thickness}) height ${o.height}`;
  if (o.type === "well")
    return `well ${o.name} at (${o.x}, ${o.y}) diameter ${o.diameter}`;
  return undefined;
};

const baseFloorConfig = (objects: Record<string, unknown>[]) => ({
  name: "H",
  floors: [{ floor_number: 1, name: "Ground", objects }],
});

describe("decompiler emit hook", () => {
  const cw = { type: "compound_wall", name: "Perim", x: 0, y: 0, width: 400, thickness: 8, height: 60 };

  it("uses the injected bespoke form for a contributed type", () => {
    const wdl = emitWdl(baseFloorConfig([cw]), "House", { emitObject: hook });
    expect(wdl).toContain("compound_wall Perim at (0, 0) size (400, 8) height 60");
    // and NOT the generic block form
    expect(wdl).not.toMatch(/compound_wall Perim \{/);
  });

  it("falls back to the generic form when no hook is given (headless callers)", () => {
    const wdl = emitWdl(baseFloorConfig([cw]));
    // generic ObjectDecl: `compound_wall Perim { … }`
    expect(wdl).toMatch(/compound_wall Perim \{/);
    expect(wdl).toContain("width 400");
    expect(wdl).not.toContain("size (400, 8)");
  });

  it("falls back to generic for a type the hook declines (returns undefined)", () => {
    const solar = { type: "solar_panel", name: "PV", x: 10, y: 10, width: 30, length: 20 };
    const wdl = emitWdl(baseFloorConfig([solar]), "House", { emitObject: hook });
    expect(wdl).toMatch(/solar_panel PV \{/); // generic, hook returned undefined
  });

  it("indents the hook's block at the object's depth", () => {
    const wdl = emitWdl(baseFloorConfig([cw]), "House", { emitObject: hook });
    // objects sit at indent 2 (4 spaces) inside floor { … }
    expect(wdl).toContain("\n    compound_wall Perim at (0, 0)");
  });

  it("consults the hook for objects inside a component definition too", () => {
    const cfg = {
      name: "H",
      components: {
        Fence: { objects: [{ type: "well", name: "W1", x: 0, y: 0, diameter: 30 }] },
      },
      floors: [{ floor_number: 1, name: "Ground", objects: [] }],
    };
    const wdl = emitWdl(cfg, "House", { emitObject: hook });
    expect(wdl).toContain("well W1 at (0, 0) diameter 30");
  });

  it("leaves built-in bespoke emitters untouched when a hook is present", () => {
    const cfg = baseFloorConfig([
      { type: "room", name: "Hall", x: 20, y: 20, width: 200, length: 200, walls: ["north", "east", "south", "west"] },
      cw,
    ]);
    const withHook = emitWdl(cfg, "House", { emitObject: hook });
    // the room still decompiles via its built-in emitter (bespoke `at (…) size (…)`),
    // identical to the no-hook output for that object
    expect(withHook).toContain("room Hall at (20, 20) size (200, 200)");
  });
});
