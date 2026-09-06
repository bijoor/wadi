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
  const bx = [], by = []
  for (const b of model.bindings || []) {
    const r = byId.get(b.room)
    if (!r) continue
    const value = varVal.has(b.var) ? varVal.get(b.var) : dimSize(r, b.dim)
    if (b.dim === 'w') {
      const lo = idAt(gx, r.x), hi = idAt(gx, r.x + r.w)
      if (lo && hi) bx.push({ lo, hi, varName: b.var, value })
    } else {
      const lo = idAt(gy, r.y), hi = idAt(gy, r.y + r.h)
      if (lo && hi) by.push({ lo, hi, varName: b.var, value })
    }
  }
  return { bx, by }
}

// Solve both axes for the model's current bindings. Returns the per-axis solve results
// (each with .at and .formula keyed by guide id) plus overall feasibility.
export function solveModel(model) {
  const plot = model.plot || {}
  const ox = Number(plot.x) || 0, oy = Number(plot.y) || 0
  const W = Number(plot.w) || 300, L = Number(plot.h) || 200
  const rooms = model.rooms || []
  const { bx, by } = buildAxisBindings(model)
  const rsX = rooms.map((r) => [r.x, r.x + r.w])
  const rsY = rooms.map((r) => [r.y, r.y + r.h])
  const X = solveAxis(W, model.guides?.x || [], bx, rsX, ox)
  const Y = solveAxis(L, model.guides?.y || [], by, rsY, oy)
  return { X, Y, feasible: X.feasible && Y.feasible, message: X.message || Y.message }
}
