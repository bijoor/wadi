import { makeId, edgeExists } from '../model/graph.js'
import { clampRoomPosToPlot } from '../model/geometry.js'
import { sampleModel, normalizeModel } from './initialState.js'

const DOC_KEYS = ['grid', 'plot', 'floors', 'rooms', 'edges']
const HISTORY_LIMIT = 60

function docOf(state) {
  return {
    grid: state.grid,
    plot: state.plot,
    floors: state.floors,
    rooms: state.rooms,
    edges: state.edges,
  }
}

// Keep activeFloor pointing at a floor that actually exists (after undo/redo,
// load, or delete). Falls back to the first floor.
function ensureActiveFloor(state) {
  if (state.floors.some((f) => f.id === state.activeFloor)) return state
  return { ...state, activeFloor: state.floors[0] ? state.floors[0].id : null }
}

// Apply a new doc and push the previous doc onto the undo stack.
function commit(state, newDoc) {
  return {
    ...state,
    ...newDoc,
    history: {
      past: [...state.history.past, docOf(state)].slice(-HISTORY_LIMIT),
      future: [],
    },
  }
}

export function reducer(state, action) {
  switch (action.type) {
    // ---- view / selection / tool (not history-tracked) ----
    case 'SET_TOOL':
      return { ...state, tool: action.tool, selection: { type: null, id: null }, selectedIds: [] }
    case 'SELECT':
      return {
        ...state,
        selection: { type: action.itemType, id: action.id },
        selectedIds: action.itemType === 'room' ? [action.id] : [],
      }
    case 'SELECT_MANY': {
      const ids = action.ids
      const selection =
        ids.length === 1
          ? { type: 'room', id: ids[0] }
          : ids.length > 1
            ? { type: 'multi', id: null }
            : { type: null, id: null }
      return { ...state, selectedIds: ids, selection }
    }
    case 'SET_VIEW':
      return { ...state, view: { ...state.view, ...action.patch } }
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode }

    // ---- rooms ----
    case 'ADD_ROOM': {
      // Rooms may be placed freely (overlaps just get flagged, never blocked).
      // A new room joins the floor currently being edited.
      const room = { id: makeId('r'), floor: state.activeFloor, ...action.room }
      return {
        ...commit(state, { rooms: [...state.rooms, room] }),
        selection: { type: 'room', id: room.id },
        selectedIds: [room.id],
      }
    }
    case 'UPDATE_ROOM': {
      // Move/resize/edit freely — validity is shown, not enforced.
      const rooms = state.rooms.map((r) =>
        r.id === action.id ? { ...r, ...action.patch } : r
      )
      return commit(state, { rooms })
    }
    case 'UPDATE_ROOMS': {
      // Bulk position update (group move) committed as one history step.
      const map = new Map(action.changes.map((c) => [c.id, c]))
      const rooms = state.rooms.map((r) => (map.has(r.id) ? { ...r, ...map.get(r.id) } : r))
      return commit(state, { rooms })
    }
    case 'PASTE_ROOMS': {
      // Add duplicate rooms (fresh ids) and select them. Positions come in ready.
      // action.edges are index pairs [i, j] into action.rooms (internal links).
      // Paste lands on the floor currently being edited (clipboard may have
      // been copied from a different floor).
      const newRooms = action.rooms.map((r) => ({
        id: makeId('r'),
        name: r.name,
        floor: state.activeFloor,
        x: r.x, y: r.y, w: r.w, h: r.h,
        color: r.color,
      }))
      const ids = newRooms.map((r) => r.id)
      const newEdges = (action.edges || [])
        .filter(([i, j]) => ids[i] && ids[j])
        .map(([i, j]) => ({ id: makeId('e'), a: ids[i], b: ids[j] }))
      return {
        ...commit(state, {
          rooms: [...state.rooms, ...newRooms],
          edges: [...state.edges, ...newEdges],
        }),
        selectedIds: ids,
        selection:
          ids.length === 1
            ? { type: 'room', id: ids[0] }
            : ids.length > 1
              ? { type: 'multi', id: null }
              : { type: null, id: null },
      }
    }
    case 'DUPLICATE_SELECTED': {
      // Duplicate the current room selection, offset by one cell, and select it.
      // Connections between two duplicated rooms are cloned too.
      const ids = state.selectedIds || []
      const idset = new Set(ids)
      const src = ids.map((id) => state.rooms.find((r) => r.id === id)).filter(Boolean)
      if (src.length === 0) return state
      const g = state.grid
      const cl = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
      const idMap = new Map()
      const newRooms = src.map((r) => {
        const nid = makeId('r')
        idMap.set(r.id, nid)
        return {
          id: nid,
          name: r.name,
          floor: r.floor, // duplicate stays on the same floor
          w: r.w, h: r.h,
          color: r.color,
          x: cl(r.x + 1, 0, g.cols - r.w),
          y: cl(r.y + 1, 0, g.rows - r.h),
        }
      })
      const newEdges = state.edges
        .filter((e) => idset.has(e.a) && idset.has(e.b))
        .map((e) => ({ id: makeId('e'), a: idMap.get(e.a), b: idMap.get(e.b) }))
      const newIds = newRooms.map((r) => r.id)
      return {
        ...commit(state, {
          rooms: [...state.rooms, ...newRooms],
          edges: [...state.edges, ...newEdges],
        }),
        selectedIds: newIds,
        selection:
          newIds.length === 1 ? { type: 'room', id: newIds[0] } : { type: 'multi', id: null },
      }
    }
    case 'DELETE_ROOM': {
      const rooms = state.rooms.filter((r) => r.id !== action.id)
      const edges = state.edges.filter(
        (e) => e.a !== action.id && e.b !== action.id
      )
      return {
        ...commit(state, { rooms, edges }),
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }
    case 'DELETE_ROOMS': {
      const idset = new Set(action.ids)
      const rooms = state.rooms.filter((r) => !idset.has(r.id))
      const edges = state.edges.filter((e) => !idset.has(e.a) && !idset.has(e.b))
      return {
        ...commit(state, { rooms, edges }),
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }

    // ---- edges ----
    case 'ADD_EDGE': {
      // A connection is a desired relationship — allowed between any two rooms.
      // It shows as unsatisfied until the rooms are arranged to share a wall.
      const { a, b } = action
      if (a === b || edgeExists(state.edges, a, b)) return state
      const edge = { id: makeId('e'), a, b }
      return {
        ...commit(state, { edges: [...state.edges, edge] }),
        selection: { type: 'edge', id: edge.id },
        selectedIds: [],
      }
    }
    case 'DELETE_EDGE': {
      const edges = state.edges.filter((e) => e.id !== action.id)
      return {
        ...commit(state, { edges }),
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }

    // ---- plot / grid ----
    case 'UPDATE_PLOT': {
      // Plot origin is always pinned at 0,0 — only its size changes.
      const plot = { ...state.plot, ...action.patch, x: 0, y: 0 }
      return commit(state, { plot })
    }
    case 'UPDATE_GRID': {
      const grid = { ...state.grid, ...action.patch }
      return commit(state, { grid })
    }

    // ---- floors ----
    // Switching the active floor is a view change (not history-tracked); it
    // clears the selection since it may point at a room on the old floor.
    case 'SET_ACTIVE_FLOOR': {
      if (!state.floors.some((f) => f.id === action.id)) return state
      return { ...state, activeFloor: action.id, selection: { type: null, id: null }, selectedIds: [] }
    }
    case 'ADD_FLOOR': {
      // Append an empty floor above the rest and start editing it.
      const id = makeId('f')
      const name = action.name || `Floor ${state.floors.length + 1}`
      return {
        ...commit(state, { floors: [...state.floors, { id, name }] }),
        activeFloor: id,
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }
    case 'DUPLICATE_FLOOR': {
      // Clone a whole floor — its rooms (fresh ids) and the connections between
      // them — into a new floor above. This is how you reuse a 1BHK layout and
      // stack it into a 2BHK: duplicate, then edit the copy independently.
      const srcId = action.id || state.activeFloor
      const src = state.floors.find((f) => f.id === srcId)
      if (!src) return state
      const nid = makeId('f')
      const srcRooms = state.rooms.filter((r) => r.floor === srcId)
      const idMap = new Map()
      const newRooms = srcRooms.map((r) => {
        const rid = makeId('r')
        idMap.set(r.id, rid)
        return { ...r, id: rid, floor: nid }
      })
      const srcSet = new Set(srcRooms.map((r) => r.id))
      const newEdges = state.edges
        .filter((e) => srcSet.has(e.a) && srcSet.has(e.b))
        .map((e) => ({ id: makeId('e'), a: idMap.get(e.a), b: idMap.get(e.b) }))
      const idx = state.floors.findIndex((f) => f.id === srcId)
      const floors = [...state.floors]
      floors.splice(idx + 1, 0, { id: nid, name: `${src.name} copy` })
      return {
        ...commit(state, {
          floors,
          rooms: [...state.rooms, ...newRooms],
          edges: [...state.edges, ...newEdges],
        }),
        activeFloor: nid,
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }
    case 'COPY_ROOMS_TO_FLOOR': {
      // Clone the given rooms (and the connections among them) onto another
      // floor, keeping their positions, then switch to that floor with the
      // copies selected so the result is visible.
      const idset = new Set(action.ids || [])
      const target = action.floor
      const src = state.rooms.filter((r) => idset.has(r.id))
      if (!src.length || !state.floors.some((f) => f.id === target)) return state
      const idMap = new Map()
      const newRooms = src.map((r) => {
        const nid = makeId('r')
        idMap.set(r.id, nid)
        return { ...r, id: nid, floor: target }
      })
      const newEdges = state.edges
        .filter((e) => idset.has(e.a) && idset.has(e.b))
        .map((e) => ({ id: makeId('e'), a: idMap.get(e.a), b: idMap.get(e.b) }))
      const newIds = newRooms.map((r) => r.id)
      return {
        ...commit(state, {
          rooms: [...state.rooms, ...newRooms],
          edges: [...state.edges, ...newEdges],
        }),
        activeFloor: target,
        selectedIds: newIds,
        selection: newIds.length === 1 ? { type: 'room', id: newIds[0] } : { type: 'multi', id: null },
      }
    }
    case 'RENAME_FLOOR': {
      const floors = state.floors.map((f) =>
        f.id === action.id ? { ...f, name: action.name } : f
      )
      return commit(state, { floors })
    }
    case 'MOVE_FLOOR': {
      // Reorder within the stack (dir = -1 down / +1 up). Order is bottom->top.
      const idx = state.floors.findIndex((f) => f.id === action.id)
      const to = idx + action.dir
      if (idx < 0 || to < 0 || to >= state.floors.length) return state
      const floors = [...state.floors]
      const [f] = floors.splice(idx, 1)
      floors.splice(to, 0, f)
      return commit(state, { floors })
    }
    case 'DELETE_FLOOR': {
      // Removing a floor drops its rooms and any connections that touched them.
      // The last floor can't be deleted.
      if (state.floors.length <= 1) return state
      const gone = action.id
      const goneRooms = new Set(state.rooms.filter((r) => r.floor === gone).map((r) => r.id))
      const floors = state.floors.filter((f) => f.id !== gone)
      const rooms = state.rooms.filter((r) => r.floor !== gone)
      const edges = state.edges.filter((e) => !goneRooms.has(e.a) && !goneRooms.has(e.b))
      const next = ensureActiveFloor({ ...state, floors, activeFloor: gone === state.activeFloor ? floors[0].id : state.activeFloor })
      return {
        ...commit(state, { floors, rooms, edges }),
        activeFloor: next.activeFloor,
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }

    // ---- document-level ----
    case 'LOAD_MODEL': {
      const model = normalizeModel(action.model)
      return {
        ...commit(state, model),
        activeFloor: model.floors[0].id,
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }
    case 'RESET': {
      const model = sampleModel()
      return {
        ...commit(state, model),
        activeFloor: model.floors[0].id,
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }

    // ---- history ----
    case 'UNDO': {
      if (state.history.past.length === 0) return state
      const past = [...state.history.past]
      const prev = past.pop()
      return ensureActiveFloor({
        ...state,
        ...prev,
        selection: { type: null, id: null },
        selectedIds: [],
        history: {
          past,
          future: [docOf(state), ...state.history.future].slice(0, HISTORY_LIMIT),
        },
      })
    }
    case 'REDO': {
      if (state.history.future.length === 0) return state
      const [next, ...rest] = state.history.future
      return ensureActiveFloor({
        ...state,
        ...next,
        selection: { type: null, id: null },
        selectedIds: [],
        history: {
          past: [...state.history.past, docOf(state)].slice(-HISTORY_LIMIT),
          future: rest,
        },
      })
    }

    default:
      return state
  }
}

export { clampRoomPosToPlot, DOC_KEYS }
