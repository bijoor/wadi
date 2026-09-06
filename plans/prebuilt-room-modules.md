# Plan: Prebuilt parametric room modules (graph → composed layout)

Status: PROPOSED (for review). Do AFTER configurable guides.

## Goal

A library of predefined, parametric room modules — dining with table, bedroom (single
/ double bed), verandah, balcony, staircase, bath, kitchen, etc. — that the
floor-planner graph can instantiate per room. The graph becomes a fast layout tool:
draw the room-graph, pick a type per room, export a furnished, fixture-complete `.wadi`
that you then refine in WDL (agent) or via the configurator.

## What already exists (so we build, not invent)

- **In-file components + instances**: `componentDef` (params/vars/points/objects,
  local coords) and `component` instances (`ref`, `params`, `x`, `y`, `rotation`) —
  `editor/src/schema/houseConfig.ts` (~649-691, 488-508); expanded by
  `expandComponentDef` + `placeComponent` in `editor/src/svg2d/expand.ts` (~515-614).
  Param precedence: defaults < component vars < instance overrides; params may be
  formulas evaluated in the HOST scope (so they can reference guides).
- **DSL `use` + imports**: `use ns.Comp at (x,y) with { … }`, `import "ref" as ns` —
  `wadi-dsl/src/language/wadi.langium`; project linking + `resolveModule` in
  `toHouseConfig.ts` (~845, 870-929).
- **A room-component pack already exists**: `wadi-dsl/std-modules/konkan/base.wdl` has
  goal-tagged room components (Stairwell, Verandah, Otla, Bathroom, Kitchen, …)
  authored flat in local coords — the direct template for this library.
- **Typed-primitive promotion**: `component X expose as pack.type` → a runtime
  `NodeDefinition` (addable, params→fields) via `editor/src/registry/promote.ts`,
  registered at load before validate/expand.
- **User library = the model's `modules` cache** (import ref → `.wdl` source),
  persisted and bundled into `.wadi`; resolveModule chains custom cache → std packs
  (`editor/src/io/wdl.ts` ~60, `io/stdModules.ts`). The 📚 Library menu manages it.
- **Room-anchored furniture**: `room.items[]` = `{asset, anchor(9-pt), gap_x, gap_y,
  rotation, scale}` with NO x/y — positions derive from the room's inner footprint at
  expand time, so they **reflow when the room resizes** (`houseConfig.ts` ~216-231).
- **Std furniture assets**: `wadi-dsl/std-modules/std-furniture.wdl`.

## The core design decision: walls stay graph-owned; modules supply CONTENTS

We just built the graph→walls system (shared walls, gaps, corner joins, guide-driven
formulas). That must stay the owner of each room's **rectangle + walls + doors + gaps**.
So a room module does **not** redraw the room; it supplies the room's **interior**:

- **Furniture** (bed, table, sofa, chairs) — `item` assets.
- **Inbuilt fixtures** (staircase, kitchen platform, WC/wash basin, parapet/railing for
  verandah/balcony) — first-class objects (`staircase`, `kitchen`, `pillar`, …).

The graph node's **type** selects the module; the module is **parametrized by the
room's size** (width/length, guide-derived) and **entry side** (from the room's door/
gap) plus **feature flags** (bed size, seats, furniture on/off).

### Emission (primary): a component instance per typed room
For a typed room, the planner emits — alongside the graph room it already emits — a
`use <RoomModule> at (<room origin>) with { width: <guide expr>, length: <guide expr>,
entry: <side>, …flags }` component instance. `at` and the size params are **guide-
derived formulas**, so the contents reflow when a guide moves (ties directly into the
configurable-guides plan). `rotation` orients the module to the entry side (right-angle
only — rooms are axis-aligned, so fine).

Furniture inside the module is placed with **local formulas on width/length**
(`item bed at (width/2 - bedW/2, length - clearance) …`), the konkan-pack style. This
is the price of keeping walls graph-owned: a bare component has no `room`, so it can't
use the 9-point room anchor system; params drive reflow instead. (See Alternative.)

### Alternative (for pure-furniture rooms): splice into `room.items[]`
For modules that are *only* furniture (no fixtures), the planner could instead merge an
anchored-items template into the graph room's `items[]`. That gets **perfect** anchor-
based reflow for free and composes cleanly with graph walls — but it can't carry
non-item fixtures (staircase/platform are floor objects, not room items), and it's a
planner template rather than one editable WDL unit. Proposal: support this as a
lightweight path for furniture-only types, and use the component `use` path for types
with fixtures. Decide during P0 which types are furniture-only.

## Library shape

- A bundled pack `rooms/base.wdl` (or extend `konkan/base.wdl`) of room-content
  components: `Dining`, `BedroomSingle`, `BedroomDouble`, `Verandah`, `Balcony`,
  `Staircase`, `Bath`, `Kitchen`, `Living`. Each `component … goal "…" expose as
  room.<kind> { param width, length, entry, …flags; <items + fixtures via local
  formulas> }`. `goal` tags feed discovery (MCP/library search).
- User-authored room modules ride the existing `modules` cache + 📚 Library menu and get
  bundled into `.wadi`, so a planner export is self-contained.

## Phasing

- **P0 — Author the pack (WDL, no app code).** Write 4-6 room-content components
  (furniture-only + fixture-bearing) parametric on width/length/entry, reusing
  std-furniture. Validate via the architect skill / `wadi_check`. This proves the
  abstraction before touching the planner.
- **P1 — Planner data model + picker.** Add `roomType` (+ per-type `params`) to the
  graph room (`store/initialState.js` `normalizeModel`), a **Room type** dropdown +
  param controls in `RoomEditor` (`components/Sidebar.jsx`) dispatching `UPDATE_ROOM`.
  Populate the dropdown from a static list first, later from the catalog.
- **P2 — Planner export.** In `floor-planner/src/export/toWadi.js`, for a typed room:
  keep the graph room (walls) and add the `use <type> at (roomOrigin) with { width,
  length, entry, …params }` instance (guide-derived formulas); derive `entry` from the
  room's door/gap side; seed the model's `modules` with the room pack import so the
  export is self-contained. (Furniture-only types: splice `items` instead, per the
  Alternative.)
- **P3 — Typed primitives + studio parity (optional).** `expose as room.<kind>` so the
  same modules are first-class placeable types in the studio (via `promote.ts`), and
  MCP/library discovery by `goal`. Now the graph, the studio, and an agent all speak the
  same room vocabulary.
- **P4 — Library UX.** Browse/insert room modules from the 📚 menu and the planner
  picker (read the catalog); user authors a new room module → it appears in the planner.

## Files touched

- `wadi-dsl/std-modules/rooms/base.wdl` (new) — the room-content pack (P0).
- `editor/src/io/stdModules.ts` — register the new std pack (P0/P2).
- `floor-planner/src/store/initialState.js`, `store/reducer.js` — `roomType`/`params`
  on rooms (P1).
- `floor-planner/src/components/Sidebar.jsx` — Room type picker + param controls (P1).
- `floor-planner/src/export/toWadi.js` — emit `use`/items + seed `modules` (P2).
- (P3) `editor/src/registry/promote.ts` path is already generic; mainly authoring
  `expose as` in the pack + catalog wiring.

## Gotchas (from the code map)

- **Component rotation is exact only at right angles** unless the body is item/wall-only
  (`expand.ts` ~421, 574-583). Room modules with fixtures must use 0/90/180/270 — fine
  for axis-aligned rooms.
- **Exposed types must be namespaced and non-colliding**, or the whole load's plugin
  registration fails (`promote.ts` ~141-152). Use `room.<kind>`.
- **Imports need a `resolveModule`**; the planner must seed `modules` (or bundle the
  pack) so the exported `.wadi` resolves offline.
- **`toWadi` currently drops all furniture** and emits bare rooms; P2 is where it learns
  to emit contents.
- **Bare components can't use room-anchor reflow** — furniture reflows via param-driven
  local formulas (or use the room.items splice for furniture-only types).
- Entry side must be derived consistently from the graph's door/gap placement so a bed
  doesn't block a doorway.

## Open questions for review

1. Component `use` per room (unified, matches "WDL components in a library") vs splicing
   anchored `items` (better reflow) — or the hybrid proposed (fixtures→`use`, pure
   furniture→items)?
2. Which room types for the first pack, and which are furniture-only vs fixture-bearing?
3. Should typed-primitive `expose as room.<kind>` (studio parity) be in scope early
   (P3) or deferred?
4. Do we auto-pick a default module per graph room by name heuristic (a room named
   "Kitchen" → `room.Kitchen`), so existing graphs light up without manual typing?
5. Parameter surfacing: which params are auto (size, entry) vs user-facing in the picker
   (bed size, furniture on/off, seats)?
