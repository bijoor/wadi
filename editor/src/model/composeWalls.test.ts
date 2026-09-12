import { describe, expect, it } from "vitest";
import { composeWalls, composedPoche, composedFloorInputs, type WallInput, type RoomRect, type PocheShape } from "./composeWalls";

const T = 8;
const H = 90;
// The four edges of a room rectangle as wall centrelines (center convention).
function ring(x: number, y: number, w: number, l: number, t = T, h = H): WallInput[] {
  return [
    { sx: x, sy: y, ex: x + w, ey: y, thickness: t, height: h },         // N
    { sx: x, sy: y + l, ex: x + w, ey: y + l, thickness: t, height: h }, // S
    { sx: x, sy: y, ex: x, ey: y + l, thickness: t, height: h },         // W
    { sx: x + w, sy: y, ex: x + w, ey: y + l, thickness: t, height: h }, // E
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
    expect(sum(brick)).toBeCloseTo(2 * (208 + 248), -1); // ~±2u from the union grow
  });
  it("leaves the inner faces interior (interior length = inner perimeter)", () => {
    // inner cavity is (w-t) x (l-t): 192 x 232 → perimeter 848
    expect(sum(interior)).toBeCloseTo(2 * (192 + 232), -1); // ~±2u from the union grow
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
    expect(sum(brick)).toBeCloseTo(2 * (368 + 248), -1); // ~±2u from the union grow
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

describe("composedFloorInputs — per-wall height sourcing", () => {
  it("reads room.wall_heights[side] (a parapet/verandah override), else room.height, else floor height", () => {
    const objects = [{
      type: "room", name: "Verandah", x: 0, y: 0, width: 200, length: 100,
      height: 30, // room-level height
      walls: ["north", "east", "west"],
      wall_heights: { north: { height: 18 } }, // north override
    }];
    const { walls } = composedFloorInputs(objects, T, 90);
    const byDir = (sx: number, sy: number, ex: number, ey: number) =>
      walls.find((w) => w.sx === sx && w.sy === sy && w.ex === ex && w.ey === ey);
    // north centreline at y = t/2 = 4, spanning x 0..200 → height 18 (override)
    expect(byDir(0, 4, 200, 4)?.height).toBe(18);
    // east/west inherit the room height 30 (no per-side override)
    expect(walls.filter((w) => w.height === 30).length).toBe(2);
    expect(walls.some((w) => w.height === 90)).toBe(false); // floor default unused here
  });
  it("a plain room (no height) uses the floor wall height", () => {
    const { walls } = composedFloorInputs([{ type: "room", name: "R", x: 0, y: 0, width: 100, length: 100 }], T, 96);
    expect(walls.every((w) => w.height === 96)).toBe(true);
  });
});

describe("composeWalls — collinear same-thickness walls split by height", () => {
  // Two end-to-end collinear runs on y=0, same thickness, heights 90 and 30.
  const walls: WallInput[] = [
    { sx: 0, sy: 0, ex: 100, ey: 0, thickness: T, height: 90 },
    { sx: 100, sy: 0, ex: 200, ey: 0, thickness: T, height: 30 },
  ];
  const r = composeWalls(walls, []);

  it("produces one group per distinct height (not one merged block)", () => {
    expect(r.groups.length).toBe(2);
    expect(r.groups.map((g) => g.height).sort((a, b) => a - b)).toEqual([30, 90]);
  });
  it("each group's edges carry that group's height", () => {
    for (const g of r.groups) {
      expect(g.edges.every((e) => e.height === g.height)).toBe(true);
      expect(g.poche.area()).toBeGreaterThan(0);
    }
  });
  it("the full poché still merges both runs (height-agnostic, for the 2D plan)", () => {
    // one continuous run 0..200, so its bbox spans the full length
    const box = r.poche.box;
    expect(box.xmax - box.xmin).toBeGreaterThan(199);
  });
  it("same-height collinear walls stay a single group", () => {
    const same = composeWalls([
      { sx: 0, sy: 0, ex: 100, ey: 0, thickness: T, height: 90 },
      { sx: 100, sy: 0, ex: 200, ey: 0, thickness: T, height: 90 },
    ], []);
    expect(same.groups.length).toBe(1);
    expect(same.groups[0].height).toBe(90);
  });
});

describe("composeWalls — diagonal wall composes the same way (angle-agnostic)", () => {
  it("produces a poché and classifies its edges", () => {
    const r = composeWalls([{ sx: 0, sy: 0, ex: 100, ey: 100, thickness: T, height: H }], []);
    expect(r.poche.area()).toBeGreaterThan(0);
    expect(r.edges.every((e) => e.brick)).toBe(true); // no rooms → all exposed
  });
});

// Net poché area of a set of shapes (outer rings minus holes), via shoelace.
function ringArea(pts: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
}
function pocheArea(shapes: PocheShape[]): number {
  return shapes.reduce((s, sh) => s + ringArea(sh.outer) - sh.holes.reduce((h, r) => h + ringArea(r), 0), 0);
}

describe("composedPoche — 2D plan poché from the union boundary", () => {
  it("a single room is a hollow ring: one outer contour with one room-cavity hole", () => {
    const shapes = composedPoche([{ type: "room", name: "R", x: 0, y: 0, width: 200, length: 160 }], T);
    expect(shapes.length).toBe(1);
    expect(shapes[0].holes.length).toBe(1);
    // wall poché area ≈ outer footprint − inner cavity (ring of ~one thickness).
    // outer ≈ 208×168, inner ≈ 192×152 → ~35k − ~29k ≈ 6k (GROW inflates slightly).
    expect(pocheArea(shapes)).toBeGreaterThan(4000);
    expect(pocheArea(shapes)).toBeLessThan(9000);
  });

  it("a gap notches the poché (less wall area than the same room with no gap)", () => {
    const solid = composedPoche([{ type: "room", name: "R", x: 0, y: 0, width: 200, length: 160 }], T);
    const withGap = composedPoche([
      { type: "room", name: "R", x: 0, y: 0, width: 200, length: 160 },
      { type: "gap", name: "G", x: 80, y: 160 - T, width: 40, direction: "south" },
    ], T);
    expect(pocheArea(withGap)).toBeLessThan(pocheArea(solid));
  });

  it("a door does NOT notch the poché (doors are drawn as symbols on top)", () => {
    const solid = composedPoche([{ type: "room", name: "R", x: 0, y: 0, width: 200, length: 160 }], T);
    const withDoor = composedPoche([
      { type: "room", name: "R", x: 0, y: 0, width: 200, length: 160 },
      { type: "door", name: "D", x: 80, y: 160 - T, width: 40, height: 84, direction: "south" },
    ], T);
    expect(pocheArea(withDoor)).toBeCloseTo(pocheArea(solid), -1);
  });

  it("no walls → no shapes", () => {
    expect(composedPoche([], T)).toEqual([]);
  });
});
