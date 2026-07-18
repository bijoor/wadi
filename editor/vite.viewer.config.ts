import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import type { Plugin } from 'vite'

// Vite (rolldown) outputs viewer.html because that's the input filename.
// Rename it to index.html after the build so GitHub Pages picks it up
// as the site root without a redirect.
function renameViewerToIndex(): Plugin {
  return {
    name: 'rename-viewer-to-index',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(__dirname, '../docs/app')
      const from = path.join(outDir, 'viewer.html')
      const to = path.join(outDir, 'index.html')
      if (fs.existsSync(from)) {
        fs.renameSync(from, to)
        console.log(`  renamed viewer.html → index.html`)
      }
    },
  }
}

// The tabbed viewer at docs/index.html. It shares source code with the
// editor (svg2d/ generators + three/ scene), but uses a completely
// different HTML shell — the mobile-friendly, model-viewer-style
// tabbed layout that was originally hand-authored.
//
// The viewer entry lives at editor/viewer.html; the TS bootstrap that
// wires generators + Three.js into the vanilla-JS UI lives at
// editor/src/viewer/main.ts. Build output goes straight into docs/,
// producing docs/index.html + docs/assets/… alongside the editor's
// docs/editor/ tree.
//
// This is a SEPARATE Vite build from the editor. Both are invoked
// from `npm run build` (see package.json).

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), renameViewerToIndex()],
  build: {
    // The designer app lives at wadi.house/app/ so the root can serve the
    // marketing landing page. Its data assets (house_config.json, 2d/,
    // templates/, …) stay at the site root and are fetched root-absolute
    // (see main.ts); the generated 2d/ tab content never hits the network
    // (patchFetch serves it), so only those few real-file fetches care.
    outDir: path.resolve(__dirname, '../docs/app'),
    emptyOutDir: false,          // keep sibling output (docs/app/… incremental)
    rollupOptions: {
      // Object form: the key becomes the output basename, so the viewer
      // input at editor/viewer.html lands at docs/index.html.
      input: {
        index: path.resolve(__dirname, 'viewer.html'),
      },
      output: {
        // Give the viewer its own asset filename prefix so its hashed
        // JS/CSS don't collide with the editor's under docs/editor/assets/.
        entryFileNames: 'assets/viewer-[hash].js',
        chunkFileNames: 'assets/viewer-[hash].js',
        assetFileNames: 'assets/viewer-[hash][extname]',
      },
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
  },
})
