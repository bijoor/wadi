// Room-size variables: the configurable layer (see plans/room-size-variables.md).
//
// A VARIABLE is a named number ({name,value,label?,min?,max?,step?}). A BINDING attaches a
// variable to a room dimension ({var, room, dim:'w'|'h'}). Many bindings may share one
// variable (one knob drives several, possibly non-aligned, dimensions). A variable's
// `value` is kept live = the size of its CANONICAL (first-bound) dimension, so the export
// seed always matches the sketch. `solveModel` turns the current bindings into the per-axis
// constrained solve (model/sizeSolve.js) that keeps the plot fixed.

import { solveAxis } from './sizeSolve.js'

export const dimSize = (room, dim) => (dim === 'h' ? room.h : room.w)
export const dimAxis = (dim) => (dim === 'h' ? 'y' : 'x')

// A safe, unique identifier from a label: "Living width" -> "living_width".
export function varIdent(label, used) {
  let base = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!base) base = 'size'
  if (!/^[a-z_]/.test(base)) base = 'v_' + base
  let name = base, n = 1
  while (used.has(name)) { n += 1; name = `${base}_${n}` }
  used.add(name)
  return name
}

// The canonical (first-bound) dimension's current size for a variable, or undefined.
export function canonicalValue(varName, bindings, rooms) {
  const byId = new Map((rooms || []).map((r) => [r.id, r]))
  for (const b of bindings || []) {
    if (b.var !== varName) continue
    const r = byId.get(b.room)
    if (r) return dimSize(r, b.dim)
  }
  return undefined
}

// Refresh every variable's `value` from its canonical dimension (called on any room edit),
// so the export seed and the panel always show the live size.
export function syncVarValues(variables, bindings, rooms) {
  return (variables || []).map((v) => {
    const cv = canonicalValue(v.name, bindings, rooms)
    return cv == null ? v : { ...v, value: cv }
  })
}

// Drop variables that no binding references any more.
export function cleanupVars(variables, bindings) {
  const held = new Set((bindings || []).map((b) => b.var))
  return (variables || []).filter((v) => held.has(v.name))
}

// Remove all bindings for the given room ids, then GC orphaned variables.
export function dropRoomBindings(variables, bindings, roomIds) {
  const gone = new Set(roomIds)
  const kept = (bindings || []).filter((b) => !gone.has(b.room))
  return { bindings: kept, variables: cleanupVars(variables, kept) }
}

// Build the per-axis solve inputs from a model's bindings (looking up the guide ids each
// bound dimension sits on). Skips bindings whose edges are not on a guide line.
export function buildAxisBindings(model) {
  const rooms = model.rooms || []
  const byId = new Map(rooms.map((r) => [r.id, r]))
  const gx = model.guides?.x || [], gy = model.guides?.y || []
  const idAt = (lines, at) => { const l = lines.find((l) => Math.abs(l.at - at) < 1e-3); return l && l.id }
  const varVal = new Map((model.variables || []).map((v) => [v.name, Number(v.value)]))
  // Collapse bindings that resolve to the SAME (variable, guide-span): several aligned
  // rooms (e.g. Living + Kitchen both spanning the same two lines) share one span, and
  // emitting a constraint per room would create duplicate rows and a singular solve.
  const bx = [], by = []
  const seen = new Set()
  const push = (arr, lo, hi, varName, value) => {
    const key = `${varName}|${lo}|${hi}`
    if (seen.has(key)) return
    seen.add(key)
    arr.push({ lo, hi, varName, value })
  }
  for (const b of model.bindings || []) {
    const r = byId.get(b.room)
    if (!r) continue
    const value = varVal.has(b.var) ? varVal.get(b.var) : dimSize(r, b.dim)
    if (b.dim === 'w') {
      const lo = idAt(gx, r.x), hi = idAt(gx, r.x + r.w)
      if (lo && hi) push(bx, lo, hi, b.var, value)
    } else {
      const lo = idAt(gy, r.y), hi = idAt(gy, r.y + r.h)
      if (lo && hi) push(by, lo, hi, b.var, value)
    }
  }
  // Percentage SHARES: each member's span is pinned to pct/100 * total. The pcts sum to
  // 100, so the run's total span stays fixed and only the interior lines move (reallocation
  // without plot growth). A synthetic var name keeps each pin distinct.
  for (const sh of model.shares || []) {
    const total = Number(sh.total)
    const arr = sh.dim === 'w' ? bx : by
    const lines = sh.dim === 'w' ? gx : gy
    ;(sh.members || []).forEach((roomId, k) => {
      const r = byId.get(roomId)
      if (!r) return
      const val = (Number(sh.pcts?.[k]) / 100) * total
      const lo = idAt(lines, sh.dim === 'w' ? r.x : r.y)
      const hi = idAt(lines, sh.dim === 'w' ? r.x + r.w : r.y + r.h)
      if (lo && hi) push(arr, lo, hi, `__share_${sh.id}_${k}`, val)
    })
  }
  return { bx, by }
}

// Build a percentage SHARE from a set of rooms along `dim` ('w' or 'h'): order them by
// position, verify they tile a contiguous run (each far edge meets the next near edge),
// and seed the split from their current sizes. Returns the share or null if not a run.
export function makeShare(id, rooms, roomIds, dim) {
  const chosen = (roomIds || []).map((rid) => rooms.find((r) => r.id === rid)).filter(Boolean)
  if (chosen.length < 2) return null
  const near = (r) => (dim === 'w' ? r.x : r.y)
  const far = (r) => (dim === 'w' ? r.x + r.w : r.y + r.h)
  const ordered = [...chosen].sort((a, b) => near(a) - near(b))
  for (let i = 1; i < ordered.length; i++) {
    if (Math.abs(near(ordered[i]) - far(ordered[i - 1])) > 1e-3) return null // not contiguous
  }
  const sizes = ordered.map((r) => dimSize(r, dim))
  const total = sizes.reduce((a, b) => a + b, 0)
  if (!(total > 0)) return null
  const pcts = sizes.map((s) => (s / total) * 100)
  return { id, dim, members: ordered.map((r) => r.id), total, pcts }
}

// Set member `index` to `pct` and redistribute the rest proportionally so the run still
// sums to 100 (each kept at >= a small floor). Returns the new pcts array.
export function adjustPcts(pcts, index, pct) {
  const n = pcts.length
  const floor = 1
  const p = Math.max(floor, Math.min(100 - floor * (n - 1), pct))
  const others = pcts.reduce((s, v, i) => (i === index ? s : s + v), 0)
  const out = pcts.slice()
  out[index] = p
  if (others > 0) for (let i = 0; i < n; i++) if (i !== index) out[i] = Math.max(floor, pcts[i] - (p - pcts[index]) * (pcts[i] / others))
  const sum = out.reduce((a, b) => a + b, 0)
  return out.map((v) => (v * 100) / sum)
}

const R6 = (v) => Math.round(Number(v) * 1e6) / 1e6

// Re-solve the model at its current variable values and WRITE the result back into room
// geometry + guide positions (the live in-planner reflow). Each room edge sits on a guide,
// so its new coordinate is that guide's solved position. Returns { rooms, guides } or null
// when the solve is infeasible (over-constrained) so the caller can leave the sketch as is.
export function reflowModel(model) {
  const solved = solveModel(model)
  if (!solved.feasible) return null
  const gx = model.guides?.x || [], gy = model.guides?.y || []
  const gidAt = (lines, at) => { const g = lines.find((l) => Math.abs(l.at - at) < 1e-3); return g && g.id }
  const posX = (at) => { const id = gidAt(gx, at); const v = id && solved.X.at.get(id); return v == null ? at : v }
  const posY = (at) => { const id = gidAt(gy, at); const v = id && solved.Y.at.get(id); return v == null ? at : v }
  const rooms = (model.rooms || []).map((r) => {
    const x0 = posX(r.x), x1 = posX(r.x + r.w)
    const y0 = posY(r.y), y1 = posY(r.y + r.h)
    return { ...r, x: R6(x0), y: R6(y0), w: R6(x1 - x0), h: R6(y1 - y0) }
  })
  const guides = {
    x: gx.map((g) => ({ ...g, at: R6(solved.X.at.get(g.id) ?? g.at) })),
    y: gy.map((g) => ({ ...g, at: R6(solved.Y.at.get(g.id) ?? g.at) })),
  }
  return { rooms, guides }
}

// Solve both axes for the model's current bindings, ELASTIC: every bound span is pinned to
// its variable and the plot floats (grows with the sizes = cumulative evaluation). Returns
// the per-axis solved positions (.at keyed by guide id) plus overall feasibility.
export function solveModel(model) {
  const plot = model.plot || {}
  const ox = Number(plot.x) || 0, oy = Number(plot.y) || 0
  const W = Number(plot.w) || 300, L = Number(plot.h) || 200
  const rooms = model.rooms || []
  const { bx, by } = buildAxisBindings(model)
  const rsX = rooms.map((r) => [r.x, r.x + r.w])
  const rsY = rooms.map((r) => [r.y, r.y + r.h])
  const opts = { pinFar: false } // elastic everywhere: the plot fits the rooms
  const X = solveAxis(W, model.guides?.x || [], bx, rsX, ox, opts)
  const Y = solveAxis(L, model.guides?.y || [], by, rsY, oy, opts)
  return { X, Y, feasible: X.feasible && Y.feasible, message: X.message || Y.message }
}
