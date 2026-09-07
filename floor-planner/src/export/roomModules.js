// Prebuilt room modules for the planner. A graph room gets a TYPE, and on export we pick a
// furniture LAYOUT for it and drop the pieces into room.items[] (walls stay graph-owned;
// items are anchored, so they reflow with the room).
//
// Layouts are authored in wadi-dsl/std-modules/rooms.wdl (several per type, at several sizes)
// and compiled to roomLayouts.json by scripts/build-room-layouts.mjs. Each layout carries its
// TARGET SIZE (w,h) — the smallest room it was designed to fill without furniture overlapping.
// There are NO placement rules: for a room we take the layouts of its type that FIT the room
// (target ≤ room), then keep the one that conflicts LEAST with the room's doors (a conflict =
// a piece on a wall that carries a door), preferring the fullest arrangement that fits. If the
// room is smaller than every layout, we fall back to the most compact layout as a best effort.
// To add or change an arrangement, edit rooms.wdl and re-run the build script.

import MANIFEST from './roomLayouts.json'

// Layouts grouped by room type, in file order (order breaks ties).
const BY_TYPE = {}
for (const l of MANIFEST.layouts || []) (BY_TYPE[l.type] ||= []).push(l)

const TYPE_LABEL = { bedroom: 'Bedroom', living: 'Living', dining: 'Dining', kitchen: 'Kitchen', bath: 'Bathroom', study: 'Study' }
const label = (t) => TYPE_LABEL[t] || (t.charAt(0).toUpperCase() + t.slice(1))

// The room-type options for the picker: plain room + one per type the pack defines.
export const ROOM_TYPES = [['', 'Plain room'], ...Object.keys(BY_TYPE).map((t) => [t, label(t)])]

// The wall(s) a piece touches, from its anchor: top=north, bottom=south, left=west,
// right=east; a `center` anchor touches none (freestanding, never conflicts).
function occupiedWalls(anchor) {
  const w = []
  if (anchor.startsWith('top')) w.push('north')
  if (anchor.startsWith('bottom')) w.push('south')
  if (anchor.endsWith('left')) w.push('west')
  if (anchor.endsWith('right')) w.push('east')
  return w
}

// How many of a layout's pieces sit on a wall that carries a door.
function conflictCount(layout, openSides) {
  let n = 0
  for (const p of layout.pieces) for (const wall of occupiedWalls(p.anchor)) if (openSides.has(wall)) n++
  return n
}

const area = (l) => (l.w || 0) * (l.h || 0)

// Does a layout's target size fit inside a room of w x h? A small tolerance absorbs rounding
// so a layout authored at 100 still counts as fitting a 100-unit room.
const FIT_TOL = 1
function fits(layout, w, h) {
  if (!w || !h) return true // unknown room size: don't filter by size
  return (layout.w || 0) <= w + FIT_TOL && (layout.h || 0) <= h + FIT_TOL
}

// The furniture items[] for a typed room: among the layouts of its type that FIT the room
// (target size ≤ room), the one that conflicts least with the doors, preferring the fullest
// that fits. Falls back to the most compact layout when the room is smaller than all of them.
// `ctx.openSides` = the room's walls that carry a door/gap; `ctx.w`/`ctx.h` = the room size.
export function roomItems(roomType, ctx = {}) {
  const options = BY_TYPE[roomType]
  if (!options || !options.length) return []
  const open = ctx.openSides instanceof Set ? ctx.openSides : new Set(ctx.openSides || [])

  let pool = options.filter((l) => fits(l, ctx.w, ctx.h))
  if (!pool.length) {
    // Room too small for any layout: use the most compact one (least likely to overlap).
    pool = [options.slice().sort((a, b) => area(a) - area(b))[0]]
  }
  // Fewest door conflicts wins; tie-break on the largest target area (fullest arrangement
  // that fits the room), then file order for stability.
  let best = pool[0], bestScore = conflictCount(pool[0], open)
  for (let i = 1; i < pool.length; i++) {
    const s = conflictCount(pool[i], open)
    if (s < bestScore || (s === bestScore && area(pool[i]) > area(best))) { best = pool[i]; bestScore = s }
  }
  return best.pieces.map((p, i) => {
    const it = { name: `${p.asset.name || p.asset.id}${i ? ' ' + (i + 1) : ''}`, asset: p.asset, anchor: p.anchor }
    if (p.gap_x != null) it.gap_x = p.gap_x
    if (p.gap_y != null) it.gap_y = p.gap_y
    if (p.rotation != null) it.rotation = p.rotation
    return it
  })
}
