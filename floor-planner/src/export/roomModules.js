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
// so a layout authored at 100 still counts as fitting a 100-unit room. A layout with no
// furniture (a balcony/terrace that only carries a wall height) has no footprint to overflow,
// so it always fits — its height applies whatever the room's size or shape.
const FIT_TOL = 1
function fits(layout, w, h) {
  if (!layout.pieces || layout.pieces.length === 0) return true
  if (!w || !h) return true // unknown room size: don't filter by size
  return (layout.w || 0) <= w + FIT_TOL && (layout.h || 0) <= h + FIT_TOL
}

// Pick the layout for a typed room: among the layouts of its type that FIT the room (target
// size ≤ room), the one that conflicts least with the doors, preferring the fullest that
// fits. Falls back to the most compact layout when the room is smaller than all of them.
// Returns the chosen layout object, or null for a plain/unknown type.
function pickLayout(roomType, ctx = {}) {
  const options = BY_TYPE[roomType]
  if (!options || !options.length) return null
  const open = ctx.openSides instanceof Set ? ctx.openSides : new Set(ctx.openSides || [])

  // Only layouts whose target size fits the room — a layout placed in a room smaller than it
  // was designed for would push furniture through the walls. If none fits, the room stays
  // unfurnished (better than furniture outside the room); author a smaller layout to cover it.
  const pool = options.filter((l) => fits(l, ctx.w, ctx.h))
  if (!pool.length) return null
  // Fewest door conflicts wins; tie-break on the largest target area (fullest arrangement
  // that fits the room), then file order for stability.
  let best = pool[0], bestScore = conflictCount(pool[0], open)
  for (let i = 1; i < pool.length; i++) {
    const s = conflictCount(pool[i], open)
    if (s < bestScore || (s === bestScore && area(pool[i]) > area(best))) { best = pool[i]; bestScore = s }
  }
  return best
}

function layoutItems(layout) {
  return layout.pieces.map((p, i) => {
    const it = { name: `${p.asset.name || p.asset.id}${i ? ' ' + (i + 1) : ''}`, asset: p.asset, anchor: p.anchor }
    if (p.gap_x != null) it.gap_x = p.gap_x
    if (p.gap_y != null) it.gap_y = p.gap_y
    if (p.rotation != null) it.rotation = p.rotation
    return it
  })
}

// The prebuilt module for a typed room: `{ items, height }`. `items` is the furniture (see
// pickLayout); `height` is the layout's room-level wall height when the template declares one
// (e.g. a balcony or terrace authored shorter than a full room), else undefined — the low
// number lives in the WDL template, not here. `ctx.openSides` = walls that carry a door/gap;
// `ctx.w`/`ctx.h` = the room size.
export function roomModule(roomType, ctx = {}) {
  const layout = pickLayout(roomType, ctx)
  if (!layout) return { items: [], height: undefined }
  return { items: layoutItems(layout), height: layout.height }
}

// Back-compat convenience: just the furniture items[] for a typed room.
export function roomItems(roomType, ctx = {}) {
  return roomModule(roomType, ctx).items
}
