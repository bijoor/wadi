import { describe, expect, it } from "vitest";
import type { HouseConfig } from "../schema/houseConfig";
import { resolveParametric, formulaFieldError, symbolError } from "./resolve";

// Minimal config shim — resolveParametric only reads variables/points/floors.
function mkConfig(parts: {
  variables?: Record<string, number | string>;
  points?: Record<string, { x: number | string; y: number | string }>;
  objects?: Array<Record<string, unknown>>;
}): HouseConfig {
  return {
    floors: [{ floor_number: 0, name: "F0", objects: parts.objects ?? [] }],
    variables: parts.variables,
    points: parts.points,
  } as unknown as HouseConfig;
}

const obj0 = (config: HouseConfig) =>
  config.floors[0].objects[0] as unknown as Record<string, number>;

describe("resolveParametric", () => {
  it("fast path: non-parametric config returns the SAME reference", () => {
    const cfg = mkConfig({ objects: [{ type: "room", name: "A", x: 1, y: 2, width: 3, length: 4 }] });
    const out = resolveParametric(cfg);
    expect(out.config).toBe(cfg); // identity, not just equality
    expect(out.warnings).toEqual([]);
  });

  it("resolves a variable chain into an object field", () => {
    const cfg = mkConfig({
      variables: { colA: 0, bay: 150, colB: "= colA + bay", colC: "= colB + bay" },
      objects: [{ type: "room", name: "A", x: 0, y: 0, width: 10, length: 10, formulas: { x: "= colC" } }],
    });
    const out = resolveParametric(cfg);
    expect(out.warnings).toEqual([]);
    expect(obj0(out.config).x).toBe(300);
  });

  it("rounds integer fields (num_steps) when a formula resolves to a fraction", () => {
    const cfg = mkConfig({
      variables: { floorH: 98, rise: 5 }, // 98/5 = 19.6 → 20
      objects: [
        { type: "staircase", name: "S", start_x: 0, start_y: 0, num_steps: 1, step_rise: 5, step_tread: 10, step_width: 30, direction: "north", formulas: { num_steps: "= floorH / rise" } },
      ],
    });
    const out = resolveParametric(cfg);
    expect(out.warnings).toEqual([]);
    expect(obj0(out.config).num_steps).toBe(20);
    expect(Number.isInteger(obj0(out.config).num_steps)).toBe(true);
  });

  it("resolves point-field references", () => {
    const cfg = mkConfig({
      variables: { colA: 5, row1: 7 },
      points: { P: { x: "= colA", y: "= row1" } },
      objects: [{ type: "room", name: "A", x: 0, y: 0, width: 1, length: 1, formulas: { x: "= P.x", y: "= P.y" } }],
    });
    const out = resolveParametric(cfg);
    expect(out.warnings).toEqual([]);
    expect(obj0(out.config).x).toBe(5);
    expect(obj0(out.config).y).toBe(7);
  });

  it("exposes point coords as .x/.w and .y/.l synonyms", () => {
    const cfg = mkConfig({
      points: { Size: { x: 150, y: 100 }, Corner: { x: "= 10", y: "= 20" } },
      objects: [
        { type: "room", name: "A", x: 0, y: 0, width: 1, length: 1,
          formulas: { x: "= Corner.X", y: "= Corner.l", width: "= Size.W", length: "= Size.L" } },
      ],
    });
    const out = resolveParametric(cfg);
    expect(out.warnings).toEqual([]);
    const o = obj0(out.config);
    expect(o.x).toBe(10);       // Corner.x
    expect(o.y).toBe(20);       // Corner.l === Corner.y
    expect(o.width).toBe(150);  // Size.w === Size.x
    expect(o.length).toBe(100); // Size.l === Size.y
  });

  it("detects a variable cycle and warns without throwing", () => {
    const cfg = mkConfig({
      variables: { a: "= b", b: "= a" },
      objects: [{ type: "room", name: "A", x: 9, y: 0, width: 1, length: 1, formulas: { x: "= a" } }],
    });
    const out = resolveParametric(cfg);
    expect(out.warnings.some((w) => /circular/i.test(w.message))).toBe(true);
    // The object field couldn't resolve (a is unresolved) → left unchanged.
    expect(obj0(out.config).x).toBe(9);
  });

  it("warns on a bad object-field ref and leaves the field unchanged", () => {
    const cfg = mkConfig({
      variables: { colA: 3 },
      objects: [{ type: "room", name: "A", x: 42, y: 0, width: 1, length: 1, formulas: { x: "= nope" } }],
    });
    const out = resolveParametric(cfg);
    expect(out.warnings.some((w) => w.where === "floor0/obj0/x")).toBe(true);
    expect(obj0(out.config).x).toBe(42);
  });

  it("is idempotent", () => {
    const cfg = mkConfig({
      variables: { colA: 0, bay: 150, colB: "= colA + bay" },
      objects: [{ type: "room", name: "A", x: 0, y: 0, width: 10, length: 10, formulas: { x: "= colB" } }],
    });
    const once = resolveParametric(cfg).config;
    const twice = resolveParametric(once).config;
    expect(obj0(twice).x).toBe(obj0(once).x);
    expect(obj0(twice).x).toBe(150);
  });

  it("resolves site, defaults, plinth-object, and floor-level formulas", () => {
    // The plinth is now an object on the Plinth floor (0); its formula resolves
    // through the generic per-floor-object path, not a top-level container.
    const cfg = {
      variables: { W: 500, story: 100, wt: 9 },
      site: {
        reference_x: 0, reference_y: 0, plot_length: 1, plot_width: 1,
        formulas: { plot_width: "= W", plot_length: "= W" },
      },
      defaults: { wall_thickness: 8, formulas: { wall_thickness: "= wt" } },
      floors: [
        { floor_number: 0, name: "Plinth", height: 30, objects: [
          { type: "plinth", x: 0, y: 0, width: 1, length: 1, height: 30, formulas: { width: "= W" } },
        ] },
        { floor_number: 1, name: "F0", height: 1, formulas: { height: "= story" }, objects: [] },
      ],
    } as unknown as HouseConfig;
    const out = resolveParametric(cfg);
    expect(out.warnings).toEqual([]);
    expect((out.config.site as unknown as Record<string, number>).plot_width).toBe(500);
    expect((out.config.site as unknown as Record<string, number>).plot_length).toBe(500);
    const plinthObj = (out.config.floors[0] as unknown as { objects: Record<string, number>[] }).objects[0];
    expect(plinthObj.width).toBe(500);
    expect((out.config as unknown as { defaults: Record<string, number> }).defaults.wall_thickness).toBe(9);
    expect((out.config.floors[1] as unknown as Record<string, number>).height).toBe(100);
  });

  it("resolves opening formulas (room walls[side] + standalone wall)", () => {
    const cfg = {
      variables: { winW: 60, doorOff: 20 },
      floors: [
        { floor_number: 0, name: "F", objects: [
          { type: "room", name: "R", x: 0, y: 0, width: 200, length: 150, walls: {
              north: { openings: [
                { kind: "window", name: "W1", offset: 0, width: 1, height: 50,
                  formulas: { width: "= winW", offset: "= doorOff + 5" } },
              ] },
            } },
          { type: "wall", name: "WA", start_x: 0, start_y: 0, end_x: 100, end_y: 0,
            openings: [ { kind: "door", offset: 5, width: 1, height: 80, formulas: { width: "= winW / 2" } } ] },
        ] },
      ],
    } as unknown as HouseConfig;
    const out = resolveParametric(cfg);
    expect(out.warnings).toEqual([]);
    const room = out.config.floors[0].objects[0] as unknown as { walls: { north: { openings: Record<string, number>[] } } };
    expect(room.walls.north.openings[0].width).toBe(60);
    expect(room.walls.north.openings[0].offset).toBe(25);
    const wall = out.config.floors[0].objects[1] as unknown as { openings: Record<string, number>[] };
    expect(wall.openings[0].width).toBe(30);
    // source config is untouched (immutable resolve)
    expect((cfg.floors[0].objects[1] as unknown as { openings: Record<string, number>[] }).openings[0].width).toBe(1);
  });

  it("resolves roof segment + slope formulas", () => {
    const cfg = {
      variables: { roofW: 1046, oh: 50, ridge: 250 },
      floors: [
        { floor_number: 0, name: "F", objects: [
          { type: "roof", roof_type: "pitched", name: "R", min_overhang: 1,
            formulas: { min_overhang: "= oh" },
            segments: [
              { id: "s0", start: [0, 0], end: [0, 800], width: 1,
                formulas: { width: "= roofW", hip_setback_start: "= oh / 2" } },
              { id: "s1", start: [0, 800], end: [800, 800], width: 800 },
            ],
            slope: { by: "height", ridge_h: 1, formulas: { ridge_h: "= ridge" } } },
        ] },
      ],
    } as unknown as HouseConfig;
    const out = resolveParametric(cfg);
    expect(out.warnings).toEqual([]);
    const roof = out.config.floors[0].objects[0] as unknown as {
      min_overhang: number; segments: Record<string, number>[]; slope: { ridge_h: number };
    };
    expect(roof.min_overhang).toBe(50);
    expect(roof.segments[0].width).toBe(1046);
    expect(roof.segments[0].hip_setback_start).toBe(25);
    expect(roof.segments[1].width).toBe(800); // untouched
    expect(roof.slope.ridge_h).toBe(250);
  });

  it("formulaFieldError flags unknown refs and syntax errors, null when clean", () => {
    const cfg = mkConfig({ variables: { colA: 0, bay: 150 } });
    expect(formulaFieldError(cfg, "= colA + bay")).toBeNull();
    expect(formulaFieldError(cfg, "= 42")).toBeNull();
    expect(formulaFieldError(cfg, undefined)).toBeNull();
    expect(formulaFieldError(cfg, "= colA + nope")).toMatch(/unknown|unresolved/);
    expect(formulaFieldError(cfg, "= 1 +")).toBeTruthy();
  });

  it("symbolError reports a variable's own error by where-tag", () => {
    const bad = mkConfig({ variables: { a: "= b" } }); // b undefined
    expect(symbolError(bad, "variables/a")).toMatch(/unknown|unresolved/);
    const cyc = mkConfig({ variables: { a: "= b", b: "= a" } });
    expect(symbolError(cyc, "variables/a")).toMatch(/circular/i);
    const ok = mkConfig({ variables: { a: 5, b: "= a" } });
    expect(symbolError(ok, "variables/b")).toBeNull();
  });

  it("two adjacent rooms stay adjacent through a variable change (plan §10)", () => {
    const build = (bay: number | string) =>
      mkConfig({
        variables: { wall_t: 8, colA: 0, bay, colB: "= colA + bay", row1: 0, depth: 200 },
        objects: [
          { type: "room", name: "Living", x: 0, y: 0, width: 0, length: 0,
            formulas: { x: "= colA", y: "= row1", width: "= bay", length: "= depth" } },
          { type: "room", name: "Dining", x: 0, y: 0, width: 0, length: 0,
            formulas: { x: "= colB", y: "= row1", width: "= bay", length: "= depth" } },
        ],
      });

    const r1 = resolveParametric(build(150)).config;
    const living1 = r1.floors[0].objects[0] as unknown as Record<string, number>;
    const dining1 = r1.floors[0].objects[1] as unknown as Record<string, number>;
    expect(dining1.x).toBe(living1.x + living1.width); // 150 === 0 + 150

    const r2 = resolveParametric(build(200)).config;
    const living2 = r2.floors[0].objects[0] as unknown as Record<string, number>;
    const dining2 = r2.floors[0].objects[1] as unknown as Record<string, number>;
    expect(living2.width).toBe(200);
    expect(dining2.x).toBe(living2.x + living2.width); // 200 === 0 + 200, still adjacent
  });
});
