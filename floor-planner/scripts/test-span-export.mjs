// Tests for the guide-formula export (src/export/spanGrid.js). Run with:
//   node floor-planner/scripts/test-span-export.mjs
// spanGrid has no WDL-emitter dependency, so it runs in plain node (unlike toWadi.js).

import { guidesFromModel } from '../src/export/spanGrid.js'

let pass = 0, fail = 0
function assert(label, cond) { if (cond) { pass++; console.log('  ok  ', label) } else { fail++; console.log('  FAIL', label) } }
// Evaluate a guide `at` formula ("= a + (b - c)") with a variable map.
const evalAt = (at, vars) => typeof at === 'number' ? at : Function(...Object.keys(vars), `return (${String(at).replace(/^=\s*/, '')})`)(...Object.values(vars))
const guides = (...ats) => ats.map((at, i) => ({ id: 'g' + i, at }))
const ctx = { unit: 'ft', step: 10, plotW: 300, plotL: 300 }
const model = (gy, spansY, variables) => ({ guides: { x: [{ id: 'x0', at: 0 }, { id: 'x1', at: 100 }], y: gy }, spans: { x: [], y: spansY }, rooms: [], variables })

// E1: a fixed atomic span exports as its plain variable.
{
  const g = guides(0, 100, 200)
  const out = guidesFromModel(model(g, [{ lo: 'g0', hi: 'g1', policy: { kind: 'fixed', var: 'living_depth' } }], { living_depth: { value: 100 } }), ctx)
  assert('E1 atomic span -> variable', out.grid.y[1].at === '= 0 + living_depth')
  assert('E1 variable emitted', out.variables.living_depth === 100)
}

// E2: the atale nested-group case. Group [g0,g2] = dining_depth (crosses g1) contains
// Balcony-NE [g0,g1] (Auto) + Bath [g1,g2] (fixed bath_depth). Balcony-NE must ABSORB, so
// the group boundary g2 is independent of bath_depth (the bug that shipped: g2 grew with it).
{
  const g = guides(30, 65, 95, 170) // B, C, D, E  (offset so it's not the axis origin)
  const spans = [
    { lo: 'g0', hi: 'g2', policy: { kind: 'fixed', var: 'dining_depth' } }, // group B..D
    { lo: 'g1', hi: 'g2', policy: { kind: 'fixed', var: 'bath_depth' } },   // Bath C..D
    { lo: 'g2', hi: 'g3', policy: { kind: 'fixed', var: 'lower_depth' } },  // below the group
  ]
  const vars = { dining_depth: { value: 65 }, bath_depth: { value: 30 }, lower_depth: { value: 75 } }
  const out = guidesFromModel(model(g, spans, vars), { ...ctx, plotL: 170 })
  const yD = out.grid.y[2].at // g2 = the group's far boundary
  const at30 = evalAt(yD, { dining_depth: 65, bath_depth: 30, lower_depth: 75 })
  const at50 = evalAt(yD, { dining_depth: 65, bath_depth: 50, lower_depth: 75 })
  assert('E2 group boundary present as a formula', typeof yD === 'string')
  assert('E2 group boundary independent of bath_depth', at30 === at50 && at30 === 30 + 65)
  // Balcony-NE (g0..g1) absorbs: C = B + (dining_depth - bath_depth)
  const c30 = evalAt(out.grid.y[1].at, { dining_depth: 65, bath_depth: 30 })
  const c50 = evalAt(out.grid.y[1].at, { dining_depth: 65, bath_depth: 50 })
  assert('E2 Balcony-NE shrinks as Bath grows', c30 === 30 + 35 && c50 === 30 + 15)
  // The plot length must not depend on bath_depth either.
  const p30 = evalAt(out.plotFormulas.length, { dining_depth: 65, bath_depth: 30, lower_depth: 75 })
  const p50 = evalAt(out.plotFormulas.length, { dining_depth: 65, bath_depth: 50, lower_depth: 75 })
  assert('E2 plot length independent of bath_depth', p30 === p50)
}

// E3: a fixed group with only Auto children shares proportionally (var * fraction summing to
// the group), and the group total equals the variable.
{
  const g = guides(0, 40, 100) // group [g0,g2]=hall, split 40:60 by two Auto cells
  const out = guidesFromModel(model(g, [{ lo: 'g0', hi: 'g2', policy: { kind: 'fixed', var: 'hall' } }], { hall: { value: 100 } }), ctx)
  const d = evalAt(out.grid.y[2].at, { hall: 100 })
  assert('E3 all-auto group totals the variable', d === 100)
  const d120 = evalAt(out.grid.y[2].at, { hall: 120 })
  assert('E3 scales with the variable', d120 === 120)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
