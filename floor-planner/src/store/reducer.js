import { makeId, edgeExists } from '../model/graph.js'
import { clampRoomPosToPlot } from '../model/geometry.js'
import { syncGuides, recomputeBays, promoteBayGuides } from '../model/guides.js'
import { syncVarValues, cleanupVars, dropRoomBindings, varIdent, dimSize, reflowModel } from '../model/sizes.js'
import { sampleModel, normalizeModel } from './initialState.js'

const DOC_KEYS = ['grid', 'plot', 'floors', 'rooms', 'edges', 'build', 'guides', 'bays', 'variables', 'bindings']
const HISTORY_LIMIT = 60

function docOf(state) {
  return {
    grid: state.grid,
    plot: state.plot,
    floors: state.floors,
    rooms: state.rooms,
    edges: state.edges,
    guides: state.guides,
    bays: state.bays,
    variables: state.variables,
    bindings: state.bindings,
  }
}

// Keep activeFloor pointing at a floor that actually exists (after undo/redo,
// load, or delete). Falls back to the first floor.
function ensureActiveFloor(state) {
  if (state.floors.some((f) => f.id === state.activeFloor)) return state
  return { ...state, activeFloor: state.floors[0] ? state.floors[0].id : null }
}

// Apply a new doc and push the previous doc onto the undo stack. Whenever an action
// changes `rooms` (and doesn't set `guides` itself), re-derive the guides + bays from
// the new rooms so the structural skeleton always tracks the layout (provisional
// guides follow edges, permanent/named ones persist — see model/guides.js).
function commit(state, newDoc) {
  let doc = newDoc
  if (newDoc.rooms && !('guides' in newDoc)) {
    const s = syncGuides(newDoc.rooms, { guides: state.guides, bays: state.bays })
    doc = { ...newDoc, guides: s.guides, bays: s.bays }
  }
  // Keep each size variable's value live = its canonical bound dimension, so the export
  // seed and the Sizes panel track the sketch. Skip when the action set variables itself.
  if (doc.rooms && !('variables' in doc)) {
    doc = { ...doc, variables: syncVarValues(state.variables || [], state.bindings || [], doc.rooms) }
  }
  return {
    ...state,
    ...doc,
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
      const step = g.unitPerCell || 10 // offset by one grid cell (project units)
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
          x: cl(r.x + step, 0, g.cols * step - r.w),
          y: cl(r.y + step, 0, g.rows * step - r.h),
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
      const sz = dropRoomBindings(state.variables, state.bindings, [action.id])
      return {
        ...commit(state, { rooms, edges, variables: sz.variables, bindings: sz.bindings }),
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }
    case 'DELETE_ROOMS': {
      const idset = new Set(action.ids)
      const rooms = state.rooms.filter((r) => !idset.has(r.id))
      const edges = state.edges.filter((e) => !idset.has(e.a) && !idset.has(e.b))
      const sz = dropRoomBindings(state.variables, state.bindings, action.ids)
      return {
        ...commit(state, { rooms, edges, variables: sz.variables, bindings: sz.bindings }),
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }

    // ---- edges ----
    case 'ADD_EDGE': {
      // A connection is a desired relationship — allowed between any two rooms.
      // It shows as unsatisfied until the rooms are arranged to share a wall.
      // A connection is DIRECTED `a -> b` (from the room you dragged from, to the
      // room you dropped on): the direction is the flow through the house and is
      // recorded once, on the `a` room, so the shared opening is authored once.
      const { a, b } = action
      if (a === b || edgeExists(state.edges, a, b)) return state
      // `kind` decides the shared wall on export: 'door' = wall + centred door
      // (default), 'open' = no wall on the shared side.
      const edge = { id: makeId('e'), a, b, kind: 'door' }
      return {
        ...commit(state, { edges: [...state.edges, edge] }),
        selection: { type: 'edge', id: edge.id },
        selectedIds: [],
      }
    }
    case 'SET_EDGE_KIND': {
      const edges = state.edges.map((e) => (e.id === action.id ? { ...e, kind: action.kind } : e))
      return { ...commit(state, { edges }) }
    }
    case 'REVERSE_EDGE': {
      // Flip a connection's direction (swap from/to) to set which way the flow
      // runs through the house.
      const edges = state.edges.map((e) => (e.id === action.id ? { ...e, a: e.b, b: e.a } : e))
      return { ...commit(state, { edges }) }
    }
    case 'DELETE_EDGE': {
      const edges = state.edges.filter((e) => e.id !== action.id)
      return {
        ...commit(state, { edges }),
        selection: { type: null, id: null },
        selectedIds: [],
      }
    }

    // ---- guides / bays ----
    // A MANUAL guide is permanent from the start (a deliberate division line that
    // persists even with no room on it).
    case 'ADD_GUIDE': {
      const axis = action.axis
      if (axis !== 'x' && axis !== 'y') return state
      const at = Math.round(Number(action.at) * 1000) / 1000
      if (!Number.isFinite(at)) return state
      const g = state.guides || { x: [], y: [] }
      if (g[axis].some((l) => Math.abs(l.at - at) < 0.001)) return state // already a line here
      const line = { id: makeId('g'), at, permanent: true, ...(action.name ? { name: action.name } : {}) }
      const guides = { ...g, [axis]: [...g[axis], line].sort((a, b) => a.at - b.at) }
      const bays = recomputeBays(guides, state.bays)
      return commit(state, { guides, bays })
    }
    case 'DELETE_GUIDE': {
      const g = state.guides || { x: [], y: [] }
      const guides = { x: g.x.filter((l) => l.id !== action.id), y: g.y.filter((l) => l.id !== action.id) }
      const bays = recomputeBays(guides, state.bays)
      return {
        ...commit(state, { guides, bays }),
        selection: state.selection.type === 'guide' && state.selection.id === action.id
          ? { type: null, id: null } : state.selection,
      }
    }
    // Naming a bay (or flagging it editable) promotes its bounding guides to permanent
    // so the bay survives future room edits and becomes a configurator knob on export.
    case 'RENAME_BAY': {
      const guides = promoteBayGuides(state.guides || { x: [], y: [] }, action.key)
      const bays0 = { ...(state.bays || {}), [action.key]: { ...(state.bays?.[action.key] || {}), name: action.name } }
      const bays = recomputeBays(guides, bays0)
      return commit(state, { guides, bays })
    }
    case 'SET_BAY_EDITABLE': {
      const guides = promoteBayGuides(state.guides || { x: [], y: [] }, action.key)
      const bays0 = { ...(state.bays || {}), [action.key]: { ...(state.bays?.[action.key] || {}), editable: !!action.editable } }
      const bays = recomputeBays(guides, bays0)
      return commit(state, { guides, bays })
    }

    // ---- room-size variables (the configurable layer) ----
    // Bind a room dimension (w/h) to a named variable. A NEW name creates a variable
    // seeded from the current size; an EXISTING name SHARES it (and snaps this dimension
    // to the variable's canonical size so the sketch stays consistent).
    case 'BIND_DIM': {
      const { room, dim } = action
      const r = state.rooms.find((x) => x.id === room)
      if (!r || (dim !== 'w' && dim !== 'h')) return state
      const existing = (state.variables || []).find((v) => v.name === action.varName)
      let variables = state.variables || []
      let rooms = state.rooms
      let varName = action.varName
      if (existing) {
        const val = Number(existing.value)
        if (Number.isFinite(val)) rooms = state.rooms.map((x) => (x.id === room ? { ...x, [dim]: val } : x))
      } else {
        const label = action.label || `${r.name} ${dim === 'w' ? 'width' : 'depth'}`
        const used = new Set(variables.map((v) => v.name))
        varName = varIdent(action.varName || label, used)
        variables = [...variables, { name: varName, value: dimSize(r, dim), label }]
      }
      const bindings = [
        ...(state.bindings || []).filter((b) => !(b.room === room && b.dim === dim)),
        { var: varName, room, dim },
      ]
      const cleaned = cleanupVars(syncVarValues(variables, bindings, rooms), bindings)
      return commit(state, { rooms, variables: cleaned, bindings })
    }
    case 'UNBIND_DIM': {
      const bindings = (state.bindings || []).filter((b) => !(b.room === action.room && b.dim === action.dim))
      const variables = cleanupVars(state.variables || [], bindings)
      return commit(state, { variables, bindings })
    }
    case 'RENAME_VAR': {
      const used = new Set((state.variables || []).map((v) => v.name).filter((n) => n !== action.name))
      const newName = varIdent(action.newName, used)
      const variables = (state.variables || []).map((v) =>
        v.name === action.name ? { ...v, name: newName, label: action.newName || v.label } : v)
      const bindings = (state.bindings || []).map((b) => (b.var === action.name ? { ...b, var: newName } : b))
      return commit(state, { variables, bindings })
    }
    case 'SET_VAR_META': {
      const variables = (state.variables || []).map((v) => (v.name === action.name ? { ...v, ...action.patch } : v))
      return commit(state, { variables })
    }
    // Set a variable's value and RE-FLOW the plan live: the solver re-solves guide
    // positions (fixed or fit-plot mode) and writes them back into every room + guide.
    // Used by the Sizes-panel number field and by dragging a guide on the canvas.
    case 'SET_VAR_VALUE': {
      const target = Number(action.value)
      if (!Number.isFinite(target) || target <= 0) return state
      const mk = (val) => ({
        plot: state.plot, rooms: state.rooms, guides: state.guides,
        variables: (state.variables || []).map((v) => (v.name === action.name ? { ...v, value: val } : v)),
        bindings: state.bindings, build: state.build,
      })
      const ev = action.name
      let value = target
      let rf = reflowModel(mk(value), ev)
      if (!rf) {
        // The target doesn't fit even after flexing the other variables. Clamp to the
        // largest value that still fits (binary search from the current, known-feasible
        // value toward the target) so the edit always shows.
        const cur = Number((state.variables || []).find((v) => v.name === action.name)?.value)
        if (!Number.isFinite(cur) || !reflowModel(mk(cur), ev)) return state
        let lo = cur, hi = target
        for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (reflowModel(mk(mid), ev)) lo = mid; else hi = mid }
        value = Math.round(lo)
        rf = reflowModel(mk(value), ev) || reflowModel(mk(cur), ev)
        if (!rf) return state
        if (Math.abs(value - cur) < 1e-6) return state // nothing more fits
      }
      const variables0 = (state.variables || []).map((v) => (v.name === action.name ? { ...v, value } : v))
      const variables = syncVarValues(variables0, state.bindings, rf.rooms)
      return commit(state, { rooms: rf.rooms, guides: rf.guides, variables, bindings: state.bindings })
    }
    case 'DELETE_VAR': {
      const variables = (state.variables || []).filter((v) => v.name !== action.name)
      const bindings = (state.bindings || []).filter((b) => b.var !== action.name)
      return commit(state, { variables, bindings })
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
    case 'UPDATE_BUILD': {
      const build = { ...(state.build || {}), ...action.patch }
      return commit(state, { build })
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
      const sz = dropRoomBindings(state.variables, state.bindings, [...goneRooms])
      const next = ensureActiveFloor({ ...state, floors, activeFloor: gone === state.activeFloor ? floors[0].id : state.activeFloor })
      return {
        ...commit(state, { floors, rooms, edges, variables: sz.variables, bindings: sz.bindings }),
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
