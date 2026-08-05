// Nested & cross-library components: a library component may `use` another
// component (its own sibling, or one from a further import) and place `item`
// furniture from its OWN import — resolved and relocated by the transitive,
// per-module-scoped linker. These exercise the compiler AND the render-time
// expansion (compile → resolveParametric → expandRoomWalls) end-to-end.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { resolveParametric } from "../../editor/src/param/resolve";
import { expandRoomWalls } from "../../editor/src/svg2d/expand";

const here = dirname(fileURLToPath(import.meta.url));
const stdFurniture = readFileSync(resolve(here, "..", "std-modules", "std-furniture.wdl"), "utf8");

// Build a resolver over an in-memory module map, falling back to std-furniture.
const resolverOf = (mods: Record<string, string>) => (ref: string): string | undefined =>
  ref in mods ? mods[ref] : ref === "std-furniture" ? stdFurniture : undefined;

// Compile → resolve → expand a floor's objects to primitives (what renderers see).
function expandFloor0(cfg: Record<string, unknown>) {
  const resolved = resolveParametric(cfg as never).config as never;
  const expanded = expandRoomWalls(resolved, 8) as unknown as { floors: { objects: Record<string, unknown>[] }[] };
  return expanded.floors[0].objects;
}

describe("nested & cross-library components", () => {
  it("a library component may `use` a sibling component (relocated ref)", () => {
    const shapes = `
      component Leg {
        param tall = 30
        pillar Leg at (0, 0) size (6, 6) height tall
      }
      component Table {
        use Leg as "L1" at (0, 0)
        use Leg as "L2" at (40, 0) with { tall = 24 }
        beam name "Top" at (0, 0) size (46, 20) height 4 z_offset 30
      }`;
    const host = `
      house H {
        import "shapes" as s
        floor 1 "G" slab_thickness 0 {
          use s.Table at (100, 100)
        }
      }`;
    const cfg = compileDsl(host, { resolveModule: resolverOf({ shapes }) }) as {
      components: Record<string, { objects: { type: string; ref?: string }[] }>;
    };
    // Both the library's components are emitted, RELOCATED into the `s` namespace.
    expect(Object.keys(cfg.components).sort()).toEqual(["s.Leg", "s.Table"]);
    // Table's inner `use Leg` was relocated to the flat key `s.Leg` (the bug fix).
    const inner = cfg.components["s.Table"].objects.filter((o) => o.type === "component");
    expect(inner.map((o) => o.ref)).toEqual(["s.Leg", "s.Leg"]);

    // End-to-end: expanding the host floor yields 2 legs (pillars) + 1 top (beam).
    const objs = expandFloor0(cfg as never);
    const pillars = objs.filter((o) => o.type === "pillar");
    const beams = objs.filter((o) => o.type === "beam");
    expect(pillars.length).toBe(2);
    expect(beams.length).toBe(1);
    // Placed at the host offset (100,100) + the nested legs' local offsets.
    const xs = pillars.map((p) => p.x).sort((a, b) => (a as number) - (b as number));
    expect(xs).toEqual([100, 140]);
  });

  it("a library component may place an `item` from its OWN import", () => {
    const kit = `
      import "std-furniture" as f
      component Bedroom {
        room Rm at (0, 0) size (200, 200) { wall north east south west }
        item f."bed_double" at (40, 40)
      }`;
    const host = `
      house H {
        import "kit" as k
        floor 1 "G" slab_thickness 0 {
          use k.Bedroom at (0, 0)
        }
      }`;
    const cfg = compileDsl(host, { resolveModule: resolverOf({ kit }) }) as {
      components: Record<string, { objects: { type: string; asset?: { id: string } }[] }>;
    };
    const item = cfg.components["k.Bedroom"].objects.find((o) => o.type === "item");
    // The asset was resolved through the kit module's OWN `f` import and inlined.
    expect(item?.asset?.id).toBe("bed_double");
  });

  it("transitive imports chain (main → A → B) with relocated refs", () => {
    const modB = `
      component Inner {
        pillar P at (0, 0) size (5, 5) height 20
      }`;
    const modA = `
      import "modB" as b
      component Outer {
        use b.Inner at (0, 0)
        use b.Inner at (30, 0)
      }`;
    const host = `
      house H {
        import "modA" as a
        floor 1 "G" slab_thickness 0 {
          use a.Outer at (0, 0)
        }
      }`;
    const cfg = compileDsl(host, { resolveModule: resolverOf({ modA, modB }) }) as {
      components: Record<string, { objects: { type: string; ref?: string }[] }>;
    };
    // B relocated under a.b, A under a; Outer's inner refs point at a.b.Inner.
    expect(Object.keys(cfg.components).sort()).toEqual(["a.Outer", "a.b.Inner"]);
    const refs = cfg.components["a.Outer"].objects.filter((o) => o.type === "component").map((o) => o.ref);
    expect(refs).toEqual(["a.b.Inner", "a.b.Inner"]);
    // Two levels of nesting expand to two pillars.
    const objs = expandFloor0(cfg as never);
    expect(objs.filter((o) => o.type === "pillar").length).toBe(2);
  });

  it("an in-file component may `use` an imported library component", () => {
    const shapes = `
      component Leg {
        pillar P at (0, 0) size (6, 6) height 30
      }`;
    const host = `
      house H {
        import "shapes" as s
        component Frame {
          use s.Leg at (0, 0)
          use s.Leg at (50, 0)
        }
        floor 1 "G" slab_thickness 0 {
          use Frame at (10, 10)
        }
      }`;
    const cfg = compileDsl(host, { resolveModule: resolverOf({ shapes }) }) as {
      components: Record<string, { objects: { type: string; ref?: string }[] }>;
    };
    // Host's own Frame keeps a bare key; the imported Leg is under s.Leg.
    expect(Object.keys(cfg.components).sort()).toEqual(["Frame", "s.Leg"]);
    const refs = cfg.components["Frame"].objects.filter((o) => o.type === "component").map((o) => o.ref);
    expect(refs).toEqual(["s.Leg", "s.Leg"]);
    expect(expandFloor0(cfg as never).filter((o) => o.type === "pillar").length).toBe(2);
  });

  it("detects an import cycle with a clear error", () => {
    const modA = `import "modB" as b\ncomponent A { use b.B at (0,0) }`;
    const modB = `import "modA" as a\ncomponent B { use a.A at (0,0) }`;
    const host = `house H { import "modA" as a floor 1 "G" { use a.A at (0,0) } }`;
    expect(() => compileDsl(host, { resolveModule: resolverOf({ modA, modB }) })).toThrow(/import cycle/);
  });

  it("std-furniture on disk is unaffected + existing sanity", () => {
    expect(existsSync(resolve(here, "..", "std-modules", "std-furniture.wdl"))).toBe(true);
  });
});
