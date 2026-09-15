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
import { computeRoomWalls, edgeKindLookup, classifyOpenCorners, roomDoorSides, roomDoorIntervals, roomGapIntervals } from './wallsFromGraph.js'
import { roomModule } from './roomModules.js'
import { guideUnitLabel, guidesFromRooms, guidesFromModel, roomGridFormulas } from './spanGrid.js'

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
  // Guides: prefer the planner's PERSISTED guides; fall back to deriving them from room
  // corners for older docs that carry no guides. Rooms derive their coords from named lines.
  const hasModelGuides = model.guides
    && Array.isArray(model.guides.x) && model.guides.x.length >= 2
    && Array.isArray(model.guides.y) && model.guides.y.length >= 2
  const guides = hasModelGuides
    ? guidesFromModel(model, { unit: guideUnitLabel(unitSystem), step: perUnit, plotW, plotL })
    : { ...guidesFromRooms(rooms), variables: {}, configurator: null, plotFormulas: { width: null, length: null } }

  // Build dimensions from the Dimensions panel — already PROJECT UNITS, used as-is.
  const pu = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def)
  const wallThickness = pu(b.wallThickness, 8)
  const slabThickness = pu(b.slabThickness, 6)
  const wallHeight = pu(b.wallHeight, 100)
  const plinthHeight = pu(b.plinthHeight, 30)
  const doorWidth = pu(b.doorWidth, 25)
  const doorHeight = pu(b.doorHeight, 70)
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
    // Each typed room's prebuilt module: furniture (placed to avoid the walls a door lands on)
    // plus an optional room-level wall height (a balcony/terrace is authored shorter). Resolve
    // it up front so a room's height is known while walling its NEIGHBOURS — a shared wall
    // takes the taller of the two rooms, so a low balcony only lowers its own exterior walls.
    const furnUnits = { system: unitSystem, per_unit: perUnit }
    const modById = new Map(
      floorRooms.map((r) => [r.id, roomModule(r.roomType, {
        openSides: roomDoorSides(r, floorRooms, edgeKind),
        w: r.w, h: r.h,
        // door-position-aware placement (C): the room rect, wall thickness, units, and the
        // opening intervals per side, so furniture avoids / is carved off the actual doors.
        room: r, wallT: wallThickness, units: furnUnits,
        doorIntervals: roomDoorIntervals(r, floorRooms, edgeKind, doorWidth),
        gapIntervals: roomGapIntervals(r, floorRooms, edgeKind), // soft: prefer to avoid, never carve
      })]),
    )
    const heightById = new Map(floorRooms.map((r) => [r.id, modById.get(r.id).height ?? wallHeight]))
    const roomObjs = floorRooms.map((r) => {
      const o = {
        type: 'room',
        name: nameById.get(r.id),
        x: r.x, y: r.y, width: r.w, length: r.h,
      }
      // The native room CATEGORY (`type` in WDL) — carried through so the exported house is
      // self-describing and natively furnishable, matching the template the furniture came from.
      if (r.roomType) o.room_type = r.roomType
      // Derive x/y/width/length from the guide lines (falls back to the numbers).
      const f = roomGridFormulas(r, guides)
      if (f) o.formulas = f
      const walls = computeRoomWalls(r, floorRooms, edgeKind, 1, wallHeight, wallThickness, openCorners, guides, heightById, doorWidth, doorHeight)
      if (Object.keys(walls).length) o.walls = walls
      const c = conns.get(r.id)
      if (c && c.size) o.connections = [...c]
      const mod = modById.get(r.id)
      if (mod.items.length) o.items = mod.items
      if (mod.height != null) o.height = mod.height
      return o
    })
    // floor_number 1.. — floor 0 is the Plinth we prepend below.
    return { floor_number: i + 1, name: f.name || `Floor ${i + 1}`, objects: [...slabs, ...roomObjs] }
  })

  // Floor 0: the Plinth. A plot-sized ground plane + a plot-sized plinth the whole house rests
  // on. When a fixed span drives the plot, the ground/plinth footprint is formula-driven too
  // (guides.plotFormulas), so they grow flush with the plot as the homeowner tunes a size.
  const pf = guides.plotFormulas || {}
  const plotSizeFormulas = pf.width || pf.length
    ? { ...(pf.width ? { width: pf.width } : {}), ...(pf.length ? { length: pf.length } : {}) }
    : null
  const plinthFloor = {
    floor_number: 0,
    name: 'Plinth',
    height: plinthHeight,
    objects: [
      { type: 'ground', name: 'Ground', x: px, y: py, width: plotW, length: plotL, ...(plotSizeFormulas ? { formulas: plotSizeFormulas } : {}) },
      { type: 'plinth', name: 'Plinth', x: px, y: py, width: plotW, length: plotL, height: plinthHeight, ...(plotSizeFormulas ? { formulas: plotSizeFormulas } : {}) },
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
      // The plot dimensions follow the size variables (site.formulas), so it grows with them.
      ...(plotSizeFormulas ? { formulas: {
        ...(pf.width ? { plot_width: pf.width } : {}),
        ...(pf.length ? { plot_length: pf.length } : {}),
      } } : {}),
    },
    grids: { main: guides.grid },
    floors: [plinthFloor, ...roomFloors],
  }
  // Fixed spans -> size variables + a configurator, so the exported house is homeowner-tunable.
  // Doors reference door_width / door_height, so emit those variables (+ a configurator group)
  // whenever the plan has any door.
  const variables = { ...(guides.variables || {}) }
  const hasDoors = edges.some((e) => (e.kind || 'door') === 'door')
  if (hasDoors) { variables.door_width = doorWidth; variables.door_height = doorHeight }
  if (Object.keys(variables).length) config.variables = variables
  let configurator = guides.configurator
  if (hasDoors) {
    const step = perUnit
    const dInputs = [
      { target: 'door_width', label: 'door width', control: 'slider', unit: guideUnitLabel(unitSystem), min: step, max: Math.max(step * 2, doorWidth * 2), step },
      { target: 'door_height', label: 'door height', control: 'slider', unit: guideUnitLabel(unitSystem), min: step, max: Math.max(step * 2, doorHeight * 2), step },
    ]
    configurator = configurator
      ? { ...configurator, groups: [...configurator.groups, { id: 'doors', label: 'Doors' }], inputs: [...configurator.inputs, ...dInputs] }
      : { title: 'Customize sizes', groups: [{ id: 'doors', label: 'Doors' }], inputs: dInputs }
  }
  if (configurator) config.configurator = configurator
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
