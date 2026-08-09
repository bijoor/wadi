// Lockstep guard: the committed conventions.md must equal what the generator
// produces from the constraint registry + preamble. If a constraint's doc or the
// preamble changes without regenerating, this fails (like the data-model.md test).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { allConstraints } from "./constraints/index";
import { renderConventionsDoc } from "./constraints/renderDoc";

// editor/src/lint → repo/wadi-skill/architect/reference
const refDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "wadi-skill/architect/reference");

describe("conventions.md is generated from the registry", () => {
  it("committed doc == generated (run `npm --prefix editor run gen-conventions-doc` if this fails)", () => {
    const preamble = readFileSync(resolve(refDir, "conventions.preamble.md"), "utf8");
    const generated = renderConventionsDoc(allConstraints(), preamble);
    const committed = readFileSync(resolve(refDir, "conventions.md"), "utf8");
    expect(committed).toBe(generated);
  });
});
