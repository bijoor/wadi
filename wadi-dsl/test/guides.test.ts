// Phase 1: `guides` (rename of `grid`) + generated mode + index references.

import { describe, it, expect } from "vitest";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";
import { resolveParametric } from "../../editor/src/param/resolve";

const HOUSE = (body: string) => `house T {
  convention center
  units feet_inches per_unit 10
${body}
}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const K = (cfg: any) => cfg.floors[0].objects.find((o: any) => o.name === "K");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolvedK = (src: string) => K(resolveParametric(compileDsl(src) as any).config as any);

describe("guides (Phase 1)", () => {
  it("generated guides: room placed by index shorthand module.x8", () => {
    const src = HOUSE(`
  guides module { spacing (30, 20) extent (10, 10) }
  floor 1 "G" {
    room K at (module.x0, module.y0) size (module.x2 - module.x0, module.y3 - module.y0) {
      wall north south east west
    }
  }`);
    const k = resolvedK(src);
    expect([k.x, k.y, k.width, k.length]).toEqual([0, 0, 60, 60]);
  });

  it("generated guides: call form module.x(expr) with fractional/negative", () => {
    const src = HOUSE(`
  guides module { spacing (30, 20) }
  floor 1 "G" {
    room K at (module.x(1.5), module.y(-1)) size (10, 10) { wall north }
  }`);
    const k = resolvedK(src);
    expect([k.x, k.y]).toEqual([45, -20]);
  });

  it("generated guides: origin offsets the family", () => {
    const src = HOUSE(`
  guides g { origin (10, 5) spacing (30, 20) }
  floor 1 "G" {
    room K at (g.x(3), g.y(2)) size (10, 10) { wall north }
  }`);
    const k = resolvedK(src);
    expect([k.x, k.y]).toEqual([100, 45]);
  });

  it("named guides via the `guides` keyword resolve by name", () => {
    const src = HOUSE(`
  guides main {
    x: 1 @ 4, 2 @ 150
    y: A @ 4, B @ 160
  }
  floor 1 "G" {
    room K at (main.x1, main.yA) size (main.x2 - main.x1, main.yB - main.yA) { wall north }
  }`);
    const k = resolvedK(src);
    expect([k.x, k.y, k.width, k.length]).toEqual([4, 4, 146, 156]);
  });

  it("the deprecated `grid` keyword still parses (alias)", () => {
    const src = HOUSE(`
  grid main {
    x: 1 @ 4, 2 @ 150
    y: A @ 4, B @ 160
  }
  floor 1 "G" {
    room K at (main.x1, main.yA) size (10, 10) { wall north }
  }`);
    expect(resolvedK(src).x).toBe(4);
  });

  it("round-trips generated guides through emit -> compile (emits `guides`)", () => {
    const src = HOUSE(`
  guides module { origin (10, 0) spacing (30, 20) extent (8, 6) }
  floor 1 "G" {
    room K at (module.x2, module.y0) size (10, 10) { wall north }
  }`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = compileDsl(src) as any;
    expect(cfg.grids.module).toEqual({ origin: [10, 0], spacing: [30, 20], extent: [8, 6] });
    const wdl = emitWdl(cfg);
    expect(wdl).toContain("guides module {");
    expect(wdl).toContain("spacing (30, 20)");
    expect(wdl).toContain("origin (10, 0)");
    expect(wdl).toContain("extent (8, 6)");
    // recompiles to the same generated guide, and the room still lands at x=70.
    const k2 = resolvedK(wdl);
    expect(k2.x).toBe(70); // 10 + 2·30
  });
});
