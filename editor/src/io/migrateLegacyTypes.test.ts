// Legacy-type migration: a retired kitchen_platform in a loaded config becomes counter
// run(s) that reproduce its geometry. See plans/parametric-furniture-elements.md (P4).

import { describe, it, expect } from "vitest";
import { kitchenPlatformToCounters, migrateLegacyTypes } from "./migrateLegacyTypes";

describe("kitchenPlatformToCounters", () => {
  it("makes one counter per polyline segment, faithful to the platform geometry", () => {
    // L-shape: (8,265)->(8,204) north, then (8,204)->(78,204) east, side left, depth 20.
    const kp = {
      type: "kitchen_platform",
      name: "K",
      path: [[8, 265], [8, 204], [78, 204]],
      side: "left",
      depth: 20,
      height: 26,
    };
    const cs = kitchenPlatformToCounters(kp);
    expect(cs).toHaveLength(2);
    // seg 1: vertical run, length 61, box centre pushed east (side left of a north seg)
    expect(cs[0]).toMatchObject({ type: "counter", x: 18, y: 234.5, rotation: 270, length: 61, depth: 20, height: 26 });
    // seg 2: horizontal run, length 70, no rotation (0 = default), pushed south
    expect(cs[1]).toMatchObject({ type: "counter", x: 43, y: 214, length: 70, depth: 20, height: 26 });
    expect(cs[1].rotation).toBeUndefined();
    // names suffixed because the platform split into >1 run
    expect(cs.map((c) => c.name)).toEqual(["K_1", "K_2"]);
  });

  it("keeps a single unsuffixed name for a one-segment platform + carries material/layer", () => {
    const cs = kitchenPlatformToCounters({
      type: "kitchen_platform", name: "Slab", path: [[10, 10], [110, 10]], side: "right",
      depth: 22, height: 36, material: "granite", layer: "structure",
    });
    expect(cs).toHaveLength(1);
    expect(cs[0].name).toBe("Slab");
    expect(cs[0]).toMatchObject({ material: "granite", layer: "structure" });
  });
});

describe("migrateLegacyTypes", () => {
  it("replaces kitchen_platform objects in place and reports the change", () => {
    const cfg = {
      floors: [{
        objects: [
          { type: "room", name: "K" },
          { type: "kitchen_platform", name: "P", path: [[0, 0], [100, 0]], side: "right", depth: 20, height: 30 },
        ],
      }],
    };
    const changed = migrateLegacyTypes(cfg);
    expect(changed).toBe(true);
    const types = (cfg.floors[0].objects as { type: string }[]).map((o) => o.type);
    expect(types).toEqual(["room", "counter"]);
  });

  it("is a no-op for a config with no legacy types", () => {
    const cfg = { floors: [{ objects: [{ type: "room" }, { type: "counter" }] }] };
    expect(migrateLegacyTypes(cfg)).toBe(false);
  });
});
