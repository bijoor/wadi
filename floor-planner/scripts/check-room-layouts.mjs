// Diagnostic: compile the room-layout pack (wadi-dsl/std-modules/rooms.wdl) through the
// REAL pipeline (resolve + expandRoomWalls), then for every layout room report each
// furniture piece's resolved plan footprint (via the same itemBox math C7 uses),
// pairwise overlaps, and pieces poking outside the room's inner wall face.
//
// This is the "run the tests" for the layout pack. Run with the editor's tsx:
//   cd editor && npx tsx ../floor-planner/scripts/check-room-layouts.mjs
//
// Exit non-zero if any layout has an overlap or out-of-bounds piece.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { compileDsl } from '../../wadi-dsl/src/generator/toHouseConfig.js'
import { makeFileResolver } from '../../wadi-dsl/src/cli/moduleResolver.js'
import { resolveParametric } from '../../editor/src/param/resolve'
import { expandRoomWalls } from '../../editor/src/svg2d/expand'
import { itemBox } from '../../editor/src/lint/constraints/geometry'

const here = dirname(fileURLToPath(import.meta.url))
const inPath = resolve(here, '../../wadi-dsl/std-modules/rooms.wdl')

const compiled = compileDsl(readFileSync(inPath, 'utf8'), { resolveModule: makeFileResolver(inPath) })
const { config } = resolveParametric(compiled)
const units = config.units
const wallT = 8 // expand.ts default wall_thickness

// Rooms (authored, unexpanded) give us each room's rect + name.
const rooms = []
for (const fl of config.floors || []) for (const o of fl.objects || []) if (o.type === 'room') rooms.push(o)

// Expand to get flat items with absolute x/y/rotation.
const exp = expandRoomWalls(config)
const items = []
for (const fl of exp.floors || []) for (const o of fl.objects || []) if (o.type === 'item') items.push(o)

// Bucket each expanded item into the room whose rect contains its centre.
function roomOf(it) {
  for (const r of rooms) {
    if (it.x >= r.x && it.x <= r.x + r.width && it.y >= r.y && it.y <= r.y + r.length) return r
  }
  return null
}

const MARGIN = 2
let problems = 0
for (const r of rooms) {
  const mine = items.filter((it) => roomOf(it) === r)
  const boxes = mine.map((it) => ({ it, box: itemBox(it, units) })).filter((e) => e.box)
  // inner wall face
  const ix0 = r.x + wallT, iy0 = r.y + wallT, ix1 = r.x + r.width - wallT, iy1 = r.y + r.length - wallT
  const lines = []
  // overlaps
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const A = boxes[a].box, B = boxes[b].box
      const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)
      const oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0)
      if (ox <= MARGIN || oy <= MARGIN) continue
      problems++
      lines.push(`    OVERLAP ${boxes[a].it.asset.id} × ${boxes[b].it.asset.id}  ~${Math.round(ox)}×${Math.round(oy)}`)
    }
  }
  // out of bounds
  for (const { it, box } of boxes) {
    const out = []
    if (box.x0 < ix0 - MARGIN) out.push(`W${Math.round(ix0 - box.x0)}`)
    if (box.x1 > ix1 + MARGIN) out.push(`E${Math.round(box.x1 - ix1)}`)
    if (box.y0 < iy0 - MARGIN) out.push(`N${Math.round(iy0 - box.y0)}`)
    if (box.y1 > iy1 + MARGIN) out.push(`S${Math.round(box.y1 - iy1)}`)
    if (out.length) { problems++; lines.push(`    OUTOFBOUNDS ${it.asset.id}  ${out.join(' ')}`) }
  }
  const tag = lines.length ? '✗' : '✓'
  console.log(`${tag} ${r.name}  size ${r.width}×${r.length}  (${boxes.length} pieces)`)
  for (const l of lines) console.log(l)
}
console.log(problems ? `\n${problems} problem(s)` : `\nall clear`)
process.exit(problems ? 1 : 0)
