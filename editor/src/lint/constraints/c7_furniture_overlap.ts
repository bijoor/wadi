// C7 — Furniture items should not overlap (warning).

import { cap, floorLabel, makeReport, num, objLabel, type Bag } from "./vocab";
import { itemBox, type Box } from "./geometry";
import type { Constraint } from "./types";

export const C7: Constraint = {
  id: "C7",
  title: "Furniture items should not overlap",
  level: "warn",

  doc: {
    statement:
      "Two furniture `item`s whose plan footprints overlap are flagged — as a **warning**, because it is sometimes intentional (a rug under a table, a lamp on a desk, deliberately stacked pieces).",
    rationale:
      "More often it's a placement slip — two beds dropped on the same spot, or an anchored piece that reflowed into another when a room was resized. The footprint used is the item's rotated bounding box (yaw-aware), so it matches what the plan draws.",
    fix: "Reposition one item, or ignore the warning if the overlap is deliberate.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C7", "warn");
    const cfg = ctx.resolved as unknown as Bag;
    const floors = (cfg.floors as Bag[] | undefined) ?? [];
    const expandedFloors = ((ctx.expanded as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const units = cfg.units as { system?: string; per_unit?: number } | undefined;
    for (let fi = 0; fi < floors.length; fi++) {
      const fl = floors[fi];
      const fnum = num(fl.floor_number);
      const expObjs = ((expandedFloors[fi]?.objects as Bag[] | undefined) ?? []).filter(
        (o) => o.type === "item" && o.enabled !== false,
      );
      const boxes = expObjs.map((o) => ({ o, box: itemBox(o, units) })).filter((e) => e.box) as {
        o: Bag; box: Box;
      }[];
      const MARGIN = 2; // units; both axes must overlap by more than this
      for (let a = 0; a < boxes.length; a++) {
        for (let b = a + 1; b < boxes.length; b++) {
          const A = boxes[a], B = boxes[b];
          const ox = Math.min(A.box.x1, B.box.x1) - Math.max(A.box.x0, B.box.x0);
          const oy = Math.min(A.box.y1, B.box.y1) - Math.max(A.box.y0, B.box.y0);
          if (ox <= MARGIN || oy <= MARGIN) continue;
          report(
            `${cap(floorLabel(fl))}: furniture ${objLabel(A.o)} and ${objLabel(B.o)} overlap ` +
              `(~${Math.round(ox)}×${Math.round(oy)} units). Reposition one if that isn't intentional.`,
            { floor: fnum, where: objLabel(A.o) },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      { name: "well-separated furniture", config: house([floor([item("Bed A", 100, 100), item("Bed B", 400, 400)])]) },
    ],
    fail: [
      {
        name: "two overlapping footprints",
        config: house([floor([item("Bed A", 100, 100), item("Bed B", 110, 100)])]),
        expect: { count: 1, level: "warn" },
      },
    ],
  },
};

function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function floor(items: unknown[]) {
  return { floor_number: 1, name: "Ground", slab_thickness: 0, objects: items };
}
function item(name: string, x: number, y: number) {
  return {
    type: "item", name, x, y,
    asset: { id: "bed", src: "/f/bed.glb", dimensions: [2, 1, 2] as [number, number, number] },
  };
}
