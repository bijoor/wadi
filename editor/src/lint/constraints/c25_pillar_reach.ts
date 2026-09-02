// C25 — A pillar under a slab or landing should reach it.

import { makeReport, objLabel, num } from "./vocab";
import { footprintsOverlap } from "../../model/geom";
import type { ModelNode } from "../../model/spatialModel";
import type { Constraint } from "./types";

// A staircase turn/arrival landing is a floor_slab named `<stair>_L<n>`.
function isLanding(n: ModelNode): boolean {
  return /_L\d+$/.test(String(n.raw?.name ?? ""));
}

export const C25: Constraint = {
  id: "C25",
  title: "A pillar under a slab or landing should reach it",
  level: "warn",

  doc: {
    statement:
      "When a floor slab or a staircase landing sits directly over a pillar, the pillar should rise to the underside of it. A pillar that stops short leaves a gap and carries nothing.",
    rationale:
      "A column exists to carry the slab or landing above it; if it stops below that level there is a gap and the load has nothing to bear on. Agents often shrink a copied pillar's height (or a configurator lowers it) so it no longer reaches. This checks the LOWEST floor slab / staircase landing that actually sits over the pillar — so a pillar added to carry a stair's turn landings is checked against those landings, and a pillar supporting only a roof (which slopes, no flat datum) or with nothing above is never flagged. (A warning — a deliberately low post under a slab is allowed.)",
    fix:
      "Raise the pillar height so its top meets the slab/landing above it. The warning reports the gap and a suggested height.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C25", "warn");
    const model = ctx.model;
    const slabs = model.byType("floor_slab"); // floor decks AND staircase landings
    const maxGap = Math.max(2 * ctx.defaults.slab_thickness, 16); // tolerate a beam-thickness shortfall
    const eps = 1;

    for (const p of model.byType("pillar")) {
      if (p.raw.enabled === false) continue;
      // Floor slabs / landings that sit ABOVE the pillar base and over it in plan.
      const above = slabs.filter(
        (s) => s.z.lo > p.z.lo + eps && footprintsOverlap(s.footprint, p.footprint),
      );
      if (above.length === 0) continue; // roof / nothing above — no reach check
      // Cap the target at the IMMEDIATE floor-above deck (a non-landing slab): a
      // pillar is not expected to reach slabs on floors beyond the next one.
      const deckTops = above.filter((s) => !isLanding(s)).map((s) => s.z.lo);
      const cap = deckTops.length ? Math.min(...deckTops) : Infinity;
      // Reach the HIGHEST slab/landing at or below that cap — reaching it carries
      // the whole stack under it (so a pillar meant for a stair's turn landings
      // must reach the top landing, not just the low first one).
      const inReach = above.filter((s) => s.z.lo <= cap + eps);
      const target = inReach.reduce((a, s) => (s.z.lo > a.z.lo ? s : a), inReach[0]);

      const gap = target.z.lo - p.z.hi;
      if (gap > maxGap) {
        const kind = isLanding(target) ? "landing" : "slab";
        const suggested = Math.round(num(p.raw.height) + gap);
        report(
          `Pillar ${objLabel(p.raw)} on floor ${p.floor} is short of the ${kind} above it — its top is ${Math.round(gap)} below the underside of that ${kind}, leaving a gap with nothing bearing on it. ` +
            `Raise its height to about ${suggested} so it meets the ${kind}.`,
          { floor: p.floor, where: objLabel(p.raw) },
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
        expect: { count: 1, level: "warn", messageIncludes: "short of the slab" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
// Floor 1 has a pillar; when `slabAbove`, floor 2 carries a deck over it.
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
