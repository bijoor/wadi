import { describe, it, expect } from "vitest";
import { resolveParametric } from "./resolve";
import { expandRoomWalls } from "../svg2d/expand";
import type { HouseConfig } from "../schema/houseConfig";

// deno-lint-ignore no-explicit-any
type Any = any;
const room = (name: string, x: number, y: number, w: number, l: number, extra: Any = {}): Any =>
  ({ type: "room", name, x, y, width: w, length: l, ...extra });
function house(objects: Any[], extra: Any = {}): HouseConfig {
  return {
    site: { reference_x: 0, reference_y: 0, plot_length: 400, plot_width: 400 },
    defaults: { wall_thickness: 8 },
    floors: [{ floor_number: 1, name: "GF", objects }],
    ...extra,
  } as unknown as HouseConfig;
}
const find = (c: Any, n: string): Any => {
  for (const fl of c.floors) for (const o of fl.objects) if (o.name === n) return o;
};

describe("centreline convention + grid symbols", () => {
  it("a centreline config expands to the SAME outer footprint as the overlap equivalent", () => {
    // OUTER (legacy): two rooms overlap by t=8 on the shared wall.
    const outer = expandRoomWalls(house([room("A", 0, 0, 150, 160), room("B", 142, 0, 158, 160)]));
    // CENTRE (new): the same rooms authored at wall centrelines — they ABUT, no overlap.
    const centre = expandRoomWalls(
      house([room("A", 4, 4, 142, 152), room("B", 146, 4, 150, 152)], { coord_convention: "center" }),
    );
    for (const n of ["A", "B"]) {
      const a = find(outer, n), c = find(centre, n);
      expect([c.x, c.y, c.width, c.length]).toEqual([a.x, a.y, a.width, a.length]);
    }
  });

  it("publishes grid line positions as formula symbols (main.x1 / main.yA)", () => {
    const cfg = house(
      [room("K", 1, 1, 1, 1, {
        formulas: { x: "= main.x1", y: "= main.yA", width: "= main.x2 - main.x1", length: "= main.yB - main.yA" },
      })],
      { grids: { main: { x: [{ name: "1", at: 4 }, { name: "2", at: 150 }], y: [{ name: "A", at: 4 }, { name: "B", at: 160 }] } } },
    );
    const r = resolveParametric(cfg).config as Any;
    const k = find(r, "K");
    expect([k.x, k.y, k.width, k.length]).toEqual([4, 4, 146, 156]);
  });

  it("grid line `at` may be a formula of House/knobs", () => {
    const cfg = house(
      [room("K", 1, 1, 1, 1, { formulas: { width: "= main.x2 - main.x1" } })],
      {
        variables: { wallT: 8 },
        points: { House: { x: 300, y: 400 } },
        grids: { main: { x: [{ name: "1", at: "= wallT / 2" }, { name: "2", at: "= House.W - wallT / 2" }], y: [{ name: "A", at: 0 }, { name: "B", at: 1 }] } },
      },
    );
    const r = resolveParametric(cfg).config as Any;
    expect(find(r, "K").width).toBe(292); // (300-4) - 4
  });

  it("in center mode a pillar's x/y is its CENTRE (dropped on the grid node)", () => {
    // A 10×10 column authored at grid node (x1=100, yA=200) must render with its
    // top-left at (95, 195) — centred on the node — and keep its physical size.
    const p = (extra: Any = {}): Any => ({ type: "pillar", name: "P", x: 100, y: 200, width: 10, length: 10, height: 100, ...extra });
    const centred = find(expandRoomWalls(house([p()], { coord_convention: "center" })), "P");
    expect([centred.x, centred.y, centred.width, centred.length]).toEqual([95, 195, 10, 10]);
    // Outer mode leaves the pillar's top-left corner exactly as authored.
    const outer = find(expandRoomWalls(house([p()])), "P");
    expect([outer.x, outer.y]).toEqual([100, 200]);
  });

  it("default (outer) convention leaves footprints unchanged on expand", () => {
    const a = find(expandRoomWalls(house([room("A", 0, 0, 150, 160)])), "A");
    expect([a.x, a.y, a.width, a.length]).toEqual([0, 0, 150, 160]);
  });
});
