// C9 — A floor's slab_thickness should match its floor_slab object's thickness.

import { activeObjects, cap, floorLabel, makeReport, num, objLabel, type Bag } from "./vocab";
import type { Constraint } from "./types";

export const C9: Constraint = {
  id: "C9",
  title: "A floor's slab_thickness should match its slab object's thickness",
  level: "warn",

  doc: {
    statement:
      "When a floor carries a `floor_slab` object with an explicit `thickness`, that thickness should equal the floor's `slab_thickness`.",
    rationale:
      "The floor's `slab_thickness` is the deck the walls stand on (`wallZ = base + slab_thickness`); the slab object's own `thickness` is how thick the slab MESH is drawn. If they differ, the walls sit at the floor's `slab_thickness` while the slab top is at the object's `thickness`, so the walls float above or sink into the drawn deck. (A slab with no explicit `thickness` follows the floor's `slab_thickness` and is consistent by construction — this only fires when both are set and disagree.)",
    fix:
      "Make them equal — most simply, drop the slab's explicit `thickness` so it follows the floor:\n\n```wdl\nfloor 1 \"Ground\" slab_thickness 8 {\n  slab name \"Deck\" at (…) size (…)          // no thickness → uses 8\n}\n```",
  },

  check(ctx) {
    const { findings, report } = makeReport("C9", "warn");
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const slabDefault = ctx.defaults.slab_thickness;
    for (const fl of floors) {
      const fnum = num(fl.floor_number);
      const floorSlabT = fl.slab_thickness != null ? num(fl.slab_thickness) : slabDefault;
      for (const o of activeObjects(fl)) {
        if (o.type !== "floor_slab") continue;
        if (o.thickness == null) continue; // follows the floor's slab_thickness — consistent
        const slabT = num(o.thickness);
        if (Math.abs(slabT - floorSlabT) > 1e-3) {
          report(
            `${cap(floorLabel(fl))}: slab ${objLabel(o)} thickness (${slabT}) ≠ the floor's slab_thickness ` +
              `(${floorSlabT}${fl.slab_thickness == null ? " (default)" : ""}). Walls stand on the floor's ` +
              `slab_thickness, not the slab mesh, so they float/sink relative to the drawn deck. Make them equal.`,
            { floor: fnum, where: objLabel(o) },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      { name: "slab with no explicit thickness (follows the floor)", config: house([floorWithSlab({})]) },
      { name: "slab thickness equals the floor's slab_thickness", config: house([floorWithSlab({ thickness: 8 }, 8)]) },
    ],
    fail: [
      {
        name: "slab thickness disagrees with the floor's slab_thickness",
        config: house([floorWithSlab({ thickness: 12 }, 8)]),
        expect: { count: 1, level: "warn" },
      },
    ],
  },
};

function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function floorWithSlab(slabExtra: Record<string, unknown>, floorSlabThickness = 8) {
  return {
    floor_number: 1,
    name: "Ground",
    slab_thickness: floorSlabThickness,
    objects: [
      { type: "floor_slab", name: "Deck", x: 0, y: 0, width: 200, length: 200, ...slabExtra },
      { type: "room", name: "R", x: 4, y: 4, width: 190, length: 190, walls: ["north", "south", "east", "west"] },
    ],
  };
}
