import { describe, expect, it } from "vitest";
import type { HouseConfig } from "../schema/houseConfig";
import {
  inferControl,
  parseTarget,
  readValue,
  resolveInputs,
  unitConv,
  writeValue,
} from "./spec";

function cfg(extra: Partial<HouseConfig> = {}): HouseConfig {
  return {
    defaults: {},
    variables: { floorH: 98, wallT: 8, bedroomWpct: 0.4 },
    points: { House: { x: 400, y: 520 } },
    floors: [{ floor_number: 0, name: "F0", objects: [] }],
    ...extra,
  } as unknown as HouseConfig;
}

describe("parseTarget", () => {
  it("treats <Point>.<W|L|X|Y|x|y> as a point coord when the point exists", () => {
    const c = cfg();
    expect(parseTarget(c, "House.W")).toEqual({ kind: "point", name: "House", coord: "x" });
    expect(parseTarget(c, "House.L")).toEqual({ kind: "point", name: "House", coord: "y" });
    expect(parseTarget(c, "House.x")).toEqual({ kind: "point", name: "House", coord: "x" });
    expect(parseTarget(c, "House.Y")).toEqual({ kind: "point", name: "House", coord: "y" });
  });
  it("treats a plain name as a variable", () => {
    expect(parseTarget(cfg(), "floorH")).toEqual({ kind: "variable", name: "floorH" });
  });
  it("falls back to variable when the dotted base is not a known point", () => {
    expect(parseTarget(cfg(), "Ghost.W")).toEqual({ kind: "variable", name: "Ghost.W" });
  });
});

describe("readValue", () => {
  it("reads a point coord and a variable", () => {
    const c = cfg();
    expect(readValue(c, "House.W")).toBe(400);
    expect(readValue(c, "House.L")).toBe(520);
    expect(readValue(c, "floorH")).toBe(98);
  });
  it("returns NaN for a formula-valued (non-literal) target", () => {
    const c = cfg({ variables: { wallC: "=2*wallT" } as unknown as HouseConfig["variables"] });
    expect(Number.isNaN(readValue(c, "wallC"))).toBe(true);
  });
});

describe("writeValue", () => {
  it("patches a point coord, preserving the other axis", () => {
    const patch = writeValue(cfg(), "House.W", 440) as { points: HouseConfig["points"] };
    expect(patch.points!.House).toEqual({ x: 440, y: 520 });
  });
  it("patches a variable, preserving the rest", () => {
    const patch = writeValue(cfg(), "floorH", 110) as { variables: HouseConfig["variables"] };
    expect(patch.variables!.floorH).toBe(110);
    expect(patch.variables!.wallT).toBe(8);
  });
});

describe("unitConv", () => {
  it("ft divides by perUnit (10u = 1ft)", () => {
    const u = unitConv("ft", 10);
    expect(u.toDisplay(400)).toBe(40);
    expect(u.toRaw(40)).toBe(400);
    expect(u.suffix).toBe("ft");
  });
  it("percent scales by 100", () => {
    const u = unitConv("percent", 10);
    expect(u.toDisplay(0.4)).toBeCloseTo(40);
    expect(u.toRaw(40)).toBeCloseTo(0.4);
    expect(u.suffix).toBe("%");
  });
  it("in converts feet-units to inches", () => {
    expect(unitConv("in", 10).toDisplay(10)).toBe(12); // 10u = 1ft = 12in
  });
  it("count/none pass through", () => {
    expect(unitConv("count", 10).toDisplay(3)).toBe(3);
    expect(unitConv("none", 10).toDisplay(3)).toBe(3);
  });
});

describe("inferControl", () => {
  const base = { target: "x", label: "X" };
  it("options → select", () => {
    expect(inferControl({ ...base, options: [{ value: 1, label: "a" }] })).toBe("select");
  });
  it("percent → slider", () => {
    expect(inferControl({ ...base, unit: "percent" })).toBe("slider");
  });
  it("min+max → slider", () => {
    expect(inferControl({ ...base, min: 0, max: 10 })).toBe("slider");
  });
  it("nothing → number", () => {
    expect(inferControl({ ...base })).toBe("number");
  });
  it("explicit control wins", () => {
    expect(inferControl({ ...base, min: 0, max: 10, control: "number" })).toBe("number");
  });
});

describe("resolveInputs", () => {
  it("normalizes inputs with unit-converted value/min/max/step", () => {
    const c = cfg({
      configurator: {
        inputs: [
          { target: "House.W", label: "Plot width", unit: "ft", min: 220, max: 400, step: 10 },
          { target: "bedroomWpct", label: "Bedroom width", unit: "percent", min: 0.3, max: 0.5, step: 0.05 },
        ],
      },
    } as unknown as Partial<HouseConfig>);
    const r = resolveInputs(c);
    expect(r.inputs).toHaveLength(2);
    const width = r.inputs[0];
    expect(width.control).toBe("slider");
    expect(width.displayValue).toBe(40);
    expect(width.displayMin).toBe(22);
    expect(width.displayMax).toBe(40);
    expect(width.displayStep).toBe(1);
    const pct = r.inputs[1];
    expect(pct.displayValue).toBeCloseTo(40);
    expect(pct.displayMin).toBeCloseTo(30);
    expect(pct.displayStep).toBeCloseTo(5);
  });
  it("is empty when there is no configurator section", () => {
    expect(resolveInputs(cfg()).inputs).toEqual([]);
  });
});
