import React from 'react'
import { saveModel, saveModelAs, openModel, clearFileHandle, exportSVG } from '../utils/storage.js'
import { buildSVG, buildSheetsSVG } from '../utils/svgExport.js'
import { floorView } from '../model/graph.js'
import { downloadWadi, openInWadi } from '../export/toWadi.js'

function docFrom(state) {
  return {
    grid: state.grid, plot: state.plot, floors: state.floors,
    rooms: state.rooms, edges: state.edges,
  }
}

export default function Toolbar({ state, dispatch }) {
  const { tool, history, floors, activeFloor, viewMode } = state
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
