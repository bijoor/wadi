import React from 'react'
import { saveModel, saveModelAs, openModel, clearFileHandle, exportSVG } from '../utils/storage.js'
import { buildSVG, buildSheetsSVG } from '../utils/svgExport.js'
import { floorView, layoutErrorCount } from '../model/graph.js'
import { downloadWadi, openInWadi } from '../export/toWadi.js'
import { broadcastModel, liveSupported, probeWadi } from '../export/livePlanner.js'

function docFrom(state) {
  return {
    grid: state.grid, plot: state.plot, floors: state.floors,
    rooms: state.rooms, edges: state.edges, build: state.build,
    guides: state.guides, bays: state.bays, spans: state.spans, variables: state.variables,
  }
}

export default function Toolbar({ state, dispatch, onAuthor, showFurniture, onToggleFurniture }) {
  const { tool, history, floors, activeFloor, viewMode } = state
  // Live sync to an open Wadi tab (same browser) — no session code, no relay.
  const [live, setLive] = React.useState(false)
  const [wadiUp, setWadiUp] = React.useState(null) // null=unknown, true/false
  // A layout with overlaps / rooms outside the plot is broken — don't push it to
  // Wadi. Only broadcast once the layout is clean again.
  const errors = layoutErrorCount(state)

  // While live, broadcast the WDL to Wadi on every change (debounced) — but only
  // while the layout has no errors.
  React.useEffect(() => {
    if (!live || errors > 0) return
    const t = setTimeout(() => broadcastModel(state), 300)
    return () => clearTimeout(t)
  }, [live, state, errors])

  function toggleLive() {
    if (!liveSupported()) return
    const next = !live
    setLive(next)
    if (next) { if (errors === 0) broadcastModel(state); probeWadi(setWadiUp) } else setWadiUp(null)
  }
  const VIEW_MODES = [
    ['single', '▭', 'Single', 'Edit one floor'],
    ['overlay', '▨', 'Overlay', 'All floors superimposed (active editable)'],
    ['sheets', '▥', 'Side by side', 'All floors laid out next to each other'],
  ]

  async function handleSave() {
    try {
      const res = await saveModel(docFrom(state))
      if (res && res.aborted) return
    } catch (e) {
      if (e && e.name !== 'AbortError') alert('Save failed: ' + (e.message || e))
    }
  }

  async function handleSaveAs() {
    try {
      const res = await saveModelAs(docFrom(state))
      if (res && res.aborted) return
    } catch (e) {
      if (e && e.name !== 'AbortError') alert('Save failed: ' + (e.message || e))
    }
  }

  async function handleLoad() {
    try {
      const model = await openModel()
      dispatch({ type: 'LOAD_MODEL', model })
    } catch (e) {
      if (e && e.message && e.message !== 'No file selected') alert('Load failed: ' + e.message)
    }
  }

  return (
    <div className="toolbar">
      <div className="brand">🏠 Floor Planner</div>

      <div className="group">
        <button
          className={tool === 'select' ? 'active' : ''}
          onClick={() => dispatch({ type: 'SET_TOOL', tool: 'select' })}
          title="Select / move / resize (V)"
        >
          ↖ Select
        </button>
        <button
          className={tool === 'draw-room' ? 'active' : ''}
          onClick={() => dispatch({ type: 'SET_TOOL', tool: 'draw-room' })}
          title="Draw a room by dragging a rectangle (R)"
        >
          ▭ Draw Room
        </button>
        <button
          className={tool === 'draw-edge' ? 'active' : ''}
          onClick={() => dispatch({ type: 'SET_TOOL', tool: 'draw-edge' })}
          title="Draw a connection by dragging room→room (E)"
        >
          ⟶ Draw Edge
        </button>
      </div>

      <div className="group floors" title="Floor being edited ([ / ] to switch)">
        {floors.map((f) => (
          <button
            key={f.id}
            className={f.id === activeFloor ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_ACTIVE_FLOOR', id: f.id })}
            title={`Edit ${f.name}`}
          >
            {f.name}
          </button>
        ))}
        <button className="floor-add" onClick={() => dispatch({ type: 'ADD_FLOOR' })} title="Add a floor above">
          ＋
        </button>
      </div>

      <div className="group viewmodes" title="How floors are shown">
        {VIEW_MODES.map(([m, icon, label, tip]) => (
          <button
            key={m}
            className={viewMode === m ? 'active' : ''}
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', mode: m })}
            title={tip}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="group">
        <button className={showFurniture ? 'active' : ''} onClick={onToggleFurniture}
          title="Preview the furniture template fitted into each typed room">🛋 Furniture</button>
        <button onClick={onAuthor} title="Author furniture layouts for the room templates">🪑 Layouts</button>
      </div>

      <div className="group">
        <button disabled={history.past.length === 0} onClick={() => dispatch({ type: 'UNDO' })} title="Undo (⌘Z)">
          ↶ Undo
        </button>
        <button disabled={history.future.length === 0} onClick={() => dispatch({ type: 'REDO' })} title="Redo (⇧⌘Z)">
          ↷ Redo
        </button>
      </div>

      <div className="group right">
        <button onClick={handleSave} title="Save JSON (overwrites the current file)">💾 Save</button>
        <button onClick={handleSaveAs} title="Save JSON to a new file">Save As…</button>
        <button onClick={handleLoad} title="Open a JSON floor plan">📂 Open</button>
        <button
          onClick={() =>
            state.viewMode === 'sheets'
              ? exportSVG(buildSheetsSVG(state), 'floor-plans.svg')
              : exportSVG(buildSVG(floorView(state, activeFloor)), 'floor-plan.svg')
          }
          title={
            state.viewMode === 'sheets'
              ? 'Export all floors (side by side) as SVG'
              : 'Export the floor being edited as SVG'
          }
        >
          🖼 Export SVG
        </button>
        <button
          onClick={() => downloadWadi(docFrom(state))}
          title="Export the plan as a Wadi .wadi (open it in the Wadi studio, or import to the WDL editor)"
        >
          ⬇ Export .wadi
        </button>
        <button
          className="primary"
          onClick={() => openInWadi(docFrom(state))}
          title="Send this plan to the Wadi studio (opens /app in a new tab) to add walls, doors & detail"
        >
          Open in Wadi →
        </button>
        {liveSupported() && (
          <span className="live-push" title="Live-update the 3-D model in an open Wadi tab as you sketch — same browser, no session code needed">
            <button
              className={live ? 'primary' : ''}
              onClick={toggleLive}
              title={live ? 'Stop live-updating Wadi' : 'Live-update an open Wadi tab as you sketch'}
            >
              {live ? '⚡ Live: on' : '⚡ Live to Wadi'}
            </button>
            {live && (
              <span className="push-msg" style={{ marginLeft: 6, fontSize: 12, opacity: 0.85, color: errors > 0 ? '#c0392b' : undefined }}>
                {errors > 0
                  ? `${errors} layout error${errors === 1 ? '' : 's'} — fix to push`
                  : wadiUp === false ? 'open Wadi (/app) to see it' : wadiUp === true ? '● Wadi connected' : 'syncing…'}
              </span>
            )}
          </span>
        )}
        <button
          onClick={() => {
            if (confirm('Reset to the sample apartment? This replaces your current plan.')) {
              clearFileHandle()
              dispatch({ type: 'RESET' })
            }
          }}
          title="Reset to sample"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  )
}
