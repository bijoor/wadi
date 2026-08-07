import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

// P3 (§2.6): the generic `ObjectDecl` grammar path — any primitive expressible by
// name with no bespoke grammar rule (the framework path a contributed primitive
// like gizmo rides). Proves parse→compile, formula/string handling,
// the shared common tail, and compile→emit→recompile round-trip.

type Obj = Record<string, unknown>;
const floor0Objects = (cfg: Obj): Obj[] =>
  ((cfg.floors as Obj[])[0].objects as Obj[]) ?? [];

// A `.wdl` whose only floor object is a generic (un-sugared) type.
const wrap = (body: string, head = "") =>
  `house Generic {\n${head}floor 0 "G" {\n${body}\n}\n}\n`;

describe("DSL — generic ObjectDecl (P3, §2.6)", () => {
  it("compiles `type name { key value } common` to a flat object", () => {
    const cfg = compileDsl(
      wrap(`gizmo "S1" { turns 3 radius 12 spin 1 } z_offset 5 enabled 1 layer "Stairs"`),
    );
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "gizmo",
      name: "S1",
      turns: 3,
      radius: 12,
      spin: 1,
      z_offset: 5,
      enabled: 1,
      layer: "Stairs",
    });
  });

  it("string field values compile as strings; x/y keys are allowed bare", () => {
    const cfg = compileDsl(wrap(`gizmo { x 10 y 20 finish "matte" }`));
    expect(floor0Objects(cfg)[0]).toEqual({ type: "gizmo", x: 10, y: 20, finish: "matte" });
  });

  it("non-literal field values become a placeholder + a formula entry", () => {
    const cfg = compileDsl(wrap(`gizmo "S" { radius r * 2 treads 8 }`, "var r = 5\n"));
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "gizmo",
      name: "S",
      radius: 0,
      treads: 8,
      formulas: { radius: "= r * 2" },
    });
  });

  it("round-trips: compile → emit → recompile is identical", () => {
    const cfg = compileDsl(
      wrap(`gizmo "S1" { turns 3 radius 12 } z_offset 2 enabled 0`),
    );
    const wdl2 = emitWdl(cfg);
    // The generic path, not the raw JSON escape.
    expect(wdl2).toContain("gizmo");
    expect(wdl2).not.toContain("raw ");
    expect(floor0Objects(compileDsl(wdl2))).toEqual(floor0Objects(cfg));
  });

  it("a formula field round-trips through the generic emit", () => {
    const cfg = compileDsl(wrap(`gizmo "S" { radius r * 2 }`, "var r = 5\n"));
    const wdl2 = emitWdl(cfg);
    expect(floor0Objects(compileDsl(wdl2))).toEqual(floor0Objects(cfg));
  });

  it("a still-reserved keyword field survives via a quoted key", () => {
    // `rotation` is a grammar keyword NOT in FieldKey's bare set → must be quoted.
    // (Common dimension/placement keywords like `height`/`total_height`/`material`
    // ARE bare-allowed — see the named-parameters test in generic-descriptor.)
    const cfg = compileDsl(wrap(`gizmo { "rotation" 5 finish "matte" }`));
    expect(floor0Objects(cfg)[0]).toEqual({ type: "gizmo", rotation: 5, finish: "matte" });
    // …and the emitter quotes the reserved key back.
    const wdl2 = emitWdl(cfg);
    expect(wdl2).toContain('"rotation" 5');
    expect(floor0Objects(compileDsl(wdl2))).toEqual(floor0Objects(cfg));
  });

  it("a non-scalar (nested) field falls back to the raw JSON escape on emit", () => {
    // Start from a real compiled house so the top-level shape is exact, then inject
    // an object whose field is a nested array (not expressible generically).
    const cfg = compileDsl(wrap(`gizmo { x 1 y 2 }`));
    floor0Objects(cfg)[0] = { type: "weird", segments: [{ a: 1 }] };
    const wdl2 = emitWdl(cfg);
    expect(wdl2).toContain("raw ");
    expect(floor0Objects(compileDsl(wdl2))).toEqual(floor0Objects(cfg));
  });
});
