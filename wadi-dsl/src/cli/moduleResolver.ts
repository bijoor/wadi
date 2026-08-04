// Filesystem module resolver for the node CLI (compile + watch). Serves the
// bundled std-* packs and lets a `.wdl` import sibling module files, so
// `import "std-furniture"` and `import "./my-furniture"` both work headlessly.
// This is the node twin of the playground's `?raw` resolver and wadi-mcp's
// stdResolveModule (all three serve the same std-modules/ sources).

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

// wadi-dsl/std-modules — the bundled std-* packs (std-furniture, …).
const STD_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "std-modules");

/** Build a resolveModule for a file being compiled: bundled std packs first,
 *  then the file's own directory (bare name, `.wdl`, and a `modules/` subdir),
 *  then absolute/relative paths. Returns undefined if nothing matches. */
export function makeFileResolver(baseFile: string): (ref: string) => string | undefined {
  const baseDir = dirname(resolve(baseFile));
  return (ref: string): string | undefined => {
    const candidates = [
      resolve(STD_DIR, `${ref}.wdl`), // bundled std pack by name
      isAbsolute(ref) ? ref : resolve(baseDir, ref), // path as written
      resolve(baseDir, `${ref}.wdl`), // sibling <ref>.wdl
      resolve(baseDir, "modules", `${ref}.wdl`), // local modules/ search dir
    ];
    for (const p of candidates) {
      if (existsSync(p)) return readFileSync(p, "utf8");
    }
    return undefined;
  };
}
