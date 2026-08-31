// C14 — The highest floor should carry a roof.

import { activeObjects, floorLabel, makeReport, num, cap, type Bag } from "./vocab";
import type { Constraint } from "./types";

export const C14: Constraint = {
  id: "C14",
  title: "The highest floor should carry a roof",
  level: "warn",

  doc: {
    statement:
      "A house should be capped by a roof: the highest floor should contain a `roof` object.",
    rationale:
      "The roof sits on its own floor stacked above the walls (see the roof convention). A design whose top floor has no roof leaves the house open — usually a roof that was forgotten, or a floor added above the roof. (A style guide, so it only warns — a deliberate flat terrace with no roof is allowed.)",
    fix:
      "Add a `roof` to the highest floor (a floor stacked above the top occupied floor), with segments spanning the footprint.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C14", "warn");
    const floors = ((ctx.expanded as unknown as Bag).floors as Bag[] | undefined) ?? [];
    if (!floors.length) return findings;

    const maxN = Math.max(...floors.map((fl) => num(fl.floor_number)));
    const highest = floors.filter((fl) => num(fl.floor_number) === maxN);
    const hasRoof = highest.some((fl) => activeObjects(fl).some((o) => o.type === "roof"));
    if (!hasRoof) {
      report(
        `The highest floor (${cap(highest.map((fl) => floorLabel(fl)).join(", "))}) carries no roof. ` +
          `A house should be capped by a roof on its highest floor — add a \`roof\` object there.`,
        { floor: maxN },
      );
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "highest floor has a roof",
        config: house([
          floor(1, "Ground", [room(0, 0, 300, 400)]),
          floor(2, "Roof", [roof(0, 0, 300, 400)]),
        ]),
      },
    ],
    fail: [
      {
        name: "highest floor has rooms but no roof",
        config: house([floor(1, "Ground", [room(0, 0, 300, 400)])]),
        expect: { count: 1, level: "warn", messageIncludes: "roof" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(floors: unknown[]): Record<string, unknown> {
  return { floors };
}
function floor(floor_number: number, name: string, objects: unknown[]) {
  return { floor_number, name, slab_thickness: 0, objects };
}
function room(x: number, y: number, width: number, length: number) {
  return { type: "room", name: "R", x, y, width, length, walls: ["north", "south", "east", "west"] };
}
function roof(x: number, y: number, width: number, length: number) {
  return {
    type: "roof",
    name: "Roof",
    segments: [{ id: "seg0", start: [x + width / 2, y], end: [x + width / 2, y + length], width }],
  };
}
