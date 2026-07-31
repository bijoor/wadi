import { describe, expect, it } from "vitest";
import type { HouseConfig } from "../svg2d/expand";
import { computeWallAreas } from "./wallArea";

const H = 90; // default wall height
function cfg(objects: Record<string, unknown>[], extra: Record<string, unknown> = {}): HouseConfig {
  return {
    defaults: { wall_height: H, wall_thickness: 8 },
    floors: [{ floor_number: 0, name: "F0", objects }],
    ...extra,
  } as unknown as HouseConfig;
}

describe("computeWallAreas", () => {
  it("single room: all four sides external; inner faces are internal; no gables", () => {
    const r = computeWallAreas(
      cfg([{ type: "room", name: "R", x: 0, y: 0, width: 100, length: 200, walls: { north: {}, south: {}, east: {}, west: {} } }]),
    );
    const perim = H * 2 * (100 + 200); // 54000
    expect(r.external.gross).toBe(perim);
    expect(r.external.openings).toBe(0);
    expect(r.external.net).toBe(perim);
    expect(r.internal.net).toBe(perim); // four inner faces
    expect(r.gables.area).toBe(0);
    expect(r.grandExternal).toBe(perim);
    // inventory: one row per wall, all four external (perimeter), each with an
    // outside face (exterior paint) and an inside face (interior paint).
    expect(r.inventory).toHaveLength(4);
    expect(r.inventory.every((w) => w.type === "external")).toBe(true);
    const west = r.inventory.find((w) => w.wall === "west")!;
    expect(west.extAreaU).toBe(200 * H);
    expect(west.intAreaU).toBe(200 * H);
  });

  it("room with NO walls block counts all four walls (matches the 3D renderer)", () => {
    // A bare room draws a full box in 3D (emitRoomWalls undefined → all 4), so
    // the wall-area report must count all four, not zero.
    const bare = computeWallAreas(cfg([{ type: "room", name: "R", x: 0, y: 0, width: 100, length: 200 }]));
    const all4 = computeWallAreas(
      cfg([{ type: "room", name: "R", x: 0, y: 0, width: 100, length: 200, walls: { north: {}, south: {}, east: {}, west: {} } }]),
    );
    expect(bare.inventory).toHaveLength(4);
    expect(bare.external.net).toBe(all4.external.net);
    expect(bare.internal.net).toBe(all4.internal.net);
  });

  it("inventory labels each wall once: perimeter=external, partition=internal", () => {
    const r = computeWallAreas(
      cfg([
        { type: "room", name: "A", x: 0, y: 0, width: 100, length: 100, walls: { north: {}, south: {}, east: {}, west: {} } },
        { type: "room", name: "B", x: 100, y: 0, width: 100, length: 100, walls: { north: {}, south: {}, east: {}, west: {} } },
      ]),
    );
    const aEast = r.inventory.find((w) => w.room === "A" && w.wall === "east")!;
    expect(aEast.type).toBe("internal");      // partition between A and B
    expect(aEast.extAreaU).toBe(0);
    // Both rooms model the shared wall, so A/east counts only its own inner face
    // (B/west's inner face covers the other side — deduped, not double-counted).
    expect(aEast.intAreaU).toBe(100 * H);
    const aWest = r.inventory.find((w) => w.room === "A" && w.wall === "west")!;
    expect(aWest.type).toBe("external");       // outer perimeter
    expect(aWest.extAreaU).toBe(100 * H);
  });

  it("two adjacent rooms: shared partition is internal (both faces, deduped once)", () => {
    const r = computeWallAreas(
      cfg([
        { type: "room", name: "Living", x: 0, y: 0, width: 150, length: 200, walls: { north: {}, south: {}, east: {}, west: {} } },
        { type: "room", name: "Dining", x: 150, y: 0, width: 150, length: 200, walls: { north: {}, south: {}, east: {}, west: {} } },
      ]),
    );
    // external = outer perimeter only (shared x=150 edge excluded both ways)
    expect(r.external.net).toBe(H * (150 + 150 + 200 + 150 + 150 + 200)); // 90000
    // internal = all 8 inner faces; the two coincident outer faces at x=150 are
    // deduped (each neighbour's inner face already counts that surface).
    expect(r.internal.net).toBe(H * 2 * (150 + 200) * 2); // 126000
  });

  it("openings deduct from the wall's net area (external + internal face)", () => {
    const win = 40 * 30;
    const r = computeWallAreas(
      cfg([{ type: "room", name: "R", x: 0, y: 0, width: 100, length: 100, walls: { north: { openings: [{ width: 40, height: 30 }] }, south: {}, east: {}, west: {} } }]),
    );
    expect(r.external.openings).toBe(win); // outer north face
    expect(r.external.net).toBe(H * 2 * (100 + 100) - win);
    expect(r.internal.openings).toBe(win); // inner north face too
  });

  it("standalone interior partition wall counts both faces as internal", () => {
    // a wall fully inside a big room → both faces look onto the room
    const r = computeWallAreas(
      cfg([
        { type: "room", name: "Hall", x: 0, y: 0, width: 300, length: 300, walls: { north: {}, south: {}, east: {}, west: {} } },
        { type: "wall", name: "Partition", start_x: 150, start_y: 50, end_x: 150, end_y: 250, height: 80 },
      ]),
    );
    // partition: length 200 * height 80 * 2 faces = 32000, all internal, 0 external
    const partitionBoth = 200 * 80 * 2;
    expect(r.internal.net).toBe(H * 2 * (300 + 300) + partitionBoth);
    expect(r.external.net).toBe(H * 2 * (300 + 300)); // only the hall perimeter
  });

  it("respects units block (meters) in conversions", () => {
    const r = computeWallAreas(
      cfg(
        [{ type: "room", name: "R", x: 0, y: 0, width: 100, length: 100, walls: { north: {} } }],
        { units: { system: "meters", per_unit: 100 } },
      ),
    );
    // one wall face: 100 * 90 = 9000 sq units; perUnit 100 → /10000 = 0.9 m²
    expect(r.units.sqLabel).toBe("m²");
    expect(r.units.toDisplay(9000)).toBeCloseTo(0.9, 6);
    expect(r.units.toSqm(9000)).toBeCloseTo(0.9, 6);
  });

  it("skips disabled rooms", () => {
    const r = computeWallAreas(
      cfg([{ type: "room", name: "R", x: 0, y: 0, width: 100, length: 100, enabled: false, walls: { north: {}, south: {}, east: {}, west: {} } }]),
    );
    expect(r.external.net).toBe(0);
    expect(r.internal.net).toBe(0);
  });

  it("emits gable-end triangles for an open-ended pitched roof", () => {
    const r = computeWallAreas(
      cfg([
        { type: "room", name: "R", x: 0, y: 0, width: 200, length: 400, walls: { north: {}, south: {}, east: {}, west: {} } },
        {
          type: "roof", roof_type: "pitched", name: "Roof",
          default_endpoint: "open", min_overhang: 25,
          segments: [{ id: "s0", start: [100, 0], end: [100, 400], width: 200 }],
          slope: { by: "height", ridge_h: 60 },
        },
      ]),
    );
    // two open gable ends, each ≈ 0.5 * base(200) * rise(60) = 6000 → ~12000
    expect(r.gables.area).toBeGreaterThan(0);
    expect(r.gables.rows.length).toBeGreaterThanOrEqual(1);
    expect(r.grandExternal).toBe(r.external.net + r.gables.area);
  });
});
