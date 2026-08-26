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
  const { grid = {}, plot = {}, floors = [], rooms = [], edges = [] } = model || {}
  const perUnit = opts.perUnit ?? PER_UNIT
  const S = (Number(grid.unitPerCell) || 1) * perUnit // Wadi units per grid cell
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

  const px = (Number(plot.x) || 0) * S
  const py = (Number(plot.y) || 0) * S

  const wadiFloors = floors.map((f, i) => {
    const objects = rooms
      .filter((r) => r.floor === f.id)
      .map((r) => {
        const o = {
          type: 'room',
          name: nameById.get(r.id),
          x: r.x * S, y: r.y * S, width: r.w * S, length: r.h * S,
        }
        const c = conns.get(r.id)
        if (c && c.size) o.connections = [...c]
        return o
      })
    return { floor_number: i + 1, name: f.name || `Floor ${i + 1}`, slab_thickness: 0, objects }
  })

  return {
    units: { system: 'feet_inches', per_unit: perUnit },
    coord_convention: 'center',
    site: {
      plot_width: (Number(plot.w) || 30) * S,
      plot_length: (Number(plot.h) || 20) * S,
      reference_x: px,
      reference_y: py,
    },
    grids: {
      module: {
        origin: [px, py],
        spacing: [S, S],
        extent: [Number(grid.cols) || 40, Number(grid.rows) || 30],
      },
    },
    floors: wadiFloors,
  }
}

/** Serialise + trigger a browser download of the `.wadi`. Returns the config. */
export function downloadWadi(model, filename = 'floor-plan.wadi') {
  const config = modelToWadi(model)
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
// share it when deployed together (and on the dev server).
export const HANDOFF_KEY = 'wadi:handoff'

/** Stash the config and open the Wadi studio, which loads it on boot. */
export function openInWadi(model, appPath = '/app/') {
  const config = modelToWadi(model)
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(config))
  } catch {
    // localStorage unavailable (private mode) — fall back to a download.
    return downloadWadi(model)
  }
  window.open(appPath + '#handoff', '_blank', 'noopener')
  return config
}
