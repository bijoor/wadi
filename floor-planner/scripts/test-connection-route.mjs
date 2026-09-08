// Tests for connectionRoute (Canvas connection routing): right-angled route that crosses the
// door, ends along the connection's main axis (so the arrow points right), and — the fix here —
// never runs a leg ALONG the shared wall (which overlapped the wall line).
import { connectionRoute } from '../src/model/geometry.js'

let fail = 0
const eq = (msg, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g !== w) { console.log('FAIL', msg, '\n  got ', g, '\n  want', w); fail++ } else console.log('ok  ', msg)
}
const ok = (msg, cond) => { if (!cond) { console.log('FAIL', msg); fail++ } else console.log('ok  ', msg) }
const lastSeg = (r) => { const p = r.points; const a = p[p.length - 2], b = p[p.length - 1]; return { dx: b[0] - a[0], dy: b[1] - a[1] } }
// Is the door point on some segment of the polyline (orthogonal segments)?
const doorOnPath = (r) => {
  if (!r.door) return true
  const { x, y } = r.door
  for (let i = 0; i < r.points.length - 1; i++) {
    const [x0, y0] = r.points[i], [x1, y1] = r.points[i + 1]
    if (y0 === y1 && Math.abs(y - y0) < 1e-9 && x >= Math.min(x0, x1) - 1e-9 && x <= Math.max(x0, x1) + 1e-9) return true
    if (x0 === x1 && Math.abs(x - x0) < 1e-9 && y >= Math.min(y0, y1) - 1e-9 && y <= Math.max(y0, y1) + 1e-9) return true
  }
  return false
}
// No leg lies ON the shared wall: for a vertical wall at x=edge, no vertical segment sits at
// x===edge; for a horizontal wall at y=edge, no horizontal segment sits at y===edge.
const legOnWall = (r, axis, edge) => {
  for (let i = 0; i < r.points.length - 1; i++) {
    const [x0, y0] = r.points[i], [x1, y1] = r.points[i + 1]
    if (axis === 'x' && x0 === x1 && Math.abs(x0 - edge) < 1e-9 && y0 !== y1) return true
    if (axis === 'y' && y0 === y1 && Math.abs(y0 - edge) < 1e-9 && x0 !== x1) return true
  }
  return false
}

// Vertical shared wall: A left, B right (offset). edge=10, ymid=6, mx=12.5.
const A = { x: 0, y: 0, w: 10, h: 10 }
const B = { x: 10, y: 2, w: 10, h: 10 }
eq('V route', connectionRoute(A, B).points, [[5, 5], [5, 6], [12.5, 6], [12.5, 7], [15, 7]])
ok('V door on path', doorOnPath(connectionRoute(A, B)))
ok('V no leg on the shared wall (x=10)', !legOnWall(connectionRoute(A, B), 'x', 10))
{ const s = lastSeg(connectionRoute(A, B)); ok('V final leg horizontal (arrow)', s.dy === 0 && s.dx !== 0) }

// Horizontal shared wall: A above, C below (offset). edge=10, xmid=6, my=12.5.
const C = { x: 2, y: 10, w: 10, h: 10 }
eq('H route', connectionRoute(A, C).points, [[5, 5], [6, 5], [6, 12.5], [7, 12.5], [7, 15]])
ok('H door on path', doorOnPath(connectionRoute(A, C)))
ok('H no leg on the shared wall (y=10)', !legOnWall(connectionRoute(A, C), 'y', 10))
{ const s = lastSeg(connectionRoute(A, C)); ok('H final leg vertical (arrow)', s.dx === 0 && s.dy !== 0) }

// Aligned centres (stacked, same x): still crosses the door, final leg vertical, no wall leg.
const D = { x: 0, y: 10, w: 10, h: 10 }
ok('aligned door on path', doorOnPath(connectionRoute(A, D)))
ok('aligned no leg on the shared wall', !legOnWall(connectionRoute(A, D), 'y', 10))
{ const s = lastSeg(connectionRoute(A, D)); ok('aligned final leg vertical', s.dx === 0 && s.dy !== 0) }

// Non-adjacent: straight centre line, no door.
const E = { x: 30, y: 30, w: 10, h: 10 }
eq('gap door null', connectionRoute(A, E).door, null)
eq('gap straight', connectionRoute(A, E).points, [[5, 5], [35, 35]])

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS')
process.exit(fail ? 1 : 0)
