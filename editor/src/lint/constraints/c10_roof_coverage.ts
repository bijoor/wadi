// C10 — The roof should cover the rooms of the top occupied floor.

import { makeReport, num, objLabel, type Bag } from "./vocab";
import {
  ringsToFootprint,
  footprintUnion,
  footprintsOverlap,
  type Footprint,
  type Ring,
} from "../../model/geom";
import type { Constraint } from "./types";

export const C10: Constraint = {
  id: "C10",
  title: "The roof should cover the rooms of the top occupied floor",
  level: "warn",

  doc: {
    statement:
      "Every room on the top occupied floor should sit under a roof segment — no room left entirely uncovered.",
    rationale:
      "The roof's segments span a plan area (each segment's ridge line ± its `width`). A room on the top floor whose footprint does not overlap **any** roof segment has open sky above it — usually a roof that was sized to the wrong footprint, or a room added after the roof. (Only a *completely* uncovered room is flagged, so eave overhangs and partial coverage never false-warn; a house with no roof at all — a terrace — is not flagged.)",
    fix:
      "Extend or add a roof segment to span the room, or reduce the room. Roof segments cover `start → end` along the ridge, `width` across it, so grow `width`/`end` (or the plot variables they derive from) until the room is under it.",
  },

  check(ctx) {
    const { findings, report } = makeReport("C10", "warn");
    const model = ctx.model;

    // Roof coverage = union of every (enabled) roof segment's plan rectangle.
    const roofFps: Footprint[] = [];
    const floors = ((ctx.expanded as unknown as Bag).floors as Bag[] | undefined) ?? [];
    for (const fl of floors) {
      for (const o of (fl.objects as Bag[] | undefined) ?? []) {
        if (o.type !== "roof" || o.enabled === false) continue;
        for (const seg of (o.segments as Bag[] | undefined) ?? []) {
          const fp = segmentFootprint(seg);
          if (fp) roofFps.push(fp);
        }
      }
    }
    if (roofFps.length === 0) return findings; // no roof modelled (terrace) — nothing to check
    const roof = footprintUnion(roofFps);

    // Rooms of the TOP occupied floor (highest floor_number that has a room).
    const rooms = model.byType("room");
    if (rooms.length === 0) return findings;
    const topFloor = Math.max(...rooms.map((r) => r.floor));
    for (const room of rooms.filter((r) => r.floor === topFloor)) {
      if (!footprintsOverlap(room.footprint, roof)) {
        report(
          `Room ${objLabel(room.raw)} on floor ${room.floor} sits entirely outside the roof — it has open sky ` +
            `above it. Extend a roof segment to span it (or the plot variables its width/extent derive from).`,
          { floor: room.floor, where: objLabel(room.raw) },
        );
      }
    }
    return findings;
  },

  fixtures: {
    pass: [
      {
        name: "roof segment spans the room",
        config: house([room(0, 0, 100, 100)], [roofSeg([50, 0], [50, 100], 100)]),
      },
      {
        name: "no roof at all (terrace) is not flagged",
        config: house([room(0, 0, 100, 100)], []),
      },
    ],
    fail: [
      {
        name: "a room sits entirely off the roof",
        config: house([room(0, 0, 100, 100)], [roofSeg([550, 0], [550, 100], 100)]),
        expect: { count: 1, level: "warn" },
      },
    ],
  },
};

// A roof segment's plan footprint: the ridge line start→end, extended width/2 to
// each side. (Overhang/setback are ignored — they only enlarge coverage, and C10
// only flags a room with ZERO overlap, so ignoring them cannot false-warn.)
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
  const px = -dy / len, py = dx / len; // unit normal
  const ring: Ring = [
    { x: s[0] + px * h, y: s[1] + py * h },
    { x: e[0] + px * h, y: e[1] + py * h },
    { x: e[0] - px * h, y: e[1] - py * h },
    { x: s[0] - px * h, y: s[1] - py * h },
  ];
  return ringsToFootprint([ring]);
}

function house(floor1Objs: unknown[], roofObjs: unknown[]): Record<string, unknown> {
  return {
    floors: [
      {
        floor_number: 1,
        name: "Ground",
        slab_thickness: 0,
        objects: [...floor1Objs, ...roofObjs],
      },
    ],
  };
}
function room(x: number, y: number, width: number, length: number) {
  return { type: "room", name: "R", x, y, width, length, walls: ["north", "south", "east", "west"] };
}
function roofSeg(start: [number, number], end: [number, number], width: number) {
  return { type: "roof", name: "Roof", segments: [{ id: "seg0", start, end, width }] };
}
