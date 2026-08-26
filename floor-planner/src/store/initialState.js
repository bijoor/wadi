// Default document + sample apartment. All room/plot coords are in grid cells.
//
// The document is multi-floor: `grid` and `plot` are house-level (shared by
// every floor, exactly like Wadi), `floors` is an ordered list bottom -> top,
// and each room carries the `floor` id it belongs to. `edges` reference room
// ids; a connection is only meaningful between two rooms on the SAME floor.

export const PALETTE = [
  '#7cb5ec', '#90ed7d', '#f7a35c', '#e4d354',
  '#f45b5b', '#8085e9', '#43d1c4', '#e08fd6',
]

export function sampleModel() {
  const grid = { cols: 40, rows: 30, cell: 26, unit: 'ft', unitPerCell: 1 }
  const plot = { x: 0, y: 0, w: 30, h: 20 } // plot origin is fixed at 0,0

  const fg = 'f_ground'
  const floors = [{ id: fg, name: 'Ground' }]

  const rooms = [
    { id: 'r_living', name: 'Living', floor: fg, x: 0, y: 0, w: 10, h: 9, color: '#7cb5ec' },
    { id: 'r_kitchen', name: 'Kitchen', floor: fg, x: 10, y: 0, w: 8, h: 6, color: '#90ed7d' },
    { id: 'r_dining', name: 'Dining', floor: fg, x: 18, y: 0, w: 7, h: 6, color: '#f7a35c' },
    { id: 'r_bed1', name: 'Bedroom 1', floor: fg, x: 25, y: 0, w: 5, h: 10, color: '#8085e9' },
    { id: 'r_hall', name: 'Hall', floor: fg, x: 10, y: 6, w: 8, h: 9, color: '#e4d354' },
    { id: 'r_bath', name: 'Bath', floor: fg, x: 18, y: 6, w: 7, h: 4, color: '#43d1c4' },
    { id: 'r_bed2', name: 'Bedroom 2', floor: fg, x: 18, y: 10, w: 7, h: 9, color: '#e08fd6' },
    { id: 'r_balcony', name: 'Balcony', floor: fg, x: 0, y: 9, w: 10, h: 4, color: '#f45b5b' },
  ]

  const edges = [
    { id: 'e1', a: 'r_living', b: 'r_kitchen' },
    { id: 'e2', a: 'r_living', b: 'r_hall' },
    { id: 'e3', a: 'r_living', b: 'r_balcony' },
    { id: 'e4', a: 'r_kitchen', b: 'r_dining' },
    { id: 'e5', a: 'r_hall', b: 'r_bath' },
    { id: 'e6', a: 'r_hall', b: 'r_bed2' },
    { id: 'e7', a: 'r_dining', b: 'r_bed1' },
    { id: 'e8', a: 'r_bath', b: 'r_bed1' },
  ]

  return { grid, plot, floors, rooms, edges }
}

// Bring any loaded/older document up to the multi-floor shape:
//  - a floorless doc becomes a single "Ground" floor and every room joins it,
//  - a room whose `floor` is missing/unknown is reassigned to the first floor.
// This keeps old single-floor .json files loading unchanged.
export function normalizeModel(doc) {
  const grid = doc.grid
  const plot = doc.plot
  let floors = Array.isArray(doc.floors) && doc.floors.length ? doc.floors : null
  let rooms = Array.isArray(doc.rooms) ? doc.rooms : []
  const edges = Array.isArray(doc.edges) ? doc.edges : []

  if (!floors) {
    const fid = 'f_ground'
    floors = [{ id: fid, name: 'Ground' }]
    rooms = rooms.map((r) => ({ ...r, floor: r.floor || fid }))
  } else {
    const known = new Set(floors.map((f) => f.id))
    const first = floors[0].id
    rooms = rooms.map((r) => ({ ...r, floor: known.has(r.floor) ? r.floor : first }))
  }
  return { grid, plot, floors, rooms, edges }
}

export function initialState() {
  const model = sampleModel()
  return {
    ...model,
    activeFloor: model.floors[0].id,
    viewMode: 'single', // 'single' | 'overlay' | 'sheets'
    tool: 'select', // 'select' | 'draw-room' | 'draw-edge'
    selection: { type: null, id: null }, // primary object for the editor panel
    selectedIds: [], // set of selected room ids (multi-select + group move)
    view: { zoom: 1, panX: 40, panY: 20 },
    history: { past: [], future: [] },
  }
}
