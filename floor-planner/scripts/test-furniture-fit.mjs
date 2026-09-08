// Tests for furnitureFit.js — orientation (A) and door-position-aware placement (C).
import {
  parseAnchor, occupiedWalls, anchorFacing, rotatePieceCW, rotateLayoutCW,
  unitsPerMeter, doorOverlapCount, placePieces,
} from '../src/export/furnitureFit.js'

let fail = 0
const eq = (msg, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g !== w) { console.log('FAIL', msg, '\n  got ', g, '\n  want', w); fail++ }
  else console.log('ok  ', msg)
}
const near = (msg, got, want, tol = 0.5) => {
  if (Math.abs(got - want) > tol) { console.log('FAIL', msg, 'got', got, 'want', want); fail++ }
  else console.log('ok  ', msg)
}

// ---- A: piece rotation ----
eq('CW anchor top-left->top-right', rotatePieceCW({ anchor: 'top-left', gap_x: 2, gap_y: 4 }).anchor, 'top-right')
eq('CW gaps top-left(2,4)->(4,2)', [rotatePieceCW({ anchor: 'top-left', gap_x: 2, gap_y: 4 }).gap_x, rotatePieceCW({ anchor: 'top-left', gap_x: 2, gap_y: 4 }).gap_y], [4, 2])
eq('CW anchor top-center->center-right', rotatePieceCW({ anchor: 'top-center' }).anchor, 'center-right')
eq('CW anchor center stays', rotatePieceCW({ anchor: 'center', gap_x: 3, gap_y: 5 }).anchor, 'center')
eq('CW center gaps (3,5)->(-5,3)', [rotatePieceCW({ anchor: 'center', gap_x: 3, gap_y: 5 }).gap_x, rotatePieceCW({ anchor: 'center', gap_x: 3, gap_y: 5 }).gap_y], [-5, 3])
// facing turns with the piece: top-center faces south(0) -> after CW faces west(270)
eq('CW facing 0->270', rotatePieceCW({ anchor: 'top-center' }).rotation, 270)

// Four CW rotations return a piece to its start (anchor, gaps, rotation mod 360).
{
  const p0 = { anchor: 'top-left', gap_x: 2, gap_y: 4, rotation: 0 }
  let p = p0
  for (let i = 0; i < 4; i++) p = rotatePieceCW(p)
  eq('4x CW anchor restored', p.anchor, p0.anchor)
  eq('4x CW gaps restored', [p.gap_x, p.gap_y], [p0.gap_x, p0.gap_y])
  eq('4x CW rotation restored', ((p.rotation % 360) + 360) % 360, 0)
}

// rotateLayoutCW swaps the target.
{
  const l = { id: 'kitchen_xs', type: 'kitchen', w: 78, h: 46, pieces: [{ anchor: 'top-center' }] }
  const r = rotateLayoutCW(l)
  eq('layout target swaps 78x46 -> 46x78', [r.w, r.h], [46, 78])
  eq('layout marked rotated', r.rotated, true)
}

// ---- units sanity (feet_inches, per_unit 10 -> ~32.8 units/m) ----
near('unitsPerMeter feet_inches/10', unitsPerMeter({ system: 'feet_inches', per_unit: 10 }), 32.8)

// ---- C: door overlap + carve ----
// kitchen_xs in a 95x65 room, door centred on the north wall at [35,60]. Three 0.6m pieces:
// cabinet(top-left, gx2), stove(top-center), sink(top-right, gx2). The stove overlaps the door.
const cab = { asset: { dimensions: [0.6, 0.9, 0.6] }, anchor: 'top-left', gap_x: 2, gap_y: 4 }
const stove = { asset: { dimensions: [0.6, 0.9, 0.65] }, anchor: 'top-center', gap_x: 0, gap_y: 4 }
const sink = { asset: { dimensions: [0.6, 0.9, 0.6] }, anchor: 'top-right', gap_x: 2, gap_y: 4 }
const pieces = [cab, stove, sink]
const room = { x: 0, y: 0, w: 95, h: 65 }
const wallT = 8
const units = { system: 'feet_inches', per_unit: 10 }
const doors = { north: [[35, 60]], south: [], east: [], west: [] }

eq('overlap count = 1 (stove only)', doorOverlapCount(pieces, room, wallT, units, doors), 1)
// The counter is packed (cabinet | stove | sink), so the stove has nowhere to slide -> dropped.
const kept = placePieces(pieces, room, wallT, units, doors)
eq('packed: keep cabinet + sink, stove has no room -> dropped', kept.map((p) => p.anchor), ['top-left', 'top-right'])
eq('placed pieces clear the door', doorOverlapCount(kept, room, wallT, units, doors), 0)

// No door on north -> nothing moved or dropped.
eq('no north door -> keep all', placePieces(pieces, room, wallT, units, { north: [], south: [], east: [], west: [] }).length, 3)

// SHIFT case: a lone cabinet on the north wall of a wide room, small centred door -> the piece
// slides sideways off the door instead of being dropped.
const wide = { x: 0, y: 0, w: 150, h: 60 }
const lone = [{ asset: { dimensions: [0.6, 0.9, 0.6] }, anchor: 'top-center', gap_x: 0, gap_y: 4 }]
const wideDoor = { north: [[65, 90]], south: [], east: [], west: [] }
eq('lone piece overlaps centred door', doorOverlapCount(lone, wide, wallT, units, wideDoor), 1)
const shifted = placePieces(lone, wide, wallT, units, wideDoor)
eq('shift keeps the piece (not dropped)', shifted.length, 1)
eq('shift moves it off-centre (gap_x < 0)', shifted[0].gap_x < 0, true)
eq('shifted piece now clears the door', doorOverlapCount(shifted, wide, wallT, units, wideDoor), 0)

// occupiedWalls / parseAnchor sanity for the rotated names.
eq('occupiedWalls center-right', occupiedWalls('center-right'), ['east'])
eq('occupiedWalls center none', occupiedWalls('center'), [])
eq('anchorFacing center-right = 270', anchorFacing('center-right'), 270)

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS')
process.exit(fail ? 1 : 0)
