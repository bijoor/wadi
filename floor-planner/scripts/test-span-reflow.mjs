// Tests for span reflow + the SET_SPAN reducer wiring. Run with:
//   node floor-planner/scripts/test-span-reflow.mjs

import { reflowSpans, pruneSpans } from '../src/model/spanReflow.js'
import { fixed, flex } from '../src/model/spans.js'
const near2 = (a, b) => Math.abs(a - b) < 1e-2
import { reducer } from '../src/store/reducer.js'
import { sampleModel, normalizeModel } from '../src/store/initialState.js'

let pass = 0, fail = 0
const near = (a, b) => Math.abs(a - b) < 1e-3
function assert(label, cond) { if (cond) { pass++; console.log('  ok  ', label) } else { fail++; console.log('  FAIL', label) } }

// Two rooms side by side; guides derived from their edges.
const base = () => ({
  plot: { x: 0, y: 0, w: 200, h: 100 },
  rooms: [
    { id: 'A', x: 0, y: 0, w: 100, h: 100 },
    { id: 'B', x: 100, y: 0, w: 100, h: 100 },
  ],
  guides: {
    x: [{ id: 'gx0', at: 0 }, { id: 'gx1', at: 100 }, { id: 'gx2', at: 200 }],
    y: [{ id: 'gy0', at: 0 }, { id: 'gy1', at: 100 }],
  },
  spans: { x: [], y: [] },
})
const roomBy = (rooms, id) => rooms.find((r) => r.id === id)

// N1: no spans -> reflow is a no-op (guides, rooms, plot unchanged).
{
  const m = base()
  const r = reflowSpans(m)
  assert('N1 guides x unchanged', r.guides.x.every((g, i) => near(g.at, m.guides.x[i].at)))
  assert('N1 rooms unchanged', near(roomBy(r.rooms, 'A').w, 100) && near(roomBy(r.rooms, 'B').x, 100) && near(roomBy(r.rooms, 'B').w, 100))
  assert('N1 plot unchanged', near(r.plot.w, 200) && near(r.plot.h, 100))
}

// N2: pin A's width (cell gx0..gx1) to 150 -> B absorbs, plot stays 200.
{
  const m = base()
  m.spans.x = [{ id: 's1', lo: 'gx0', hi: 'gx1', policy: fixed(150) }]
  const r = reflowSpans(m)
  assert('N2 gx1 -> 150', near(r.guides.x[1].at, 150))
  assert('N2 A width 150', near(roomBy(r.rooms, 'A').w, 150))
  assert('N2 B x=150 width 50', near(roomBy(r.rooms, 'B').x, 150) && near(roomBy(r.rooms, 'B').w, 50))
  assert('N2 plot still 200 (flex absorbed)', near(r.plot.w, 200))
}

// N3: pin BOTH cells (rigid axis) -> plot grows to the sum.
{
  const m = base()
  m.spans.x = [
    { id: 's1', lo: 'gx0', hi: 'gx1', policy: fixed(150) },
    { id: 's2', lo: 'gx1', hi: 'gx2', policy: fixed(120) },
  ]
  const r = reflowSpans(m)
  assert('N3 A=150, B=120', near(roomBy(r.rooms, 'A').w, 150) && near(roomBy(r.rooms, 'B').w, 120))
  assert('N3 plot grows to 270', near(r.plot.w, 270))
}

// N4: 2:1 ratio between the two cells at the fixed plot width 200.
{
  const m = base()
  m.spans.x = [
    { id: 's1', lo: 'gx0', hi: 'gx1', policy: flex(2) },
    { id: 's2', lo: 'gx1', hi: 'gx2', policy: flex(1) },
  ]
  const r = reflowSpans(m)
  assert('N4 2:1 -> A=133.3, B=66.7', near(roomBy(r.rooms, 'A').w, 200 * 2 / 3) && near(roomBy(r.rooms, 'B').w, 200 / 3))
}

// N5: pruneSpans drops a span whose guide is gone.
{
  const spans = { x: [{ id: 's', lo: 'gx0', hi: 'gGONE', policy: fixed(1) }], y: [] }
  const pruned = pruneSpans(spans, { x: [{ id: 'gx0', at: 0 }], y: [] })
  assert('N5 stale span pruned', pruned.x.length === 0)
}

// N6: SET_SPAN through the reducer reflows the state end to end.
{
  const doc = normalizeModel(sampleModel())
  const state = { ...doc, tool: 'select', selection: { type: null, id: null }, selectedIds: [], activeFloor: doc.floors[0].id, history: { past: [], future: [] } }
  const gx = state.guides.x
  assert('N6 has >=2 x guides', gx.length >= 2)
  const before = gx[1].at
  // Pin the first x cell to a clearly different width.
  const target = before + 40
  const next = reducer(state, { type: 'SET_SPAN', axis: 'x', lo: gx[0].id, hi: gx[1].id, policy: fixed(target) })
  assert('N6 span recorded', (next.spans.x || []).some((s) => s.lo === gx[0].id && s.hi === gx[1].id))
  assert('N6 gx1 moved to target', near(next.guides.x[1].at, target))
  assert('N6 history pushed', next.history.past.length === 1)
  // Removing it (policy null) leaves the (already reflowed) layout in place, span gone.
  const cleared = reducer(next, { type: 'SET_SPAN', axis: 'x', lo: gx[0].id, hi: gx[1].id, policy: null })
  assert('N6 span removed', !(cleared.spans.x || []).some((s) => s.lo === gx[0].id && s.hi === gx[1].id))
}

// N7: SET_SPAN with flex weights through the reducer -> a clean ratio between cells. Set the
// first x-cell to weight 2 and the rest to weight 1; the first cell ends up twice the second.
{
  const doc = normalizeModel(sampleModel())
  const state = { ...doc, tool: 'select', selection: { type: null, id: null }, selectedIds: [], activeFloor: doc.floors[0].id, history: { past: [], future: [] } }
  const gx = state.guides.x
  let s = state
  for (let i = 0; i < gx.length - 1; i++) s = reducer(s, { type: 'SET_SPAN', axis: 'x', lo: gx[i].id, hi: gx[i + 1].id, policy: flex(i === 0 ? 2 : 1) })
  const at = s.guides.x.map((g) => g.at)
  assert('N7 flex 2:1 -> first cell twice the second', near2((at[1] - at[0]) / (at[2] - at[1]), 2))
  assert('N7 plot width unchanged (all flex absorb)', near(s.plot.w, state.plot.w))
}

// N8: shared variable across axes (the balcony pattern) through the reducer. Bind room A's
// WIDTH and room B's DEPTH to one variable, then SET_VAR drives both.
{
  const st = {
    plot: { x: 0, y: 0, w: 200, h: 160 }, floors: [{ id: 'f1', name: 'G' }], edges: [],
    rooms: [{ id: 'A', name: 'A', floor: 'f1', x: 0, y: 0, w: 100, h: 80 }, { id: 'B', name: 'B', floor: 'f1', x: 100, y: 0, w: 100, h: 80 }],
    guides: { x: [{ id: 'gx0', at: 0 }, { id: 'gx1', at: 100 }, { id: 'gx2', at: 200 }], y: [{ id: 'gy0', at: 0 }, { id: 'gy1', at: 80 }, { id: 'gy2', at: 160 }] },
    spans: { x: [], y: [] }, variables: {}, grid: { unitPerCell: 10 }, build: {},
    tool: 'select', selection: { type: null, id: null }, selectedIds: [], activeFloor: 'f1', history: { past: [], future: [] },
  }
  let s = reducer(st, { type: 'SET_SPAN', axis: 'x', lo: 'gx0', hi: 'gx1', policy: { kind: 'fixed', var: 'balcony' } })
  assert('N8 variable created from span size', !!s.variables.balcony && near(s.variables.balcony.value, 100))
  s = reducer(s, { type: 'SET_SPAN', axis: 'y', lo: 'gy0', hi: 'gy1', policy: { kind: 'fixed', var: 'balcony' } })
  assert('N8 y span snaps to the shared value', near(s.guides.y[1].at, 100))
  s = reducer(s, { type: 'SET_VAR', name: 'balcony', value: 130 })
  assert('N8 SET_VAR drives the x width', near(s.guides.x[1].at, 130))
  assert('N8 SET_VAR drives the y depth', near(s.guides.y[1].at, 130))
  // Unbinding both frees the variable (GC).
  s = reducer(s, { type: 'SET_SPAN', axis: 'x', lo: 'gx0', hi: 'gx1', policy: null })
  s = reducer(s, { type: 'SET_SPAN', axis: 'y', lo: 'gy0', hi: 'gy1', policy: null })
  assert('N8 variable GCd when no span uses it', !('balcony' in s.variables))
}

// N9: RENAME_VAR + DELETE_VAR through the reducer.
{
  const st = {
    plot: { x: 0, y: 0, w: 200, h: 100 }, floors: [{ id: 'f1', name: 'G' }], edges: [],
    rooms: [{ id: 'A', name: 'A', floor: 'f1', x: 0, y: 0, w: 100, h: 100 }, { id: 'B', name: 'B', floor: 'f1', x: 100, y: 0, w: 100, h: 100 }],
    guides: { x: [{ id: 'gx0', at: 0 }, { id: 'gx1', at: 100 }, { id: 'gx2', at: 200 }], y: [{ id: 'gy0', at: 0 }, { id: 'gy1', at: 100 }] },
    spans: { x: [], y: [] }, variables: {}, grid: { unitPerCell: 10 }, build: {},
    tool: 'select', selection: { type: null, id: null }, selectedIds: [], activeFloor: 'f1', history: { past: [], future: [] },
  }
  let s = reducer(st, { type: 'SET_SPAN', axis: 'x', lo: 'gx0', hi: 'gx1', policy: { kind: 'fixed', var: 'w1' } })
  s = reducer(s, { type: 'RENAME_VAR', name: 'w1', newName: 'Bay A' })
  assert('N9 rename: new key exists, old gone', 'bay_a' in s.variables && !('w1' in s.variables))
  assert('N9 rename: span rebound', s.spans.x[0].policy.var === 'bay_a')
  s = reducer(s, { type: 'DELETE_VAR', name: 'bay_a' })
  assert('N9 delete: span dropped (back to Auto)', s.spans.x.length === 0)
  assert('N9 delete: variable removed', !('bay_a' in s.variables))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
