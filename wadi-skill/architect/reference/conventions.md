# Wadi structural conventions (coding guidelines)

A house can be **well-formed but structurally unsound**: it passes the schema and
the wall/roof geometry check, yet the building would not stand up — a floor floats
in mid-air, a room is open to the weather, walls hover above a phantom slab. These
are the *coding conventions* every Wadi house must follow.

They are **formally defined here** and **enforced in code** by the structural
linter (`editor/src/lint/structural.ts`), which runs automatically:

- in **`check.sh`** (and `validate.mjs`) — **errors fail** the check, **warnings**
  are printed but advisory;
- in the **DSL editor** — the status pill shows the count and lists every finding
  in its hover tooltip, while still rendering the model so you can *see* the
  unsound part.

Each finding carries its convention id (`C1`, `C2`, …) so this document and the
linter stay in lockstep. Add a rule by adding a check to `lintStructure` **and** a
section here with the next id.

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

## C1 — The plinth floor's height must match the plinth block height · **error**

**Statement.** A floor that carries a `plinth` object (the Plinth floor) must set
an explicit `height`, and that height must equal the plinth block's `height`.

**Rationale.** The floor above is stacked at `plinth-floor.height`; the plinth
block rises to `plinth.height`. If they differ, the floor above floats above the
plinth (`floor.height > plinth.height`) or sinks into it (`<`). If the floor
`height` is omitted it silently defaults to `100`, almost never the plinth height.

**Fix.**

```wdl
floor 0 "Plinth" height 40 {          // == the plinth block height below
  ground name "Ground" at (0,0) size (500,500)
  plinth name "Plinth" at (…) size (…) height 40
}
```

(If the plinth block omits its own `height`, it follows the floor height and is
consistent by construction — but set the floor `height` explicitly anyway, so the
stack is not left to the default.)

---

## C2 — A room must wall every exterior side · **warning**

**Statement.** A room shown with a **partial** `walls` list must still wall every
side that faces **outside** (no room beyond it). Interior (shared) sides may be
omitted — the neighbour's wall stands on the shared centreline.

**Rationale.** A room shows exactly the walls it declares; a **bare room (no
`wall` lines) is enclosed on all four sides**. But the moment you add a `wall`
line to hang a door or window, the room switches to a *whitelist* — every side you
don't list is now a hole. An exterior hole leaves the room open to the weather.
This is the #1 footgun the conventions guard against.

It is a **warning**, not an error, because an open exterior side is sometimes
intentional (a verandah / open padvi). If it is deliberate, leave it — the warning
documents the choice. Otherwise, add the wall.

**Fix.** List the plain exterior walls compactly alongside the opening walls:

```wdl
room Living at (x,y) size (w,l) {
  wall east west                       // plain exterior sides — enclosed
  wall south { door Main at 120 size (36,84) }
  wall north { window N1 at 100 size (60,50) sill 35 }
}
```

*(The check samples several points along each side, so a side sheltered by rooms
above is correctly treated as interior, not open. It also skips a side that
already has a wall on its line — one declared by an adjacent or overlapping room,
or a standalone wall — so a shared exterior wall the neighbour declares is not
double-flagged.)*

---

## C3 — A floor with no slab must set slab_thickness to 0 · **error**

**Statement.** A floor that has wall/room objects but **no `floor_slab` object**
must set `slab_thickness 0`.

**Rationale.** `slab_thickness` is the deck the floor's walls stand on
(`wallZ = base + slab_thickness`). Its default is `8`. With no slab object there is
no deck, so every wall on the floor floats `slab_thickness` units above the floor
base. Setting it to `0` puts the walls on the floor base; alternatively, model the
deck by adding a `slab`.

**Fix.**

```wdl
floor 1 "Ground" slab_thickness 0 {   // no slab modelled → walls sit on the base
  room Studio at (…) size (…) { … }
}
```

*(This does not fire on a floor that carries no walls/rooms — e.g. a Plinth floor
of just `ground` + `plinth`, or a roof-only top floor — where `slab_thickness` is
harmless.)*

---

## C4 — A stacked floor's height should equal wall_height + slab_thickness · **warning**

**Statement.** A floor that carries a floor above it (and has walls/rooms) should set
`height` = `wall_height` + `slab_thickness`.

**Rationale.** The next floor sits at `base + height`; this floor's walls stand on the
deck and reach `base + slab_thickness + wall_height`. When `height` is larger, the floor
above leaves a gap over the walls; when smaller, the walls poke through it. (These three
fields are otherwise independent — see the vertical model above.) It is a **warning** — a
deliberate gap is legitimate (a service plenum, a deep transfer beam) — but usually they
should match.

**Fix.** Make them add up, most simply via the house defaults:

```wdl
defaults { floor_height 116 wall_height 108 slab_thickness 8 }   // 108 + 8 = 116
```

*(Skipped for the plinth floor — governed by C1 — and for the topmost floor, since nothing
stacks on its walls.)*

## C5 — A staircase must land on a floor, not below ground · **warning**

**Statement.** A staircase's descent must not carry it below the ground plane (z < 0).

**Rationale.** Staircases are **top-anchored**: you place one on the **upper** floor and it
**descends** to the floor below (`at` is the top, `direction` is the descent, `total_height`
is the drop). Put it on the *lower* floor (as if climbing up), or give it too large a
`total_height`, and the expanded flight lands **below ground** — it still draws in the 2D
plans (which ignore Z) but is **buried and invisible in 3D**, with no other error. This is
the one that bit a real design: a stair on the ground floor "climbing" to the first floor
was expanded to `z_offset: -105` and vanished from the 3D view.

**Fix.** Move the staircase **up one floor** and let it descend. The stair that connects the
ground floor to the first floor lives on the **First Floor**:

```wdl
floor 2 "First Floor" height 116 {
  slab at (…) size (…)
  staircase name "Stair" at (212, 64) step (7, 11, 44)   // `at` = the TOP (this floor)
    direction south total_height 116                     // descends to the floor below
}
```

*(See the staircase section of `dsl.md` for the full top-anchored convention.)*

## C6 — Openings on the same wall must not overlap · **error**

**Statement.** Two openings (doors/windows) cut into the **same physical wall** must not
overlap along it. This includes openings that belong to **two different rooms sharing a
boundary wall** — a door on Living's east side and a door on Bedroom's west side sit on the
same wall line and can collide.

**Rationale.** Each opening is a boolean-subtract from the wall. Overlapping spans merge into
one ragged hole (or fight over the same brick), which is never what you meant — and on a
shared wall it silently punches a bigger gap than either room's plan shows.

**Fix.** Offset or narrow one opening so the spans are disjoint. Openings are measured from
the wall's start corner (`offset` = near edge; the opening occupies `[offset, offset+width]`).
For a shared wall, remember both rooms' offsets are measured along the **same** line, so a
door at `offset 50 width 40` (→ `[50,90]`) on one room clears a door at `offset 90` on the
other, but not one at `offset 60`.

## C7 — Furniture items should not overlap · **warning**

**Statement.** Two furniture `item`s whose plan footprints overlap are flagged — as a
**warning**, because it is sometimes intentional (a rug under a table, a lamp on a desk,
deliberately stacked pieces).

**Rationale.** More often it's a placement slip — two beds dropped on the same spot, or an
anchored piece that reflowed into another when a room was resized. The footprint used is the
item's rotated bounding box (yaw-aware), so it matches what the plan draws.

**Fix.** Reposition one item, or ignore the warning if the overlap is deliberate.

## Running the checks

```bash
wadi-skill/architect/scripts/check.sh house.wdl
```

- **`✖ [C…]`** — a structural **error**; the check exits non-zero. Fix before you
  save/share.
- **`⚠ [C…]`** — a structural **warning**; advisory. Fix, or keep it if the open
  side is intentional.

In the DSL editor the same findings appear in the status pill (hover for the full
list); the model still renders so you can see the problem.

---

## Planned conventions (not yet enforced)

Documented so authors know they matter; not linted yet:

- **Interior partition gaps** — where two rooms share a centreline and *neither*
  declares that wall, there is no partition between them. (C2 only covers
  *exterior* sides.)
- **Slab thickness ↔ slab object** — when a floor *does* carry a `floor_slab`,
  its `slab_thickness` should match the slab's own thickness so walls sit on the
  real deck.
- **Roof footprint coverage** — the roof segments should span the top occupied
  floor's footprint (no uncovered rooms).
