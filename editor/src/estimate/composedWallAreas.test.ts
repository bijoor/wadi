import { describe, expect, it } from "vitest";
import { composedWallAreas } from "./wallArea";
import { composeWalls, composedFloorInputs } from "../model/composeWalls";
import type { HouseConfig } from "../svg2d/expand";

const H = 90, T = 8;
const eLen = (e: { a: { x: number; y: number }; b: { x: number; y: number } }) =>
  Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);

function cfg(objects: Array<Record<string, unknown>>): HouseConfig {
  return { defaults: { wall_thickness: T, wall_height: H }, floors: [{ floor_number: 0, name: "G", objects }] } as unknown as HouseConfig;
}

describe("composedWallAreas — agrees with the composed render (same faces)", () => {
  const objects = [
    { type: "room", name: "A", x: 4, y: 4, width: 200, length: 240 },
    { type: "room", name: "B", x: 204, y: 4, width: 160, length: 240 },
  ];
  const report = composedWallAreas(cfg(objects));
  // the render side: compose the same floor and sum brick vs interior edges
  const { walls, rooms } = composedFloorInputs(objects, T, H);
  const { edges } = composeWalls(walls, rooms);
  const brickLen = edges.filter((e) => e.brick).reduce((s, e) => s + eLen(e), 0);
  const interiorLen = edges.filter((e) => !e.brick).reduce((s, e) => s + eLen(e), 0);

  it("external gross = brick edge length × wall height", () => {
    expect(report.external.gross).toBeCloseTo(brickLen * H, -1);
  });
  it("internal gross = interior edge length × wall height", () => {
    expect(report.internal.gross).toBeCloseTo(interiorLen * H, -1);
  });
  it("with no openings, net equals gross on both", () => {
    expect(report.external.net).toBeCloseTo(report.external.gross, -1);
    expect(report.internal.net).toBeCloseTo(report.internal.gross, -1);
  });
  it("per-floor areas sum to the totals", () => {
    const ext = report.perFloor.reduce((s, f) => s + f.external.net, 0);
    const int = report.perFloor.reduce((s, f) => s + f.internal.net, 0);
    expect(ext).toBeCloseTo(report.external.net, -1);
    expect(int).toBeCloseTo(report.internal.net, -1);
  });
});

describe("composedWallAreas — an opening reduces both faces of its wall", () => {
  // one room + a south-facing door on its south wall
  const objects = [
    { type: "room", name: "R", x: 0, y: 0, width: 200, length: 200 },
    { type: "door", name: "D", x: 80, y: 200 - T, width: 40, height: 84, direction: "south" },
  ];
  const noDoor = composedWallAreas(cfg([objects[0]]));
  const withDoor = composedWallAreas(cfg(objects));

  it("cuts the door area from the exterior (outer face) and the interior (inner face)", () => {
    const doorArea = 40 * 84;
    // south wall is exterior: outer face brick (external), inner face interior
    expect(noDoor.external.net - withDoor.external.net).toBeCloseTo(doorArea, -1);
    expect(noDoor.internal.net - withDoor.internal.net).toBeCloseTo(doorArea, -1);
  });
});
