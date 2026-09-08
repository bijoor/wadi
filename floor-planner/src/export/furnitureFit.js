// Furniture fit helpers for room-layout selection.
//
// Two jobs, both pure (no I/O):
//   A. Orientation — a layout authored portrait (e.g. 78x46) can be rotated 90° to fit a
//      landscape room (46x78). rotateLayoutCW swaps the target and rotates every piece
//      (anchor, gaps, and facing) so the whole arrangement turns as one.
//   C. Door-position-aware placement — a piece counts as conflicting only when its actual
//      footprint overlaps a door OPENING on its wall (not merely "that wall has a door").
//      doorOverlapCount scores candidates precisely; carveDoors drops the pieces that still
//      land on an opening. Geometry mirrors editor/src/svg2d/furnitureAnchor.ts (anchorItem)
//      and the door centring in wallsFromGraph.js placeDoor, so what we test here matches
//      what the pipeline draws.

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

// Drop the pieces that still overlap a door opening in the chosen layout.
export function carveDoors(pieces, room, wallT, units, doorsBySide) {
  return (pieces || []).filter((p) => !pieceHitsDoor(p, room, wallT, units, doorsBySide))
}

// True when we have enough context to score/carve by real geometry (else fall back to the
// coarse wall-level conflict count).
export function canPlaceByGeometry(ctx) {
  return !!(ctx && ctx.room && ctx.units && ctx.wallT != null && ctx.doorIntervals)
}
