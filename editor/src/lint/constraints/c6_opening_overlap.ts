// C6 — Openings on the same wall must not overlap.

import { activeObjects, cap, floorLabel, makeReport, num, type Bag } from "./vocab";
import { collectOpeningSegs } from "./geometry";
import type { Constraint } from "./types";

export const C6: Constraint = {
  id: "C6",
  title: "Openings on the same wall must not overlap",
  level: "error",

  doc: {
    statement:
      "Two openings (doors/windows) cut into the **same physical wall** must not overlap along it. This includes openings that belong to **two different rooms sharing a boundary wall**.",
    rationale:
      "Each opening is a boolean-subtract from the wall. Overlapping spans merge into one ragged hole (or fight over the same brick), which is never what you meant — and on a shared wall it silently punches a bigger gap than either room's plan shows.",
    fix:
      "Offset or narrow one opening so the spans are disjoint. Openings are measured from the wall's start corner (`offset` = near edge; the opening occupies `[offset, offset+width]`).",
  },

  check(ctx) {
    const { findings, report } = makeReport("C6", "error");
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    for (const fl of floors) {
      const objs = activeObjects(fl);
      const fnum = num(fl.floor_number);
      const segs = collectOpeningSegs(objs);
      const OVERLAP = 1; // units; ignore float-noise / edge-touching
      for (let a = 0; a < segs.length; a++) {
        for (let b = a + 1; b < segs.length; b++) {
          const A = segs[a], B = segs[b];
          if (A.horiz !== B.horiz) continue;
          if (Math.abs(A.at - B.at) > 1.5) continue; // different wall lines
          const overlap = Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo);
          if (overlap <= OVERLAP) continue;
          const by = Math.round(overlap);
          report(
            A.owner === B.owner
              ? `${cap(floorLabel(fl))}: ${A.label} and ${B.label} overlap by ~${by} units on ${A.owner}. ` +
                  `Two openings can't occupy the same span of a wall — move or narrow one.`
              : `${cap(floorLabel(fl))}: ${A.label} on ${A.owner} overlaps ${B.label} on ${B.owner} by ~${by} units — ` +
                  `they sit on the same shared wall and collide. Offset or resize one.`,
            { floor: fnum, where: A.owner },
          );
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "touching / non-overlapping openings on the same wall",
        config: house([
          roomWith({
            south: { openings: [
              { kind: "door", name: "D1", offset: 40, width: 40 },
              { kind: "window", name: "W1", offset: 90, width: 40 },
            ] },
          }),
        ]),
      },
    ],
    fail: [
      {
        name: "two openings overlap on the same room wall",
        config: house([
          roomWith({
            north: {}, east: {}, west: {},
            south: { openings: [
              { kind: "door", name: "D1", offset: 40, width: 40 },
              { kind: "window", name: "W1", offset: 60, width: 40 },
            ] },
          }),
        ]),
        expect: { count: 1, level: "error", messageIncludes: "overlap" },
      },
      {
        name: "openings on a SHARED wall between two rooms overlap",
        config: house([
          {
            floor_number: 1, name: "Ground", slab_thickness: 0,
            objects: [
              { type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200,
                walls: { north: {}, south: {}, west: {}, east: { openings: [{ kind: "door", name: "LD", offset: 50, width: 40 }] } } },
              { type: "room", name: "Bedroom", x: 200, y: 0, width: 200, length: 200,
                walls: { north: {}, south: {}, east: {}, west: { openings: [{ kind: "door", name: "BD", offset: 60, width: 40 }] } } },
            ],
          },
        ]),
        expect: { count: 1, level: "error", messageIncludes: "shared wall" },
      },
    ],
  },
};

function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function roomWith(walls: Record<string, unknown>) {
  return {
    floor_number: 1,
    name: "Ground",
    slab_thickness: 0,
    objects: [{ type: "room", name: "Hall", x: 0, y: 0, width: 300, length: 200, walls }],
  };
}
