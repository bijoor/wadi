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
