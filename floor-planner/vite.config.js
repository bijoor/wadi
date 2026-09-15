import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { spawn } from 'node:child_process'

// Dev-only: recompile the room-layout pack (src/export/roomLayouts.json + roomsSource.js) from
// wadi-dsl/std-modules/rooms.wdl on server start and whenever the file changes, so DIRECT edits to
// rooms.wdl show up in the running app with no manual `build-layouts`. It REGENERATES but never
// blocks: a rooms.wdl that doesn't compile just leaves the last good pack in place with a warning
// (the strict overlap/out-of-bounds gate stays in the manual `build-layouts` / CI). The production
// `build` script runs `gen-layouts` itself, so this plugin is serve-only.
function layoutPackWatcher() {
  const wdl = path.resolve(__dirname, '..', 'wadi-dsl', 'std-modules', 'rooms.wdl')
  let running = false, queued = false, timer = null
  const run = () => {
    if (running) { queued = true; return }
    running = true
    const child = spawn('npm', ['run', 'gen-layouts'], { cwd: __dirname, stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('close', (code) => {
      running = false
      if (code !== 0) console.warn('\n[layout-pack] rooms.wdl did not compile — keeping the last good pack; fix the file to update.\n')
      if (queued) { queued = false; run() }
    })
  }
  return {
    name: 'layout-pack-watcher',
    apply: 'serve',
    configureServer(server) {
      run() // regenerate once on dev start
      server.watcher.add(wdl)
      server.watcher.on('change', (f) => {
        if (path.resolve(f) === wdl) { clearTimeout(timer); timer = setTimeout(run, 250) }
      })
    },
  }
}

// The optional Floor Planner add-on. A blank-canvas room+connection sketcher that
// EXPORTS a `.wadi` HouseConfig, so a design can start here and continue in the
// Wadi studio / WDL editor. Built to `docs/planner/` (deployed at /planner,
// alongside /app and /dsl) with a relative base so it works under that subpath.
export default defineConfig({
  base: './',
  plugins: [react(), layoutPackWatcher()],
  resolve: {
    alias: {
      // The pure config -> .wdl decompiler from the sibling wadi-dsl package, so the
      // planner can hand off editable WDL (and push it to a live co-edit session).
      // Same bare specifier the editor aliases; Vite transpiles the .ts on import.
      'wadi-wdl-emitter': path.resolve(__dirname, '..', 'wadi-dsl', 'src', 'generator', 'fromHouseConfig.ts'),
      // Wadi's OWN furniture placement engine (headless), so the planner prepopulates the
      // export by running the SAME engine wadi uses to re-furnish — no divergence between the
      // pushed file and what wadi computes. Vite transpiles the .ts on import.
      'wadi-furnish': path.resolve(__dirname, '..', 'editor', 'src', 'furniture', 'furnish.ts'),
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
