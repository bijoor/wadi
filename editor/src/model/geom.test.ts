import { describe, it, expect } from "vitest";
import {
  rectRing,
  obbRing,
  ringsToFootprint,
  footprintsOverlap,
  footprintIntersection,
  footprintUnion,
  footprintContains,
  footprintDistance,
  pointToFootprint,
  aabbOf,
  bandsOverlap,
} from "./geom";

const fp = (...rings: ReturnType<typeof rectRing>[]) => ringsToFootprint(rings);

describe("geom — construction + AABB", () => {
  it("rectRing → footprint with the right bounding box", () => {
    const a = fp(rectRing(10, 20, 100, 40));
    expect(aabbOf(a)).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 60 });
  });

  it("obbRing at 90° swaps extents", () => {
    const a = ringsToFootprint([obbRing(0, 0, 100, 40, 90)]);
    const bb = aabbOf(a);
    expect(bb.maxX - bb.minX).toBeCloseTo(40, 6);
    expect(bb.maxY - bb.minY).toBeCloseTo(100, 6);
  });
});

describe("geom — overlap / intersection", () => {
  it("axis-aligned overlap", () => {
    const a = fp(rectRing(0, 0, 10, 10));
    const b = fp(rectRing(5, 5, 10, 10));
    expect(footprintsOverlap(a, b)).toBe(true);
    expect(footprintIntersection(a, b)!.area()).toBeCloseTo(25, 6);
  });

  it("coincident and fully-containing footprints overlap (flatten intersect degeneracy)", () => {
    const a = fp(rectRing(0, 0, 100, 100));
    expect(footprintsOverlap(a, fp(rectRing(0, 0, 100, 100)))).toBe(true); // identical
    expect(footprintsOverlap(a, fp(rectRing(20, 20, 40, 40)))).toBe(true); // b inside a
    expect(footprintsOverlap(fp(rectRing(20, 20, 40, 40)), a)).toBe(true); // a inside b
  });

  it("touching edges do NOT count as overlap", () => {
    const a = fp(rectRing(0, 0, 10, 10));
    const b = fp(rectRing(10, 0, 10, 10)); // shares the x=10 edge only
    expect(footprintsOverlap(a, b)).toBe(false);
    expect(footprintIntersection(a, b)).toBeNull();
  });

  it("rotated box overlap is exact, not bbox-based", () => {
    // Two diamonds (45°) whose bounding boxes overlap but bodies just miss.
    const a = ringsToFootprint([obbRing(0, 0, 10, 10, 45)]);
    const b = ringsToFootprint([obbRing(14, 14, 10, 10, 45)]);
    // bounding boxes touch near the corner, but the rotated bodies do not overlap
    expect(footprintsOverlap(a, b)).toBe(false);
  });

  it("trapezoid (non-box convex) overlap", () => {
    const trap = ringsToFootprint([
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 70, y: 50 },
        { x: 30, y: 50 },
      ],
    ]);
    expect(footprintsOverlap(trap, fp(rectRing(40, 10, 20, 20)))).toBe(true);
    expect(footprintsOverlap(trap, fp(rectRing(0, 45, 10, 10)))).toBe(false); // outside the slanted edge
  });
});

describe("geom — union / contains / holes", () => {
  it("union of two rects covers both", () => {
    const u = footprintUnion([fp(rectRing(0, 0, 10, 10)), fp(rectRing(10, 0, 10, 10))]);
    expect(u.area()).toBeCloseTo(200, 6);
  });

  it("contains: inner within outer, but not when it pokes out", () => {
    const outer = fp(rectRing(0, 0, 100, 100));
    expect(footprintContains(outer, fp(rectRing(10, 10, 20, 20)))).toBe(true);
    expect(footprintContains(outer, fp(rectRing(90, 90, 20, 20)))).toBe(false);
  });

  it("a ring with a hole excludes points in the hole", () => {
    // 100×100 donut with a 40×40 hole centred at (50,50)
    const donut = ringsToFootprint([rectRing(0, 0, 100, 100), rectRing(30, 30, 40, 40)]);
    expect(donut.area()).toBeCloseTo(100 * 100 - 40 * 40, 4);
    expect(pointToFootprint({ x: 5, y: 5 }, donut)).toBe(0); // in the solid ring
    expect(pointToFootprint({ x: 50, y: 50 }, donut)).toBeGreaterThan(0); // in the hole
  });
});

describe("geom — distance / point", () => {
  it("distance is 0 when overlapping, positive when apart", () => {
    const a = fp(rectRing(0, 0, 10, 10));
    expect(footprintDistance(a, fp(rectRing(5, 0, 10, 10)))).toBe(0);
    expect(footprintDistance(a, fp(rectRing(20, 0, 10, 10)))).toBeCloseTo(10, 6);
  });

  it("pointToFootprint: 0 inside, distance outside", () => {
    const a = fp(rectRing(0, 0, 10, 10));
    expect(pointToFootprint({ x: 5, y: 5 }, a)).toBe(0);
    expect(pointToFootprint({ x: 13, y: 5 }, a)).toBeCloseTo(3, 6);
  });
});

describe("geom — z bands", () => {
  it("bandsOverlap is strict (touching planes do not count)", () => {
    expect(bandsOverlap({ lo: 0, hi: 10 }, { lo: 5, hi: 15 })).toBe(true);
    expect(bandsOverlap({ lo: 0, hi: 10 }, { lo: 10, hi: 20 })).toBe(false); // stacked floors touch
    expect(bandsOverlap({ lo: 0, hi: 10 }, { lo: 11, hi: 20 })).toBe(false);
  });
});
