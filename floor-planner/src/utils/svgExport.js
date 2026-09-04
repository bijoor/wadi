import { analyze, roomById, floorColor } from '../model/graph.js'
import { roomCenter } from '../model/geometry.js'
import { fmtLen, unitsOf } from './physical.js'

const esc = (s) =>
  String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))

// Build a clean, standalone SVG string of the current plan (no UI chrome).
export function buildSVG(model) {
  const { grid, plot, rooms, edges } = model
  const U = unitsOf(model.build)
  // Coords are PROJECT UNITS; a grid cell is `step` units and `grid.cell` px.
  const step = grid.unitPerCell || 10
  const cell = grid.cell / step // px per project unit (for coords)
  const cellPx = grid.cell // px per grid cell (for grid lines)
  const pad = cellPx
  const W = grid.cols * cellPx + pad * 2
  const H = grid.rows * cellPx + pad * 2
  const report = analyze(model)
  const px = (v) => v * cell + pad // project-unit coord -> px
  const gx = (c) => c * cellPx + pad // grid-cell index -> px

  const parts = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif">`
  )
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`)

  // Grid lines
  let gridLines = ''
  for (let c = 0; c <= grid.cols; c++) {
    const x = gx(c)
    gridLines += `<line x1="${x}" y1="${gx(0)}" x2="${x}" y2="${gx(grid.rows)}" stroke="${c % 5 === 0 ? '#d0d5dd' : '#eceef1'}" stroke-width="1"/>`
  }
  for (let r = 0; r <= grid.rows; r++) {
    const y = gx(r)
    gridLines += `<line x1="${gx(0)}" y1="${y}" x2="${gx(grid.cols)}" y2="${y}" stroke="${r % 5 === 0 ? '#d0d5dd' : '#eceef1'}" stroke-width="1"/>`
  }
  parts.push(`<g>${gridLines}</g>`)

  // Plot boundary
  parts.push(
    `<rect x="${px(plot.x)}" y="${px(plot.y)}" width="${plot.w * cell}" height="${plot.h * cell}" fill="none" stroke="#111827" stroke-width="2.5"/>` // cell = px/unit
  )

  // Rooms
  let roomG = ''
  for (const r of rooms) {
    const x = px(r.x)
    const y = px(r.y)
    const w = r.w * cell
    const h = r.h * cell
    const bad = report.overlapRoomIds.has(r.id) || report.outOfPlotSet.has(r.id)
    roomG += `<g>`
    roomG += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${r.color}" fill-opacity="0.55" stroke="${bad ? '#dc2626' : '#334155'}" stroke-width="${bad ? 2.5 : 1.5}"/>`
    const cx = x + w / 2
    const cy = y + h / 2
    roomG += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="13" font-weight="600" fill="#111827">${esc(r.name)}</text>`
    roomG += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10" fill="#4b5563">${fmtLen(r.w, U.system, U.perUnit)}×${fmtLen(r.h, U.system, U.perUnit)}</text>`
    roomG += `</g>`
  }
  parts.push(`<g>${roomG}</g>`)

  // Connections as dashed lines: green = satisfied, red = unsatisfied.
  let marks = ''
  for (const e of edges) {
    const a = roomById(rooms, e.a)
    const b = roomById(rooms, e.b)
    if (!a || !b) continue
    const ca = roomCenter(a)
    const cb = roomCenter(b)
    const bad = report.unsatisfiedSet.has(e.id)
    marks += `<line x1="${px(ca.cx)}" y1="${px(ca.cy)}" x2="${px(cb.cx)}" y2="${px(cb.cy)}" stroke="${bad ? '#ef4444' : '#16a34a'}" stroke-width="3" stroke-dasharray="6 4"/>`
  }
  parts.push(`<g>${marks}</g>`)

  parts.push(`</svg>`)
  return parts.join('')
}

// Build a standalone SVG of the side-by-side view: every floor as its own
// labelled plate (rooms with names + dimensions, and connections), laid out in a
// row — mirrors what's on screen. `model` is the full document (grid/plot/floors/
// rooms/edges).
const SHEET_GAP = 4 // cells between plates (matches the on-screen view)

export function buildSheetsSVG(model) {
  const { grid, plot, floors, rooms, edges } = model
  const U = unitsOf(model.build)
  const cellPx = grid.cell // px per grid cell (for gaps)
  const cell = grid.cell / (grid.unitPerCell || 10) // px per project unit (for coords)
  const pad = cellPx
  const titleH = 24
  const plateW = plot.w * cell
  const plateH = plot.h * cell
  const step = plateW + SHEET_GAP * cellPx // plate stride in px
  const W = floors.length * plateW + Math.max(0, floors.length - 1) * SHEET_GAP * cellPx + pad * 2
  const H = plateH + titleH + pad * 2

  const parts = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif">`
  )
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`)

  floors.forEach((f, i) => {
    const ox = pad + i * step
    const oy = pad + titleH
    const fr = rooms.filter((r) => r.floor === f.id)
    const idset = new Set(fr.map((r) => r.id))
    const fe = edges.filter((e) => idset.has(e.a) && idset.has(e.b))
    const report = analyze({ plot, rooms: fr, edges: fe })
    const col = floorColor(i)

    let g = '<g>'
    // floor title
    g += `<text x="${ox + plateW / 2}" y="${pad + 16}" text-anchor="middle" font-size="14" font-weight="700" fill="${col}">${esc(f.name)}</text>`
    // plate outline
    g += `<rect x="${ox}" y="${oy}" width="${plateW}" height="${plateH}" fill="#ffffff" stroke="#c3c9d4" stroke-width="2"/>`
    // rooms
    for (const r of fr) {
      const x = ox + r.x * cell
      const y = oy + r.y * cell
      const w = r.w * cell
      const h = r.h * cell
      const bad = report.overlapRoomIds.has(r.id) || report.outOfPlotSet.has(r.id)
      const cx = x + w / 2
      const cy = y + h / 2
      g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${r.color}" fill-opacity="0.55" stroke="${bad ? '#dc2626' : '#334155'}" stroke-width="${bad ? 2.5 : 1.5}"/>`
      g += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="13" font-weight="600" fill="#111827">${esc(r.name)}</text>`
      g += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10" fill="#4b5563">${fmtLen(r.w, U.system, U.perUnit)}×${fmtLen(r.h, U.system, U.perUnit)}</text>`
    }
    // connections
    for (const e of fe) {
      const a = roomById(fr, e.a)
      const b = roomById(fr, e.b)
      if (!a || !b) continue
      const ca = roomCenter(a)
      const cb = roomCenter(b)
      const bad = report.unsatisfiedSet.has(e.id)
      g += `<line x1="${ox + ca.cx * cell}" y1="${oy + ca.cy * cell}" x2="${ox + cb.cx * cell}" y2="${oy + cb.cy * cell}" stroke="${bad ? '#ef4444' : '#16a34a'}" stroke-width="3" stroke-dasharray="6 4"/>`
    }
    g += '</g>'
    parts.push(g)
  })

  parts.push(`</svg>`)
  return parts.join('')
}
