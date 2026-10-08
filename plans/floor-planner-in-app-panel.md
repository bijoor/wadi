# Floor planner as an in-app left panel, bidirectional with the WDL

Status: DESIGN (for review). No code changes yet.
Related: [floor-planner-graph-integration.md](floor-planner-graph-integration.md)
(the earlier, partly-reverted attempt), [grid-convention.md](grid-convention.md),
[room-templates-in-wadi.md](room-templates-in-wadi.md).

Direction confirmed (user): reuse the STANDALONE planner's editing canvas — it is
now more mature at editing than the editor's read-only graph canvas — but SLIM IT
DOWN for embedding: strip everything already owned by the main app, above all the
whole furniture mapping/preview exercise (furniture is the app's job via its
engine, not part of floor planning). So the chosen path is a variant of Approach B
(share the planner's canvas), not Approach A (rebuild on the editor graph canvas).

## 1. Goal

Bring the floor planner's spatial editing into the main Wadi app as a registered
LEFT-panel tool (like the furniture catalog), scoped to a narrow slice of the
model:

- room POSITION
- room DIMENSIONS
- room CONNECTIONS, and the OPENINGS / GAPS that realize them

The binding is BIDIRECTIONAL against the WDL / HouseConfig:

- Edit a room in the panel -> the WDL updates.
- Edit the WDL (WDL editor, forms, an agent, another panel) for any of those
  attributes -> the panel updates automatically.

Two payoffs the user called out:

- Another surface for manual editing of the WDL (spatial, not just code/forms).
- A natural way to author CURATED house templates (sketch/adjust rooms +
  connections over the real config, then publish it as a template).

Overriding constraint: MINIMIZE code duplication between the standalone floor
planner and the main app.

## 2. What already exists (so we build on it, not beside it)

- `floor-planner/` (in-repo, deployed at `/planner`): the standalone editable
  canvas. Model = `{plot, grid, floors:[{id,name}], rooms:[{x,y,w,h,floor,roomType,...}],
  edges, guides, bays, spans, variables, build, viewMode}` in CELL coordinates.
  `Canvas.jsx` is already a CONTROLLED component: `Canvas({ state, dispatch })` —
  it owns no store; `App.jsx` holds the `useReducer`. Exporter `src/export/toWadi.js`
  (`modelToWadi` / `modelToWdl`) authors rooms, per-room slabs, walls + doors + gap
  openings (`wallsFromGraph.js`), a generated `guides` grid (`spanGrid.js`), and runs
  wadi's real `furnishRoom` as a post-pass. Furniture / autoplace / anchor / units
  are ALREADY shared with the editor via vite aliases (`wadi-furnish`,
  `wadi-autoplace`, `wadi-anchor`, `wadi-units`) — the planner already reaches INTO
  `editor/src`.
- Live sync today: `floor-planner/src/export/livePlanner.js` broadcasts WDL on a
  same-origin `BroadcastChannel` (`wadi:planner-live`); `wirePlannerLiveSync()` in
  `editor/src/viewer/main.ts` renders it via `applyIncomingWdl`. This is ONE-WAY
  (planner -> app) and just gated on a clean layout.
- The editor already has a WDL -> schematic PROJECTION, currently READ-ONLY:
  - `editor/src/graph/graphModel.ts`: `roomBlocksOf(config, floorIdx)` (resolved
    rooms + `connections`), `sharesWall`, `connectionSatisfied` (mirrors C11),
    `edgeList`, `center`.
  - `editor/src/graph/GraphView.tsx`: renders rooms at RESOLVED positions,
    connection edges coloured green/red, guides, plot. Bound to `useConfigStore`.
  - The prior plan (`floor-planner-graph-integration.md`) shipped Phase 2 (this
    read-only Graph tab), Phase 3 (an EDITABLE canvas with draw/move/resize +
    snap-to-guide that WROTE guide-relative formulas — `graphSnap.ts`), then Phase
    3.1 REMOVED the editing and `graphSnap.ts`, retreating to read-only "edit as
    WDL code / forms."
- Config store `editor/src/state/configStore.ts` (Zustand + zundo): `config` is the
  RESOLVED HouseConfig and the app's single source of truth. `updateObject(sel,
  patch)` mutates one object, re-resolves, and is undo-aware. `activeFloorIdx` is a
  shared floor cursor. Every surface (3D, 2D, WDL editor, forms, the read-only
  Graph) already re-derives from this store.
- `room.connections?: string[]` is a first-class schema field
  (`houseConfig.ts:321`), round-trips through `emitWdl` / the DSL, and is validated
  by `c11_declared_connection.ts` (adjacent AND a door on the shared span) and
  `c12_room_overlap.ts` (geometry sanity).
- Left-panel tool system `editor/src/viewer/leftPanels.ts`: `registerLeftTool({id,
  label, icon, panel, available, onShow, onHide})`. A new tool is ONE call + a
  panel DOM node + a mount function. Furniture catalog does exactly this
  (`mountFurnitureCatalog(dock)` + `registerLeftTool({id:"furniture", ...})`).

Key takeaway: the model, geometry, adjacency, walls, furniture, validation, AND a
read-only WDL->schematic projection ALREADY live in `editor/src` and are already
the app's single source of truth. The planner already imports from `editor/src`.
So most of "the engine" is shared today; what is NOT yet shared is the EDITABLE
spatial canvas and a WDL->planner IMPORT direction.

## 3. The core decision: one source of truth, no second model

The app's single source of truth stays the config store (the resolved
HouseConfig, from which the WDL is emitted). The in-app panel keeps NO persistent
model of its own. Each render it DERIVES a transient, planner-shaped view from the
current config, and each edit it writes STRAIGHT BACK to the config via
`updateObject` (+ insert/remove). Consequences:

- "Edit the WDL -> the planner updates automatically" is FREE: the store
  re-resolves on any change (WDL editor, forms, agent, another panel) and the
  panel re-derives from it. No dual-model reconciliation, no drift, no round-trip
  divergence to police.
- This is the single biggest de-duplication lever: there is exactly ONE model in
  the app. The panel is a view + an editor over it, not a parallel state machine.

The standalone planner is the ONLY place a persistent planner-shaped model still
lives, and that is correct: it is the blank-canvas STARTING tool used before any
WDL exists.

## 4. Scope boundary: what the panel may write

The panel owns a NARROW slice and PATCHES IN PLACE. It never regenerates the whole
house (that is the standalone planner's "new house" job). On every edit it touches
ONLY:

- a room's `x` / `y` / `width` / `length` (as a literal OR a guide-relative
  formula — see 6),
- a room's `connections`,
- the OPENINGS on the wall shared by a connected pair (door vs open/gap), authored
  on the owning room's facing wall, matching how `wallsFromGraph` authors them and
  what C11 checks.

Everything else in the WDL is preserved untouched: roof, materials, furniture
containers, slabs, non-room objects, other floors, variables, the configurator,
hand-authored walls not tied to a connection. Furniture re-flows through wadi's
existing engine when a room resizes (already true today); the panel does not
author furniture.

Explicitly OUT of the embedded panel (kept in the standalone tool and/or other
surfaces): the guides/bays/spans/variables authoring tools, view modes
(overlay/sheets), plot resizing as a first-class tool (can be a later add), and
anything that regenerates geometry wholesale.

## 5. De-duplication strategy (the heart of the plan)

Split the system into SHARED CORE (one implementation, used by both hosts) and
HOST-SPECIFIC SHELL.

Shared core (all in `editor/src`, imported by the standalone planner via its
existing alias pattern):

- Geometry + adjacency: retire the planner's `src/model/geometry.js`
  (`rectsOverlap`, `roomInsidePlot`, `sharesWall`) and `graph.js`
  (`analyze`/`layoutErrorCount`) in favour of `editor/src/graph/graphModel.ts` +
  `spatialModel.ts` + the C11/C12 checks. One adjacency/overlap definition for the
  whole system. (The planner already mirrors these; this makes it literal reuse.)
- Exporter: `modelToWadi` / `wallsFromGraph` / `spanGrid` logic moves to (or is
  re-exported from) a shared `editor/src` module, so there is ONE planner-shaped
  -> WDL author used by the standalone "Export .wadi" AND any in-app "generate from
  a sketch" path.
- Importer (NEW, the missing reverse direction): `configToSchematic(config,
  floorIdx) -> {plot, rooms:[{id,name,x,y,w,l,roomType}], edges:[{a,b,kind}]}`,
  built on `roomBlocksOf` (resolved rooms + connections) + reading door/gap kind
  off each shared wall's openings. This is the one genuinely new shared piece and
  it is small.
- Validation: the panel's "N layout errors" and connection status come from
  C11/C12 (wadi's constraints), not a planner-local re-implementation.

Host-specific shell:

- Standalone planner: its `useReducer` store, multi-floor view modes, guides/bays
  tools, file open/save, and the blank-canvas starting flow. Persists its own
  model (no WDL yet).
- In-app panel: a `registerLeftTool({id:"planner", ...})` mount, a subscription to
  `useConfigStore`, the `configToSchematic` projection in, and an edit adapter out
  (see 7).

### 5a. The canvas: reuse the planner, slimmed down (chosen)

Chosen: reuse the standalone planner's `Canvas.jsx` (the mature editing widget) as
a shared, host-agnostic CONTROLLED component, mounted in BOTH the standalone app
and the in-app left panel. `Canvas` is already `Canvas({ state, dispatch })`, so
the app supplies a `dispatch` adapter that maps its actions onto the config store.
Rejected: rebuilding on the editor's read-only graph canvas (`GraphView` +
`graphSnap`) — it is thinner and less capable than the planner's editor, so it
would be a step backward on editing.

The editor's `graph/` module is NOT wasted: `graphModel.ts` (adjacency,
`connectionSatisfied`) + C11/C12 become the SHARED validation the embedded planner
uses (per 5). The read-only `GraphView` tab can be retired once the editable panel
lands, or kept as a lightweight viewer.

What "slim it down" means (the user's core point): the embedded planner is the
standalone MINUS everything the main app already owns. See 5b.

Costs to plan for (smaller than full Approach B, because slimming removes the
heaviest coupling):

- Guide / formula OUT direction: the planner does NOT snap to pre-existing guides.
  It DERIVES the `main` guide grid from the room edges and writes room coords as
  guide-relative formulas at commit time — its existing `spanGrid.js` /
  `roomGridFormulas` logic, the same one used at export. So the planner stays the
  authority on the `{rooms, connections, derived guides}` slice; see 6.
- Patch-in-place: the planner today REGENERATES a whole HouseConfig. Embedded, it
  must apply ONLY its slice to the existing config and leave roof / materials /
  furniture / other objects / other floors intact. This patch mode is new work and
  is the main technical task; see 7.
- Build integration: compile the planner's (JS) React components into the editor's
  TS/Vite viewer bundle, or promote the shared canvas to a small package both
  builds import. One React instance, shared styles. Slimming (dropping furniture)
  removes the planner's heaviest `editor/src` couplings (`wadi-furnish` /
  `wadi-autoplace` for preview + prepopulation), which shrinks this surface.

### 5b. Slim-down: what the embedded planner drops

Furniture, entirely (the user's explicit call — furniture is not part of floor
planning; the app furnishes via its own engine):

- the `Furniture` preview toggle + the canvas furniture overlay
  (`Canvas.jsx` `fittedFurniture`),
- the `Layouts` room-template designer (`LayoutEditor.jsx`) and its store
  (`layoutLibrary.js`, `roomLayouts.json`, `build-room-layouts`),
- the planner's own placement copies (`furnitureFit.js`, `roomModules.js`),
- the `furnishRoom` prepopulation post-pass in the exporter.

Rooms still carry `room_type` (so the app knows what to furnish), but the planner
neither previews nor authors furniture.

Also strip from the EMBEDDED host (kept in the standalone tool where they still
make sense): file open/save/reset, `Export .wadi` / `Open in Wadi` handoff (the
app already holds the model), and — to confirm with the user (see risks) — the
overlay / side-by-side view modes, and the guides / bays / spans / variables
authoring tools (the planner derives guides automatically; bays/spans/variables
are the app's configurator concern).

Keep in the embedded host: draw / move / resize rooms, draw / reverse / delete
connections with direction, door-vs-open per connection, single-floor editing on
the shared floor cursor, and the room dimension/name/type sidebar fields.

## 6. Formula / guide round-trip (the planner derives the grid)

Wadi room positions are usually COMPUTED (`at (main.x2, main.yC)`), not bare
numbers, so writing back resolved literals would clobber the model and fight the
grid. The planner already has the right answer for this and it is DIFFERENT from
the editor's snap-to-guide model:

- The planner DERIVES a `main` guide grid from the DISTINCT room-edge coordinates
  (`spanGrid.js` `guidesFromRooms` / `roomGridFormulas`) and writes each room's
  x/y/width/length as formulas off those named lines (`= main.x2`,
  `= main.x3 - main.x2`). The room LAYOUT defines the guides, rather than the
  drag snapping to guides that already exist.
- Because shared walls sit on shared guide lines, moving a wall in the planner
  moves the one derived line, and both rooms re-flow off it. The parametric intent
  is preserved without the user thinking about guides at all.

Implication for bidirectional editing: this is clean for houses whose `{rooms,
connections, guides}` slice the planner OWNS (planner-origin or grid-driven
houses). For an arbitrary HAND-AUTHORED house with its own guides/objects, the
planner's re-derived `main` grid may not match the author's guides. So the safe
default is: the panel edits houses it can round-trip; for others it either edits
literals (no re-derivation) or is read-only. This is open question 3.

## 7. Bidirectional data flow (embedded planner concretely)

The embedded planner holds a TRANSIENT planner-shaped state derived from the
config; it is not a second persistent model.

- IN (WDL -> panel): subscribe to `useConfigStore`. On any config change, run
  `configToSchematic(config, activeFloorIdx)` -> the planner's cell state (rooms,
  edges, plot, derived guides) and feed it to `Canvas`. This covers external edits
  (WDL editor, forms, agent) for free.
- OUT (panel -> WDL): the `dispatch` adapter turns the planner's scoped actions
  into a config PATCH, applied via the store:
  - the planner recomputes its owned slice — room rects + guide-relative formulas
    (per 6), `room.connections`, and the door/gap openings on shared walls
    (`wallsFromGraph`) — for the edited floor,
  - a PATCH-IN-PLACE step writes ONLY that slice onto the existing config: update
    each room's `x/y/width/length` + `formulas` + `connections` + facing-wall
    `openings`, the `grids.main` guide object, and add/remove room objects; leave
    roof, materials, furniture containers, slabs, other object types, and other
    floors exactly as they were,
  - all through `updateObject` / insert / remove, so it is undo-aware (zundo) and
    re-resolves automatically.
- Scoped planner actions to adapt: `UPDATE_ROOM(S)`, `ADD_ROOM`, `DELETE_ROOM(S)`,
  `ADD_EDGE`, `DELETE_EDGE`, `SET_EDGE_KIND`, `REVERSE_EDGE`, `UPDATE_PLOT`,
  `SELECT`. Out-of-scope actions (guides/bays/spans/variables, view modes,
  furniture, file IO) are removed from the slimmed UI (5b) so they never fire in
  the embedded host.
- The existing one-way `BroadcastChannel` live sync from the STANDALONE planner is
  unaffected and stays as the cross-tab hand-off for the blank-canvas tool. The
  in-app panel needs no channel — it is in-process on the store.

## 8. Curated templates

Because the panel edits the real config, and the config already round-trips to
`.wadi` / `.wdl` and has a publish-template workflow, curated templates fall out:
open a house (or a blank seed), arrange rooms + connections + openings spatially in
the panel, and publish via the EXISTING publish-template flow. No new template
machinery. The standalone planner remains the from-scratch sketch that HANDS OFF a
fresh config (`Open in Wadi` / `Export .wadi`); the in-app panel is for editing and
curating an existing one.

## 9. Availability / UX

- Register as a left tool `{id:"planner", label:"Layout", icon:"▭"}`. Available in
  the studio (architect persona) on the 2D surface; hidden in the owner app and in
  the embedded WDL-editor preview (mirrors `graphSelectable()` gating).
- Uses the shared `activeFloorIdx` cursor (the Sidebar floor tabs), so it never
  needs its own floor switcher.
- Selecting a room can still open the shared `RoomForm` for non-spatial detail; the
  panel adds the spatial editing the form cannot express.

## 10. Phasing

- P0 — Slim the planner + consolidate. Remove furniture from the planner (5b:
  preview overlay, Layouts designer, `furnitureFit`/`roomModules`, the
  `furnishRoom` prepopulation) so `Canvas` no longer depends on the furniture
  aliases; point the standalone planner's validation at the shared
  graphModel/C11/C12 (retire `geometry.js` / `layoutErrorCount` duplication).
  Standalone still works; it just stops previewing/authoring furniture (rooms keep
  `room_type`). Verify the standalone and parity.
- P1 — Extract the shared canvas + build the config bridge. Make `Canvas` (and the
  minimal slice of the reducer's geometry/connection actions) host-agnostic and
  importable by the editor build. Add `configToSchematic` (IN) and the
  patch-in-place adapter (OUT, per 7) with the planner's own guide derivation
  (per 6). No panel yet; unit-test the round-trip (import(patch(x)) stable).
- P2 — Register the left tool + mount the slimmed canvas. `registerLeftTool({id:
  "planner", ...})`, mount `Canvas` bound to the store via the bridge, single-floor
  on the shared cursor. Move/resize rooms writes back live; IN updates automatically.
- P3 — Connections + openings in the panel (draw/reverse/delete connection; door
  vs open per connection authoring the shared wall's openings); live C11 colouring
  from the shared validation.
- P4 — Add/delete room, optional plot edit; decide the fate of the standalone tool
  and the read-only `GraphView` tab.
- Throughout: `npx --prefix editor tsc --noEmit`, `npm --prefix editor run test`,
  `npm --prefix editor run parity-render` (6/6), and the fork deploy workflow. No
  touching the frozen main / shared template.

## 11. Risks / open questions to confirm before building

1. Slim-down scope (5b): furniture is CONFIRMED out. Confirm the rest — should the
   embedded panel also drop the overlay / side-by-side view modes and the guides /
   bays / spans / variables tools, keeping just room + connection + opening editing
   on a single floor? (Recommended: yes, drop them from the embedded host; keep them
   in the standalone tool.)
2. Standalone planner's fate: keep it as the blank-canvas start tool (recommended),
   or fold it entirely into the app once the embedded panel lands. Also: retire the
   read-only `GraphView` tab, or keep it as a viewer?
3. Hand-authored / non-grid houses: the planner re-derives the `main` grid from room
   edges (6), which is clean for planner-origin houses but may not match an
   arbitrary hand-authored house's guides. Acceptable to make the panel best on
   grid-driven houses and literal-or-read-only elsewhere, or must it fully round-trip
   any house?
4. Openings authoring: the panel AUTHORS door/gap openings from a connection
   (current `wallsFromGraph` behaviour), which matches the request ("openings / gaps
   based on connections"). Note this differs from the prior plan's "no auto-doors,
   C11 only checks" stance; confirm we author, not just validate.
5. Patch-in-place fidelity: the OUT patch must touch only the owned slice and leave
   roof / materials / furniture / slabs / other objects / other floors intact.
   Confirm this is a hard requirement (it is what makes bidirectional editing of a
   real house safe) so it is designed in from P1, not bolted on.
6. Non-room objects on a floor (slabs, stairs, pillars): the panel shows rooms only;
   confirm they stay invisible and untouched in the panel (edited via other
   surfaces).
7. Build integration: compiling the planner's JS components into the editor TS/Vite
   bundle vs a small shared package. Low-risk but needs a concrete choice at P1
   (one React instance, shared CSS).
