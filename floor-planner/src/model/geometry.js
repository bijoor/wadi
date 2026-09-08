// Geometry helpers. All rectangles are {x, y, w, h} in integer grid cells.

export const snap = (v) => Math.round(v)

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

// Length of overlap between two 1D intervals [a0,a1) and [b0,b1).
function overlapLen(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

// Two rooms share a wall if they touch on an edge with a positive shared extent
// and do not overlap.
export function sharesWall(a, b) {
  if (rectsOverlap(a, b)) return false
  const ax1 = a.x + a.w
  const ay1 = a.y + a.h
  const bx1 = b.x + b.w
  const by1 = b.y + b.h

  // Vertical shared wall (left/right touching): x edges meet, y ranges overlap.
  if (ax1 === b.x || bx1 === a.x) {
    if (overlapLen(a.y, ay1, b.y, by1) > 0) return true
  }
  // Horizontal shared wall (top/bottom touching): y edges meet, x ranges overlap.
  if (ay1 === b.y || by1 === a.y) {
    if (overlapLen(a.x, ax1, b.x, bx1) > 0) return true
  }
  return false
}

export function roomInsidePlot(room, plot) {
  return (
    room.x >= plot.x &&
    room.y >= plot.y &&
    room.x + room.w <= plot.x + plot.w &&
    room.y + room.h <= plot.y + plot.h
  )
}

// Clamp a room's position so it stays fully inside the plot (keeps size).
export function clampRoomPosToPlot(room, plot) {
  const maxX = plot.x + plot.w - room.w
  const maxY = plot.y + plot.h - room.h
  return {
    x: Math.min(Math.max(room.x, plot.x), Math.max(plot.x, maxX)),
    y: Math.min(Math.max(room.y, plot.y), Math.max(plot.y, maxY)),
  }
}

// Point (in cell coords) hit-tests inside a rect.
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

export function roomCenter(r) {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 }
}

// Right-angled route between two adjacent rooms that crosses the shared wall at
// the point where the door is placed (centre of the shared interval, matching
// placeDoor). Returns { points: [[x,y]...], door: {x,y} } in cell coords, or
// null when the rooms don't share a wall. Falls back to a straight center line
// only when the geometry is degenerate.
export function connectionRoute(a, b) {
  if (!a || !b) return null
  const ca = roomCenter(a)
  const cb = roomCenter(b)
  const ax1 = a.x + a.w
  const ay1 = a.y + a.h
  const bx1 = b.x + b.w
  const by1 = b.y + b.h

  // Vertical shared wall (left/right adjacency): door sits on the shared x edge,
  // centred in the overlapping y range. The door (edge,ymid) is an explicit corner
  // so the line provably crosses there, and the FINAL leg runs horizontally into B
  // (along the connection's main east-west axis) so the arrow head points the right
  // way: A -> (ax,ymid) -> door -> (edge,by) -> B.
  if (ax1 === b.x || bx1 === a.x) {
    const y0 = Math.max(a.y, b.y)
    const y1 = Math.min(ay1, by1)
    if (y1 > y0) {
      const edge = ax1 === b.x ? ax1 : a.x
      const ymid = (y0 + y1) / 2
      return {
        door: { x: edge, y: ymid },
        points: [[ca.cx, ca.cy], [ca.cx, ymid], [edge, ymid], [edge, cb.cy], [cb.cx, cb.cy]],
      }
    }
  }
  // Horizontal shared wall (top/bottom adjacency): door on the shared y edge,
  // centred in the overlapping x range. Final leg runs vertically into B (the main
  // north-south axis): A -> (xmid,ay) -> door -> (bx,edge) -> B.
  if (ay1 === b.y || by1 === a.y) {
    const x0 = Math.max(a.x, b.x)
    const x1 = Math.min(ax1, bx1)
    if (x1 > x0) {
      const edge = ay1 === b.y ? ay1 : a.y
      const xmid = (x0 + x1) / 2
      return {
        door: { x: xmid, y: edge },
        points: [[ca.cx, ca.cy], [xmid, ca.cy], [xmid, edge], [cb.cx, edge], [cb.cx, cb.cy]],
      }
    }
  }
  // No shared wall (violation edge): straight center-to-center line.
  return { door: null, points: [[ca.cx, ca.cy], [cb.cx, cb.cy]] }
}
