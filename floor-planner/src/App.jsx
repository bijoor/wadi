import React, { useReducer, useEffect, useRef } from 'react'
import { reducer } from './store/reducer.js'
import { initialState, normalizeModel } from './store/initialState.js'
import { roomById } from './model/graph.js'
import { loadLocal, saveLocal } from './utils/storage.js'
import Toolbar from './components/Toolbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Canvas from './components/Canvas.jsx'

function init() {
  const base = initialState()
  const saved = loadLocal()
  if (saved) {
    const model = normalizeModel(saved) // migrate floorless / older docs
    const activeFloor = model.floors.some((f) => f.id === saved.activeFloor)
      ? saved.activeFloor
      : model.floors[0].id
    return { ...base, ...model, activeFloor }
  }
  return base
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const saveTimer = useRef(null)
  const clipboard = useRef({ rooms: [], edges: [] }) // rooms + internal edges (index pairs)

  // Debounced autosave of the document slice (+ which floor was being edited).
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveLocal({
        grid: state.grid, plot: state.plot, floors: state.floors,
        rooms: state.rooms, edges: state.edges, activeFloor: state.activeFloor,
      })
    }, 400)
    return () => clearTimeout(saveTimer.current)
  }, [state.grid, state.plot, state.floors, state.rooms, state.edges, state.activeFloor])

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' })
        return
      }
      if (typing) return

      const ids = state.selectedIds || []
      // Copy selected rooms (and connections among them) into the clipboard.
      if (mod && e.key.toLowerCase() === 'c') {
        if (ids.length) {
          e.preventDefault()
          const sel = ids.map((id) => roomById(state.rooms, id)).filter(Boolean)
          const indexOf = new Map(sel.map((r, i) => [r.id, i]))
          const rooms = sel.map((r) => ({ name: r.name, x: r.x, y: r.y, w: r.w, h: r.h, color: r.color }))
          const edges = state.edges
            .filter((e2) => indexOf.has(e2.a) && indexOf.has(e2.b))
            .map((e2) => [indexOf.get(e2.a), indexOf.get(e2.b)])
          clipboard.current = { rooms, edges }
        }
        return
      }
      // Paste clipboard rooms (with their internal connections), offset by a cell.
      if (mod && e.key.toLowerCase() === 'v') {
        if (clipboard.current.rooms.length) {
          e.preventDefault()
          const g = state.grid
          const cl = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
          const roomsToAdd = clipboard.current.rooms.map((r) => ({
            ...r,
            x: cl(r.x + 1, 0, g.cols - r.w),
            y: cl(r.y + 1, 0, g.rows - r.h),
          }))
          dispatch({ type: 'PASTE_ROOMS', rooms: roomsToAdd, edges: clipboard.current.edges })
        }
        return
      }
      // Duplicate the current selection in place (+1,+1).
      if (mod && e.key.toLowerCase() === 'd') {
        if (ids.length) {
          e.preventDefault()
          dispatch({ type: 'DUPLICATE_SELECTED' })
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedIds && state.selectedIds.length > 0) {
          e.preventDefault()
          dispatch({ type: 'DELETE_ROOMS', ids: state.selectedIds })
          return
        }
        if (state.selection.type === 'edge' && state.selection.id) {
          e.preventDefault()
          dispatch({ type: 'DELETE_EDGE', id: state.selection.id })
          return
        }
      }
      // Switch the floor being edited: [ down a floor, ] up a floor.
      if (e.key === '[' || e.key === ']') {
        const i = state.floors.findIndex((f) => f.id === state.activeFloor)
        const to = i + (e.key === ']' ? 1 : -1)
        if (to >= 0 && to < state.floors.length) {
          e.preventDefault()
          dispatch({ type: 'SET_ACTIVE_FLOOR', id: state.floors[to].id })
        }
        return
      }
      if (e.key === 'v' || e.key === 'V') dispatch({ type: 'SET_TOOL', tool: 'select' })
      else if (e.key === 'r' || e.key === 'R') dispatch({ type: 'SET_TOOL', tool: 'draw-room' })
      else if (e.key === 'e' || e.key === 'E') dispatch({ type: 'SET_TOOL', tool: 'draw-edge' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.selection, state.selectedIds, state.rooms, state.grid, state.edges, state.floors, state.activeFloor])

  return (
    <div className="app">
      <Toolbar state={state} dispatch={dispatch} />
      <div className="body">
        <Canvas state={state} dispatch={dispatch} />
        <Sidebar state={state} dispatch={dispatch} />
      </div>
      <div className="statusbar">
        <span>Tool: <b>{state.tool}</b></span>
        <span>Zoom: <b>{Math.round(state.view.zoom * 100)}%</b></span>
        <span className="tip">
          {state.tool === 'draw-room' && 'Drag inside the plot to draw a room.'}
          {state.tool === 'draw-edge' && 'Drag from one room to another to connect them.'}
          {state.tool === 'select' && 'Click to select · drag empty space to box-select · shift-click to add/remove · drag to move · scroll to pan · ⌘/Ctrl+scroll or buttons to zoom.'}
        </span>
      </div>
    </div>
  )
}
