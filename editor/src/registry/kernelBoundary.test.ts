import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as shim from "./fieldSchema";
import { fieldsToZodSource } from "../../../kernel/fieldSchema";

// Dependency-direction guardrail (plans/primitive-componentization.md §3): the
// domain-neutral kernel must import ONLY other kernel files + node builtins — never
// Wadi domain code, react, three, langium, or zod — so the boundary can't rot.

const here = dirname(fileURLToPath(import.meta.url));
const kernelDir = join(here, "..", "..", "..", "kernel");
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\b[^;\n]*?\bfrom\s+["']([^"']+)["']/g;
const ALLOWED_BUILTINS = new Set(["node:fs", "node:path", "node:url", "node:util", "node:assert"]);

describe("kernel boundary — domain-neutrality is enforced", () => {
  const files = readdirSync(kernelDir).filter((f) => f.endsWith(".ts"));

  it("has kernel source files", () => expect(files.length).toBeGreaterThan(0));

  for (const f of files) {
    it(`${f} imports only kernel-local + node builtins`, () => {
      const src = readFileSync(join(kernelDir, f), "utf8");
      const bad: string[] = [];
      for (const m of src.matchAll(IMPORT_RE)) {
        const spec = m[1];
        const ok = spec.startsWith("./") || spec.startsWith("../") || ALLOWED_BUILTINS.has(spec);
        if (!ok) bad.push(spec);
      }
      expect(bad, `${f} must not import ${bad.join(", ")}`).toEqual([]);
    });
  }

  it("is actually consumed: the editor shim re-exports the kernel engine", () => {
    // A representative kernel export flows through the shim unchanged.
    expect(typeof shim.fieldsToZodSource).toBe("function");
    expect(shim.fieldsToZodSource).toBe(fieldsToZodSource);
    expect(typeof shim.fieldToFormControl).toBe("function");
    expect(typeof shim.humanize).toBe("function");
  });
});
