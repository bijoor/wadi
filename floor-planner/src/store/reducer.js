import { makeId, edgeExists } from '../model/graph.js'
import { clampRoomPosToPlot } from '../model/geometry.js'
import { syncGuides, recomputeBays, promoteBayGuides } from '../model/guides.js'
import { reflowSpans, pruneSpans, gcVariables, wouldFullyFixGroup } from '../model/spanReflow.js'
import { sampleModel, normalizeModel } from './initialState.js'

const DOC_KEYS = ['grid', 'plot', 'floors', 'rooms', 'edges', 'build', 'guides', 'bays', 'spans', 'variables']

// A safe variable identifier from a free-text name: "Balcony band" -> "balcony_band".
function varSlug(label) {
  let s = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!s) return ''
  if (!/^[a-z_]/.test(s)) s = 'v_' + s
  return s
}
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
    spans: state.spans,
    variables: state.variables,
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
  // Keep spans + variables well-formed: drop spans whose endpoint guides no longer exist (a
  // room that carried them moved or was deleted), then GC variables no surviving span uses.
  const guidesNow = doc.guides || state.guides
  const spansNow = pruneSpans('spans' in doc ? doc.spans : state.spans, guidesNow)
  const varsNow = gcVariables('variables' in doc ? doc.variables : state.variables, spansNow)
  doc = { ...doc, spans: spansNow, variables: varsNow }
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
        ...(r.roomType ? { roomType: r.roomType } : {}),
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
          ...(r.roomType ? { roomType: r.roomType } : {}),
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

    // ---- guide spans (elastic sizing; see plans/elastic-guide-spans.md) ----
    // Define/replace/remove a span between two guides on an axis, then re-flow: distribution
    // rewrites the guide positions, the rooms follow their guides, and the plot refits.
    // action = { axis:'x'|'y', lo, hi, policy }  (policy null/omitted removes the span).
    case 'SET_SPAN': {
      const { axis, lo, hi, policy } = action
      if (axis !== 'x' && axis !== 'y') return state
      // A fixed group must keep at least one Auto segment to absorb changes; reject a fix that
      // would fully-constrain a group (the UI also disables the button, this is the safety net).
      if (policy && policy.kind === 'fixed' && wouldFullyFixGroup((state.guides && state.guides[axis]) || [], (state.spans && state.spans[axis]) || [], lo, hi)) return state
      const cur = (state.spans && state.spans[axis]) || []
      const rest = cur.filter((s) => !(s.lo === lo && s.hi === hi))
      const next = policy ? [...rest, { id: `sp_${axis}_${lo}_${hi}`, lo, hi, policy }] : rest
      const spans = { x: (state.spans && state.spans.x) || [], y: (state.spans && state.spans.y) || [], [axis]: next }
      // Binding to a NAMED variable that doesn't exist yet creates it, seeded from this span's
      // current size (guide gap); binding to an existing one snaps this dimension to its value.
      let variables = state.variables || {}
      if (policy && policy.kind === 'fixed' && policy.var && !(policy.var in variables)) {
        const lines = (state.guides && state.guides[axis]) || []
        const at = (id) => { const g = lines.find((l) => l.id === id); return g ? Number(g.at) : 0 }
        variables = { ...variables, [policy.var]: { value: Math.abs(at(hi) - at(lo)) } }
      }
      const rf = reflowSpans({ ...state, spans, variables })
      return commit(state, { spans, variables, guides: rf.guides, rooms: rf.rooms, plot: rf.plot })
    }
    // Rename a size variable everywhere it is used (the registry key + every span bound to
    // it). Pure relabel, no geometry change. New name is slugified and de-duplicated.
    case 'RENAME_VAR': {
      const { name } = action
      if (!name || !(state.variables && name in state.variables)) return state
      const used = new Set(Object.keys(state.variables).filter((k) => k !== name))
      const base = varSlug(action.newName)
      if (!base) return state
      let nn = base, k = 1
      while (used.has(nn)) { k += 1; nn = `${base}_${k}` }
      if (nn === name) return state
      const variables = {}
      for (const key of Object.keys(state.variables)) variables[key === name ? nn : key] = state.variables[key]
      const remap = (arr) => (arr || []).map((s) => (s.policy && s.policy.var === name ? { ...s, policy: { ...s.policy, var: nn } } : s))
      const spans = { x: remap(state.spans && state.spans.x), y: remap(state.spans && state.spans.y) }
      return commit(state, { variables, spans })
    }
    // Delete a size variable: every dimension bound to it reverts to Auto (its span is
    // dropped), then re-flow.
    case 'DELETE_VAR': {
      const { name } = action
      if (!name) return state
      const variables = { ...(state.variables || {}) }
      delete variables[name]
      const drop = (arr) => (arr || []).filter((s) => !(s.policy && s.policy.var === name))
      const spans = { x: drop(state.spans && state.spans.x), y: drop(state.spans && state.spans.y) }
      const rf = reflowSpans({ ...state, spans, variables })
      return commit(state, { spans, variables, guides: rf.guides, rooms: rf.rooms, plot: rf.plot })
    }
    // Set a shared size variable's value (and optionally its label), re-flowing every room
    // whose width or depth is bound to it, on either axis.
    case 'SET_VAR': {
      const { name } = action
      if (!name || !(state.variables && name in state.variables)) return state
      const cur = state.variables[name]
      const value = action.value != null ? Number(action.value) : cur.value
      if (action.value != null && (!Number.isFinite(value) || value <= 0)) return state
      const variables = { ...state.variables, [name]: { ...cur, value, ...(action.label != null ? { label: action.label } : {}) } }
      const rf = reflowSpans({ ...state, variables })
      return commit(state, { variables, guides: rf.guides, rooms: rf.rooms, plot: rf.plot })
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
