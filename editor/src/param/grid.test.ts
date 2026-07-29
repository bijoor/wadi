import { describe, it, expect } from "vitest";
import { resolveParametric } from "./resolve";
import type { HouseConfig } from "../schema/houseConfig";

// Minimal grid: X lines 1@0 2@150 3@420 ; Y lines A@0 B@160 C@470 ; wall t = 8.
// deno-lint-ignore no-explicit-any
type Any = any;
function base(objects: Any[], extra: Any = {}): HouseConfig {
  return {
    site: { reference_x: 0, reference_y: 0, plot_length: 700, plot_width: 600 },
    defaults: { wall_thickness: 8 },
    grids: {
      main: {
        x: [{ name: "1", at: 0 }, { name: "2", at: 150 }, { name: "3", at: 420 }],
        y: [{ name: "A", at: 0 }, { name: "B", at: 160 }, { name: "C", at: 470 }],
      },
    },
    floors: [{ floor_number: 1, name: "GF", objects }],
    ...extra,
  } as unknown as HouseConfig;
}
const room = (name: string, cell: Any, extra: Any = {}): Any => ({
  type: "room", name, grid: "main", cell, x: 1, y: 1, width: 1, length: 1, ...extra,
});
const obj = (config: HouseConfig, i = 0): Any => config.floors[0].objects[i] as Any;

describe("grid expansion", () => {
  it("derives room footprint from centrelines (uniform t)", () => {
    const { config, warnings } = resolveParametric(base([room("K", { x: ["1", "2"], y: ["A", "B"] })]));
    expect(warnings).toEqual([]);
    const r = obj(config);
    // x = 0 - 4 ; width = 150 + 4 + 4 ; y = 0 - 4 ; length = 160 + 4 + 4
    expect([r.x, r.y, r.width, r.length]).toEqual([-4, -4, 158, 168]);
  });

  it("adjacent rooms overlap by exactly wall_thickness on the shared line", () => {
    const { config } = resolveParametric(
      base([room("K", { x: ["1", "2"], y: ["A", "B"] }), room("L", { x: ["2", "3"], y: ["A", "B"] })]),
    );
    const k = obj(config, 0), l = obj(config, 1);
    expect(k.x + k.width).toBe(154); // K east outer face = X2 + t/2
    expect(l.x).toBe(146); // L west outer face = X2 − t/2
    expect(k.x + k.width - l.x).toBe(8); // overlap = one wall thickness
  });

  it("per-line thickness widens the footprint on that line only", () => {
    const cfg = base([room("K", { x: ["1", "2"], y: ["A", "B"] })]);
    (cfg as Any).grids.main.x[0].thickness = 16; // line "1" exterior (thicker)
    const r = obj(resolveParametric(cfg).config);
    expect(r.x).toBe(-8); // 0 − 16/2
    expect(r.width).toBe(162); // 150 + 16/2 + 8/2
  });

  it("resolves formula-driven line positions from variables", () => {
    const cfg = base([room("K", { x: ["1", "3"], y: ["A", "B"] })], { variables: { W: 600 } });
    (cfg as Any).grids.main.x[2].at = "=W";
    const { config, warnings } = resolveParametric(cfg);
    expect(warnings).toEqual([]);
    // width = (600 − 0) + 4 + 4 = 608
    expect(obj(config).width).toBe(608);
  });

  it("places a pillar centred on a node", () => {
    const { config } = resolveParametric(
      base([{ type: "pillar", name: "P", grid: "main", node: { x: "2", y: "B" }, x: 1, y: 1, width: 10, length: 10, height: 100 }]),
    );
    const p = obj(config);
    expect([p.x, p.y]).toEqual([145, 155]); // (150,160) − size/2
  });

  it("warns (never throws) on an unknown line reference", () => {
    const { warnings } = resolveParametric(base([room("K", { x: ["1", "9"], y: ["A", "B"] })]));
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("is idempotent", () => {
    const once = resolveParametric(base([room("K", { x: ["1", "2"], y: ["A", "B"] })])).config;
    const twice = resolveParametric(once).config;
    expect(obj(twice)).toEqual(obj(once));
  });
});
