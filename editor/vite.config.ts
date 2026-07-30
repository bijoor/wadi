import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Base config for LOCAL DEV (`npm run dev` → serves the app at /viewer.html)
// and for Vitest (which falls back to this config for the React/Tailwind
// transforms). It intentionally has NO `build` block: the shippable bundle is
// the app, built via `vite.viewer.config.ts` (→ docs/app). The former
// standalone editor SPA (docs/editor) has been retired — the app's studio mode
// (wadi.house/app?mode=studio) is the editor now.
//
// `base: './'` keeps asset URLs relative. The `server.fs.allow` entry lets the
// dev server read the repo-root `house_config.json` the app auto-loads.

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
  },
})
