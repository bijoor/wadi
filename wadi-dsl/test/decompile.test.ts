// Decompiler round-trip: emit(cfg) must produce .wdl that rebuilds the SAME house.
//
// The correctness oracle is the RESOLVED + EXPANDED floors (the actual geometry) —
// compile(emit(cfg)) must expand to byte-identical floor objects. For DSL-authored
// examples WITHOUT imports the raw config is exact too; import-using examples
// legitimately differ only in the `components` LIBRARY dict (imports are inlined
// and namespaces flattened → a self-contained file), which the geometry oracle
// ignores because expansion inlines components anyway.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { compileDsl } from "../src/generator/toHouseConfig.js";
import { emitWdl } from "../src/generator/fromHouseConfig.js";
import { resolveParametric } from "../../editor/src/param/resolve";
import { expandRoomWalls } from "../../editor/src/svg2d/expand";

const here = dirname(fileURLToPath(import.meta.url));
const stdResolve = (ref: string): string | undefined => {
  const p = resolve(here, "../std-modules", `${ref}.wdl`);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
};
const opts = { resolveModule: stdResolve };

// Normalize for a GEOMETRY comparison: compare the RESOLVED values that render.
//  - object key order is irrelevant (form-authored .wadi orders keys differently);
//  - a room's expanded `walls` is a SET of sides (order irrelevant);
//  - drop `formulas` (parametric PROVENANCE) — a form-authored .wadi stores the
//    same formula in a different textual form (parenthesisation) than the
//    compiler's serializer, but both resolve to the same number, which is what
//    the house actually is. (The examples' exact-raw check below still verifies
//    formulas byte-for-byte when both sides come from the compiler.)
// Everything else keeps array order (object z-order, segments, openings, path…).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function norm(x: any): any {
  if (Array.isArray(x)) return x.map(norm);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(x).sort()) {
      if (k === "formulas") continue;
      o[k] = k === "walls" && Array.isArray(x[k]) ? [...x[k]].sort() : norm(x[k]);
    }
    return o;
  }
  return x;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const floors = (cfg: any): string =>
  JSON.stringify(norm(expandRoomWalls(resolveParametric(cfg).config, undefined, { lenient: true }).floors));

// Examples whose config has no imports → the raw config round-trips exactly.
const NO_IMPORT = new Set(["coastal.wdl", "minimal.wdl", "two_room.wdl", "two_story.wdl"]);

describe("decompiler — emit(cfg) rebuilds the same house", () => {
  const exDir = resolve(here, "../examples");
  const examples = readdirSync(exDir).filter((f) => f.endsWith(".wdl") && f !== "errors.wdl");

  for (const f of examples) {
    it(`${f}: decompiled .wdl expands to identical geometry`, () => {
      const a = compileDsl(readFileSync(join(exDir, f), "utf8"), opts);
      const wdl2 = emitWdl(a);
      const b = compileDsl(wdl2, opts); // must be valid .wdl
      expect(floors(b)).toEqual(floors(a));
      if (NO_IMPORT.has(f)) expect(JSON.stringify(b)).toEqual(JSON.stringify(a)); // exact raw config
    });
  }

  // Form-authored configs (templates + library) exercise features the examples
  // don't (thumbnails, grids with roles, configurator groups, etc.). The raw
  // config won't round-trip exactly (a few fields — formula-driven defaults, etc.
  // — aren't DSL-expressible), but the emitted .wdl must rebuild the same geometry.
  const wadiDirs = [
    resolve(here, "../../editor/public/templates"),
    resolve(here, "../../library"),
  ];
  for (const dir of wadiDirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".wadi"))) {
      it(`${f} (.wadi): decompiles to .wdl with identical geometry`, () => {
        const a = JSON.parse(readFileSync(join(dir, f), "utf8"));
        const wdl = emitWdl(a);
        const b = compileDsl(wdl, opts);
        expect(floors(b)).toEqual(floors(a));

        // Configurator is the architect's owner-facing template — it must survive
        // the round-trip in full: every input and group, the title, and NO dotted
        // point-field targets (those are hoisted to vars so the knob binds to an ID).
        if (a.configurator) {
          expect(b.configurator).toBeDefined();
          expect(b.configurator.inputs.length).toBe(a.configurator.inputs.length);
          expect((b.configurator.groups ?? []).length).toBe((a.configurator.groups ?? []).length);
          expect(b.configurator.title).toBe(a.configurator.title);
          expect(b.configurator.inputs.every((i: { target: string }) => !i.target.includes("."))).toBe(true);
        }
      });
    }
  }
});
