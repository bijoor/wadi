import { sharesWall, rectsOverlap, roomInsidePlot } from './geometry.js'

let counter = 0
export function makeId(prefix = 'id') {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter}`
}

export function edgeExists(edges, a, b) {
  return edges.some(
    (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)
  )
}

export function roomById(rooms, id) {
  return rooms.find((r) => r.id === id)
}

// A stable, distinct hue per floor index — used to tint floors in the overlay
// and side-by-side views (and their legend) so you can tell them apart.
export function floorColor(i) {
  return `hsl(${(i * 57) % 360} 65% 45%)`
}

// ---- floor scoping --------------------------------------------------------
// Overlap and adjacency only make sense WITHIN a floor: two rooms stacked on
// different floors at the same footprint are normal, not an overlap. So health
// and rendering always operate on a single floor's slice of the document.

export function roomsOnFloor(model, floorId) {
  return model.rooms.filter((r) => r.floor === floorId)
}

export function edgesOnFloor(model, floorId) {
  const ids = new Set(roomsOnFloor(model, floorId).map((r) => r.id))
  return model.edges.filter((e) => ids.has(e.a) && ids.has(e.b))
}

// A single floor as a self-contained model (same shape analyze/buildSVG expect).
export function floorView(model, floorId) {
  return {
    ...model,
    rooms: roomsOnFloor(model, floorId),
    edges: edgesOnFloor(model, floorId),
  }
}

// Returns a report of one floor's health. Pass a floor-scoped model
// (see floorView) — plot/grid are shared, rooms/edges are the floor's own.
export function analyze(model) {
  const { rooms, edges, plot } = model
  const outOfPlot = rooms.filter((r) => !roomInsidePlot(r, plot)).map((r) => r.id)

  const overlaps = []
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (rectsOverlap(rooms[i], rooms[j])) {
        overlaps.push([rooms[i].id, rooms[j].id])
      }
    }
  }

  const unsatisfied = edges.filter((e) => {
    const a = roomById(rooms, e.a)
    const b = roomById(rooms, e.b)
    if (!a || !b) return false
    return !sharesWall(a, b)
  })

  const overlapRoomIds = new Set(overlaps.flat())
  const roomArea = rooms.reduce((s, r) => s + r.w * r.h, 0)
  const plotArea = plot.w * plot.h

  return {
    outOfPlot,
    outOfPlotSet: new Set(outOfPlot),
    overlaps,
    overlapRoomIds,
    unsatisfied,
    unsatisfiedSet: new Set(unsatisfied.map((e) => e.id)),
    roomArea,
    plotArea,
    remainingArea: plotArea - roomArea,
  }
}
