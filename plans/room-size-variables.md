# Plan: Room-size variables (configurable house, fixed plot)

Status: PROPOSED (for review). Supersedes the "configurable bays" layer of
`plans/configurable-guides.md`. The guide/snapping substrate from that plan
(shipped in 1b75a17 / 225204c) stays; the **bay-naming** path is replaced by this.

## Why this replaces bays

Bays keyed the configurable dimension to an inter-guide gap. That broke in three ways
found in testing:

1. A foreign guide slices a room's dimension (e.g. the Living/Balcony line at y=90 cuts
   the Bath depth 60->100), so a room's own dimension is not a single bay.
2. Inter-guide gaps are co-dependent (they share guides), so "which are configurable" is
   tangled.
3. One knob cannot drive several non-aligned rooms (e.g. one "balcony width" for three
   balcony sections at different places).

Binding a **named variable to a room dimension** dissolves all three: a variable
constrains the two guide lines of that dimension (crossing lines are just free lines the
solver places), and one variable can constrain many dimension pairs at once.

## Model

- A **sizing variable**: `{ name, value, label?, min?, max?, step?, unit? }`. These are the
  homeowner knobs.
- A room dimension (`room.w` or `room.h`) may be **bound** to a variable. A binding is
  `{ var, room, dim:'w'|'h' }`. Many bindings may reference the same variable (sharing).
- **Plot W and H are fixed** and only change when the user resizes the plot explicitly.
- Rooms need not tile the plot. **Unused space is allowed.**

## Reflow rules (from review)

When a variable changes, the plan re-solves so the plot size is preserved:

1. **Proportional redistribution.** The change is spread across the non-bound freedom in
   proportion to current size (chosen over local / equal-split).
2. **Free space first.** If growing a dimension and there is unused space on that axis,
   consume it before shrinking any room. If there is no free space, shrinking of other
   (unbound) rooms happens proportionally. Freed space from shrinking a variable is
   returned proportionally to previously-compressed rooms, surplus becomes free space.
3. Plot ends never move (unless the plot is explicitly resized).

## Reflow mechanics: per-axis constrained solve

X guides and Y guides are independent (rooms are axis-aligned), so this is two small 1D
problems, each over the guide-line positions on that axis:

- **Unknowns:** interior guide positions g1..g(M-1). Ends pinned: g0 = 0, gM = W.
- **Hard constraints:** each bound dimension pins its two lines, `g_j - g_i = value`.
  A variable shared by k dimensions contributes k such equalities, all reading one value.
- **Objective:** place the remaining freedom to match rule 1+2 (proportional, free-space
  first). Formally an equality-constrained least-squares with a proportional prior on the
  unpinned intervals; free-space intervals weighted to move first.

This dissolves the bay crossing problem: we no longer name a contiguous span, we constrain
a line pair. A line that a bound dimension crosses (the y=90 case) is just an unpinned line
the solve positions proportionally, or a pinned line if another variable claims it.

**Over-constrained** (pinned dimensions across a full-span chain exceed W): report and
clamp, do not silently distort.

## Export -> configurator (linearity is the payoff)

The solve is **linear in the variable values** (KKT system with linear constraints), so each
guide position is a linear formula in the variables. Export is then exactly what the runtime
already supports:

- Emit one **variable per sizing variable** (leaf number, seeded with current value), plus
  its configurator input (label, group, unit/min/max/step).
- Emit each guide line `at` as a **linear formula** in those variables (constant term +
  per-variable sensitivity), computed from the solve's sensitivity map.
- Rooms/slabs/openings are unchanged, they already read `main.x*` / `main.y*`.

No schema/resolver/DSL change (gridLine `numOrFormula`, `resolveGrids`, configurator
schema, knob->var `spec.ts`, `configuratorPanel.ts` all already support this).

## Planner data-model & UI changes

- **Model** (`store/initialState.js`, `normalizeModel`): add `variables: [{name,value,...}]`
  and `bindings: [{var,room,dim}]` to the doc, tolerant of older docs. Keep `guides` as the
  substrate. Drop `bays` (migrate: a named editable bay -> a variable bound to the room
  dimension it best matches, best-effort, else discard).
- **Reducer** (`store/reducer.js`): actions BIND_DIM (create/attach a variable to a
  room dim), UNBIND_DIM, RENAME_VAR, SET_VAR_META (min/max/step/label). Replace the bay
  actions. Re-run the axis solve on variable change (Phase 2) or just persist bindings
  (Phase 1, solve at export).
- **Solver** (`floor-planner/src/model/sizeSolve.js`, NEW): pure per-axis constrained
  proportional solve + sensitivity map. Unit-tested against the sample and the Bath case.
- **Canvas** (`components/Canvas.jsx`): mark bound dimensions on rooms (a small badge on
  the driven edge), keep guide rendering + snapping.
- **Sidebar** (`components/Sidebar.jsx`): replace BaysPanel with a **SizesPanel**. Select a
  room, make w or h configurable (creates a variable), or pick an existing variable to share
  it. List variables with value + which dimensions each drives.
- **Export** (`export/toWadi.js`): replace bay emission with variable + linear-`at` +
  configurator emission driven by bindings + the solver sensitivity map.

## Phasing

- **Phase 1 (v1 target).** Model + SizesPanel + solver + export. Bindings authored in the
  planner; homeowner reflow happens in the exported model's configurator/studio. Delivers a
  configurable, fixed-plot house with shared knobs.
- **Phase 2 (later).** Live in-planner reflow: change a variable in the graph editor and
  rooms move there too, using the same solver. Additive.

## Open questions

1. Variable min/max defaults: a range around the current value, or user-set on creation?
2. "Free space first" exact behavior on shrink (return to compressed rooms vs leave as
   gap) is specified above; confirm it feels right once live.
