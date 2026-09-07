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

// A gap can arrive as a plain number OR as a constant formula (the WDL generator emits
// negative literals as `formulas.gap_x = "= -38"`, leaving the plain field 0). Honour the
// formula so the manifest matches what expandRoomWalls actually draws — otherwise every
// negative offset (the -x/-y side of a centred cluster) silently collapses to 0.
const gapVal = (it, axis) => {
  const f = it.formulas && it.formulas[`gap_${axis}`]
  if (f != null) {
    const n = Number(String(f).replace(/^\s*=\s*/, '').trim())
    if (Number.isFinite(n)) return n
  }
  return it[`gap_${axis}`]
}

const layouts = []
for (const floor of config.floors || []) {
  for (const o of floor.objects || []) {
    if (o.type !== 'room') continue
    const type = String(o.name).replace(/_[a-z0-9]+$/i, '') // bedroom_l -> bedroom
    const pieces = (o.items || []).map((it) => {
      const p = { asset: it.asset, anchor: it.anchor || 'center' }
      const gx = gapVal(it, 'x'), gy = gapVal(it, 'y')
      if (gx != null) p.gap_x = gx
      if (gy != null) p.gap_y = gy
      if (it.rotation != null) p.rotation = it.rotation
      return p
    })
    // The authored room size is the layout's target: the smallest room it was designed to
    // fit without overlaps. The planner picks the largest layout of a type that fits the room.
    layouts.push({ id: o.name, type, w: o.width, h: o.length, pieces })
  }
}

writeFileSync(outPath, JSON.stringify({ layouts }, null, 2) + '\n')
console.error(`wrote ${outPath} (${layouts.length} layouts across ${new Set(layouts.map((l) => l.type)).size} types)`)
