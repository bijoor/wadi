// The decompiler's per-primitive emit hook (`emitWdl(cfg, name, { emitObject })`).
// A contributed primitive can own its bespoke `.wdl` via this hook, which the
// editor injects from the registry's NodeDefinition.emitWdl capability. Headless
// callers omit it and keep the generic ObjectDecl form. These tests lock in that
// the hook is consulted at every object site, wins over the generic form, and
// never disturbs the built-in bespoke emitters or types the hook declines.

import { describe, it, expect } from "vitest";
import { emitWdl, type EmitObjectHook } from "../src/generator/fromHouseConfig.js";
import { compileDsl } from "../src/generator/toHouseConfig.js";

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

// ── Site-primitive round-trip tests ─────────────────────────────────────────
// Inline hooks mirroring the real NodeDefinition.emitWdl for compound_wall,
// well, and solar_panel. Verifies grammar-correct emit and full round-trip
// (emit → compileDsl → config field check).

type Obj = Record<string, unknown>;

function nameTok(s: unknown): string {
  const str = String(s ?? "");
  return /^[A-Za-z_]\w*$/.test(str) ? str : JSON.stringify(str);
}

const primitiveHook: EmitObjectHook = (o) => {
  if (o.type === "compound_wall") {
    const n = o.name != null ? ` ${nameTok(o.name)}` : "";
    let s = `compound_wall${n} at (${o.x}, ${o.y}) size (${o.width}, ${o.length}) height ${o.height}`;
    if (o.thickness != null) s += `\n  thickness ${o.thickness}`;
    if (o.material != null) s += `\n  material ${JSON.stringify(o.material)}`;
    if (o.rotation != null) s += `\n  rotation ${o.rotation}`;
    if (o.z_offset != null) s += `\n  z_offset ${o.z_offset}`;
    if (o.enabled != null) s += `\n  enabled ${o.enabled}`;
    if (o.layer != null) s += `\n  layer ${JSON.stringify(o.layer)}`;
    return s;
  }
  if (o.type === "well") {
    const n = o.name != null ? ` ${nameTok(o.name)}` : "";
    let s = `well${n} at (${o.x}, ${o.y})`;
    if (o.shape != null) s += `\n  shape ${o.shape}`;
    if (o.diameter != null) s += `\n  diameter ${o.diameter}`;
    if (o.width != null) s += `\n  width ${o.width}`;
    if (o.length != null) s += `\n  length ${o.length}`;
    if (o.parapet_height != null) s += `\n  parapet_height ${o.parapet_height}`;
    if (o.rotation != null) s += `\n  rotation ${o.rotation}`;
    if (o.z_offset != null) s += `\n  z_offset ${o.z_offset}`;
    if (o.enabled != null) s += `\n  enabled ${o.enabled}`;
    if (o.layer != null) s += `\n  layer ${JSON.stringify(o.layer)}`;
    return s;
  }
  if (o.type === "solar_panel") {
    const n = o.name != null ? ` ${nameTok(o.name)}` : "";
    let s = `solar_panel${n} at (${o.x}, ${o.y})`;
    if (o.mount != null) s += `\n  mount ${o.mount}`;
    if (o.capacity_kw != null) s += `\n  capacity_kw ${o.capacity_kw}`;
    if (o.panel_count != null) s += `\n  panel_count ${o.panel_count}`;
    if (o.azimuth != null) s += `\n  azimuth ${o.azimuth}`;
    if (o.tilt != null) s += `\n  tilt ${o.tilt}`;
    if (o.rotation != null) s += `\n  rotation ${o.rotation}`;
    if (o.z_offset != null) s += `\n  z_offset ${o.z_offset}`;
    if (o.enabled != null) s += `\n  enabled ${o.enabled}`;
    if (o.layer != null) s += `\n  layer ${JSON.stringify(o.layer)}`;
    return s;
  }
  return undefined;
};

function floorConfig(objects: Obj[]): Obj {
  return {
    name: "TestHouse",
    site: { plot_width: 500, plot_length: 500 },
    floors: [{ floor_number: 1, name: "Ground", objects }],
  };
}

function roundTrip(wdl: string): Obj {
  const compiled = compileDsl(wdl) as Record<string, unknown>;
  return ((compiled.floors as Obj[])[0].objects as Obj[])[0];
}

describe("emitWdl hook — site primitives", () => {
  it("compound_wall hook emits correct token order", () => {
    const obj: Obj = { type: "compound_wall", name: "NorthWall", x: 0, y: 0, width: 420, length: 8, height: 50 };
    const wdl = emitWdl(floorConfig([obj]), "House", { emitObject: primitiveHook });
    expect(wdl).toContain("compound_wall NorthWall at (0, 0) size (420, 8) height 50");
  });

  it("compound_wall hook round-trips", () => {
    const obj: Obj = { type: "compound_wall", name: "NorthWall", x: 0, y: 0, width: 420, length: 8, height: 50 };
    const wdl = emitWdl(floorConfig([obj]), "House", { emitObject: primitiveHook });
    const out = roundTrip(wdl);
    expect(out.type).toBe("compound_wall");
    expect(out.x).toBe(0);
    expect(out.width).toBe(420);
    expect(out.length).toBe(8);
    expect(out.height).toBe(50);
  });

  it("compound_wall hook emits optional fields (thickness, rotation)", () => {
    const obj: Obj = { type: "compound_wall", name: "Wall", x: 10, y: 20, width: 100, length: 8, height: 50, thickness: 12, rotation: 90 };
    const wdl = emitWdl(floorConfig([obj]), "House", { emitObject: primitiveHook });
    expect(wdl).toContain("thickness 12");
    expect(wdl).toContain("rotation 90");
    const out = roundTrip(wdl);
    expect(out.thickness).toBe(12);
    expect(out.rotation).toBe(90);
  });

  it("well hook emits correct token order and round-trips", () => {
    const obj: Obj = { type: "well", name: "BackWell", x: 320, y: 400, shape: "circular", diameter: 30, parapet_height: 10 };
    const wdl = emitWdl(floorConfig([obj]), "House", { emitObject: primitiveHook });
    expect(wdl).toContain("well BackWell at (320, 400)");
    expect(wdl).toContain("shape circular");
    expect(wdl).toContain("diameter 30");
    expect(wdl).toContain("parapet_height 10");
    const out = roundTrip(wdl);
    expect(out.type).toBe("well");
    expect(out.diameter).toBe(30);
    expect(out.parapet_height).toBe(10);
  });

  it("well hook emits rotation when present", () => {
    const obj: Obj = { type: "well", name: "W", x: 0, y: 0, shape: "circular", diameter: 20, rotation: 45 };
    const wdl = emitWdl(floorConfig([obj]), "House", { emitObject: primitiveHook });
    expect(wdl).toContain("rotation 45");
    const out = roundTrip(wdl);
    expect(out.rotation).toBe(45);
  });

  it("solar_panel hook emits correct token order and round-trips", () => {
    const obj: Obj = { type: "solar_panel", name: "RoofArray", x: 210, y: 160, mount: "roof", capacity_kw: 3.5, azimuth: 180, tilt: 15 };
    const wdl = emitWdl(floorConfig([obj]), "House", { emitObject: primitiveHook });
    expect(wdl).toContain("solar_panel RoofArray at (210, 160)");
    expect(wdl).toContain("mount roof");
    expect(wdl).toContain("capacity_kw 3.5");
    expect(wdl).toContain("azimuth 180");
    const out = roundTrip(wdl);
    expect(out.type).toBe("solar_panel");
    expect(out.capacity_kw).toBe(3.5);
    expect(out.mount).toBe("roof");
    expect(out.tilt).toBe(15);
  });

  it("hook returning undefined falls through to generic ObjectDecl form", () => {
    const obj: Obj = { type: "some_other_type", name: "X", x: 0, y: 0 };
    const wdl = emitWdl(floorConfig([obj]), "House", { emitObject: primitiveHook });
    expect(wdl).toContain("some_other_type");
  });
});
