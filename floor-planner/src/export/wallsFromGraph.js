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
    if (iv) shared.push({ iv, kind: edgeKind(room.id, n.id), id: n.id })
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
  // Touch the start (a whole-wall opening touches both) -> anchor to the start, so the
  // opening stays pinned to the wall start and its width tracks the wall as it resizes.
  // Only a truly interior opening (neither end) is centred.
  if (loAtEnd) return 'start'
  if (hiAtEnd) return 'end'
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

// A formula token for a coordinate `v` on the wall's axis: the GUIDE-LINE ref if `v`
// lands on one (e.g. "main.x4"), else the plain number. So an opening's offset/width
// track the guides — the shared wall's edges and the neighbour edges it spans are all
// guide lines — and resize with the grid instead of staying a hard-coded pixel span.
// `ref` is guides.xRef for N/S walls, guides.yRef for E/W walls (undefined ⇒ no guides,
// so the numeric value is kept and no formula is emitted).
function coordExpr(v, ref) {
  return (ref && ref(v)) || String(r0(v))
}

// The `formulas` map ({offset, width}) mirroring `anchoredOffset` + the [u0,u1] span,
// but written against the guide lines so the resolver re-derives them when a guide
// moves. `u0e`/`u1e` are the near/far edge expressions (guide refs ± half-thickness).
function openingFormulas(anchor, u0e, u1e, LO, HI, withWidth) {
  const f = {
    offset:
      anchor === 'start' ? `= (${u0e}) - ${LO}`
      : anchor === 'end' ? `= ${HI} - (${u1e})`
      : `= ((${u0e}) + (${u1e})) / 2 - (${LO} + ${HI}) / 2`,
  }
  if (withWidth) f.width = `= (${u1e}) - (${u0e})`
  return f
}

// Place an opening on wall `g`, covering the centreline interval it should span.
// The renderer (v2) grows the room by t/2 on each side and maps an opening `offset`
// to `along = t/2 + offset` (relative to the chosen anchor), so the opening's near
// edge lands at centreline coordinate `u0`. Everything here is in project units
// (`S` = units per cell, 1 in practice).
//
// A `gap` fills the shared span [a,b]. Each END of the segment is a corner (a junction
// with a perpendicular wall), whether it is the owner wall's own end or a mid-wall
// junction where the owner's wall continues past it. So each end is treated on its own
// (`ends.{mergeLo,mergeHi,extendLo,extendHi}` from the caller):
//   - merge → flush (an adjacent OPEN run on the same wall joins this one)
//   - extend → carve t/2 PAST the corner (a FULLY-OPEN corner; only N/S walls, which
//     own the t-wide corner square, do this — dissolves the floating pillar)
//   - otherwise → reserve t/2 for the corner post of the perpendicular wall there.
// `edge` = { LO, HI } are the wall's own start/end coordinate EXPRESSIONS (from the owner
// room, so a crossing wall's far edge is `nearGuide + dimensionVar` and tracks the room's
// size rather than a stale crossing-guide line).
function placeGap(g, a, b, S, name, height, t, ends, ref, edge) {
  const { mergeLo, mergeHi, extendLo, extendHi } = ends
  const u0 = mergeLo ? a : extendLo ? a - t / 2 : a + t / 2
  const u1 = mergeHi ? b : extendHi ? b + t / 2 : b - t / 2
  const loEnd = Math.abs(a - g.lo) < EPS, hiEnd = Math.abs(b - g.hi) < EPS
  const anchor = anchorFor(loEnd, hiEnd)
  const op = {
    kind: 'gap',
    name,
    anchor,
    offset: anchoredOffset(anchor, u0, u1, g, S),
    width: r0(Math.max(1, (u1 - u0) * S)),
    height: r0(height ?? DOOR_H_UNITS),
  }
  if (ref) {
    const LO = edge.LO, HI = edge.HI, h = r0(t / 2)
    // A segment end that is the wall's own end uses the wall-edge expression (tracks the
    // room dimension); an interior end lands on a guide line.
    const Ae = loEnd ? LO : coordExpr(a, ref)
    const Be = hiEnd ? HI : coordExpr(b, ref)
    const u0e = mergeLo ? Ae : extendLo ? `${Ae} - ${h}` : `${Ae} + ${h}`
    const u1e = mergeHi ? Be : extendHi ? `${Be} + ${h}` : `${Be} - ${h}`
    op.formulas = openingFormulas(anchor, u0e, u1e, LO, HI, true) // gap width tracks the span
  }
  return op
}

// A door leaf centred on the shared segment [a,b]. The leaf WIDTH is a fixed physical size
// (not guide-scaled); only its position (offset) tracks the guides. Its width/height come from
// the `door_width`/`door_height` config variables (so a homeowner can tune the door size),
// except a door on a wall too short for the full width keeps its fitted numeric width.
function placeDoor(g, a, b, S, name, ref, edge, doorW, doorH) {
  const seg = b - a
  const w = Math.max(6, Math.min(doorW, seg - DOOR_MARGIN * 2))
  const clamped = w < doorW - 1e-6
  const u0 = (a + b) / 2 - w / 2
  const u1 = u0 + w
  const loEnd = Math.abs(a - g.lo) < EPS, hiEnd = Math.abs(b - g.hi) < EPS
  const anchor = anchorFor(loEnd, hiEnd)
  const op = {
    kind: 'door',
    name,
    anchor,
    offset: anchoredOffset(anchor, u0, u1, g, S),
    width: r0(w * S),
    height: r0(doorH),
  }
  if (ref) {
    const LO = edge.LO, HI = edge.HI
    const h = clamped ? String(r0(w / 2)) : 'door_width / 2' // half-width tracks the variable
    const Ae = loEnd ? LO : coordExpr(a, ref)
    const Be = hiEnd ? HI : coordExpr(b, ref)
    const mid = `(${Ae} + ${Be}) / 2`
    const f = openingFormulas(anchor, `${mid} - ${h}`, `${mid} + ${h}`, LO, HI, false)
    if (!clamped) f.width = '= door_width'
    f.height = '= door_height'
    op.formulas = f
  }
  return op
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
export function computeRoomWalls(room, rooms, edgeKind, S, wallHeight = 100, wallThickness = 8, openCorners = new Set(), guides = null, heightById = null, doorW = DOOR_W, doorH = DOOR_H_UNITS) {
  const selfHeight = (heightById && heightById.get(room.id)) ?? wallHeight
  const walls = {}
  let doorN = 0 // per-room unique opening names
  // An OPEN connection is a wall + a full-width, full-HEIGHT `gap` (a frameless passage),
  // never a missing wall — so the room's rectangle stays closed and the corners join, with the
  // open run carved out cleanly to the wall top (the gap height is the side's own height).
  const t = wallThickness
  for (const side of SIDES) {
    const { g, shared, ext } = sideInfo(room, side, rooms, edgeKind)
    // OWNERSHIP: a shared boundary is defined by exactly ONE room, so a shared wall +
    // its opening are declared once. The EAST / SOUTH room owns it; on WEST / NORTH
    // the neighbour owns them, so this room only walls the exterior remainder there.
    const owns = side === 'east' || side === 'south'
    // OWNERSHIP: a shared boundary is walled by exactly ONE room (the east/south room), so a
    // shared wall + its opening are declared once — no coincident duplicate walls, so no extra
    // corner returns to leave a pillar at a junction.
    const wallHere = ext.length > 0 || (owns && shared.length > 0)
    if (!wallHere) continue
    // Wall HEIGHT is per side: a shared wall takes the TALLER of the two rooms, so the wall a
    // full-height room shares with a low balcony/terrace comes out full height (a room's own
    // height only lowers its EXTERIOR walls — the parapet). This replaces "both rooms draw the
    // shared wall and the taller wins" with one wall at the right height, keeping single
    // ownership (and its clean corners).
    let sideHeight = selfHeight
    if (owns) for (const s of shared) {
      const nH = (heightById && heightById.get(s.id)) ?? wallHeight
      if (nH > sideHeight) sideHeight = nH
    }

    // The wall runs along X for N/S sides, Y for E/W — pick the matching guide axis
    // so the opening formulas reference the right lines.
    const isNSwall = side === 'north' || side === 'south'
    const ref = guides ? (isNSwall ? guides.xRef : guides.yRef) : null
    // The wall's own start/end as EXPRESSIONS from the room: the near and far edges are the
    // room's two guide lines on this axis.
    const edge = ref
      ? { LO: coordExpr(g.lo, ref), HI: coordExpr(g.hi, ref) }
      : null
    const openings = []
    if (owns) {
      for (const s of shared) {
        const [a, b] = s.iv
        if (s.kind === 'door') {
          openings.push(placeDoor(g, a, b, S, `Door${++doorN}`, ref, edge, doorW, doorH))
        } else if (s.kind === 'open') {
          // Treat EACH end of the shared span as its own corner (a junction with a
          // perpendicular wall), not just the owner wall's ends — otherwise a segment
          // that sits MID-WALL on the owner's side (the owner's wall continues past it)
          // misses its own end-corner and the gap runs t/2 too wide there.
          //  - merge: an adjacent OPEN run on the SAME wall joins this one → flush.
          //  - extend: a FULLY-OPEN corner → carve t/2 past it (only N/S walls own the
          //    corner square; E/W walls are inset and would just collide with a
          //    collinear neighbour).
          //  - else: reserve t/2 for the perpendicular wall's corner post.
          const isNS = side === 'north' || side === 'south'
          const mergeLo = shared.some((o) => o.kind === 'open' && o !== s && Math.abs(o.iv[1] - a) < EPS)
          const mergeHi = shared.some((o) => o.kind === 'open' && o !== s && Math.abs(o.iv[0] - b) < EPS)
          const extendLo = isNS && !mergeLo && openCorners.has(ptKey(...sidePoint(side, g, a)))
          const extendHi = isNS && !mergeHi && openCorners.has(ptKey(...sidePoint(side, g, b)))
          openings.push(placeGap(g, a, b, S, `Open${++doorN}`, Math.max(DOOR_H_UNITS, sideHeight), t, { mergeLo, mergeHi, extendLo, extendHi }, ref, edge))
        }
        // kind === null (partition) -> solid, no opening
      }
    }
    // Carry a per-side height only when it differs from the room's own height (a shared wall
    // that borrows a taller neighbour's height); otherwise the wall uses the room height.
    const hProp = sideHeight !== selfHeight ? { height: r0(sideHeight) } : {}
    walls[side] = { ...(openings.length ? { openings } : {}), ...hProp }
  }
  return walls
}

/** The set of room SIDES ('north'|'south'|'east'|'west') that carry an opening (a door or
 *  a gap) — i.e. a shared boundary with a connection. Furniture placement uses this to keep
 *  pieces off the walls a door lands on. Includes openings the neighbour owns (both sides of
 *  a shared wall are "open" for the purpose of not blocking the passage). */
export function roomOpenSides(room, rooms, edgeKind) {
  const open = new Set()
  for (const side of SIDES) {
    for (const n of rooms) {
      if (n === room || n.floor !== room.floor) continue
      if (!sharedInterval(room, side, n)) continue
      const k = edgeKind(room.id, n.id)
      if (k === 'door' || k === 'open') { open.add(side); break }
    }
  }
  return open
}

/** Per side, the opening INTERVALS along that wall (X for north/south, Y for east/west),
 *  in absolute coords. A `door` is centred on the shared segment at `doorWidth` (matching
 *  placeDoor); an `open` (gap) spans the whole shared segment less the corner margins.
 *  Lets furniture placement carve out exactly where an opening is, not just which wall. */
export function roomDoorIntervals(room, rooms, edgeKind, doorWidth = DOOR_W) {
  const bySide = { north: [], south: [], east: [], west: [] }
  for (const side of SIDES) {
    for (const n of rooms) {
      if (n === room || n.floor !== room.floor) continue
      const seg = sharedInterval(room, side, n)
      if (!seg) continue
      const k = edgeKind(room.id, n.id)
      if (k !== 'door' && k !== 'open') continue
      const [a, b] = seg
      if (k === 'open') {
        const lo = a + DOOR_MARGIN, hi = b - DOOR_MARGIN
        if (hi > lo) bySide[side].push([lo, hi])
      } else {
        const w = Math.max(6, Math.min(doorWidth, b - a - DOOR_MARGIN * 2))
        const mid = (a + b) / 2
        bySide[side].push([mid - w / 2, mid + w / 2])
      }
    }
  }
  return bySide
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
