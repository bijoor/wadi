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

import { libraryLayouts } from '../store/layoutLibrary.js'
import {
  occupiedWalls, rotateLayoutCW, doorOverlapCount, placePieces, canPlaceByGeometry,
} from './furnitureFit.js'

// Layouts grouped by room type, read from the live library (built-in pack + the author's local
// edits) each call, so edits made in the layout editor take effect here immediately.
function byType() {
  const m = {}
  for (const l of libraryLayouts()) (m[l.type] ||= []).push(l)
  return m
}

const TYPE_LABEL = { bedroom: 'Bedroom', living: 'Living', dining: 'Dining', kitchen: 'Kitchen', bath: 'Bathroom', study: 'Study' }
const label = (t) => TYPE_LABEL[t] || (t.charAt(0).toUpperCase() + t.slice(1))

// The room-type options for the picker: plain room + one per type the library defines (dynamic,
// so a new type authored in the editor shows up here).
export function roomTypes() {
  const types = [...new Set(libraryLayouts().map((l) => l.type))]
  return [['', 'Plain room'], ...types.map((t) => [t, label(t)])]
}

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

// Candidate arrangements for a layout: all FOUR rotations (0/90/180/270). Rotation lets a
// portrait layout fill a landscape room and, more importantly, moves furniture onto different
// walls so the picker can dodge doors and gaps. A furniture-free layout has nothing to rotate.
function orientationsOf(layout) {
  if (!layout.pieces || !layout.pieces.length) return [layout]
  const out = [layout]
  let cur = layout
  for (let i = 0; i < 3; i++) { cur = rotateLayoutCW(cur); out.push(cur) }
  return out
}

// Pick the arrangement for a typed room: among the layouts of its type (each in all four
// rotations) that FIT the room, the one that overlaps the DOORS least, then the GAPS least,
// then the fullest. Doors are hard conflicts (later shifted/dropped); gaps are SOFT — an open
// passage that adds space — so we only prefer to avoid them, never remove furniture for them.
// When room geometry is missing we fall back to the coarse wall-level door count. Ties keep pool
// order (authored orientation before rotations, layouts in file order). Returns the chosen
// (possibly rotated) layout, or null for a plain/too-small room.
function pickLayout(roomType, ctx = {}) {
  const options = byType()[roomType]
  if (!options || !options.length) return null
  const open = ctx.openSides instanceof Set ? ctx.openSides : new Set(ctx.openSides || [])
  const useGeom = canPlaceByGeometry(ctx)

  const pool = []
  for (const l of options) for (const c of orientationsOf(l)) if (fits(c, ctx.w, ctx.h)) pool.push(c)
  if (!pool.length) return null

  if (!useGeom) {
    // Coarse fallback (no geometry): fewest door-wall pieces, then fullest.
    let best = pool[0], bestScore = conflictCount(pool[0], open)
    for (let i = 1; i < pool.length; i++) {
      const s = conflictCount(pool[i], open)
      if (s < bestScore || (s === bestScore && area(pool[i]) > area(best))) { best = pool[i]; bestScore = s }
    }
    return best
  }

  // Geometry-aware: rank by (door hits, gap hits, -area). Gaps break ties only.
  const key = (c) => ({
    doors: doorOverlapCount(c.pieces, ctx.room, ctx.wallT, ctx.units, ctx.doorIntervals),
    gaps: doorOverlapCount(c.pieces, ctx.room, ctx.wallT, ctx.units, ctx.gapIntervals || {}),
    a: area(c),
  })
  let best = pool[0], bk = key(best)
  for (let i = 1; i < pool.length; i++) {
    const c = pool[i], k = key(c)
    if (k.doors < bk.doors
      || (k.doors === bk.doors && k.gaps < bk.gaps)
      || (k.doors === bk.doors && k.gaps === bk.gaps && k.a > bk.a)) { best = c; bk = k }
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
