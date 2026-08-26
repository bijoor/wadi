import { describe, it, expect } from "vitest";
import { buildRefsView, formatRefValue } from "./refsView";
import type { HouseConfig } from "../schema/houseConfig";

describe("buildRefsView", () => {
  const config = {
    variables: { W: 300, half: "= W / 2", bad: "= nope + 1" },
    points: { House: { x: "= W", y: 460 } },
    grids: {
      main: {
        x: [{ name: "1", at: 0 }, { name: "2", at: "= W / 2" }],
        y: [{ name: "A", at: 0 }],
      },
    },
    floors: [{ name: "G", objects: [] }],
  } as unknown as HouseConfig;

  it("resolves variables with formulas + values", () => {
    const v = buildRefsView(config);
    expect(v.variables).toEqual([
      { name: "W", value: 300, formula: undefined },
      { name: "half", value: 150, formula: "= W / 2" },
      { name: "bad", value: null, formula: "= nope + 1" }, // unresolved → null
    ]);
  });

  it("resolves points to x/y", () => {
    const v = buildRefsView(config);
    expect(v.points).toEqual([{ name: "House", x: 300, y: 460 }]);
  });

  it("reconstructs grid lines from the scope (not confused with point synonyms)", () => {
    const v = buildRefsView(config);
    expect(v.grids).toHaveLength(1);
    const g = v.grids[0];
    expect(g.id).toBe("main");
    expect(g.xLines).toEqual([{ name: "1", value: 0 }, { name: "2", value: 150 }]);
    expect(g.yLines).toEqual([{ name: "A", value: 0 }]);
  });

  it("formats values: integer plain, fraction rounded, null → ⚠", () => {
    expect(formatRefValue(300)).toBe("300");
    expect(formatRefValue(150.123456)).toBe("150.123");
    expect(formatRefValue(null)).toBe("⚠");
  });

  it("handles an empty config", () => {
    expect(buildRefsView(null)).toEqual({ variables: [], points: [], grids: [] });
  });

  it("surfaces a generated guide as index-named lines within its extent", () => {
    const cfg = {
      guides: { module: { origin: [10, 0], spacing: [30, 20], extent: [3, 2] } },
      floors: [{ name: "G", objects: [] }],
    } as unknown as HouseConfig;
    const v = buildRefsView(cfg);
    const g = v.grids.find((x) => x.id === "module")!;
    expect(g.generated).toBe(true);
    expect(g.xLines).toEqual([{ name: "0", value: 10 }, { name: "1", value: 40 }, { name: "2", value: 70 }]);
    expect(g.yLines).toEqual([{ name: "0", value: 0 }, { name: "1", value: 20 }]);
  });
});
