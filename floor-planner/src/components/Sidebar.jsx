import React, { useState, useEffect } from 'react'
import { analyze, roomById, floorView } from '../model/graph.js'
import { PALETTE } from '../store/initialState.js'

// Input that only commits its value on Enter or blur (Esc cancels). It keeps a
// local draft while typing so edits aren't applied on every keystroke, and
// re-syncs when the underlying value changes (e.g. from dragging on the canvas).
function CommitInput({ value, type = 'text', min, max, onCommit }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = () => {
    if (type === 'number') {
      const v = parseInt(draft, 10)
      if (!Number.isNaN(v)) onCommit(v)
      else setDraft(String(value)) // revert invalid entry
    } else if (draft !== String(value)) {
      onCommit(draft)
    }
  }
  const cancel = () => setDraft(String(value))

  return (
    <input
      type={type}
      value={draft}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commit(); e.currentTarget.blur() }
        else if (e.key === 'Escape') { cancel(); e.currentTarget.blur() }
      }}
      onBlur={commit}
    />
  )
}

function NumberField({ label, value, min, max, onCommit }) {
  return (
    <label className="field">
      <span>{label}</span>
      <CommitInput type="number" value={value} min={min} max={max} onCommit={onCommit} />
    </label>
  )
}

// Copy the given room(s) onto another floor (keeping position), then jump to
// that floor with the copies selected.
function CopyToFloor({ state, dispatch, ids }) {
  const others = state.floors.filter((f) => f.id !== state.activeFloor)
  if (!others.length) return null
  return (
    <div className="copyto">
      <span className="copyto-label">Copy to floor</span>
      <div className="copyto-btns">
        {others.map((f) => (
          <button
            key={f.id}
            className="secondary small"
            title={`Copy to ${f.name}`}
            onClick={() => dispatch({ type: 'COPY_ROOMS_TO_FLOOR', ids, floor: f.id })}
          >
            {f.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function RoomEditor({ state, dispatch, room }) {
  const { plot, grid } = state
  const update = (patch) => dispatch({ type: 'UPDATE_ROOM', id: room.id, patch })
  const maxX = plot.x + plot.w - room.w
  const maxY = plot.y + plot.h - room.h
  const maxW = plot.x + plot.w - room.x
  const maxH = plot.y + plot.h - room.y
  const area = room.w * room.h * grid.unitPerCell * grid.unitPerCell

  return (
    <div className="panel">
      <h3>Room</h3>
      <label className="field">
        <span>Name</span>
        <CommitInput value={room.name} onCommit={(v) => update({ name: v })} />
      </label>
      <div className="row">
        <NumberField label="X" value={room.x} min={plot.x} max={maxX} onCommit={(v) => update({ x: Math.min(Math.max(v, plot.x), maxX) })} />
        <NumberField label="Y" value={room.y} min={plot.y} max={maxY} onCommit={(v) => update({ y: Math.min(Math.max(v, plot.y), maxY) })} />
      </div>
      <div className="row">
        <NumberField label="W" value={room.w} min={1} max={maxW} onCommit={(v) => update({ w: Math.min(Math.max(v, 1), maxW) })} />
        <NumberField label="H" value={room.h} min={1} max={maxH} onCommit={(v) => update({ h: Math.min(Math.max(v, 1), maxH) })} />
      </div>
      <div className="area-note">Area: {area} {grid.unit}²</div>
      <div className="swatches">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`swatch ${room.color === c ? 'active' : ''}`}
            style={{ background: c }}
            onClick={() => update({ color: c })}
          />
        ))}
      </div>
      <button className="secondary" onClick={() => dispatch({ type: 'DUPLICATE_SELECTED' })}>
        Duplicate (⌘/Ctrl+D)
      </button>
      <CopyToFloor state={state} dispatch={dispatch} ids={[room.id]} />
      <button className="danger" onClick={() => dispatch({ type: 'DELETE_ROOM', id: room.id })}>
        Delete room
      </button>
    </div>
  )
}

function PlotEditor({ state, dispatch }) {
  const { plot, grid } = state
  const update = (patch) => dispatch({ type: 'UPDATE_PLOT', patch })
  const selected = state.selection.type === 'plot'
  return (
    <div className="panel">
      <h3>Plot</h3>
      <div className="area-note">Origin fixed at 0, 0</div>
      <div className="row">
        <NumberField label="W" value={plot.w} min={1} max={grid.cols} onCommit={(v) => update({ w: Math.min(Math.max(v, 1), grid.cols) })} />
        <NumberField label="H" value={plot.h} min={1} max={grid.rows} onCommit={(v) => update({ h: Math.min(Math.max(v, 1), grid.rows) })} />
      </div>
      <div className="area-note">Plot area: {plot.w * plot.h * grid.unitPerCell * grid.unitPerCell} {grid.unit}²</div>
      <button
        className="secondary"
        onClick={() =>
          dispatch(
            selected
              ? { type: 'SELECT', itemType: null, id: null }
              : { type: 'SELECT', itemType: 'plot', id: 'plot' }
          )
        }
      >
        {selected ? 'Done — hide handles' : 'Resize on canvas'}
      </button>
    </div>
  )
}

function MultiPanel({ state, dispatch }) {
  const { grid } = state
  const rooms = state.selectedIds.map((id) => roomById(state.rooms, id)).filter(Boolean)
  if (rooms.length === 0) return null
  const minX = Math.min(...rooms.map((r) => r.x))
  const minY = Math.min(...rooms.map((r) => r.y))
  const maxX = Math.max(...rooms.map((r) => r.x + r.w))
  const maxY = Math.max(...rooms.map((r) => r.y + r.h))

  // Move the whole group so its top-left lands at (nx, ny), clamped to the grid.
  const moveTo = (nx, ny) => {
    let dx = nx - minX
    let dy = ny - minY
    for (const r of rooms) {
      dx = Math.min(Math.max(dx, -r.x), grid.cols - (r.x + r.w))
      dy = Math.min(Math.max(dy, -r.y), grid.rows - (r.y + r.h))
    }
    dispatch({
      type: 'UPDATE_ROOMS',
      changes: rooms.map((r) => ({ id: r.id, x: r.x + dx, y: r.y + dy })),
    })
  }

  return (
    <div className="panel">
      <h3>Selection</h3>
      <div className="area-note">{rooms.length} rooms selected — moved together</div>
      <div className="row">
        <NumberField label="X" value={minX} onCommit={(v) => moveTo(v, minY)} />
        <NumberField label="Y" value={minY} onCommit={(v) => moveTo(minX, v)} />
      </div>
      <div className="area-note">Extent: {maxX - minX} × {maxY - minY} {grid.unit}</div>
      <button className="secondary" onClick={() => dispatch({ type: 'DUPLICATE_SELECTED' })}>
        Duplicate {rooms.length} rooms (⌘/Ctrl+D)
      </button>
      <CopyToFloor state={state} dispatch={dispatch} ids={state.selectedIds} />
      <button className="danger" onClick={() => dispatch({ type: 'DELETE_ROOMS', ids: state.selectedIds })}>
        Delete {rooms.length} rooms
      </button>
    </div>
  )
}

function EdgeEditor({ state, dispatch, edge }) {
  const a = roomById(state.rooms, edge.a)
  const b = roomById(state.rooms, edge.b)
  return (
    <div className="panel">
      <h3>Connection</h3>
      <div className="area-note">{a ? a.name : '?'} ⟷ {b ? b.name : '?'}</div>
      <button className="danger" onClick={() => dispatch({ type: 'DELETE_EDGE', id: edge.id })}>
        Delete connection
      </button>
    </div>
  )
}

function GridEditor({ state, dispatch }) {
  const { grid } = state
  const update = (patch) => dispatch({ type: 'UPDATE_GRID', patch })
  return (
    <div className="panel">
      <h3>Grid</h3>
      <div className="row">
        <NumberField label="Cols" value={grid.cols} min={4} max={200} onCommit={(v) => update({ cols: Math.max(4, v) })} />
        <NumberField label="Rows" value={grid.rows} min={4} max={200} onCommit={(v) => update({ rows: Math.max(4, v) })} />
      </div>
      <div className="row">
        <NumberField label="Cell px" value={grid.cell} min={8} max={80} onCommit={(v) => update({ cell: Math.min(Math.max(v, 8), 80) })} />
        <NumberField label="Unit/cell" value={grid.unitPerCell} min={1} max={100} onCommit={(v) => update({ unitPerCell: Math.max(1, v) })} />
      </div>
      <label className="field">
        <span>Unit label</span>
        <CommitInput value={grid.unit} onCommit={(v) => update({ unit: v })} />
      </label>
    </div>
  )
}

function Health({ state }) {
  const floor = state.floors.find((f) => f.id === state.activeFloor)
  const fm = floorView(state, state.activeFloor)
  const r = analyze(fm)
  const issues = r.overlaps.length + r.outOfPlot.length + r.unsatisfied.length
  const solved = fm.edges.length > 0 && issues === 0
  return (
    <div className="panel health">
      <h3>Summary — {floor ? floor.name : ''}</h3>
      {solved ? (
        <div className="status solved">✓ All relationships satisfied</div>
      ) : (
        <div className="status todo">
          {issues} {issues === 1 ? 'issue' : 'issues'} to resolve on this floor
        </div>
      )}
      <ul>
        <li><span>Rooms (this floor)</span><b>{fm.rooms.length}</b></li>
        <li><span>Connections</span><b>{fm.edges.length}</b></li>
        <li className={r.overlaps.length ? 'warn' : ''}><span>Overlaps</span><b>{r.overlaps.length}</b></li>
        <li className={r.outOfPlot.length ? 'warn' : ''}><span>Out of plot</span><b>{r.outOfPlot.length}</b></li>
        <li className={r.unsatisfied.length ? 'warn' : ''}><span>Unsatisfied links</span><b>{r.unsatisfied.length}</b></li>
        <li><span>Plot area</span><b>{r.plotArea * state.grid.unitPerCell * state.grid.unitPerCell} {state.grid.unit}²</b></li>
        <li><span>Rooms area</span><b>{r.roomArea * state.grid.unitPerCell * state.grid.unitPerCell} {state.grid.unit}²</b></li>
        <li className={r.remainingArea < 0 ? 'warn' : ''}><span>Remaining</span><b>{r.remainingArea * state.grid.unitPerCell * state.grid.unitPerCell} {state.grid.unit}²</b></li>
        <li><span>House</span><b>{state.floors.length} {state.floors.length === 1 ? 'floor' : 'floors'} · {state.rooms.length} rooms</b></li>
      </ul>
    </div>
  )
}

// Manage the floor stack: switch, rename, reorder, duplicate, delete. Displayed
// top -> bottom (upper storeys first) so the list reads like a building section.
function FloorsPanel({ state, dispatch }) {
  const { floors, activeFloor } = state
  const roomCount = (id) => state.rooms.filter((r) => r.floor === id).length
  return (
    <div className="panel">
      <h3>Floors</h3>
      <div className="floor-list">
        {floors.slice().reverse().map((f) => {
          const i = floors.findIndex((x) => x.id === f.id)
          const active = f.id === activeFloor
          return (
            <div key={f.id} className={`floor-row ${active ? 'active' : ''}`}>
              <button
                className="floor-pick"
                title={active ? 'Editing this floor' : 'Edit this floor'}
                onClick={() => dispatch({ type: 'SET_ACTIVE_FLOOR', id: f.id })}
              >
                {active ? '✎' : '○'}
              </button>
              <CommitInput value={f.name} onCommit={(v) => dispatch({ type: 'RENAME_FLOOR', id: f.id, name: v })} />
              <div className="floor-ops">
                <button title="Move up" disabled={i === floors.length - 1} onClick={() => dispatch({ type: 'MOVE_FLOOR', id: f.id, dir: 1 })}>↑</button>
                <button title="Move down" disabled={i === 0} onClick={() => dispatch({ type: 'MOVE_FLOOR', id: f.id, dir: -1 })}>↓</button>
                <button title="Duplicate floor (rooms + connections)" onClick={() => dispatch({ type: 'DUPLICATE_FLOOR', id: f.id })}>⧉</button>
                <button
                  title="Delete floor"
                  className="danger-op"
                  disabled={floors.length <= 1}
                  onClick={() => {
                    if (confirm(`Delete "${f.name}" and its ${roomCount(f.id)} room(s)?`)) {
                      dispatch({ type: 'DELETE_FLOOR', id: f.id })
                    }
                  }}
                >✕</button>
              </div>
            </div>
          )
        })}
      </div>
      <button className="secondary" onClick={() => dispatch({ type: 'ADD_FLOOR' })}>+ Add floor</button>
    </div>
  )
}

export default function Sidebar({ state, dispatch }) {
  const { selection } = state
  let selPanel = null
  if (selection.type === 'multi') {
    selPanel = <MultiPanel state={state} dispatch={dispatch} />
  } else if (selection.type === 'room') {
    const room = roomById(state.rooms, selection.id)
    if (room) selPanel = <RoomEditor state={state} dispatch={dispatch} room={room} />
  } else if (selection.type === 'plot') {
    selPanel = <PlotEditor state={state} dispatch={dispatch} />
  } else if (selection.type === 'edge') {
    const edge = state.edges.find((e) => e.id === selection.id)
    if (edge) selPanel = <EdgeEditor state={state} dispatch={dispatch} edge={edge} />
  }

  return (
    <aside className="sidebar">
      {selPanel || (
        <div className="panel hint">
          <h3>No selection</h3>
          <p>Goal: move and resize rooms until every connection is satisfied (connected
          rooms share a wall), with no overlaps and all rooms inside the plot.</p>
          <p>Click a room, connection, or the plot to edit it. Use the toolbar to draw
          rooms and connections.</p>
        </div>
      )}
      <Health state={state} />
      <FloorsPanel state={state} dispatch={dispatch} />
      <GridEditor state={state} dispatch={dispatch} />
      {selection.type !== 'plot' && <PlotEditor state={state} dispatch={dispatch} />}
    </aside>
  )
}
