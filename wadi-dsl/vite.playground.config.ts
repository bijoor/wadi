import { defineConfig } from "vite";
import path from "node:path";

// Builds the DSL playground (Monaco + in-browser compileDsl) → docs/dsl, so it
// deploys at wadi.house/dsl and iframes the same-origin /app viewer.
export default defineConfig({
  root: path.resolve(__dirname, "playground"),
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "../docs/dsl"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
