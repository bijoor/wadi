import { describe, it, expect } from "vitest";
import { expandRoomWalls } from "../svg2d/expand";
import { migrateToCurrentVersion } from "./migrateVersion";

// A center-convention room, wall thickness 8, room 100x80 centreline.
//  - south/east: an offset-0 door (worst case: sits in the corner region).
//  - west: a mid-wall door at offset 40 (>= t, so it has an exact v2 spot).
//  - north: a centred window.
function cfg(wadiVersion?: number): Record<string, unknown> {
  return {
    ...(wadiVersion !== undefined ? { wadi_version: wadiVersion } : {}),
    coord_convention: "center",
    defaults: { wall_thickness: 8, wall_height: 100, slab_thickness: 0 },
    floors: [{ floor_number: 1, name: "G", objects: [
      { type: "room", name: "R", x: 100, y: 100, width: 100, length: 80, walls: {
        north: { openings: [{ kind: "window", name: "W", offset: 0, width: 30, height: 40, anchor: "center" }] },
        south: { openings: [{ kind: "door", name: "S", offset: 0, width: 30, height: 70 }] },
        east: { openings: [{ kind: "door", name: "E", offset: 0, width: 30, height: 70 }] },
        west: { openings: [{ kind: "door", name: "Wd", offset: 40, width: 30, height: 70 }] },
      } },
    ] }],
  };
}

// The flat opening objects keyed by name, from a full expansion.
function openings(config: Record<string, unknown>): Record<string, { x: number; y: number }> {
  const out = expandRoomWalls(structuredClone(config)) as { floors: Array<{ objects: Array<Record<string, unknown>> }> };
  const map: Record<string, { x: number; y: number }> = {};
  for (const o of out.floors[0].objects) {
    if (o.type === "door" || o.type === "window") map[o.name as string] = { x: o.x as number, y: o.y as number };
  }
  return map;
}

describe("wadi_version — opening-offset semantics gate", () => {
  it("v1 (absent) anchors a start offset at the OUTER corner", () => {
    const o = openings(cfg());
    // Room grows to outer x=96 y=96; offset 0 lands at the outer corner (96).
    expect(o.S.x).toBe(96);
    expect(o.E.y).toBe(96);
  });

  it("v2 anchors a start offset at the INNER corner (outer + half thickness)", () => {
    const o = openings(cfg(2));
    expect(o.S.x).toBe(100);
    expect(o.E.y).toBe(100);
  });

  it("a centred opening is at the same place under v1 and v2", () => {
    expect(openings(cfg()).W).toEqual(openings(cfg(2)).W);
  });
});

describe("migrateToCurrentVersion — v1 → v2", () => {
  it("bumps the version and keeps a normal (offset >= t) opening pixel-identical", () => {
    const v1 = cfg();
    const before = openings(v1);
    const { config: migrated, changed } = migrateToCurrentVersion(v1);
    expect(changed).toBe(true);
    expect(migrated.wadi_version).toBe(2);
    // The mid-wall west door and the centred north window render in the SAME place.
    expect(openings(migrated).Wd).toEqual(before.Wd);
    expect(openings(migrated).W).toEqual(before.W);
    const room = (migrated.floors as Array<{ objects: Array<Record<string, unknown>> }>)[0].objects.find((o) => o.type === "room") as { walls: Record<string, { openings?: Array<{ offset: number }> }> };
    expect(room.walls.west.openings![0].offset).toBe(36);  // 40 - t/2
    expect(room.walls.north.openings![0].offset).toBe(0);  // center, unchanged
    // A corner opening (offset 0) is preserved exactly now: it shifts to -t/2, the
    // outer corner, which v2 allows (a gap may reach into the corner).
    expect(room.walls.south.openings![0].offset).toBe(-4);
  });

  it("is a no-op on an already-current config", () => {
    const v2 = cfg(2);
    const { changed } = migrateToCurrentVersion(v2);
    expect(changed).toBe(false);
  });
});
