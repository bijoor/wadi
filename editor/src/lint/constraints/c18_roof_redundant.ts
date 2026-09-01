// C18 — Don't roof the same area twice.

import { makeReport, num, objLabel, type Bag } from "./vocab";
import {
  ringsToFootprint,
  footprintUnion,
  footprintContains,
  type Footprint,
  type Ring,
} from "../../model/geom";
import type { Constraint } from "./types";

export const C18: Constraint = {
  id: "C18",
  title: "Don't roof the same area twice",
  level: "warn",

  doc: {
    statement:
      "A roof segment should not sit entirely within an area another roof segment already covers.",
    rationale:
      "Each roof segment spans a plan area (its ridge line ± `width`). When a new segment (often a whole new `roof` object an agent added) falls completely inside the area an existing roof already covers, the two roofs overlap — redundant geometry that renders as z-fighting and doubles the material take-off. Almost always the fix is to extend the existing roof, not add another. (Only a segment FULLY inside prior coverage is flagged, so abutting segments and ridge joints in a legitimate multi-segment roof never false-warn.)",
    fix:
      "Remove the redundant roof/segment, or if you meant to cover more area, extend an existing segment's `width`/`end` instead of adding an overlapping one.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C18", "warn");
    const floors = ((ctx.expanded as unknown as Bag).floors as Bag[] | undefined) ?? [];
    const seen: Footprint[] = [];
    for (const fl of floors) {
      for (const o of (fl.objects as Bag[] | undefined) ?? []) {
        if (o.type !== "roof" || o.enabled === false) continue;
        for (const seg of (o.segments as Bag[] | undefined) ?? []) {
          const fp = segmentFootprint(seg);
          if (!fp) continue;
          if (seen.length > 0 && footprintContains(footprintUnion(seen), fp)) {
            const segId = typeof seg.id === "string" ? seg.id : "?";
            report(
              `Roof ${objLabel(o)} segment "${segId}" sits entirely within an area another roof already covers — ` +
                `the two overlap. Remove this redundant roof, or extend the existing roof instead of adding one.`,
              { floor: num(fl.floor_number), where: objLabel(o) },
            );
          }
          seen.push(fp);
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "a single roof segment",
        config: house([roof([seg("s0", [150, 0], [150, 300], 200)])]),
      },
      {
        name: "two abutting segments (an L) — neither inside the other",
        config: house([
          roof([
            seg("s0", [150, 0], [150, 300], 100),
            seg("s1", [300, 300], [600, 300], 100),
          ]),
        ]),
      },
    ],
    fail: [
      {
        name: "a second roof covers the same rectangle",
        config: house([
          roof([seg("s0", [150, 0], [150, 300], 200)]),
          roof([seg("dup", [150, 0], [150, 300], 200)], "Extra"),
        ]),
        expect: { count: 1, level: "warn" },
      },
    ],
  },
};

// A roof segment's plan footprint: the ridge line start→end, extended width/2 to
// each side. (Mirrors C10's helper — overhang/setback are ignored; they only
// enlarge coverage and this check only cares about full containment.)
function segmentFootprint(seg: Bag): Footprint | null {
  const s = seg.start as [number, number] | undefined;
  const e = seg.end as [number, number] | undefined;
  if (!Array.isArray(s) || !Array.isArray(e)) return null;
  const w = num(seg.width);
  if (w <= 0) return null;
  const dx = e[0] - s[0], dy = e[1] - s[1];
  const len = Math.hypot(dx, dy);
  const h = w / 2;
  if (len < 1e-6) {
    return ringsToFootprint([
      [
        { x: s[0] - h, y: s[1] - h },
        { x: s[0] + h, y: s[1] - h },
        { x: s[0] + h, y: s[1] + h },
        { x: s[0] - h, y: s[1] + h },
      ],
    ]);
  }
  const px = -dy / len, py = dx / len;
  const ring: Ring = [
    { x: s[0] + px * h, y: s[1] + py * h },
    { x: e[0] + px * h, y: e[1] + py * h },
    { x: e[0] - px * h, y: e[1] - py * h },
    { x: s[0] - px * h, y: s[1] - py * h },
  ];
  return ringsToFootprint([ring]);
}

// ---- fixture builders -------------------------------------------------------
function house(objects: unknown[]): Record<string, unknown> {
  return { floors: [{ floor_number: 2, name: "Roof", slab_thickness: 0, objects }] };
}
function roof(segments: unknown[], name = "Roof") {
  return { type: "roof", name, roof_type: "pitched", segments };
}
function seg(id: string, start: [number, number], end: [number, number], width: number) {
  return { id, start, end, width };
}
