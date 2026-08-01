import { describe, it, expect } from "vitest";
import { lintStructure, type LintFinding } from "./structural";

// Minimal HouseConfig-shaped fixtures (the linter reads a loose shape).
function house(floors: unknown[], defaults?: Record<string, unknown>) {
  return { floors, ...(defaults ? { defaults } : {}) } as never;
}
function rules(findings: LintFinding[]): string[] {
  return findings.map((f) => f.rule).sort();
}

describe("structural lint — C1 plinth floor height", () => {
  const plinthFloor = (extra: Record<string, unknown>) => ({
    floor_number: 0,
    name: "Plinth",
    objects: [{ type: "plinth", name: "P", x: 0, y: 0, width: 100, length: 100, height: 40 }],
    ...extra,
  });

  it("passes when the floor height equals the plinth height", () => {
    const f = lintStructure(house([plinthFloor({ height: 40 })]));
    expect(f.filter((x) => x.rule === "C1")).toHaveLength(0);
  });

  it("errors when the plinth floor sets no explicit height", () => {
    const f = lintStructure(house([plinthFloor({})]));
    const c1 = f.filter((x) => x.rule === "C1");
    expect(c1).toHaveLength(1);
    expect(c1[0].level).toBe("error");
  });

  it("errors when floor height ≠ plinth height (floor above would float)", () => {
    const f = lintStructure(house([plinthFloor({ height: 100 })]));
    const c1 = f.filter((x) => x.rule === "C1");
    expect(c1).toHaveLength(1);
    expect(c1[0].level).toBe("error");
    expect(c1[0].message).toContain("float");
  });
});

describe("structural lint — C3 no slab ⇒ slab_thickness 0", () => {
  const roomFloor = (extra: Record<string, unknown>) => ({
    floor_number: 1,
    name: "Ground",
    objects: [{ type: "room", name: "R", x: 4, y: 4, width: 200, length: 200, walls: ["north", "south", "east", "west"] }],
    ...extra,
  });

  it("errors when a wall/room floor has no slab and a nonzero slab_thickness (default)", () => {
    const f = lintStructure(house([roomFloor({})])); // slab_thickness omitted → default 8
    const c3 = f.filter((x) => x.rule === "C3");
    expect(c3).toHaveLength(1);
    expect(c3[0].level).toBe("error");
  });

  it("passes when slab_thickness is explicitly 0", () => {
    const f = lintStructure(house([roomFloor({ slab_thickness: 0 })]));
    expect(f.filter((x) => x.rule === "C3")).toHaveLength(0);
  });

  it("passes when the floor has a real slab object", () => {
    const floor = roomFloor({});
    (floor.objects as unknown[]).push({ type: "floor_slab", x: 0, y: 0, width: 208, length: 208 });
    const f = lintStructure(house([floor]));
    expect(f.filter((x) => x.rule === "C3")).toHaveLength(0);
  });
});

describe("structural lint — C4 floor height = wall_height + slab_thickness", () => {
  const occupied = (extra: Record<string, unknown>) => ({
    floor_number: 1,
    name: "Ground",
    objects: [
      { type: "floor_slab", x: 0, y: 0, width: 200, length: 200 },
      { type: "room", name: "R", x: 4, y: 4, width: 190, length: 190, walls: ["north", "south", "east", "west"] },
    ],
    ...extra,
  });
  const above = { floor_number: 2, name: "Upper", objects: [] };

  it("warns when height ≠ wall_height + slab_thickness (gap over the walls)", () => {
    const f = lintStructure(house([occupied({ height: 120, wall_height: 108, slab_thickness: 8 }), above]));
    const c4 = f.filter((x) => x.rule === "C4");
    expect(c4).toHaveLength(1);
    expect(c4[0].level).toBe("warn");
    expect(c4[0].message).toContain("gap");
  });

  it("passes when height == wall_height + slab_thickness", () => {
    const f = lintStructure(house([occupied({ height: 116, wall_height: 108, slab_thickness: 8 }), above]));
    expect(f.filter((x) => x.rule === "C4")).toHaveLength(0);
  });

  it("does not apply to the topmost floor (nothing sits on its walls)", () => {
    const f = lintStructure(house([occupied({ height: 120, wall_height: 108, slab_thickness: 8 })]));
    expect(f.filter((x) => x.rule === "C4")).toHaveLength(0);
  });
});

describe("structural lint — C2 rooms must wall every exterior side", () => {
  const single = (walls: unknown) => ({
    floor_number: 1,
    name: "Ground",
    slab_thickness: 0, // isolate C2 from C3
    objects: [{ type: "room", name: "Studio", x: 4, y: 4, width: 200, length: 200, ...(walls === undefined ? {} : { walls }) }],
  });

  it("does not warn for a bare room (no walls block = enclosed on all four)", () => {
    const f = lintStructure(house([single(undefined)]));
    expect(f.filter((x) => x.rule === "C2")).toHaveLength(0);
  });

  it("warns for each exterior side left open by a partial walls list", () => {
    const f = lintStructure(house([single(["north", "south"])]));
    const c2 = f.filter((x) => x.rule === "C2");
    // east + west face outside and are undeclared → two warnings
    expect(c2).toHaveLength(2);
    expect(c2.every((x) => x.level === "warn")).toBe(true);
    expect(rules(f)).toEqual(["C2", "C2"]);
  });

  it("does not warn when all four sides are declared", () => {
    const f = lintStructure(house([single(["north", "south", "east", "west"])]));
    expect(f.filter((x) => x.rule === "C2")).toHaveLength(0);
  });

  it("does not warn for an exterior side already walled by an overlapping/adjacent room", () => {
    // Bath sits in Big's corner; Bath declares only south+west, but its north and
    // east lines are already walled by Big — so those sides are NOT open.
    const floor = {
      floor_number: 1,
      name: "Ground",
      slab_thickness: 0,
      objects: [
        { type: "room", name: "Big", x: 0, y: 0, width: 200, length: 200, walls: ["north", "south", "east", "west"] },
        { type: "room", name: "Bath", x: 100, y: 0, width: 100, length: 100, walls: ["south", "west"] },
      ],
    };
    const f = lintStructure(house([floor]));
    expect(f.filter((x) => x.rule === "C2")).toHaveLength(0);
  });

  it("does not warn for an interior (shared) side left open", () => {
    // Two abutting rooms; Bedroom's west side is shared with Living (interior),
    // so leaving it undeclared must NOT warn — only its exterior sides can.
    const floor = {
      floor_number: 1,
      name: "Ground",
      slab_thickness: 0,
      objects: [
        { type: "room", name: "Living", x: 0, y: 0, width: 200, length: 200, walls: ["north", "south", "west", "east"] },
        { type: "room", name: "Bedroom", x: 200, y: 0, width: 200, length: 200, walls: ["north", "south", "east"] },
      ],
    };
    const f = lintStructure(house([floor]));
    const c2 = f.filter((x) => x.rule === "C2");
    // Bedroom omits only its WEST side, which is shared with Living → no warning.
    expect(c2).toHaveLength(0);
  });
});
