// Bundled std-* DSL modules for the browser playground (and the desktop ⌘⇧D
// editor, which loads the same /dsl bundle). The .wdl sources are inlined at
// build time via Vite `?raw`, so `import "std-furniture"` resolves with no
// network or filesystem. This is the app-side twin of wadi-mcp's
// pipeline.stdResolveModule (which serves the same modules over MCP).

import stdFurniture from "../std-modules/std-furniture.wdl?raw";
import konkanBase from "../std-modules/konkan/base.wdl?raw";

const STD_MODULES: Record<string, string> = {
  "std-furniture": stdFurniture,
  "konkan/base": konkanBase,
};

/** Resolve a bundled std module name to its .wdl source (undefined if unknown). */
export function stdResolveModule(ref: string): string | undefined {
  return STD_MODULES[ref];
}
