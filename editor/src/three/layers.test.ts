import { describe, expect, it } from "vitest";
import { defaultLayerFor, effectiveLayers, layerGroups } from "./layers";

// Two habitable floors + a plinth floor, with a couple of objects each.
const house = {
  floors: [
    { floor_number: 0, name: "Plinth", objects: [{ type: "plinth" }, { type: "ground" }] },
    {
      floor_number: 1,
      name: "Ground Floor",
      objects: [{ type: "room" }, { type: "item" }, { type: "pillar" }, { type: "door" }],
    },
    { floor_number: 2, name: "First Floor", objects: [{ type: "room" }, { type: "item" }] },
  ],
} as never;

describe("floor-wise default layers", () => {
  it("maps object → f{floor}_{role} by role, site → plinth/ground", () => {
    expect(defaultLayerFor("room", 1)).toBe("f1_walls");
    expect(defaultLayerFor("wall", 2)).toBe("f2_walls");
    expect(defaultLayerFor("pillar", 1)).toBe("f1_structure");
    expect(defaultLayerFor("item", 2)).toBe("f2_furniture");
    expect(defaultLayerFor("door", 1)).toBe("f1_openings");
    expect(defaultLayerFor("plinth", 0)).toBe("plinth");
    expect(defaultLayerFor("ground", 0)).toBe("ground");
  });

  it("a role override redirects the default", () => {
    expect(defaultLayerFor("item", 1, { item: "structure" })).toBe("f1_structure");
  });

  it("effectiveLayers emits every floor's role sub-layers with the floor as group", () => {
    const layers = effectiveLayers(house);
    const byId = new Map(layers.map((l) => [l.id, l]));
    expect(byId.get("f1_walls")?.group).toBe("Ground Floor");
    expect(byId.get("f1_furniture")?.group).toBe("Ground Floor");
    expect(byId.get("f2_walls")?.group).toBe("First Floor");
    expect(byId.get("plinth")?.group).toBe("Site");
  });

  it("layerGroups is primary by floor (Ground Floor, First Floor, Site)", () => {
    const groups = layerGroups(house).map((g) => g.label);
    expect(groups).toContain("Ground Floor");
    expect(groups).toContain("First Floor");
    expect(groups).toContain("Site");
    // Floor groups come before Site (generation order).
    expect(groups.indexOf("Ground Floor")).toBeLessThan(groups.indexOf("Site"));
  });
});
