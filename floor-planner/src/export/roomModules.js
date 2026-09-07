// Prebuilt room modules for the planner. A graph room gets a TYPE, and on export we pick a
// furniture LAYOUT for it and drop the pieces into room.items[] (walls stay graph-owned;
// items are anchored, so they reflow with the room).
//
// Layouts are authored in wadi-dsl/std-modules/rooms.wdl (several per type) and compiled to
// roomLayouts.json by scripts/build-room-layouts.mjs. There are NO placement rules: for a
// room we try every layout of its type and keep the one whose furniture CONFLICTS LEAST with
// the doors on that room (a conflict = a piece sits on a wall that has a door). To add or
// change an arrangement, edit rooms.wdl and re-run the build script.

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

// The furniture items[] for a typed room: the least-conflicting layout of its type, or []
// for a plain/unknown type. `ctx.openSides` = the room's walls that carry a door/gap.
export function roomItems(roomType, ctx = {}) {
  const options = BY_TYPE[roomType]
  if (!options || !options.length) return []
  const open = ctx.openSides instanceof Set ? ctx.openSides : new Set(ctx.openSides || [])
  let best = options[0], bestScore = conflictCount(options[0], open)
  for (let i = 1; i < options.length && bestScore > 0; i++) {
    const s = conflictCount(options[i], open)
    if (s < bestScore) { best = options[i]; bestScore = s }
  }
  return best.pieces.map((p, i) => {
    const it = { name: `${p.asset.name || p.asset.id}${i ? ' ' + (i + 1) : ''}`, asset: p.asset, anchor: p.anchor }
    if (p.gap_x != null) it.gap_x = p.gap_x
    if (p.gap_y != null) it.gap_y = p.gap_y
    if (p.rotation != null) it.rotation = p.rotation
    return it
  })
}
