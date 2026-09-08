// Room-layout authoring tool (minimal: library list + 2D anchor editor + live validation).
// Layouts are authored in wadi-dsl/std-modules/rooms.wdl and compiled to roomLayouts.json; this
// tool is a faster way to set the same anchor + gap numbers, previewing the real footprints and
// flagging overlaps / out-of-bounds the way check-room-layouts does. It emits the per-room WDL
// block to paste back (saving the whole rooms.wdl file is a later phase).
import React, { useReducer, useRef } from 'react'
import CATALOG from '../export/furnitureCatalog.json'
import MANIFEST from '../export/roomLayouts.json'
import { pieceRect, anchorPoints, gapForCenter, validateLayout } from '../export/furnitureFit.js'

const UNITS = { system: 'feet_inches', per_unit: 10 } // the layout pack's units
const WALLT = 8 // expand.ts default wall thickness (matches check-room-layouts)
const SIZE_STEP = 10 // room size grid (1 ft)
const ANCHORS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]
const KNOWN_TYPES = [...new Set(MANIFEST.layouts.map((l) => l.type))]

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const r0 = (n) => Math.round(Number(n) || 0)

// The `room …` WDL block for the current draft (author pastes it into rooms.wdl).
function emitRoomWdl(d) {
  const name = `${slug(d.type) || 'type'}_${slug(d.variant) || 'variant'}`
  const height = d.height != null && d.height !== '' ? ` height ${r0(d.height)}` : ''
  const body = d.pieces.map((p) => {
    const g = (r0(p.gap_x) || r0(p.gap_y)) ? ` gap (${r0(p.gap_x)}, ${r0(p.gap_y)})` : ''
    const rot = p.rotation ? ` rotation ${p.rotation}` : ''
    return `      item f."${p.asset.id}" anchor ${p.anchor}${g}${rot}`
  }).join('\n')
  return `    room ${name} at (0, 0) size (${r0(d.w)}, ${r0(d.h)})${height} {\n${body}\n    }`
}

const emptyDraft = () => ({ type: '', variant: '', w: 100, h: 100, height: '', pieces: [] })

function reducer(s, a) {
  switch (a.type) {
    case 'LIBRARY': return { ...s, view: 'library', selected: null, picker: false }
    case 'NEW': return { ...s, view: 'editor', draft: emptyDraft(), selected: null, picker: false }
    case 'EDIT': {
      const l = a.layout
      const variant = l.id.startsWith(l.type + '_') ? l.id.slice(l.type.length + 1) : l.id
      const pieces = l.pieces.map((p) => ({ asset: p.asset, anchor: p.anchor || 'center', gap_x: p.gap_x ?? 0, gap_y: p.gap_y ?? 0, rotation: p.rotation ?? 0 }))
      return { ...s, view: 'editor', draft: { type: l.type, variant, w: l.w, h: l.h, height: l.height ?? '', pieces }, selected: null, picker: false }
    }
    case 'META': return { ...s, draft: { ...s.draft, ...a.patch } }
    case 'ADD_PIECE': {
      const pieces = [...s.draft.pieces, { asset: a.asset, anchor: 'center', gap_x: 0, gap_y: 0, rotation: 0 }]
      return { ...s, draft: { ...s.draft, pieces }, selected: pieces.length - 1, picker: false }
    }
    case 'UPDATE_PIECE': {
      const pieces = s.draft.pieces.map((p, i) => (i === a.index ? { ...p, ...a.patch } : p))
      return { ...s, draft: { ...s.draft, pieces } }
    }
    case 'DELETE_PIECE': {
      const pieces = s.draft.pieces.filter((_, i) => i !== a.index)
      return { ...s, draft: { ...s.draft, pieces }, selected: null }
    }
    case 'SELECT': return { ...s, selected: a.index }
    case 'PICKER': return { ...s, picker: a.open }
    default: return s
  }
}

export default function LayoutEditor({ onClose }) {
  const [s, dispatch] = useReducer(reducer, undefined, () => ({ view: 'library', draft: emptyDraft(), selected: null, picker: false }))
  if (s.view === 'library') return <Library dispatch={dispatch} onClose={onClose} />
  return <Editor s={s} dispatch={dispatch} />
}

function Library({ dispatch, onClose }) {
  const rows = MANIFEST.layouts
  return (
    <div className="layout-lib">
      <div className="lib-head">
        <h2>Room layouts <span className="dim">({rows.length})</span></h2>
        <div>
          <button className="primary" onClick={() => dispatch({ type: 'NEW' })}>+ New room</button>
          <button onClick={onClose} title="Back to the floor planner">← Planner</button>
        </div>
      </div>
      <table className="lib-table">
        <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Items</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} onClick={() => dispatch({ type: 'EDIT', layout: l })} title="Edit this layout">
              <td className="mono">{l.id}</td>
              <td>{l.type}</td>
              <td>{l.w}×{l.h}</td>
              <td>{l.pieces.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dim small">Pick a layout to edit, or create a new room. Edits emit a WDL block to paste into
        wadi-dsl/std-modules/rooms.wdl, then run <code>npm run build-layouts</code>. (Saving the whole file is a later phase.)</p>
    </div>
  )
}

const VW = 620, VH = 470, PAD = 40

function Editor({ s, dispatch }) {
  const d = s.draft
  const room = { x: 0, y: 0, w: Math.max(d.w, 1), h: Math.max(d.h, 1) }
  const sc = Math.min((VW - 2 * PAD) / room.w, (VH - 2 * PAD) / room.h)
  const ox = (VW - room.w * sc) / 2, oy = (VH - room.h * sc) / 2
  const X = (u) => ox + u * sc, Y = (u) => oy + u * sc, L = (u) => u * sc
  const { rects, flags } = validateLayout(d.pieces, room, WALLT, UNITS)
  const anchors = anchorPoints(room, WALLT)
  const nOverlap = flags.filter((f) => f.overlap).length
  const nOob = flags.filter((f) => f.oob.length).length
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
              onPointerDown={(e) => { e.stopPropagation(); if (s.selected != null) dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { anchor: name, gap_x: 0, gap_y: 0 } }) }}>
              <title>{name}</title>
            </circle>
          ))}
          {d.pieces.map((p, i) => {
            const r = rects[i]
            const bad = flags[i].overlap || flags[i].oob.length
            const cls = `le-piece${bad ? ' bad' : ''}${s.selected === i ? ' sel' : ''}`
            const cx = X(r.cx), cy = Y(r.cy)
            const facing = { 0: [0, 1], 90: [1, 0], 180: [0, -1], 270: [-1, 0] }[((p.rotation % 360) + 360) % 360] || [0, 1]
            return (
              <g key={i} onPointerDown={(e) => onDown(e, i)} style={{ cursor: 'move' }}>
                <rect x={X(r.x0)} y={Y(r.y0)} width={L(r.x1 - r.x0)} height={L(r.y1 - r.y0)} className={cls} />
                <line x1={cx} y1={cy} x2={cx + facing[0] * Math.min(L(r.x1 - r.x0), L(r.y1 - r.y0)) * 0.4} y2={cy + facing[1] * Math.min(L(r.x1 - r.x0), L(r.y1 - r.y0)) * 0.4} className="le-facing" />
                <text x={cx} y={cy} className="le-label">{p.asset.name}</text>
              </g>
            )
          })}
        </svg>
        <div className={`le-status ${nOverlap || nOob ? 'bad' : 'ok'}`}>
          {nOverlap || nOob
            ? `${nOverlap ? nOverlap + ' overlap' : ''}${nOverlap && nOob ? ', ' : ''}${nOob ? nOob + ' out of bounds' : ''}`
            : `✓ ${d.pieces.length} piece${d.pieces.length === 1 ? '' : 's'}, all clear`}
        </div>
      </div>
      <EditorSidebar s={s} dispatch={dispatch} />
    </div>
  )
}

function EditorSidebar({ s, dispatch }) {
  const d = s.draft
  const sel = s.selected != null ? d.pieces[s.selected] : null
  const setMeta = (patch) => dispatch({ type: 'META', patch })
  const wdl = emitRoomWdl(d)
  return (
    <aside className="le-side">
      <div className="le-row">
        <button onClick={() => dispatch({ type: 'LIBRARY' })}>← Library</button>
        <b className="mono">{slug(d.type) || 'type'}_{slug(d.variant) || 'variant'}</b>
      </div>

      <div className="panel">
        <h3>Room</h3>
        <label>Type
          <input list="le-types" value={d.type} onChange={(e) => setMeta({ type: e.target.value })} placeholder="bedroom" />
          <datalist id="le-types">{KNOWN_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label>Variant<input value={d.variant} onChange={(e) => setMeta({ variant: e.target.value })} placeholder="xs" /></label>
        <div className="le-row">
          <label>Width<input type="number" step={SIZE_STEP} value={d.w} onChange={(e) => setMeta({ w: Math.max(Number(e.target.value) || 0, 1) })} /></label>
          <label>Depth<input type="number" step={SIZE_STEP} value={d.h} onChange={(e) => setMeta({ h: Math.max(Number(e.target.value) || 0, 1) })} /></label>
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
                onClick={() => dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { anchor: an, gap_x: 0, gap_y: 0 } })}>·</button>
            ))}
          </div>
          <div className="le-row">
            <label>Gap X<input type="number" value={sel.gap_x} onChange={(e) => dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { gap_x: Number(e.target.value) || 0 } })} /></label>
            <label>Gap Y<input type="number" value={sel.gap_y} onChange={(e) => dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { gap_y: Number(e.target.value) || 0 } })} /></label>
          </div>
          <label>Rotation
            <div className="le-rot">{[0, 90, 180, 270].map((r) => (
              <button key={r} className={sel.rotation === r ? 'active' : ''} onClick={() => dispatch({ type: 'UPDATE_PIECE', index: s.selected, patch: { rotation: r } })}>{r}°</button>
            ))}</div>
          </label>
        </div>
      )}

      <div className="panel">
        <div className="le-row"><h3>WDL</h3><button onClick={() => navigator.clipboard?.writeText(wdl)}>Copy</button></div>
        <pre className="le-wdl">{wdl}</pre>
        <p className="dim small">Paste into rooms.wdl (set a free <code>at (x, y)</code>), then <code>npm run build-layouts</code>.</p>
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
