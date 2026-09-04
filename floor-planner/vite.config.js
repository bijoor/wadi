import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// The optional Floor Planner add-on. A blank-canvas room+connection sketcher that
// EXPORTS a `.wadi` HouseConfig, so a design can start here and continue in the
// Wadi studio / WDL editor. Built to `docs/planner/` (deployed at /planner,
// alongside /app and /dsl) with a relative base so it works under that subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      // The pure config -> .wdl decompiler from the sibling wadi-dsl package, so the
      // planner can hand off editable WDL (and push it to a live co-edit session).
      // Same bare specifier the editor aliases; Vite transpiles the .ts on import.
      'wadi-wdl-emitter': path.resolve(__dirname, '..', 'wadi-dsl', 'src', 'generator', 'fromHouseConfig.ts'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../docs/planner'),
    emptyOutDir: true,
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: false,
  },
})
