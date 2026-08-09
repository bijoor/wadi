// Generate wadi-skill/architect/reference/conventions.md from the constraint
// registry + the hand-authored preamble. Run via tsx (imports editor TS).
//
//   npm --prefix editor run gen-conventions-doc          # write
//   npm --prefix editor run gen-conventions-doc:check    # verify (CI / lockstep)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { allConstraints } from "../src/lint/constraints/index";
import { renderConventionsDoc } from "../src/lint/constraints/renderDoc";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", ".."); // editor/scripts → repo root
const refDir = resolve(repo, "wadi-skill/architect/reference");
const preamblePath = resolve(refDir, "conventions.preamble.md");
const outPath = resolve(refDir, "conventions.md");

const preamble = readFileSync(preamblePath, "utf8");
const out = renderConventionsDoc(allConstraints(), preamble);

if (process.argv.includes("--check")) {
  const current = readFileSync(outPath, "utf8");
  if (current !== out) {
    console.error("✖ conventions.md is stale — run: npm --prefix editor run gen-conventions-doc");
    process.exit(1);
  }
  console.log("✓ conventions.md is up to date");
} else {
  writeFileSync(outPath, out);
  console.log(`wrote ${outPath} (${allConstraints().length} conventions)`);
}
