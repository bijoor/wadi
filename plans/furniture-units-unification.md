# Furniture Units — unify items, counters, and composite modules (plan for review)

## Why

Wadi has **three kinds of furniture handled inconsistently**. Only GLB items are
fully first-class. The kitchen `counter` is engine-ready but not in the catalog.
Composite **modules** (a `component` with several items, e.g. the tiny house's
dining table + chairs) have no footprint, can't live in a room, and are pinned to
absolute floor coordinates.

| Kind | Example | Footprint from | In a room? | In catalog? | Placed by |
|---|---|---|---|---|---|
| GLB item | bed, chair | `asset.dimensions` (item.tsx:107) | ✅ `furniture.items` | ✅ | anchor + gap |
| Parametric element | kitchen `counter` | `furniture.footprint` (counter.tsx:77) | ✅ `furniture.counters` | ❌ | anchor + gap |
| Composite module | dining set (`component`) | — none | ❌ floor-level `use … at (x,y)` | ❌ | absolute x/y |

Concretely, the tiny house does this (model.wdl:164), at FLOOR level, beside — not
inside — the Living room:
```
use dining_table_with_chairs at (main.x3 + 10, main.yC - 15) rotation 90
```
It doesn't anchor to Living, doesn't adapt when Living resizes, isn't validated
against the room, and is invisible to the furniture-catalog tool.

**Goal:** one **"furniture unit"** abstraction — *anything with a footprint that a
room places by anchor + gap* — so items, counters, and modules are uniform: all
catalog-available, all room-placeable, all auto-furnishable, all editable in the
composer.

## The good news: the abstraction already exists

A **furniture unit = a registry node with a `furniture` capability**:
```ts
// editor/src/registry/types.ts:113-119
furniture: {
  footprint: (obj, ctx: { units?; wallSpan? }) => { w: number; l: number } | null; // PROJECT UNITS, pre-rotation
  placement?: "wall" | "corner" | "free";
}
```
- `item` (item.tsx:107) and `counter` (counter.tsx:77) both provide it.
- Expand places ANY furniture-capable node by anchor+gap via `resolveElementAnchor`
  (expand.ts:276-301) — reads `getNode(type).furniture`, computes the wall span,
  `anchorByFootprint`, writes back x/y/rotation. Used for room-nested counters
  (expand.ts:445-449) and free `anchor_to` elements (expand.ts:393-404).
- The auto-placer already honors parametric footprints: `Piece.footprint` +
  `Piece.placement` exist (autoplace.ts:58-60) and `pieceBox` (autoplace.ts:207)
  uses them verbatim.

So making modules first-class is mostly **"give a module a footprint capability and
a room-container home,"** then teaching the catalog + the auto-furnish producer
about non-GLB kinds. No new engine.

## Design decisions (for review)

### D1 — A module's footprint = the bbox of its expanded children

Derive an axis-aligned `{w, l}` (project units, module-local frame) by expanding the
component body (`expandComponentDef`, expand.ts:592) and unioning each child's
footprint polygon via `footprintRings` (spatialModel.ts:93) + `aabbOf` (geom.ts:167).
Cache per (component, resolved params). `anchorByFootprint` already makes the
placement yaw-aware, so rotation needs no special footprint handling.

**Recommendation:** derive it wherever a component is placed as furniture (see D2) —
no per-module qualifier needed.

### D2 — ANY component is placeable in a room by anchor+gap (no "furniture" qualifier)

**Decision (revised).** Do NOT gate this behind a "furniture component" marker or an
`expose as … furniture` opt-in. Nothing in the placement machinery needs it:
- **Footprint** = the bbox of the component's expanded children (D1) — kind-agnostic
  (works whether children are chairs, a wall, or a pillar).
- **Render** — `placeComponent` (expand.ts:522) already stamps a component's children
  at an arbitrary offset + yaw for every object type, so anchoring a component to a
  room wall is just computing that offset from anchor+gap instead of `at (x,y)`.

The only real constraint is **natural, not artificial**: `placeComponent` already
refuses non-orthogonal rotation of a component containing structural objects
(rooms/walls/pillars) — only `item`/`wall` tilt freely (expand.ts:498, :651). A
pure-furniture module rotates to any angle; a module with a partition wall snaps to
0/90/180/270. Falls out of geometry; applies equally to today's floor-level `use`.

**Shape:** give the plain component instance an **anchor+gap placement option** (like
the free counter's `anchor_to`, houseConfig.ts:644) usable when it targets/nests in a
room, plus a derived bbox footprint. No expose-as-furniture, no promoted typed
primitive required for furniture purposes.

**Catalog curation is separate from placement.** "Any component *can* be placed" ≠
"every component *appears* in the catalog." Structural building-block components can be
placeable yet unlisted; the catalog surfaces a curated set (a module pack + maybe
in-file components). A UI/library decision, not a schema restriction.

Rejected: a bespoke per-module code NodeDefinition (modules are data, not code); a
"furniture component" qualifier (unnecessary constraint); requiring `expose as`.

### D3 — A room-container home for counters + modules

The furniture container (`furnitureBlock`, houseConfig.ts:280) holds only `items` +
`counters`; a `component`/`use` cannot nest in a room today (houseConfig.ts:677-695).

**Recommendation:** add a generic **`furniture.elements`** list that holds anchored
instances of ANY furniture-capable node (counter, exposed module, future parametric
furniture): `{ type, anchor, gap_x, gap_y, rotation?, scale?, ...fields }` (a loose
record like component `params`). Flatten it with a branch mirroring the counter
flatten (expand.ts:445-449): for each element, `resolveElementAnchor` (footprint from
the node's capability) then the node's own `expand`/render. Keep `counters` for
back-compat (or migrate counters into `elements` later).

Smaller-first alternative: a dedicated `furniture.modules` list parallel to
`counters`. Less unified but a smaller schema step. **Open question below.**

### D4 — Rotation of a module's children

`placeComponent` (expand.ts:522) rotates a component's children rigidly, but the yaw
bump at expand.ts:554 only adds the component yaw to `item` and `model` children — a
`counter` nested inside a rotated module would keep its own facing. Furniture modules
today are items-only (fine), but if a module nests a counter, add `counter` to that
list (or handle module-level rotation generically). Note in the plan; verify with a
counter-in-module fixture.

### D5 — WDL grammar + emit for room-nested furniture units

Nesting an element/module in a room's furniture container needs Langium support
(grammar + emit + the compiler round-trip), like the counter's room-nested form. A
minimal surface: `use <module> anchor <a> gap (x,y) [rotation r]` and
`counter … anchor …` inside a `furniture { }` / room block. This is the biggest
cross-cutting cost; scope it in Phase B. (The composer writes JSON via `updateObject`,
so the app works before the grammar lands; the grammar is needed for authoring +
`.wadi`↔`.wdl` round-trip.)

### D6 — Catalog as a tagged union; auto-furnish producer

- Catalog (catalog.ts:52) generalises from GLB-only `FurnitureSpec` to a tagged union:
  `{kind:"item", …}` | `{kind:"element", type:"counter", defaults}` |
  `{kind:"module", ref}`. The panel adds the right container entry per kind and gets
  each footprint uniformly (item dims / counter capability / module bbox).
  **Target end-state (see D7):** collapse `element` into `module` so the catalog is
  just `{item, module}` and the counter is a curated module.
- Auto-furnish: the Layout producer (`itemToPiece`/`roomPieces`/`piecesToItems`,
  roomLayouts.ts:63-82) only reads/emits asset items. Extend it to carry counter +
  module identity so `furnishRoom` can auto-place them (the engine already can).

### D7 — Counter (and any parametric furniture) as a MODULE — the unifying target

The counter is *code* (a registry node with procedural `render3D`); a module is
*data* (a component). They can meet through the mechanism Wadi already uses
everywhere: **module params → formulae driving embedded objects.** A curated module
wraps the counter primitive and exposes friendly params:
```
component kitchen_counter {
  params { length "Length"; depth default 22; height default 36; cabinet default 1 }
  counter length =length depth =depth height =height cabinet =cabinet
}
```
The catalog then lists it as one more module; the counter stops being a special
catalog "kind."

**What this buys:**
- The composer stops hardcoding counter fields (as Phase A does). It renders a
  module's **declared params** generically, so every future parametric module edits
  for free and the Phase-A `element` special-case is retired.
- **Composite parametric modules** become expressible — a "kitchen unit" = counter +
  wall cabinets (GLB) + sink, all sharing one `length` param via formulae. This is the
  real payoff; the bare counter is just the simplest instance.

**Clarity:** this does NOT remove the counter code. The counter's geometry is
procedural and a component only *composes* existing objects, so the module is a thin
**parametric wrapper around the counter primitive**, not a replacement.

**Resolved design edge — no wall-span context propagation needed.** The counter today
auto-fills `length` to the whole wall span (via `ctx.wallSpan`), which only works
because it is anchored *directly* to a room wall. Through a module wrapper the counter
is one level removed and wouldn't know its wall. **Decision: full-wall auto-length is
NOT required** — a module (and the counter) takes an **explicit length**. This drops
the hard part (propagating room+anchor context across the component boundary). It also
means the standalone counter's auto-length default is a convenience we can simplify or
drop; not a feature the module design must preserve.

**Sequencing:** build D2/D3 (any component placeable in a room by anchor+gap, bbox
footprint) FIRST; the counter-as-module and the generic param editor then fall out on
top. Until then the counter stays the Phase-A `element` path.

## Phasing

**Phase A — Kitchen counter in the catalog (B2 from the old plan). ✅ DONE (shipped).**
No expand/grammar change (counters already flatten + anchor-place). Validated the
catalog abstraction. A stepping stone: the counter is a special `element` kind with
hardcoded fields today — folded into the module path in Phase E.
- Tagged catalog kind (`item` | `counter`); a "Kitchen counter" element entry.
- Composer: `seedDraft` reads `furniture.counters`; a counter draft piece's canvas
  footprint = length×depth (auto length = wall span); counter controls
  (length/depth/height + cabinet/sink/hob); Apply writes `furniture.counters` and
  clears direct items+counters. (See D7: full-wall auto-length now considered NOT
  required — can be simplified.)

**Phase B — ANY component placeable in a room by anchor+gap (D1, D2, D3).**
- Bbox footprint for a component (D1) + anchor+gap placement of a plain component
  instance targeting a room (D2 — no furniture qualifier, no expose-as).
- Room-container home (D3 schema) + expand flatten branch + D4 rotation check.
- D5 grammar/emit for room-nested/anchored components.

**Phase C — Catalog `module` kind + composer (D6).** Curated module entries (a
built-in module pack + in-file components); composer adds/edits module pieces (footprint
from bbox). Composer renders a module's **declared params** generically.

**Phase D — Auto-furnish for counters + modules (D6 producer).** Templates in
rooms.wdl can then include counters/modules, and `furnishRoom` places them.

**Phase E — Counter (and parametric furniture) as a module (D7).** Wrap the counter
primitive in a curated `kitchen_counter` module (params → formulae); catalog lists it
as a module; retire the Phase-A `element` special-case; enable composite parametric
modules (kitchen unit = counter + cabinets + sink sharing a `length` param).

**Phase F — Migration + module library.**
- Offer to migrate a floor-level furniture `use` whose footprint lies inside a room
  into that room's furniture container as an anchored module (dining set → Living),
  alongside the existing items→container migration.
- A built-in composite-furniture pack (dining/sofa/bed sets); catalog discovery of
  modules from imported packs + in-file exposed components; groundwork for the
  shareable-module / marketplace track (its own design).

## Open questions

1. **D3 shape:** one generic `furniture.elements` list (unifies counters + modules,
   loose per-type records) vs a dedicated `furniture.modules` list parallel to
   `counters` (smaller, less unified). Recommendation: generic `elements`, but it is
   the larger schema+grammar change — worth it?
2. **Module source for the catalog:** built-in pack only, in-file exposed components
   only, or both? (Affects when the marketplace track is needed.)
3. **Counter migration:** fold `counters` into the generic `elements` list eventually,
   or keep it forever for back-compat?
4. **Standalone counter auto-length:** full-wall auto-length is deemed unnecessary
   (D7). Simplify the standalone counter's default to an explicit length now, or leave
   it until the counter-as-module work? (Small, separable UX change.)

## Status / decisions log

- **Phase A shipped:** kitchen counter is in the catalog as an `element` kind.
- **Decided (D2):** allow ANY component in a room by anchor+gap; NO "furniture
  component" qualifier and NO expose-as-furniture. Footprint = bbox; render =
  place-at-offset; both kind-agnostic. Only constraint = orthogonal rotation for
  structural content (already enforced).
- **Decided (D7):** the counter becomes a curated **module** (params → formulae
  wrapping the counter primitive); the composer renders declared params generically;
  the Phase-A `element` case is later retired. Full-wall **auto-length is NOT
  required** → module/counter take an explicit length → no wall-span context needs to
  cross the component boundary.
- **Not implementing any of B–F yet** — captured for when the modules track resumes.

## Non-goals (this plan)

Shareable-module marketplace/online sharing (separate track); a bespoke NodeDefinition
per module; reworking the auto-furnish engine (it already handles parametric
footprints); changing how GLB items work.
