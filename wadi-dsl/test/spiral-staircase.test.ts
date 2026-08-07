import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";

// spiral_staircase — a PROMOTED primitive (§2.6): it graduated from the generic
// ObjectDecl path to bespoke sugar so it reads like every other primitive —
// `at (x, y)` placement + named clauses, no braces. Its `fields` still drive the
// schema/form/docs; only the DSL surface is sugared. The compiled config is the same
// shape the generic path produced, so the renderer is unchanged.

type Obj = Record<string, unknown>;
const floor0Objects = (cfg: Obj): Obj[] => ((cfg.floors as Obj[])[0].objects as Obj[]) ?? [];
const wrap = (body: string) => `house H {\nfloor 0 "G" {\n${body}\n}\n}\n`;

describe("DSL — spiral_staircase (promoted bespoke sugar)", () => {
  it("compiles the at (x,y) + named-clause form", () => {
    const cfg = compileDsl(wrap(`spiral_staircase "Stair" at (120, 120) radius 45 total_height 110 turns 1.75`));
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "spiral_staircase",
      name: "Stair",
      x: 120,
      y: 120,
      radius: 45,
      total_height: 110,
      turns: 1.75,
    });
  });

  it("carries the optional clauses", () => {
    const cfg = compileDsl(
      wrap(`spiral_staircase "S" at (10, 20) radius 30 total_height 96 steps 24 tread_thickness 2 pole_radius 3`),
    );
    expect(floor0Objects(cfg)[0]).toEqual({
      type: "spiral_staircase",
      name: "S",
      x: 10,
      y: 20,
      radius: 30,
      total_height: 96,
      steps: 24,
      tread_thickness: 2,
      pole_radius: 3,
    });
  });

  it("a clause value can be a formula", () => {
    const cfg = compileDsl(`house H {\nvar r = 20\nfloor 0 "G" {\nspiral_staircase "S" at (10, 20) radius r * 2 total_height 96\n}\n}\n`);
    expect(floor0Objects(cfg)[0]).toMatchObject({
      type: "spiral_staircase",
      radius: 0,
      formulas: { radius: "= r * 2" },
    });
  });

  it("round-trips: emit produces the bespoke form (at (…), no braces) and recompiles", () => {
    const cfg = compileDsl(
      wrap(`spiral_staircase "Stair" at (120, 120) radius 45 total_height 110 turns 1.75 z_offset 2`),
    );
    const wdl2 = emitWdl(cfg);
    expect(wdl2).toContain("spiral_staircase Stair at (120, 120)");
    expect(wdl2).toContain("radius 45");
    expect(wdl2).not.toMatch(/spiral_staircase[^\n]*\{/); // no generic block braces
    expect(floor0Objects(compileDsl(wdl2))).toEqual(floor0Objects(cfg));
  });
});
