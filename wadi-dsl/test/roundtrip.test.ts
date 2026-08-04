import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { compileDsl } from "../src/generator/toHouseConfig.js";
// The REAL Wadi resolver (pure TS, no zod) — proves the DSL drives the actual
// pipeline, not a parallel reimplementation.
import { resolveParametric } from "../../editor/src/param/resolve";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");

// Every valid sample must compile → resolve → pass the real schema + geometry
// pipeline. (errors.wdl is intentionally broken and covered separately.)
const SAMPLES = ["minimal", "two_room", "two_story", "coastal", "complete"];

function compileAndResolve(name: string) {
  const src = readFileSync(resolve(here, "..", "examples", `${name}.wdl`), "utf8");
  const compiled = compileDsl(src);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return resolveParametric(compiled as any) as { config: any; warnings: any[] };
}

describe("Wadi DSL round-trip", () => {
  for (const name of SAMPLES) {
    it(`${name}: compiles + resolves with no warnings`, () => {
      const { warnings, config } = compileAndResolve(name);
      expect(warnings).toHaveLength(0);
      expect(config.floors.length).toBeGreaterThan(0);
    });

    it(`${name}: passes the real schema + wall/roof pipeline (validate.mjs)`, () => {
      const { config } = compileAndResolve(name);
      const tmp = resolve(here, "..", `.${name}.tmp.wadi`);
      writeFileSync(tmp, JSON.stringify(config));
      const out = execSync(`npx tsx ../wadi-skill/architect/scripts/validate.mjs "${tmp}"`, {
        cwd: resolve(repo, "editor"),
        encoding: "utf8",
      });
      expect(out).toContain("Valid");
    });
  }

  it("coastal: grid formula resolves into numeric fields (Living width = main.x2 - main.x1 = 206)", () => {
    const { config } = compileAndResolve("coastal");
    const living = config.floors.flatMap((f: any) => f.objects).find((o: any) => o.name === "Living");
    expect(living.width).toBe(206);
    expect(living.formulas.width).toBe("= main.x2 - main.x1");
  });

  it("complete: every object type is first-class (no `raw`), + components + layers", () => {
    const src = readFileSync(resolve(here, "..", "examples", "complete.wdl"), "utf8");
    expect(src).not.toContain("raw ");
    const cfg = compileDsl(src) as {
      components: Record<string, unknown>;
      layers: unknown[];
      floors: { objects: { type: string }[] }[];
    };
    // The full discriminated union appears, as real typed objects.
    const types = new Set(cfg.floors.flatMap((f) => f.objects.map((o) => o.type)));
    for (const t of [
      "ground", "plinth", "floor_slab", "beam", "room", "wall",
      "kitchen_platform", "item", "pillar", "component", "roof",
    ]) {
      expect(types.has(t)).toBe(true);
    }
    // Component library + layer registry survive to the config.
    expect(Object.keys(cfg.components)).toContain("Bench");
    expect(cfg.layers.length).toBe(2);
  });

  it("complete: roof segment + truss + enabled gate serialize to the canonical shape", () => {
    const { config } = compileAndResolve("complete");
    const roofObj = config.floors
      .flatMap((f: any) => f.objects)
      .find((o: any) => o.type === "roof");
    expect(roofObj.roof_type).toBe("pitched");
    expect(roofObj.default_endpoint).toBe("open");
    expect(roofObj.slope).toEqual({ by: "angle", angle_deg: 30 });
    expect(roofObj.segments[0].gable_overhang_start).toBe(20);
    expect(roofObj.trusses[0].positions_along).toEqual([80, 200, 320]);
    // roof_style = 2 → the Gable roof's enabled gate resolves to 1 (visible).
    expect(roofObj.enabled).toBe(1);
  });

  it("compact wall syntax: `wall east west north` declares three plain walls in one statement", () => {
    const src = `house W {
      site { plot (200, 200) }
      floor 0 "G" {
        room R at (0, 0) size (100, 100) {
          wall east west north
          wall south { window S at 40 size (40, 40) sill 30 }
        }
      }
    }`;
    const cfg = compileDsl(src) as { floors: { objects: any[] }[] };
    const room = cfg.floors[0].objects.find((o) => o.name === "R");
    expect(Object.keys(room.walls).sort()).toEqual(["east", "north", "south", "west"]);
    // plain sides carry no openings; only the south wall does
    expect(room.walls.east).toEqual({});
    expect(room.walls.south.openings).toHaveLength(1);
  });

  it("item shorthand: a top-level `asset` decl + `item \"id\"` == the inline asset block", () => {
    const shorthand = `house T {
      asset "mybed" src "https://x/bed.glb" dims (1.5, 0.5, 2.0) name "My Bed" category "Bedroom"
      floor 1 "G" {
        room R at (4, 4) size (200, 240) { item "mybed" anchor center }
        item "mybed" at (10, 20) rotation 90
      }
    }`;
    const inline = `house T {
      floor 1 "G" {
        room R at (4, 4) size (200, 240) {
          item asset { id "mybed" src "https://x/bed.glb" dims (1.5, 0.5, 2.0) name "My Bed" category "Bedroom" } anchor center
        }
        item asset { id "mybed" src "https://x/bed.glb" dims (1.5, 0.5, 2.0) name "My Bed" category "Bedroom" } at (10, 20) rotation 90
      }
    }`;
    const a = compileDsl(shorthand) as { floors: { objects: any[] }[] };
    const b = compileDsl(inline) as { floors: { objects: any[] }[] };
    const freeA = a.floors[0].objects.find((o) => o.type === "item");
    const freeB = b.floors[0].objects.find((o) => o.type === "item");
    const roomA = a.floors[0].objects.find((o) => o.type === "room");
    const roomB = b.floors[0].objects.find((o) => o.type === "room");
    // The shorthand emits the byte-identical asset object the inline block does.
    expect(freeA.asset).toEqual(freeB.asset);
    expect(roomA.items[0].asset).toEqual(roomB.items[0].asset);
    expect(freeA.asset).toEqual({
      id: "mybed",
      src: "https://x/bed.glb",
      dimensions: [1.5, 0.5, 2],
      name: "My Bed",
      category: "Bedroom",
    });
  });

  it("item shorthand: an unknown id errors with the available ids", () => {
    const src = `house T {
      asset "mybed" src "https://x/bed.glb" dims (1.5, 0.5, 2.0)
      floor 1 "G" { item "nope" at (10, 20) }
    }`;
    expect(() => compileDsl(src)).toThrow(/unknown asset "nope".*mybed/s);
  });

  describe("module imports (assets)", () => {
    const stdFurniture = `
      asset "bed_double" src "https://r2/bed_double.glb" dims (1.5, 0.5, 2.0) name "Double bed" category "Bedroom"
      asset "chair" src "https://r2/chair.glb" dims (0.5, 0.9, 0.5)
    `;
    const resolveModule = (ref: string) =>
      ref === "std-furniture" ? stdFurniture : undefined;
    const opts = { resolveModule };

    const inlineAsset = {
      id: "bed_double",
      src: "https://r2/bed_double.glb",
      dimensions: [1.5, 0.5, 2],
      name: "Double bed",
      category: "Bedroom",
    };

    it("aliased `item ns.\"id\"` resolves to the imported asset (== inline)", () => {
      const src = `house H {
        import "std-furniture" as f
        floor 1 "G" { room R at (4,4) size (200,240) { item f."bed_double" anchor center } }
      }`;
      const cfg = compileDsl(src, opts) as { floors: { objects: any[] }[] };
      const room = cfg.floors[0].objects.find((o) => o.type === "room");
      expect(room.items[0].asset).toEqual(inlineAsset);
    });

    it("bare `import` brings assets into scope for `item \"id\"`", () => {
      const src = `house H {
        import "std-furniture"
        floor 1 "G" { item "bed_double" at (10,20) }
      }`;
      const cfg = compileDsl(src, opts) as { floors: { objects: any[] }[] };
      const it0 = cfg.floors[0].objects.find((o) => o.type === "item");
      expect(it0.asset).toEqual(inlineAsset);
    });

    it("a house-less module file (assets only, no `house`) parses", () => {
      // std-furniture.wdl itself is a pure module — it must compile without a `house`.
      expect(() => compileDsl(stdFurniture)).not.toThrow();
    });

    it("errors: unknown module, unknown alias, unknown id, and missing resolver", () => {
      const free = (imp: string, ref: string) =>
        `house H { ${imp}\n floor 1 "G" { item ${ref} at (10,20) } }`;
      // module not found on the search path
      expect(() => compileDsl(free(`import "nope" as g`, `g."bed_double"`), opts)).toThrow(
        /import "nope": module not found/,
      );
      // alias that was never imported
      expect(() => compileDsl(free(`import "std-furniture" as f`, `g."bed_double"`), opts)).toThrow(
        /no import is aliased "g"/,
      );
      // id absent from the imported module
      expect(() => compileDsl(free(`import "std-furniture" as f`, `f."nope"`), opts)).toThrow(
        /module "f" declares no "nope"/,
      );
      // imports present but no resolver supplied
      expect(() => compileDsl(free(`import "std-furniture" as f`, `f."bed_double"`))).toThrow(
        /imports need a module resolver/,
      );
    });
  });

  it("errors.wdl reports parse diagnostics (does not throw uncaught)", () => {
    const src = readFileSync(resolve(here, "..", "examples", "errors.wdl"), "utf8");
    expect(() => compileDsl(src)).toThrow(/parse failed/i);
  });
});
