// Room-layout authoring tool. It reads and writes the LIBRARY (src/store/layoutLibrary.js) — the
// live source the planner also reads — so an edit here shows up in the planner's furniture preview
// and .wadi export immediately, no rebuild. Leaving a room (or deleting one) persists to the
// library automatically; "Save rooms.wdl" (⌘S) exports the library's diff back to the pack file.
import React, { useReducer, useRef, useEffect } from 'react'
import CATALOG from '../export/furnitureCatalog.json'
import ROOMS_SOURCE from '../export/roomsSource.js'
import { validateLayout } from 'wadi-autoplace'
import { anchorFacing, anchorPoints, gapForCenter } from 'wadi-anchor'
import { unitsPerMeter } from 'wadi-units'
import { emitRoomBlock, applyLayoutEdits, layoutName } from '../export/layoutWdl.js'
import {
  libraryLayouts, libraryState, isLibraryDirty, libraryEdits,
  upsertLayout, removeLayout, resetLibrary, layoutFromDraft, draftFromLayout,
} from '../store/layoutLibrary.js'

const UNITS = { system: 'feet_inches', per_unit: 10 }
const WALLT = 8
const SIZE_STEP = 10
const ANCHORS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]
const r0 = (n) => Math.round(Number(n) || 0)
const emptyDraft = () => ({ type: '', variant: '', w: 100, h: 100, height: '', pieces: [] })

// A number input you can actually clear and edit: it keeps its own text while focused (so an
// empty field or a partial "-" doesn't snap back to 0), commits a valid number as you type, and
// resyncs to the model value on blur. `min` clamps on commit.
function NumField({ value, onCommit, min, step, title }) {
  const [str, setStr] = React.useState(String(value))
  const focused = React.useRef(false)
  React.useEffect(() => { if (!focused.current) setStr(String(value)) }, [value])
  return (
    <input type="number" step={step} title={title} value={str}
      onFocus={() => { focused.current = true }}
      onBlur={() => { focused.current = false; setStr(String(value)) }}
      onChange={(e) => {
        setStr(e.target.value)
        if (e.target.value === '' || e.target.value === '-') return
        const n = Number(e.target.value)
        if (Number.isFinite(n)) onCommit(min != null ? Math.max(n, min) : n)
      }} />
  )
}

function download(name, text) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function reducer(s, a) {
  switch (a.type) {
    case 'LIBRARY': return { ...s, view: 'library', selected: null, picker: false, dirty: false }
    case 'NEW': return { ...s, view: 'editor', draft: emptyDraft(), selected: null, picker: false, dirty: false }
    case 'EDIT': return { ...s, view: 'editor', draft: a.draft, selected: null, picker: false, dirty: false }
    case 'REFRESH': return { ...s }
    case 'META': return { ...s, draft: { ...s.draft, ...a.patch }, dirty: true }
    case 'ADD_PIECE': {
      const pieces = [...s.draft.pieces, { asset: a.asset, anchor: 'center', gap_x: 0, gap_y: 0, rotation: 0 }]
      return { ...s, draft: { ...s.draft, pieces }, selected: pieces.length - 1, picker: false, dirty: true }
    }
    case 'UPDATE_PIECE': {
      const pieces = s.draft.pieces.map((p, i) => (i === a.index ? { ...p, ...a.patch } : p))
      return { ...s, draft: { ...s.draft, pieces }, dirty: true }
    }
    case 'SET_ANCHOR': {
      // Moving a piece to a new anchor resets its gap and, if it was facing per its (old) wall's
      // default, re-faces it into the room from the new wall — matching the pipeline. A custom
      // rotation the author set is kept.
      const p = s.draft.pieces[a.index]
      const wasDefault = (p.rotation ?? anchorFacing(p.anchor)) === anchorFacing(p.anchor)
      const rotation = wasDefault ? anchorFacing(a.anchor) : p.rotation
      const pieces = s.draft.pieces.map((pp, i) => (i === a.index ? { ...pp, anchor: a.anchor, gap_x: 0, gap_y: 0, rotation } : pp))
      return { ...s, draft: { ...s.draft, pieces }, dirty: true }
    }
    case 'DELETE_PIECE': return { ...s, draft: { ...s.draft, pieces: s.draft.pieces.filter((_, i) => i !== a.index) }, selected: null, dirty: true }
    case 'SELECT': return { ...s, selected: a.index }
    case 'PICKER': return { ...s, picker: a.open }
    default: return s
  }
}

// A draft is valid when no piece overlaps another or pokes outside the inner wall face — the same
// check as check-room-layouts. Invalid layouts are never persisted (see flush).
function draftValid(d) {
  const room = { x: 0, y: 0, w: Math.max(d.w, 1), h: Math.max(d.h, 1), l: Math.max(d.h, 1) }
  const { flags } = validateLayout(d.pieces, room, WALLT, UNITS)
  return !flags.some((f) => f.overlap || f.oob.length)
}

export default function LayoutEditor({ onClose }) {
  const [s, dispatch] = useReducer(reducer, undefined, () => ({ view: 'library', draft: emptyDraft(), selected: null, picker: false, dirty: false }))
  const valid = s.view !== 'editor' || draftValid(s.draft)

  // Persist the current draft to the library — only when VALID, so an overlapping / out-of-bounds
  // layout is never saved to the library or exported.
  const flush = () => {
    if (s.view === 'editor' && s.dirty && s.draft.type && s.draft.variant && valid) upsertLayout(layoutFromDraft(s.draft))
  }
  const doSave = () => { flush(); download('rooms.wdl', applyLayoutEdits(ROOMS_SOURCE, libraryEdits())) }
  const goLibrary = () => { flush(); dispatch({ type: 'LIBRARY' }) }

  // ⌘S / Ctrl+S exports rooms.wdl (flushing the open room first).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // re-registered each render so it closes over the current draft

  if (s.view === 'library') return <Library dispatch={dispatch} onClose={onClose} doSave={doSave} />
  return <Editor s={s} dispatch={dispatch} goLibrary={goLibrary} valid={valid} />
}

function Library({ dispatch, onClose, doSave }) {
  const layouts = libraryLayouts()
  const { overrideIds, builtinIds } = libraryState()
  const dirty = isLibraryDirty()
  const pending = libraryEdits().length
  const badgeOf = (l) => (builtinIds.has(l.id) ? (overrideIds.has(l.id) ? 'edited' : null) : 'new')

  return (
    <div className="layout-lib">
      <div className="lib-head">
        <h2>Room layouts <span className="dim">({layouts.length})</span></h2>
        <div>
          {dirty && <button onClick={() => { resetLibrary(); dispatch({ type: 'REFRESH' }) }} title="Revert the library to the built-in pack">Reset</button>}
          <button className="primary" disabled={!dirty} onClick={doSave} title="Export the whole rooms.wdl with your changes (⌘S)">💾 Save rooms.wdl</button>
          <button className="primary" onClick={() => dispatch({ type: 'NEW' })}>+ New room</button>
          <button onClick={onClose} title="Back to the floor planner">← Planner</button>
        </div>
      </div>
      <table className="lib-table">
        <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Items</th><th></th><th></th></tr></thead>
        <tbody>
          {layouts.map((l) => {
            const badge = badgeOf(l)
            const open = () => dispatch({ type: 'EDIT', draft: draftFromLayout(l) })
            return (
              <tr key={l.id} className={badge === 'new' ? 'is-new' : ''}>
                <td className="mono" onClick={open} title="Edit">{l.id}</td>
                <td onClick={open}>{l.type}</td>
                <td onClick={open}>{l.w}×{l.h}</td>
                <td onClick={open}>{l.pieces.length}</td>
                <td>{badge && <span className={`badge ${badge}`}>{badge}</span>}</td>
                <td><button className="icon" title="Delete this layout" onClick={() => { removeLayout(l.id); dispatch({ type: 'REFRESH' }) }}>✕</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="dim small">Edits are live: they take effect in the planner's furniture preview and export right away.
        {pending > 0 && <> {pending} pending in the library.</>} <b>Save rooms.wdl</b> (⌘S) writes them back to the pack —
        drop the file into wadi-dsl/std-modules/rooms.wdl and run <code>npm run build-layouts</code> to make them the new built-in default.</p>
    </div>
  )
}

const VW = 620, VH = 470, PAD = 40

function Editor({ s, dispatch, goLibrary, valid }) {
  const d = s.draft
  const room = { x: 0, y: 0, w: Math.max(d.w, 1), h: Math.max(d.h, 1), l: Math.max(d.h, 1) }
  const sc = Math.min((VW - 2 * PAD) / room.w, (VH - 2 * PAD) / room.h)
  const ox = (VW - room.w * sc) / 2, oy = (VH - room.h * sc) / 2
  const X = (u) => ox + u * sc, Y = (u) => oy + u * sc, L = (u) => u * sc
  const upm = unitsPerMeter(UNITS) // project units per metre, for the true footprint dims
  const { rects, flags, overlaps, oob } = validateLayout(d.pieces, room, WALLT, UNITS)
  const anchors = anchorPoints(room, WALLT)
  const nameOf = (i) => d.pieces[i]?.asset?.name || `piece ${i + 1}`
  const SIDEWORD = { W: 'left', E: 'right', N: 'top', S: 'bottom' }
  // Human-readable issue lines: which pieces overlap (and by how much), which stick out of a wall.
  const issues = [
    ...overlaps.map((o) => `${nameOf(o.a)} overlaps ${nameOf(o.b)} (by ${o.ox}×${o.oy})`),
    ...oob.map((e) => `${nameOf(e.i)} sticks out past the ${e.sides.map((s) => `${SIDEWORD[s.side]} wall (${s.by})`).join(', ')}`),
  ]
  const drag = useRef(null)

  const onDown = (e, i) => {
    e.stopPropagation()
    dispatch({ type: 'SELECT', index: i })
    const r = rects[i]
    drag.current = { i, sx: e.clientX, sy: e.clientY, cx: r.cx, cy: r.cy, halfX: r.halfX, halfY: r.halfY, anchor: d.pieces[i].anchor }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    const g = drag.current
    if (!g) return
    const cx = g.cx + (e.clientX - g.sx) / sc
    const cy = g.cy + (e.clientY - g.sy) / sc
    const gap = gapForCenter(g.anchor, cx, cy, g.halfX, g.halfY, room, WALLT)
    dispatch({ type: 'UPDATE_PIECE', index: g.i, patch: { gap_x: r0(gap.gap_x), gap_y: r0(gap.gap_y) } })
  }
  const onUp = () => { drag.current = null }

  return (
    <div className="layout-editor">
      <div className="le-canvas">
        <svg width={VW} height={VH} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          onPointerDown={() => dispatch({ type: 'SELECT', index: null })}>
          <rect x={X(0)} y={Y(0)} width={L(room.w)} height={L(room.h)} className="le-room" />
          <rect x={X(WALLT)} y={Y(WALLT)} width={L(room.w - 2 * WALLT)} height={L(room.h - 2 * WALLT)} className="le-inner" />
          {Object.entries(anchors).map(([name, p]) => (
            <circle key={name} cx={X(p.x)} cy={Y(p.y)} r={3} className="le-anchor"
              onPointerDown={(e) => { e.stopPropagation(); if (s.selected != null) dispatch({ type: 'SET_ANCHOR', index: s.selected, anchor: name }) }}>
              <title>{name}</title>
            </circle>
          ))}
          {d.pieces.map((p, i) => {
            const r = rects[i]
            const bad = flags[i].overlap || flags[i].oob.length
            const cls = `le-piece${bad ? ' bad' : ''}${s.selected === i ? ' sel' : ''}`
            const cx = X(r.cx), cy = Y(r.cy)
            const yaw = (((p.rotation % 360) + 360) % 360)
            // True oriented footprint (unrotated dims) rotated about the centre, so an arbitrary
            // angle shows a tilted rectangle — not just the bounding box.
            const fw = L((p.asset.dimensions?.[0] || 0) * upm)
            const fd = L((p.asset.dimensions?.[2] || 0) * upm)
            // facing vector for yaw (0=south, 90=east, 180=north, 270=west): (sin θ, cos θ)
            const th = yaw * Math.PI / 180
            const facing = [Math.sin(th), Math.cos(th)]
            const reach = Math.min(fw, fd) * 0.4
            return (
              <g key={i} onPointerDown={(e) => onDown(e, i)} style={{ cursor: 'move' }}>
                <rect x={cx - fw / 2} y={cy - fd / 2} width={fw} height={fd} transform={`rotate(${yaw} ${cx} ${cy})`} className={cls} />
                <line x1={cx} y1={cy} x2={cx + facing[0] * reach} y2={cy + facing[1] * reach} className="le-facing" />
                <text x={cx} y={cy} className="le-label">{p.asset.name}</text>
              </g>
            )
          })}
        </svg>
        <div className={`le-status ${issues.length ? 'bad' : 'ok'}`}>
          {issues.length ? (
            <>
              <div className="le-status-head">{issues.length} issue{issues.length === 1 ? '' : 's'} — fix to save</div>
              <ul>{issues.map((msg, i) => <li key={i}>{msg}</li>)}</ul>
            </>
          ) : `✓ ${d.pieces.length} piece${d.pieces.length === 1 ? '' : 's'}, all clear`}
        </div>
      </div>
      <EditorSidebar s={s} dispatch={dispatch} goLibrary={goLibrary} valid={valid} />
    </div>
  )
}

function EditorSidebar({ s, dispatch, goLibrary, valid }) {
  const d = s.draft
  const sel = s.selected != null ? d.pieces[s.selected] : null
  const setMeta = (patch) => dispatch({ type: 'META', patch })
  const knownTypes = [...new Set(libraryLayouts().map((l) => l.type))]
  const wdl = emitRoomBlock(d)
  return (
    <aside className="le-side">
      <div className="le-row">
        {s.dirty && !valid ? (
          <>
            <button disabled title="Fix the red pieces (overlap / out of bounds) to save">← Library</button>
            <button className="danger-link" onClick={goLibrary} title="Leave without saving these changes">Discard</button>
          </>
        ) : (
          <button onClick={goLibrary}>← Library {s.dirty ? '(save)' : ''}</button>
        )}
        <b className="mono">{layoutName(d)}</b>
      </div>
      {s.dirty && !valid && <p className="le-warn small">⚠ Overlap / out-of-bounds — fix the red pieces to save. Leaving discards these edits.</p>}

      <div className="panel">
        <h3>Room</h3>
        <label>Type
          <input list="le-types" value={d.type} onChange={(e) => setMeta({ type: e.target.value })} placeholder="bedroom" />
          <datalist id="le-types">{knownTypes.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label>Variant<input value={d.variant} onChange={(e) => setMeta({ variant: e.target.value })} placeholder="xs" /></label>
        <div className="le-row">
          <label>Width<NumField value={d.w} step={SIZE_STEP} min={1} onCommit={(n) => setMeta({ w: n })} /></label>
          <label>Depth<NumField value={d.h} step={SIZE_STEP} min={1} onCommit={(n) => setMeta({ h: n })} /></label>
        </div>
        <label>Wall height (optional)
          <input type="number" step={5} value={d.height} placeholder="full" onChange={(e) => setMeta({ height: e.target.value === '' ? '' : Number(e.target.value) })} />
        </label>
      </div>

      <div className="panel">
        <div className="le-row"><h3>Furniture</h3><button className="primary" onClick={() => dispatch({ type: 'PICKER', open: true })}>+ Add</button></div>
        {d.pieces.length === 0 && <p className="dim small">No pieces yet. Add furniture, then attach it to an anchor and nudge it into place.</p>}
        {d.pieces.map((p, i) => (
          <div key={i} className={`le-piece-row${s.selected === i ? ' sel' : ''}`} onClick={() => dispatch({ type: 'SELECT', index: i })}>
            <span className="grow">{p.asset.name}</span>
            <span className="dim small">{p.anchor}</span>
            <button className="icon" title="Delete" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_PIECE', index: i }) }}>✕</button>
          </div>
        ))}
      </div>

      {sel && (
        <div className="panel">
          <h3>{sel.asset.name}</h3>
          <div className="le-anchor-grid">
            {ANCHORS.map((an) => (
              <button key={an} className={sel.anchor === an ? 'active' : ''} title={an}
                onClick={() => dispatch({ type: 'SET_ANCHOR', index: s.selected, anchor: an })}>·</button>
            ))}
          </div>
          <div className="le-row">
            <label>Gap X<NumField value={sel.gap_x} onCommit={(n) => dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { gap_x: n } })} /></label>
            <label>Gap Y<NumField value={sel.gap_y} onCommit={(n) => dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { gap_y: n } })} /></label>
          </div>
          <label>Rotation
            <div className="le-rot">{[0, 90, 180, 270].map((r) => (
              <button key={r} className={((sel.rotation % 360) + 360) % 360 === r ? 'active' : ''} onClick={() => dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { rotation: r } })}>{r}°</button>
            ))}</div>
            <NumField value={sel.rotation} step={15} title="Rotation in degrees (any angle)"
              onCommit={(n) => dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { rotation: ((Math.round(n) % 360) + 360) % 360 } })} />
          </label>
        </div>
      )}

      <div className="panel">
        <div className="le-row"><h3>WDL</h3><button onClick={() => navigator.clipboard?.writeText(wdl)}>Copy</button></div>
        <pre className="le-wdl">{wdl}</pre>
        <p className="dim small">← Library saves this to the live library; ⌘S exports the whole rooms.wdl.</p>
      </div>

      {s.picker && <Picker dispatch={dispatch} />}
    </aside>
  )
}

function Picker({ dispatch }) {
  const [q, setQ] = React.useState('')
  const byCat = {}
  for (const a of CATALOG.assets) {
    if (q && !(`${a.name} ${a.id} ${a.category}`.toLowerCase().includes(q.toLowerCase()))) continue
    (byCat[a.category] ||= []).push(a)
  }
  return (
    <div className="le-picker-backdrop" onPointerDown={() => dispatch({ type: 'PICKER', open: false })}>
      <div className="le-picker" onPointerDown={(e) => e.stopPropagation()}>
        <div className="le-row"><input autoFocus placeholder="Search furniture…" value={q} onChange={(e) => setQ(e.target.value)} className="grow" /><button onClick={() => dispatch({ type: 'PICKER', open: false })}>✕</button></div>
        <div className="le-picker-list">
          {Object.entries(byCat).map(([cat, items]) => (
            <div key={cat}>
              <div className="le-cat">{cat}</div>
              {items.map((a) => (
                <div key={a.id} className="le-asset" onClick={() => dispatch({ type: 'ADD_PIECE', asset: a })}>
                  <span className="grow">{a.name}</span>
                  <span className="dim small">{a.dimensions[0]}×{a.dimensions[2]} m</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
