import { describe, it, expect } from "vitest";
import { roomBlocksOf, sharesWall, connectionSatisfied, edgeList, type RoomBlock } from "./graphModel";
import type { HouseConfig } from "../schema/houseConfig";

const blk = (name: string, x: number, y: number, w: number, l: number, connections: string[] = [], walls?: unknown): RoomBlock =>
  ({ index: 0, name, x, y, w, l, connections, walls });

describe("graphModel.sharesWall", () => {
  it("abutting rooms (center convention, edges coincide) share a wall", () => {
    expect(sharesWall(blk("A", 0, 0, 120, 100), blk("B", 120, 0, 100, 80))).toBe(true);
  });
  it("overlapping rooms (corner convention) share a wall", () => {
    expect(sharesWall(blk("A", 0, 0, 120, 100), blk("B", 112, 0, 100, 80))).toBe(true);
  });
  it("a gap between rooms means no shared wall", () => {
    expect(sharesWall(blk("A", 0, 0, 120, 100), blk("B", 180, 0, 100, 100))).toBe(false);
  });
  it("a corner-only touch (shared point, no edge overlap) is NOT a shared wall", () => {
    expect(sharesWall(blk("A", 0, 0, 100, 100), blk("B", 100, 100, 100, 100))).toBe(false);
  });
});

describe("graphModel.connectionSatisfied (the C11 rule)", () => {
  const door = (side: string, offset: number, width: number) => ({ [side]: { openings: [{ kind: "door", offset, width }] } });
  // A (0..120 x, 0..100 y) and B (120..220 x) abut on A-east / B-west; overlap y 0..80.
  const A = (walls?: unknown) => blk("A", 0, 0, 120, 100, ["B"], walls);
  const B = (walls?: unknown) => blk("B", 120, 0, 100, 80, [], walls);

  it("door in the overlap → satisfied", () => {
    expect(connectionSatisfied(A(door("east", 20, 40)), B())).toBe(true);
  });
  it("door authored on the neighbour's side → satisfied", () => {
    expect(connectionSatisfied(A(), B(door("west", 20, 40)))).toBe(true);
  });
  it("both rooms omit the shared wall → open passage, satisfied", () => {
    expect(connectionSatisfied(A({ north: {}, south: {}, west: {} }), B({ north: {}, south: {}, east: {} }))).toBe(true);
  });
  it("walls present, no door → NOT satisfied (blocked)", () => {
    expect(connectionSatisfied(A(), B())).toBe(false); // both default (all walls), no door
  });
  it("one room walls the side (no door), the other leaves it open → still blocked", () => {
    expect(connectionSatisfied(A(), B({ north: {}, south: {}, east: {} }))).toBe(false);
  });
  it("door outside the overlap span → NOT satisfied", () => {
    // overlap is y 0..80; a door at y 85..120 is off it.
    expect(connectionSatisfied(A(door("east", 85, 35)), B())).toBe(false);
  });
  it("rooms not adjacent (a gap) → NOT satisfied", () => {
    expect(connectionSatisfied(blk("A", 0, 0, 100, 100, ["B"]), blk("B", 180, 0, 100, 100))).toBe(false);
  });
});

describe("graphModel.edgeList", () => {
  it("dedupes A→B and B→A into one undirected edge", () => {
    const blocks = [blk("A", 0, 0, 1, 1, ["B"]), blk("B", 0, 0, 1, 1, ["A"]), blk("C", 0, 0, 1, 1, ["A"])];
    const names = edgeList(blocks).map(([a, b]) => [a.name, b.name].sort().join("|")).sort();
    expect(names).toEqual(["A|B", "A|C"]);
  });
  it("ignores self-references and unknown room names", () => {
    const blocks = [blk("A", 0, 0, 1, 1, ["A", "Ghost", "B"]), blk("B", 0, 0, 1, 1)];
    expect(edgeList(blocks).map(([a, b]) => `${a.name}|${b.name}`)).toEqual(["A|B"]);
  });
});

describe("graphModel.roomBlocksOf", () => {
  it("extracts only rooms, with geometry + connections, from a floor", () => {
    const config = {
      floors: [{ floor_number: 1, name: "G", objects: [
        { type: "room", name: "Living", x: 0, y: 0, width: 120, length: 100, connections: ["Kitchen"] },
        { type: "wall", name: "W", start_x: 0, start_y: 0, end_x: 10, end_y: 0 },
        { type: "room", name: "Kitchen", x: 120, y: 0, width: 100, length: 80 },
      ] }],
    } as unknown as HouseConfig;
    const blocks = roomBlocksOf(config, 0);
    expect(blocks.map((b) => b.name)).toEqual(["Living", "Kitchen"]);
    expect(blocks[0]).toMatchObject({ index: 0, x: 0, y: 0, w: 120, l: 100, connections: ["Kitchen"] });
    expect(blocks[1].index).toBe(2); // object index within the floor (skips the wall)
    expect(blocks[1].connections).toEqual([]);
  });
});
