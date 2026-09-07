import React, { useState, useEffect } from 'react'
import { analyze, roomById, floorView } from '../model/graph.js'
import { PALETTE } from '../store/initialState.js'
import { fmtLen, fmtArea, unitsOf } from '../utils/physical.js'

// Input that only commits its value on Enter or blur (Esc cancels). It keeps a
// local draft while typing so edits aren't applied on every keystroke, and
// re-syncs when the underlying value changes (e.g. from dragging on the canvas).
function CommitInput({ value, type = 'text', min, max, step, float = false, placeholder, disabled = false, title, onCommit }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = () => {
    if (type === 'number') {
      const v = float ? parseFloat(draft) : parseInt(draft, 10)
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
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      title={title}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commit(); e.currentTarget.blur() }
        else if (e.key === 'Escape') { cancel(); e.currentTarget.blur() }
      }}
      onBlur={commit}
    />
  )
}

function NumberField({ label, value, min, max, step, float, disabled, title, onCommit }) {
  return (
    <label className="field">
      <span>{label}</span>
      <CommitInput type="number" value={value} min={min} max={max} step={step} float={float} disabled={disabled} title={title} onCommit={onCommit} />
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
  // A dimension bound to a size variable is locked (the variable owns it).
  const wBound = (state.bindings || []).some((b) => b.room === room.id && b.dim === 'w')
  const hBound = (state.bindings || []).some((b) => b.room === room.id && b.dim === 'h')

  return (
    <div className="panel">
      <h3>Room</h3>
      <label className="field">
        <span>Name</span>
        <CommitInput value={room.name} onCommit={(v) => update({ name: v })} />
      </label>
      <div className="row">
        <NumberField label="X" value={room.x} min={plot.x} max={maxX}
          disabled={wBound} title={wBound ? 'Position is locked: width is set by a size variable' : undefined}
          onCommit={(v) => update({ x: Math.min(Math.max(v, plot.x), maxX) })} />
        <NumberField label="Y" value={room.y} min={plot.y} max={maxY}
          disabled={hBound} title={hBound ? 'Position is locked: depth is set by a size variable' : undefined}
          onCommit={(v) => update({ y: Math.min(Math.max(v, plot.y), maxY) })} />
      </div>
      <div className="row">
        <NumberField label="W" value={room.w} min={1} max={maxW}
          disabled={wBound} title={wBound ? 'Width is set by a size variable' : undefined}
          onCommit={(v) => update({ w: Math.min(Math.max(v, 1), maxW) })} />
        <NumberField label="H" value={room.h} min={1} max={maxH}
          disabled={hBound} title={hBound ? 'Depth is set by a size variable' : undefined}
          onCommit={(v) => update({ h: Math.min(Math.max(v, 1), maxH) })} />
      </div>
      <div className="area-note">{(() => { const u = unitsOf(state.build); return `${fmtLen(room.w, u.system, u.perUnit)} × ${fmtLen(room.h, u.system, u.perUnit)}` })()}</div>
      <div className="dim-configs">
        <DimConfig state={state} dispatch={dispatch} room={room} dim="w" />
        <DimConfig state={state} dispatch={dispatch} room={room} dim="h" />
      </div>
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
  const step = grid.unitPerCell || 10
  const maxW = grid.cols * step, maxH = grid.rows * step
  return (
    <div className="panel">
      <h3>Plot</h3>
      <div className="area-note">Origin fixed at 0, 0 · project units</div>
      <div className="row">
        <NumberField label="W" value={plot.w} min={step} max={maxW} step={step} float onCommit={(v) => update({ w: Math.min(Math.max(v, step), maxW) })} />
        <NumberField label="H" value={plot.h} min={step} max={maxH} step={step} float onCommit={(v) => update({ h: Math.min(Math.max(v, step), maxH) })} />
      </div>
      <div className="area-note">{(() => { const u = unitsOf(state.build); return `Plot: ${fmtLen(plot.w, u.system, u.perUnit)} × ${fmtLen(plot.h, u.system, u.perUnit)} · ${fmtArea(plot.w * plot.h, u.system, u.perUnit)}` })()}</div>
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
  const step = grid.unitPerCell || 10
  const moveTo = (nx, ny) => {
    let dx = nx - minX
    let dy = ny - minY
    for (const r of rooms) {
      dx = Math.min(Math.max(dx, -r.x), grid.cols * step - (r.x + r.w))
      dy = Math.min(Math.max(dy, -r.y), grid.rows * step - (r.y + r.h))
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
      <div className="area-note">{(() => { const u = unitsOf(state.build); return `Extent: ${fmtLen(maxX - minX, u.system, u.perUnit)} × ${fmtLen(maxY - minY, u.system, u.perUnit)}` })()}</div>
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
  const kind = edge.kind || 'door'
  const setKind = (k) => dispatch({ type: 'SET_EDGE_KIND', id: edge.id, kind: k })
  return (
    <div className="panel">
      <h3>Connection</h3>
      <div className="area-note">Flow: {a ? a.name : '?'} → {b ? b.name : '?'}</div>
      <button
        onClick={() => dispatch({ type: 'REVERSE_EDGE', id: edge.id })}
        title="Flip the direction of flow (swap from and to)"
        style={{ marginTop: 4 }}
      >⇄ Reverse direction</button>
      <label className="field"><span>Shared wall</span></label>
      <div className="row" role="radiogroup" aria-label="Connection kind">
        <button
          className={kind === 'door' ? 'seg on' : 'seg'}
          onClick={() => setKind('door')}
          title="A wall with a door centred on the shared segment"
        >🚪 Door</button>
        <button
          className={kind === 'open' ? 'seg on' : 'seg'}
          onClick={() => setKind('open')}
          title="No wall on the shared side — the rooms flow together"
        >↔ Open</button>
      </div>
      <p className="area-note" style={{ marginTop: 6 }}>
        {kind === 'door'
          ? 'Exports as a wall with a centred door on the shared side.'
          : 'Exports with no wall on the shared side (open passage).'}
      </p>
      <button className="danger" onClick={() => dispatch({ type: 'DELETE_EDGE', id: edge.id })} style={{ marginTop: 8 }}>
        Delete connection
      </button>
    </div>
  )
}

const UNIT_ABBR = { feet_inches: 'ft', feet: 'ft', meters: 'm', centimeters: 'cm', millimeters: 'mm' }

function DimensionsEditor({ state, dispatch }) {
  const b = state.build || {}
  const set = (patch) => dispatch({ type: 'UPDATE_BUILD', patch })
  const system = b.unitSystem || 'feet_inches'
  const unit = UNIT_ABBR[system] || 'ft'
  return (
    <div className="panel">
      <h3>Dimensions (export)</h3>
      <p className="area-note">All sizes are in project units. Wadi shows them as {unit} ({b.perUnit ?? 10} units = 1 {unit}).</p>
      <label className="field">
        <span>Display units</span>
        <select value={system} onChange={(e) => set({ unitSystem: e.target.value })}>
          <option value="feet_inches">Feet &amp; inches</option>
          <option value="feet">Feet (decimal)</option>
          <option value="meters">Meters</option>
          <option value="centimeters">Centimeters</option>
          <option value="millimeters">Millimeters</option>
        </select>
      </label>
      <NumberField
        label={`Project units / ${unit} (scale)`}
        value={b.perUnit ?? 10} min={0.001} max={1000} step={1} float
        onCommit={(v) => set({ perUnit: v > 0 ? v : 10 })}
      />
      <div className="row">
        <NumberField label="Wall thick" value={b.wallThickness ?? 8} min={1} max={60} step={1} float
          onCommit={(v) => set({ wallThickness: Math.max(1, v) })} />
        <NumberField label="Wall height" value={b.wallHeight ?? 100} min={20} max={400} step={5} float
          onCommit={(v) => set({ wallHeight: Math.max(20, v) })} />
      </div>
      <div className="row">
        <NumberField label="Slab thick" value={b.slabThickness ?? 6} min={1} max={60} step={1} float
          onCommit={(v) => set({ slabThickness: Math.max(1, v) })} />
        <NumberField label="Plinth height" value={b.plinthHeight ?? 30} min={2} max={300} step={5} float
          onCommit={(v) => set({ plinthHeight: Math.max(2, v) })} />
      </div>
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
        <NumberField label="Units/cell" value={grid.unitPerCell} min={1} max={1000} step={1} float onCommit={(v) => update({ unitPerCell: Math.max(1, v) })} />
      </div>
    </div>
  )
}

function Health({ state }) {
  const U = unitsOf(state.build)
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
        <li><span>Plot area</span><b>{fmtArea(r.plotArea, U.system, U.perUnit)}</b></li>
        <li><span>Rooms area</span><b>{fmtArea(r.roomArea, U.system, U.perUnit)}</b></li>
        <li className={r.remainingArea < 0 ? 'warn' : ''}><span>Remaining</span><b>{fmtArea(r.remainingArea, U.system, U.perUnit)}</b></li>
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

// Guides & bays: name a bay (the span between two guide lines) and tick it editable to
// expose it as a configurator knob on export. Naming/flagging a bay locks (makes
// permanent) its two bounding guide lines. Guides themselves are derived from the room
// edges; a manual guide is added on the canvas.
// Per-room control to make a dimension (width/depth) configurable: create a new size
// variable, share ANY existing one (a size is a pure length, so a depth on one wall can
// drive a width on another — e.g. a balcony band wrapping a corner), or make it fixed.
function DimConfig({ state, dispatch, room, dim }) {
  const bindings = state.bindings || []
  const vars = state.variables || []
  const binding = bindings.find((b) => b.room === room.id && b.dim === dim)
  const label = dim === 'w' ? 'Width' : 'Depth'
  if (binding) {
    const v = vars.find((x) => x.name === binding.var)
    const shareCount = bindings.filter((b) => b.var === binding.var).length
    return (
      <div className="dim-config bound">
        <span className="dim-label">{label}</span>
        <span className="knob-dot" title="Configurable — a homeowner knob">◆</span>
        <CommitInput
          value={v?.label || binding.var}
          onCommit={(val) => dispatch({ type: 'RENAME_VAR', name: binding.var, newName: val })}
        />
        {shareCount > 1 && <span className="share-note" title={`Shared by ${shareCount} dimensions`}>×{shareCount}</span>}
        <button className="icon" title="Make fixed again" onClick={() => dispatch({ type: 'UNBIND_DIM', room: room.id, dim })}>✕</button>
      </div>
    )
  }
  return (
    <div className="dim-config">
      <span className="dim-label">{label}</span>
      <button
        className="secondary sm"
        title="Expose this size as a homeowner knob"
        onClick={() => dispatch({ type: 'BIND_DIM', room: room.id, dim })}
      >
        Make configurable
      </button>
      {vars.length > 0 && (
        <select
          value=""
          title="Reuse an existing size (resizes this room to match; they move together). Any size can drive a width or a depth."
          onChange={(e) => { if (e.target.value) dispatch({ type: 'BIND_DIM', room: room.id, dim, varName: e.target.value }) }}
        >
          <option value="">share…</option>
          {vars.map((v) => <option key={v.name} value={v.name}>{v.label || v.name}</option>)}
        </select>
      )}
    </div>
  )
}

// Global list of size variables: rename, see the live value + how many dimensions each
// drives, and delete. A configurable house (with a configurator) exports from these.
function SizesPanel({ state, dispatch }) {
  const { system, perUnit } = unitsOf(state.build)
  const vars = state.variables || []
  const mode = state.build?.sizeMode || 'fixed'
  const step = state.grid?.unitPerCell || 10
  return (
    <div className="panel">
      <h3>Sizes</h3>
      <p className="area-note">
        Bind a room’s width or depth to a named size (select a room, “Make configurable”) to
        expose it as a homeowner knob. Reuse one size across rooms to resize them together.
      </p>
      <div className="size-mode" role="radiogroup" aria-label="How a size change reflows the plan">
        <label className={mode === 'fixed' ? 'active' : ''} title="Keep the plot size; re-flow the other rooms to fit">
          <input type="radio" name="sizeMode" checked={mode === 'fixed'} onChange={() => dispatch({ type: 'UPDATE_BUILD', patch: { sizeMode: 'fixed' } })} />
          Fixed plot
        </label>
        <label className={mode === 'elastic' ? 'active' : ''} title="Keep the other rooms; resize the plot to fit">
          <input type="radio" name="sizeMode" checked={mode === 'elastic'} onChange={() => dispatch({ type: 'UPDATE_BUILD', patch: { sizeMode: 'elastic' } })} />
          Fit plot
        </label>
      </div>
      <p className="area-note dim">
        {mode === 'fixed'
          ? 'Changing a size keeps the plot and re-flows the other rooms.'
          : 'Changing a size keeps the other rooms and resizes the plot to fit.'}
      </p>
      {vars.length === 0 && <p className="area-note dim">No configurable sizes yet.</p>}
      {vars.map((v) => {
        const binds = (state.bindings || []).filter((b) => b.var === v.name)
        return (
          <div className="size-row" key={v.name}>
            <span className="knob-dot">◆</span>
            <CommitInput value={v.label || v.name} onCommit={(val) => dispatch({ type: 'RENAME_VAR', name: v.name, newName: val })} />
            <CommitInput type="number" value={v.value} min={step} step={step} float
              title={`Value in project units (${fmtLen(v.value, system, perUnit)}). Editing re-flows the plan.`}
              onCommit={(val) => dispatch({ type: 'SET_VAR_VALUE', name: v.name, value: val })} />
            <span className="size-count" title="Rooms driven by this size">×{binds.length}</span>
            <button className="icon" title="Delete size (rooms keep their current dimensions)" onClick={() => dispatch({ type: 'DELETE_VAR', name: v.name })}>✕</button>
          </div>
        )
      })}
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
      <SizesPanel state={state} dispatch={dispatch} />
      <GridEditor state={state} dispatch={dispatch} />
      <DimensionsEditor state={state} dispatch={dispatch} />
      {selection.type !== 'plot' && <PlotEditor state={state} dispatch={dispatch} />}
    </aside>
  )
}
