// Bundle the MCP server into a single self-contained ESM file. Everything is
// inlined — the DSL compiler (wadi-dsl), the editor pipeline (editor/src), the
// MCP SDK, zod, langium, and the embedded examples/docs — EXCEPT the native
// rasteriser (@resvg/resvg-js), which stays an external runtime dependency.
// Result: `dist/server.mjs` runs anywhere with just `@resvg/resvg-js` installed —
// no repo, no editor/wadi-dsl source.

import { build } from "esbuild";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
if (!existsSync(resolve(HERE, "src/assets.generated.ts"))) {
  console.error("run `npm run gen-assets` first (assets.generated.ts missing)");
  process.exit(1);
}

await build({
  entryPoints: [resolve(HERE, "src/server.ts")],
  outfile: resolve(HERE, "dist/server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // Native addon — cannot be inlined; kept as a package.json dependency.
  external: ["@resvg/resvg-js"],
  // Some bundled deps (langium/chevrotain) are CommonJS and call require()/use
  // __dirname at runtime; shim them for the ESM output.
  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire as __cr } from 'module';",
      "import { fileURLToPath as __f } from 'url';",
      "import { dirname as __d } from 'path';",
      "const require = __cr(import.meta.url);",
      "const __filename = __f(import.meta.url);",
      "const __dirname = __d(__filename);",
    ].join("\n"),
  },
  logLevel: "info",
});

console.error("built dist/server.mjs");
