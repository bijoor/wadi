import { describe, expect, it } from "vitest";
import { anchorItem } from "./furnitureAnchor";
import { expandRoomWalls } from "./expand";

// Room 200×300 at origin, wallT 8 → inner face inset 4 → [4,4]..[196,296].
// Bed 1.5×2.0 m footprint; default units (feet_inches/per_unit=10) → 32.808 units/m,
// so fw = 49.21 (X), fd = 65.62 (Y); half-extents 24.606 × 32.808 at rotation 0.
const rect = { x: 0, y: 0, w: 200, l: 300 };
const bed = { dimensions: [1.5, 0.5, 2.0] as [number, number, number] };

describe("anchorItem (room-relative furniture anchoring)", () => {
  it("top-center hugs the north wall, centred horizontally", () => {
    const p = anchorItem(rect, { ...bed, anchor: "top-center" }, 8);
    expect(p.x).toBeCloseTo(100, 2);
    expect(p.y).toBeCloseTo(36.808, 2); // iy0(4) + halfY(32.808)
  });

  it("top-left corner with a per-axis gap clears each wall", () => {
    const p = anchorItem(rect, { ...bed, anchor: "top-left", gapX: 5, gapY: 5 }, 8);
    expect(p.x).toBeCloseTo(33.606, 2); // 4 + 24.606 + 5
    expect(p.y).toBeCloseTo(41.808, 2); // 4 + 32.808 + 5
  });

  it("bottom-right corner", () => {
    const p = anchorItem(rect, { ...bed, anchor: "bottom-right" }, 8);
    expect(p.x).toBeCloseTo(171.394, 2); // 196 - 24.606
    expect(p.y).toBeCloseTo(263.192, 2); // 296 - 32.808
  });

  it("center sits at the room centre", () => {
    const p = anchorItem(rect, { ...bed, anchor: "center" }, 8);
    expect(p.x).toBeCloseTo(100, 2);
    expect(p.y).toBeCloseTo(150, 2);
  });

  it("uses the rotated footprint so a turned piece still clears the wall", () => {
    // rotation 90° swaps the half-extents: halfY becomes fw/2 = 24.606.
    const p = anchorItem(rect, { ...bed, anchor: "top-center", rotation: 90 }, 8);
    expect(p.y).toBeCloseTo(28.606, 2); // 4 + 24.606
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
    expect(bedItem.y).toBeCloseTo(36.808, 2);
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
    // top-left, scale 2, rotation 90 (half-extents swap), gap_x = 5:
    // x = 4 + fd/2(65.62) + 5 = 74.62 ; y = 4 + fw/2(49.21) = 53.21
    expect(bedItem.x).toBeCloseTo(74.62, 1);
    expect(bedItem.y).toBeCloseTo(53.21, 1);
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
  });
});
