import { describe, it, expect, afterAll } from "vitest";
import { buildSpatialModel } from "./spatialModel";
import { registerNode, getNode } from "../registry/registry";
import type { HouseObject } from "../schema/houseConfig";

// A one-floor house with a room, a wall, and two overlapping pillars.
const houseA = {
  defaults: { floor_height: 116, wall_height: 108, slab_thickness: 8 },
  floors: [
    {
      floor_number: 1,
      name: "Ground",
      objects: [
        { type: "room", name: "Hall", x: 0, y: 0, width: 200, length: 150 },
        { type: "wall", name: "W", start_x: 0, start_y: 0, end_x: 200, end_y: 0, thickness: 8 },
        { type: "pillar", name: "P1", x: 20, y: 20, width: 12, length: 12, height: 100 },
        { type: "pillar", name: "P2", x: 26, y: 26, width: 12, length: 12, height: 100 }, // overlaps P1
      ],
    },
  ],
};

describe("spatialModel — indexing + fallback footprints", () => {
  it("indexes room/wall/pillar via raw-field fallback", () => {
    const m = buildSpatialModel(houseA);
    expect(m.nodes.map((n) => n.id).sort()).toEqual(["Hall", "P1", "P2", "W"]);
    expect(m.byType("pillar").length).toBe(2);
    expect(m.onFloor(1).length).toBe(4);
    const hall = m.byType("room")[0];
    expect(hall.aabb).toEqual({ minX: 0, minY: 0, maxX: 200, maxY: 150 });
  });

  it("overlaps + overlapping detect the two pillars, not the room", () => {
    const m = buildSpatialModel(houseA);
    const [p1, p2] = m.byType("pillar");
    expect(m.overlaps(p1, p2)).toBe(true);
    expect(m.overlapping(p1, { types: ["pillar"] }).map((n) => n.id)).toEqual(["P2"]);
  });

  it("within: a pillar lies inside the room footprint", () => {
    const m = buildSpatialModel(houseA);
    const hall = m.byType("room")[0];
    const p1 = m.byType("pillar").find((n) => n.id === "P1")!;
    expect(m.within(p1, hall)).toBe(true);
  });

  it("near: finds objects within a radius of a point", () => {
    const m = buildSpatialModel(houseA);
    const hits = m.near({ x: 24, y: 24 }, 5, { types: ["pillar"] }).map((n) => n.id).sort();
    expect(hits).toEqual(["P1", "P2"]); // point sits in the overlap region
    expect(m.near({ x: 500, y: 500 }, 5).length).toBe(0);
  });

  it("onSegment: the wall's own line finds the wall", () => {
    const m = buildSpatialModel(houseA);
    const on = m.onSegment([{ x: 0, y: 0 }, { x: 200, y: 0 }], { types: ["wall"] });
    expect(on.map((n) => n.id)).toEqual(["W"]);
  });

  it("pairs(sameFloor) enumerates unordered combinations", () => {
    const m = buildSpatialModel(houseA);
    expect(m.pairs({ types: ["pillar"] }).length).toBe(1); // just [P1,P2]
  });
});

describe("spatialModel — Z bands stack per floor", () => {
  const twoFloor = {
    defaults: { floor_height: 116, wall_height: 108, slab_thickness: 8 },
    floors: [
      { floor_number: 1, name: "G", objects: [{ type: "room", name: "R1", x: 0, y: 0, width: 100, length: 100 }] },
      { floor_number: 2, name: "F", objects: [{ type: "room", name: "R2", x: 0, y: 0, width: 100, length: 100 }] },
    ],
  };

  it("plan-identical rooms on different floors do NOT overlap (z separates them)", () => {
    const m = buildSpatialModel(twoFloor);
    const r1 = m.nodes.find((n) => n.id === "R1")!;
    const r2 = m.nodes.find((n) => n.id === "R2")!;
    expect(m.distance(r1, r2)).toBe(0); // same plan footprint
    expect(m.overlaps(r1, r2)).toBe(false); // but different Z bands
    expect(r2.z.lo).toBeGreaterThanOrEqual(r1.z.hi - 1e-6); // upper floor sits above
  });
});

describe("spatialModel — facet-sourced footprint (custom primitive is queryable)", () => {
  const hadNode = !!getNode("test_wedge");
  // Register a throwaway primitive whose footprint is a TRIANGLE via footprintPoly.
  registerNode({
    type: "test_wedge",
    label: "Test Wedge",
    facets: {
      footprintPoly: (o) => {
        const x = Number(o.x) || 0;
        const y = Number(o.y) || 0;
        return [[{ x, y }, { x: x + 40, y }, { x, y: y + 40 }]];
      },
    },
  });
  afterAll(() => {
    // leave the registry as-is if it already had one; otherwise it's harmless
    // (registry is process-global in tests). No unregister API; scope is the test run.
    void hadNode;
  });

  it("indexes a custom primitive from its footprintPoly and overlaps correctly", () => {
    const cfg = {
      floors: [
        {
          floor_number: 1,
          name: "G",
          objects: [
            { type: "test_wedge", name: "Wedge", x: 0, y: 0 },
            { type: "pillar", name: "In", x: 5, y: 5, width: 4, length: 4, height: 100 }, // inside the wedge
            { type: "pillar", name: "Out", x: 30, y: 30, width: 4, length: 4, height: 100 }, // beyond the hypotenuse
          ],
        },
      ],
    };
    const m = buildSpatialModel(cfg);
    const wedge = m.byType("test_wedge")[0];
    expect(wedge).toBeDefined();
    expect(m.overlapping(wedge, { types: ["pillar"] }).map((n) => n.id)).toEqual(["In"]);
  });
});

// keep the type import referenced
export type _Obj = HouseObject;
