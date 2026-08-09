// C2 — A room must wall every exterior side.

import { activeObjects, floorLabel, makeReport, num, objLabel, type Bag } from "./vocab";
import { buildRoomRects, roomSideOpenToWeather } from "../../estimate/wallArea";
import { ALL_SIDES, collectWallSegments, declaredSides, sideHasWall, sideSegment } from "./geometry";
import type { Constraint } from "./types";

export const C2: Constraint = {
  id: "C2",
  title: "A room must wall every exterior side",
  level: "warn",

  doc: {
    statement:
      "A room shown with a **partial** `walls` list must still wall every side that faces **outside** (no room beyond it). Interior (shared) sides may be omitted — the neighbour's wall stands on the shared centreline.",
    rationale:
      "A room shows exactly the walls it declares; a **bare room (no `wall` lines) is enclosed on all four sides**. But the moment you add a `wall` line to hang a door or window, the room switches to a *whitelist* — every side you don't list is now a hole. An exterior hole leaves the room open to the weather. It is a **warning**, not an error, because an open exterior side is sometimes intentional (a verandah / open padvi).",
    fix:
      "```wdl\nroom Living at (x,y) size (w,l) {\n  wall east west                       // plain exterior sides — enclosed\n  wall south { door Main at 120 size (36,84) }\n  wall north { window N1 at 100 size (60,50) sill 35 }\n}\n```",
  },

  check(ctx) {
    const { findings, report } = makeReport("C2", "warn");
    const config = ctx.resolved;
    const floors = ((config as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const wallTDefault = ctx.defaults.wall_thickness;
    const rects = buildRoomRects(config);
    const wallSegs = collectWallSegments(floors);
    for (const fl of floors) {
      const objs = activeObjects(fl);
      const fnum = num(fl.floor_number);
      for (const o of objs) {
        if (o.type !== "room") continue;
        const declared = declaredSides(o.walls);
        if (declared === "all") continue;
        const missing = ALL_SIDES.filter((s) => !declared.has(s));
        if (!missing.length) continue;
        const wallT = num(o.wall_thickness ?? o.thickness ?? wallTDefault);
        const rx = num(o.x), ry = num(o.y), rw = num(o.width), rl = num(o.length);
        for (const side of missing) {
          if (sideHasWall(wallSegs, sideSegment(rx, ry, rw, rl, side))) continue;
          if (roomSideOpenToWeather(rects, rx, ry, rw, rl, side, wallT)) {
            report(
              `Room ${objLabel(o)} on ${floorLabel(fl)}: the ${side} side faces outside but has no wall — ` +
                `the room is open to the weather there. Add \`wall ${side}\` unless this side is intentionally ` +
                `open (e.g. a verandah).`,
              { floor: fnum, where: objLabel(o) },
            );
          }
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      { name: "bare room (no walls block = enclosed)", config: house([single(undefined)]) },
      { name: "all four sides declared", config: house([single(["north", "south", "east", "west"])]) },
      {
        name: "exterior side already walled by an adjacent room",
        config: house([
          {
            floor_number: 1, name: "Ground", slab_thickness: 0,
            objects: [
              { type: "room", name: "Big", x: 0, y: 0, width: 200, length: 200, walls: ["north", "south", "east", "west"] },
              { type: "room", name: "Bath", x: 100, y: 0, width: 100, length: 100, walls: ["south", "west"] },
            ],
          },
        ]),
      },
      {
        name: "interior (shared) side left open",
        config: house([
          {
            floor_number: 1, name: "Ground", slab_thickness: 0,
            objects: [
              { type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200, walls: ["north", "south", "west", "east"] },
              { type: "room", name: "Bedroom", x: 200, y: 0, width: 200, length: 200, walls: ["north", "south", "east"] },
            ],
          },
        ]),
      },
    ],
    fail: [
      {
        name: "partial walls leave two exterior sides open",
        config: house([single(["north", "south"])]),
        expect: { count: 2, level: "warn" },
      },
    ],
  },
};

function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function single(walls: unknown) {
  return {
    floor_number: 1,
    name: "Ground",
    slab_thickness: 0, // isolate C2 from C3
    objects: [{ type: "room", name: "Studio", x: 4, y: 4, width: 200, length: 200, ...(walls === undefined ? {} : { walls }) }],
  };
}
