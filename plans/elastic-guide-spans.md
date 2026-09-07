# Plan: Elastic guide spans (ratios on the guide grid)

Status: PROPOSED (for review). Successor mental model to
`plans/room-size-variables.md`. The variable substrate stays; what changes is the
thing a variable (or a ratio) binds to: a **span between two guides**, not a room
dimension. Rooms stay derived from guides, so one span drives every room that lies on it.

## Why move control from rooms to spans

Room-size variables work, but the unit of control is the room, and that fights the
layout in three recurring ways:

1. A room dimension crossed by a foreign guide is not one thing (the Living/Balcony line
   slices Bath depth), so "the room's width" is really a sum of cells.
2. Proportional sharing (2:1 between two rooms, the reverted "percentage shares") is
   awkward because two room variables move independently.
3. One knob for several non-aligned rooms needs a binding per room.

The guide grid already resolves all three, because it is the real skeleton: rooms derive
their edges from guides on export today, and the main app's grid convention already
treats grid lines as first-class with per-line spans. Moving control onto spans converges
the planner on that model instead of maintaining a parallel per-room layer.

## Core model

Treat each axis (x and y) as a flexbox row of spans. Nothing here needs a solver; every
value is produced by a top-down arithmetic pass.

- A **guide** is a boundary line on an axis (the planner already has `guides.x[]`,
  `guides.y[]` as positions).
- A **span** is an interval between two guides on one axis, with a size **policy**:
  - `fixed`: an absolute size, or a named variable reference (`= balcony_width`).
  - `flex`: a ratio weight (a number; default 1).
- The **container** is the plot length on that axis (the plot has a definite size at any
  moment; it can still change, see Interaction).
- Distribution, per axis: fixed spans take their size; the leftover (`plot - sum(fixed)`)
  is split among flex spans in proportion to their weights. Guide positions are the
  cumulative sum of span sizes from the origin.

This is flexbox: `fixed` is flex-basis, the ratio is flex-grow, the plot is the
container. "The whole house is elastic" is exactly "flexbox on two axes."

### Rigid vs elastic containers

A flex child is what lets a container absorb a size that differs from the sum of its fixed
children. So a flex child is not strictly required, but its absence changes the container:

- **At least one flex child:** the container can be sized independently (fixed, or handed a
  size by its parent); fixed children take their sizes and the flex children absorb the
  difference. The normal, elastic case.
- **All fixed children:** the container is **rigid**; its size is exactly the sum of its
  children, with nothing to absorb slack. Legitimate and useful (a fixed module that must
  keep its dimensions), but it cannot be sized to anything other than that sum, and at its
  parent level it behaves as a fixed span equal to the sum.

Two consequences: the axis as a whole needs at least one flex somewhere, or the plot itself
is the flex of last resort (all-fixed axis => plot = sum, the current elastic-plot
behavior). And the good default is **every undefined leaf cell is flex weight 1**, so there
is always something to absorb change unless the user deliberately fixes everything, and the
no-spans-defined case reproduces today's equal proportional reflow for free. Rigidity is
opt-in; elasticity is the default.

A span may carry a **name**, usually borrowed from a room ("kitchen width"). The name is
a label for humans. The identity of a span is its guide pair, not the name.

## Skip-guide spans = nested groups (the part to get right)

A span does not have to be between adjacent guides. A span may be defined across a range
that has guides inside it, for example `[x0, x2]` when a guide `x1` sits between them.
This is what lets you control a room's whole width as one knob even though an interior
guide crosses it.

The rule that keeps this unambiguous and solver-free is **nesting**: any two defined
spans are either disjoint or one fully contains the other. Overlap that is neither (a
span `[x1,x3]` alongside a span `[x2,x4]`) is disallowed. With that invariant the spans
on an axis form a **forest of nested intervals**, and distribution is a tree walk:

- A skip-guide span is a **group**. At its parent level it behaves like any span (fixed
  or flex). Internally it is a container for its own children (the sub-spans between the
  guides it covers), and its size is distributed among those children by the same rule.
- Interior guides get their positions from the group's internal distribution, not from
  the top level.
- A guide inside a group that has no sub-span defined around it falls into a default
  child span with weight 1, so undefined interior guides just split their group evenly.

### Worked example

Guides at `x0=0, x1, x2, x3`; plot width to `x3`.

- Define group `A = [x0, x2]`, `fixed 120` (a room two cells wide, interior guide `x1`).
- Inside `A`, no sub-policy, so `[x0,x1]` and `[x1,x2]` are weight-1 flex -> `x1 = 60`.
- `[x2, x3]` is `flex 1` -> it takes `plotW - 120`.

Change `A` to 150: `x1` moves to 75, `[x2,x3]` shrinks by 30. The room on `[x0,x2]` is
controlled as one unit, and its interior guide still moves. If you later want `x1`
biased, give `[x0,x1]` weight 2 and `[x1,x2]` weight 1 (2:1 inside the group).

Ratios across groups: `A = [x0,x2] flex 2`, `B = [x2,x3] flex 1` splits the plot 2:1
between the two groups, and each group subdivides its share internally.

### Distribution algorithm (per axis)

```
distribute(interval, size):
  children = direct sub-spans of interval    # defined groups + default weight-1 cells
  fixedTotal = sum(child.size for fixed children)
  weightTotal = sum(child.weight for flex children)
  leftover = size - fixedTotal
  for each flex child: child.size = leftover * child.weight / weightTotal
  for each group child: distribute(child, child.size)
  positions = cumulative(child.size) from interval.start
```

Top call: `distribute(wholeAxis, plotLength)`. No matrices, no least squares. This
replaces the KKT solver in `floor-planner/src/model/sizeSolve.js` with a tree walk.

## Interaction (what editing does)

- **Edit a fixed span (or its variable):** its size changes; flex spans in the same
  container absorb the difference so the container size holds. If there are no flex spans
  to absorb it, the container grows (elastic plot), same as today.
- **Drag a guide:** it moves the boundary between the two spans it sits between, changing
  only those two, inside whatever container they belong to.
- **Resize the plot:** the free space changes; flex spans scale by weight; fixed spans
  hold. If there are no flex spans, the plot equals the sum of fixed spans (moving the
  plot means editing the fixed spans).
- **Set a ratio:** mark a span flex with a weight. It stops being an absolute size and
  starts sharing free space.

A span is fixed or flex, never both, so "which value changed" never has to be guessed.

## Rooms derive from guides

No change in principle from today's export: a room's `x/w` (or `y/h`) is the guide pair
it sits on, emitted as guide-referenced formulas. A room that spans a group is emitted as
the group's endpoints. A room that only partly covers a group is emitted as its own guide
pair (a sum of that group's cells). Furniture stays anchored, so it reflows for free.

## Cross-axis sharing — DONE

Spans are per-axis, so an x-span and a y-span are different objects. To share a value
across axes (the balcony where a width equals a depth), both spans reference the same
named **variable**. Variables do not go away; they bind to spans instead of rooms, and a
ratio is the elastic alternative when you do not want a fixed value.

Every fixed dimension is a named variable (no anonymous fixed spans in the UI): clicking
Fix auto-creates `<room>_<width|depth>` and binds to it, so the size is immediately visible
and shareable, and any other fixed dimension can adopt any existing variable (auto or named)
from its dropdown. The canvas only spells out a variable name when it is actually shared
(more than one span uses it); a solo pin stays `◆W`/`◆H`. A **Sizes panel** in the sidebar
lists every variable with its name, value, and how many dimensions it drives: renaming there
(`RENAME_VAR`) relabels it everywhere, editing the value (`SET_VAR`) re-flows every bound
room, and deleting (`DELETE_VAR`) reverts its dimensions to Auto.

Built: a fixed span's policy can be `{ kind: 'fixed', var: 'balcony' }`. The doc holds a
`variables` registry (`{ name: { value, label? } }`); `reflowSpans` resolves a var-span to
its value before distributing, so one variable drives spans on both axes in one reflow.
`SET_SPAN` with a `var` policy creates the variable (seeded from the span size) or shares
an existing one (snapping the dimension to its value); `SET_VAR` sets the value and
re-flows every bound room; `commit` GCs a variable once no span uses it. The Room editor's
Fix control has a link picker (This room only / share an existing variable / New shared
size…), the value field of a linked dimension edits the variable, and the canvas badge
reads `◆<name>`. Export emits one config variable per shared name (deduped across axes, in
a "Shared sizes" configurator group) with the guide formulas on both axes referencing it.
Verified: reducer test N8 (create, share across axes, `SET_VAR` drives both, GC on unbind)
and a shared-variable export that validates through the real pipeline (`= 0 + balcony` on
both x and y).

## No migration; clean slate

Decision: do not migrate the old room-size-variable model. It has been **removed** from
the planner (variables, bindings, the KKT solver in `sizeSolve.js`/`sizes.js`, the
Sizes/DimConfig UI, and the variable-driven export formulas). The planner is now guides +
freely editable rooms, exporting a plain guide grid with rooms referencing named lines.
The span model is built fresh on top of that, span-native, with no back-compat path.

## Export mapping

The exporter already emits cumulative guide formulas and room formulas referencing
guides (`guidesFromModel`, `roomGridFormulas` in `floor-planner/src/export/toWadi.js`).
A span with a variable stays a config variable; a flex span emits as a resolved position
(a number or a guide formula), because ratios resolve before geometry, exactly like the
resolver evaluates variables first. No new config concept is needed; the guide positions
are just produced by the tree walk instead of the solver.

## Edge cases and open questions

- **Non-nesting definitions:** the UI must prevent (or auto-reject) a span that overlaps
  an existing one without nesting. Selecting a room or a contiguous guide range to define
  a span keeps definitions well-formed by construction.
- **All-fixed axis over/under plot:** `sum(fixed) != plot` with no flex. Elastic answer:
  the plot grows or shrinks to `sum(fixed)` (current behavior). Confirm that is still
  wanted per axis.
- **Group with a fixed size smaller than its fixed children:** ill-posed; clamp or grow
  the group and surface it, do not fail silently.
- **Naming a group whose bounds later change** because a room resizes: the name is a
  label on the guide pair, so it follows the endpoints; document that.
- **Do interior guides inside a group ever need to be pinned** (locked at an absolute
  offset within a flexing group)? A pinned interior guide is just a fixed child span, so
  the model already covers it; the open question is only the UI affordance.

## Phasing

1. **DONE** — Data model + distribution, as a pure module `floor-planner/src/model/spans.js`
   (tests in `scripts/test-spans.mjs`, `npm run test-spans`): spans as nested intervals with
   fixed/flex policy per axis; `buildAxisTree` (nesting enforced, whole-axis span pins the
   container, undefined cells default to flex weighted by current size), the top-down
   `distribute` tree walk, `naturalSize` (rigid axis grows the plot), and `solveAxisSpans`
   returning guide positions. No-spans reproduces the current layout; the worked examples
   (skip-guide group, mixed fixed+flex, 2:1) are covered.
2. **DONE** — Store wiring. The doc carries `spans: { x, y }`; `reflowSpans`
   (`src/model/spanReflow.js`) runs `solveAxisSpans` per axis, moves the guides, pulls each
   room's edges onto their guides, and refits the plot. The `SET_SPAN` action upserts/removes
   a span and reflows; `commit` prunes spans whose guides are gone. No-spans reflow is a
   verified no-op, so free-room editing is unchanged. Tests: `scripts/test-span-reflow.mjs`
   (pin-one/flex-absorb, rigid plot-grow, 2:1, prune, SET_SPAN end-to-end). No UI yet.
3. **DONE (pin)** — Room-editor pin control. Each room dimension has a ◆/◇ pin: pinning
   defines a fixed span between the room's edge guides (a GROUP span automatically when the
   room crosses interior guides), and editing the pinned W/H reflows live (others absorb, or
   the plot grows). A ◆W/◆H canvas badge marks pinned rooms, and it shows on every room that
   shares the span, so the "one knob drives aligned rooms" behaviour is visible. Verified
   live: pinning Living's width and setting 160 reflowed the aligned rooms and held the plot.
   Still to add here: defining a group from an arbitrary guide RANGE (not just a room's own
   edges) via a canvas selection.
4. **DONE** — Ratios in the UI. The per-dimension control is now a 3-mode segmented toggle:
   Auto (no span, flexes proportionally), Fix (a fixed size), Ratio (an explicit flex weight).
   Ratio shows a weight field and the resolved size; the canvas badge reads `W×n`/`H×n` for a
   ratio vs `◆W`/`◆H` for a fixed size. Switching to Ratio seeds the weight from the current
   size (a no-op start), then editing it re-flows live. Verified: the Ratio mode creates a
   flex span and re-flows on weight change (live), and `SET_SPAN flex` 2:1 through the reducer
   gives an exact 2:1 with the plot held (test N7). Clean ratios scoped to a subset of an axis
   still want the group-range selection from phase 3.
5. **DONE** — Export mapping. `guidesFromModel` now walks the span tree: a FIXED span becomes
   a config variable (a homeowner knob, named after the room whose dimension it is), and each
   guide position is a cumulative FORMULA of those variables plus the constant (flex/auto)
   cells. A fixed GROUP span drives its interior cells as `var * fraction`. The plot dimensions
   (site + ground/plinth formulas) follow the variables, so a knob grows the plot. Rooms keep
   deriving width/depth from the guide difference, so the variable flows through with no
   per-room binding. Verified: an atomic-span and a group-span export both validate through the
   real schema + resolver + wall/roof pipeline, and emit `= 0 + living_width` / `hall_width *
   0.5` guide formulas + a configurator. (Flex/ratio spans export as their resolved constant,
   per the plan; ratios are a planner-side lever, not a Wadi primitive.)
