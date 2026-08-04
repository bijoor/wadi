import { describe, expect, it } from "vitest";
import { anchorItem, anchorFacing } from "./furnitureAnchor";
import { expandRoomWalls } from "./expand";

// Room 200×300 at origin, wallT 8 → inner FACE inset = full wallT = 8 → [8,8]..[192,292].
// Bed 1.5×2.0 m footprint; default units (feet_inches/per_unit=10) → 32.808 units/m,
// so fw = 49.21 (X), fd = 65.62 (Y); half-extents 24.606 × 32.808 at rotation 0.
const rect = { x: 0, y: 0, w: 200, l: 300 };
const bed = { dimensions: [1.5, 0.5, 2.0] as [number, number, number] };

describe("anchorItem (room-relative furniture anchoring)", () => {
  it("top-center hugs the inner face of the north wall, centred horizontally", () => {
    const p = anchorItem(rect, { ...bed, anchor: "top-center" }, 8);
    expect(p.x).toBeCloseTo(100, 2);
    expect(p.y).toBeCloseTo(40.808, 2); // iy0(8) + halfY(32.808)
  });

  it("top-left corner with a per-axis gap clears each wall", () => {
    const p = anchorItem(rect, { ...bed, anchor: "top-left", gapX: 5, gapY: 5 }, 8);
    expect(p.x).toBeCloseTo(37.606, 2); // 8 + 24.606 + 5
    expect(p.y).toBeCloseTo(45.808, 2); // 8 + 32.808 + 5
  });

  it("bottom-right corner", () => {
    const p = anchorItem(rect, { ...bed, anchor: "bottom-right" }, 8);
    expect(p.x).toBeCloseTo(167.394, 2); // 192 - 24.606
    expect(p.y).toBeCloseTo(259.192, 2); // 292 - 32.808
  });

  it("center sits at the room centre", () => {
    const p = anchorItem(rect, { ...bed, anchor: "center" }, 8);
    expect(p.x).toBeCloseTo(100, 2);
    expect(p.y).toBeCloseTo(150, 2);
  });

  it("uses the rotated footprint so a turned piece still clears the wall", () => {
    // rotation 90° swaps the half-extents: halfY becomes fw/2 = 24.606.
    const p = anchorItem(rect, { ...bed, anchor: "top-center", rotation: 90 }, 8);
    expect(p.y).toBeCloseTo(32.606, 2); // 8 + 24.606
  });

  it("follows a room resize (anchor recomputes)", () => {
    const small = anchorItem({ x: 0, y: 0, w: 200, l: 300 }, { ...bed, anchor: "top-center" }, 8);
    const large = anchorItem({ x: 0, y: 0, w: 400, l: 300 }, { ...bed, anchor: "top-center" }, 8);
    expect(large.x).toBeCloseTo(200, 2); // centre tracks the wider room
    expect(large.y).toBeCloseTo(small.y, 2); // still hugging the north wall
  });
});

describe("furniture anchoring through expandRoomWalls", () => {
  const asset = { id: "b", src: "/f/b.glb", dimensions: [1.5, 0.5, 2.0] };

  it("flattens a room's nested items into anchored top-level items", () => {
    const cfg = {
      site: { plot_width: 500, plot_length: 500 },
      floors: [
        {
          floor_number: 1,
          name: "GF",
          objects: [
            {
              type: "room",
              name: "Bedroom",
              x: 0,
              y: 0,
              width: 200,
              length: 300,
              items: [{ name: "Bed", asset, anchor: "top-center" }],
            },
          ],
        },
      ],
    } as never;
    const out = expandRoomWalls(cfg, 8, { lenient: true });
    const objs = out.floors[0].objects as Array<Record<string, unknown>>;
    const bedItem = objs.find((o) => o.type === "item" && o.name === "Bed")!;
    expect(bedItem).toBeTruthy();
    expect(bedItem.x).toBeCloseTo(100, 2);
    expect(bedItem.y).toBeCloseTo(40.808, 2);
    // The room no longer carries nested items.
    const roomObj = objs.find((o) => o.type === "room")!;
    expect(roomObj.items).toBeUndefined();
  });

  it("resolves a nested item's = formula fields (rotation/scale/gap) at expand", () => {
    const cfg = {
      variables: { rot: 90, gx: 5 },
      site: { plot_width: 500, plot_length: 500 },
      floors: [
        {
          floor_number: 1,
          name: "GF",
          objects: [
            {
              type: "room",
              name: "BR",
              x: 0,
              y: 0,
              width: 200,
              length: 300,
              items: [
                { name: "Bed", asset, anchor: "top-left", formulas: { rotation: "= rot", scale: "= 2", gap_x: "= gx" } },
              ],
            },
          ],
        },
      ],
    } as never;
    const bedItem = (expandRoomWalls(cfg, 8, { lenient: true }).floors[0].objects as Array<Record<string, unknown>>).find(
      (o) => o.type === "item",
    )!;
    expect(bedItem.rotation).toBe(90); // = rot
    expect(bedItem.scale).toBe(2); // = 2
    // top-left, scale 2, rotation 90 (half-extents swap), gap_x = 5, inner inset 8:
    // x = 8 + fd/2(65.62) + 5 = 78.62 ; y = 8 + fw/2(49.21) = 57.21
    expect(bedItem.x).toBeCloseTo(78.62, 1);
    expect(bedItem.y).toBeCloseTo(57.21, 1);
  });

  it("resolves a free item's anchor_to and follows the room's size", () => {
    const make = (w: number) =>
      ({
        site: { plot_width: 500, plot_length: 500 },
        floors: [
          {
            floor_number: 1,
            name: "GF",
            objects: [
              { type: "room", name: "Hall", x: 0, y: 0, width: w, length: 300 },
              { type: "item", name: "Plant", asset, x: 0, y: 0, anchor_to: "Hall", anchor: "bottom-right" },
            ],
          },
        ],
      }) as never;
    const findPlant = (cfg: never) =>
      (expandRoomWalls(cfg, 8, { lenient: true }).floors[0].objects as Array<Record<string, unknown>>).find(
        (o) => o.type === "item" && o.name === "Plant",
      )!;
    const narrow = findPlant(make(200));
    const wide = findPlant(make(400));
    expect((wide.x as number) - (narrow.x as number)).toBeCloseTo(200, 1); // bottom-right tracks the east wall
    expect(wide.y).toBeCloseTo(narrow.y as number, 2);
    expect(narrow.rotation).toBe(180); // bottom (south) wall → face north, derived
  });
});

describe("anchorFacing (anchor → default facing) + derived rotation", () => {
  it("faces away from the wall it hugs", () => {
    expect(anchorFacing("top-center")).toBe(0); // north wall → south
    expect(anchorFacing("bottom-center")).toBe(180); // south wall → north
    expect(anchorFacing("center-left")).toBe(90); // west wall → east
    expect(anchorFacing("center-right")).toBe(270); // east wall → west
    expect(anchorFacing("center")).toBe(0); // no wall → default south
    expect(anchorFacing(undefined)).toBe(0);
    // A corner anchors to two walls; the vertical edge wins (single-valued).
    expect(anchorFacing("top-left")).toBe(0);
    expect(anchorFacing("bottom-right")).toBe(180);
  });

  it("expand derives rotation from the anchor when none is given", () => {
    const asset = { id: "b", src: "/f/b.glb", dimensions: [1.5, 0.5, 2.0] };
    const cfg = {
      site: { plot_width: 500, plot_length: 500 },
      floors: [
        {
          floor_number: 1,
          name: "GF",
          objects: [
            {
              type: "room",
              name: "BR",
              x: 0,
              y: 0,
              width: 200,
              length: 300,
              items: [{ name: "Bed", asset, anchor: "bottom-center" }],
            },
          ],
        },
      ],
    } as never;
    const bed = (expandRoomWalls(cfg, 8, { lenient: true }).floors[0].objects as Array<Record<string, unknown>>).find(
      (o) => o.type === "item",
    )!;
    expect(bed.rotation).toBe(180); // derived: south wall → face north
  });

  it("an explicit rotation always overrides the anchor default", () => {
    const asset = { id: "b", src: "/f/b.glb", dimensions: [1.5, 0.5, 2.0] };
    const cfg = {
      site: { plot_width: 500, plot_length: 500 },
      floors: [
        {
          floor_number: 1,
          name: "GF",
          objects: [
            {
              type: "room",
              name: "BR",
              x: 0,
              y: 0,
              width: 200,
              length: 300,
              items: [{ name: "Bed", asset, anchor: "bottom-center", rotation: 45 }],
            },
          ],
        },
      ],
    } as never;
    const bed = (expandRoomWalls(cfg, 8, { lenient: true }).floors[0].objects as Array<Record<string, unknown>>).find(
      (o) => o.type === "item",
    )!;
    expect(bed.rotation).toBe(45); // explicit wins over the anchor default (180)
  });
});
