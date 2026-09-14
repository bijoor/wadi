# Room templates + auto-furnishing in Wadi

Status: PLANNED (design only). No code yet. Respects the submission freeze.

This folds two designs into one effort, because they only make sense together:

1. Bring the floor-planner's **room-template auto-placement engine** into the main app.
2. Give it a safe home in the language: a **`furniture` block** as the owned output region, and a
   **`locked`** attribute as universal protection for hand edits.

Shipping the engine without the language contract would let a tool scatter items through the WDL
and erode Wadi's core invariant: the `.wdl` is the source of truth and stays fully editable by a
human in a code editor or a coding agent. So the language surface is part of the same effort, not a
follow-up.

Governing rule (worth stating as a first-class convention, see "The convention"):

> Automated edits operate only inside explicit, named, owned regions, and never modify a `locked`
> element. Everything stays plain, hand-editable WDL.

---

## Scope decision: automate furniture only (2026-09-14)

The floor-planner's room template bundles two different things: a **furniture layout** and
**per-room wall heights** (verandahs and balconies get low parapet walls). When we bring templates
into Wadi, only the **furniture** becomes auto-managed. Wall heights stay structural and
hand-owned.

Why, in terms of the invariant above:

- **Furniture is a bounded, owned output region** (the `furniture` block). It has a real
  placement/fit problem, it is many items, and it is disposable output a tool may re-run,
  materialize, and regenerate. Continuous automation belongs here.
- **Wall heights are structure**, authored on the room's walls (`wall_heights[side]`). They are few,
  deliberate, and exactly the hand-edits the invariant protects. If the engine wrote wall heights it
  would be editing outside an owned region and modifying structure — the thing "edit only inside
  explicit owned regions" exists to prevent. There is also no algorithm to run: a parapet height is
  a one-line fact, not a fit problem.

Keep the floor-planner's ergonomics by separating **seed-once-at-creation** from **manage-
continuously**:

- Ongoing automation → **furniture only** (the autoplace engine + `furniture auto`).
- A verandah/balcony low wall height may still come from the template as a **one-time default
  stamped when the room of that type is created**, which the user then owns and edits like any other
  hand-authored value. That is a creation-time default, NOT the auto-engine touching structure. The
  main app already supports per-side wall heights structurally (used for the composed-wall
  verandah/parapet work), so this is only a decision to seed a default, not new machinery.

Consequence for this plan: the engine (Part 1), the `furniture` block (Part 2), and `furniture auto`
(Phase 4) manage furniture and nothing else. A room-type wall-height default, if we want it, is a
separate creation-time seed and is explicitly out of scope for the auto-engine and its `locked`
contract.

---

## Where things stand (the key realization)

The capability is three parts, and two are already Wadi-native:

| Part | Where it is today | Main-app status |
|---|---|---|
| Furniture assets (GLBs) + the `item` primitive | `std-furniture.wdl`, registry `item` node | already in Wadi |
| The template pack (`rooms.wdl` -> layouts) | a DSL std-module | already a Wadi DSL module |
| The **selection + placement engine** | floor-planner (`roomModules.js` + `furnitureFit.js`) | to be ported |

The main app already **renders** anchored furniture. That is exactly how the planner's `.wadi`
export works: it writes anchored `item`s into rooms and Wadi draws them. So this is not "add
furniture to Wadi." It is "move one pure algorithm into `editor/src`, and give it a language
surface that keeps the WDL editable."

---

## Part 1: the engine (autoplace)

Port `roomModules.js` plus the algorithmic parts of `furnitureFit.js` into
`editor/src/furniture/autoplace.ts`, rewired onto the app's **real** geometry.

- **Delete the mirror.** `furnitureFit.js` is a copy of `editor/src/svg2d/furnitureAnchor.ts`
  (`anchorItem`) plus units, written so the planner did not have to import the pipeline. That
  duplication is what caused the rotation bug we fixed. In the main app the engine runs on the real
  `anchorItem` / `expandRoomWalls` geometry, so it gets smaller and more correct and the drift risk
  is gone.
- **Portable, pure algorithms** (move as-is): four-rotation fit, door-overlap scoring, shift-then-
  drop placement, maximize furniture kept, gaps as soft conflicts. These are geometry-agnostic and
  well tested.
- **Door and gap intervals come from the room's real openings** (which walls carry a door or gap
  and where), not from the planner's room-graph inference. Cleaner and more precise here.
- **Optionally reuse the spatial layer** (`editor/src/model/`, `@flatten-js/core`) for overlap and
  opening checks instead of the mirror's AABB math, for non-rectangular accuracy later.
- **Rectangular rooms first.** The anchor/placement model assumes axis-aligned rectangles. v1
  auto-furnishes rectangular rooms only; diagonal / L-shaped / complex rooms are a later extension.

The engine's output is a set of anchored `item`s. Nothing downstream changes to render them.

---

## Part 2: the language surface, the `furniture` block

The engine needs a declared place to write, so its edits are localized and idempotent.

### Syntax

`furniture` is a CONTAINER primitive. Its metadata — `auto <type>` (engine-managed, of this room
type) and `locked` — sits on the block header; its CHILDREN are the placed `item`s. It is one form
with optional metadata, not two separate forms. `auto <type>` on an empty body means "resolve at
render"; after MATERIALIZE the engine fills the body and keeps the tag.

Auto, not yet materialized (resolve at render from the room's type, size, and openings):

```
room "living" {
  // structure: walls, openings, built-ins ...
  furniture auto bedroom
}
```

**Room type lives on the `furniture auto` statement.** WDL has no room-type facility today (a
room's string is an id, not a type: `room "kids_bedroom"` can be a bedroom). The template engine
needs a type to pick a layout, and furniture is the type's ONLY automated consumer (we dropped
wall-height automation), so the type belongs where it is used rather than as a first-class room
field. `furniture auto <type>` reads as "auto-furnish this room as a `<type>`", where `<type>`
names a template in the pack (`rooms.wdl`). Notes:

- **Explicit and validated.** The type is given explicitly and checked against the template pack (a
  lint/validation warning on an unknown type). Bare `furniture auto` MAY infer the type from the
  room name, but only when the name matches a known template; explicit is the contract, inference is
  a convenience.
- **Pure metadata.** Like `locked`, the type carries no geometry and the resolver/`expandRoomWalls`
  read it only to drive placement, so it cannot move the parity gate.
- **Future promotion.** If a broader room-type need emerges (the 2D filter's Bedrooms/Bathrooms
  grouping, quantities-by-type, the planned C11 adjacency constraints), the type can be promoted to
  an optional `room` field later — cheap, since it is additive-optional metadata — and bare
  `furniture auto` would then read the room's type. Out of scope for now.

The SAME block, MATERIALIZED — the engine filled the body and kept the `auto bedroom` tag so it can
refresh later. Lock the whole block (`... locked`) to freeze it, or lock a single `item` to keep it
through a refresh:

```
room "living" {
  furniture auto bedroom {
    item f."sofa" anchor bottom-center gap (0, 6) locked   // pinned across a refresh
    item f."tv_unit" anchor top-center gap (0, 6)
  }
}
```

Plain hand-authored furniture the engine never touches (no `auto`):

```
room "living" {
  furniture {
    item f."sofa" anchor bottom-center gap (0, 6)
  }
}
```

"Materialize" fills an `auto` block's body from the room's type, size, and openings; the block keeps
its `auto <type>` tag and stays the same owned region.

### Semantics

- The children are the **same `item` primitive**. `furniture` is a CONTAINER (scope + ownership + the
  `auto`/type/`locked` metadata), not a new item type. This resolves the "container vs role-tag" open
  decision toward a container: block-level `auto <type>` and block-level `locked` need a home a
  role-tag on items cannot give them.
- Flattening is unchanged: a `furniture { items }` body expands like a room's nested items today, so
  2D/3D rendering and the parity gate are unaffected.
- **Expand runs the engine ONLY for an empty `furniture auto`** (the dynamic case), **version-gated**
  so existing configs stay byte-identical. A materialized body (`furniture auto <type> { items }`)
  renders its items as-is — expand never re-runs the engine for it, so it is parity-safe. Re-placing
  a materialized block is an explicit "furnish/refresh" command, never a render side effect.
- **Locking, two granularities:** `furniture … locked { }` freezes the whole block (never
  regenerated); `item … locked` inside pins one piece (a refresh preserves it and routes the rest
  around it). See Part 3.
- **Ownership contract:** a tool writes only inside a `furniture` block, may replace an unlocked
  `auto` block's generated body, and never touches anything outside it.

---

## Part 3: edit protection, the `locked` attribute (universal)

`locked` is an optional boolean **any element** can carry. It means: no automated tool may edit,
move, or delete this element. It is a tool boundary, not a human one. A person or agent editing by
hand may still change a locked element or remove the flag. Locking is how you tell the machine
"leave this exactly as I wrote it."

### Syntax (trailing flag on the object header)

```
room "living" locked { ... }                 // freeze a whole room from tools
furniture locked { ... }                       // freeze this furniture block (no regeneration)
item f."sofa" anchor bottom-center locked      // keep this one piece across a regeneration
wall ... locked                                // a hand-placed wall a refactor must not move
```

### The tool contract

Every automated writer (autoplace/furnish, configurator emitter, planner export, refactors, a
coding agent acting as a tool) obeys:

1. Do not modify a locked element's own properties.
2. Do not delete a locked element.
3. Do not regenerate the contents of a locked container (`furniture locked { }` is never
   re-furnished; `room ... locked` is left alone).
4. When regenerating a container that is not itself locked, preserve any locked descendants in
   place and route generated content around them.

That covers both granularities with one attribute: lock the block to freeze it whole (rule 3), or
lock a single item to keep it through a block regeneration (rule 4).

### Enforcement

- `locked` is **metadata**. The resolver and `expandRoomWalls` ignore it: it changes no geometry,
  so it cannot affect parity.
- Enforced at the few known **edit sites**: the planner `toWadi` export, the configurator emitter,
  `emitWdl`, and the autoplace/furnish command. Each checks `locked` before writing.
- For a **coding agent**, `locked` is a documented convention surfaced through the architect skill
  and the MCP reference, so an agent editing `.wdl` honors it.
- Optional defensive **lint** (a constraint under `editor/src/lint/constraints/`): warn if a
  generated region would have overwritten a locked element (a tool-bug tripwire).

### Interaction with `furniture auto`

`auto` (resolve-time behavior) and `locked` (tool-edit prohibition) are orthogonal.
`furniture auto locked` is coherent (auto-resolves at render, but no tool may materialize or change
it). The recommended v1 forms are `furniture auto` (fully tool-managed) and `furniture locked { }`
(a hand-tuned frozen block); combining is allowed but not the default guidance.

---

## The convention

Add one entry to the generated conventions (alongside C1 to C10), so it governs every future
auto-managed section, not just furniture:

> **Managed regions and `locked`.** Automated tools edit only inside explicit, named, owned regions
> (a room's `furniture` block, the `configurator`). A tool must not modify, delete, or regenerate
> any element marked `locked`, and when regenerating an unlocked region it must preserve locked
> descendants. All output remains plain, hand-editable WDL.

---

## Rollout (unified, protection first)

1. **`locked` attribute.** Schema (`locked?: boolean` on the base object shape, additive-optional)
   + grammar (a shared trailing flag) + honor it in the existing writers (planner `toWadi`,
   configurator emitter, `emitWdl`). Add the convention entry and the agent note. Cheap, and it
   immediately protects hand edits against the tools that already write WDL.
2. **Engine port.** `roomModules` + algorithmic `furnitureFit` -> `editor/src/furniture/
   autoplace.ts`, rewired onto `anchorItem`/`expandRoomWalls`; delete the mirror. Pure module with
   unit tests carried over. No pipeline change, so no parity risk.
3. **`furniture` block, explicit form + a "furnish room" command.** Grammar + schema +
   expand-as-nested-items + decompile. A studio command runs the engine for the selected room
   (type + size + real openings), materializes the pieces into the room's `furniture { }` block,
   and honors `locked`. Point the planner export at the block too. Rectangular rooms only. This is
   the low-risk MVP that delivers most of the value: pick a room type, furnish it, then hand-tune.
4. **`furniture auto` dynamic resolve.** Expand-time placement, version-gated for parity, with
   `materialize` writing back into the block for anyone who wants explicit items.
5. **Extensions.** The optional lint tripwire; non-rectangular rooms; the layout editor we built
   becoming a studio surface for authoring template packs (user-library authoring already exists in
   the main app).

Phases 1 to 3 are the core and are low risk. Phase 4 touches `expand.ts` and needs the version gate
held to 6/6 byte-identical.

---

## Layers touched (file-level)

- Grammar: `wadi-dsl/src/language/wadi.langium` (the `furniture` block, `auto`, the `locked` flag).
- Schema: `editor/src/schema/houseConfig.ts` + `schema/fields` (`locked`, furniture container or a
  `role: "furniture"` tag). `reference/data-model.md` regenerates from it.
- Expand: `editor/src/svg2d/expand.ts` (flatten `furniture`; run autoplace for `furniture auto`,
  version-gated).
- Engine: new `editor/src/furniture/autoplace.ts` (+ tests) built on `svg2d/furnitureAnchor.ts`.
- Emit / decompile: `emitWdl`, the configurator emitter, the planner `toWadi` (write into the block;
  honor `locked`).
- Lint (optional): a new constraint module + regenerated `reference/conventions.md`.
- Agent surface: the architect skill note and the MCP reference.

---

## Open decisions

- **Syntax placement of `locked`**: trailing flag on the object header (shown) vs a property. Flag
  reads best and matches other modifiers.
- **Furniture in the schema**: DECIDED — a distinct `furniture` CONTAINER, because block-level
  `auto <type>` and block-level `locked` metadata need a home a `role: "furniture"` tag on items
  cannot provide. The body is a list of the same `item` primitive.
- **Agent enforcement strength**: convention-only vs a pre-write check in the MCP editing tools.
  Start convention-only; add a check if a tool is observed crossing a lock.
- **Where the template pack lives** for the main app: resolve `rooms.wdl` through the existing
  module resolver, or ship the compiled `roomLayouts.json` equivalent. The module path keeps one
  source of truth.
- **Room type home**: on the `furniture auto <type>` statement (decided, MVP) vs a first-class
  optional `room` field. Start on the statement; promote to a room field only if the
  Bedrooms/Bathrooms filter grouping, quantities-by-type, or C11 adjacency start needing it.
- **Bare `furniture auto`**: require an explicit type vs infer from the room name when it matches a
  known template. Decided: explicit is the contract; name-inference is an optional convenience.

## Non-goals / risks

- Non-rectangular rooms in v1 (rectangular only; extend later).
- The parity gate must stay 6/6 byte-identical; only `furniture auto` (Phase 4) can affect it, and
  only behind the version gate.
- Keep the engine a thin, pure module; do not fork the item model.
