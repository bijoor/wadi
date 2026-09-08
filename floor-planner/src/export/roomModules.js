// Prebuilt room modules for the planner. A graph room gets a TYPE, and on export we pick a
// furniture LAYOUT for it and drop the pieces into room.items[] (walls stay graph-owned;
// items are anchored, so they reflow with the room).
//
// Layouts are authored in wadi-dsl/std-modules/rooms.wdl (several per type, at several sizes)
// and compiled to roomLayouts.json by scripts/build-room-layouts.mjs. Each layout carries its
// TARGET SIZE (w,h) — the smallest room it was designed to fill without furniture overlapping.
// For a room we take the layouts of its type that FIT the room (target ≤ room, in either
// orientation — see furnitureFit), then keep the one whose furniture overlaps the doors LEAST,
// preferring the fullest arrangement that fits. If the room is smaller than every layout it
// stays UNFURNISHED (an out-of-bounds arrangement is worse than none) — author a smaller layout
// to cover it. To add or change an arrangement, edit rooms.wdl and re-run the build script.

import MANIFEST from './roomLayouts.json'
import {
  occupiedWalls, rotateLayoutCW, doorOverlapCount, placePieces, canPlaceByGeometry,
} from './furnitureFit.js'

// Layouts grouped by room type, in file order (order breaks ties).
const BY_TYPE = {}
for (const l of MANIFEST.layouts || []) (BY_TYPE[l.type] ||= []).push(l)

const TYPE_LABEL = { bedroom: 'Bedroom', living: 'Living', dining: 'Dining', kitchen: 'Kitchen', bath: 'Bathroom', study: 'Study' }
const label = (t) => TYPE_LABEL[t] || (t.charAt(0).toUpperCase() + t.slice(1))

// The room-type options for the picker: plain room + one per type the pack defines.
export const ROOM_TYPES = [['', 'Plain room'], ...Object.keys(BY_TYPE).map((t) => [t, label(t)])]

// Coarse fallback score (no room geometry available): how many pieces sit on a wall that
// carries a door, whether or not their footprint actually reaches the opening.
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

// Candidate arrangements for a layout: as authored, plus rotated 90° (A). The rotation lets a
// portrait layout fill a landscape room, and gives door-avoidance (C) a second wall to try.
// A furniture-free layout (balcony/terrace) has nothing to rotate.
function orientationsOf(layout) {
  if (!layout.pieces || !layout.pieces.length) return [layout]
  return [layout, rotateLayoutCW(layout)]
}

// Pick the arrangement for a typed room: among the layouts of its type (each in its authored
// and 90°-rotated orientation) that FIT the room, the one whose furniture overlaps the doors
// LEAST — measured against the real door openings when we have the room geometry (C), else by
// the coarse wall-level count. Tie-break: fullest arrangement, then authored orientation, then
// file order. Returns the chosen (possibly rotated) layout, or null for a plain/too-small room.
function pickLayout(roomType, ctx = {}) {
  const options = BY_TYPE[roomType]
  if (!options || !options.length) return null
  const open = ctx.openSides instanceof Set ? ctx.openSides : new Set(ctx.openSides || [])
  const useGeom = canPlaceByGeometry(ctx)

  // Candidates in a stable order: authored before rotated, layouts in file order. Only those
  // whose (oriented) target fits the room — a layout in a room smaller than it was designed
  // for would push furniture through the walls. If none fits, the room stays unfurnished.
  const pool = []
  for (const l of options) for (const c of orientationsOf(l)) if (fits(c, ctx.w, ctx.h)) pool.push(c)
  if (!pool.length) return null

  const score = (c) => (useGeom
    ? doorOverlapCount(c.pieces, ctx.room, ctx.wallT, ctx.units, ctx.doorIntervals)
    : conflictCount(c, open))
  let best = pool[0], bestScore = score(pool[0])
  for (let i = 1; i < pool.length; i++) {
    const s = score(pool[i])
    // fewer door hits, then fuller, then (implicitly, via stable order) authored-before-rotated
    if (s < bestScore || (s === bestScore && area(pool[i]) > area(best))) { best = pool[i]; bestScore = s }
  }
  return best
}

function piecesToItems(pieces) {
  return pieces.map((p, i) => {
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
// number lives in the WDL template, not here.
// `ctx.openSides` = walls that carry a door/gap (coarse fallback). When `ctx.room`, `ctx.wallT`,
// `ctx.units` and `ctx.doorIntervals` are supplied, placement is door-position aware (C): the
// chosen arrangement avoids the openings, and a piece that still lands on one is SLID along its
// wall to clear it (dropped only when it can't).
export function roomModule(roomType, ctx = {}) {
  const layout = pickLayout(roomType, ctx)
  if (!layout) return { items: [], height: undefined, template: null, rotated: false }
  let pieces = layout.pieces
  if (canPlaceByGeometry(ctx)) pieces = placePieces(pieces, ctx.room, ctx.wallT, ctx.units, ctx.doorIntervals)
  return { items: piecesToItems(pieces), height: layout.height, template: layout.id, rotated: !!layout.rotated }
}

// Back-compat convenience: just the furniture items[] for a typed room.
export function roomItems(roomType, ctx = {}) {
  return roomModule(roomType, ctx).items
}
