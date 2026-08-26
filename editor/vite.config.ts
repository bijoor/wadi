import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { existsSync, readFileSync, statSync } from 'node:fs'

// Base config for LOCAL DEV (`npm run dev` → serves the app at /viewer.html)
// and for Vitest (which falls back to this config for the React/Tailwind
// transforms). It intentionally has NO `build` block: the shippable bundle is
// the app, built via `vite.viewer.config.ts` (→ docs/app). The former
// standalone editor SPA (docs/editor) has been retired — the app's studio mode
// (wadi.house/app?mode=studio) is the editor now.
//
// `base: './'` keeps asset URLs relative. The `server.fs.allow` entry lets the
// dev server read the repo-root `house_config.json` the app auto-loads.

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.map': 'application/json', '.glb': 'model/gltf-binary',
  '.wadi': 'application/json', '.txt': 'text/plain',
}

// DEV-ONLY: the editor dev server serves the LIVE viewer at /viewer.html, but the
// in-app "WDL editor →" link points at /dsl (a SEPARATE app, built to docs/dsl)
// and that playground previews via a same-origin /app iframe. Neither /dsl nor
// /app exists on this single-root dev server, so the link 404s. This plugin makes
// both resolve on the one dev origin (as they do in the deployed docs/ site):
//   • /dsl  → the BUILT playground (docs/dsl). Rebuild it with
//             `npm --prefix wadi-dsl run build:playground` if you edit it.
//   • /app  → a 302 to the LIVE /viewer.html (query preserved). The playground
//             only sets frame.src and reads contentWindow.wadi — it never reads
//             the URL back — so the redirect is transparent, and the preview shows
//             the LIVE viewer (current code, HMR, the Graph tab) instead of a
//             stale build. Same origin, so window.wadi stays reachable.
// Never applied to production builds (`apply: 'serve'`).
function serveBuiltSite(): Plugin {
  const docs = path.resolve(__dirname, '..', 'docs')
  // Built sibling apps served on this dev origin so their same-origin links work:
  //   /dsl     → the WDL playground   (docs/dsl,     built by wadi-dsl)
  //   /planner → the floor-planner    (docs/planner, built by floor-planner)
  const staticApps: [string, string][] = [
    ['/dsl', path.join(docs, 'dsl')],
    ['/planner', path.join(docs, 'planner')],
  ]
  return {
    name: 'wadi-serve-built-site',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url || ''
        const [urlPath, query] = raw.split('#')[0].split(/(?=\?)/)

        // /app → the LIVE viewer, so the WDL editor / planner handoff hit current code.
        if (urlPath === '/app' || urlPath === '/app/') {
          res.statusCode = 302
          res.setHeader('Location', '/viewer.html' + (query ?? ''))
          res.end()
          return
        }

        const pathname = urlPath.split('?')[0]
        for (const [prefix, root] of staticApps) {
          if (!existsSync(root) || (pathname !== prefix && !pathname.startsWith(prefix + '/'))) continue
          if (pathname === prefix) { res.statusCode = 302; res.setHeader('Location', prefix + '/' + (query ?? '')); res.end(); return }
          let rel = decodeURIComponent(pathname.slice(prefix.length + 1)) || 'index.html'
          let file = path.join(root, rel)
          if (!file.startsWith(root)) { res.statusCode = 403; res.end('Forbidden'); return }
          if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
          if (!existsSync(file)) file = path.join(root, 'index.html') // SPA fallback
          if (existsSync(file)) {
            res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
            res.end(readFileSync(file))
            return
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), serveBuiltSite()],
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, '..')],
    },
  },
})
