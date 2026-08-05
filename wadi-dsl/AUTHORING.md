# Designing a house with the Wadi DSL — an author's guide

This is a **task-oriented guide to writing `.wdl`** — the Wadi Design Language — and
driving the editor to turn one text file into a live 3-D house plus 2-D floor
plans, elevations, roof details, and quantities. It is written for the **author**:
the architect (or coding agent) who describes the building.

> New here? Read §1–§5 in order and you can model a real house. The later sections
> (parametrics, components, libraries, the configurator) are how you make that
> house *reusable and adjustable*.
>
> Companion docs: [`README.md`](README.md) (what the project is),
> [`COMPONENTS-AND-LIBRARIES.md`](COMPONENTS-AND-LIBRARIES.md) (deep dive on reuse),
> and the method behind it all — [`../PARAMETRIC-DSL-METHOD.md`](../PARAMETRIC-DSL-METHOD.md).

---

## Contents

1. [What you're writing](#1-what-youre-writing)
2. [Your first house](#2-your-first-house)
3. [The house skeleton](#3-the-house-skeleton) — convention, units, site, defaults, coordinates
4. [Floors](#4-floors) — the vertical stack
5. [Rooms, walls & openings](#5-rooms-walls--openings)
6. [Structure](#6-structure) — slab, beam, pillar, plinth, ground
7. [Circulation & fittings](#7-circulation--fittings) — staircase, kitchen
8. [Furniture](#8-furniture) — items & assets
9. [Roofs](#9-roofs) — flat, shed, gable, hip
10. [Going parametric](#10-going-parametric) — variables, points, grids, formulas
11. [Components](#11-components) — design once, stamp many
12. [Libraries](#12-libraries) — import & reuse across files
13. [The configurator](#13-the-configurator) — knobs for the home-owner
14. [Layers & the raw escape](#14-layers--the-raw-escape)
15. [Using the editor](#15-using-the-editor) — completion, hover, go-to-def, rename, live preview
16. [Sharing & exporting](#16-sharing--exporting)
17. [Good practice & gotchas](#17-good-practice--gotchas)
18. [Quick reference](#18-quick-reference)

---

## 1. What you're writing

A `.wdl` file is a **complete, human-readable description of a building**. You type
it in the **WDL editor** (the web app at `wadi.house/dsl`, or the desktop app's
`Window → DSL editor`, ⌘⇧D) and the model rebuilds live in the pane beside you: a
3-D view, floor plans, elevations, roof details, and a quantities estimate.

The core promise: **one file is the single source of truth.** From it Wadi
produces every drawing and the 3-D model — you never keep them in sync by hand.
And because the file is plain text, you can version it, diff it, share it, and let
a coding agent write or edit it.

Under the hood the editor **compiles** your `.wdl` to a `.wadi` model (JSON) and
feeds it to the Wadi renderer. You mostly won't see the `.wadi` — but you can
download it, and you can **import** a `.wadi` back into editable `.wdl` (§16).

---

## 2. Your first house

Paste this into the editor. It's the smallest thing that renders:

```wdl
house MyFirstHouse {
  convention center
  units feet_inches per_unit 10
  site { plot (300, 300) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }

  floor 1 "Ground" {
    room Living at (0, 0) size (240, 200) {
      wall north east south west
    }
  }
}
```

You get a single room, enclosed on all four sides, on one floor. That's a valid
house. Everything else in this guide adds to this skeleton.

A few things to notice already:

- **`house Name { … }`** wraps everything.
- **Numbers are in project units**, and with `per_unit 10` there are **10 units to
  a foot** — so `size (240, 200)` is a **24 ft × 20 ft** room.
- The room is placed at `(0, 0)` and sized `(240, 200)`. **X runs right, Y runs
  down** (top-left origin, like a floor plan on paper).
- A bare `room { }` with no `wall` lines is enclosed on all four sides; here we
  listed the walls explicitly — `wall north east south west` — which is the same
  thing.

---

## 3. The house skeleton

Every house begins with a few settings. Here they are, annotated:

```wdl
house CoastalCottage {
  convention center                 // how room coordinates are interpreted (see below)
  units feet_inches per_unit 10     // display: label drawings in feet-inches; 10 units = 1 ft

  site { plot (600, 700) ref (0, 0) } // plot is 60 ft × 70 ft; ref = the origin corner
  defaults {                          // house-wide fallbacks, overridable per floor/object
    floor_height   116                // floor-to-floor rise
    wall_height    108                // standing wall height
    slab_thickness 8                  // deck thickness
    wall_thickness 8                  // wall thickness (also drives the center convention)
  }
  // …vars, points, grids, configurator, layers, floors…
}
```

### The coordinate system (read this once)

- **X → right, Y → down.** Think of the floor plan as you'd draw it on paper:
  origin at the top-left, X increases rightward, Y increases downward.
- **Height is a separate axis.** `floor_height`, `wall_height`, `z_offset`, and a
  roof's `slope height` live on the vertical axis; they never mix with X/Y.
- **Units are abstract.** Geometry is stored in plain "project units". The `units`
  block only decides how numbers are *labelled* on drawings. With
  `per_unit 10`, a wall drawn `108` units tall is annotated **10'-9"** — but if you
  change the display unit, **the model does not resize.** Storage units and display
  units are deliberately independent.

### `convention center` vs `convention outer` (important)

This decides what a room's `at (x,y) size (w,l)` *means*:

- **`center` (use this):** the numbers are **wall centrelines**. Two rooms that
  share a wall just use the **same coordinate** on their shared edge — they *abut*
  on a line — and Wadi grows each footprint outward by half the wall thickness to
  the real outer face. **You never do wall math.**
- **`outer` (legacy):** the numbers are the **outer wall face**. Adjacent rooms
  must *overlap* by a wall thickness, so you're constantly adding/subtracting
  thicknesses. Avoid it in new designs.

With `center`, a two-room house is as simple as:

```wdl
room Living  at (0,   0) size (200, 200) { wall north south west }
room Bedroom at (200, 0) size (150, 200) { wall north south east }
// they share the line X=200 — no overlap, no arithmetic
```

### `defaults` and per-floor/per-object overrides

`defaults` are the fallback dimensions. Any floor can override `height`,
`wall_height`, `slab_thickness`; any object can override its own dimensions. You
only specify what differs from the defaults.

---

## 4. Floors

A house is a stack of floors. **Array order is the physical stack** — the first
`floor` you write is the bottom.

```wdl
floor 0 "Plinth" height 40 { … }   // a low base floor
floor 1 "Ground Floor" { … }        // sits on top of floor 0
floor 2 "Loft" { … }                // and so on
```

- `floor <number> "<Name>"` — the number is a label/id; the **order in the file**
  is what stacks.
- Optional per-floor overrides, in this order: `height N`, `wall_height N`,
  `slab_thickness N`.
- **The plinth floor.** By convention floor `0` is a low "Plinth" floor carrying
  the terrain (`ground`) and the raised base (`plinth`); give it `height` equal to
  the plinth height (see §6). The floors above it are the living levels.

Inside a floor is a list of **objects** — rooms, walls, structure, furniture,
roofs, component instances. The rest of §5–§11 is that vocabulary.

---

## 5. Rooms, walls & openings

The `room` is the workhorse. It's a rectangle that **grows its own walls**.

```wdl
room Living at (main.x1, main.yA) size (200, 200) {
  wall west                                    // a plain exterior wall
  wall north { window LivN at 55 size (55, 55) sill 35 }  // a wall carrying a window
  wall south { door  LivDoor at 60 size (32, 80) }        // a wall carrying a door
  // (east omitted → that side is left open, e.g. a verandah)
}
```

Rules of thumb:

- **A bare `room { }` is enclosed on all four sides.** As soon as you write *any*
  `wall` line, you get exactly the sides you list — so list them all if you want a
  fully closed room.
- **List plain walls compactly:** `wall north east south` on one line.
- **Give a wall its own `{ … }` block only when it carries an opening** (door or
  window). One side per block.
- **Omit a side to leave it open** — that's how you model a verandah or a
  sit-out.

### Doors & windows

Openings live inside a wall's block:

```wdl
wall south { door Main at 120 size (36, 84) [open] }
wall west  { window W1  at 100 size (60, 50) sill 35 [open] }
```

- `at <offset>` is the distance **along the wall** to the opening.
- `size (width, height)` is the hole.
- `sill <s>` (windows) is the height of the sill above the floor.
- `open` marks it as an actual opening (a doorway/opening with no leaf) vs a
  closed door/window.

### Free-standing walls

For a partition or garden wall that isn't a room edge, use a `wall … from … to …`:

```wdl
wall Partition from (100, 0) to (100, 350) height 108 facing east
```

- `from`/`to` are the two endpoints (centreline).
- `height_end <h2>` (optional) different from `height` makes a **sloping-top**
  wall (e.g. a gable wall).
- `facing <side>` picks which face is the "front".
- **Free walls don't auto-mitre.** Two walls that merely touch at a point leave a
  small notch — **overlap** the endpoints (extend past the shared point by ≥ half
  the wall thickness) so the bodies fill the corner. Room walls handle their own
  corners.

---

## 6. Structure

The load-bearing and base elements. All of these use `at (x,y) size (w,l)` with the
**top-left corner** at `(x,y)` (same as rooms):

```wdl
slab   at (main.x1, main.yA) size (main.x3 - main.x1, main.yC - main.yA)   // an RCC deck
beam   name "Tie" at (0, 340) size (300, 8) height 8                        // a horizontal member
pillar C1 at (main.x1, main.yA) size (10, 10) height 116                    // a structural column
plinth name "Plinth" at (0, 0) size (300, 300) height 40                    // the raised base
ground name "Ground" at (0, 0) size (600, 700)                              // the terrain plane
```

- `slab` / `beam` / `plinth` / `ground` take an optional `name`, then
  `at`/`size`, then an optional `height` (or `thickness` on a slab).
- **`pillar` needs a name** and `at (x,y) size (w,l) height h`. Its `at` is the
  **top-left corner** (not the centre) — to centre a column on a point `(cx,cy)`
  place it at `(cx - w/2, cy - l/2)`. Where a pillar overlaps a wall, the wall
  auto-trims to butt against the column (2-D and 3-D), so you can lay columns on
  the grid without fighting the walls.
- **`ground`** is the site plane; **`plinth`** is the raised platform the house
  sits on. Put both on the floor-0 "Plinth" floor.

---

## 7. Circulation & fittings

### Staircase

```wdl
staircase name "Stair" at (208, 64) step (7, 11, 44) direction south
  total_height 116 max_run 90 turn clockwise
```

- `at (start_x, start_y)` — the bottom of the stair.
- `step (rise, tread, width)` — one step's dimensions.
- `direction north|south|east|west` — the way it climbs.
- `total_height <h>` — the height to climb (usually the floor height); Wadi
  computes the number of steps.
- `max_run <r>` — optional. If set, the stair **auto-switchbacks** into multiple
  flights with landings whenever a straight run would exceed `r`. Tune with
  `landing_depth`, `landing_thickness`, `flight_gap`, and `turn clockwise|anticlockwise`.

### Kitchen platform

An L- or U-shaped counter, described as a **polyline path** of its inner edge:

```wdl
kitchen name "Counter" path ((40, 40), (140, 40), (140, 120)) side right depth 24 height 36
```

- `path (…points…)` — the centreline of the run.
- `side left|right` — which side of the path the counter body is on.
- `depth` — counter depth; `height` — counter height; `base_z` — optional lift.

---

## 8. Furniture

Furniture is a GLB model dropped into the scene as an `item`.

**From a pack** (the easy way — see §12 for `import`):

```wdl
import "std-furniture" as f
// …then, on a floor:
item f."bed_double" at (60, 60) rotation 0 scale 1
```

**Anchored inside a room** (no x/y — placed relative to the room box):

```wdl
room Bedroom at (0,0) size (200,200) {
  wall north east south west
  item f."bed_double" anchor bottom-right gap (12, 12)
}
```

**A one-off model** (inline `asset`, not in any pack):

```wdl
item name "Sofa" asset { id "sofa" src "furniture/sofa.glb" dims (1.9, 0.8, 0.9) category "living" }
  at (150, 300) rotation 90 scale 1
```

- `at (x,y)` places by plan coordinate; **or** use `anchor` (inside a room) /
  `anchor_to "Room" anchor center gap (gx,gy)` to pin to a room corner/centre.
- `rotation <deg>` (yaw, 0 = facing south, 90 = east), `scale <s>` optional.
- `dims (w, h, d)` in **metres** — Wadi scales the GLB to those real dimensions.

---

## 9. Roofs

One `roof` object covers the whole roof; a **`type`** (`flat` / `shed` /
`pitched`) plus per-segment geometry gives you flat, shed, gable, and hip roofs.

**The mental model:** a roof is made of **segments**, each an axis line
(`from`→`to`) with a `width` centred on it. **Roof coordinates are wall
centrelines, exactly like rooms** — author the segment on the same grid lines as
the walls and the roof auto-grows to the outer wall face; then `overhang` extends
beyond. Don't add half-wall fudge factors.

A gable roof (open ends), with a truss:

```wdl
roof name "Gable Roof" pitched endpoint open slope angle 30 overhang 20 {
  segment "seg0" from (150, 0) to (150, 400) width 300 gable_overhang (20, 20) tie_beams 2
  truss "seg0" fink at (80, 200, 320)
}
```

Key knobs:

- `pitched | shed | flat` — the roof type.
- `endpoint open | closed` — an **open** end is a **gable** (triangular end wall);
  a **closed** end is a **hip** (sloped triangle). Set the default here, or per
  segment with `start_endpoint` / `end_endpoint`.
- Pitch — pick one:
  - `slope angle <deg>` — symmetric pitch by angle;
  - `slope height <ridge_h>` — by ridge height;
  - `slope angle (<left>, <right>)` — an **asymmetric (saltbox) gable** — two
    different pitches; eaves stay put, the ridge shifts.
- `overhang <o>` — uniform eave; per-side overrides exist
  (`overhang_left/right/start/end/low/high`).
- `slab_thickness`, `parapet <h> x <t>` (flat-roof parapet), `gable_wall_thickness`.
- Inside `{ … }`: `segment "id" from … to … width …` (+ per-segment
  `high_side`, `hip_setback (a,b)`, `gable_overhang (a,b)`, `hip_ridge_extension (a,b)`,
  `tie_beams N`), and `truss "segId" fink|mono_pitch at (pos, …)` for structural
  trusses at positions along the segment.

**Choosing a roof by type** at a glance: `flat` (add a `parapet`); `shed`
(single-slope, set `high_side`); gable = `pitched` + `endpoint open`; hip =
`pitched` + `endpoint closed`.

---

## 10. Going parametric

Everything so far is a *fixed* house. The payoff of Wadi is making it a
**parametric model** — a design you can resize and vary. Four constructs do this,
all optional.

### Variables — the degrees of freedom

```wdl
var wallT      = 8
var pillarW    = 10
var pilInset   = (pillarW - wallT) / 2     // vars may reference each other
var roof_style = 3
```

A `var` is a named number (or a formula). These are the knobs your design turns on.

### Points — named anchors that double as sizes

```wdl
point House { x = 420, y = 470 }
```

Reference a point's coordinates in formulas as `House.x` / `House.y` — and, as a
convenience, the same values as a **size**: `House.W` (= x) and `House.L` (= y).
So one `point House` gives you both the origin math and the overall `width`/`length`.

### Grids — the structural scaffold (the big one)

A `grid` is a set of **named centrelines** per axis — X lines numbered `1,2,3…`,
Y lines lettered `A,B,C…` — each positioned by a formula:

```wdl
grid main {
  x: 1 @ wallT / 2  role structural,
     2 @ House.W / 2,
     3 @ House.W - wallT / 2  role structural
  y: A @ wallT / 2  role structural,
     B @ House.L / 2,
     C @ House.L - wallT / 2  role structural
}
```

Each line is published as a formula symbol: `main.x1`, `main.x2`, `main.yA`, … Now
place rooms, slabs, and columns **by grid line, with no wall math**:

```wdl
room Living at (main.x1, main.yA) size (main.x2 - main.x1, main.yB - main.yA) { … }
slab        at (main.x1, main.yA) size (main.x3 - main.x1, main.yC - main.yA)
pillar C1   at (main.x1, main.yA) size (pillarW, pillarW) height 116
```

Change `House.W` or the bay spacing and **every room, slab, and column bound to
the grid re-flows together**. Optional per-line `thick <expr>` (a "tartan" grid)
and `role structural|planning` tag lines for clarity.

### Formulas — the universal hook

Any numeric field, anywhere, can be a **formula** instead of a literal — just
write an expression:

```wdl
size (main.x3 - main.x1, main.yC - main.yA)     // width/length as grid spans
height wall_height + slab_thickness              // a derived height
enabled 1 - min(1, abs(roof_style - 2))          // a 0/1 gate (see below)
```

The formula language is deliberately tiny and safe — **arithmetic only**:

```
+  -  *  /   ( )   -unary
min  max  clamp  round  floor  ceil  abs
references: a var · a point (House.W) · a grid line (main.x3 - main.x1)
```

There are **no `if`/comparisons** — you emulate them with arithmetic. The idiom
`1 - min(1, abs(x - N))` evaluates to **1 when `x == N`, else 0**, which is how you
build on/off gates (next).

### `enabled` — turn objects on and off

Every object accepts `enabled <expr>` in its common tail. `enabled 0` (or a
formula that resolves to 0) removes the object from **every** view:

```wdl
room Pooja at (…) size (…) enabled has_pooja { … }     // optional room
```

> **Placement of the common tail.** For most objects the tail
> (`z_offset`/`enabled`/`layer`/`material`) comes at the very end. A **`room` is the
> exception**: because it ends with a `{ … }` block of walls, its tail goes
> **before** the block — `room R at (…) size (…) enabled e layer "id" { … }`.

Two idioms fall out of this:

- **Optional parts** — gate a whole room/feature on a `0/1` variable.
- **Mutually-exclusive variants** — put four roofs in the file, each gated
  `enabled 1 - min(1, abs(roof_style - N))`, and exactly one renders for a given
  `roof_style`. A `select` knob then swaps whole roofs with no code.

### The common tail (every object accepts these)

```
… z_offset <expr>  enabled <expr>  layer "id"  [material "id"]
```

`z_offset` lifts the object above its floor base (for split levels); `layer`
assigns it to a display layer (§14); `material` picks a material.

---

## 11. Components

When a sub-assembly repeats — a stair core, a bathroom, a bench, a verandah —
promote it to a **component**: define it once, stamp it many times.

**Define** a component in its own **local coordinates** (origin `0,0`), with
optional `param` knobs:

```wdl
component Bench goal "a low bench to sit on" {
  param blen = 60 label "Bench length"     // a knob with a default
  param bdep = 18
  beam name "Top" at (0, 0) size (blen, bdep) height 6
}
```

**Use** (stamp) it onto a floor with `use`, optionally naming the instance,
rotating it, and overriding params (overrides use `=`, not `:`):

```wdl
use Bench as "WindowBench" at (60, 60) rotation 90 with { blen = 80 }
```

- `at (x, y)` offsets the component's local origin onto the floor.
- `rotation <deg>` (optional) turns the whole stamped assembly. **Right angles
  (0/90/180/270) are exact for any component**; a non-right angle is allowed **only
  for a furniture-only component** (a free angle on something structural is a
  compile error — arbitrary structural rotation is a future feature).
- `with { p = v, … }` overrides params; un-overridden ones fall back to defaults.
  A `= formula` param is evaluated in the **host's** scope, so it can read the
  house's variables.
- A component expands **byte-identical to writing its objects inline** — pure
  reuse, no runtime cost.

Components **nest freely**: a component may `use` another component and place
`item` furniture — including ones from a library it imports.

The `goal "…"` string documents intent and is the discovery key when browsing
libraries (§12).

---

## 12. Libraries

A **library is just a `.wdl` file** whose top level holds `component` / `asset`
declarations (no `house` needed). Another file pulls it in with `import` and uses
its exports under a namespace.

```wdl
house Home {
  import "konkan/base"   as kb      // a component pack
  import "std-furniture" as f       // a furniture pack

  floor 1 "Ground" slab_thickness 0 {
    use  kb.Verandah at (20, 20) with { across = 200 }   // a component from the pack
    item f."bed_double" at (60, 60)                       // an asset from the pack
  }
}
```

- `import "name" as ns` makes the module's exports available as `ns.Comp` (use) and
  `ns."assetId"` (item). A **bare** `import "name"` merges its exports
  un-namespaced.
- Imports resolve **transitively** — a library may itself import libraries — and a
  library component may `use` a sibling or place furniture from its own imports.

### Two bundled packs (always importable, no setup)

- **`std-furniture`** — ~120 furniture assets → `item f."bed_double"` etc.
- **`konkan/base`** — goal-tagged Konkan parts: `Stairwell`, `Verandah`, `Otla`,
  `Bathroom`, `Kitchen`, `TulsiVrindavan`, `Parapet` → `use kb.Verandah …`.

### Save & reuse your own libraries

The editor keeps a **cache of loaded libraries** that `import` resolves from — the
same on the web app and desktop. Open the **📚 Library** toolbar menu:

| Action | What it does |
|---|---|
| **💾 Save current as library…** | names the current file and puts it in the cache |
| **📂 Load library file…** | loads one or more `.wdl` files into the cache |
| *(the cached list)* | click a name to insert its `import` line · **✎** open it · **×** remove it |

Resolution order: **your cache → the bundled packs**. If a file imports something
uncached, the editor names exactly what's missing so you can load it. On the
**desktop app**, any `.wdl` beside your open file (or in a `modules/` subfolder) is
auto-loaded and importable by its basename.

See [`COMPONENTS-AND-LIBRARIES.md`](COMPONENTS-AND-LIBRARIES.md) for the full story.

---

## 13. The configurator

The configurator is where you, the architect, decide **which variables a
home-owner may adjust, and within what bounds** — turning your parametric model
into a safe, guided template. Each knob **targets a `var`** by name; turning it
just writes a number into that variable and the whole house re-flows.

```wdl
configurator {
  title "Configure your home"
  note  "Everything re-flows to fit."

  slider pillarW   "Column size" ft [8 .. 14 step 1]
  number plotDepth "Plot depth" ft                    // NB: `depth` is reserved — use plotDepth
  toggle has_pooja "Include a pooja room"
  select roof_style "Roof style" { Flat = 0, Shed = 1, Gable = 2, Hip = 3 }

  group "Structure" note "advanced" {
    slider wallT "Wall thickness" [6 .. 12 step 1]
  }
}
```

- `slider target "Label" [unit] [min .. max step s] [note "…"]`
- `number target "Label" [unit] [note "…"]`
- `toggle target "Label" [note "…"]` — a 0/1 switch (pair it with an `enabled`
  formula on the optional object).
- `select target "Label" { Thin = 6, "10 ft (std)" = 100 }` — labels are bare ids
  or quoted strings; each maps to the number the var is set to.
- `group "Section" [note "…"] { …inputs… }` sections the owner's panel.

> To expose a **plot dimension**, model it as a `var`, reference it from a `point`
> (`point House { x = W }`), and target the knob at `W` — knobs target vars, not
> point fields.

This is the **architect → owner handoff**: you ship the template; the owner opens
it in the app and turns your knobs to fit their plot and taste, never touching the
geometry.

---

## 14. Layers & the raw escape

**Layers** are display groups (show/hide, colour) — purely visual, never geometry:

```wdl
layer "structure" "Structure" color "#8B5A2B" group "Frame"
// then, on any object:
pillar C1 at (…) size (…) height 116 layer "structure"
```

**`raw`** is an escape hatch to write a literal model object as JSON, for anything
without first-class syntax yet. Every model type now *has* ergonomic syntax, so you
should rarely need it:

```wdl
raw "some_future_type" { key: 1, nested: { a: 2 } }
```

---

## 15. Using the editor

The WDL editor is a full IDE for the language — the same at `wadi.house/dsl` and in
the desktop app (⌘⇧D).

**Live loop.** Type; the model recompiles and the pane beside you rebuilds — 3-D,
Floor Plans, Elevations, Roof Details, Layout, Quantities tabs. A status pill shows
**✓ rendered** or the first error; parse/validation errors also appear as
**squiggles** and in a Problems panel with line numbers.

**IDE features** (powered by the language itself, so they understand your imports):

- **Completion** — after `use ` it suggests in-scope components (in-file **and**
  from imported libraries, e.g. `kb.Verandah`); after `item ` it suggests asset
  ids. Also keyword completion.
- **Hover** — hover a `use kb.Comp` to see the component's goal + params; hover an
  `item f."id"` to see the asset's dimensions.
- **Go-to-definition** (F12 / ⌘-click) — jump to a component's definition, **in
  this file or into the imported library** (which opens read-only).
- **Find references** (⇧F12) — every place a component is used.
- **Rename** (F2) — rename an in-file component and all its `use` sites at once.

**Toolbar:** a **sample picker** (`✨ New`), **Open** / **Save .wdl**, **⬇ .wadi**
(download the compiled model), **📚 Library** (§12), **↩ Import .wadi** (§16), and
**📖 Reference** — a built-in cheat-sheet of every construct.

---

## 16. Sharing & exporting

- **Download the model** — **⬇ .wadi** gives you the compiled JSON model (what the
  renderer consumes; also what you'd publish as a template).
- **Import a `.wadi` back to code** — **↩ Import .wadi** *decompiles* an existing
  `.wadi` model into editable `.wdl`, so you can round-trip a model authored in the
  form UI (or an older template) back into the DSL.
- **Share a house** — the Wadi app can encode a whole house into a **share link**
  (no server needed) and open native **`.wadi` files** directly (open-in-app).
- **Save `.wdl`** — keep the source file itself under version control; it's the
  durable source of truth.

---

## 17. Good practice & gotchas

- **Use `convention center`.** It removes all wall-offset arithmetic.
- **Author on a grid.** Define a `grid` from your plot `point`, then place rooms/
  slabs/columns by grid line. Resizing then means changing one number.
- **Numbers, not formulas, in geometry when it's fixed.** A formula is an overlay;
  a plain number always renders. Reach for a formula when a field should *follow*
  a variable/grid.
- **Reserved words can't be `param` names.** Grammar keywords (`width`, `depth`,
  `height`, `size`, …) are reserved — name params `across`, `deep`, `tall`, `blen`,
  etc.
- **Free walls don't mitre** — overlap their endpoints at corners (§5). Room walls
  handle corners themselves.
- **Furniture dims are metres**; geometry is project units (10 = 1 ft). Don't mix.
- **A house-less library** shows a "no floors" notice in the preview — that's
  expected; give it a demo `house` if you want to preview its components.
- **Structural conventions (the built-in linter).** The editor's status pill flags
  a few conventions: a plinth floor's `height` should equal its `plinth` object's
  height (**C1**); exterior room sides should carry a `wall` (**C2**); a floor with
  no slab should set `slab_thickness 0` (**C3**). These are guidance, not errors.

---

## 18. Quick reference

```wdl
// ── skeleton ─────────────────────────────────────────────────────────
house Name {
  convention center                      // or: outer
  units feet_inches per_unit 10
  site { plot (W, L) ref (x, y) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }
  // vars, points, grids, configurator, layers, components, floors…
}

// ── parametric core ──────────────────────────────────────────────────
var name = <expr>
point Name { x = <expr>, y = <expr> }            // ref: Name.x / Name.W / Name.L
grid g { x: 1 @ <expr> [thick <e>] [role structural|planning], 2 @ <e>
         y: A @ <expr>, B @ <e> }                // published as g.x1 / g.yA
// formulas: + - * /  ( )  -unary   min max clamp round floor ceil abs

// ── floors & objects (common tail: z_offset · enabled · layer · material) ──
floor 1 "Ground" [height N] [wall_height N] [slab_thickness N] { …objects… }

room Name at (x,y) size (w,l) [height h] [enabled <e>] [layer "id"] {   // room tail: BEFORE the block
  wall east west north                           // plain sides (list several)
  wall south { door  D at <off> size (w,h) [open] }
  wall west  { window W at <off> size (w,h) [sill s] [open] }
  item asset { … } anchor center [gap (gx,gy)]
}
wall Name from (x1,y1) to (x2,y2) [height h] [height_end h2] [facing dir] { …openings… }

slab   [name "N"] at (x,y) size (w,l) [thickness t]
beam   [name "N"] at (x,y) size (w,l) [height h]
plinth [name "N"] at (x,y) size (w,l) height h
ground [name "N"] at (x,y) size (w,l) [height h]
pillar Name       at (x,y) size (w,l) height h        // at = TOP-LEFT corner

staircase [name "N"] at (sx,sy) step (rise,tread,width) direction north|south|east|west
  [total_height h] [max_run r] [landing_depth …] [flight_gap …] [turn clockwise|anticlockwise]
kitchen [name "N"] path ((x,y),(x,y),…) side left|right depth d height h [base_z z]
item [name "N"] (f."id" | asset { id "…" src "…glb" dims (w,h,d) [category "…"] })
  at (x,y) [rotation d] [scale s] [anchor_to "Room" anchor center gap (gx,gy)]

roof [name "N"] pitched|shed|flat [endpoint open|closed]
  [slope angle <d> | slope height <h> | slope angle (<l>,<r>)]
  [overhang o] [slab_thickness t] [parapet h x t] {
    segment "id" from (x,y) to (x,y) width w [start_endpoint …] [gable_overhang (a,b)] [tie_beams N]
    truss "segId" fink|mono_pitch at (pos, …)
  }

// ── reuse ────────────────────────────────────────────────────────────
component Name [goal "…"] { param p = default [label "…"]  …objects in local coords… }
use Name [as "id"] at (x,y) [rotation deg] [with { p = v, … }]
import "name" [as ns]     // ns.Comp · ns."assetId"  (bundled: std-furniture, konkan/base)

// ── owner knobs ──────────────────────────────────────────────────────
configurator {
  title "…"  note "…"
  slider target "Label" [ft] [min .. max step s] [note "…"]
  number target "Label" [ft]
  toggle target "Label"
  select target "Label" { Label = value, "Quoted" = value }
  group "Section" [note "…"] { …inputs… }
}

// ── display ──────────────────────────────────────────────────────────
layer "id" "Label" [color "#rrggbb"] [group "Group"]
raw "type" { …literal JSON… }            // escape hatch
```

See also the built-in **📖 Reference** panel in the editor, the full
[`COMPONENTS-AND-LIBRARIES.md`](COMPONENTS-AND-LIBRARIES.md), the example files in
[`examples/`](examples/) (start with `minimal.wdl`, then `coastal.wdl` for a
grid-driven house and `complete.wdl` for every construct at once), and the design
philosophy in [`../PARAMETRIC-DSL-METHOD.md`](../PARAMETRIC-DSL-METHOD.md).
```
