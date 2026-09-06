# Plan: First-class guides + configurable bays (scale & tune the house)

Status: PARTIALLY SUPERSEDED. The guide + snapping substrate (Phase A guide model,
canvas rendering, snap-to-guide) shipped in 1b75a17 / 225204c and stays. The
**configurable-bay** layer below (naming inter-guide gaps -> knobs) is REPLACED by
`plans/room-size-variables.md` (bind named variables to room dimensions instead).
Read that plan for the current configurable design; the bay sections here are history.

## Goal

Turn the planner into a layout tool where the structural skeleton is explicit and
homeowner-friendly: a house is shaped by **guides** (named division lines) and **bays**
(the spans between them, named like "Living width"). Rooms bind to guides; marking a bay
editable makes it a configurator knob, so a homeowner reshapes the house by dragging
room sizes, not coordinates. Because every room/slab/opening already references the
guide lines, moving a guide re-flows the whole model.

## Three concepts (keep them distinct)

- **Grid** — the fine snapping pitch. A pure editing aid for free placement. Unchanged.
- **Guide** — a named line (x or y) that room edges bind to. The structural skeleton.
  First-class, persisted, editable (new; today it's only derived at export).
- **Bay** — the span between two adjacent guides on an axis, with a **name** and an
  **editable** flag. Editable bay → a configurator variable/knob; fixed bay → a
  constant. Line positions are the cumulative sum of bays from an origin, so widening an
  editable bay pushes everything after it (the house grows, no overlap).

## Binding: snap-to-guide (this is "grid as a constraint")

- Dragging/resizing a room edge **snaps to a nearby existing guide** (the room *shares*
  that guide), else snaps to the fine grid and **auto-creates a guide** there.
- A room stores which guide each of its four edges binds to. Moving a guide moves the
  bound edges and nothing else. This is a shared-coordinate model, **not a solver** —
  that is what keeps the complexity flat.
- Guide-first or rooms-first both work: a corner on an existing guide inherits it; a
  corner off all guides spawns one.

## Guide lifecycle (from review)

- **Manual guide** (user drops a division line): **permanent** immediately, persists
  even with no rooms on it. Removed only by explicit delete.
- **Auto guide** (spawned when a room edge lands off every existing guide):
  **provisional** — shown, usable, but garbage-collected if it ends up held by no room
  edge AND was never approved.
- **Approve + name** a provisional auto guide → **permanent** (thereafter only removed
  by explicit delete, like a manual guide).

So a guide carries: `{ id, axis:'x'|'y', at, name?, permanent:boolean }`. Manual →
`permanent:true` on creation; auto → `permanent:false`; approving/naming sets
`permanent:true`. The GC pass prunes `permanent:false` guides with zero bound edges.

## Bays: identity, naming, editable flag

- A bay is derived from two adjacent guides on an axis. **Key it by the two bounding
  guide IDs**, not by index/position, so its name + editable flag survive adding/removing
  other guides.
- Bay metadata: `{ name?, editable:boolean }`. Default `editable:false` (fixed). Not all
  inter-guide gaps need to be configurable — the editor toggles which are.

## Export → configurator (the payoff; runtime already supports it)

Confirmed in the code: grid-line `at` may be a formula, the resolver evaluates it against
variables (resolved first), and the configurator already binds knobs to variables and
renders sliders. **The only gap is what the planner emits.** On export:

- Emit one **variable per editable bay** (leaf number, seeded with its current span),
  named from the bay name (`bay_living_width`).
- Emit each guide line `at` as a **cumulative formula** over the bay vars + fixed-bay
  constants from an origin (`"= x_origin + bay_living_width + 80"`).
- Emit a **`configurator`** block: one input per editable bay (label = bay name, group by
  axis, unit/min/max/step). Fixed bays contribute constants, no knob.
- Rooms/slabs/openings are unchanged — they already read `main.x*` / `main.y*`.

Schema/resolver/DSL need no change (`houseConfig.ts` gridLine `numOrFormula` ~51-58;
`param/resolve.ts` `resolveGrids` ~580-627; configurator schema ~745-778; knob→var
`configurator/spec.ts` ~16-85; UI `viewer/configuratorPanel.ts`).

## Phasing

- **Phase A — v1 target.** The planner gains first-class guides + bays: derive/persist
  them, snap room edges to guides (auto-create + GC per the lifecycle), let the user
  approve/name guides, name bays, and flag bays editable. Rooms are still authored by
  drag/resize. Homeowner reflow happens in the **exported model's configurator/studio**
  (the emit step above). Delivers a configurable house immediately.
- **Phase B — later.** Live in-planner reflow: drag a guide or type a bay value *in the
  graph editor* and rooms move there too (bidirectional binding). Same data model —
  additive.

## Planner data-model & UI changes (Phase A)

- **Model** (`floor-planner/src/store/initialState.js`, `normalizeModel`): add
  `guides: { x:[{id,at,name?,permanent}], y:[...] }` and `bays: { [guidePairKey]:
  {name?,editable} }` to the doc; add per-edge guide binding on rooms (e.g.
  `bind:{n,s,e,w:guideId}`), tolerant of older docs.
- **Reducer** (`store/reducer.js`): actions ADD_GUIDE (manual), APPROVE_GUIDE (name +
  permanent), DELETE_GUIDE, RENAME_BAY, SET_BAY_EDITABLE; snap+auto-create+GC on
  room move/resize.
- **Canvas** (`components/Canvas.jsx`): render guides (with names), snap room edges to
  guides, drag a guide, mark provisional guides visually.
- **Sidebar** (`components/Sidebar.jsx`): a Guides/Bays panel — approve/name a guide,
  name a bay, toggle editable; and per-room, show which guides its edges bind to.
- **Export** (`floor-planner/src/export/toWadi.js`): replace `guidesFromRooms` numeric
  emission with bay-variable + cumulative-`at` + `configurator` emission driven by the
  persisted guides/bays; prefer the `guides` key over the deprecated `grids`.

## Gotchas (from the code map)

- **Knobs must target leaf numeric variables** — `spec.ts readValue` returns `NaN` on a
  formula var and `writeValue` overwrites with a number. So editable bays are plain-number
  vars; the composite `at` formulas live on the lines, never knobbed.
- **Grid `at` may reference variables/points (resolved first) but not reliably another
  named line in the same grid** — build cumulative positions from bay vars, not
  line→line references.
- Prefer emitting `guides` (resolver merges the deprecated `grids` too).

## Decisions

- **Approve + name attaches to the BAY.** Naming a bay promotes the provisional
  auto-guides that bound it to permanent (one action, no separate "approve" step). A
  bay whose guides are both already permanent just gets/updates its name.

## Open questions

1. Bay min/max defaults for knobs — a sensible range around the current span, or
   user-set?
