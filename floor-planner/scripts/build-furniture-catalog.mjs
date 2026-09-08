// Compile the standard furniture catalog (wadi-dsl/std-modules/std-furniture.wdl) into a flat
// JSON the layout editor's asset picker can read: src/export/furnitureCatalog.json. Unlike
// roomLayouts.json (which only carries the assets already used by a layout), this lists EVERY
// asset. std-furniture.wdl is generated (gen-std-modules.mjs) and its asset lines are a fixed
// shape, so a regex parse is enough — no DSL compile needed.
//
//   npm run build-catalog   (from floor-planner/)
//
// Do not hand-edit the output.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const inPath = resolve(here, '../../wadi-dsl/std-modules/std-furniture.wdl')
const outPath = resolve(here, '../src/export/furnitureCatalog.json')

const src = readFileSync(inPath, 'utf8')
const RE = /asset\s+"([^"]+)"\s+src\s+"([^"]+)"\s+dims\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s+name\s+"([^"]+)"\s+category\s+"([^"]+)"/g

const assets = []
let m
while ((m = RE.exec(src)) !== null) {
  const [, id, url, w, h, d, name, category] = m
  assets.push({ id, src: url, dimensions: [Number(w), Number(h), Number(d)], name, category })
}
if (!assets.length) { console.error('no assets parsed from', inPath); process.exit(1) }

writeFileSync(outPath, JSON.stringify({ assets }, null, 2) + '\n')
console.error(`wrote ${outPath} (${assets.length} assets across ${new Set(assets.map((a) => a.category)).size} categories)`)
