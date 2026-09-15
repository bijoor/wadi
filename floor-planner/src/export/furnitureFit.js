// Small furniture helpers still shared by the planner's plain-JS modules (Canvas preview,
// layoutWdl emit, layoutLibrary). The placement ENGINE that used to live here (orientation,
// door-aware placement, overlap validation) is gone — the planner now runs wadi's own engine
// (editor/src/furniture/autoplace.ts + svg2d/furnitureAnchor.ts) for the preview, export, and
// layout designer, so there is one source of truth. Only two pure, node-safe helpers remain,
// kept here (not a wadi .ts alias) because layoutWdl.js is imported by a node test.

// First token = vertical (top/center/bottom), second = horizontal (left/center/right);
// "center" alone = both. Mirrors furnitureAnchor.parseAnchor.
function parseAnchor(a) {
  const s = String(a ?? 'center').toLowerCase()
  if (s === 'center') return { h: 'center', v: 'center' }
  const [vTok, hTok] = s.split('-')
  const v = vTok === 'top' ? 'top' : vTok === 'bottom' ? 'bottom' : 'center'
  const h = hTok === 'left' ? 'left' : hTok === 'right' ? 'right' : 'center'
  return { h, v }
}

// Default facing (yaw°) implied by an anchor when a piece has no explicit rotation: it faces
// AWAY from its wall, into the room. Mirrors furnitureAnchor.anchorFacing.
export function anchorFacing(anchor) {
  const { h, v } = parseAnchor(anchor)
  if (v === 'top') return 0
  if (v === 'bottom') return 180
  if (h === 'left') return 90
  if (h === 'right') return 270
  return 0
}

// Project units per metre for a house's `units` (mirrors editor/src/three/units.ts): a GLB
// asset (metres) scales by this to plan size. `perUnit` project units = 1 display unit, a
// display unit spans FEET_PER_DISPLAY_UNIT feet, and a metre is 3.280839895 feet.
const FEET_PER_DISPLAY_UNIT = { feet_inches: 1, feet: 1, meters: 3.280839895, centimeters: 0.032808399, millimeters: 0.003280839 }
const FEET_PER_METER = 3.280839895
export function unitsPerMeter(units) {
  const perUnit = units && units.per_unit > 0 ? units.per_unit : 10
  const fpdu = FEET_PER_DISPLAY_UNIT[(units && units.system) || 'feet_inches'] ?? 1
  return (perUnit / fpdu) * FEET_PER_METER
}
