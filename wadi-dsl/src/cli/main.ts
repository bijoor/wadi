// CLI: compile a .wdl file to a canonical .wadi (HouseConfig JSON).
//   tsx src/cli/main.ts <in.wdl> [out.wadi]
// With no out path, prints JSON to stdout.

import { readFileSync, writeFileSync } from "node:fs";
import { compileDsl } from "../generator/toHouseConfig.js";
import { makeFileResolver } from "./moduleResolver.js";
// Reuse the REAL Wadi resolver (pure TS, no zod) so the emitted .wadi has its
// formulas resolved into numeric fields — exactly what the app persists, and
// what downstream consumers (validate/render) expect.
import { resolveParametric } from "../../../editor/src/param/resolve";
import { isFormulaError } from "../../../editor/src/param/warnings";

const [, , inPath, outPath] = process.argv;
if (!inPath) {
  console.error("usage: main.ts <in.wdl> [out.wadi]");
  process.exit(2);
}
try {
  const compiled = compileDsl(readFileSync(inPath, "utf8"), { resolveModule: makeFileResolver(inPath) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { config, warnings } = resolveParametric(compiled as any);
  // An unresolved reference (e.g. a mistyped grid line) collapses to 0 and would
  // silently corrupt the model — treat it as a hard error, deduped by location so
  // one bad grid rename touching hundreds of pillars reports once. Advisory-only
  // warnings (none today) still just print.
  const errs = warnings.filter(isFormulaError);
  const advisory = warnings.filter((w) => !isFormulaError(w));
  for (const w of advisory) console.error(`⚠︎ ${w.where}: ${w.message}`);
  if (errs.length) {
    const seen = new Set<string>();
    console.error(`❌ ${errs.length} unresolved formula reference(s):`);
    for (const w of errs) {
      const key = `${w.where}|${w.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.error(`   ${w.where}: ${w.message}${w.formula ? ` (in \`${w.formula}\`)` : ""}`);
    }
    process.exit(1);
  }
  const text = JSON.stringify(config, null, 2);
  if (outPath) {
    writeFileSync(outPath, text + "\n");
    console.error(`wrote ${outPath}`);
  } else {
    console.log(text);
  }
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
