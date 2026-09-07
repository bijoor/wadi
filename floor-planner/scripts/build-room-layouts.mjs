// Compile the room-layout pack (wadi-dsl/std-modules/rooms.wdl) into the planner's
// layout manifest (src/export/roomLayouts.json). rooms.wdl is the editable source of
// truth; re-run this after editing it. The manifest carries, per layout: its room type
// and its furniture pieces (inline asset + anchor + gap + rotation). The planner tries
// every layout of a type and keeps the one that conflicts least with the room's doors.
//
// Run with the editor's tsx so the .ts pipeline imports (zod, resolver) resolve:
//   cd editor && npx tsx ../floor-planner/scripts/build-room-layouts.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { compileDsl } from '../../wadi-dsl/src/generator/toHouseConfig.js'
import { makeFileResolver } from '../../wadi-dsl/src/cli/moduleResolver.js'
import { resolveParametric } from '../../editor/src/param/resolve'

const here = dirname(fileURLToPath(import.meta.url))
const inPath = resolve(here, '../../wadi-dsl/std-modules/rooms.wdl')
const outPath = resolve(here, '../src/export/roomLayouts.json')

const compiled = compileDsl(readFileSync(inPath, 'utf8'), { resolveModule: makeFileResolver(inPath) })
const { config } = resolveParametric(compiled)

const layouts = []
for (const floor of config.floors || []) {
  for (const o of floor.objects || []) {
    if (o.type !== 'room') continue
    const type = String(o.name).replace(/_[a-z0-9]+$/i, '') // bedroom_a -> bedroom
    const pieces = (o.items || []).map((it) => {
      const p = { asset: it.asset, anchor: it.anchor || 'center' }
      if (it.gap_x != null) p.gap_x = it.gap_x
      if (it.gap_y != null) p.gap_y = it.gap_y
      if (it.rotation != null) p.rotation = it.rotation
      return p
    })
    layouts.push({ id: o.name, type, pieces })
  }
}

writeFileSync(outPath, JSON.stringify({ layouts }, null, 2) + '\n')
console.error(`wrote ${outPath} (${layouts.length} layouts across ${new Set(layouts.map((l) => l.type)).size} types)`)
