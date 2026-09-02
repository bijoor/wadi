// C25 — A pillar should reach the slab/beam above it.

import { makeReport, objLabel, num, type Bag } from "./vocab";
import type { Constraint } from "./types";

export const C25: Constraint = {
  id: "C25",
  title: "A pillar should reach the slab or beam above it",
  level: "warn",

  doc: {
    statement:
      "A pillar should rise to the top of its floor — the underside of the slab or beam it carries. A pillar that stops well below the top of the floor's walls leaves a gap and supports nothing.",
    rationale:
      "A column exists to carry the floor or roof above it. When it stops short of that level there is a visible gap between the pillar top and the structure, and the load has nothing to bear on. Agents often shrink a copied pillar's height (or a configurator lowers it) so it no longer reaches the slab. (A warning — a deliberately low decorative post is allowed.)",
    fix:
      "Set the pillar height so its top meets the structure above: about the floor's wall height. The warning reports how far it falls short.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C25", "warn");
    const defaults = ctx.defaults;
    // Per-floor slab thickness + wall height (fall back to house defaults).
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const floorInfo = new Map<number, { slab: number; wallH: number }>();
    for (const fl of floors) {
      const slab =
        typeof fl.slab_thickness === "number" ? fl.slab_thickness : defaults.slab_thickness;
      const wallH =
        typeof fl.wall_height === "number" && fl.wall_height > 0
          ? fl.wall_height
          : defaults.wall_height;
      floorInfo.set(num(fl.floor_number), { slab, wallH });
    }

    for (const p of ctx.model.byType("pillar")) {
      if (p.raw.enabled === false) continue;
      const info = floorInfo.get(p.floor) ?? { slab: defaults.slab_thickness, wallH: defaults.wall_height };
      const raw = p.raw as Bag;
      const height = num(raw.height);
      if (!(height > 0)) continue;
      // A pillar sits on the slab (z_offset defaults to slab thickness); its top
      // should meet the top of the walls (where the ring beam / slab above rests).
      const zOff = typeof raw.z_offset === "number" ? raw.z_offset : info.slab;
      const pillarTop = zOff + height;
      const wallTop = info.slab + info.wallH;
      const gap = wallTop - pillarTop;
      // Generous threshold so a pillar that stops a beam-thickness low never warns.
      const maxGap = Math.max(2 * info.slab, 16);
      if (gap > maxGap) {
        report(
          `Pillar ${objLabel(raw)} on floor ${p.floor} is short of the slab/beam above — its top is ${Math.round(gap)} below the top of the floor's walls, leaving a gap with nothing bearing on it. ` +
            `Set its height to about ${Math.round(info.wallH)} so it meets the structure above (or leave it if it is a low decorative post).`,
          { floor: p.floor, where: objLabel(raw) },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "a full-height pillar reaches the wall top",
        config: house(108),
      },
    ],
    fail: [
      {
        name: "a pillar well short of the slab above",
        config: house(75),
        expect: { count: 1, level: "warn", messageIncludes: "short of the slab" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(pillarHeight: number): Record<string, unknown> {
  return {
    floors: [
      {
        floor_number: 1,
        name: "Ground",
        wall_height: 108,
        slab_thickness: 8,
        objects: [
          { type: "pillar", name: "P", x: 0, y: 0, width: 12, length: 12, height: pillarHeight },
        ],
      },
    ],
  };
}
