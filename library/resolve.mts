// Resolve a parametric .wadi (fill object literals from their formulas) and
// validate against the editor's Zod schema. Second half of the build flow:
//   node build_cottage.mjs        # writes the config with formulas + 0 literals
//   npx tsx resolve.mts <file>    # resolves + validates + rewrites in place
import { readFileSync, writeFileSync } from "node:fs";
import { resolveParametric } from "../editor/src/param/resolve.ts";
import { HouseConfig } from "../editor/src/schema/houseConfig.ts";

const file = process.argv[2] ?? "single_story_cottage.wadi";
const raw = JSON.parse(readFileSync(file, "utf8"));
const { config, warnings } = resolveParametric(raw);
if (warnings?.length) {
  console.log("RESOLVE WARNINGS:");
  for (const w of warnings) console.log("  -", typeof w === "string" ? w : JSON.stringify(w));
} else {
  console.log("resolve: 0 warnings");
}
const parsed = HouseConfig.safeParse(config);
if (!parsed.success) {
  console.log("SCHEMA ERRORS:");
  for (const iss of parsed.error.issues) console.log("  -", iss.path.join("."), iss.message);
  process.exit(1);
}
writeFileSync(file, JSON.stringify(config, null, 1));
console.log("resolved + validated ->", file);
