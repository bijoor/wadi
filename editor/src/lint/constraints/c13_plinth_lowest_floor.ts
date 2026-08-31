// C13 — The lowest floor should carry a plinth.

import { activeObjects, floorLabel, makeReport, num, cap, type Bag } from "./vocab";
import type { Constraint } from "./types";

export const C13: Constraint = {
  id: "C13",
  title: "The lowest floor should carry a plinth",
  level: "warn",

  doc: {
    statement:
      "A house should rest on a plinth: the lowest floor should contain a `plinth` object.",
    rationale:
      "The plinth is the raised base the building sits on — it lifts the ground floor above grade and gives the walls a footing. A lowest floor with rooms but no plinth reads as a slab-on-grade shortcut; most Konkan houses want an explicit plinth. (A style guide, so it only warns — a deliberately plinth-less design is allowed.)",
    fix:
      "Add a `plinth` to the lowest floor (usually the Plinth floor 0, alongside the `ground`), sized to cover the built footprint.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C13", "warn");
    const floors = ((ctx.expanded as unknown as Bag).floors as Bag[] | undefined) ?? [];
    if (!floors.length) return findings;

    const minN = Math.min(...floors.map((fl) => num(fl.floor_number)));
    const lowest = floors.filter((fl) => num(fl.floor_number) === minN);
    const hasPlinth = lowest.some((fl) => activeObjects(fl).some((o) => o.type === "plinth"));
    if (!hasPlinth) {
      report(
        `The lowest floor (${cap(lowest.map((fl) => floorLabel(fl)).join(", "))}) carries no plinth. ` +
          `A house should rest on a plinth on its lowest floor — add a \`plinth\` object there.`,
        { floor: minN },
      );
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "lowest floor has a plinth",
        config: house([
          floor(0, "Plinth", [plinth(0, 0, 300, 400)]),
          floor(1, "Ground", [room(0, 0, 300, 400)]),
        ]),
      },
    ],
    fail: [
      {
        name: "lowest floor has rooms but no plinth",
        config: house([floor(1, "Ground", [room(0, 0, 300, 400)])]),
        expect: { count: 1, level: "warn", messageIncludes: "plinth" },
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
function plinth(x: number, y: number, width: number, length: number) {
  return { type: "plinth", name: "Plinth", x, y, width, length, height: 40 };
}
