// C12 — two rooms should not overlap in plan (warning).
//
// Rooms usually share WALLS, not floor area. In `center` convention an abutting
// pair's rectangles share a centreline (edges coincide, zero area overlap); in
// `outer` they meet at a wall face. Either way a legitimately adjacent pair
// overlaps by at most a wall thickness. A larger overlap is USUALLY a mistake —
// two rooms dropped on the same spot, or a band (a verandah, a corridor) laid
// across an existing wing — which the renderer draws one on top of the other.
// This is the check that was missing when an agent put a verandah band over a
// bedroom and `wadi_check` still said "no errors": C11 verifies declared
// connections; nothing flagged the collision.
//
// It is a WARNING, not an error, because the overlap is SOMETIMES intentional:
// embedding a small room in the corner of a larger one is how an L-shaped space
// is modelled (the big room is the bounding rectangle, the corner room carves
// out of it — the shipped Living_Kitchen + Bathroom_1 does exactly this). A
// linter can't read that intent, so it flags the overlap and lets the author
// decide.

import { cap, floorLabel, makeReport, num, objLabel, activeObjects, type Bag } from "./vocab";
import type { Constraint } from "./types";

interface Rect { x: number; y: number; w: number; l: number }
const rectOf = (o: Bag): Rect => ({ x: num(o.x), y: num(o.y), w: num(o.width), l: num(o.length) });

export const C12: Constraint = {
  id: "C12",
  title: "Rooms should not overlap (they share walls, not floor area)",
  level: "warn",

  doc: {
    statement:
      "Two `room`s on the same floor should not overlap in plan — flagged as a **warning**, because it is occasionally intentional (embedding a corner room to carve an L-shaped space). Adjacent rooms may **touch** on a shared wall (their edges coincide); a larger intersection is reported.",
    rationale:
      "Rooms usually share walls, not floor area. A real overlap means two rooms were placed on the same spot — the renderer draws one over the other. It most often happens when a room is placed by absolute coordinates, or when a band (a verandah, a corridor) is dropped across an existing wing. C11 checks that declared connections are realized; this checks that the geometry is physically consistent. It stays a warning because an L-shaped room is modelled by overlapping a small corner room onto a larger bounding one.",
    fix: "If the overlap is unintended, move or resize one room so they only touch on a shared wall (prefer relative placement — abut a neighbour on a side — over absolute coordinates that can land on top of another room). Ignore the warning if it is a deliberate corner embed.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C12", "warn");
    const cfg = ctx.resolved as unknown as Bag;
    const floors = (cfg.floors as Bag[] | undefined) ?? [];
    // A legitimately abutting pair overlaps by at most a wall thickness; require
    // more than that on BOTH axes before calling it a collision.
    const margin = ctx.defaults.wall_thickness + 1;

    for (const fl of floors) {
      const fnum = num(fl.floor_number);
      const rooms = activeObjects(fl).filter((o) => o.type === "room");
      for (let a = 0; a < rooms.length; a++) {
        for (let b = a + 1; b < rooms.length; b++) {
          const A = rectOf(rooms[a]), B = rectOf(rooms[b]);
          const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
          const oy = Math.min(A.y + A.l, B.y + B.l) - Math.max(A.y, B.y);
          if (ox <= margin || oy <= margin) continue; // only touching / apart
          report(
            `${cap(floorLabel(fl))}: rooms ${objLabel(rooms[a])} and ${objLabel(rooms[b])} overlap ` +
              `(~${Math.round(ox)}×${Math.round(oy)} units of shared floor area). Rooms share walls, not floor — move or resize one.`,
            { floor: fnum, where: objLabel(rooms[a]) },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "two rooms abutting on a shared wall (edges coincide)",
        config: house([
          { type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200 },
          { type: "room", name: "Kitchen", x: 200, y: 0, width: 200, length: 200 },
        ]),
      },
      {
        name: "two rooms well apart",
        config: house([
          { type: "room", name: "A", x: 0, y: 0, width: 100, length: 100 },
          { type: "room", name: "B", x: 300, y: 300, width: 100, length: 100 },
        ]),
      },
      {
        name: "a disabled room is ignored even if it overlaps",
        config: house([
          { type: "room", name: "A", x: 0, y: 0, width: 200, length: 200 },
          { type: "room", name: "Ghost", x: 50, y: 50, width: 200, length: 200, enabled: false },
        ]),
      },
    ],
    fail: [
      {
        name: "a verandah band laid across a bedroom (partial overlap)",
        config: house([
          { type: "room", name: "Bedroom 2", x: 200, y: 280, width: 120, length: 120 },
          { type: "room", name: "Front Verandah", x: 200, y: 280, width: 200, length: 60 },
        ]),
        expect: { count: 1, level: "warn", messageIncludes: "overlap" },
      },
      {
        name: "one room fully inside another",
        config: house([
          { type: "room", name: "Hall", x: 0, y: 0, width: 400, length: 400 },
          { type: "room", name: "Nook", x: 100, y: 100, width: 100, length: 100 },
        ]),
        expect: { count: 1, level: "warn", messageIncludes: "share walls" },
      },
    ],
  },
};

function house(objects: unknown[]): Record<string, unknown> {
  return { floors: [{ floor_number: 1, name: "Ground", slab_thickness: 0, objects }] };
}
