# Wadi structural conventions (coding guidelines)

<!-- GENERATED FILE — do not edit conventions.md by hand. It is built from
     conventions.preamble.md + the constraint modules in editor/src/lint/constraints.
     Regenerate with `npm --prefix editor run gen-conventions-doc`. -->

A house can be **well-formed but structurally unsound**: it passes the schema and
the wall/roof geometry check, yet the building would not stand up — a floor floats
in mid-air, a room is open to the weather, walls hover above a phantom slab. These
are the *coding conventions* every Wadi house must follow.

They are **formally defined here** and **enforced in code** by the structural
linter (`editor/src/lint/structural.ts`), which runs automatically:

- in **`check.sh`** (and `validate.mjs`) — **errors fail** the check, **warnings**
  are printed but advisory;
- in the **WDL editor** — the status pill shows the count and lists every finding
  in its hover tooltip, while still rendering the model so you can *see* the
  unsound part.

Each finding carries its convention id (`C1`, `C2`, …). Each convention is a
self-contained module under `editor/src/lint/constraints/` (its check + this doc +
its example fixtures), and **this file is generated from those modules**
(`editor/scripts/gen-conventions-doc.mjs`) — so the doc and the linter cannot
drift. Add a rule by adding a constraint module and regenerating.

---

## The vertical model (why C1 and C3 exist)

Floors stack in source order (floor 0 = the Plinth floor). The renderer places
them like this (`editor/src/three/coords.ts`):

- **A floor's base elevation = the running sum of the previous floors' `height`
  only.** `wall_height` and `slab_thickness` do **not** raise the next floor.
- The **plinth block** is drawn to its *own* `height`. So the floor above sits at
  `plinth-floor.height`, while the plinth top is at `plinth.height` — they must be
  equal or the floor above floats/sinks by the difference. → **C1**
- **`slab_thickness` lifts a floor's walls within its band** (`wallZ = base +
  slab_thickness`) — it is the deck the walls stand on. With no slab object there
  is no deck, so the walls float by that amount. → **C3**

`height`, `wall_height`, and `slab_thickness` are otherwise **independent** — the
model enforces no relationship between them. These conventions add the few
relationships that structural soundness *does* require.

---

<!-- GENERATED:CONSTRAINTS -->

---

## Running the checks

```bash
wadi-skill/architect/scripts/check.sh house.wdl
```

- **`✖ [C…]`** — a structural **error**; the check exits non-zero. Fix before you
  save/share.
- **`⚠ [C…]`** — a structural **warning**; advisory. Fix, or keep it if the open
  side is intentional.

In the WDL editor the same findings appear in the status pill (hover for the full
list); the model still renders so you can see the problem.

---

## Design guidelines (advisory — NOT linted)

Good-practice guidance the linter does not check. Apply your judgement; these are
style, not rules:

- **Compact, rectangular layout.** Keep the plan as rectangular as possible, with
  the minimum of nooks and crannies. A blocky footprint is cheaper to build, easier
  to roof, and wastes less wall.
- **Room sizes follow use.** Size each room to its utilisation. The living room is
  usually the largest, then rooms like the kitchen, workshop, and bedrooms; a
  bathroom should be smaller than the bedroom it serves.
- **Verandahs & balconies get half-height walls.** Give a verandah or balcony a
  half-height (parapet) wall rather than a full-height one — a full-height verandah
  reads as an enclosed room. (Not linted: Wadi has no verandah/balcony marker, so
  there is nothing to key a warning on without matching room names.)
- **Staircase in a multi-storey house.** Reserve a dedicated stair space on each
  floor. The staircase starts on the lowest floor and rises to the underside of the
  topmost occupied floor (not the roof floor). Size the stair space so climbing one
  storey takes at most two flights (use `max_run` on the `staircase` to switchback).

## Site element conventions (advisory — NOT linted)

Placement guidance for the three first-class site primitives
(`compound_wall`, `well`, `solar_panel`). Not checked by `check.sh`; apply
your judgement.

- **Compound walls sit at the plot perimeter.** The four walls that enclose a
  plot are anchored to its edges. For a plot of width W and length L, with wall
  thickness T:
  - North wall: `at (0, 0) size (W, T)`
  - South wall: `at (0, L - T) size (W, T)`
  - East wall:  `at (W - T, 0) size (T, L)`
  - West wall:  `at (0, 0) size (T, L)`
- **Height for a compound wall.** A typical boundary wall is 4–6 ft (40–60 project
  units). Use the same `height` on all four walls so the parapet is level.
- **Well placement.** Place a well minimum 60 project units from any room wall —
  rear or side yard preferred, never under the roofline. For a circular well,
  `diameter 30` (3 ft) is a sensible default.
- **Solar panel azimuth.** For India and the northern hemisphere, use `azimuth 180`
  (south-facing); `tilt 15` is a reasonable flat-low default (15°).
- **Solar panel mount floor.** A `mount roof` array belongs on **floor 2 or
  higher** (the roof or top floor band). A `mount ground` array goes on floor 1
  in a garden or rear yard.
- **Solar panel coordinate.** `at (x, y)` is the **array centre**, so place it at
  the midpoint of the roof band or garden area it covers.
