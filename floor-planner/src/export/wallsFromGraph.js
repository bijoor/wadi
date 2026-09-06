// Derive Wadi room WALLS + openings (door / gap) from the graph, per room side.
//
// The graph gives room rectangles (on a grid) + directed connections between them.
// Wadi rooms carry per-side walls (`walls.{north,south,east,west}`), each optionally
// with openings. This turns the graph's adjacency + connection kinds into that
// per-side wall model:
//
//   - a room SIDE that is exterior (no neighbour there)      -> solid wall
//   - a shared side segment with a `door` connection         -> wall + centred door
//   - a shared side segment with an `open` connection        -> wall + a full-width
//                                                               frameless `gap`
//   - a shared side segment with NO connection (a partition) -> solid wall, no opening
//
// A shared wall is DEFINED ONCE: the owner (the room on the EAST / SOUTH side of the
// boundary) draws the wall + its opening; the neighbour omits that fully-shared side,
// so there is a single wall on the shared centreline and no second wall to fill the
// opening. Coordinates here are PROJECT UNITS; `S` = Wadi units per cell (1).
//
// Opening frame (Wadi v2): an opening `offset` is measured along the wall's CLEAR
// span, which starts `t/2` in from the outer corner (the perpendicular wall reaches
// half a thickness along this wall). The renderer computes `along = t/2 + offset`,
// so offset 0 = the inner corner and offset `-t/2` = the outer corner. A gap that
// ends at a wall corner keeps a `t/2` return there, UNLESS both walls meeting at
// that corner are open (a fully-open corner): then the return is a floating pillar,
// so the gap is extended into the corner (a negative start / an over-width far end)
// to dissolve it — see `classifyOpenCorners`.

const SIDES = ['north', 'south', 'east', 'west']
const EPS = 1e-6
// Coordinates are PROJECT UNITS. At the default 10 units = 1 ft, a door leaf is
// ~30 units (3 ft) and 70 units tall (7 ft, safely under the default wall height).
const DOOR_W = 30
const DOOR_MARGIN = 6 // clear span kept at each side of a door
const DOOR_H_UNITS = 70

const r0 = (n) => Math.round(n * 1000) / 1000
const ptKey = (x, y) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`

// The side's line: perpendicular coord `perp` and the parallel span [lo,hi], in cells.
function sideGeom(r, side) {
  const x1 = r.x + r.w, y1 = r.y + r.h
  if (side === 'north') return { perp: r.y, lo: r.x, hi: x1 }
  if (side === 'south') return { perp: y1, lo: r.x, hi: x1 }
  if (side === 'west') return { perp: r.x, lo: r.y, hi: y1 }
  return { perp: x1, lo: r.y, hi: y1 } // east
}

// The (x,y) point at along-coordinate `along` on a room's `side` line.
function sidePoint(side, g, along) {
  const isNS = side === 'north' || side === 'south'
  return isNS ? [along, g.perp] : [g.perp, along]
}

// If `n` shares `r`'s `side`, the overlap interval [a,b] along the side axis; else null.
function sharedInterval(r, side, n) {
  const nx1 = n.x + n.w, ny1 = n.y + n.h
  const ov = (a0, a1, b0, b1) => {
    const lo = Math.max(a0, b0), hi = Math.min(a1, b1)
    return hi - lo > EPS ? [lo, hi] : null
  }
  if (side === 'north' && Math.abs(ny1 - r.y) < EPS) return ov(r.x, r.x + r.w, n.x, nx1)
  if (side === 'south' && Math.abs(n.y - (r.y + r.h)) < EPS) return ov(r.x, r.x + r.w, n.x, nx1)
  if (side === 'west' && Math.abs(nx1 - r.x) < EPS) return ov(r.y, r.y + r.h, n.y, ny1)
  if (side === 'east' && Math.abs(n.x - (r.x + r.w)) < EPS) return ov(r.y, r.y + r.h, n.y, ny1)
  return null
}

// [lo,hi] minus a set of sub-intervals -> the leftover (exterior) pieces.
function subtract(span, subs) {
  const s = subs.filter(Boolean).map(([a, b]) => [a, b]).sort((p, q) => p[0] - q[0])
  const out = []
  let cur = span[0]
  for (const [a, b] of s) {
    if (a > cur + EPS) out.push([cur, Math.min(a, span[1])])
    cur = Math.max(cur, b)
    if (cur >= span[1] - EPS) break
  }
  if (cur < span[1] - EPS) out.push([cur, span[1]])
  return out.filter(([a, b]) => b - a > EPS)
}

// A side's geometry + its shared segments (with connection kind) + exterior pieces.
function sideInfo(room, side, rooms, edgeKind) {
  const g = sideGeom(room, side)
  const shared = []
  for (const n of rooms) {
    if (n === room || n.floor !== room.floor) continue
    const iv = sharedInterval(room, side, n)
    if (iv) shared.push({ iv, kind: edgeKind(room.id, n.id) })
  }
  const ext = subtract([g.lo, g.hi], shared.map((s) => s.iv))
  return { g, shared, ext }
}

// Pick the opening ANCHOR from where its shared segment sits on the wall, so the
// opening stays put when a guide moves and the wall resizes: a segment at the wall
// START anchors to the start, one at the END anchors to the end, and one in the
// middle (or spanning the whole wall) anchors to the centre. Anchoring everything to
// `start` (the default) would let an end/middle opening drift off its wall on resize.
function anchorFor(loAtEnd, hiAtEnd) {
  if (loAtEnd && !hiAtEnd) return 'start'
  if (hiAtEnd && !loAtEnd) return 'end'
  return 'center'
}

// The `offset` for `anchor` that makes the opening cover centreline [u0,u1] on wall
// `g`. Matches `openingStartOffset` in editor/src/svg2d/openingAnchor.ts:
//   start  → distance from the wall start to the near edge
//   end    → distance from the wall end to the far edge (0 = flush to the end)
//   center → signed shift of the opening centre from the wall midpoint
function anchoredOffset(anchor, u0, u1, g, S) {
  if (anchor === 'end') return r0((g.hi - u1) * S)
  if (anchor === 'center') return r0(((u0 + u1) / 2 - (g.lo + g.hi) / 2) * S)
  return r0((u0 - g.lo) * S)
}

// Place an opening on wall `g`, covering the centreline interval it should span.
// The renderer (v2) grows the room by t/2 on each side and maps an opening `offset`
// to `along = t/2 + offset` (relative to the chosen anchor), so the opening's near
// edge lands at centreline coordinate `u0`. Everything here is in project units
// (`S` = units per cell, 1 in practice).
//
// A `gap` fills the shared span. At a wall END (a shared corner) the N/S wall owns a
// t-wide corner square, so the gap stops half a thickness short of the centreline end
// (`g.hi - t/2`), leaving that corner post. When the corner is FULLY OPEN (both walls
// there are gaps) the post is a floating pillar, so the gap is carved right through to
// the outer corner (`g.hi + t/2`) via `extendLo` / `extendHi`. Interior ends are flush.
function placeGap(g, a, b, S, name, height, t, extendLo, extendHi) {
  const loAtEnd = Math.abs(a - g.lo) < EPS
  const hiAtEnd = Math.abs(b - g.hi) < EPS
  const u0 = loAtEnd ? (extendLo ? g.lo - t / 2 : g.lo + t / 2) : a
  const u1 = hiAtEnd ? (extendHi ? g.hi + t / 2 : g.hi - t / 2) : b
  const anchor = anchorFor(loAtEnd, hiAtEnd)
  return {
    kind: 'gap',
    name,
    anchor,
    offset: anchoredOffset(anchor, u0, u1, g, S),
    width: r0(Math.max(1, (u1 - u0) * S)),
    height: r0(height ?? DOOR_H_UNITS),
  }
}

// A door leaf centred on the shared segment [a,b].
function placeDoor(g, a, b, S, name) {
  const seg = b - a
  const w = Math.max(6, Math.min(DOOR_W, seg - DOOR_MARGIN * 2))
  const u0 = (a + b) / 2 - w / 2
  const u1 = u0 + w
  const anchor = anchorFor(Math.abs(a - g.lo) < EPS, Math.abs(b - g.hi) < EPS)
  return {
    kind: 'door',
    name,
    anchor,
    offset: anchoredOffset(anchor, u0, u1, g, S),
    width: r0(w * S),
    height: r0(DOOR_H_UNITS),
  }
}

/** The set of corner points (keyed by `ptKey`) where EVERY wall meeting the corner
 *  is an open passage — so the corner has no solid wall and its `t/2` returns are a
 *  floating pillar to be dissolved. A corner with any solid wall (exterior, a
 *  partition, or a door's wall) is NOT open: its returns are real and must stay, and
 *  extending a gap through it would cut the solid room's wall. */
export function classifyOpenCorners(rooms, edgeKind, t) {
  const pts = new Map() // key -> [x,y]
  for (const r of rooms) {
    for (const x of [r.x, r.x + r.w]) for (const y of [r.y, r.y + r.h]) pts.set(ptKey(x, y), [x, y])
  }
  const open = new Set()
  for (const [key, [px, py]] of pts) {
    let covered = false, solid = false
    for (const r of rooms) {
      for (const side of SIDES) {
        const { g, shared, ext } = sideInfo(r, side, rooms, edgeKind)
        const isNS = side === 'north' || side === 'south'
        const perpVal = isNS ? py : px
        const alongVal = isNS ? px : py
        if (Math.abs(g.perp - perpVal) > EPS) continue
        if (alongVal < g.lo - EPS || alongVal > g.hi + EPS) continue
        covered = true
        const touches = (iv) => iv[0] - EPS <= alongVal && alongVal <= iv[1] + EPS
        if (ext.some(touches)) solid = true // exterior wall reaches the corner
        for (const s of shared) if (s.kind !== 'open' && touches(s.iv)) solid = true
      }
    }
    if (covered && !solid) open.add(key)
  }
  return open
}

/** Per-room `walls` object from the graph. `edgeKind(aId,bId)` returns 'door' |
 *  'open' | null (null = adjacent but no connection = a solid partition).
 *  `openCorners` (from classifyOpenCorners) is the set of fully-open corners whose
 *  gap returns are dissolved. */
export function computeRoomWalls(room, rooms, edgeKind, S, wallHeight = 100, wallThickness = 8, openCorners = new Set()) {
  const walls = {}
  let doorN = 0 // per-room unique opening names
  // An OPEN connection is a wall + a full-width, full-HEIGHT `gap` (a frameless
  // passage), never a missing wall — so the room's rectangle stays closed and the
  // corners join, with the open run carved out cleanly to the wall top.
  const openH = Math.max(DOOR_H_UNITS, Number(wallHeight) || 100)
  const t = wallThickness
  for (const side of SIDES) {
    const { g, shared, ext } = sideInfo(room, side, rooms, edgeKind)
    // OWNERSHIP: a shared boundary is defined by exactly ONE room, so a shared wall +
    // its opening are declared once. The EAST / SOUTH room owns it; on WEST / NORTH
    // the neighbour owns them, so this room only walls the exterior remainder there.
    const owns = side === 'east' || side === 'south'
    // The owner ALWAYS walls its side when there's anything there — exterior OR any
    // shared neighbour. Never omit a fully-open owned side: that leaves the rectangle
    // open. The open run just becomes a full opening in the wall.
    const wallHere = ext.length > 0 || (owns && shared.length > 0)
    if (!wallHere) continue

    const openings = []
    if (owns) {
      for (const s of shared) {
        const [a, b] = s.iv
        if (s.kind === 'door') {
          openings.push(placeDoor(g, a, b, S, `Door${++doorN}`))
        } else if (s.kind === 'open') {
          // The OPEN run becomes a full-width (the whole shared span), full-HEIGHT
          // `gap`. Where this run reaches a wall corner that is fully open (both walls
          // there are gaps), carve the gap through the corner so no floating post
          // (pillar) is left; at a corner with a solid wall, keep the corner post.
          // Only N/S walls own (and draw) the t-wide corner square, so only they carve
          // it. E/W walls are inset from the corner, and extending them would just make
          // two collinear E/W gaps overlap at the shared point.
          const isNS = side === 'north' || side === 'south'
          const loAtEnd = isNS && Math.abs(a - g.lo) < EPS
          const hiAtEnd = isNS && Math.abs(b - g.hi) < EPS
          const extendLo = loAtEnd && openCorners.has(ptKey(...sidePoint(side, g, g.lo)))
          const extendHi = hiAtEnd && openCorners.has(ptKey(...sidePoint(side, g, g.hi)))
          openings.push(placeGap(g, a, b, S, `Open${++doorN}`, openH, t, extendLo, extendHi))
        }
        // kind === null (partition) -> solid, no opening
      }
    }
    walls[side] = openings.length ? { openings } : {}
  }
  return walls
}

/** Build an `edgeKind(aId,bId)` lookup from the graph edges. A connection with no
 *  explicit kind defaults to `door`; a pair with no edge returns null (partition).
 *  Undirected: geometry treats a connection the same either way (the arrow only
 *  records the flow of movement through the house). */
export function edgeKindLookup(edges) {
  const map = new Map()
  for (const e of edges || []) {
    map.set(e.a + ' ' + e.b, e.kind || 'door')
    map.set(e.b + ' ' + e.a, e.kind || 'door')
  }
  return (aId, bId) => map.get(aId + ' ' + bId) ?? null
}
