import { describe, expect, it } from "vitest";
import { summarizeStaircase } from "./stairSummary";

// A box-model staircase (DSL `size (w,l)` form) climbing one 96-unit floor with
// 6-unit risers → 16 steps, 10-unit treads, 100-wide box.
const stair = (length: number, extra: Record<string, unknown> = {}) => ({
  type: "staircase",
  name: "Stair",
  start_x: 0,
  start_y: 0,
  width: 100,
  length,
  direction: "south",
  climb: "up",
  step_rise: 6,
  step_tread: 10,
  ...extra,
});
const ctx = { slabThickness: 0, floorBelowHeight: 96, floorOwnHeight: 96 };

describe("summarizeStaircase", () => {
  it("a long box fits a single straight flight", () => {
    const s = summarizeStaircase(stair(300), ctx);
    expect(s.numFlights).toBe(1);
    expect(s.totalSteps).toBe(16);
    expect(s.boxModel).toBe(true);
    expect(s.error).toBeUndefined();
  });

  it("a short box is forced into a switchback with more flights", () => {
    const s = summarizeStaircase(stair(160), ctx);
    expect(s.numFlights).toBeGreaterThan(2);
    // The arrival landing is reported in world coordinates with an egress facing.
    expect(s.arrival).not.toBeNull();
    expect(["north", "south", "east", "west"]).toContain(s.arrival!.facing);
  });

  it("reports the min box length for 1 and 2 flights, and 2 needs less than 1", () => {
    const s = summarizeStaircase(stair(160), ctx);
    expect(s.minBoxLengthFor1).toBeGreaterThan(s.minBoxLengthFor2!);
    // Enlarging the box to minBoxLengthFor2 should actually yield <= 2 flights.
    const enlarged = summarizeStaircase(stair(s.minBoxLengthFor2!), ctx);
    expect(enlarged.numFlights).toBeLessThanOrEqual(2);
  });

  it("carries direction and climb through", () => {
    const s = summarizeStaircase(stair(160, { direction: "east", climb: "down" }), ctx);
    expect(s.direction).toBe("east");
    expect(s.climb).toBe("down");
    expect(s.runAxis).toBe("x");
  });
});
