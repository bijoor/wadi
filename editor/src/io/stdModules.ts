// Bundle the standard .wdl modules into the app so it can COMPILE WDL that
// `import`s them (e.g. `import "std-furniture" as f` then `item f."sofa"`) — the
// same modules the wadi-mcp server resolves. Without this, any WDL an agent authors
// with the module-based furniture syntax fails to load in the app ("imports need a
// module resolver, but none is available in this context").
//
// The modules are small (~24KB of text) and bundled via Vite `?raw`.

import stdFurniture from "../../../wadi-dsl/std-modules/std-furniture.wdl?raw";
import konkanBase from "../../../wadi-dsl/std-modules/konkan/base.wdl?raw";

const STD_MODULES: Record<string, string> = {
  "std-furniture": stdFurniture,
  "konkan/base": konkanBase,
};

/** Resolve a bundled standard module by name to its `.wdl` source, else undefined. */
export function stdResolveModule(name: string): string | undefined {
  return STD_MODULES[name];
}
