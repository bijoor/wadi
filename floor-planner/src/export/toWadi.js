// Convert the planner model into a Wadi `.wadi` HouseConfig, so a sketch made
// here continues in the Wadi studio / WDL editor.
//
// Mapping (the coordinate systems already agree — top-left origin, X→width,
// Y→length): one grid CELL = `unitPerCell` ft = `unitPerCell * PER_UNIT` Wadi
// units. Rooms are emitted at `coord_convention: "center"`, so two rooms that
// abut on a cell boundary share a wall CENTRELINE (they share a wall in Wadi).
// The regular grid becomes a generated `guides module`. No walls/doors are
// emitted — that is exactly what you refine in Wadi next: a declared connection
// with no door is C11's cue to add one (or leave the wall off for an opening).

import { emitWdl } from 'wadi-wdl-emitter'
import { computeRoomWalls, edgeKindLookup, classifyOpenCorners } from './wallsFromGraph.js'
import { solveModel } from '../model/sizes.js'

const PER_UNIT = 10 // Wadi feet_inches default: 10 project units = 1 ft

// Connections reference rooms BY NAME, so two rooms sharing a name would collapse
// into one graph node. Give every room a unique, trimmed name (numeric suffix on
// collision) and return an id→name map.
function uniqueNames(rooms) {
  const used = new Set()
  const byId = new Map()
  for (const r of rooms) {
    const base = String(r.name ?? '').trim() || 'Room'
    let name = base
    let n = 1
    while (used.has(name)) { n += 1; name = `${base} ${n}` }
    used.add(name)
    byId.set(r.id, name)
  }
  return byId
}

// Excel-style column label for a Y guide line: 0→A, 25→Z, 26→AA (the convention
// numbers X lines 1,2,3… and letters Y lines A,B,C…).
function colLabel(i) {
  let s = ''
  let n = i + 1
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

// Derive a `main` guides grid from the ROOM CORNERS: the distinct X edges become
// numbered X lines and the distinct Y edges lettered Y lines, each at its own
// position (the centreline the abutting rooms share). This gives a coarse,
// meaningful grid (only where a wall runs) instead of the planner's fine editing
// pitch, and lets rooms derive their coordinates from named lines (`main.x2`)
// rather than hard-coded numbers. Returns the grid plus lookups edge→line-ref.
function guidesFromRooms(rooms) {
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

const guideUnitLabel = (system) =>
  system === 'meters' ? 'm' : (system === 'feet_inches' || system === 'feet') ? 'ft' : 'units'

// A guide position as a resolver formula string `= const + Σ coef*var`, or null when the
// line has no variable terms (a fixed line, emitted as a plain number instead).
function atFormula(f) {
  if (!f) return null
  const r = (n) => Math.round(Number(n) * 1e6) / 1e6
  const names = Object.keys(f.coef || {})
  if (!names.length) return null
  const terms = [String(r(f.const))]
  for (const name of names) {
    const c = r(f.coef[name])
    if (c === 1) terms.push(`+ ${name}`)
    else if (c === -1) terms.push(`- ${name}`)
    else if (c < 0) terms.push(`- ${Math.abs(c)}*${name}`)
    else terms.push(`+ ${c}*${name}`)
  }
  return '= ' + terms.join(' ')
}

// The feasible range for a variable: how far it can move before any span on its axis
// (including the free spans to the pinned plot edges) collapses below a small margin. The
// solve is linear, so this keeps the knob inside the region where the formulas stay valid
// (no room spilling past the plot / no zero-width span).
function varRange(solvedAxis, lines0, origin, length, name, cur) {
  const MARGIN = 1
  const nodes = [{ at: origin, s: 0 }]
  for (const l of lines0 || []) {
    const f = solvedAxis.formula.get(l.id)
    nodes.push({ at: l.at, s: f ? (f.coef[name] || 0) : 0 })
  }
  nodes.push({ at: origin + length, s: 0 })
  nodes.sort((a, b) => a.at - b.at)
  // dedupe coincident nodes (a guide sitting on a plot edge)
  const nd = nodes.filter((n, i) => i === 0 || Math.abs(n.at - nodes[i - 1].at) > 1e-6)
  let lo = -Infinity, hi = Infinity
  for (let k = 0; k + 1 < nd.length; k++) {
    const span = nd[k + 1].at - nd[k].at
    const ss = nd[k + 1].s - nd[k].s // d(span)/d(var)
    if (Math.abs(ss) < 1e-9) continue
    const bound = cur + (MARGIN - span) / ss // value where this span hits MARGIN
    if (ss < 0) hi = Math.min(hi, bound)
    else lo = Math.max(lo, bound)
  }
  return {
    min: Number.isFinite(lo) ? lo : Math.max(MARGIN, cur * 0.3),
    max: Number.isFinite(hi) ? hi : cur * 2,
  }
}

// Build the `main` grid from the planner's guides, with positions driven by the room-size
// SOLVER (model/sizes.js). Every bound room dimension pins its two lines; the plot stays
// fixed while the rest re-flows proportionally. The solve is linear in the variables, so
// each line's `at` becomes a linear formula and each variable a configurator slider.
// Degrades to a static numeric grid when nothing is bound. Returns the same
// {grid, xRef, yRef} shape as guidesFromRooms plus {variables, configurator}.
function guidesFromModel(model, ctx) {
  const R = (n) => Math.round(Number(n) * 1000) / 1000
  const solved = solveModel(model)
  const usedVars = new Set()

  const emitAxis = (lines0, solvedAxis, nameFor) => {
    const lines = [...(lines0 || [])].sort((a, b) => a.at - b.at)
    const nameByAt = new Map()
    const out = lines.map((l, i) => {
      const nm = nameFor(i)
      nameByAt.set(R(l.at), nm)
      const f = solved.feasible ? solvedAxis.formula.get(l.id) : null
      const fs = atFormula(f)
      if (fs) for (const n of Object.keys(f.coef)) usedVars.add(n)
      return { name: nm, at: fs || R(l.at) }
    })
    return { out, nameByAt }
  }

  const X = emitAxis(model.guides.x, solved.X, (i) => String(i + 1))
  const Y = emitAxis(model.guides.y, solved.Y, (i) => colLabel(i))

  // Emit only the variables that actually drive a line, seeded with their current value,
  // each with a configurator slider grouped by the axis of its first binding.
  const byName = new Map((model.variables || []).map((v) => [v.name, v]))
  const variables = {}
  const inputs = []
  for (const name of usedVars) {
    const v = byName.get(name)
    const value = R(Number(v?.value) || 0)
    variables[name] = value
    const bind = (model.bindings || []).find((b) => b.var === name)
    const ax = bind && bind.dim === 'h' ? 'y' : 'x'
    const step = Number.isFinite(Number(v?.step)) ? Number(v.step) : ctx.step
    // Feasible range from the solve, snapped inward to whole steps so the slider can never
    // drive a span past the plot. A user-set min/max is honoured but clamped into it.
    const range = ax === 'x'
      ? varRange(solved.X, model.guides.x, ctx.originX, ctx.plotW, name, value)
      : varRange(solved.Y, model.guides.y, ctx.originY, ctx.plotL, name, value)
    let min = Math.ceil(range.min / step) * step
    let max = Math.floor(range.max / step) * step
    if (Number.isFinite(Number(v?.min))) min = Math.max(min, Number(v.min))
    if (Number.isFinite(Number(v?.max))) max = Math.min(max, Number(v.max))
    if (!(min < max)) { min = R(Math.max(step, range.min)); max = R(range.max) } // degenerate guard
    inputs.push({
      target: name,
      label: v?.label || name,
      control: 'slider',
      unit: ctx.unit,
      min: R(min),
      max: R(max),
      step,
      group: ax,
    })
  }
  const configurator = inputs.length
    ? {
        title: 'Customize sizes',
        groups: [
          { id: 'x', label: 'Widths (east–west)' },
          { id: 'y', label: 'Depths (north–south)' },
        ],
        inputs,
      }
    : null
  return {
    grid: { x: X.out, y: Y.out },
    xRef: (v) => { const n = X.nameByAt.get(R(v)); return n && `main.x${n}` },
    yRef: (v) => { const n = Y.nameByAt.get(R(v)); return n && `main.y${n}` },
    variables,
    configurator,
  }
}

// Room coordinates as formulas off the guides: x/y are the near lines, width/length
// the span between the near and far lines. Returns undefined if any edge doesn't
// land on a line (then the caller keeps the hard-coded numbers).
function roomGridFormulas(r, guides) {
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

/** The planner model → a Wadi HouseConfig object (ready to JSON.stringify). */
export function modelToWadi(model, opts = {}) {
  const { plot = {}, floors = [], rooms = [], edges = [] } = model || {}
  const b = model?.build || {}
  // The planner works in PROJECT UNITS throughout: a cell is `unitPerCell` project
  // units, and every dimension below is already in project units. `perUnit` is only
  // display metadata (units.per_unit) — how Wadi renders those project units as feet
  // / metres — so it does NOT scale geometry.
  const perUnit = Number(b.perUnit) > 0 ? Number(b.perUnit) : (opts.perUnit ?? PER_UNIT)
  const unitSystem = b.unitSystem || 'feet_inches'
  // Room/plot coords are ALREADY project units, so no scaling.
  const nameById = uniqueNames(rooms)

  // Undirected connections, stored on the lower room by neighbour NAME.
  const conns = new Map() // roomId -> Set<neighbourName>
  for (const e of edges) {
    const an = nameById.get(e.a)
    const bn = nameById.get(e.b)
    if (!an || !bn || an === bn) continue
    if (!conns.has(e.a)) conns.set(e.a, new Set())
    conns.get(e.a).add(bn)
  }

  const px = Number(plot.x) || 0
  const py = Number(plot.y) || 0
  const plotW = Number(plot.w) || 300
  const plotL = Number(plot.h) || 200
  const edgeKind = edgeKindLookup(edges)
  // Guides: prefer the planner's PERSISTED guides + bays (variable-backed, with a
  // configurator for editable bays). Fall back to deriving them from room corners for
  // older docs that carry no guides.
  const hasModelGuides = model.guides
    && Array.isArray(model.guides.x) && model.guides.x.length >= 2
    && Array.isArray(model.guides.y) && model.guides.y.length >= 2
  const guides = hasModelGuides
    ? guidesFromModel(model, {
        unit: guideUnitLabel(unitSystem),
        step: perUnit,
        plotW: Number(plot.w) || 300,
        plotL: Number(plot.h) || 200,
        originX: px,
        originY: py,
      })
    : { ...guidesFromRooms(rooms), variables: {}, configurator: null }

  // Build dimensions from the Dimensions panel — already PROJECT UNITS, used as-is.
  const pu = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def)
  const wallThickness = pu(b.wallThickness, 8)
  const slabThickness = pu(b.slabThickness, 6)
  const wallHeight = pu(b.wallHeight, 100)
  const plinthHeight = pu(b.plinthHeight, 30)
  const floorHeight = wallHeight + slabThickness // wall sits on the slab

  // The room floors: each room becomes a `room` (walls + doors from the graph) sitting
  // on a `floor_slab` of the same footprint — the per-room slabs tile the rooms' union.
  const roomFloors = floors.map((f, i) => {
    const floorRooms = rooms.filter((r) => r.floor === f.id)
    // Corners where every wall is an open passage — their gap returns are dissolved
    // so two open walls join cleanly instead of leaving a floating pillar.
    const openCorners = classifyOpenCorners(floorRooms, edgeKind, wallThickness)
    const slabs = floorRooms.map((r) => {
      const s = { type: 'floor_slab', x: r.x, y: r.y, width: r.w, length: r.h }
      // Each per-room slab shares the room footprint, so derive it from the same
      // guide lines (falls back to the numbers when an edge isn't on a line).
      const sf = roomGridFormulas(r, guides)
      if (sf) s.formulas = sf
      return s
    })
    const roomObjs = floorRooms.map((r) => {
      const o = {
        type: 'room',
        name: nameById.get(r.id),
        x: r.x, y: r.y, width: r.w, length: r.h,
      }
      // Derive x/y/width/length from the guide lines (falls back to the numbers).
      const f = roomGridFormulas(r, guides)
      if (f) o.formulas = f
      const walls = computeRoomWalls(r, floorRooms, edgeKind, 1, wallHeight, wallThickness, openCorners, guides)
      if (Object.keys(walls).length) o.walls = walls
      const c = conns.get(r.id)
      if (c && c.size) o.connections = [...c]
      return o
    })
    // floor_number 1.. — floor 0 is the Plinth we prepend below.
    return { floor_number: i + 1, name: f.name || `Floor ${i + 1}`, objects: [...slabs, ...roomObjs] }
  })

  // Floor 0: the Plinth. A plot-sized ground plane + a plot-sized plinth the whole
  // house rests on. Its floor `height` must equal the plinth height (Wadi convention).
  const plinthFloor = {
    floor_number: 0,
    name: 'Plinth',
    height: plinthHeight,
    objects: [
      { type: 'ground', name: 'Ground', x: px, y: py, width: plotW, length: plotL },
      { type: 'plinth', name: 'Plinth', x: px, y: py, width: plotW, length: plotL, height: plinthHeight },
    ],
  }

  const config = {
    // The planner is NEW authoring, so it emits the current .wadi model version.
    // v2 = room-wall opening offsets anchor to the wall's CLEAR span (inner
    // corner). Kept in sync with editor CURRENT_WADI_VERSION.
    wadi_version: 2,
    units: { system: unitSystem, per_unit: perUnit },
    coord_convention: 'center',
    defaults: {
      wall_thickness: wallThickness,
      slab_thickness: slabThickness,
      wall_height: wallHeight,
      floor_height: floorHeight,
    },
    site: {
      plot_width: plotW,
      plot_length: plotL,
      reference_x: px,
      reference_y: py,
    },
    grids: { main: guides.grid },
    floors: [plinthFloor, ...roomFloors],
  }
  // Editable bays → variables + a configurator, so the exported house is tunable.
  if (guides.variables && Object.keys(guides.variables).length) config.variables = guides.variables
  if (guides.configurator) config.configurator = guides.configurator
  return config
}

/** The planner model → editable Wadi `.wdl` text (the decompile of the HouseConfig).
 *  This is what we hand off / push to a live session so the viewer renders it and the
 *  agent can keep editing it as code. */
export function modelToWdl(model, opts = {}) {
  return emitWdl(modelToWadi(model, opts), opts.houseName ?? 'Sketch')
}

// The low-level Tauri invoke, present in ANY Tauri v2 webview (no package needed).
// null in a plain browser. Lets the desktop planner window reach native commands.
function tauriInvoke() {
  const fn = typeof window !== 'undefined' && window.__TAURI_INTERNALS__?.invoke
  return typeof fn === 'function' ? (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args) : null
}

/** Write the `.wadi`: a native Save dialog on desktop (Tauri), else a browser
 *  download. The blob-download path is inert in WKWebView, hence the split. */
export async function downloadWadi(model, filename = 'floor-plan.wadi') {
  const config = modelToWadi(model)
  const invoke = tauriInvoke()
  if (invoke) {
    try {
      await invoke('export_wadi', { config, suggestedName: filename })
      return config // saved (or user cancelled) via the native dialog
    } catch (e) {
      console.warn('export_wadi failed, falling back to a browser download', e)
    }
  }
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return config
}

// The same-origin handoff key the Wadi app reads on `/app#handoff` (see
// editor/src/viewer/main.ts). localStorage is per-origin, so /planner and /app
// share it — both in the browser (same site) and across Tauri windows (same
// tauri origin).
export const HANDOFF_KEY = 'wadi:handoff'

/** Stash the config and go to the Wadi studio, which loads it on boot. Uses a
 *  SAME-WINDOW navigation (not window.open '_blank'): a new tab/window is
 *  unreliable in WKWebView and, if it escapes to the external browser, breaks the
 *  shared-origin handoff. Navigating in place keeps the origin (localStorage). */
export function openInWadi(model, appPath = '/app/') {
  const config = modelToWadi(model)
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(config))
  } catch {
    // localStorage unavailable (private mode) — fall back to a file export.
    return downloadWadi(model)
  }
  window.location.assign(appPath + '#handoff')
  return config
}
