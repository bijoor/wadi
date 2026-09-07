// Prebuilt room modules for the planner: give a graph room a TYPE and the export drops a
// set of anchored furniture pieces into it (room.items[]). Walls stay graph-owned; a module
// only supplies CONTENTS. Items carry their asset INLINE (self-contained .wadi) and have no
// x/y — the 9-point anchor + gap places them off the room's inner footprint, so they reflow
// when the room resizes. Furniture dimensions are metres (the renderer scales to units).

const FURN = 'https://templates.wadi.house/furniture'
// id -> { name, dims:[w,h,d] metres, category } for the pieces the templates below use.
const CATALOG = {
  bed_double: { name: 'Double bed', dims: [1.5, 0.5, 2], category: 'Bedroom' },
  wardrobe: { name: 'Wardrobe', dims: [1, 1.8, 0.55], category: 'Bedroom' },
  bedside_table: { name: 'Bedside table', dims: [0.5, 0.55, 0.4], category: 'Bedroom' },
  sofa: { name: 'Sofa', dims: [1.9, 0.8, 0.9], category: 'Living' },
  coffee_table: { name: 'Coffee table', dims: [1.1, 0.4, 0.6], category: 'Living' },
  tv_unit: { name: 'TV unit', dims: [1.5, 0.5, 0.4], category: 'Living' },
  dining_table: { name: 'Dining table', dims: [1.5, 0.75, 0.9], category: 'Dining' },
  chair: { name: 'Chair', dims: [0.5, 0.9, 0.5], category: 'Dining' },
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

// Per-type furniture layouts: each piece anchors to a spot on the room's inner footprint
// with a small gap that clears the wall. Kept to a few signature pieces so any room reads
// clearly and doesn't over-pack a small footprint. `rotation` is yaw in degrees.
const TEMPLATES = {
  bedroom: [
    { id: 'bed_double', anchor: 'top-center', gap_y: 8 },
    { id: 'bedside_table', anchor: 'top-left', gap_x: 6, gap_y: 6 },
    { id: 'wardrobe', anchor: 'center-right', gap_x: 4 },
  ],
  living: [
    { id: 'sofa', anchor: 'bottom-center', gap_y: 8 },
    { id: 'coffee_table', anchor: 'center', gap_y: 6 },
    { id: 'tv_unit', anchor: 'top-center', gap_y: 6 },
  ],
  dining: [
    { id: 'dining_table', anchor: 'center' },
    { id: 'chair', anchor: 'center-left', gap_x: 6, rotation: 90 },
    { id: 'chair', anchor: 'center-right', gap_x: 6, rotation: 270 },
  ],
  kitchen: [
    { id: 'kitchen_cabinet', anchor: 'top-left', gap_x: 4, gap_y: 4 },
    { id: 'stove', anchor: 'top-center', gap_y: 4 },
    { id: 'kitchen_sink', anchor: 'top-right', gap_x: 4, gap_y: 4 },
    { id: 'fridge', anchor: 'center-right', gap_x: 4 },
  ],
  bath: [
    { id: 'toilet', anchor: 'bottom-left', gap_x: 4, gap_y: 4 },
    { id: 'bathroom_sink', anchor: 'top-left', gap_x: 4, gap_y: 4 },
    { id: 'shower', anchor: 'bottom-right', gap_x: 4, gap_y: 4 },
  ],
  study: [
    { id: 'desk', anchor: 'top-center', gap_y: 6 },
    { id: 'chair', anchor: 'center', gap_y: 6, rotation: 180 },
  ],
}

// The room-type options for the picker (value + label). `''` = plain room (no furniture).
export const ROOM_TYPES = [
  ['', 'Plain room'],
  ['bedroom', 'Bedroom'],
  ['living', 'Living'],
  ['dining', 'Dining'],
  ['kitchen', 'Kitchen'],
  ['bath', 'Bathroom'],
  ['study', 'Study'],
]

// The `items[]` for a typed room (empty if the type has no template). Each item carries its
// asset inline so the exported .wadi is self-contained.
export function roomItems(roomType) {
  const tpl = TEMPLATES[roomType]
  if (!tpl) return []
  return tpl.map((p, i) => {
    const it = { name: `${CATALOG[p.id].name}${i ? ' ' + (i + 1) : ''}`, asset: asset(p.id), anchor: p.anchor }
    if (p.gap_x != null) it.gap_x = p.gap_x
    if (p.gap_y != null) it.gap_y = p.gap_y
    if (p.rotation != null) it.rotation = p.rotation
    return it
  })
}
