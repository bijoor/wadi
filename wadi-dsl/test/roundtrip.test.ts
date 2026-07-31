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
const SAMPLES = ["minimal", "two_room", "two_story", "coastal"];

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

  it("errors.wdl reports parse diagnostics (does not throw uncaught)", () => {
    const src = readFileSync(resolve(here, "..", "examples", "errors.wdl"), "utf8");
    expect(() => compileDsl(src)).toThrow(/parse failed/i);
  });
});
