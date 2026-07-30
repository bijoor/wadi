// CLI: compile a .wadidsl file to a canonical .wadi (HouseConfig JSON).
//   tsx src/cli/main.ts <in.wadidsl> [out.wadi]
// With no out path, prints JSON to stdout.

import { readFileSync, writeFileSync } from "node:fs";
import { compileDsl } from "../generator/toHouseConfig.js";
// Reuse the REAL Wadi resolver (pure TS, no zod) so the emitted .wadi has its
// formulas resolved into numeric fields — exactly what the app persists, and
// what downstream consumers (validate/render) expect.
import { resolveParametric } from "../../../editor/src/param/resolve";

const [, , inPath, outPath] = process.argv;
if (!inPath) {
  console.error("usage: main.ts <in.wadidsl> [out.wadi]");
  process.exit(2);
}
try {
  const compiled = compileDsl(readFileSync(inPath, "utf8"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { config, warnings } = resolveParametric(compiled as any);
  for (const w of warnings) console.error(`⚠︎ ${w.where}: ${w.message}`);
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
