// Export helpers that turn the planner's guides + size model into the Wadi `main` grid:
// named guide lines whose positions are cumulative FORMULAS of the size variables. Kept in
// its own module (no WDL-emitter dependency) so it is unit-testable. See toWadi.js for the
// surrounding HouseConfig assembly, and plans/elastic-guide-spans.md for the model.

import { buildAxisTree } from '../model/spans.js'

// A safe, unique config-variable identifier from a label: "Living width" -> "living_width".
function slug(label, used) {
  let base = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!base) base = 'size'
  if (!/^[a-z_]/.test(base)) base = 'v_' + base
  let name = base, n = 1
  while (used.has(name)) { n += 1; name = `${base}_${n}` }
  used.add(name)
  return name
}

export const guideUnitLabel = (system) =>
  system === 'meters' ? 'm' : (system === 'feet_inches' || system === 'feet') ? 'ft' : 'units'

// Excel-style column label for a Y guide line: 0->A, 25->Z, 26->AA (X lines are numbered
// 1,2,3, Y lines lettered A,B,C).
function colLabel(i) {
  let s = ''
  let n = i + 1
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

// Derive a `main` grid from the ROOM CORNERS (fallback for docs with no persisted guides):
// distinct X edges become numbered lines, Y edges lettered, and rooms derive from them.
export function guidesFromRooms(rooms) {
  const R = (n) => Math.round(Number(n) * 1000) / 1000
  const xs = new Set(), ys = new Set()
  for (const r of rooms) {
    xs.add(R(r.x)); xs.add(R(r.x + r.w))
    ys.add(R(r.y)); ys.add(R(r.y + r.h))
  }
  const xName = new Map(), yName = new Map()
  const x = [...xs].sort((a, b) => a - b).map((at, i) => { const name = String(i + 1); xName.set(at, name); return { name, at } })
  const y = [...ys].sort((a, b) => a - b).map((at, i) => { const name = colLabel(i); yName.set(at, name); return { name, at } })
  return {
    grid: { x, y },
    xRef: (v) => { const n = xName.get(R(v)); return n && `main.x${n}` },
    yRef: (v) => { const n = yName.get(R(v)); return n && `main.y${n}` },
  }
}

// Build the `main` grid from the planner's guides AND its size model (guide-to-guide spans).
// Each guide line is named (X numbered 1,2,3; Y lettered A,B,C). A FIXED span becomes a config
// VARIABLE (a homeowner knob); a guide's position is then a cumulative FORMULA of the variables
// and the constant (flex/Auto) cells before it, so the resolver evaluates the sizes first and
// draws from them — the same pipeline as the main app. Rooms derive width/depth from the guide
// difference, so the variable flows through with no per-room binding. Returns {grid, xRef, yRef,
// variables, configurator, plotFormulas}.
export function guidesFromModel(model, ctx) {
  const R = (n) => Math.round(Number(n) * 1000) / 1000
  const usedNames = new Set()
  const variables = {}
  const inputs = []
  // A named variable referenced on BOTH axes (a width sharing a depth) is a "shared" size.
  const varAxes = {}
  for (const ax of ['x', 'y']) for (const s of model.spans?.[ax] || []) if (s.policy && s.policy.var) (varAxes[s.policy.var] || (varAxes[s.policy.var] = new Set())).add(ax)
  const isShared = (name) => varAxes[name] && varAxes[name].size > 1

  const axisExport = (axisKey, rawGuides, nameFor, plotExtent) => {
    const guides = [...(rawGuides || [])].sort((a, b) => a.at - b.at)
    const n = guides.length
    const nameByAt = new Map(guides.map((g, i) => [R(g.at), nameFor(i)]))
    if (n < 2) return { lines: guides.map((g, i) => ({ name: nameFor(i), at: R(g.at) })), nameByAt, plotFormula: null }

    const tree = buildAxisTree(guides, model.spans?.[axisKey] || [])
    const cellSize = []
    for (let i = 0; i < n - 1; i++) cellSize.push(R(guides[i + 1].at - guides[i].at))
    const near = (a, b) => Math.abs(a - b) < 1e-3
    const dim = axisKey === 'x' ? 'w' : 'h'
    // Name a fixed span after a room whose dimension it is, else a generic axis name.
    const nameForSpan = (loIdx, hiIdx) => {
      for (const r of model.rooms || []) {
        const lo = axisKey === 'x' ? r.x : r.y, hi = axisKey === 'x' ? r.x + r.w : r.y + r.h
        if (near(lo, guides[loIdx].at) && near(hi, guides[hiIdx].at)) return slug(`${r.name} ${dim === 'w' ? 'width' : 'depth'}`, usedNames)
      }
      return slug(`${axisKey === 'x' ? 'width' : 'depth'} span`, usedNames)
    }
    const ensureVar = (node) => {
      // A span bound to a NAMED variable uses that name (so it can be shared across rooms and
      // axes); an anonymous fixed span is auto-named after its room. A shared variable is
      // emitted once, even when it drives spans on both axes.
      const shared = node.policy && node.policy.var
      const name = shared || nameForSpan(node.lo, node.hi)
      if (name in variables) return name
      const value = shared
        ? R(Number(model.variables?.[shared]?.value) || (guides[node.hi].at - guides[node.lo].at))
        : R(guides[node.hi].at - guides[node.lo].at)
      variables[name] = value
      const step = ctx.step
      const label = (shared && model.variables?.[shared]?.label) || name.replace(/_/g, ' ')
      inputs.push({ target: name, label, control: 'slider', unit: ctx.unit,
        min: Math.max(step, R(Math.round(value * 0.4))), max: R(Math.round(value * 2)), step, group: isShared(name) ? 'shared' : axisKey })
      return name
    }
    // Per atomic cell -> an expression, mirroring how the planner distributes:
    //  - a fixed span is its variable;
    //  - inside a FIXED group, the fixed children take their variables and the flex/Auto
    //    children ABSORB the leftover, `(groupVar - sum(fixed siblings)) * weightShare`, so the
    //    group total stays the group's variable no matter what the fixed children do;
    //  - at the top level (elastic plot), a flex/Auto cell is just its constant size.
    const cellExpr = new Array(n - 1).fill(null)
    const isFix = (c) => c.policy && c.policy.kind === 'fixed'
    const varCache = new Map()
    const varOf = (node) => { const k = `${node.lo}:${node.hi}`; if (varCache.has(k)) return varCache.get(k); const nm = ensureVar(node); varCache.set(k, nm); return nm }
    const span = (c) => guides[c.hi].at - guides[c.lo].at
    // Distribute a node's total `sizeExpr` among its children. A node that is itself a fixed
    // span becomes a fixed container whose total is its variable (this covers a fixed span that
    // spans the WHOLE axis, where the policy sits on the root). Inside a fixed container, flex
    // children absorb the leftover; at the elastic root (no fixed policy) flex cells are their
    // constant size.
    const distribute = (node, sizeExpr, fixedContainer) => {
      let expr = sizeExpr, fixedHere = fixedContainer
      if (isFix(node)) { expr = varOf(node); fixedHere = true }
      const kids = node.children
      if (!kids || !kids.length) { cellExpr[node.lo] = expr; return }
      const flexKids = kids.filter((c) => !isFix(c))
      let leftover = expr, flexTotal = 0
      if (fixedHere && flexKids.length) {
        const fixedSum = kids.filter(isFix).map(varOf).join(' + ')
        leftover = fixedSum ? `${expr} - ${fixedSum}` : expr
        flexTotal = flexKids.reduce((t, c) => t + span(c), 0) || 1
      }
      for (const c of kids) {
        if (isFix(c)) distribute(c, null, true)
        else distribute(c, !fixedHere ? String(R(span(c))) : flexKids.length === 1 ? `(${leftover})` : `(${leftover}) * ${R(span(c) / flexTotal)}`, false)
      }
    }
    distribute(tree.root, null, false)

    // Cumulative guide positions: numeric until the first variable, a formula from there on.
    const origin = R(guides[0].at)
    const lines = [{ name: nameFor(0), at: origin }]
    const terms = []
    let hasVar = false
    for (let i = 1; i < n; i++) {
      const e = cellExpr[i - 1]
      if (/[a-z]/i.test(e)) hasVar = true
      terms.push(e)
      lines.push({ name: nameFor(i), at: hasVar ? `= ${[String(origin), ...terms].join(' + ')}` : R(guides[i].at) })
    }
    const margin = R(plotExtent - (R(guides[n - 1].at) - origin))
    const plotFormula = hasVar ? `= ${[String(margin), ...terms].join(' + ')}` : null
    return { lines, nameByAt, plotFormula }
  }

  const X = axisExport('x', model.guides.x, (i) => String(i + 1), ctx.plotW)
  const Y = axisExport('y', model.guides.y, (i) => colLabel(i), ctx.plotL)

  // Order the configurator knobs by the author's variable order (the Sizes panel /
  // MOVE_VAR), not by span-traversal order. A stable sort keeps same-ranked inputs in
  // traversal order; any input whose target isn't a named variable sorts to the end.
  const varOrder = Object.keys(model.variables || {})
  const rank = (t) => { const i = varOrder.indexOf(t); return i < 0 ? Number.MAX_SAFE_INTEGER : i }
  inputs.sort((a, b) => rank(a.target) - rank(b.target))

  const usedGroups = new Set(inputs.map((i) => i.group))
  const groupDefs = { x: { id: 'x', label: 'Widths (east–west)' }, y: { id: 'y', label: 'Depths (north–south)' }, shared: { id: 'shared', label: 'Shared sizes' } }
  const configurator = inputs.length
    ? { title: 'Customize sizes', groups: ['x', 'y', 'shared'].filter((g) => usedGroups.has(g)).map((g) => groupDefs[g]), inputs }
    : null

  return {
    grid: { x: X.lines, y: Y.lines },
    xRef: (v) => { const n = X.nameByAt.get(R(v)); return n && `main.x${n}` },
    yRef: (v) => { const n = Y.nameByAt.get(R(v)); return n && `main.y${n}` },
    variables,
    configurator,
    plotFormulas: { width: X.plotFormula, length: Y.plotFormula },
  }
}

// Room coordinates as formulas referencing the guide lines: x/y are the near lines, width/
// depth the span between near and far. Returns undefined if any edge doesn't land on a line.
export function roomGridFormulas(r, guides) {
  const x0 = guides.xRef(r.x), x1 = guides.xRef(r.x + r.w)
  const y0 = guides.yRef(r.y), y1 = guides.yRef(r.y + r.h)
  if (!x0 || !x1 || !y0 || !y1) return undefined
  return {
    x: `= ${x0}`,
    y: `= ${y0}`,
    width: `= ${x1} - ${x0}`,
    length: `= ${y1} - ${y0}`,
  }
}
