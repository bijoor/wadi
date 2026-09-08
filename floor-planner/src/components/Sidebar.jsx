import React, { useState, useEffect } from 'react'
import { analyze, roomById, floorView } from '../model/graph.js'
import { PALETTE } from '../store/initialState.js'
import { fmtLen, fmtArea, unitsOf } from '../utils/physical.js'
import { ROOM_TYPES } from '../export/roomModules.js'
import { wouldFullyFixGroup } from '../model/spanReflow.js'

// The id of the guide line sitting at position `at` on an axis (room edges always land on a
// guide, since guides are derived from room edges).
const guideIdAt = (lines, at) => { const g = (lines || []).find((l) => Math.abs(l.at - at) < 1e-3); return g && g.id }

// A safe variable identifier from a free-text name: "Balcony band" -> "balcony_band".
const slug = (label) => {
  let s = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!s) s = 'size'
  if (!/^[a-z_]/.test(s)) s = 'v_' + s
  return s
}

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

  // A room's width/depth is the SPAN between its two edge guides on that axis. Its SIZING mode
  // sets that span's policy: Auto (no span — flexes proportionally with the rest), Fix (a
  // fixed size that holds while the others re-flow, or the plot grows), or Ratio (an explicit
  // flex weight, so two dimensions share their space in a set ratio). A span across interior
  // guides is a group automatically. Editing any of these re-flows the plan live.
  const gx = state.guides?.x || [], gy = state.guides?.y || []
  const u = unitsOf(state.build)
  const dims = {
    w: { axis: 'x', lo: guideIdAt(gx, room.x), hi: guideIdAt(gx, room.x + room.w), size: room.w },
    h: { axis: 'y', lo: guideIdAt(gy, room.y), hi: guideIdAt(gy, room.y + room.h), size: room.h },
  }
  const spanOf = (axis, lo, hi) => (lo && hi && (state.spans?.[axis] || []).find((s) => s.lo === lo && s.hi === hi)) || null
  const setSpan = (axis, lo, hi, policy) => dispatch({ type: 'SET_SPAN', axis, lo, hi, policy })
  const varNames = Object.keys(state.variables || {})

  // A unique auto name for a room's dimension variable ("Living width" -> living_width).
  const autoName = (dim) => {
    const base = slug(`${room.name} ${dim === 'w' ? 'width' : 'depth'}`)
    let name = base, k = 1
    while (varNames.includes(name)) { k += 1; name = `${base}_${k}` }
    return name
  }

  const SizingRow = ({ label, dim }) => {
    const { axis, lo, hi, size } = dims[dim]
    const can = !!(lo && hi && lo !== hi)
    const span = spanOf(axis, lo, hi)
    // Two modes: Auto (no span — flexes proportionally with the rest) or Fix (a named
    // variable that holds while the others re-flow, sharable across rooms).
    const mode = span && span.policy.kind === 'fixed' ? 'fixed' : 'auto'
    const linkedVar = mode === 'fixed' ? span.policy.var : null
    const mkAuto = () => autoName(dim)
    const setMode = (m) => setSpan(axis, lo, hi, m === 'fixed' ? { kind: 'fixed', var: mkAuto() } : null)
    // A fixed group must keep an Auto segment; block Fix if it would fully-constrain a group.
    const blockFix = mode !== 'fixed' && can && wouldFullyFixGroup(state.guides?.[axis] || [], state.spans?.[axis] || [], lo, hi)
    const Seg = ({ m, children }) => (
      <button type="button" className={mode === m ? 'on' : ''}
        disabled={(!can && m !== 'auto') || (m === 'fixed' && blockFix)}
        title={m === 'fixed' && blockFix ? 'A fixed group needs at least one Auto segment to absorb changes — leave one of the segments Auto' : undefined}
        onClick={() => setMode(m)}>{children}</button>
    )
    // Pick which variable drives this fixed size: an existing one (share it), a fresh own one,
    // or a newly named shared one. So one knob can drive a width here and a depth elsewhere.
    const onLink = (v) => {
      if (v === '__new__') { const n = window.prompt('New shared size name (e.g. balcony):'); if (n && n.trim()) setSpan(axis, lo, hi, { kind: 'fixed', var: slug(n) }) }
      else if (v === '__own__') setSpan(axis, lo, hi, { kind: 'fixed', var: mkAuto() })
      else if (v && v !== linkedVar) setSpan(axis, lo, hi, { kind: 'fixed', var: v })
    }
    return (
      <>
        <div className="sizing-row">
          <span className="dim-label">{label}</span>
          <div className="seg">
            <Seg m="auto">Auto</Seg><Seg m="fixed">Fix</Seg>
          </div>
          <CommitInput type="number" value={linkedVar ? (state.variables[linkedVar]?.value ?? size) : size} min={1}
            onCommit={(v) => mode === 'fixed' && linkedVar ? dispatch({ type: 'SET_VAR', name: linkedVar, value: Math.max(v, 1) }) : update({ [dim]: Math.max(v, 1) })} />
        </div>
        {mode === 'fixed' && (
          <div className="sizing-row link">
            <span className="dim-label" />
            <select className="varlink" value={linkedVar || ''} title="The size variable this dimension is bound to. Pick another to share, or make a new one."
              onChange={(e) => onLink(e.target.value)}>
              {varNames.map((nm) => <option key={nm} value={nm}>◆ {nm}</option>)}
              <option value="__own__">Separate (own size)</option>
              <option value="__new__">New shared size…</option>
            </select>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="panel">
      <h3>Room</h3>
      <label className="field">
        <span>Name</span>
        <CommitInput value={room.name} onCommit={(v) => update({ name: v })} />
      </label>
      <div className="row">
        <NumberField label="X" value={room.x} min={plot.x} max={maxX}
          onCommit={(v) => update({ x: Math.min(Math.max(v, plot.x), maxX) })} />
        <NumberField label="Y" value={room.y} min={plot.y} max={maxY}
          onCommit={(v) => update({ y: Math.min(Math.max(v, plot.y), maxY) })} />
      </div>
      <div className="sizing">
        <SizingRow label="Width" dim="w" />
        <SizingRow label="Depth" dim="h" />
      </div>
      <label className="field">
        <span>Type</span>
        <select value={room.roomType || ''} title="Furnish this room on export (a prebuilt module drops in furniture that reflows with the room)"
          onChange={(e) => update({ roomType: e.target.value })}>
          {ROOM_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </label>
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
      <div className="row">
        <NumberField label="Door width" value={b.doorWidth ?? 25} min={6} max={120} step={1} float
          onCommit={(v) => set({ doorWidth: Math.max(6, v) })} />
        <NumberField label="Door height" value={b.doorHeight ?? 70} min={20} max={300} step={5} float
          onCommit={(v) => set({ doorHeight: Math.max(20, v) })} />
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

// All shared size variables: name (rename), value (edits + re-flows every bound room), how
// many dimensions each drives, and delete (bound dimensions revert to Auto). These are the
// homeowner knobs the export ships as a configurator.
function VariablesPanel({ state, dispatch }) {
  const vars = state.variables || {}
  const names = Object.keys(vars)
  if (!names.length) return null
  const { system, perUnit } = unitsOf(state.build)
  const count = {}
  for (const ax of ['x', 'y']) for (const s of state.spans?.[ax] || []) if (s.policy?.var) count[s.policy.var] = (count[s.policy.var] || 0) + 1
  return (
    <div className="panel">
      <h3>Sizes</h3>
      <p className="area-note dim">Named sizes you’ve pinned. Reuse one across rooms (Fix a dimension, pick it) to move them together; editing a value re-flows the plan.</p>
      {names.map((name) => (
        <div className="size-row" key={name}>
          <span className="knob-dot">◆</span>
          <CommitInput value={name} title="Rename this size" onCommit={(v) => dispatch({ type: 'RENAME_VAR', name, newName: v })} />
          <CommitInput type="number" value={vars[name].value} min={1} title={`Value (${fmtLen(vars[name].value, system, perUnit)}). Editing re-flows every room bound to it.`}
            onCommit={(v) => dispatch({ type: 'SET_VAR', name, value: Math.max(v, 1) })} />
          <span className="size-count" title="Dimensions driven by this size">×{count[name] || 0}</span>
          <button className="icon" title="Delete (bound dimensions revert to Auto)" onClick={() => dispatch({ type: 'DELETE_VAR', name })}>✕</button>
        </div>
      ))}
    </div>
  )
}

// Guides & bays: name a bay (the span between two guide lines) and tick it editable to
// expose it as a configurator knob on export. Naming/flagging a bay locks (makes
// permanent) its two bounding guide lines. Guides themselves are derived from the room
// edges; a manual guide is added on the canvas.
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
      <VariablesPanel state={state} dispatch={dispatch} />
      <FloorsPanel state={state} dispatch={dispatch} />
      <GridEditor state={state} dispatch={dispatch} />
      <DimensionsEditor state={state} dispatch={dispatch} />
      {selection.type !== 'plot' && <PlotEditor state={state} dispatch={dispatch} />}
    </aside>
  )
}
