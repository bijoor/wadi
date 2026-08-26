import { describe, it, expect } from "vitest";
import { resolveParametric } from "./resolve";
import type { HouseConfig } from "../schema/houseConfig";

// deno-lint-ignore no-explicit-any
type Any = any;
const room = (name: string, formulas: Any): Any => ({
  type: "room", name, x: 0, y: 0, width: 1, length: 1, formulas,
});
function house(objects: Any[], extra: Any = {}): HouseConfig {
  return {
    site: { reference_x: 0, reference_y: 0, plot_length: 400, plot_width: 400 },
    defaults: { wall_thickness: 8 },
    floors: [{ floor_number: 1, name: "GF", objects }],
    ...extra,
  } as unknown as HouseConfig;
}
const find = (c: Any, n: string): Any => {
  for (const fl of c.floors) for (const o of fl.objects) if (o.name === n) return o;
};
const resolved = (c: HouseConfig): Any => resolveParametric(c).config;

describe("generated guides", () => {
  it("ref shorthand module.x8 = origin + index · spacing", () => {
    const cfg = house(
      [room("K", {
        x: "= module.x0", y: "= module.y0",
        width: "= module.x2 - module.x0", length: "= module.y3 - module.y0",
      })],
      { guides: { module: { spacing: [30, 20] } } },
    );
    const k = find(resolved(cfg), "K");
    expect([k.x, k.y, k.width, k.length]).toEqual([0, 0, 60, 60]);
  });

  it("call form module.x(expr) handles fractional & negative indices", () => {
    const cfg = house(
      [room("K", { x: "= module.x(1.5)", y: "= module.y(-1)" })],
      { guides: { module: { spacing: [30, 20] } } },
    );
    const k = find(resolved(cfg), "K");
    expect([k.x, k.y]).toEqual([45, -20]);
  });

  it("honours origin and a spacing formula over a variable", () => {
    const cfg = house(
      [room("K", { x: "= g.x(3)", y: "= g.y(2)" })],
      { variables: { mod: 25 }, guides: { g: { origin: [10, 5], spacing: ["= mod", 20] } } },
    );
    const k = find(resolved(cfg), "K");
    expect([k.x, k.y]).toEqual([10 + 3 * 25, 5 + 2 * 20]); // [85, 45]
  });

  it("a named guide can be placed ON a generated guide", () => {
    const cfg = house(
      [room("K", { x: "= main.x2" })],
      {
        guides: {
          module: { spacing: [30, 20] },
          main: {
            x: [{ name: "1", at: 0 }, { name: "2", at: "= module.x(4)" }],
            y: [{ name: "A", at: 0 }, { name: "B", at: 10 }],
          },
        },
      },
    );
    expect(find(resolved(cfg), "K").x).toBe(120); // module.x(4) = 4·30
  });

  it("still resolves a named grid under the deprecated `grids` key", () => {
    const cfg = house(
      [room("K", { x: "= main.x1", width: "= main.x2 - main.x1" })],
      { grids: { main: {
        x: [{ name: "1", at: 4 }, { name: "2", at: 150 }],
        y: [{ name: "A", at: 4 }, { name: "B", at: 160 }],
      } } },
    );
    const k = find(resolved(cfg), "K");
    expect([k.x, k.width]).toEqual([4, 146]);
  });

  it("merges guides + grids together", () => {
    const cfg = house(
      [room("K", { x: "= module.x2", y: "= main.yA" })],
      {
        grids: { main: { x: [{ name: "1", at: 0 }, { name: "2", at: 5 }], y: [{ name: "A", at: 7 }, { name: "B", at: 17 }] } },
        guides: { module: { spacing: [30, 20] } },
      },
    );
    const k = find(resolved(cfg), "K");
    expect([k.x, k.y]).toEqual([60, 7]);
  });

  it("an out-of-nowhere generated ref errors cleanly (unknown accessor)", () => {
    const cfg = house(
      [room("K", { x: "= nope.x2" })],
      { guides: { module: { spacing: [30, 20] } } },
    );
    const { warnings } = resolveParametric(cfg);
    expect(warnings.some((w) => /unknown or unresolved 'nope\.x2'/.test(w.message))).toBe(true);
  });
});
