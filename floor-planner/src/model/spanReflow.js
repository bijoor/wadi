// Apply the elastic guide-span model to a planner model: recompute guide positions from the
// per-axis spans (model/spans.js), pull each room's edges onto their new guide positions, and
// grow/shrink the plot to fit. Room edges sit on guides (guides are derived from room edges),
// so a guide moving carries its rooms with it. With NO spans defined every cell defaults to
// flex weighted by its current size, so distribution reproduces the current layout exactly:
// reflowSpans is then a no-op, which is what keeps free-room editing unchanged until a span
// is actually set.

import { solveAxisSpans } from './spans.js'

const R6 = (v) => Math.round(Number(v) * 1e6) / 1e6

// Reflow ONE axis. Returns { guides, rooms } with new positions, or null if the axis has
// fewer than two guides (nothing to distribute).
function reflowAxis(model, axis) {
  const guides = (model.guides && model.guides[axis]) || []
  if (guides.length < 2) return null
  const spans = (model.spans && model.spans[axis]) || []
  const ats = guides.map((g) => Number(g.at))
  const origin = Math.min(...ats)
  // The axis length is the current span of the guides (their extent), so a fully flexible
  // axis reproduces itself; a rigid/pinned axis produces its natural size instead, and the
  // rooms (and then the plot) extend to it.
  const extent = Math.max(...ats) - origin
  const { positions } = solveAxisSpans(guides, spans, extent, origin)

  const newGuides = guides.map((g) => ({ ...g, at: R6(positions.get(g.id) ?? g.at) }))
  // Map an OLD edge position to the NEW position of the guide that sits there.
  const remap = new Map(guides.map((g) => [R6(g.at), positions.get(g.id)]))
  const posOf = (v) => { const m = remap.get(R6(v)); return m == null ? Number(v) : m }
  const rooms = (model.rooms || []).map((r) => {
    if (axis === 'x') { const x0 = posOf(r.x), x1 = posOf(r.x + r.w); return { ...r, x: R6(x0), w: R6(x1 - x0) } }
    const y0 = posOf(r.y), y1 = posOf(r.y + r.h); return { ...r, y: R6(y0), h: R6(y1 - y0) }
  })
  return { guides: newGuides, rooms }
}

// Reflow both axes and refit the plot. Returns { guides, rooms, plot }.
export function reflowSpans(model) {
  let m = model
  const rx = reflowAxis(m, 'x')
  if (rx) m = { ...m, guides: { ...m.guides, x: rx.guides }, rooms: rx.rooms }
  const ry = reflowAxis(m, 'y')
  if (ry) m = { ...m, guides: { ...m.guides, y: ry.guides }, rooms: ry.rooms }
  // Elastic plot: grow/shrink to fit the reflowed rooms (origin pinned).
  const plot = model.plot || {}
  const rooms = m.rooms || []
  const maxX = Math.max(plot.x || 0, ...rooms.map((r) => r.x + r.w))
  const maxY = Math.max(plot.y || 0, ...rooms.map((r) => r.y + r.h))
  const nextPlot = { ...plot, w: R6(maxX - (plot.x || 0)), h: R6(maxY - (plot.y || 0)) }
  return { guides: m.guides, rooms, plot: nextPlot }
}

// Drop spans whose endpoint guides no longer exist on their axis (a room that carried them
// was moved or deleted, so the guide id is gone). Keeps `spans` well-formed across edits.
export function pruneSpans(spans, guides) {
  const ids = (lines) => new Set((lines || []).map((g) => g.id))
  const keep = (arr, lines) => { const s = ids(lines); return (arr || []).filter((sp) => s.has(sp.lo) && s.has(sp.hi)) }
  return {
    x: keep(spans && spans.x, guides && guides.x),
    y: keep(spans && spans.y, guides && guides.y),
  }
}
