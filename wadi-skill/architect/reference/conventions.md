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
- in the **DSL editor** — the status pill shows the count and lists every finding
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

## C1 — The plinth floor's height must match the plinth block height · **error**

**Statement.** A floor that carries a `plinth` object (the Plinth floor) must set an explicit `height`, and that height must equal the plinth block's `height`.

**Rationale.** The floor above is stacked at `plinth-floor.height`; the plinth block rises to `plinth.height`. If they differ, the floor above floats above the plinth (`floor.height > plinth.height`) or sinks into it (`<`). If the floor `height` is omitted it silently defaults to `100`, almost never the plinth height.

**Fix.**

```wdl
floor 0 "Plinth" height 40 {          // == the plinth block height below
  ground name "Ground" at (0,0) size (500,500)
  plinth name "Plinth" at (…) size (…) height 40
}
```

(If the plinth block omits its own `height`, it follows the floor height and is consistent by construction — but set the floor `height` explicitly anyway, so the stack is not left to the default.)

---

## C2 — A room must wall every exterior side · **warning**

**Statement.** A room shown with a **partial** `walls` list must still wall every side that faces **outside** (no room beyond it). Interior (shared) sides may be omitted — the neighbour's wall stands on the shared centreline.

**Rationale.** A room shows exactly the walls it declares; a **bare room (no `wall` lines) is enclosed on all four sides**. But the moment you add a `wall` line to hang a door or window, the room switches to a *whitelist* — every side you don't list is now a hole. An exterior hole leaves the room open to the weather. It is a **warning**, not an error, because an open exterior side is sometimes intentional (a verandah / open padvi).

**Fix.**

```wdl
room Living at (x,y) size (w,l) {
  wall east west                       // plain exterior sides — enclosed
  wall south { door Main at 120 size (36,84) }
  wall north { window N1 at 100 size (60,50) sill 35 }
}
```

---

## C3 — A floor with no slab must set slab_thickness to 0 · **error**

**Statement.** A floor that has wall/room objects but **no `floor_slab` object** must set `slab_thickness 0`.

**Rationale.** `slab_thickness` is the deck the floor's walls stand on (`wallZ = base + slab_thickness`). Its default is `8`. With no slab object there is no deck, so every wall on the floor floats `slab_thickness` units above the floor base. Setting it to `0` puts the walls on the floor base; alternatively, model the deck by adding a `slab`.

**Fix.**

```wdl
floor 1 "Ground" slab_thickness 0 {   // no slab modelled → walls sit on the base
  room Studio at (…) size (…) { … }
}
```

*(This does not fire on a floor that carries no walls/rooms — e.g. a Plinth floor of just `ground` + `plinth`, or a roof-only top floor — where `slab_thickness` is harmless.)*

---

## C4 — A stacked floor's height should equal wall_height + slab_thickness · **warning**

**Statement.** A floor that carries a floor above it (and has walls/rooms) should set `height` = `wall_height` + `slab_thickness`.

**Rationale.** The next floor sits at `base + height`; this floor's walls stand on the deck and reach `base + slab_thickness + wall_height`. When `height` is larger, the floor above leaves a gap over the walls; when smaller, the walls poke through it. It is a **warning** — a deliberate gap is legitimate (a service plenum, a deep transfer beam) — but usually they should match.

**Fix.**

```wdl
defaults { floor_height 116 wall_height 108 slab_thickness 8 }   // 108 + 8 = 116
```

*(Skipped for the plinth floor — governed by C1 — and for the topmost floor, since nothing stacks on its walls.)*

---

## C5 — A staircase must land on a floor, not below ground · **warning**

**Statement.** A staircase's descent must not carry it below the ground plane (z < 0).

**Rationale.** Only a `climb down` (top-anchored) stair can fall below ground: you place it on the **upper** floor and it **descends**. Put it on the wrong floor, or give it too large a `total_height`, and the expanded flight lands **below ground** — it still draws in the 2D plans (which ignore Z) but is **buried and invisible in 3D**, with no other error. A `climb up` stair is anchored on its own floor and ascends, so it never trips this.

**Fix.**

Prefer **`climb up`**: put the stair on the **lower** floor it rises FROM and let it ascend.

```wdl
floor 1 "Ground Floor" height 116 {
  slab at (…) size (…)
  staircase name "Stair" at (212, 64) step (7, 11, 44)   // `at` = the BOTTOM (this floor)
    direction south climb up                             // ascends to the floor above
}
```

(Or, if you must keep it `climb down`, move it **up one floor** or reduce `total_height`.)

---

## C6 — Openings on the same wall must not overlap · **error**

**Statement.** Two openings (doors/windows) cut into the **same physical wall** must not overlap along it. This includes openings that belong to **two different rooms sharing a boundary wall**.

**Rationale.** Each opening is a boolean-subtract from the wall. Overlapping spans merge into one ragged hole (or fight over the same brick), which is never what you meant — and on a shared wall it silently punches a bigger gap than either room's plan shows.

**Fix.**

Offset or narrow one opening so the spans are disjoint. An opening's span is its resolved `[offset, offset+width]` along the wall — the `from start|center|end` anchor is honoured (its offset is converted to a start-based position first, exactly as the renderer does).

---

## C7 — Furniture items should not overlap · **warning**

**Statement.** Two furniture `item`s whose plan footprints overlap are flagged — as a **warning**, because it is sometimes intentional (a rug under a table, a lamp on a desk, deliberately stacked pieces).

**Rationale.** More often it's a placement slip — two beds dropped on the same spot, or an anchored piece that reflowed into another when a room was resized. The footprint used is the item's rotated bounding box (yaw-aware), so it matches what the plan draws.

**Fix.**

Reposition one item, or ignore the warning if the overlap is deliberate.

---

## C8 — Two abutting rooms need a partition between them · **warning**

**Statement.** Where two rooms share a boundary line and **neither** declares a wall on it, there is no partition between them.

**Rationale.** A bare room (no `wall` lines) is enclosed on all four sides, so two bare neighbours have two walls on their shared line. But once **both** rooms switch to partial `walls` lists and both omit the shared side, the centreline is left open — the rooms merge into one space with no divider. C2 only guards *exterior* sides; this is its interior counterpart. It is a **warning** because an intentional open-plan link (kitchen into living) is legitimate.

**Fix.**

Declare the wall on **one** of the two rooms (the neighbour's wall stands on the shared centreline, so one is enough):

```wdl
room Kitchen at (…) size (…) { wall north south east }   // east = the shared line
room Living  at (…) size (…) { wall north south west }
```

---

## C9 — A floor's slab_thickness should match its slab object's thickness · **warning**

**Statement.** When a floor carries a `floor_slab` object with an explicit `thickness`, that thickness should equal the floor's `slab_thickness`.

**Rationale.** The floor's `slab_thickness` is the deck the walls stand on (`wallZ = base + slab_thickness`); the slab object's own `thickness` is how thick the slab MESH is drawn. If they differ, the walls sit at the floor's `slab_thickness` while the slab top is at the object's `thickness`, so the walls float above or sink into the drawn deck. (A slab with no explicit `thickness` follows the floor's `slab_thickness` and is consistent by construction — this only fires when both are set and disagree.)

**Fix.**

Make them equal — most simply, drop the slab's explicit `thickness` so it follows the floor:

```wdl
floor 1 "Ground" slab_thickness 8 {
  slab name "Deck" at (…) size (…)          // no thickness → uses 8
}
```

---

## C10 — The roof should cover the rooms of the top occupied floor · **warning**

**Statement.** Every room on the top occupied floor should sit under a roof segment — no room left entirely uncovered.

**Rationale.** The roof's segments span a plan area (each segment's ridge line ± its `width`). A room on the top floor whose footprint does not overlap **any** roof segment has open sky above it — usually a roof that was sized to the wrong footprint, or a room added after the roof. (Only a *completely* uncovered room is flagged, so eave overhangs and partial coverage never false-warn; a house with no roof at all — a terrace — is not flagged.)

**Fix.**

Extend or add a roof segment to span the room, or reduce the room. Roof segments cover `start → end` along the ridge, `width` across it, so grow `width`/`end` (or the plot variables they derive from) until the room is under it.

---

## C11 — A declared connection must overlap on a wall and be passable (door or open) · **error**

**Statement.** For every `connect`ion a room declares, the two rooms must **overlap on a wall** (not necessarily the whole wall), and that overlap must be **passable**: either a **door** lies in it, or the wall is **left off both rooms** (an open passage).

**Rationale.** A connection is a FUNCTIONAL requirement — `Living` opens into `Kitchen`. It is design intent, not geometry (the renderer never draws it), so this constraint is what verifies the intent is physically realized. It fails two ways: the rooms' walls don't overlap at all, or they overlap but a solid wall (present on either room, no door in the overlap) blocks the way. No door is ever generated — a room authors its own openings, or omits the shared wall to leave the rooms open to each other.

**Fix.**

Overlap the two rooms on a wall, then EITHER put a door in the overlap (on either room), OR omit that wall on both:

```wdl
// door in the shared wall
room Living  at (…) size (…) { connect Kitchen  wall east { door D at 80 size (40,210) } }
room Kitchen at (…) size (…)

// open passage — neither room walls the shared side
room Living  at (…) size (…) { connect Kitchen  wall north south west }
room Kitchen at (…) size (…) { wall north south east }
```

---

## C12 — Rooms should not overlap (they share walls, not floor area) · **warning**

**Statement.** Two `room`s on the same floor should not overlap in plan — flagged as a **warning**, because it is occasionally intentional (embedding a corner room to carve an L-shaped space). Adjacent rooms may **touch** on a shared wall (their edges coincide); a larger intersection is reported.

**Rationale.** Rooms usually share walls, not floor area. A real overlap means two rooms were placed on the same spot — the renderer draws one over the other. It most often happens when a room is placed by absolute coordinates, or when a band (a verandah, a corridor) is dropped across an existing wing. C11 checks that declared connections are realized; this checks that the geometry is physically consistent. It stays a warning because an L-shaped room is modelled by overlapping a small corner room onto a larger bounding one.

**Fix.**

If the overlap is unintended, move or resize one room so they only touch on a shared wall (prefer relative placement — abut a neighbour on a side — over absolute coordinates that can land on top of another room). Ignore the warning if it is a deliberate corner embed.

---

## C13 — The lowest floor should carry a plinth · **warning**

**Statement.** A house should rest on a plinth: the lowest floor should contain a `plinth` object.

**Rationale.** The plinth is the raised base the building sits on — it lifts the ground floor above grade and gives the walls a footing. A lowest floor with rooms but no plinth reads as a slab-on-grade shortcut; most Konkan houses want an explicit plinth. (A style guide, so it only warns — a deliberately plinth-less design is allowed.)

**Fix.**

Add a `plinth` to the lowest floor (usually the Plinth floor 0, alongside the `ground`), sized to cover the built footprint.

---

## C14 — The highest floor should carry a roof · **warning**

**Statement.** A house should be capped by a roof: the highest floor should contain a `roof` object.

**Rationale.** The roof sits on its own floor stacked above the walls (see the roof convention). A design whose top floor has no roof leaves the house open — usually a roof that was forgotten, or a floor added above the roof. (A style guide, so it only warns — a deliberate flat terrace with no roof is allowed.)

**Fix.**

Add a `roof` to the highest floor (a floor stacked above the top occupied floor), with segments spanning the footprint.

---

## C15 — The plinth should cover the rooms that rest on it · **warning**

**Statement.** The plinth footprint should contain every room on the lowest occupied floor — no ground-floor room sticking out past the plinth.

**Rationale.** The plinth is the base the ground floor stands on. A room whose footprint extends beyond the plinth has part of its floor unsupported by the base. (Upper floors that cantilever past the plinth are a different case — those want pillars; see the cantilever guidance. This checks only the floor that sits directly on the plinth.)

**Fix.**

Grow the plinth (its size, or the plot variables it derives from) to cover the room, or pull the room back within the plinth.

---

## C16 — A room overhanging the floor below should have pillars under it · **warning**

**Statement.** If a room on floor N extends beyond the rooms of the floor below (a cantilever), there should be pillars supporting the overhang.

**Rationale.** An upper-floor room that sticks out past the walls below has nothing under its overhang. In a real build that extension needs columns at its outside edge. This warns when an overhanging room has no pillar anywhere near it. (A style guide — a genuinely cantilevered slab design is allowed; the warning just flags the missing support.)

**Fix.**

Add `pillar` objects at the outside of the extension (under the overhanging edge), or pull the room back over the floor below.

---

## C17 — A hip roof segment's span should not exceed its ridge run · **warning**

**Statement.** On a pitched roof with closed (hip) ends, a segment's span (`width`) should not exceed its ridge run (the `start`→`end` length).

**Rationale.** A closed hip end pulls the ridge inward by half the span to make room for the hip face. When the span exceeds the run, the two hip ends would meet past the centre, so the roof is clipped to a pyramid (the hip faces meet at a single apex) rather than the intended ridged hip. That is almost always a mis-oriented segment — the ridge drawn along the SHORTER dimension. It still renders as a valid pyramid, so this only warns.

**Fix.**

Orient the ridge along the LONGER dimension: swap the segment's `start`/`end` so it runs the long way, and set `width` to the shorter span. If a pyramid is genuinely intended, ignore this.

---

## C18 — Don't roof the same area twice · **warning**

**Statement.** A roof segment should not sit entirely within an area another roof segment already covers.

**Rationale.** Each roof segment spans a plan area (its ridge line ± `width`). When a new segment (often a whole new `roof` object an agent added) falls completely inside the area an existing roof already covers, the two roofs overlap — redundant geometry that renders as z-fighting and doubles the material take-off. Almost always the fix is to extend the existing roof, not add another. (Only a segment FULLY inside prior coverage is flagged, so abutting segments and ridge joints in a legitimate multi-segment roof never false-warn.)

**Fix.**

Remove the redundant roof/segment, or if you meant to cover more area, extend an existing segment's `width`/`end` instead of adding an overlapping one.

---

## C19 — Prefer one or two flights per floor when space allows · **warning**

**Statement.** A staircase should climb a floor in one or two flights unless the floor space is genuinely tight.

**Rationale.** A box-model staircase derives its flight count from the run it is given: too short a box forces extra switchback flights. Agents routinely under-size the box and get cramped 3-4 flight stairs where the floor had room for a straight run or a single U-turn. Fewer flights are easier to build and to walk. (A warning, since a tight plot may legitimately need a compact switchback.)

**Fix.**

Lengthen the staircase along its run axis (the box `length` for a N/S stair, `width` for E/W) to the reported minimum, or reduce `landing_depth`. The warning gives the exact length for one and two flights.

---

## C20 — A staircase's top landing must reach a room · **warning**

**Statement.** The top landing of a staircase should abut (or sit inside) a room on the floor it arrives at, so there is a way off the stair onto the floor.

**Rationale.** A switchback's arrival landing lands wherever the run ends, which is hard to predict and easy to get wrong (often the direction is simply flipped). When the top landing ends against a blank wall or in open space, the stair reaches the next level but there is no way onto the floor. This checks the resolved arrival rectangle against the rooms of the arrival floor. (A warning, since a landing that opens onto an outdoor terrace may not overlap a room.)

**Fix.**

Place the staircase so its top landing meets a room (leave that room's wall open there or add a door), or flip the `direction`/`turn` so the landing ends on the room side. The warning reports the arrival rectangle and which way it faces.

---

## C21 — The plinth should extend under a staircase · **warning**

**Statement.** A staircase on the lowest occupied floor should sit entirely on the plinth — the plinth footprint should cover it.

**Rationale.** The plinth is the base the ground floor stands on. An external staircase added past the building edge has its flights and landings resting on nothing unless the plinth is extended under it. Agents routinely add a stair to the outside and forget to grow the plinth. (Checks only the lowest occupied floor, the one that sits on the plinth; upper-floor stairs bear on that floor's slab.)

**Fix.**

Grow the plinth (its size, or the plot variables it derives from) so it covers the whole staircase footprint, or move the staircase inside the building over the plinth.

---

## C22 — A staircase needs an enclosing room or pillars to carry its landings · **warning**

**Statement.** A staircase should be enclosed by a room of (at least) its own footprint, or have pillars under it — something to carry the flights and turn landings.

**Rationale.** Switchback landings are elevated slabs; the flights land on them. In a real build the surrounding walls (a stairwell) or columns carry that load. A free-standing staircase with no enclosing room and no pillars has landings hanging in the air. (A warning: an open stair against a structural wall may be fine, but the common agent mistake is a stair floating in open space.)

**Fix.**

Put the staircase inside a room that covers its footprint (the walls carry the landings), or add `pillar` objects under the landings.

---

## C23 — A staircase's steps should be a realistic size · **warning**

**Statement.** A staircase's `step_rise` and `step_tread`, converted to real-world size, should fall in the human range — about a 6-7 in rise and a 10-12 in going.

**Rationale.** Stair steps are physically fixed regardless of the house, so they are the reliable tell for a scale mistake. Agents often copy a staircase from another example that is in different units (metres vs feet), producing steps that are absurdly large or tiny. This converts the steps to inches using the model's `units` and flags anything outside a generous human range.

**Fix.**

Rescale the staircase to THIS model's units. The warning gives the sensible `step_rise`/`step_tread` for this model (1 ft = `per_unit` units by default 10, so about `step_rise 6`, `step_tread 10`).

---

## C24 — A staircase needs a slab under it, not just a plinth · **warning**

**Statement.** When a staircase's floor has a slab (slab_thickness > 0), a slab should extend under the whole staircase footprint.

**Rationale.** A staircase's base rests at the floor's walking surface — its `z_offset` defaults to the floor `slab_thickness`, so it sits on TOP of the slab. If the slab does not reach under the stair (a common miss on an external stair, where the plinth was extended but the slab was not), there is a `slab_thickness` gap between the bottom of the stairs and the plinth where the slab should be. Extending only the plinth (C21) is not enough. (Skipped when the floor has no slab — `slab_thickness 0` — since the stair then rests directly on the plinth.)

**Fix.**

Add or grow a `slab` on the staircase's floor so it covers the whole staircase footprint, matching the plinth below it.

---

## C25 — A pillar under a slab or landing should reach it · **warning**

**Statement.** When a floor slab or a staircase landing sits directly over a pillar, the pillar should rise to the underside of it. A pillar that stops short leaves a gap and carries nothing.

**Rationale.** A column exists to carry the slab or landing above it; if it stops below that level there is a gap and the load has nothing to bear on. Agents often shrink a copied pillar's height (or a configurator lowers it) so it no longer reaches. This checks the LOWEST floor slab / staircase landing that actually sits over the pillar — so a pillar added to carry a stair's turn landings is checked against those landings, and a pillar supporting only a roof (which slopes, no flat datum) or with nothing above is never flagged. (A warning — a deliberately low post under a slab is allowed.)

**Fix.**

Raise the pillar height so its top meets the slab/landing above it. The warning reports the gap and a suggested height.

---

## SP1 — A spiral staircase's central pole must be smaller than its radius · **error**

**Statement.** A `spiral_staircase`'s `pole_radius` must be less than its outer `radius`.

**Rationale.** The treads run from the central pole out to the outer radius. If the pole is as wide as (or wider than) the stair, there is no tread left to stand on — the geometry collapses.

**Fix.**

Reduce `pole_radius` below `radius` (a pole is typically a small fraction of the radius).

---

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
