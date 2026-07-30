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

// Build config for the app (the "3D home designer" at wadi.house/app). This is
// the ONLY shippable bundle — the former standalone editor SPA (docs/editor) has
// been retired; the app's studio mode is the editor now.
//
// The entry lives at editor/viewer.html; the TS bootstrap that wires the
// svg2d/ generators + Three.js scene + the mounted Sidebar/PropertyPanel forms
// lives at editor/src/viewer/main.ts. Output → docs/app/ (viewer.html is renamed
// to index.html below so /app serves it at the root). Invoked from
// `npm run build`. Local dev + Vitest use the base vite.config.ts instead.

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
        // Prefix the app's hashed JS/CSS with `viewer-` (kept for stable,
        // recognisable asset names in docs/app/assets/).
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
