// C17 — A hip roof segment's span should not exceed its ridge run.

import { makeReport, num, objLabel, type Bag } from "./vocab";
import {
  resolveEndpoints,
  isLeafEndpoint,
  segmentLength,
} from "../../svg2d/roof/v2/segments";
import type { RoofSegment } from "../../svg2d/roof/v2/model";
import type { Constraint } from "./types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export const C17: Constraint = {
  id: "C17",
  title: "A hip roof segment's span should not exceed its ridge run",
  level: "warn",

  doc: {
    statement:
      "On a pitched roof with closed (hip) ends, a segment's span (`width`) should not exceed its ridge run (the `start`→`end` length).",
    rationale:
      "A closed hip end pulls the ridge inward by half the span to make room for the hip face. When the span exceeds the run, the two hip ends would meet past the centre, so the roof is clipped to a pyramid (the hip faces meet at a single apex) rather than the intended ridged hip. That is almost always a mis-oriented segment — the ridge drawn along the SHORTER dimension. It still renders as a valid pyramid, so this only warns.",
    fix:
      "Orient the ridge along the LONGER dimension: swap the segment's `start`/`end` so it runs the long way, and set `width` to the shorter span. If a pyramid is genuinely intended, ignore this.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C17", "warn");
    const floors = ((ctx.expanded as unknown as Bag).floors as Bag[] | undefined) ?? [];
    for (const fl of floors) {
      for (const o of (fl.objects as Bag[] | undefined) ?? []) {
        if (o.type !== "roof" || o.enabled === false) continue;
        // Only pitched roofs form hip faces; flat/shed never collapse this way.
        if (o.roof_type !== "pitched") continue;
        const segsRaw = (o.segments as Bag[] | undefined) ?? [];
        if (segsRaw.length === 0) continue;
        const defaultEndpoint = (o.default_endpoint as string) ?? "closed";
        const segs = segsRaw as unknown as RoofSegment[];
        const endpoints = resolveEndpoints(segs);

        for (const seg of segs) {
          const len = segmentLength(seg);
          if (!(len > 0)) continue;
          const crossHalf =
            seg.width_left != null && seg.width_right != null
              ? (seg.width_left + seg.width_right) / 2
              : seg.width / 2;
          // Only a CLOSED LEAF endpoint pulls the ridge inward (joints and open
          // gable ends contribute no setback), matching derivePitched exactly.
          const startClosed =
            isLeafEndpoint(endpoints, seg.id, "start") &&
            ((seg.start_endpoint ?? defaultEndpoint) === "closed");
          const endClosed =
            isLeafEndpoint(endpoints, seg.id, "end") &&
            ((seg.end_endpoint ?? defaultEndpoint) === "closed");
          const sbStart = startClosed ? (seg.hip_setback_start ?? crossHalf) : 0;
          const sbEnd = endClosed ? (seg.hip_setback_end ?? crossHalf) : 0;
          // The collapse happens when the two setbacks would cross (sum > run).
          // Epsilon so an exact square (sum == run, a natural pyramid) is fine.
          if (sbStart + sbEnd > len + 1e-6) {
            const w = round(seg.width);
            report(
              `Roof ${objLabel(o)} segment "${seg.id}" has a span (width ${w}) wider than its ridge run (${round(len)}). ` +
                `With closed hip ends it collapses to a pyramid — the hip faces are clipped to the centre. ` +
                `Orient the ridge along the longer dimension: swap the segment's start/end and set width to the shorter span.`,
              { floor: num(fl.floor_number), where: objLabel(o) },
            );
          }
        }
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "ridge run longer than the span (a normal hip)",
        config: house([roof([seg("s0", [150, 0], [150, 500], 300)])]),
      },
      {
        name: "span wider than run but with open gable ends (no hip setback)",
        config: house([
          roof([seg("s0", [200, 0], [200, 320], 400)], { default_endpoint: "open" }),
        ]),
      },
      {
        name: "a flat roof is never checked",
        config: house([
          { type: "roof", name: "Flat", roof_type: "flat", segments: [seg("s0", [200, 0], [200, 320], 400)] },
        ]),
      },
    ],
    fail: [
      {
        name: "closed hip whose span exceeds its ridge run collapses to a pyramid",
        config: house([roof([seg("s0", [200, 0], [200, 320], 400)])]),
        expect: { count: 1, level: "warn", messageIncludes: "pyramid" },
      },
    ],
  },
};

// ---- fixture builders -------------------------------------------------------
function house(objects: unknown[]): Record<string, unknown> {
  return { floors: [{ floor_number: 2, name: "Roof", slab_thickness: 0, objects }] };
}
function roof(segments: unknown[], extra: Record<string, unknown> = {}) {
  return {
    type: "roof",
    name: "Roof",
    roof_type: "pitched",
    default_endpoint: "closed",
    segments,
    ...extra,
  };
}
function seg(
  id: string,
  start: [number, number],
  end: [number, number],
  width: number,
  extra: Record<string, unknown> = {},
) {
  return { id, start, end, width, ...extra };
}
