// C3 — A floor with no slab must set slab_thickness to 0.

import { activeObjects, cap, floorLabel, makeReport, num, type Bag } from "./vocab";
import type { Constraint } from "./types";

export const C3: Constraint = {
  id: "C3",
  title: "A floor with no slab must set slab_thickness to 0",
  level: "error",

  doc: {
    statement:
      "A floor that has wall/room objects but **no `floor_slab` object** must set `slab_thickness 0`.",
    rationale:
      "`slab_thickness` is the deck the floor's walls stand on (`wallZ = base + slab_thickness`). Its default is `8`. With no slab object there is no deck, so every wall on the floor floats `slab_thickness` units above the floor base. Setting it to `0` puts the walls on the floor base; alternatively, model the deck by adding a `slab`.",
    fix:
      "```wdl\nfloor 1 \"Ground\" slab_thickness 0 {   // no slab modelled → walls sit on the base\n  room Studio at (…) size (…) { … }\n}\n```\n\n*(This does not fire on a floor that carries no walls/rooms — e.g. a Plinth floor of just `ground` + `plinth`, or a roof-only top floor — where `slab_thickness` is harmless.)*",
  },

  check(ctx) {
    const { findings, report } = makeReport("C3", "error");
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const slabDefault = ctx.defaults.slab_thickness;
    for (const fl of floors) {
      const objs = activeObjects(fl);
      const fnum = num(fl.floor_number);
      const hasSlab = objs.some((o) => o.type === "floor_slab");
      const deckObjs = objs.filter((o) => o.type === "room" || o.type === "wall");
      if (!hasSlab && deckObjs.length) {
        const explicit = fl.slab_thickness;
        const eff = explicit != null ? num(explicit) : slabDefault;
        if (eff !== 0) {
          report(
            `${cap(floorLabel(fl))} has ${deckObjs.length} wall/room object${deckObjs.length === 1 ? "" : "s"} ` +
              `but no floor slab, yet slab_thickness is ${eff}${explicit == null ? " (default)" : ""}. ` +
              `The walls float ${eff} units above the floor base. Set \`slab_thickness 0\` on this floor, or add a \`slab\`.`,
            { floor: fnum },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      { name: "slab_thickness explicitly 0", config: house([roomFloor({ slab_thickness: 0 })]) },
      {
        name: "floor has a real slab object",
        config: house([
          roomFloor({}, [{ type: "floor_slab", x: 0, y: 0, width: 208, length: 208 }]),
        ]),
      },
    ],
    fail: [
      {
        name: "wall/room floor, no slab, nonzero slab_thickness (default)",
        config: house([roomFloor({})]),
        expect: { count: 1, level: "error" },
      },
    ],
  },
};

function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function roomFloor(extra: Record<string, unknown>, extraObjs: unknown[] = []) {
  return {
    floor_number: 1,
    name: "Ground",
    objects: [
      { type: "room", name: "R", x: 4, y: 4, width: 200, length: 200, walls: ["north", "south", "east", "west"] },
      ...extraObjs,
    ],
    ...extra,
  };
}
