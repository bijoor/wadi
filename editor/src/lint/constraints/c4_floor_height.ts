// C4 — A stacked floor's height should equal wall_height + slab_thickness.

import { activeObjects, cap, floorLabel, makeReport, num, type Bag } from "./vocab";
import type { Constraint } from "./types";

export const C4: Constraint = {
  id: "C4",
  title: "A stacked floor's height should equal wall_height + slab_thickness",
  level: "warn",

  doc: {
    statement:
      "A floor that carries a floor above it (and has walls/rooms) should set `height` = `wall_height` + `slab_thickness`.",
    rationale:
      "The next floor sits at `base + height`; this floor's walls stand on the deck and reach `base + slab_thickness + wall_height`. When `height` is larger, the floor above leaves a gap over the walls; when smaller, the walls poke through it. It is a **warning** — a deliberate gap is legitimate (a service plenum, a deep transfer beam) — but usually they should match.",
    fix:
      "```wdl\ndefaults { floor_height 116 wall_height 108 slab_thickness 8 }   // 108 + 8 = 116\n```\n\n*(Skipped for the plinth floor — governed by C1 — and for the topmost floor, since nothing stacks on its walls.)*",
  },

  check(ctx) {
    const { findings, report } = makeReport("C4", "warn");
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const { floor_height: floorHeightDefault, wall_height: wallHeightDefault, slab_thickness: slabDefault } = ctx.defaults;
    for (let fi = 0; fi < floors.length; fi++) {
      const fl = floors[fi];
      const objs = activeObjects(fl);
      const fnum = num(fl.floor_number);
      const plinths = objs.filter((o) => o.type === "plinth");
      const deckObjs = objs.filter((o) => o.type === "room" || o.type === "wall");
      const hasFloorAbove = fi < floors.length - 1;
      if (deckObjs.length && hasFloorAbove && !plinths.length) {
        const h = fl.height != null ? num(fl.height) : floorHeightDefault;
        const wh = fl.wall_height != null ? num(fl.wall_height) : wallHeightDefault;
        const st = fl.slab_thickness != null ? num(fl.slab_thickness) : slabDefault;
        const gap = h - (wh + st);
        if (Math.abs(gap) > 1e-3) {
          report(
            `${cap(floorLabel(fl))}: floor height (${h}) ≠ wall_height (${wh}) + slab_thickness (${st}) = ${wh + st}. ` +
              (gap > 0
                ? `The floor above leaves a ${gap}-unit gap over the walls. `
                : `The walls poke ${Math.abs(gap)} units through the floor above. `) +
              `Set height = wall_height + slab_thickness (or adjust them) unless the gap is intentional.`,
            { floor: fnum },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "height == wall_height + slab_thickness",
        config: house([occupied({ height: 116, wall_height: 108, slab_thickness: 8 }), above()]),
      },
      {
        name: "topmost floor (nothing stacks on its walls)",
        config: house([occupied({ height: 120, wall_height: 108, slab_thickness: 8 })]),
      },
    ],
    fail: [
      {
        name: "height ≠ wall_height + slab_thickness (gap over the walls)",
        config: house([occupied({ height: 120, wall_height: 108, slab_thickness: 8 }), above()]),
        expect: { count: 1, level: "warn", messageIncludes: "gap" },
      },
    ],
  },
};

function above() {
  return { floor_number: 2, name: "Upper", objects: [] };
}
function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function occupied(extra: Record<string, unknown>) {
  return {
    floor_number: 1,
    name: "Ground",
    objects: [
      { type: "floor_slab", x: 0, y: 0, width: 200, length: 200 },
      { type: "room", name: "R", x: 4, y: 4, width: 190, length: 190, walls: ["north", "south", "east", "west"] },
    ],
    ...extra,
  };
}
