// C25 — A pillar under a slab should reach that slab.

import { makeReport, objLabel, num, type Bag } from "./vocab";
import { footprintsOverlap, type Footprint } from "../../model/geom";
import { boxFootprint } from "./stairLint";
import type { Constraint } from "./types";

interface FloorInfo {
  slab: number;
  height: number;
  decks: Footprint[];
}

export const C25: Constraint = {
  id: "C25",
  title: "A pillar under a slab should reach that slab",
  level: "warn",

  doc: {
    statement:
      "When a slab on the floor above sits over a pillar, the pillar should rise to the underside of that slab. A pillar that stops short leaves a gap and carries nothing.",
    rationale:
      "A column exists to carry the slab above it; if it stops below that level there is a gap between its top and the slab, and the load has nothing to bear on. Agents often shrink a copied pillar's height (or a configurator lowers it) so it no longer reaches the slab. This only checks a pillar that actually has a slab above it — a pillar supporting a roof (which slopes and has no flat datum), or with nothing above, is never flagged. (A warning — a deliberately low decorative post under a slab is allowed.)",
    fix:
      "Raise the pillar height so its top meets the slab above (about the floor's height minus its slab thickness), or, if it is meant to be low, remove the slab above it / leave it be.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C25", "warn");
    const defaults = ctx.defaults;
    const floors = ((ctx.resolved as unknown as Bag).floors as Bag[] | undefined) ?? [];
    // Per-floor slab thickness, height, and the footprints of its deck slabs
    // (authored `slab` → type "floor_slab") read from the resolved config.
    const infoByFloor = new Map<number, FloorInfo>();
    for (const fl of floors) {
      const slab =
        typeof fl.slab_thickness === "number" ? fl.slab_thickness : defaults.slab_thickness;
      const height =
        typeof fl.height === "number" && fl.height > 0 ? fl.height : defaults.floor_height;
      const decks: Footprint[] = [];
      for (const o of (fl.objects as Bag[] | undefined) ?? []) {
        if (o.type !== "floor_slab" || o.enabled === false) continue;
        const fp = boxFootprint({ x: num(o.x), y: num(o.y), width: num(o.width), length: num(o.length) });
        if (fp) decks.push(fp);
      }
      infoByFloor.set(num(fl.floor_number), { slab, height, decks });
    }
    const floorNums = [...infoByFloor.keys()].sort((a, b) => a - b);

    for (const p of ctx.model.byType("pillar")) {
      if (p.raw.enabled === false) continue;
      const info = infoByFloor.get(p.floor);
      if (!info) continue;
      // The next floor up (if any). No floor above → roof/open, nothing to reach.
      const aboveN = floorNums.find((f) => f > p.floor);
      if (aboveN === undefined) continue;
      const above = infoByFloor.get(aboveN)!;
      // Only warn when a slab on the floor above actually sits over this pillar.
      if (!above.decks.some((d) => footprintsOverlap(d, p.footprint))) continue;

      const raw = p.raw as Bag;
      const height = num(raw.height);
      if (!(height > 0)) continue;
      // A pillar sits on the slab (z_offset defaults to slab thickness); the slab
      // above rests at the top of this floor (this floor's `height`).
      const zOff = typeof raw.z_offset === "number" ? raw.z_offset : info.slab;
      const gap = info.height - (zOff + height);
      const maxGap = Math.max(2 * info.slab, 16); // tolerate a beam-thickness shortfall
      if (gap > maxGap) {
        report(
          `Pillar ${objLabel(raw)} on floor ${p.floor} is short of the slab above (on floor ${aboveN}) — its top is ${Math.round(gap)} below the underside of that slab, leaving a gap with nothing bearing on it. ` +
            `Raise its height to about ${Math.round(info.height - info.slab)} so it meets the slab.`,
          { floor: p.floor, where: objLabel(raw) },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "a full-height pillar reaches the slab above",
        config: house(108, true),
      },
      {
        name: "a short pillar with NO slab above (supports a roof) is not flagged",
        config: house(75, false),
      },
    ],
    fail: [
      {
        name: "a short pillar under a slab",
        config: house(75, true),
        expect: { count: 1, level: "warn", messageIncludes: "short of the slab above" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
// Floor 1 has a pillar; when `slabAbove`, floor 2 carries a slab over it.
function house(pillarHeight: number, slabAbove: boolean): Record<string, unknown> {
  const floor2Objects: unknown[] = slabAbove
    ? [{ type: "floor_slab", name: "Deck", x: 0, y: 0, width: 100, length: 100 }]
    : [];
  return {
    floors: [
      {
        floor_number: 1,
        name: "Ground",
        height: 116,
        slab_thickness: 8,
        objects: [
          { type: "pillar", name: "P", x: 40, y: 40, width: 12, length: 12, height: pillarHeight },
        ],
      },
      { floor_number: 2, name: "Upper", height: 116, slab_thickness: 8, objects: floor2Objects },
    ],
  };
}
