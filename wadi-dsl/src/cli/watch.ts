// Watch a .wadidsl and (re)compile it to a .wadi on every save. Point the Wadi
// desktop app at the output file (Load → out.wadi) and it live-reloads as you
// edit the DSL in ANY editor (VS Code, etc.) — the same file-watch loop the AI
// architect skill uses, so the "code editor" is fully separate from the renderer.
//
//   tsx src/cli/watch.ts <in.wadidsl> <out.wadi>
//
// The output is fully resolved (formulas → numeric fields), exactly what the app
// persists, so the desktop app renders it directly.

import { readFileSync, writeFileSync, watch } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { compileDsl } from "../generator/toHouseConfig.js";
import { resolveParametric } from "../../../editor/src/param/resolve";

const [, , inArg, outArg] = process.argv;
if (!inArg || !outArg) {
  console.error("usage: watch <in.wadidsl> <out.wadi>");
  process.exit(2);
}
const inPath = resolve(process.cwd(), inArg);
const outPath = resolve(process.cwd(), outArg);

function stamp(): string {
  // Date is fine here (a normal CLI, not a workflow sandbox).
  return new Date().toLocaleTimeString();
}

function rebuild(): void {
  try {
    const compiled = compileDsl(readFileSync(inPath, "utf8"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { config, warnings } = resolveParametric(compiled as any);
    for (const w of warnings) console.error(`  ⚠︎ ${w.where}: ${w.message}`);
    writeFileSync(outPath, JSON.stringify(config, null, 2) + "\n");
    console.log(`✓ ${stamp()} — compiled ${inArg} → ${outArg}`);
  } catch (e) {
    // Keep the last-good output on disk so the app doesn't blank on a typo.
    console.error(`✗ ${stamp()} — ${(e as Error).message.split("\n")[0]}`);
  }
}

rebuild(); // initial build
console.log(`\nWatching ${inArg} → ${outArg}`);
console.log(`Open ${outArg} in the Wadi desktop app (Load); it live-reloads as you edit the DSL.\n`);

// Watch the DIRECTORY (not the file) so editors that save atomically — write a
// temp file then rename over the target — still trigger a rebuild. Debounced,
// since a save can fire several fs events.
const dir = dirname(inPath);
const base = basename(inPath);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(dir, (_event, filename) => {
  if (filename === base) {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 120);
  }
});
