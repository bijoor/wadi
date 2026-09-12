import { describe, expect, it } from "vitest";
import { composeWalls, type WallInput, type RoomRect } from "./composeWalls";

const T = 8;
// The four edges of a room rectangle as wall centrelines (center convention).
function ring(x: number, y: number, w: number, l: number, t = T): WallInput[] {
  return [
    { sx: x, sy: y, ex: x + w, ey: y, thickness: t },         // N
    { sx: x, sy: y + l, ex: x + w, ey: y + l, thickness: t }, // S
    { sx: x, sy: y, ex: x, ey: y + l, thickness: t },         // W
    { sx: x + w, sy: y, ex: x + w, ey: y + l, thickness: t }, // E
  ];
}
const len = (e: { a: { x: number; y: number }; b: { x: number; y: number } }) =>
  Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
const sum = (es: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>) =>
  es.reduce((s, e) => s + len(e), 0);

describe("composeWalls — single room", () => {
  const r = composeWalls(ring(4, 4, 200, 240), [{ x: 4, y: 4, w: 200, l: 240 }]);
  const brick = r.edges.filter((e) => e.brick);
  const interior = r.edges.filter((e) => !e.brick);

  it("bricks the outer faces (brick length = outer perimeter)", () => {
    // outer rect is (w+t) x (l+t): 208 x 248 → perimeter 912
    expect(sum(brick)).toBeCloseTo(2 * (208 + 248), 0);
  });
  it("leaves the inner faces interior (interior length = inner perimeter)", () => {
    // inner cavity is (w-t) x (l-t): 192 x 232 → perimeter 848
    expect(sum(interior)).toBeCloseTo(2 * (192 + 232), 0);
  });
  it("every brick edge faces away from the room", () => {
    for (const e of brick) {
      const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
      // outward probe lands outside the room footprint
      const px = mid.x + e.outward.x * 3, py = mid.y + e.outward.y * 3;
      const inRoom = px > 4 && px < 204 && py > 4 && py < 244;
      expect(inRoom).toBe(false);
    }
  });
});

describe("composeWalls — two abutting rooms (shared wall merges, no double)", () => {
  const A = ring(4, 4, 200, 240);          // east edge at x=204
  const B = ring(204, 4, 160, 240);         // west edge at x=204 (coincident)
  const rooms: RoomRect[] = [{ x: 4, y: 4, w: 200, l: 240 }, { x: 204, y: 4, w: 160, l: 240 }];
  const r = composeWalls([...A, ...B], rooms);
  const brick = r.edges.filter((e) => e.brick);

  it("bricks only the combined outer perimeter", () => {
    // combined footprint 360 wide → outer 368 x 248 → perimeter 1232
    expect(sum(brick)).toBeCloseTo(2 * (368 + 248), 0);
  });
  it("the shared wall is interior on both long faces (no vertical brick at the shared centreline)", () => {
    // the shared wall's long faces are VERTICAL at x≈200 and x≈208; neither may
    // be brick. (Horizontal exterior N/S faces crossing x=204 are legitimately
    // brick and are excluded by the vertical filter.)
    const verticalOnShared = brick.filter((e) => {
      const mx = (e.a.x + e.b.x) / 2;
      const dx = Math.abs(e.b.x - e.a.x), dy = Math.abs(e.b.y - e.a.y);
      return dy > dx && mx > 199 && mx < 209;
    });
    expect(verticalOnShared.length).toBe(0);
  });
});

describe("composeWalls — corner of two exterior walls (white-column fix)", () => {
  const r = composeWalls(
    [
      { sx: 0, sy: 0, ex: 100, ey: 0, thickness: T },
      { sx: 0, sy: 0, ex: 0, ey: 100, thickness: T },
    ],
    [], // no rooms → everything is exposed
  );
  it("bricks every face including the corner (no interior verdict at the join)", () => {
    expect(r.edges.length).toBeGreaterThan(0);
    expect(r.edges.every((e) => e.brick)).toBe(true);
  });
});

describe("composeWalls — diagonal wall composes the same way (angle-agnostic)", () => {
  it("produces a poché and classifies its edges", () => {
    const r = composeWalls([{ sx: 0, sy: 0, ex: 100, ey: 100, thickness: T }], []);
    expect(r.poche.area()).toBeGreaterThan(0);
    expect(r.edges.every((e) => e.brick)).toBe(true); // no rooms → all exposed
  });
});
