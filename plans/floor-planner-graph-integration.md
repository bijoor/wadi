# Floor Planner ↔ Wadi integration: guides, connections, and a formula-aware canvas

Status: DESIGN (for review). Supersedes the earlier "materialize the standalone
tool → .wadi" sketch. Related: [grid-convention.md](grid-convention.md),
[object-relationships-plan.md](object-relationships-plan.md),
[configurator-plan.md](configurator-plan.md),
[functional-constraints-testing.md](functional-constraints-testing.md).

## 1. Motivation

`~/Code/floor-planner` is a standalone React app: a room-graph-on-a-grid layout +
connection tool (multi-floor, side-by-side / overlay views, editable plates,
SVG export). We want to bring its two ideas into Wadi:

- **Connectivity** — an adjacency graph between rooms, as design intent + a
  validated functional test. Wadi has no such concept today.
- **A spatial authoring canvas** — draw/drag room blocks and connections,
  instead of only typing coordinates in forms.

The integration is NOT "embed a converter." Because Wadi room positions are
**computed** (`at (main.x2, main.yC)`), a dumb tool that needs hard numbers would
either lose the formulas or fight the model. Instead the floor-planner becomes a
**formula-aware studio view over the real config** — a spatial sibling of the
existing form editor. It renders resolved geometry, edits positions/sizes as
literal-or-formula, and snaps to *guides* so a drag writes a guide-relative
formula rather than a bare number.

## 2. Personas / scope (decides how much we build)

- **Architect (Nakasha)** uses the floor-planner view: guides + room blocks
  (positions/sizes as guide-relative formulas) + connections. The tabular studio
  forms keep the non-spatial detail (walls, openings, materials, heights).
- **Homeowner (Gharkul)** does **not** edit the floor plan. They move
  **configurator control variables**; the formula-bound, guide-snapped model
  re-flows. Demand-side flexibility comes through the configurator, not a
  homeowner spatial editor.

So the floor-planner is an **architect-only** tool. No homeowner spatial-editing
surface is in scope.

## 3. Rooms keep their geometry

Explicitly rejected: a `graph` section that *owns* room geometry so room blocks
stop repeating `at/size`. We keep `at (x,y) size (w,l)` on every room (each a
literal-or-formula), because it round-trips cleanly through the formula-aware
canvas and needs no compiler geometry-sourcing step. The only new room field is
`connections`.

## 4. Guides (rename of `grid`)

One reference primitive: a **guide** — a named, axis-aligned line whose position
is a **literal or a formula**. Rooms and objects reference guides. This is
exactly today's named grid, renamed to match the design-tool mental model.

A **`guides` object has one of two mutually exclusive modes:**

- **Named** — explicit `x:` / `y:` lines, each a name + a literal-or-formula
  position. Reference **by name**: `main.x2`, `main.yC`.
  ```
  guides main {
    x: 1 @ 0, 2 @ 215, 5 @ 635, 8 @ 1080
    y: A @ 0, C @ 290, G @ 835
  }
  ```
- **Generated** — `origin` + `spacing` + `extent`. Reference **by index**,
  resolving lazily to `origin + index · spacing` (any index resolves; no sibling
  names materialized). `extent` exists only so the canvas can *draw* the uniform
  lines.
  ```
  guides module { origin (0,0) spacing (30, 30) extent (40, 30) }
  ```
  Two reference forms, both supported:
  - `module.x8` — integer shorthand (mirrors the named `main.x2` shape).
  - `module.x(expr)` — call form, required for **fractional and negative**
    indices and any computed index: `module.x(8.5)`, `module.x(-1)`,
    `module.x(n + 1)`.

  An **offset** is not an index feature — it is plain arithmetic on the resolved
  position: `module.x8 + 15` is "15 units right of module line 8".

Rules:
- **One object = one mode** (grammar + schema enforced). So `.x2` (a name) vs
  `.x8` (an index) is unambiguous within an object.
- **`grid` = deprecated alias** for a named `guides` object; existing `.wdl`
  (e.g. the surve plan) keeps parsing and emits a deprecation note. There is no
  generated equivalent for the old keyword.
- **Multiple guides objects** are supported (already `record<string, …>` in the
  schema). Named + generated coexist as separate objects, and a **named guide can
  reference a generated one**: `guides main { x: 2 @ module.x8 + 15 }`. That is
  the normal pattern — lay down a module grid, then place a few named guides on or
  near it for the semantic lines.

## 5. Connections (room field)

- Optional `connections?: string[]` on the **room** object (schema + DSL). Names
  of connected rooms. Symmetric, deduped (Living↔Kitchen is one edge). Same-floor
  in v1; cross-floor (stair links) deferred.
- Additive-optional → every existing config loads unchanged.
- DSL: `room Living at (…) size (…) { connect Kitchen Hall ; wall north { … } }`.
- Round-trips through `emitWdl` / `compileDsl` and lives in the `.wadi` like any
  room field.

## 6. The floor-planner as an architect studio view

The floor-planner's canvas/geometry/connection engine is **ported into Wadi** as
the architect studio view. The standalone `~/Code/floor-planner` app is the
prototype; it is **retired** once this lands (single host = Wadi, no dual-mode).

In Wadi it is formula-aware: it renders rooms at **resolved** positions (via
Wadi's `resolve` / `resolveParametric`); the sidebar x/y/w/h are
**literal-or-formula** fields, reusing the studio's existing smart formula
fields; connections are edited on the canvas; multiple guides objects render as
snap targets.

**Guides tool lives in the canvas** (not a separate studio form, to declutter):
create/place/name guides, generate a regular grid, drag to reposition. The canvas
is the single spatial surface — guides + room blocks + connections.

**Snap-to-guides is the default.** Dragging a room edge snaps to the nearest
guide (across all guides objects) and **writes that guide's reference as the
formula** — `main.x2` for a named line, `module.x8` for a module line. A modifier
key drops to free / literal placement. This is what keeps direct manipulation
parametric: the things you snap to ARE the parametric references, so a drag
never clobbers the model with a bare number.

**Drag onto free space** (no snap / modifier held) writes a literal, with a
subtle confirm when it would replace a non-trivial existing formula.

## 7. Validation

New constraint **C11 "declared connection"** (see the constraint-module contract
in [functional-constraints-testing.md](functional-constraints-testing.md)). A
declared connection asserts the two rooms are **adjacent AND joined by a door**.
Two `error` failure modes per `room.connections` pair:

1. **Not adjacent** — the rooms do not share a wall at all.
2. **Adjacent but no door** — they share a wall, but no door opening lies on that
   shared wall segment.

Adjacency and the shared-wall segment come from Wadi's `spatialModel` (NOT the
tool's edge-coincidence), so `convention center` (rooms abut on a shared
centreline) and `corner` (rooms overlap by a wall thickness) both read correctly;
the door check tests whether any door opening in the expanded model falls on that
segment. Findings surface in `lintStructure` / `wadi_check` / the DSL status pill,
and the canvas shows the same result live.

**No auto-doors** — a connection is design intent + a functional test, never
geometry. Rooms author their own openings in their blocks; C11 only *checks* that
a declared connection is physically realized.

## 8. Coordinate bridge (reconfirmed)

Conventions already match 1:1: top-left origin, X right / Y down, top-left
anchor, width = X / length = Y. Scale between the tool's cells and house units is
`cells × unitPerCell × per_unit`. Emit as `convention center` so coincident edges
become shared centrelines. Adjacency for the satisfied check uses `spatialModel`.

## 9. Phasing

- **Phase 0 — `connections` room field. DONE.** Schema (`room.connections?`), DSL
  `connect A, B` header attribute on `Room`, round-trip (`toHouseConfig` de-dupes;
  `fromHouseConfig` emits in grammar order, quotes names), reference docs
  (`reference.ts` + regenerated `data-model.md`), tests (`connections.test.ts`).
  Verified: full DSL suite 115/115, editor tsc + tests, parity 6/6.
- **Phase 1 — `guides`. DONE.** `guides` DSL keyword (canonical) + `grid`
  deprecated alias; schema `guides` key (canonical) + `grids` still read (resolver
  merges both, `guidesDef` = named **xor** generated union); generated mode
  (`origin`/`spacing`/`extent`) with the lazy index accessor in the resolver —
  `module.x8` (ref shorthand) and `module.x(expr)` (call form; fractional/negative/
  computed); compile + decompile (`emitWdl` emits `guides`); generated guides drawn
  on the 2D plan overlay; readers updated (`refsView` materialises generated lines,
  Grids panel shows generated read-only). Tests: `generatedGuides.test.ts`,
  `guides.test.ts`, refsView case. Verified: editor tsc + full suite, param 49,
  parity 6/6, full DSL suite 120+. Storage key stays `grids` (union-typed) so
  templates/round-trips are unchanged; `guides` key available for hand-authoring.
- **Phase 2 — floor-planner as studio view. DONE.** New **Graph** tab in the
  viewer (`viewer.html` button + `#view-graph` container + `switchView` branch;
  `GraphView` React root mounted in `main.ts`). `editor/src/graph/GraphView.tsx`
  renders rooms as blocks at their RESOLVED positions (store config is already
  resolved) with connection edges coloured green (share a wall) / red (not);
  selecting a room opens the reusable `RoomForm` (literal-or-formula geometry
  fields) plus a connections editor (add via dropdown, remove via ✕); mutations go
  through `configStore.updateObject` (undo-aware, auto-re-resolves). Adjacency +
  edge logic in `graphModel.ts` (unit-tested). Room DRAGGING with snap-to-guide is
  Phase 3. Verified live in the browser (render, select→RoomForm, add/remove
  connection round-trip through `getConfig()`) + `graphModel.test.ts`, editor tsc,
  parity 6/6.
- **Phase 3 — guides tool + snapping in the canvas. DONE (core).** Guides (named +
  generated) draw on the Graph canvas as snap targets; draw/move/resize snap the
  live drag to the nearest guide and, on commit, **write the guide-relative
  formula** (`graphSnap.ts`: `drawPatch`/`movePatch`/`resizePatch` → `x: "= main.x2"`,
  `width: "= main.x3 - main.x2"`, …); off-guide falls back to a literal (clearing
  the bound formula). A "⊞ Grid" button drops a generated `module` guides object so
  any house gets snap targets. `graphSnap.test.ts` (7); verified live (draw →
  x/width formulas, move → x/y formulas, generate grid → 22 lines); editor tsc,
  parity 6/6, full editor suite green. Deferred refinement: placing individual named
  guides by click/drag (only uniform-grid generation for now).
- **Phase 3.1 — studio consolidation + read-only Graph. DONE (SUPERSEDES the
  draw/drag canvas of §2/§6).** The Graph is now a **read-only plan** whose only
  interaction is SELECTING a room, and selection is enabled **only in the full
  studio** (architect persona AND not an embedded preview — `graphSelectable()`
  checks `body.dataset.persona` + the `?panels=off`/`?embed=1` flag). There are
  **no** draw / connect / grid / move / resize tools; the `graphSnap` module and
  its test were removed. Rooms, connection edges (green = share a wall, red =
  not), and guide lines still render everywhere for viewing. In the owner app and
  the WDL editor's preview the Graph is fully read-only — edit as WDL code / via
  the forms.
  - Selecting a room opens the SAME studio property panel (`PropertyPanel` →
    `RoomForm`), which gained a **Connections** section (add via dropdown, remove
    via ✕, symmetric cleanup, C11 hint) — the ONE connections editor. No
    in-canvas panel and no floor picker: the active floor is a shared store
    cursor (`configStore.activeFloorIdx`, driven by the Sidebar's floor tabs).
    Entering the Graph enables edit mode only in the studio (not embedded/owner)
    so the shared panel is present.
  - Computed (generated) guides are **editable in House settings → Grids**:
    per-guide origin / spacing (literal-or-formula) + extent (int line counts), a
    **+ Add generated guide** button, and a live resolved-spacing readout.
  - Verified live (family_home): studio Graph select Living → studio panel with
    Connections (no handles/tools); embedded (`?panels=off`) Graph hint reads
    "edit the design in the WDL code" with selection disabled; shared floor
    cursor; `+ Add generated guide` → editable `module`, `spacing = House.W/8` →
    resolved (50, 30). editor tsc, full suite 564/564, parity 6/6.
- **Phase 4 — C11 "declared connection" constraint. DONE.**
  `editor/src/lint/constraints/c11_declared_connection.ts` (registered in the
  `CONSTRAINTS` array). For every `room.connections` pair it asserts the two rooms
  are **adjacent AND joined by a door**, with two `error` modes: not adjacent (no
  shared wall) and adjacent-but-no-door (no door opening lies on the shared wall
  span); a connection to a non-existent/inactive room is also flagged. Reads
  `ctx.resolved` (authored coords — `expand` clones before it converts, so a
  `center` pair shares a centreline exactly and an `outer` pair abuts/overlaps; a
  `tol` of one wall thickness absorbs the difference, so one test reads both
  conventions). The door check tests whether a `kind:"door"` opening on the facing
  wall (of either room) overlaps the shared span. Surfaces in `lintStructure` /
  `wadi_check` / the DSL status pill / the Graph canvas. Verified: 8 C11 fixtures
  (3 pass, 4 fail, 1 no-error-on-known-good) in the generic driver, editor tsc,
  full editor suite 571/571, parity 6/6, generated `conventions.md` (12 conventions).

## 10. Key files (Wadi)

- `editor/src/schema/houseConfig.ts` — `guides` (rename + generated mode + multi);
  `room.connections`.
- `wadi-dsl/src/language/wadi.langium` — `guides` + `grid` alias; `connect` in
  `Room`; generated-guide reference syntax.
- `wadi-dsl/src/generator/{toHouseConfig,fromHouseConfig}.ts` — round-trip.
- `editor/src/param/resolve.ts` — guide index accessor (`module.x8`).
- `editor/src/model/spatialModel.ts` — adjacency for the satisfied check (exists).
- `editor/src/lint/constraints/c11_declared_connection.ts` — new constraint.
- New studio view reusing the studio forms + resolver + the shared floor-planner
  engine (ported from `~/Code/floor-planner`).

## 11. Decisions / deferred

Decided:
- **Standalone app KEPT as an optional add-on (reversal of the earlier "retire"
  decision).** It is a useful blank-canvas STARTING point for a new house — sketch
  rooms + connections on a grid — which the in-app Graph view (a formula-aware
  editor over an EXISTING model) doesn't cover. It now lives in the repo at
  `floor-planner/` (built to `docs/planner/`, deployed at `/planner`) and EXPORTS
  a `.wadi` HouseConfig: rooms → `room` objects at `coord_convention: "center"`
  (touching rooms share a wall), edges → `room.connections`, the regular grid →
  a generated `guides module`, floors → `floors[]`, plot → `site`; scale = cell ×
  unitPerCell × per_unit(10). No walls/doors are emitted — C11 then points at the
  doors to add. Handoff: "⬇ Export .wadi" (download) + "Open in Wadi →" (stashes
  the config in `localStorage['wadi:handoff']` and opens `/app#handoff`, which the
  viewer reads once on boot). The `.wdl` path is free via the WDL editor's
  "↩ Import .wadi". The companion tools (WDL editor, Floor planner, Staircase
  explorer) now live behind a single header **Apps menu** (on-palette icons) and
  each opens in its OWN window on desktop (Tauri `show_tool`).
- **Generated-guide reference: both forms** — `module.x8` (integer shorthand) and
  `module.x(expr)` (fractional / negative / computed). Offsets are plain
  arithmetic, not an index feature (§4).
- **C11 checks adjacency AND a door**, two error modes; no auto-doors (§7).
- **Guides render in the 2D floor plan** (continuing current practice), NOT in the
  3D model. Named guides draw as an architectural grid; a module grid draws its
  uniform lines within `extent`.

Deferred (not blocking Phase 0/1):
- **Cross-floor connections (stair links).** Same-floor only in v1. A staircase is
  itself the cross-floor connector; design that alongside cross-floor connections
  later.
- Opt-in door generation from a connection (`connect A via door`) — only if it
  proves wanted; C11 validation comes first.
