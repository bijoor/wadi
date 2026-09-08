// The room-layout LIBRARY: the live source of furniture layouts that BOTH the layout editor and
// the planner (furniture preview + .wadi export) read from. It overlays the built-in pack
// (roomLayouts.json, compiled from rooms.wdl) with the author's local edits in localStorage, so a
// change made in the editor shows up in the planner immediately — no `build-layouts` round-trip.
// "Save rooms.wdl" is a separate export (libraryEdits + layoutWdl) for committing back to the repo.

import BUILTIN from '../export/roomLayouts.json'
import { layoutName } from '../export/layoutWdl.js'
import { anchorFacing } from '../export/furnitureFit.js'

// A piece's effective absolute rotation: explicit if set, else the anchor's natural facing (the
// same rule the pipeline uses). rotation is only stored when it DIFFERS from this default, so a
// value of 0 on a side/corner wall (whose default is 90/180/270) is kept, not dropped.
const effRot = (p) => (p.rotation != null ? Math.round(p.rotation) : anchorFacing(p.anchor || 'center'))

const KEY = 'floor-planner:layouts:v1'
const BUILTIN_BY_ID = new Map((BUILTIN.layouts || []).map((l) => [l.id, l]))
const r0 = (n) => Math.round(Number(n) || 0)

const subs = new Set()
const emit = () => { for (const f of subs) f() }
export function subscribeLibrary(fn) { subs.add(fn); return () => subs.delete(fn) }

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { overrides: {}, deleted: [] } }
  catch { return { overrides: {}, deleted: [] } }
}
function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode etc. */ }
  emit()
}

// A stable JSON of the parts that matter, so an override that equals the built-in is dropped
// (no phantom "edited" once the pack has been rebuilt to include it).
const canon = (l) => JSON.stringify({
  id: l.id, type: l.type, w: r0(l.w), h: r0(l.h), height: l.height ?? null,
  pieces: (l.pieces || []).map((p) => ({ id: p.asset?.id, anchor: p.anchor || 'center', gx: r0(p.gap_x), gy: r0(p.gap_y), rot: effRot(p) })),
})
const sameAsBuiltin = (l) => BUILTIN_BY_ID.has(l.id) && canon(BUILTIN_BY_ID.get(l.id)) === canon(l)

// The merged library: built-ins overlaid by overrides, minus deletions, in a stable order
// (built-ins in pack order, then new rooms).
export function libraryLayouts() {
  const s = read()
  const del = new Set(s.deleted)
  const byId = new Map()
  for (const l of BUILTIN.layouts || []) if (!del.has(l.id)) byId.set(l.id, l)
  for (const [id, l] of Object.entries(s.overrides)) if (!del.has(id)) byId.set(id, l)
  return [...byId.values()]
}

// UI helpers: which ids are locally overridden / deleted, and whether anything is pending.
export function libraryState() {
  const s = read()
  return { overrideIds: new Set(Object.keys(s.overrides)), deletedIds: new Set(s.deleted), builtinIds: BUILTIN_BY_ID }
}
export function isLibraryDirty() {
  const s = read()
  return Object.keys(s.overrides).length > 0 || s.deleted.length > 0
}

export function upsertLayout(layout) {
  const s = read()
  s.deleted = s.deleted.filter((d) => d !== layout.id)
  if (sameAsBuiltin(layout)) delete s.overrides[layout.id] // no-op edit: keep the library clean
  else s.overrides[layout.id] = layout
  write(s)
}
export function removeLayout(id) {
  const s = read()
  delete s.overrides[id]
  if (BUILTIN_BY_ID.has(id) && !s.deleted.includes(id)) s.deleted.push(id)
  write(s)
}
export function resetLibrary() { write({ overrides: {}, deleted: [] }) }

// ---- draft <-> layout ----
// The editor works with a `draft` (type + variant + editable pieces); the library stores a
// `layout` (id + compact pieces). These convert between them.
export function layoutFromDraft(d) {
  const height = d.height != null && d.height !== '' ? { height: r0(d.height) } : {}
  return {
    id: layoutName(d),
    type: String(d.type || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    w: r0(d.w), h: r0(d.h), ...height,
    pieces: (d.pieces || []).map((p) => {
      const anchor = p.anchor || 'center'
      const eff = effRot(p)
      return {
        asset: p.asset, anchor,
        ...(r0(p.gap_x) ? { gap_x: r0(p.gap_x) } : {}),
        ...(r0(p.gap_y) ? { gap_y: r0(p.gap_y) } : {}),
        ...(eff !== anchorFacing(anchor) ? { rotation: eff } : {}), // keep only when it differs from the anchor default (0 included)
      }
    }),
  }
}
export function draftFromLayout(l) {
  return {
    type: l.type,
    variant: l.id.startsWith(l.type + '_') ? l.id.slice(l.type.length + 1) : l.id,
    w: l.w, h: l.h, height: l.height ?? '',
    // Show the EFFECTIVE rotation so the editor matches the planner (a piece with no stored
    // rotation faces per its anchor, not 0).
    pieces: (l.pieces || []).map((p) => ({ asset: p.asset, anchor: p.anchor || 'center', gap_x: p.gap_x ?? 0, gap_y: p.gap_y ?? 0, rotation: effRot(p) })),
  }
}

// The edits to splice into rooms.wdl to make the pack match the current library (for the export).
export function libraryEdits() {
  const s = read()
  const del = new Set(s.deleted)
  const edits = []
  for (const [id, layout] of Object.entries(s.overrides)) {
    if (del.has(id)) continue
    edits.push({ op: BUILTIN_BY_ID.has(id) ? 'replace' : 'insert', name: id, draft: draftFromLayout(layout) })
  }
  for (const id of s.deleted) if (BUILTIN_BY_ID.has(id)) edits.push({ op: 'delete', name: id })
  return edits
}
