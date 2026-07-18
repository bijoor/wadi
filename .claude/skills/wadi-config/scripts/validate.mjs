// Validate a Wadi house_config.json against BOTH:
//   1. the editor's Zod schema (strict shape), and
//   2. the wall-expansion + roof v2 compute pipeline (catches geometry errors
//      the schema alone misses: bad wall openings, zero-length or missing-slope
//      roof segments, non-covering footprints, …).
//
// It reuses the editor's own TypeScript source, so it flags the exact same
// failures the app would. Run it with the editor's tsx (which resolves the .ts
// imports and their deps, e.g. zod, from editor/node_modules):
//
//   cd editor && npx tsx ../.claude/skills/wadi-config/scripts/validate.mjs /abs/path/to/house_config.json
//   # or pipe JSON on stdin:
//   cat house_config.json | (cd editor && npx tsx ../.claude/skills/wadi-config/scripts/validate.mjs)
//
// Exit 0 = valid; exit 1 = invalid (errors printed). Pass an ABSOLUTE config
// path (the working directory is editor/ when run as above).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validate } from "../../../../editor/src/schema/houseConfig";
import { computeMergedV2Spec } from "../../../../editor/src/svg2d/roof/v2/computeFromHouse";

function readInput() {
  const arg = process.argv[2];
  if (arg) return readFileSync(resolve(process.cwd(), arg), "utf8");
  return readFileSync(0, "utf8"); // stdin
}

let raw;
try {
  raw = JSON.parse(readInput());
} catch (e) {
  console.error("❌ Not valid JSON: " + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
}

// 1. Schema (Zod, .strict()).
const res = validate(raw);
if (!res.ok) {
  const errs = res.errors ?? [];
  console.error(`❌ Schema validation failed (${errs.length} error${errs.length === 1 ? "" : "s"}):`);
  for (const err of errs) console.error(`   /${err.path}: ${err.message}`);
  process.exit(1);
}

// 2. Pipeline — wall expansion + roof v2 derivation. Throws on geometry errors.
try {
  computeMergedV2Spec(res.data, { filter: "v2Only" });
} catch (e) {
  console.error("❌ Pipeline error (wall / roof compute):");
  console.error("   " + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
}

console.log("✅ Valid — schema + wall/roof pipeline OK");
