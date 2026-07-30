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
const example = resolve(here, "..", "examples", "coastal.wadidsl");

function compileAndResolve() {
  const compiled = compileDsl(readFileSync(example, "utf8"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return resolveParametric(compiled as any) as { config: any; warnings: any[] };
}

describe("Wadi DSL round-trip", () => {
  it("compiles + resolves with no formula warnings", () => {
    const { warnings } = compileAndResolve();
    expect(warnings).toHaveLength(0);
  });

  it("resolves grid formulas into numeric fields (Living width = main.x2 - main.x1 = 206)", () => {
    const { config } = compileAndResolve();
    const living = config.floors.flatMap((f: any) => f.objects).find((o: any) => o.name === "Living");
    expect(living.width).toBe(206);
    expect(living.formulas.width).toBe("= main.x2 - main.x1");
  });

  it("passes the REAL schema + wall/roof pipeline (validate.mjs)", () => {
    const { config } = compileAndResolve();
    const tmp = resolve(here, "..", ".coastal.tmp.wadi");
    writeFileSync(tmp, JSON.stringify(config));
    const out = execSync(`npx tsx ../wadi-skill/architect/scripts/validate.mjs "${tmp}"`, {
      cwd: resolve(repo, "editor"),
      encoding: "utf8",
    });
    expect(out).toContain("Valid");
  });
});
