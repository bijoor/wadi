// Prebuilt room modules for the planner: give a graph room a TYPE and the export drops a
// set of furniture pieces into it (room.items[]). Walls stay graph-owned; a module only
// supplies CONTENTS. Items have no x/y — the 9-point anchor + gap places them off the room's
// inner footprint, so they reflow when the room resizes.
//
// Placement is OPENING-AWARE. Doors/gaps are inserted from the graph's connections, so a
// piece must not sit on a wall a door lands on. Each template piece carries a placement RULE
// (`at` + preference order), and `roomItems(type, { openSides })` resolves it to a concrete
// anchor that avoids the open walls/corners. Large pieces claim a wall so two don't stack.
//
// The templates below are plain data (a catalog + per-type rule lists), meant to be edited
// and extended. Furniture dimensions are metres (the renderer scales to units).

const FURN = 'https://templates.wadi.house/furniture'
// id -> { name, dims:[w,h,d] metres, category } for the pieces the templates use.
const CATALOG = {
  bed_double: { name: 'Double bed', dims: [1.5, 0.5, 2], category: 'Bedroom' },
  wardrobe: { name: 'Wardrobe', dims: [1, 1.8, 0.55], category: 'Bedroom' },
  bedside_table: { name: 'Bedside table', dims: [0.5, 0.55, 0.4], category: 'Bedroom' },
  sofa: { name: 'Sofa', dims: [1.9, 0.8, 0.9], category: 'Living' },
  coffee_table: { name: 'Coffee table', dims: [1.1, 0.4, 0.6], category: 'Living' },
  tv_unit: { name: 'TV unit', dims: [1.5, 0.5, 0.4], category: 'Living' },
  dining_table: { name: 'Dining table', dims: [1.5, 0.75, 0.9], category: 'Dining' },
  kitchen_cabinet: { name: 'Base cabinet', dims: [0.6, 0.9, 0.6], category: 'Kitchen' },
  stove: { name: 'Stove', dims: [0.6, 0.9, 0.65], category: 'Kitchen' },
  kitchen_sink: { name: 'Kitchen sink', dims: [0.6, 0.9, 0.6], category: 'Kitchen' },
  fridge: { name: 'Fridge', dims: [0.7, 1.8, 0.7], category: 'Kitchen' },
  toilet: { name: 'Toilet', dims: [0.5, 0.8, 0.7], category: 'Bathroom' },
  bathroom_sink: { name: 'Washbasin', dims: [0.6, 0.85, 0.5], category: 'Bathroom' },
  shower: { name: 'Shower', dims: [0.9, 2.1, 0.9], category: 'Bathroom' },
  desk: { name: 'Desk', dims: [1.2, 0.75, 0.6], category: 'Study' },
}

const asset = (id) => ({ id, name: CATALOG[id].name, src: `${FURN}/${id}.glb`, dimensions: CATALOG[id].dims, category: CATALOG[id].category })

const GAP = 6 // clearance kept from the wall (project units)
const SIDES = ['north', 'south', 'east', 'west']
const SIDE_ANCHOR = { north: 'top-center', south: 'bottom-center', east: 'center-right', west: 'center-left' }
const SIDE_ROT = { north: 0, east: 90, south: 180, west: 270 } // back to the wall
const CORNERS = ['north-west', 'north-east', 'south-east', 'south-west']
const CORNER_ANCHOR = { 'north-west': 'top-left', 'north-east': 'top-right', 'south-west': 'bottom-left', 'south-east': 'bottom-right' }
// A run of pieces along a wall: their positions from one end to the other.
const RUN_ANCHOR = {
  north: ['top-left', 'top-center', 'top-right'],
  south: ['bottom-left', 'bottom-center', 'bottom-right'],
  east: ['top-right', 'center-right', 'bottom-right'],
  west: ['top-left', 'center-left', 'bottom-left'],
}
const sideGap = (s) => (s === 'north' || s === 'south' ? { gap_y: GAP } : { gap_x: GAP })

// Per-type placement rules. `at`: 'wall' (against a wall, `claim` reserves it), 'corner',
// 'center', or a `run` group (a counter along one wall). `prefer` orders the candidates; the
// resolver picks the first that is free of openings (and unclaimed).
const TEMPLATES = {
  bedroom: {
    pieces: [
      { id: 'bed_double', at: 'wall', claim: true, prefer: ['north', 'south', 'west', 'east'] },
      { id: 'wardrobe', at: 'wall', claim: true, prefer: ['west', 'east', 'south', 'north'] },
      { id: 'bedside_table', at: 'corner', prefer: ['north-west', 'north-east', 'south-west', 'south-east'] },
    ],
  },
  living: {
    pieces: [
      { id: 'sofa', at: 'wall', claim: true, prefer: ['south', 'west', 'east', 'north'] },
      { id: 'tv_unit', at: 'wall', claim: true, prefer: ['north', 'east', 'west', 'south'] },
      { id: 'coffee_table', at: 'center' },
    ],
  },
  dining: { pieces: [{ id: 'dining_table', at: 'center' }] },
  kitchen: {
    run: { ids: ['kitchen_cabinet', 'stove', 'kitchen_sink'], prefer: ['north', 'east', 'west', 'south'] },
    pieces: [{ id: 'fridge', at: 'corner', prefer: ['north-east', 'north-west', 'south-east', 'south-west'] }],
  },
  bath: {
    pieces: [
      { id: 'toilet', at: 'corner', prefer: ['south-west', 'south-east', 'north-west', 'north-east'] },
      { id: 'bathroom_sink', at: 'corner', prefer: ['north-west', 'north-east', 'south-west', 'south-east'] },
      { id: 'shower', at: 'corner', prefer: ['south-east', 'north-east', 'south-west', 'north-west'] },
    ],
  },
  study: { pieces: [{ id: 'desk', at: 'wall', claim: true, prefer: ['north', 'east', 'west', 'south'] }] },
}

export const ROOM_TYPES = [
  ['', 'Plain room'],
  ['bedroom', 'Bedroom'],
  ['living', 'Living'],
  ['dining', 'Dining'],
  ['kitchen', 'Kitchen'],
  ['bath', 'Bathroom'],
  ['study', 'Study'],
]

// Resolve a typed room's furniture against its open sides. `ctx.openSides` is a Set of
// side names carrying a door/gap. Returns room.items[] (empty for a plain/unknown type).
export function roomItems(roomType, ctx = {}) {
  const T = TEMPLATES[roomType]
  if (!T) return []
  const open = ctx.openSides instanceof Set ? ctx.openSides : new Set(ctx.openSides || [])
  const claimed = new Set()
  const items = []
  const add = (id, anchor, gap, rot, name) => {
    const it = { name: name || CATALOG[id].name, asset: asset(id), anchor, ...gap }
    if (rot) it.rotation = rot
    items.push(it)
  }
  // Best wall from `prefer`: free of openings and unclaimed, else free, else unclaimed, else first.
  const pickWall = (prefer) =>
    prefer.find((s) => !open.has(s) && !claimed.has(s)) || prefer.find((s) => !open.has(s)) ||
    prefer.find((s) => !claimed.has(s)) || prefer[0]
  // Best corner: both sides free of openings, else one side free, else first.
  const pickCorner = (prefer) =>
    prefer.find((c) => { const [a, b] = c.split('-'); return !open.has(a) && !open.has(b) }) ||
    prefer.find((c) => { const [a, b] = c.split('-'); return !open.has(a) || !open.has(b) }) || prefer[0]

  for (const p of T.pieces || []) {
    if (p.at === 'center') { add(p.id, 'center', {}); continue }
    if (p.at === 'corner') { add(p.id, CORNER_ANCHOR[pickCorner(p.prefer)], { gap_x: 4, gap_y: 4 }); continue }
    // 'wall'
    const side = pickWall(p.prefer)
    if (p.claim) claimed.add(side)
    add(p.id, SIDE_ANCHOR[side], sideGap(side), SIDE_ROT[side])
  }
  if (T.run) {
    const side = pickWall(T.run.prefer)
    claimed.add(side)
    const spots = RUN_ANCHOR[side]
    const g = sideGap(side)
    T.run.ids.forEach((id, i) => add(id, spots[Math.min(i, spots.length - 1)], { ...g, gap_x: g.gap_x ?? 4, gap_y: g.gap_y ?? 4 }, SIDE_ROT[side]))
  }
  return items
}
