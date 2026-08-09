// C8 — Two abutting rooms need a partition between them.

import { activeObjects, cap, floorLabel, makeReport, num, objLabel, type Bag } from "./vocab";
import { buildRoomRects, roomSideOpenToWeather } from "../../estimate/wallArea";
import { ALL_SIDES, collectWallSegments, declaredSides, sideHasWall, sideSegment } from "./geometry";
import type { Constraint } from "./types";

export const C8: Constraint = {
  id: "C8",
  title: "Two abutting rooms need a partition between them",
  level: "warn",

  doc: {
    statement:
      "Where two rooms share a boundary line and **neither** declares a wall on it, there is no partition between them.",
    rationale:
      "A bare room (no `wall` lines) is enclosed on all four sides, so two bare neighbours have two walls on their shared line. But once **both** rooms switch to partial `walls` lists and both omit the shared side, the centreline is left open — the rooms merge into one space with no divider. C2 only guards *exterior* sides; this is its interior counterpart. It is a **warning** because an intentional open-plan link (kitchen into living) is legitimate.",
    fix:
      "Declare the wall on **one** of the two rooms (the neighbour's wall stands on the shared centreline, so one is enough):\n\n```wdl\nroom Kitchen at (…) size (…) { wall north south east }   // east = the shared line\nroom Living  at (…) size (…) { wall north south west }\n```",
  },

  check(ctx) {
    const { findings, report } = makeReport("C8", "warn");
    const config = ctx.resolved;
    const floors = ((config as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const wallTDefault = ctx.defaults.wall_thickness;
    const rects = buildRoomRects(config);
    const wallSegs = collectWallSegments(floors);
    for (const fl of floors) {
      const fnum = num(fl.floor_number);
      const seen = new Set<string>(); // one warning per bare shared line
      for (const o of activeObjects(fl)) {
        if (o.type !== "room") continue;
        const declared = declaredSides(o.walls);
        if (declared === "all") continue; // enclosed on all sides — has its partitions
        const wallT = num(o.wall_thickness ?? o.thickness ?? wallTDefault);
        const rx = num(o.x), ry = num(o.y), rw = num(o.width), rl = num(o.length);
        for (const side of ALL_SIDES) {
          if (declared.has(side)) continue;
          const seg = sideSegment(rx, ry, rw, rl, side);
          // Interior side (another room beyond) with NO wall on its line from anyone.
          if (roomSideOpenToWeather(rects, rx, ry, rw, rl, side, wallT)) continue; // exterior → C2's job
          if (sideHasWall(wallSegs, seg)) continue; // a neighbour/standalone wall covers it
          const key = `${seg.horiz ? "H" : "V"}:${Math.round(seg.at)}:${Math.round(seg.lo)}:${Math.round(seg.hi)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          report(
            `${cap(floorLabel(fl))}: room ${objLabel(o)}'s ${side} side abuts a neighbour but neither room ` +
              `declares a wall there — no partition between them. Add \`wall ${side}\` to one of them, unless the ` +
              `open link is intentional.`,
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
        name: "one of the two rooms declares the shared wall",
        config: house([
          { type: "room", name: "Kitchen", x: 0, y: 0, width: 200, length: 200, walls: ["north", "south", "west", "east"] },
          { type: "room", name: "Living", x: 200, y: 0, width: 200, length: 200, walls: ["north", "south", "east"] },
        ]),
      },
      {
        name: "bare rooms are enclosed on all sides",
        config: house([
          { type: "room", name: "A", x: 0, y: 0, width: 200, length: 200 },
          { type: "room", name: "B", x: 200, y: 0, width: 200, length: 200 },
        ]),
      },
    ],
    fail: [
      {
        name: "both rooms omit the shared side",
        config: house([
          { type: "room", name: "Kitchen", x: 0, y: 0, width: 200, length: 200, walls: ["north", "south", "west"] },
          { type: "room", name: "Living", x: 200, y: 0, width: 200, length: 200, walls: ["north", "south", "east"] },
        ]),
        expect: { count: 1, level: "warn" },
      },
    ],
  },
};

function house(objects: unknown[]): Record<string, unknown> {
  return { floors: [{ floor_number: 1, name: "Ground", slab_thickness: 0, objects }] };
}
