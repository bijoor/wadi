// Tests for the ported furniture auto-placement engine (editor/src/furniture/autoplace.ts).
// Covers the algorithms carried over from the floor-planner (door shift/drop, maximize-kept,
// gaps-as-soft, four-rotation) plus the port-specific fixes: geometry runs on the real
// `anchorItem`, and the AABB uses the RESOLVED rotation (`rotation ?? anchorFacing`) — the
// regression that the planner mirror got wrong.

import { describe, it, expect } from "vitest";
import { metersToUnits } from "../three/units";
import type { RoomRect } from "../svg2d/furnitureAnchor";
import {
  autoplaceRoom,
  pickLayout,
  placePieces,
  canPlaceByGeometry,
  rotatePieceCW,
  rotateLayoutCW,
  pieceFootprint,
  openingIntervals,
  type Layout,
  type Piece,
  type FurnitureAsset,
  type FlatOpening,
} from "./autoplace";

const UNITS = { system: "feet_inches", per_unit: 10 };
const upm = metersToUnits(1, UNITS); // ~32.8 units per metre
const ROOM: RoomRect = { x: 0, y: 0, w: 200, l: 160 };
const WALL_T = 8;

const asset = (id: string, w: number, d: number): FurnitureAsset => ({ id, name: id, dimensions: [w, 0, d] });
const bed = (over: Partial<Piece> = {}): Piece => ({ asset: asset("bed", 1.5, 2), anchor: "top-center", ...over });

// Intervals covering EVERY wall's full span, so a layout cannot rotate a piece onto a clear
// wall — the engine rotates to dodge a single opening, so a forced drop needs all walls blocked.
const N_S: [number, number][] = [[0, 200]]; // along X (room width)
const E_W: [number, number][] = [[0, 160]]; // along Y (room length)
const allWalls = () => ({ north: [...N_S], south: [...N_S], east: [...E_W], west: [...E_W] });

describe("pieceFootprint — rotation resolves to anchorFacing (the mirror bug)", () => {
  it("a side-anchored piece with NO explicit rotation gets the rotated (swapped) footprint", () => {
    // center-left → anchorFacing 90°, so a 1m×3m asset turns: half-EXTENT along X becomes the
    // 3m depth, along Y the 1m width. The old mirror bug used rotation 0 and swapped these.
    const fp = pieceFootprint({ asset: asset("shelf", 1, 3), anchor: "center-left" }, ROOM, WALL_T, UNITS);
    expect(fp.halfX).toBeCloseTo((3 / 2) * upm, 3); // depth spans X after the 90° turn
    expect(fp.halfY).toBeCloseTo((1 / 2) * upm, 3); // width spans Y
    expect(fp.halfX).toBeGreaterThan(fp.halfY);
  });

  it("an explicit rotation overrides the anchor's default facing", () => {
    const implicit = pieceFootprint({ asset: asset("shelf", 1, 3), anchor: "center-left" }, ROOM, WALL_T, UNITS);
    const explicit = pieceFootprint({ asset: asset("shelf", 1, 3), anchor: "center-left", rotation: 0 }, ROOM, WALL_T, UNITS);
    expect(explicit.halfX).toBeCloseTo((1 / 2) * upm, 3); // rotation 0 → width spans X
    expect(explicit.halfX).not.toBeCloseTo(implicit.halfX, 1);
  });
});

describe("geometry-aware placement works WITHOUT explicit units (regression)", () => {
  // A config with no `units` line has units === undefined (it defaults to feet_inches /
  // per_unit 10). Door-aware placement must still run — requiring units in
  // canPlaceByGeometry silently dropped furniture onto the doors for any unit-less config.
  it("canPlaceByGeometry does not require units", () => {
    expect(canPlaceByGeometry({ rect: ROOM, wallT: WALL_T, doorIntervals: {} })).toBe(true);
  });

  it("autoplaceRoom shifts a piece off a door even when units is undefined", () => {
    const doors = { north: [[85, 115]] as [number, number][] }; // centred on the north wall
    const layout: Layout = { id: "b", type: "bedroom", w: 100, l: 100, pieces: [bed()] };
    // NOTE: no `units` in the context — mirrors a config that declares none.
    const res = autoplaceRoom([layout], "bedroom", { rect: ROOM, wallT: WALL_T, doorIntervals: doors });
    expect(res.items).toHaveLength(1);
    const bedItem = res.items[0];
    // it was moved off centre (placement ran); its footprint clears the door span
    expect(bedItem.gap_x ?? 0).not.toBe(0);
    const fp = pieceFootprint(bedItem, ROOM, WALL_T, undefined);
    expect(fp.x1 <= 85 + 2 || fp.x0 >= 115 - 2).toBe(true);
  });
});

describe("placePieces — door shift / drop", () => {
  it("slides a piece off a door it overlaps and KEEPS it", () => {
    const doors = { north: [[90, 130]] as [number, number][] };
    const before = pieceFootprint(bed(), ROOM, WALL_T, UNITS);
    expect(before.x1).toBeGreaterThan(90); // authored bed overlaps the door span
    const placed = placePieces([bed()], ROOM, WALL_T, UNITS, doors);
    expect(placed).toHaveLength(1); // kept, not dropped
    const after = pieceFootprint(placed[0], ROOM, WALL_T, UNITS);
    // cleared: footprint no longer overlaps [90,130] (within the CLEAR=2 slack)
    expect(after.x1 <= 90 + 2 || after.x0 >= 130 - 2).toBe(true);
  });

  it("drops a piece when the door leaves no clear span on its wall", () => {
    const doors = { north: [[40, 160]] as [number, number][] };
    const placed = placePieces([bed()], ROOM, WALL_T, UNITS, doors);
    expect(placed).toHaveLength(0);
  });

  it("never drops a freestanding (center) piece — it touches no wall", () => {
    const doors = { north: [[40, 160]] as [number, number][] };
    const table: Piece = { asset: asset("table", 1, 1), anchor: "center" };
    expect(placePieces([table], ROOM, WALL_T, UNITS, doors)).toHaveLength(1);
  });
});

describe("pickLayout — maximise furniture kept, gaps only break ties", () => {
  const wideDoorCtx = {
    rect: ROOM,
    wallT: WALL_T,
    units: UNITS,
    doorIntervals: allWalls(), // every wall blocked, so no rotation can save a wall-anchored piece
  };

  it("prefers the arrangement that survives placement", () => {
    // A: one bed on a wall (every wall blocked, every rotation) → dropped, kept 0.
    // B: one table in the centre → kept 1. B must win.
    const A: Layout = { id: "A", type: "bedroom", w: 100, l: 100, pieces: [bed()] };
    const B: Layout = { id: "B", type: "bedroom", w: 100, l: 100, pieces: [{ asset: asset("table", 1, 1), anchor: "center" }] };
    expect(pickLayout([A, B], "bedroom", wideDoorCtx)?.id).toBe("B");
  });

  it("a soft GAP never drops a piece (kept unaffected), only breaks ties", () => {
    const gapCtx = {
      rect: ROOM,
      wallT: WALL_T,
      units: UNITS,
      doorIntervals: {}, // no hard doors
      gapIntervals: allWalls(), // a soft gap on every wall
    };
    // The bed sits on a gap but is NOT dropped — a gap is soft.
    const placed = placePieces([bed()], ROOM, WALL_T, UNITS, {});
    expect(placed).toHaveLength(1);
    // Equal kept (1 each), but the wall-anchored bed always overlaps a gap while the centre
    // table never does, so the gap-free layout wins the tie.
    const onGap: Layout = { id: "onGap", type: "bedroom", w: 100, l: 100, pieces: [bed()] };
    const offGap: Layout = { id: "offGap", type: "bedroom", w: 100, l: 100, pieces: [{ asset: asset("table", 1, 1), anchor: "center" }] };
    expect(pickLayout([onGap, offGap], "bedroom", gapCtx)?.id).toBe("offGap");
  });

  it("returns null for an unknown room type", () => {
    expect(pickLayout([{ id: "A", type: "bedroom", w: 100, l: 100, pieces: [] }], "kitchen", {})).toBeNull();
  });
});

describe("rotateLayoutCW / rotatePieceCW", () => {
  it("swaps the target dimensions and rotates each piece", () => {
    const layout: Layout = { id: "L", type: "bedroom", w: 110, l: 120, pieces: [bed({ anchor: "top-center", gap_x: 0, gap_y: 4 })] };
    const r = rotateLayoutCW(layout);
    expect([r.w, r.l]).toEqual([120, 110]);
    expect(r.rotated).toBe(true);
    expect(r.pieces[0].anchor).toBe("center-right"); // top-center → center-right (90° CW)
  });

  it("sets an explicit rotation on the rotated piece", () => {
    const p = rotatePieceCW({ asset: asset("bed", 1.5, 2), anchor: "top-center" }); // facing 0
    expect(p.anchor).toBe("center-right");
    expect(p.rotation).toBe(270); // (0 + 270) % 360
  });
});

describe("openingIntervals — group expanded openings per side", () => {
  it("splits doors (hard) from gaps (soft) and ignores windows", () => {
    const openings: FlatOpening[] = [
      { type: "door", direction: "north", x: 90, y: 8, width: 40 },
      { type: "gap", direction: "east", x: 192, y: 50, width: 30 },
      { type: "window", direction: "south", x: 20, y: 152, width: 40 },
    ];
    const { doorIntervals, gapIntervals } = openingIntervals(openings);
    expect(doorIntervals.north).toEqual([[90, 130]]); // along X
    expect(gapIntervals.east).toEqual([[50, 80]]); // along Y
    expect(doorIntervals.south).toBeUndefined(); // window ignored
    expect(gapIntervals.north).toBeUndefined();
  });
});

describe("autoplaceRoom — end to end", () => {
  it("furnishes a typed room, dropping only the pieces that cannot clear a door", () => {
    const layout: Layout = {
      id: "bedroom_s",
      type: "bedroom",
      w: 110,
      l: 120,
      pieces: [bed(), { asset: asset("table", 1, 1), anchor: "center" }],
    };
    const res = autoplaceRoom([layout], "bedroom", { rect: ROOM, wallT: WALL_T, units: UNITS, doorIntervals: allWalls() });
    expect(res.template).toBe("bedroom_s");
    // the bed cannot clear a door on any wall (all blocked, all rotations) → dropped; the
    // centre table touches no wall → survives
    expect(res.items.map((i) => i.asset.id)).toEqual(["table"]);
  });

  it("returns an empty result for a plain room (no layout of that type)", () => {
    expect(autoplaceRoom([], "bedroom", {}).items).toEqual([]);
  });
});
