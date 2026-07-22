import { describe, it, expect } from "vitest";
import { expandStaircase } from "./stairExpand";

type Obj = { type: string; [k: string]: unknown };
type Dir = "north" | "south" | "east" | "west";
const DV: Record<Dir, [number, number]> = {
  south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0],
};

// rise_height 90 / step_rise 5 → 18 RISERS.
const base = (over: Partial<Obj> = {}): Obj => ({
  type: "staircase", name: "Stair",
  start_x: 100, start_y: 50,
  rise_height: 90, step_rise: 5, step_tread: 10, step_width: 30,
  direction: "south",
  ...over,
});
const expand = (over: Partial<Obj> = {}, slab = 8, below = 100) =>
  expandStaircase(base(over), slab, below);

const stairs = (o: Obj[]) => o.filter((x) => x.type === "staircase");
const landings = (o: Obj[]) => o.filter((x) => x.type === "floor_slab");
const treads = (o: Obj[]) => stairs(o).reduce((a, s) => a + (s.num_steps as number), 0);

// bounding rectangle of every object (treads + landings) in plan
function bbox(o: Obj[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of o as any[]) {
    let pts: number[][];
    if (s.type === "staircase") {
      const [vx, vy] = DV[s.direction as Dir];
      const r = s.num_steps * s.step_tread, w = s.step_width;
      const ns = s.direction === "north" || s.direction === "south";
      pts = [[s.start_x, s.start_y], [s.start_x + (ns ? w : r * vx), s.start_y + (ns ? r * vy : w)]];
    } else pts = [[s.x, s.y], [s.x + s.width, s.y + s.length]];
    for (const [px, py] of pts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  }
  return { x0, x1, y0, y1 };
}
// signed run extent [lo,hi] measured from (sx,sy) along +direction
function runExtent(o: Obj[], dir: Dir, sx: number, sy: number): [number, number] {
  const [vx, vy] = DV[dir];
  const b = bbox(o);
  const ds = [b.x0, b.x1].flatMap((px) => [b.y0, b.y1].map((py) => (px - sx) * vx + (py - sy) * vy));
  return [Math.min(...ds), Math.max(...ds)];
}
const treadLevels = (o: Obj[]) =>
  stairs(o).flatMap((s: any) =>
    Array.from({ length: s.num_steps }, (_, i) => +(s.z_offset + (i + 1) * s.step_rise).toFixed(4)));
const platformLevels = (o: Obj[], floorTop: number, floorBottom: number) => [
  floorTop, floorBottom, ...landings(o).map((l: any) => +(l.z_offset + l.thickness).toFixed(4)),
];

describe("expandStaircase", () => {
  it("single flight: R risers → R−1 treads, top tread a riser below the floor", () => {
    const out = expand();
    expect(out).toHaveLength(1);
    expect(out[0].num_steps).toBe(17);
    expect("rise_height" in out[0]).toBe(false);
    const lv = treadLevels(out);
    expect(Math.max(...lv)).toBe(8 - 5);          // top tread a riser below the floor
    expect(Math.min(...lv)).toBe(8 - 90 + 5);     // bottom tread a riser above the floor below
  });

  it("rise_height defaults to the floor-below height when omitted", () => {
    const out = expandStaircase(base({ rise_height: undefined }), 8, 100);
    expect(out[0].num_steps).toBe(19); // 20 risers − 1
  });

  it("descends from the top INTO `direction`, within [start, start+max_run]", () => {
    for (const direction of ["south", "north", "east", "west"] as const) {
      const out = expand({ max_run: 60, direction });
      const [lo, hi] = runExtent(out, direction, 100, 50);
      expect(lo).toBeGreaterThanOrEqual(-0.01);   // never behind the start point
      expect(hi).toBeLessThanOrEqual(60 + 0.01);  // never past the allocated box
    }
  });

  it("a single flight also extends forward from the start (not behind it)", () => {
    const [lo, hi] = runExtent(expand(), "south", 100, 50);
    expect(lo).toBeGreaterThanOrEqual(-0.01);
    expect(hi).toBeGreaterThan(0);
  });

  it("adds more flights when the allocated run is tight", () => {
    const wide = stairs(expand({ max_run: 100 })).length;
    const tight = stairs(expand({ max_run: 40 })).length;
    expect(tight).toBeGreaterThan(wide);
    // both still fit their box
    for (const [mr] of [[100], [40]] as const) {
      const [, hi] = runExtent(expand({ max_run: mr }), "south", 100, 50);
      expect(hi).toBeLessThanOrEqual(mr + 0.01);
    }
  });

  it("conserves the total climb: treads = risers − numFlights", () => {
    const out = expand({ max_run: 100 });
    expect(treads(out)).toBe(18 - stairs(out).length);
  });

  it("no tread coincides with the floor or any landing", () => {
    for (const mr of [undefined, 100, 60, 40] as const) {
      const out = expand(mr ? { max_run: mr } : {});
      const lv = treadLevels(out);
      const plat = platformLevels(out, 8, 8 - 90);
      expect(lv.filter((z) => plat.some((p) => Math.abs(z - p) < 1e-6))).toEqual([]);
    }
  });

  it("explicit z_offset sets the TOP (floor) height", () => {
    const out = expand({ z_offset: 50 });
    expect(Math.max(...treadLevels(out))).toBe(50 - 5);
  });

  it("flight_gap widens the landings to bridge the void", () => {
    const out = expand({ max_run: 100, flight_gap: 12 });
    for (const l of landings(out)) expect(l.width).toBe(72); // 2×30 + 12
  });

  it("turn mirrors the return lane (opposite handedness)", () => {
    const cw = bbox(expand({ max_run: 100, turn: "clockwise" }));
    const ccw = bbox(expand({ max_run: 100, turn: "anticlockwise" }));
    // mirror images across the anchored flight's lateral centre (start_x+width/2)
    const mid2 = 2 * (100 + 30 / 2);
    expect(cw.x0 + ccw.x1).toBeCloseTo(mid2, 3);
    expect(cw.x1 + ccw.x0).toBeCloseTo(mid2, 3);
    // and they are an actual mirror, not identical
    expect(cw.x0).not.toBeCloseTo(ccw.x0, 3);
  });
});
