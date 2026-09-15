// Furniture fit helpers for room-layout selection.
//
// Two jobs, both pure (no I/O):
//   A. Orientation — a layout authored portrait (e.g. 78x46) can be rotated 90° to fit a
//      landscape room (46x78). rotateLayoutCW swaps the target and rotates every piece
//      (anchor, gaps, and facing) so the whole arrangement turns as one.
//   C. Door-position-aware placement — a piece counts as conflicting only when its actual
//      footprint overlaps a door OPENING on its wall (not merely "that wall has a door").
//      doorOverlapCount scores candidates precisely; placePieces then SLIDES a piece along its
//      wall to the nearest clear spot, dropping it only when none exists. Geometry mirrors
//      editor/src/svg2d/furnitureAnchor.ts (anchorItem) and the door centring in
//      wallsFromGraph.js placeDoor, so what we test here matches what the pipeline draws.

const CLEAR = 2 // units of slack: a piece within CLEAR of an opening counts as overlapping

// ---- anchors -------------------------------------------------------------------------

// First token = vertical (top/center/bottom), second = horizontal (left/center/right);
// "center" alone = both. Mirrors furnitureAnchor.parseAnchor.
export function parseAnchor(a) {
  const s = String(a ?? 'center').toLowerCase()
  if (s === 'center') return { h: 'center', v: 'center' }
  const [vTok, hTok] = s.split('-')
  const v = vTok === 'top' ? 'top' : vTok === 'bottom' ? 'bottom' : 'center'
  const h = hTok === 'left' ? 'left' : hTok === 'right' ? 'right' : 'center'
  return { h, v }
}

// The wall(s) an anchor touches: top=north, bottom=south, left=west, right=east; `center`
// (no edge token) touches none (freestanding, never conflicts with a wall's door).
export function occupiedWalls(anchor) {
  const { h, v } = parseAnchor(anchor)
  const w = []
  if (v === 'top') w.push('north')
  if (v === 'bottom') w.push('south')
  if (h === 'left') w.push('west')
  if (h === 'right') w.push('east')
  return w
}

// Default facing (yaw°) implied by an anchor when a piece has no explicit rotation: it faces
// AWAY from its wall, into the room. Mirrors furnitureAnchor.anchorFacing.
export function anchorFacing(anchor) {
  const { h, v } = parseAnchor(anchor)
  if (v === 'top') return 0
  if (v === 'bottom') return 180
  if (h === 'left') return 90
  if (h === 'right') return 270
  return 0
}

// ---- A: orientation ------------------------------------------------------------------

// Where each anchor lands after rotating the layout 90° clockwise in the plan (x east,
// y south): north->east, so top-center->center-right, the NW corner->NE corner, etc.
const ANCHOR_CW = {
  'top-left': 'top-right',
  'top-center': 'center-right',
  'top-right': 'bottom-right',
  'center-right': 'bottom-center',
  'bottom-right': 'bottom-left',
  'bottom-center': 'center-left',
  'bottom-left': 'top-left',
  'center-left': 'top-center',
  center: 'center',
}

// Rotate one piece 90° CW. Gaps are anchor-relative insets, so convert to an absolute
// east/south offset, rotate that vector ((e,s)->(-s,e)), then convert back to the new
// anchor's inset convention. Facing turns with the piece (yaw -= 90); we always set it
// explicitly because an anchor's DERIVED facing does not rotate consistently for corners.
export function rotatePieceCW(p) {
  const { h, v } = parseAnchor(p.anchor)
  const gx = p.gap_x ?? 0
  const gy = p.gap_y ?? 0
  const east = h === 'right' ? -gx : gx
  const south = v === 'bottom' ? -gy : gy
  const east2 = -south
  const south2 = east
  const na = ANCHOR_CW[p.anchor] || 'center'
  const { h: nh, v: nv } = parseAnchor(na)
  const ngx = nh === 'right' ? -east2 : east2
  const ngy = nv === 'bottom' ? -south2 : south2
  const eff = p.rotation != null ? p.rotation : anchorFacing(p.anchor)
  const out = { ...p, anchor: na, rotation: (((eff + 270) % 360) + 360) % 360 }
  if (ngx) out.gap_x = ngx
  else delete out.gap_x
  if (ngy) out.gap_y = ngy
  else delete out.gap_y
  return out
}

// A layout rotated 90° CW: target w/h swap, every piece rotates. `rotated` marks it.
export function rotateLayoutCW(layout) {
  return { ...layout, w: layout.h, h: layout.w, pieces: (layout.pieces || []).map(rotatePieceCW), rotated: true }
}

// ---- units (mirrors editor/src/three/units.ts) ---------------------------------------

const FEET_PER_DISPLAY_UNIT = { feet_inches: 1, feet: 1, meters: 3.280839895, centimeters: 0.032808399, millimeters: 0.003280839 }
const FEET_PER_METER = 3.280839895

export function unitsPerMeter(units) {
  const perUnit = units && units.per_unit > 0 ? units.per_unit : 10
  const fpdu = FEET_PER_DISPLAY_UNIT[(units && units.system) || 'feet_inches'] ?? 1
  return (perUnit / fpdu) * FEET_PER_METER
}
const m2u = (m, units) => (Number(m) || 0) * unitsPerMeter(units)

// ---- C: door-position-aware placement ------------------------------------------------

// A piece's plan centre + AABB half-extents, matching anchorItem: the anchor sits on the
// room's INNER rect (inset by the full wall thickness), the gap insets further into the
// room, and the footprint (asset [w,_,d] in metres) is rotated to an axis-aligned box.
function pieceBox(piece, room, wallT, units) {
  const dim = (piece.asset && piece.asset.dimensions) || [0, 0, 0]
  const fw = m2u(dim[0], units)
  const fd = m2u(dim[2], units)
  const th = ((piece.rotation != null ? piece.rotation : anchorFacing(piece.anchor)) * Math.PI) / 180
  const c = Math.abs(Math.cos(th))
  const s = Math.abs(Math.sin(th))
  const halfX = (fw / 2) * c + (fd / 2) * s
  const halfY = (fw / 2) * s + (fd / 2) * c
  const ix0 = room.x + wallT
  const iy0 = room.y + wallT
  const ix1 = room.x + room.w - wallT
  const iy1 = room.y + room.h - wallT
  const { h, v } = parseAnchor(piece.anchor)
  const gx = piece.gap_x ?? 0
  const gy = piece.gap_y ?? 0
  const x = h === 'left' ? ix0 + halfX + gx : h === 'right' ? ix1 - halfX - gx : (ix0 + ix1) / 2 + gx
  const y = v === 'top' ? iy0 + halfY + gy : v === 'bottom' ? iy1 - halfY - gy : (iy0 + iy1) / 2 + gy
  return { x, y, halfX, halfY }
}

// The plan rect a piece occupies (its axis-aligned footprint), in project units. Used by the
// layout editor to draw and validate pieces.
export function pieceRect(piece, room, wallT, units) {
  const b = pieceBox(piece, room, wallT, units)
  return { x0: b.x - b.halfX, y0: b.y - b.halfY, x1: b.x + b.halfX, y1: b.y + b.halfY, cx: b.x, cy: b.y, halfX: b.halfX, halfY: b.halfY }
}

// The nine anchor reference points on a room's inner wall face (where a piece attaches before
// its gap offsets it), in project units.
export function anchorPoints(room, wallT) {
  const ix0 = room.x + wallT, iy0 = room.y + wallT, ix1 = room.x + room.w - wallT, iy1 = room.y + room.h - wallT
  const mx = (ix0 + ix1) / 2, my = (iy0 + iy1) / 2
  const xs = { left: ix0, center: mx, right: ix1 }
  const ys = { top: iy0, center: my, bottom: iy1 }
  const out = {}
  for (const [va, vy] of Object.entries(ys)) for (const [ha, vx] of Object.entries(xs)) {
    const name = va === 'center' && ha === 'center' ? 'center' : `${va}-${ha}`
    out[name] = { x: vx, y: vy }
  }
  return out
}

// The gap that places a piece (at `anchor`, with half-extents halfX/halfY) so its footprint
// centre lands at (cx, cy). Inverse of pieceBox; used when a piece is dragged.
export function gapForCenter(anchor, cx, cy, halfX, halfY, room, wallT) {
  const { h, v } = parseAnchor(anchor)
  const ix0 = room.x + wallT, iy0 = room.y + wallT, ix1 = room.x + room.w - wallT, iy1 = room.y + room.h - wallT
  const gx = h === 'left' ? cx - ix0 - halfX : h === 'right' ? ix1 - halfX - cx : cx - (ix0 + ix1) / 2
  const gy = v === 'top' ? cy - iy0 - halfY : v === 'bottom' ? iy1 - halfY - cy : cy - (iy0 + iy1) / 2
  return { gap_x: gx, gap_y: gy }
}

// Validate a layout the way check-room-layouts does: pairwise overlaps + pieces poking past the
// inner wall face, with a small margin. Returns per-piece `flags` (for colouring) plus detailed
// `overlaps` ([a,b] indices + the overlap extent) and `oob` (index + which sides + how far), so
// the editor can spell out exactly what is wrong.
export function validateLayout(pieces, room, wallT, units, margin = 2) {
  const rects = (pieces || []).map((p) => pieceRect(p, room, wallT, units))
  const ix0 = room.x + wallT, iy0 = room.y + wallT, ix1 = room.x + room.w - wallT, iy1 = room.y + room.h - wallT
  const flags = rects.map(() => ({ overlap: false, oob: [] }))
  const overlaps = []
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      const A = rects[a], B = rects[b]
      const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)
      const oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0)
      if (ox > margin && oy > margin) {
        flags[a].overlap = true; flags[b].overlap = true
        overlaps.push({ a, b, ox: Math.round(ox), oy: Math.round(oy) })
      }
    }
  }
  const oob = []
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i], sides = []
    if (r.x0 < ix0 - margin) sides.push({ side: 'W', by: Math.round(ix0 - r.x0) })
    if (r.x1 > ix1 + margin) sides.push({ side: 'E', by: Math.round(r.x1 - ix1) })
    if (r.y0 < iy0 - margin) sides.push({ side: 'N', by: Math.round(iy0 - r.y0) })
    if (r.y1 > iy1 + margin) sides.push({ side: 'S', by: Math.round(r.y1 - iy1) })
    flags[i].oob = sides
    if (sides.length) oob.push({ i, sides })
  }
  return { rects, flags, overlaps, oob }
}

// Does `piece` overlap a door opening on a wall it sits on? `doorsBySide[side]` is a list of
// [lo,hi] opening intervals along that wall (X for north/south, Y for east/west).
function pieceHitsDoor(piece, room, wallT, units, doorsBySide) {
  for (const side of occupiedWalls(piece.anchor)) {
    const doors = doorsBySide && doorsBySide[side]
    if (!doors || !doors.length) continue
    const box = pieceBox(piece, room, wallT, units)
    const horiz = side === 'north' || side === 'south'
    const lo = horiz ? box.x - box.halfX : box.y - box.halfY
    const hi = horiz ? box.x + box.halfX : box.y + box.halfY
    if (doors.some(([d0, d1]) => hi > d0 - CLEAR && lo < d1 + CLEAR)) return true
  }
  return false
}

// How many pieces of a layout land on a door opening (precise; the C score).
export function doorOverlapCount(pieces, room, wallT, units, doorsBySide) {
  let n = 0
  for (const p of pieces || []) if (pieceHitsDoor(p, room, wallT, units, doorsBySide)) n++
  return n
}

// Free sub-ranges of [lo,hi] not covered by any obstacle interval (interval subtraction).
function subtractIntervals(lo, hi, obstacles) {
  const obs = obstacles
    .map(([a, b]) => [Math.max(a, lo), Math.min(b, hi)])
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0])
  const free = []
  let cur = lo
  for (const [a, b] of obs) {
    if (a > cur) free.push([cur, a])
    cur = Math.max(cur, b)
  }
  if (cur < hi) free.push([cur, hi])
  return free
}

const round1 = (n) => Math.round(n * 10) / 10

// Return `piece` with its gap set so its along-wall centre lands at `center` (the other axis
// is untouched). Inverts the anchor math in pieceBox for the moved axis.
function withAlongCenter(piece, side, center, aHalf, room, wallT) {
  const { h, v } = parseAnchor(piece.anchor)
  const out = { ...piece }
  if (side === 'north' || side === 'south') {
    const ix0 = room.x + wallT, ix1 = room.x + room.w - wallT
    const gx = h === 'left' ? center - ix0 - aHalf : h === 'right' ? ix1 - aHalf - center : center - (ix0 + ix1) / 2
    out.gap_x = round1(gx)
  } else {
    const iy0 = room.y + wallT, iy1 = room.y + room.h - wallT
    const gy = v === 'top' ? center - iy0 - aHalf : v === 'bottom' ? iy1 - aHalf - center : center - (iy0 + iy1) / 2
    out.gap_y = round1(gy)
  }
  return out
}

// Try to slide one piece along each door-carrying wall it sits on so its footprint clears the
// opening, staying inside the room and off the other openings and the `others` pieces. Returns
// the moved piece, or null if no clear spot exists on some blocked wall (then it's dropped).
function shiftClear(piece, others, room, wallT, units, doorsBySide) {
  let p = piece
  for (const side of occupiedWalls(piece.anchor)) {
    const doors = doorsBySide && doorsBySide[side]
    if (!doors || !doors.length) continue
    const horiz = side === 'north' || side === 'south'
    const box = pieceBox(p, room, wallT, units)
    const aCenter = horiz ? box.x : box.y
    const aHalf = horiz ? box.halfX : box.halfY
    const cLo = horiz ? box.y - box.halfY : box.x - box.halfX
    const cHi = horiz ? box.y + box.halfY : box.x + box.halfX
    const innerLo = horiz ? room.x + wallT : room.y + wallT
    const innerHi = horiz ? room.x + room.w - wallT : room.y + room.h - wallT
    const lo = innerLo + aHalf, hi = innerHi - aHalf
    if (lo > hi) return null // the piece can't sit on this wall at all
    // Center-exclusion zones: each door, and each other piece sharing this lane (its footprint
    // overlaps ours on the cross axis), grown by our half-extent + clearance. PAD keeps a little
    // extra so that landing on a zone edge (and rounding the gap) still clears the CLEAR test.
    const PAD = CLEAR + 1
    const obstacles = doors.map(([d0, d1]) => [d0 - aHalf - PAD, d1 + aHalf + PAD])
    for (const o of others) {
      const ob = pieceBox(o, room, wallT, units)
      const oc0 = horiz ? ob.y - ob.halfY : ob.x - ob.halfX
      const oc1 = horiz ? ob.y + ob.halfY : ob.x + ob.halfX
      if (Math.min(cHi, oc1) - Math.max(cLo, oc0) <= CLEAR) continue // not in our lane
      const oa0 = horiz ? ob.x - ob.halfX : ob.y - ob.halfY
      const oa1 = horiz ? ob.x + ob.halfX : ob.y + ob.halfY
      obstacles.push([oa0 - aHalf - PAD, oa1 + aHalf + PAD])
    }
    const blocked = (c) => obstacles.some(([o0, o1]) => c > o0 + 1e-6 && c < o1 - 1e-6)
    if (aCenter >= lo - 1e-6 && aCenter <= hi + 1e-6 && !blocked(aCenter)) continue // already clear
    const free = subtractIntervals(lo, hi, obstacles)
    if (!free.length) return null
    let bestC = null, bestD = Infinity
    for (const [f0, f1] of free) {
      const c = Math.max(f0, Math.min(aCenter, f1))
      const d = Math.abs(c - aCenter)
      if (d < bestD) { bestD = d; bestC = c }
    }
    if (bestC == null) return null
    p = withAlongCenter(p, side, bestC, aHalf, room, wallT)
  }
  return p
}

// Place a layout's pieces clear of the door openings: a piece on an opening is SLID along its
// wall to the nearest clear spot (in-bounds, off the other openings and already-placed pieces);
// only if it can't clear is it dropped. Pieces are handled in order, each seeing the ones
// already placed (at their new spots) plus the rest (at their authored spots) as obstacles.
export function placePieces(pieces, room, wallT, units, doorsBySide) {
  const result = []
  const all = pieces || []
  for (let i = 0; i < all.length; i++) {
    const others = result.concat(all.slice(i + 1))
    const placed = shiftClear(all[i], others, room, wallT, units, doorsBySide)
    if (!placed) continue // no clear spot on a door wall — dropped
    // Drop a piece that would COLLIDE with one already placed, just like a door-blocked piece:
    // better to show fewer pieces than furniture overlapping furniture. The earlier piece wins.
    if (result.some((o) => piecesCollide(placed, o, room, wallT, units))) continue
    result.push(placed)
  }
  return result
}

// Do two placed pieces' plan footprints overlap by more than a small margin (both axes)? Same
// test validateLayout / check-room-layouts use.
const OVERLAP_MARGIN = 2
export function piecesCollide(a, b, room, wallT, units) {
  const A = pieceRect(a, room, wallT, units)
  const B = pieceRect(b, room, wallT, units)
  const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)
  const oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0)
  return ox > OVERLAP_MARGIN && oy > OVERLAP_MARGIN
}

// True when we have enough context to score/carve by real geometry (else fall back to the
// coarse wall-level conflict count).
export function canPlaceByGeometry(ctx) {
  return !!(ctx && ctx.room && ctx.units && ctx.wallT != null && ctx.doorIntervals)
}
