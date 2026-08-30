import { defineConfig } from "vite";
import path from "node:path";

// Builds the DSL playground (Monaco + in-browser compileDsl) → docs/dsl, so it
// deploys at wadi.house/dsl and iframes the same-origin /app viewer.
export default defineConfig({
  root: path.resolve(__dirname, "playground"),
  base: "./",
  resolve: {
    alias: {
      // The playground pulls in editor/src (param/resolve, templateSource, …),
      // which now transitively reaches editor/src/io/wdl.ts — that imports the
      // compiler/decompiler via the bare specifiers the EDITOR aliases. Alias them
      // here too (to the real wadi-dsl source) so the playground build resolves.
      "wadi-wdl-compiler": path.resolve(__dirname, "src/generator/toHouseConfig.ts"),
      "wadi-wdl-emitter": path.resolve(__dirname, "src/generator/fromHouseConfig.ts"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../docs/dsl"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
