import React, { useRef, useState, useCallback, useEffect } from 'react'
import { analyze, roomById, floorColor } from '../model/graph.js'
import { roomCenter, sharesWall, rectsOverlap } from '../model/geometry.js'
import { PALETTE } from '../store/initialState.js'
import { fmtLen, unitsOf } from '../utils/physical.js'
import { syncGuides } from '../model/guides.js'

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const SHEET_GAP = 4 // cells between floor plates in side-by-side view

function normRect(x0, y0, x1, y1) {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
  }
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi)
}

// Guide lines (permanent = solid accent, provisional = faint dashed) + labels for the
// named/editable bays between them. Non-interactive; coords are project units × cell.
function GuidesLayer({ guides, cell, plot, ext = 0 }) {
  if (!guides) return null
  // Extend the lines past the plot edges (by `ext`) so they read as full construction
  // guides, not just room outlines.
  const x0 = plot.x * cell - ext, y0 = plot.y * cell - ext
  const x1 = (plot.x + plot.w) * cell + ext, y1 = (plot.y + plot.h) * cell + ext
  const lines = []
  for (const g of guides.x || []) {
    const gx = g.at * cell
    lines.push(<line key={'gx' + g.id} x1={gx} y1={y0} x2={gx} y2={y1} className="guide" />)
  }
  for (const g of guides.y || []) {
    const gy = g.at * cell
    lines.push(<line key={'gy' + g.id} x1={x0} y1={gy} x2={x1} y2={gy} className="guide" />)
  }
  return <g className="guides-layer" style={{ pointerEvents: 'none' }}>{lines}</g>
}

// Badge each bound room dimension (a configurable size) with a bracket + the variable
// name along the driven edge, so the configurable skeleton is visible while laying out.
function SizeBadges({ rooms, bindings = [], variables = [], cell }) {
  if (!bindings.length) return null
  const byId = new Map((rooms || []).map((r) => [r.id, r]))
  const labelOf = new Map(variables.map((v) => [v.name, v.label || v.name]))
  const els = []
  for (const b of bindings) {
    const r = byId.get(b.room)
    if (!r) continue
    const txt = '◆ ' + (labelOf.get(b.var) || b.var)
    if (b.dim === 'w') {
      const y = (r.y) * cell + 12
      const mx = (r.x + r.w / 2) * cell
      els.push(<text key={'sw' + b.room} x={mx} y={y} textAnchor="middle" className="size-badge">{txt}</text>)
    } else {
      const x = (r.x) * cell + 6
      const my = (r.y + r.h / 2) * cell
      els.push(<text key={'sh' + b.room} x={x} y={my} textAnchor="start" dominantBaseline="middle" className="size-badge" transform={`rotate(-90 ${x} ${my})`}>{txt}</text>)
    }
  }
  return <g className="size-badges" style={{ pointerEvents: 'none' }}>{els}</g>
}

export default function Canvas({ state, dispatch }) {
  const { grid, plot, tool, selection, view, floors, activeFloor, viewMode } = state
  // Coordinates (rooms/plot) are in PROJECT UNITS. A grid cell spans `step` project
  // units and `grid.cell` pixels, so `cell` here is pixels-per-project-unit and every
  // `coord * cell` maps a project-unit coordinate to pixels. GridLines still draws at
  // grid.cell intervals. Snapping + bounds work in project units (multiples of step).
  const step = grid.unitPerCell || 10
  const cell = grid.cell / step
  const GW = grid.cols * step // grid extent in project units
  const GH = grid.rows * step
  const gapU = SHEET_GAP * step // side-by-side gap, in project units
  const snap = (u) => Math.round(u / step) * step
  const snapFloor = (u) => Math.floor(u / step) * step
  // Snap an edge to the nearest GUIDE within ~3/4 of a cell (so rooms bind to the
  // structural lines and share them), else fall back to the grid. Guides are grid-
  // aligned, so this composes with the grid snap the resize/draw math already does.
  const gxPos = (state.guides?.x || []).map((l) => l.at)
  const gyPos = (state.guides?.y || []).map((l) => l.at)
  const GSNAP = step * 0.75
  const snapAxis = (u, positions) => {
    let best = null, bd = GSNAP
    for (const p of positions) { const d = Math.abs(u - p); if (d < bd) { bd = d; best = p } }
    return best != null ? best : snap(u)
  }
  const snapX = (u) => snapAxis(u, gxPos)
  const snapY = (u) => snapAxis(u, gyPos)
  // Shift a group-move delta so the nearest room edge lands on a guide (single-room
  // move only; multi keeps the plain grid delta).
  const snapDelta = (d, edgeVals, positions) => {
    let best = null, bd = GSNAP
    for (const e of edgeVals) for (const p of positions) {
      const diff = p - (e + d)
      if (Math.abs(diff) < bd) { bd = Math.abs(diff); best = d + diff }
    }
    return best != null ? best : d
  }
  const U = unitsOf(state.build) // display units for on-diagram labels (physical)
  const svgRef = useRef(null)
  const [interaction, setInteraction] = useState(null)
  const selectedIds = state.selectedIds || []
  const selectedSet = new Set(selectedIds)
  const sheets = viewMode === 'sheets'

  // Only the floor being edited is interactive. Its rooms and the connections
  // among them are the scope for drawing, selecting, hit-testing, and health.
  const rooms = state.rooms.filter((r) => r.floor === activeFloor)
  const roomIdSet = new Set(rooms.map((r) => r.id))
  const edges = state.edges.filter((e) => roomIdSet.has(e.a) && roomIdSet.has(e.b))

  const floorIndex = (id) => floors.findIndex((f) => f.id === id)
  const otherFloors = floors.filter((f) => f.id !== activeFloor)

  // A faint, non-interactive tracing of the floor immediately below, so rooms
  // can be lined up with the storey they sit on. (Floors are ordered bottom->top.)
  const activeIndex = floorIndex(activeFloor)
  const belowId = activeIndex > 0 ? floors[activeIndex - 1].id : null
  const ghostRooms = belowId ? state.rooms.filter((r) => r.floor === belowId) : []

  // In side-by-side, the active floor's plate is offset to its column; the
  // interactive layer (rooms, handles, drag/resize) renders inside that column
  // and all pointer math is shifted by it so editing works exactly like Single.
  const dxCells = sheets ? activeIndex * (plot.w + gapU) : 0 // project units

  // Rooms being moved/resized render from their live rects; validity is computed
  // on the live layout so warnings update as you drag.
  const liveRooms = rooms.map((r) => {
    if (interaction) {
      if (interaction.kind === 'resize-room' && interaction.id === r.id) {
        return { ...r, ...interaction.live }
      }
      if (interaction.kind === 'move-rooms' && interaction.live.has(r.id)) {
        return { ...r, ...interaction.live.get(r.id) }
      }
    }
    return r
  })
  const report = analyze({ plot, rooms: liveRooms, edges })

  // Guides to draw: the committed doc guides normally, but during a drag they are stale
  // (they re-sync only on commit), so re-derive them from the live layout (active-floor
  // rooms in their live rects + the other floors unchanged) so they track the drag.
  const displayGuides = React.useMemo(() => {
    if (!interaction || (interaction.kind !== 'resize-room' && interaction.kind !== 'move-rooms')) {
      return state.guides
    }
    const liveById = new Map(liveRooms.map((r) => [r.id, r]))
    const liveAll = state.rooms.map((r) => liveById.get(r.id) || r)
    return syncGuides(liveAll, { guides: state.guides, bays: state.bays }).guides
  }, [interaction, liveRooms, state.rooms, state.guides, state.bays])

  // A room dimension bound to a size variable is LOCKED: the variable owns it, so it can't
  // be resized by hand (that would let the sketch diverge from the variable). 'w' -> width,
  // 'h' -> height.
  const boundDim = (roomId, dim) => (state.bindings || []).some((b) => b.room === roomId && b.dim === dim)

  // If a guide is an EDGE of a variable-bound dimension, it can be dragged to change that
  // variable. Returns { varName, anchor } (anchor = the dimension's other edge position),
  // else null. Used to place drag grips and to turn a drag into a new variable value.
  const guideInfo = (axis, at) => {
    for (const b of state.bindings || []) {
      const onAxis = (b.dim === 'w' && axis === 'x') || (b.dim === 'h' && axis === 'y')
      if (!onAxis) continue
      const r = state.rooms.find((x) => x.id === b.room)
      if (!r) continue
      const lo = b.dim === 'w' ? r.x : r.y
      const hi = b.dim === 'w' ? r.x + r.w : r.y + r.h
      if (Math.abs(at - lo) < 0.01) return { varName: b.var, anchor: hi }
      if (Math.abs(at - hi) < 0.01) return { varName: b.var, anchor: lo }
    }
    return null
  }

  function onGuideDown(e, axis, at, info) {
    e.stopPropagation()
    setInteraction({ kind: 'drag-guide', axis, info, startAt: at, live: at })
  }

  const toCell = useCallback(
    (clientX, clientY) => {
      const rect = svgRef.current.getBoundingClientRect()
      const wx = (clientX - rect.left - view.panX) / view.zoom
      const wy = (clientY - rect.top - view.panY) / view.zoom
      return { fx: wx / cell - dxCells, fy: wy / cell }
    },
    [view.panX, view.panY, view.zoom, cell, dxCells]
  )

  const roomAtCell = useCallback(
    (fx, fy) => {
      for (let i = rooms.length - 1; i >= 0; i--) {
        const r = rooms[i]
        if (fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h) return r
      }
      return null
    },
    [rooms]
  )

  // A connection can be drawn between any two distinct rooms (it becomes a
  // relationship to satisfy; adjacency is not required to create it).
  const edgeDropValid = useCallback(
    (fromId, toId) => !!toId && toId !== fromId,
    []
  )

  // ---------- pointer down on a room ----------
  function onRoomDown(e, room) {
    e.stopPropagation()
    if (tool === 'draw-room') {
      onBackgroundDown(e)
      return
    }
    if (tool === 'draw-edge') {
      const { fx, fy } = toCell(e.clientX, e.clientY)
      setInteraction({ kind: 'draw-edge', fromId: room.id, curX: fx, curY: fy, overId: null })
      return
    }
    // Shift-click toggles a room in/out of the multi-selection.
    if (e.shiftKey) {
      const next = selectedSet.has(room.id)
        ? selectedIds.filter((i) => i !== room.id)
        : [...selectedIds, room.id]
      dispatch({ type: 'SELECT_MANY', ids: next })
      return
    }
    // Decide the group to move: the existing multi-selection if this room is part
    // of it, otherwise just this room (which also becomes the selection).
    let ids
    if (selectedSet.has(room.id) && selectedIds.length > 1) {
      ids = selectedIds
    } else {
      ids = [room.id]
      dispatch({ type: 'SELECT', itemType: 'room', id: room.id })
    }
    const { fx, fy } = toCell(e.clientX, e.clientY)
    const group = ids.map((id) => {
      const r = roomById(rooms, id)
      return { id, x0: r.x, y0: r.y, w: r.w, h: r.h }
    })
    setInteraction({
      kind: 'move-rooms',
      startFx: fx,
      startFy: fy,
      group,
      live: new Map(group.map((g) => [g.id, { x: g.x0, y: g.y0 }])),
    })
  }

  // ---------- pointer down on a resize handle ----------
  function onHandleDown(e, room, handle) {
    e.stopPropagation()
    setInteraction({ kind: 'resize-room', id: room.id, handle, r0: { ...room }, live: { ...room } })
  }

  function onPlotHandleDown(e, handle) {
    e.stopPropagation()
    setInteraction({ kind: 'resize-plot', handle, p0: { ...plot }, live: { ...plot } })
  }

  // ---------- pointer down on empty background ----------
  function onBackgroundDown(e) {
    // Side-by-side: no drawing/rubber-band on the composite, but an empty-space
    // press still clears the current selection (like clicking off a room).
    if (sheets) {
      if (selection.type || selectedIds.length) {
        dispatch({ type: 'SELECT', itemType: null, id: null })
      }
      return
    }
    const { fx, fy } = toCell(e.clientX, e.clientY)
    if (tool === 'draw-room') {
      const gx = clamp(snapX(fx), 0, GW - step)
      const gy = clamp(snapY(fy), 0, GH - step)
      setInteraction({ kind: 'draw-room', x0: gx, y0: gy, cur: { x: gx + step, y: gy + step } })
      return
    }
    if (tool === 'draw-edge') return
    // select tool on empty -> rubber-band selection window (pan is via scroll)
    setInteraction({ kind: 'rubber', x0: fx, y0: fy, cur: { x: fx, y: fy } })
  }

  // ---------- pointer move ----------
  function onPointerMove(e) {
    if (!interaction) return
    const { fx, fy } = toCell(e.clientX, e.clientY)

    if (interaction.kind === 'rubber') {
      setInteraction({ ...interaction, cur: { x: fx, y: fy } })
      return
    }

    if (interaction.kind === 'move-rooms') {
      // Free group move, snapped to grid; clamp so every room stays on the canvas.
      // A single-room move also snaps its edges to guides (so it binds to the skeleton).
      let dx = snap(fx - interaction.startFx)
      let dy = snap(fy - interaction.startFy)
      if (interaction.group.length === 1) {
        const g0 = interaction.group[0]
        dx = snapDelta(dx, [g0.x0, g0.x0 + g0.w], gxPos)
        dy = snapDelta(dy, [g0.y0, g0.y0 + g0.h], gyPos)
      }
      // A room dimension bound to a variable pins its edges to guide positions, so the
      // room can't move on that axis (width bound -> no horizontal move; depth -> vertical).
      if (interaction.group.some((g) => boundDim(g.id, 'w'))) dx = 0
      if (interaction.group.some((g) => boundDim(g.id, 'h'))) dy = 0
      let lowX = -Infinity, highX = Infinity, lowY = -Infinity, highY = Infinity
      for (const g of interaction.group) {
        lowX = Math.max(lowX, -g.x0)
        highX = Math.min(highX, GW - (g.x0 + g.w))
        lowY = Math.max(lowY, -g.y0)
        highY = Math.min(highY, GH - (g.y0 + g.h))
      }
      const cdx = clamp(dx, lowX, highX)
      const cdy = clamp(dy, lowY, highY)
      const live = new Map(
        interaction.group.map((g) => [g.id, { x: g.x0 + cdx, y: g.y0 + cdy }])
      )
      setInteraction({ ...interaction, live })
      return
    }

    if (interaction.kind === 'resize-room') {
      // Free resize; the dragged edge snaps to a guide (then grid), overlaps/out-of-plot
      // are flagged, not blocked.
      const cand = resizeRect(interaction.r0, interaction.handle, snapX(fx), snapY(fy), {
        x: 0, y: 0, w: GW, h: GH,
      }, step)
      // A dimension bound to a variable is locked: hold it (and its origin) at the start
      // value so only the free dimension of a corner drag changes.
      const r0 = interaction.r0
      if (boundDim(interaction.id, 'w')) { cand.x = r0.x; cand.w = r0.w }
      if (boundDim(interaction.id, 'h')) { cand.y = r0.y; cand.h = r0.h }
      setInteraction({ ...interaction, live: cand })
      return
    }

    if (interaction.kind === 'draw-guide' || interaction.kind === 'drag-guide') {
      // Move the guide to the snapped cursor position on its axis (grid snap).
      const p = interaction.axis === 'x' ? clamp(snap(fx), 0, GW) : clamp(snap(fy), 0, GH)
      setInteraction({ ...interaction, live: p })
      return
    }

    if (interaction.kind === 'draw-room') {
      const gx = clamp(snapX(fx), 0, GW)
      const gy = clamp(snapY(fy), 0, GH)
      setInteraction({ ...interaction, cur: { x: gx, y: gy } })
      return
    }

    if (interaction.kind === 'draw-edge') {
      const over = roomAtCell(fx, fy)
      setInteraction({ ...interaction, curX: fx, curY: fy, overId: over ? over.id : null })
      return
    }

    if (interaction.kind === 'resize-plot') {
      const live = resizeRect(interaction.p0, interaction.handle, fx, fy, {
        x: 0, y: 0, w: GW, h: GH,
      }, step)
      setInteraction({ ...interaction, live })
      return
    }
  }

  // ---------- pointer up ----------
  function onPointerUp() {
    if (!interaction) return
    const it = interaction
    setInteraction(null)

    if (it.kind === 'rubber') {
      // Select all rooms intersecting the drawn window (tiny window = click = clear).
      const r = normRect(it.x0, it.y0, it.cur.x, it.cur.y)
      if (r.w < step * 0.4 && r.h < step * 0.4) {
        dispatch({ type: 'SELECT', itemType: null, id: null })
      } else {
        const ids = rooms.filter((rm) => rectsOverlap(r, rm)).map((rm) => rm.id)
        dispatch({ type: 'SELECT_MANY', ids })
      }
    } else if (it.kind === 'move-rooms') {
      const changes = []
      for (const g of it.group) {
        const l = it.live.get(g.id)
        if (l && (l.x !== g.x0 || l.y !== g.y0)) changes.push({ id: g.id, x: l.x, y: l.y })
      }
      if (changes.length) dispatch({ type: 'UPDATE_ROOMS', changes })
    } else if (it.kind === 'resize-room') {
      const r0 = it.r0
      const l = it.live
      if (l.x !== r0.x || l.y !== r0.y || l.w !== r0.w || l.h !== r0.h) {
        dispatch({ type: 'UPDATE_ROOM', id: it.id, patch: { x: l.x, y: l.y, w: l.w, h: l.h } })
      }
    } else if (it.kind === 'drag-guide') {
      // Dragging a guide sets the bound dimension's variable = distance to its anchor edge,
      // which re-flows the whole plan (SET_VAR_VALUE).
      const value = Math.abs(it.live - it.info.anchor)
      if (value > 0 && it.live !== it.startAt) {
        dispatch({ type: 'SET_VAR_VALUE', name: it.info.varName, value })
      }
    } else if (it.kind === 'draw-room') {
      const r = normRect(it.x0, it.y0, it.cur.x, it.cur.y)
      if (r.w >= step && r.h >= step) {
        const n = rooms.length
        dispatch({
          type: 'ADD_ROOM',
          room: {
            name: `Room ${n + 1}`,
            x: r.x, y: r.y, w: r.w, h: r.h,
            color: PALETTE[n % PALETTE.length],
          },
        })
      }
    } else if (it.kind === 'draw-edge') {
      if (it.overId && it.overId !== it.fromId && edgeDropValid(it.fromId, it.overId)) {
        dispatch({ type: 'ADD_EDGE', a: it.fromId, b: it.overId })
      }
    } else if (it.kind === 'resize-plot') {
      const l = it.live
      dispatch({ type: 'UPDATE_PLOT', patch: { w: l.w, h: l.h } })
    }
  }

  // Zoom around a point (screen coords relative to the svg) by a factor.
  function zoomAround(factor, sx, sy) {
    const newZoom = clamp(view.zoom * factor, 0.2, 4)
    const panX = sx - ((sx - view.panX) / view.zoom) * newZoom
    const panY = sy - ((sy - view.panY) / view.zoom) * newZoom
    dispatch({ type: 'SET_VIEW', patch: { zoom: newZoom, panX, panY } })
  }

  function onWheel(e) {
    if (!svgRef.current) return
    e.preventDefault()
    const rect = svgRef.current.getBoundingClientRect()
    // Trackpad pinch reports ctrlKey; Cmd/Ctrl + wheel is the explicit zoom modifier.
    // A plain wheel / two-finger scroll (incl. Magic Mouse) pans instead of zooming.
    if (e.ctrlKey || e.metaKey) {
      const d = Math.max(-40, Math.min(40, e.deltaY)) // tame momentum spikes
      zoomAround(Math.exp(-d * 0.01), e.clientX - rect.left, e.clientY - rect.top)
    } else {
      dispatch({
        type: 'SET_VIEW',
        patch: { panX: view.panX - e.deltaX, panY: view.panY - e.deltaY },
      })
    }
  }

  // Zoom buttons operate around the viewport centre.
  function zoomByButton(factor) {
    const rect = svgRef.current.getBoundingClientRect()
    zoomAround(factor, rect.width / 2, rect.height / 2)
  }

  // Fit the current content into the viewport, centred. The content is the
  // plates row in side-by-side; otherwise it is the plot together with any rooms
  // (so the design is framed, not the whole oversized grid). `origin` is the
  // world-space top-left of that content.
  function fitView() {
    const rect = svgRef.current.getBoundingClientRect()
    const pad = 32
    let originX, originY, contentW, contentH
    if (sheets) {
      const titleH = 18 // space above each plate for its floor name
      originX = 0
      originY = -titleH
      contentW = (floors.length * (plot.w + gapU) - gapU) * cell
      contentH = plot.h * cell + titleH
    } else {
      // plot ∪ rooms bounding box (overlay counts every floor's rooms)
      const rs = viewMode === 'overlay' ? state.rooms : rooms
      let minX = plot.x, minY = plot.y, maxX = plot.x + plot.w, maxY = plot.y + plot.h
      for (const r of rs) {
        if (r.x < minX) minX = r.x
        if (r.y < minY) minY = r.y
        if (r.x + r.w > maxX) maxX = r.x + r.w
        if (r.y + r.h > maxY) maxY = r.y + r.h
      }
      originX = minX * cell
      originY = minY * cell
      contentW = (maxX - minX) * cell
      contentH = (maxY - minY) * cell
    }
    const z = clamp(
      Math.min((rect.width - pad * 2) / contentW, (rect.height - pad * 2) / contentH),
      0.2,
      4
    )
    dispatch({
      type: 'SET_VIEW',
      patch: {
        zoom: z,
        panX: (rect.width - contentW * z) / 2 - originX * z,
        panY: (rect.height - contentH * z) / 2 - originY * z,
      },
    })
  }

  // Refit when entering or leaving side-by-side (its extent differs a lot). The
  // effect runs after the DOM is committed and laid out, so the svg's size is
  // already correct — call fitView directly (rAF would be skipped while the tab
  // is hidden). Guard on the ref in case the effect fires before mount.
  const prevMode = useRef(viewMode)
  useEffect(() => {
    const changed = viewMode === 'sheets' || prevMode.current === 'sheets'
    prevMode.current = viewMode
    if (changed && svgRef.current) fitView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  const livePlot =
    interaction && interaction.kind === 'resize-plot' ? interaction.live : plot

  const hs = 8 / view.zoom // handle size in world units
  const hitW = 12 / view.zoom // clickable width for edges (screen ~12px)
  // Resize handles show only when exactly one room is selected.
  const selectedRoom =
    selectedIds.length === 1 ? roomById(liveRooms, selectedIds[0]) : null

  return (
    <div className="canvas-wrap">
    <svg
      ref={svgRef}
      className={`canvas tool-${tool}`}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      <defs>
        {/* Arrowhead for a directed connection (points a -> b = the flow). */}
        <marker id="edge-arrow" viewBox="0 0 10 10" refX="8" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse"
          markerUnits="userSpaceOnUse">
          <path d="M0,0 L10,5 L0,10 z" className="edge-arrowhead" />
        </marker>
      </defs>
      <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
        {/* side-by-side: the OTHER floors as static plates behind the editable one */}
        {sheets && (
          <SheetsLayers
            floors={floors}
            allRooms={state.rooms}
            allEdges={state.edges}
            grid={grid}
            plot={plot}
            build={state.build}
            activeFloor={activeFloor}
            selectedSet={selectedSet}
            onPickFloor={(id) => dispatch({ type: 'SET_ACTIVE_FLOOR', id })}
            onPickRoom={(floorId, roomId) => {
              dispatch({ type: 'SET_ACTIVE_FLOOR', id: floorId })
              dispatch({ type: 'SELECT', itemType: 'room', id: roomId })
            }}
          />
        )}

        {/* editable layer = the active floor. In side-by-side it is shifted to its
            own column and framed like a plate; otherwise it is the whole canvas.
            Every interaction handler (drag / resize / draw) acts on this layer. */}
        <g transform={sheets ? `translate(${dxCells * cell} 0)` : undefined}>
        {sheets ? (
          <>
            <text
              x={plot.x * cell + (plot.w * cell) / 2} y={plot.y * cell - 7}
              textAnchor="middle" className="sheet-title" fill={floorColor(activeIndex)}
            >
              {floors[activeIndex] && floors[activeIndex].name}
            </text>
            <rect
              x={plot.x * cell} y={plot.y * cell}
              width={plot.w * cell} height={plot.h * cell}
              className="sheet-plate active"
            />
          </>
        ) : (
          <GridLines grid={grid} />
        )}

        {/* First-class guides (the structural skeleton) + size-variable badges. During a
            drag the doc guides are stale (they re-sync on commit), so derive them from the
            live rooms so they track the room being resized/moved. Extend past the plot. */}
        <GuidesLayer guides={displayGuides} cell={cell} plot={plot} ext={grid.cell * 1.2} />
        {!sheets && <SizeBadges rooms={liveRooms} bindings={state.bindings} variables={state.variables} cell={cell} />}

        {/* ghosts: overlay superimposes every other floor (colour-coded); single
            shows just the floor below. Not shown in side-by-side. */}
        {!sheets && (viewMode === 'overlay'
          ? otherFloors.map((f) => (
              <FloorGhost
                key={f.id}
                rooms={state.rooms.filter((r) => r.floor === f.id)}
                cell={cell}
                color={floorColor(floorIndex(f.id))}
              />
            ))
          : ghostRooms.map((r) => (
              <rect
                key={`ghost-${r.id}`}
                x={r.x * cell} y={r.y * cell}
                width={r.w * cell} height={r.h * cell}
                className="ghost-room"
              />
            )))}

        {/* plot outline (Single/Overlay). Side-by-side draws the plate frame above. */}
        {!sheets && (
          <rect
            x={livePlot.x * cell}
            y={livePlot.y * cell}
            width={livePlot.w * cell}
            height={livePlot.h * cell}
            className="plot"
          />
        )}

        {/* clickable plot border (select tool, non-sheets only). */}
        {!sheets && tool === 'select' && (
          <rect
            x={livePlot.x * cell}
            y={livePlot.y * cell}
            width={livePlot.w * cell}
            height={livePlot.h * cell}
            className="plot-hit"
            strokeWidth={hitW}
            onPointerDown={(e) => {
              e.stopPropagation()
              dispatch({ type: 'SELECT', itemType: 'plot', id: 'plot' })
            }}
          />
        )}

        {/* rooms */}
        {liveRooms.map((r) => {
          const bad = report.overlapRoomIds.has(r.id) || report.outOfPlotSet.has(r.id)
          const sel = selectedSet.has(r.id)
          return (
            <g key={r.id}>
              <rect
                x={r.x * cell} y={r.y * cell}
                width={r.w * cell} height={r.h * cell}
                className={`room ${bad ? 'bad' : ''} ${sel ? 'selected' : ''}`}
                style={{ fill: r.color }}
                onPointerDown={(e) => onRoomDown(e, r)}
              />
              <text
                x={(r.x + r.w / 2) * cell}
                y={(r.y + r.h / 2) * cell - 4}
                className="room-label"
              >
                {r.name}
              </text>
              <text
                x={(r.x + r.w / 2) * cell}
                y={(r.y + r.h / 2) * cell + 12}
                className="room-sub"
              >
                {fmtLen(r.w, U.system, U.perUnit)}×{fmtLen(r.h, U.system, U.perUnit)}
              </text>
            </g>
          )
        })}

        {/* edges on top of rooms so they are always clickable. A fat transparent
            hit-line makes thin edges easy to select. Green = satisfied (rooms
            share a wall), red = unsatisfied. */}
        {edges.map((e) => {
          const a = roomById(liveRooms, e.a)
          const b = roomById(liveRooms, e.b)
          if (!a || !b) return null
          const ca = roomCenter(a)
          const cb = roomCenter(b)
          const sel = selection.type === 'edge' && selection.id === e.id
          const ok = sharesWall(a, b)
          const cls = `edge dashed ${ok ? 'satisfied' : 'violation'} ${sel ? 'selected' : ''}`
          const x1 = ca.cx * cell, y1 = ca.cy * cell, x2 = cb.cx * cell, y2 = cb.cy * cell
          return (
            <g key={e.id}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                className="edge-hit"
                strokeWidth={hitW}
                onPointerDown={(ev) => {
                  ev.stopPropagation()
                  dispatch({ type: 'SELECT', itemType: 'edge', id: e.id })
                }}
              />
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={cls} markerEnd="url(#edge-arrow)" />
            </g>
          )
        })}

        {/* selected room resize handles (above edges so they stay usable). Handles that
            would resize a variable-locked dimension are hidden: the E/W handles when the
            width is bound, N/S when the depth is bound, and a corner only when BOTH are. */}
        {selectedRoom && tool === 'select' &&
          HANDLES.filter((h) => {
            const wLock = boundDim(selectedRoom.id, 'w')
            const hLock = boundDim(selectedRoom.id, 'h')
            if (h === 'e' || h === 'w') return !wLock
            if (h === 'n' || h === 's') return !hLock
            return !(wLock && hLock) // corner: usable while either dimension is free
          }).map((h) => {
            const pos = handlePos(selectedRoom, h, cell)
            return (
              <rect
                key={h}
                x={pos.x - hs / 2} y={pos.y - hs / 2}
                width={hs} height={hs}
                className="handle"
                style={{ cursor: handleCursor(h) }}
                onPointerDown={(e) => onHandleDown(e, selectedRoom, h)}
              />
            )
          })}

        {/* plot resize handles — shown only while the plot is selected (origin
            fixed at 0,0, so only right/bottom/corner). Not in side-by-side. */}
        {!sheets && selection.type === 'plot' && tool === 'select' &&
          ['e', 's', 'se'].map((h) => {
            const pos = handlePos(livePlot, h, cell)
            return (
              <rect key={h}
                x={pos.x - hs / 2} y={pos.y - hs / 2}
                width={hs} height={hs}
                className="handle plot-handle"
                style={{ cursor: handleCursor(h) }}
                onPointerDown={(e) => onPlotHandleDown(e, h)} />
            )
          })}

        {/* drag grips on guides that bound a variable-locked dimension — drag one to
            change its size variable (re-flows the plan). Placed just outside the plot. */}
        {!sheets && tool === 'select' && !interaction && ['x', 'y'].flatMap((axis) =>
          (displayGuides[axis] || []).map((g) => {
            const info = guideInfo(axis, g.at)
            if (!info) return null
            // Just inside the plot edge (top for vertical guides, left for horizontal), so
            // the grips stay visible regardless of pan and read like a ruler.
            const gx = axis === 'x' ? g.at * cell : plot.x * cell + 9
            const gy = axis === 'x' ? plot.y * cell + 9 : g.at * cell
            return (
              <rect key={'grip' + axis + g.id} x={gx - 5} y={gy - 5} width={10} height={10}
                className="guide-grip" style={{ cursor: axis === 'x' ? 'ew-resize' : 'ns-resize' }}
                onPointerDown={(e) => onGuideDown(e, axis, g.at, info)} />
            )
          }))}

        {/* preview of a guide being dragged + its live value */}
        {!sheets && interaction && interaction.kind === 'drag-guide' && (() => {
          const p = interaction.live * cell
          const x0 = plot.x * cell - grid.cell * 1.2, y0 = plot.y * cell - grid.cell * 1.2
          const x1 = (plot.x + plot.w) * cell + grid.cell * 1.2, y1 = (plot.y + plot.h) * cell + grid.cell * 1.2
          const val = Math.round(Math.abs(interaction.live - interaction.info.anchor))
          return (
            <g className="guide-drag-layer" style={{ pointerEvents: 'none' }}>
              {interaction.axis === 'x'
                ? <line x1={p} y1={y0} x2={p} y2={y1} className="guide-drag" />
                : <line x1={x0} y1={p} x2={x1} y2={p} className="guide-drag" />}
              <text x={interaction.axis === 'x' ? p + 4 : x0 + 4} y={interaction.axis === 'x' ? y0 + 12 : p - 4} className="guide-drag-label">{val}</text>
            </g>
          )
        })()}

        {/* rubber-band selection window */}
        {!sheets && interaction && interaction.kind === 'rubber' && (() => {
          const r = normRect(interaction.x0, interaction.y0, interaction.cur.x, interaction.cur.y)
          return (
            <rect x={r.x * cell} y={r.y * cell} width={r.w * cell} height={r.h * cell}
              className="select-rect" />
          )
        })()}

        {/* draft while drawing a room */}
        {!sheets && interaction && interaction.kind === 'draw-room' && (() => {
          const r = normRect(interaction.x0, interaction.y0, interaction.cur.x, interaction.cur.y)
          return (
            <rect x={r.x * cell} y={r.y * cell} width={r.w * cell} height={r.h * cell}
              className="draft-room" />
          )
        })()}

        {/* rubber-band while drawing an edge (green if drop is valid) */}
        {interaction && interaction.kind === 'draw-edge' && (() => {
          const from = roomById(liveRooms, interaction.fromId)
          const c = roomCenter(from)
          const valid = edgeDropValid(interaction.fromId, interaction.overId)
          const bad = interaction.overId && !valid
          return (
            <line x1={c.cx * cell} y1={c.cy * cell}
              x2={interaction.curX * cell} y2={interaction.curY * cell}
              className={`edge draft-edge ${valid ? 'valid' : ''} ${bad ? 'bad' : ''}`} />
          )
        })()}
        </g>
      </g>
    </svg>
      {(viewMode === 'overlay' || sheets) && (
        <div className="floor-legend">
          {floors.map((f, i) => (
            <button
              key={f.id}
              className={f.id === activeFloor ? 'active' : ''}
              onClick={() => dispatch({ type: 'SET_ACTIVE_FLOOR', id: f.id })}
              title={`Edit ${f.name}`}
            >
              <span className="dot" style={{ background: floorColor(i) }} />
              {f.name}
            </button>
          ))}
        </div>
      )}
      {!sheets && rooms.length === 0 && (
        <div className="empty-floor">
          <div className="empty-card">
            <p className="empty-title">This floor has no rooms yet</p>
            <p className="empty-sub">
              Draw one (press <kbd>R</kbd>){belowId ? ' — the floor below is traced faintly for alignment' : ''}, or copy an existing floor here:
            </p>
            <div className="empty-actions">
              {otherFloors
                .filter((f) => state.rooms.some((r) => r.floor === f.id))
                .map((f) => (
                  <button
                    key={f.id}
                    className="secondary"
                    onClick={() =>
                      dispatch({
                        type: 'COPY_ROOMS_TO_FLOOR',
                        ids: state.rooms.filter((r) => r.floor === f.id).map((r) => r.id),
                        floor: activeFloor,
                      })
                    }
                  >
                    Copy all from {f.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
      <div className="zoom-controls">
        <button title="Zoom out" onClick={() => zoomByButton(1 / 1.2)}>−</button>
        <button className="zoom-pct" title="Reset to 100%" onClick={() => zoomByButton(1 / view.zoom)}>
          {Math.round(view.zoom * 100)}%
        </button>
        <button title="Zoom in" onClick={() => zoomByButton(1.2)}>+</button>
        <button title="Fit to view" onClick={fitView}>Fit</button>
      </div>
    </div>
  )
}

// One non-active floor drawn as colour-coded outlines under the active floor
// (overlay view). Non-interactive.
function FloorGhost({ rooms, cell, color }) {
  return (
    <g pointerEvents="none">
      {rooms.map((r) => (
        <rect
          key={r.id}
          x={r.x * cell} y={r.y * cell}
          width={r.w * cell} height={r.h * cell}
          fill={color} fillOpacity="0.07"
          stroke={color} strokeOpacity="0.65" strokeWidth="1.5"
        />
      ))}
    </g>
  )
}

// Every floor laid out as its own plate, side by side. Each plate is a full
// mini floor-plan — rooms with names + dimensions, and connections (green when
// satisfied, red when not). Clicking empty plate space activates that floor;
// clicking a room activates the floor and selects the room (editable via the
// sidebar form). Dragging still happens in Single view.
function SheetsLayers({ floors, allRooms, allEdges, grid, plot, build, activeFloor, selectedSet, onPickFloor, onPickRoom }) {
  // Coords are project units; `cell` = pixels per project unit (see main Canvas).
  const step = grid.unitPerCell || 10
  const cell = grid.cell / step
  const gapU = SHEET_GAP * step
  const U = unitsOf(build)
  const pw = plot.w * cell
  const ph = plot.h * cell
  return (
    <g>
      {floors.map((f, i) => {
        // The active floor is drawn by the editable layer (offset to this same
        // column), so skip it here to avoid a double render.
        if (f.id === activeFloor) return null
        const dx = i * (plot.w + gapU) * cell
        const rooms = allRooms.filter((r) => r.floor === f.id)
        const idset = new Set(rooms.map((r) => r.id))
        const edges = allEdges.filter((e) => idset.has(e.a) && idset.has(e.b))
        const report = analyze({ plot, rooms, edges })
        const active = f.id === activeFloor
        const col = floorColor(i)
        return (
          <g key={f.id} transform={`translate(${dx} 0)`}>
            <text x={plot.x * cell + pw / 2} y={plot.y * cell - 7} textAnchor="middle" className="sheet-title" fill={col}>
              {f.name}
            </text>
            <rect
              x={plot.x * cell} y={plot.y * cell} width={pw} height={ph}
              className={`sheet-plate ${active ? 'active' : ''}`}
            />
            {/* empty-space click target (behind rooms): activate this floor */}
            <rect
              x={plot.x * cell} y={plot.y * cell} width={pw} height={ph}
              fill="transparent" style={{ cursor: 'pointer' }}
              onPointerDown={(e) => { e.stopPropagation(); onPickFloor(f.id) }}
            />
            {/* rooms — clickable to select */}
            {rooms.map((r) => {
              const bad = report.overlapRoomIds.has(r.id) || report.outOfPlotSet.has(r.id)
              const sel = selectedSet.has(r.id)
              return (
                <g key={r.id}>
                  <rect
                    x={r.x * cell} y={r.y * cell} width={r.w * cell} height={r.h * cell}
                    className={`room ${bad ? 'bad' : ''} ${sel ? 'selected' : ''}`}
                    style={{ fill: r.color, cursor: 'pointer' }}
                    onPointerDown={(e) => { e.stopPropagation(); onPickRoom(f.id, r.id) }}
                  />
                  <text x={(r.x + r.w / 2) * cell} y={(r.y + r.h / 2) * cell - 4} textAnchor="middle" className="room-label" pointerEvents="none">
                    {r.name}
                  </text>
                  <text x={(r.x + r.w / 2) * cell} y={(r.y + r.h / 2) * cell + 12} textAnchor="middle" className="room-sub" pointerEvents="none">
                    {fmtLen(r.w, U.system, U.perUnit)}×{fmtLen(r.h, U.system, U.perUnit)}
                  </text>
                </g>
              )
            })}
            {/* connections — display only (non-interactive) */}
            {edges.map((e) => {
              const a = roomById(rooms, e.a)
              const b = roomById(rooms, e.b)
              if (!a || !b) return null
              const ca = roomCenter(a)
              const cb = roomCenter(b)
              const ok = sharesWall(a, b)
              return (
                <line
                  key={e.id}
                  x1={ca.cx * cell} y1={ca.cy * cell} x2={cb.cx * cell} y2={cb.cy * cell}
                  className={`edge dashed ${ok ? 'satisfied' : 'violation'}`}
                  pointerEvents="none"
                />
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

function GridLines({ grid }) {
  const { cols, rows, cell } = grid
  const lines = []
  for (let c = 0; c <= cols; c++) {
    lines.push(
      <line key={`v${c}`} x1={c * cell} y1={0} x2={c * cell} y2={rows * cell}
        className={c % 5 === 0 ? 'grid-major' : 'grid-minor'} />
    )
  }
  for (let r = 0; r <= rows; r++) {
    lines.push(
      <line key={`h${r}`} x1={0} y1={r * cell} x2={cols * cell} y2={r * cell}
        className={r % 5 === 0 ? 'grid-major' : 'grid-minor'} />
    )
  }
  return <g>{lines}</g>
}

function handlePos(r, h, cell) {
  const x = r.x * cell, y = r.y * cell, w = r.w * cell, hgt = r.h * cell
  const map = {
    nw: [x, y], n: [x + w / 2, y], ne: [x + w, y],
    e: [x + w, y + hgt / 2], se: [x + w, y + hgt],
    s: [x + w / 2, y + hgt], sw: [x, y + hgt], w: [x, y + hgt / 2],
  }
  return { x: map[h][0], y: map[h][1] }
}

function handleCursor(h) {
  const map = {
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  }
  return map[h]
}

// Resize a rect given a handle + pointer coords, snapped to `step` & clamped to bounds.
function resizeRect(r0, handle, fx, fy, bounds, step = 1) {
  let { x, y, w, h } = r0
  const snap = (u) => Math.round(u / step) * step
  const gx = snap(fx)
  const gy = snap(fy)
  const bx1 = bounds.x + bounds.w
  const by1 = bounds.y + bounds.h

  if (handle.includes('e')) {
    const right = clamp(gx, x + step, bx1)
    w = right - x
  }
  if (handle.includes('w')) {
    const left = clamp(gx, bounds.x, x + w - step)
    w = x + w - left
    x = left
  }
  if (handle.includes('s')) {
    const bottom = clamp(gy, y + step, by1)
    h = bottom - y
  }
  if (handle.includes('n')) {
    const top = clamp(gy, bounds.y, y + h - step)
    h = y + h - top
    y = top
  }
  return { x, y, w: Math.max(step, w), h: Math.max(step, h) }
}
