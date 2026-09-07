// First-class GUIDES + BAYS for the planner (Phase A).
//
// A GUIDE is a named division line on an axis that room edges bind to (by sitting on
// it). A BAY is the span between two adjacent guides on an axis; naming a bay (or
// marking it editable) is the homeowner-facing lever that becomes a configurator knob
// on export. Guides are DOC-level (shared across floors), derived from every room's
// edges plus any manual/permanent lines — matching how the Wadi export builds one
// `main` grid that all floors reference.
//
// Lifecycle (see plans/configurable-guides.md):
//   - manual guide            -> permanent (persists even with no room on it)
//   - auto guide (room edge)  -> provisional; garbage-collected when no edge holds it
//   - naming a bay            -> promotes its two bounding guides to permanent
//
// This module is pure: `syncGuides(rooms, prev)` reconciles the persisted guides/bays
// against the current rooms and returns the next {guides, bays}. It preserves guide
// ids (hence bay identity + names) for lines whose position is unchanged, and keeps
// permanent lines regardless of whether a room still sits on them.

import { makeId } from './graph.js'

const EPS = 0.001
const R = (v) => Math.round(Number(v) * 1000) / 1000

// Distinct edge coordinates of all rooms, per axis (project units, rounded).
export function roomEdges(rooms) {
  const xs = new Set(), ys = new Set()
  for (const r of rooms || []) {
    xs.add(R(r.x)); xs.add(R(r.x + r.w))
    ys.add(R(r.y)); ys.add(R(r.y + r.h))
  }
  return {
    x: [...xs].sort((a, b) => a - b),
    y: [...ys].sort((a, b) => a - b),
  }
}

// Stable key for the bay between two guides (order-independent by the sorted ids).
export function bayKey(idA, idB) {
  return [idA, idB].sort().join('|')
}

// Reconcile one axis: guides are DERIVED PURELY from the current room edges, so they
// always track the rooms. There is one line per distinct edge position; a line's id is
// reused when a line already sat at that position (so bay keys / identity stay stable),
// else a fresh id is minted. Lines with no room edge are dropped. (The permanent/manual
// concept was retired: it pinned lines in place so they stopped tracking rooms; manual
// guides will return later as an explicit, separately-tracked feature.)
function syncAxis(prevLines, edges) {
  const prev = Array.isArray(prevLines) ? prevLines : []
  const used = new Set()
  const out = []
  for (const at of edges) {
    const reuse = prev.find((g) => !used.has(g.id) && Math.abs(R(g.at) - at) < EPS)
    if (reuse) { out.push({ ...reuse, at, permanent: false }); used.add(reuse.id) }
    else out.push({ id: makeId('g'), at, permanent: false })
  }
  out.sort((a, b) => a.at - b.at)
  return out
}

// Recompute the per-axis bays from adjacent guide pairs, carrying over any name /
// editable metadata whose bounding pair still exists.
export function recomputeBays(guides, prevBays) {
  const next = {}
  const carry = prevBays || {}
  for (const axis of ['x', 'y']) {
    const lines = guides[axis]
    for (let i = 0; i + 1 < lines.length; i++) {
      const key = bayKey(lines[i].id, lines[i + 1].id)
      const meta = carry[key]
      if (meta && (meta.name || meta.editable)) next[key] = { ...meta }
    }
  }
  return next
}

/** Reconcile persisted guides/bays against the current rooms.
 *  `prev` = { guides:{x,y}, bays } (any may be missing). Returns the next pair. */
export function syncGuides(rooms, prev) {
  const edges = roomEdges(rooms)
  const pg = (prev && prev.guides) || { x: [], y: [] }
  const guides = { x: syncAxis(pg.x, edges.x), y: syncAxis(pg.y, edges.y) }
  const bays = recomputeBays(guides, prev && prev.bays)
  return { guides, bays }
}

/** Mark the two guides bounding a bay permanent (called when a bay is named/flagged),
 *  so the division lines and the bay survive future room edits. Returns new guides. */
export function promoteBayGuides(guides, key) {
  const [a, b] = String(key).split('|')
  const bump = (lines) => lines.map((g) => (g.id === a || g.id === b ? { ...g, permanent: true } : g))
  return { x: bump(guides.x), y: bump(guides.y) }
}
