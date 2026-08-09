// C5 — A staircase must land on a floor, not below ground.

import { activeObjects, floorLabel, makeReport, num, objLabel, type Bag } from "./vocab";
import type { Constraint } from "./types";

export const C5: Constraint = {
  id: "C5",
  title: "A staircase must land on a floor, not below ground",
  level: "warn",

  doc: {
    statement: "A staircase's descent must not carry it below the ground plane (z < 0).",
    rationale:
      "Only a `climb down` (top-anchored) stair can fall below ground: you place it on the **upper** floor and it **descends**. Put it on the wrong floor, or give it too large a `total_height`, and the expanded flight lands **below ground** — it still draws in the 2D plans (which ignore Z) but is **buried and invisible in 3D**, with no other error. A `climb up` stair is anchored on its own floor and ascends, so it never trips this.",
    fix:
      "Prefer **`climb up`**: put the stair on the **lower** floor it rises FROM and let it ascend.\n\n```wdl\nfloor 1 \"Ground Floor\" height 116 {\n  slab at (…) size (…)\n  staircase name \"Stair\" at (212, 64) step (7, 11, 44)   // `at` = the BOTTOM (this floor)\n    direction south climb up                             // ascends to the floor above\n}\n```\n\n(Or, if you must keep it `climb down`, move it **up one floor** or reduce `total_height`.)",
  },

  check(ctx) {
    const { findings, report } = makeReport("C5", "warn");
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const { floor_height: floorHeightDefault, slab_thickness: slabDefault } = ctx.defaults;
    let baseZ = 0;
    for (let fi = 0; fi < floors.length; fi++) {
      const fl = floors[fi];
      const objs = activeObjects(fl);
      const fnum = num(fl.floor_number);
      const floorBaseZ = baseZ;
      baseZ += fl.height != null ? num(fl.height) : floorHeightDefault;
      for (const o of objs) {
        if (o.type !== "staircase") continue;
        if (((o.climb as string | undefined) ?? "down") === "up") continue; // ascends from this floor — can't fall below ground
        const riser = num(o.step_rise);
        if (riser <= 0) continue;
        const belowH =
          fi > 0 && floors[fi - 1].height != null ? num(floors[fi - 1].height) : floorHeightDefault;
        const riseHeight = o.rise_height != null && num(o.rise_height) > 0 ? num(o.rise_height) : belowH;
        const totalRise = Math.max(1, Math.round(riseHeight / riser)) * riser;
        const slabT = fl.slab_thickness != null ? num(fl.slab_thickness) : slabDefault;
        const topZ = o.z_offset != null ? num(o.z_offset) : slabT;
        const bottomZ = floorBaseZ + (topZ - totalRise);
        if (bottomZ < -1) {
          report(
            `Staircase ${objLabel(o)} on ${floorLabel(fl)} descends to z=${Math.round(bottomZ)} — below the ground ` +
              `plane, so it draws in 2D plans but is buried (invisible) in 3D. Staircases are TOP-anchored: place them ` +
              `on the UPPER floor and they DESCEND to the floor below (\`direction\` is the descent). Move it up a floor ` +
              `or reduce total_height.`,
            { floor: fnum, where: objLabel(o) },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "staircase on the upper floor lands above ground",
        config: {
          floors: [
            { floor_number: 0, name: "Plinth", height: 30, objects: [plinth(30)] },
            { floor_number: 1, name: "Ground", height: 108, slab_thickness: 0, objects: [room()] },
            {
              floor_number: 2,
              name: "First",
              height: 116,
              objects: [
                { type: "floor_slab", x: 0, y: 0, width: 100, length: 100 },
                { type: "staircase", name: "S", start_x: 20, start_y: 20, step_rise: 7, step_tread: 11, step_width: 44, direction: "south", rise_height: 116 },
              ],
            },
          ],
        },
      },
      {
        name: "climb-up stair never falls below ground",
        config: {
          floors: [
            { floor_number: 0, name: "Plinth", height: 30, objects: [plinth(30)] },
            {
              floor_number: 1,
              name: "Ground",
              height: 116,
              objects: [
                room(),
                { type: "staircase", name: "S", climb: "up", start_x: 20, start_y: 20, step_rise: 7, step_tread: 11, step_width: 44, direction: "south", rise_height: 116 },
              ],
            },
          ],
        },
      },
    ],
    fail: [
      {
        name: "staircase descends below the ground plane (buried)",
        config: {
          floors: [
            { floor_number: 0, name: "Plinth", height: 30, objects: [plinth(30)] },
            {
              floor_number: 1,
              name: "Ground",
              height: 108,
              slab_thickness: 0,
              objects: [
                room(),
                { type: "staircase", name: "S", start_x: 20, start_y: 80, step_rise: 7, step_tread: 11, step_width: 44, direction: "north", rise_height: 108 },
              ],
            },
          ],
        },
        expect: { count: 1, level: "warn", messageIncludes: "buried" },
      },
    ],
  },
};

function plinth(h: number) {
  return { type: "plinth", name: "P", x: 0, y: 0, width: 100, length: 100, height: h };
}
function room() {
  return { type: "room", name: "R", x: 4, y: 4, width: 90, length: 90, walls: ["north", "south", "east", "west"] };
}
