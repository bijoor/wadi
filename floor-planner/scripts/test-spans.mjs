// Tests for the elastic-guide-span model (src/model/spans.js). Pure JS, run with node:
//   node floor-planner/scripts/test-spans.mjs

import { fixed, flex, buildAxisTree, distribute, naturalSize, positionsOf, solveAxisSpans } from '../src/model/spans.js'

let pass = 0, fail = 0
const near = (a, b) => Math.abs(a - b) < 1e-3
// Guides at the given positions -> [{id:'g0',at},...]
const G = (...ats) => ats.map((at, i) => ({ id: 'g' + i, at }))
// Assert the solved positions equal the expected id->pos map.
function eqPos(label, got, exp) {
  const ok = Object.entries(exp).every(([id, v]) => near(got.get(id), v)) && got.size === Object.keys(exp).length
  if (ok) { pass++; console.log('  ok  ', label) }
  else { fail++; console.log('  FAIL', label, '\n    got ', [...got].map(([k, v]) => `${k}=${v}`).join(' '), '\n    exp ', Object.entries(exp).map(([k, v]) => `${k}=${v}`).join(' ')) }
}
function assert(label, cond) { if (cond) { pass++; console.log('  ok  ', label) } else { fail++; console.log('  FAIL', label) } }

// T1: no spans -> reproduces the current layout at the natural total.
{
  const g = G(0, 100, 200, 300)
  const r = solveAxisSpans(g, [], 300, 0)
  eqPos('T1 no spans reproduces layout', r.positions, { g0: 0, g1: 100, g2: 200, g3: 300 })
  assert('T1 natural = 300', near(r.natural, 300))
}

// T1b: no spans, bigger plot -> scales proportionally (all cells equal here).
{
  const g = G(0, 100, 200, 300)
  const r = solveAxisSpans(g, [], 360, 0)
  eqPos('T1b proportional scale to 360', r.positions, { g0: 0, g1: 120, g2: 240, g3: 360 })
}

// T2: pin one cell fixed -> the others absorb the rest, weighted by their sizes.
{
  const g = G(0, 100, 200, 300)
  const spans = [{ lo: 'g0', hi: 'g1', policy: fixed(150) }]
  const r = solveAxisSpans(g, spans, 300, 0)
  eqPos('T2 fixed cell, others absorb', r.positions, { g0: 0, g1: 150, g2: 225, g3: 300 })
}

// T3: explicit flex ratio 2:1:1 across the axis.
{
  const g = G(0, 100, 200, 300)
  const spans = [
    { lo: 'g0', hi: 'g1', policy: flex(2) },
    { lo: 'g1', hi: 'g2', policy: flex(1) },
    { lo: 'g2', hi: 'g3', policy: flex(1) },
  ]
  const r = solveAxisSpans(g, spans, 300, 0)
  eqPos('T3 flex 2:1:1', r.positions, { g0: 0, g1: 150, g2: 225, g3: 300 })
}

// T4: skip-guide group (the plan's worked example). A=[g0,g2] fixed 120 with interior g1;
// [g2,g3] flex. g1 splits the group 1:1 (default), the flex cell takes the rest.
{
  const g = G(0, 100, 200, 300)
  const spans = [{ lo: 'g0', hi: 'g2', policy: fixed(120) }]
  const r = solveAxisSpans(g, spans, 300, 0)
  eqPos('T4 skip-guide group A=120', r.positions, { g0: 0, g1: 60, g2: 120, g3: 300 })
}

// T4b: a group with a MIX of fixed + flex children (the plan's K example). K=[g0,g3] fixed
// 300: [g0,g1] fixed 100, [g1,g2] flex 2, [g2,g3] flex 1.
{
  const g = G(0, 100, 200, 300)
  const spans = [
    { lo: 'g0', hi: 'g3', policy: fixed(300) },
    { lo: 'g0', hi: 'g1', policy: fixed(100) },
    { lo: 'g1', hi: 'g2', policy: flex(2) },
    { lo: 'g2', hi: 'g3', policy: flex(1) },
  ]
  const r = solveAxisSpans(g, spans, 300, 0)
  eqPos('T4b group fixed+flex', r.positions, { g0: 0, g1: 100, g2: 233.333, g3: 300 })
}

// T4c: grow that group to 360 -> fixed child holds, flex children re-split the new leftover.
{
  const g = G(0, 100, 200, 300)
  const spans = [
    { lo: 'g0', hi: 'g3', policy: fixed(360) },
    { lo: 'g0', hi: 'g1', policy: fixed(100) },
    { lo: 'g1', hi: 'g2', policy: flex(2) },
    { lo: 'g2', hi: 'g3', policy: flex(1) },
  ]
  const r = solveAxisSpans(g, spans, 300, 0)
  eqPos('T4c group grown to 360', r.positions, { g0: 0, g1: 100, g2: 273.333, g3: 360 })
  assert('T4c plot grows to 360 (all-fixed top)', near(r.total, 360))
}

// T5: non-nesting spans -> the offender is dropped with a warning.
{
  const g = G(0, 100, 200, 300, 400)
  const spans = [
    { lo: 'g1', hi: 'g3', policy: fixed(150) },
    { lo: 'g2', hi: 'g4', policy: fixed(150) }, // partially overlaps the first
  ]
  const r = solveAxisSpans(g, spans, 400, 0)
  assert('T5 one span dropped', r.warnings.length === 1)
  assert('T5 reason is overlap', /nesting/.test(r.warnings[0].reason))
}

// T6: rigid axis (all fixed) -> total follows the sum (the plot grows/shrinks to fit).
{
  const g = G(0, 100, 200)
  const spans = [
    { lo: 'g0', hi: 'g1', policy: fixed(80) },
    { lo: 'g1', hi: 'g2', policy: fixed(90) },
  ]
  const r = solveAxisSpans(g, spans, 300, 0)
  eqPos('T6 rigid axis positions', r.positions, { g0: 0, g1: 80, g2: 170 })
  assert('T6 total = sum of fixed (170)', near(r.total, 170))
}

// T7: origin offset carries through.
{
  const g = G(10, 110, 210)
  const r = solveAxisSpans(g, [], 200, 10)
  eqPos('T7 origin offset', r.positions, { g0: 10, g1: 110, g2: 210 })
}

// T8: endpoint not on a guide -> dropped with a warning, rest still solves.
{
  const g = G(0, 100, 200)
  const r = solveAxisSpans(g, [{ lo: 'g0', hi: 'nope', policy: fixed(50) }], 200, 0)
  assert('T8 bad-endpoint span dropped', r.warnings.length === 1)
  eqPos('T8 axis still solves', r.positions, { g0: 0, g1: 100, g2: 200 })
}

// T9: an atomic defined span is a LEAF (not a group wrapping one default cell), so the export
// emits `var` for it, not `var * 1`.
{
  const g = G(0, 100, 200)
  const { root } = buildAxisTree(g, [{ lo: 'g0', hi: 'g1', policy: fixed(100) }])
  const child = root.children.find((c) => c.lo === 0 && c.hi === 1)
  assert('T9 atomic fixed span is a leaf', !!child && !child.children)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
