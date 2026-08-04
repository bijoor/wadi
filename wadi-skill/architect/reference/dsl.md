# The Wadi DSL (`.wdl`) — authoring reference

You author houses in the **Wadi DSL** — a small, formal language (`.wdl`) that
compiles to a resolved `.wadi` (`house_config.json`). The DSL is **complete**:
every object type in the model has first-class syntax, so you rarely need the
`raw` escape. Authoring the DSL is more direct and less error-prone than writing
JSON — the grammar enforces structure, and `check.sh` reports parse errors with
line:col.

**This file is the SYNTAX reference.** The *semantics* live in the other
references and apply unchanged — read them:

- `coordinate-system.md` — X→right, **Y→DOWN**, Z→up; **10 units = 1 ft**;
  the **centreline** convention. The #1 source of mistakes.
- `conventions.md` — the **structural coding conventions** (`check.sh` enforces
  them): plinth-floor height must match the plinth block, rooms must wall every
  exterior side, a no-slab floor must set `slab_thickness 0`.
- `parametric-conventions.md` — the grid-first recipe for reusable templates.
- `roof-v2-guide.md` — roof segments, hip vs gable, trusses, joints.
- `data-model.md` — the underlying `.wadi` schema (what the DSL compiles to; also
  the field reference for the `raw` escape).

## The loop

1. Write / edit `house.wdl` — the **single shared source** (you and the human
   co-edit it; the app's DSL previewer renders it live). You never produce a `.wadi`.
2. `wadi-skill/architect/scripts/check.sh house.wdl` — runs the DSL compiler +
   validator (schema + wall/roof geometry) against a **throwaway temp** just for
   feedback; fix any reported error and re-run.
3. `preview.sh house.wdl` → read the PNGs (plans / elevations / roof) to check your
   work. (It also compiles to a throwaway temp — no persistent `.wadi`.)

## Skeleton

```wdl
house MyHouse {
  convention center                 // ALWAYS use center (wall-centreline coords)
  units feet_inches per_unit 10     // 10 project units = 1 ft
  site { plot (WIDTH, LENGTH) ref (0, 0) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }

  // parametric core (optional): var, point, grid, configurator
  // component / layer declarations (optional)
  floor 0 "Plinth" { … }            // floors stack in source order (0 = plinth)
  floor 1 "Ground Floor" { … }
  floor 2 "Loft" { roof … }         // roof lives ALONE on its own top floor
}
```

Numbers are **project units** (feet × 10 by default). Names after `house`,
`room`, `pillar`, `var`, `point`, `grid`, and `use`/`component` are bare
identifiers (no spaces); names introduced with the `name` keyword are quoted
strings.

## Parametric core (domain-neutral)

```wdl
var wallT = 8                       // a knob; may reference other vars
var pilInset = (pillarW - wallT) / 2

point House { x = 420, y = 470 }    // reference as House.x / House.W / House.L
                                    // (.W = x, .L = y — a point doubles as a size)

grid main {                         // named wall centrelines; publishes main.x1 / main.yA
  x: 1 @ wallT / 2, 2 @ House.W / 2, 3 @ House.W - wallT / 2
  y: A @ wallT / 2, B @ House.L / 2, C @ House.L - wallT / 2
}
// each line may add:  … @ <expr> thick <expr>  role structural|planning

configurator {                      // the knobs a downstream user turns
  slider pillarW    "Column size" ft [8 .. 14 step 1]
  number ceiling    "Ceiling height" ft
  toggle has_loft   "Add a loft"
  select roof_style "Roof style" { Flat = 0, Shed = 1, Gable = 2, Hip = 3 }
}
```

**Formulas are automatic.** Any geometry number can be a formula — just write the
expression instead of a literal (`at (main.x1, main.yA)`, `size (House.W/2, 200)`).
Operators: `+ - * /`, unary `-`, parentheses, and the functions
`min max clamp round floor ceil abs`. References: a `var`, a `point`
(`House.W`), or a grid line (`main.x3 - main.x1`). No comparison operators — gate
things with the `min/abs` idiom (see `enabled` below).

## Common attribute tail (every object)

After an object's geometry, in THIS order, any of:

```
… z_offset <expr>   enabled <expr>   layer "id"   [material "id"]
```

- `enabled <expr>` — the on/off switch. A `0`/`false` value hides the object. To
  gate on a configurator variable, use a 0/1 formula:
  `enabled 1 - min(1, abs(roof_style - 3))` renders the object only when
  `roof_style == 3`. (This is how one template carries several roofs and shows
  only the chosen one.)
- `z_offset <expr>` — lift above the floor base (split levels).
- `material "id"` — only on plinth / ground / room / wall / staircase / kitchen /
  roof.

## Objects — structure & envelope

```wdl
slab   [name "N"] at (x,y) size (w,l) [thickness <t>]     // floor_slab
beam   [name "N"] at (x,y) size (w,l) [height <h>]
plinth [name "N"] at (x,y) size (w,l) height <h>          // raised base (Plinth floor)
ground [name "N"] at (x,y) size (w,l) [height <h>]        // terrain plane
pillar Name       at (x,y) size (w,l) [height <h>]        // (x,y) = TOP-LEFT corner
```

`at (x,y)` is the **TOP-LEFT CORNER** — **not the centre** — for every one of these
(same as rooms/slabs/beams); `size (w,l)` is width × length. All accept the common tail.

**Pillars catch people out here.** A column reads as "placed at a point," but `at` is
still its corner. To **centre a column on a point** `(cx, cy)` — a grid node, a room
corner — place it at **`at (cx - w/2, cy - l/2)`**, never at `(cx, cy)`. On a grid, the
`pilInset` idiom (see `parametric-conventions.md`) does exactly this so columns sit flush.

## Objects — rooms, walls & openings

A room shows exactly the walls you declare. A **bare room (no `wall` lines) is
enclosed on all four sides.** List plain walls compactly; give a wall its own line
only when it carries a door/window; omit a side to leave it open (verandah).

```wdl
room Name at (x,y) size (w,l) [height <h>] [material "…"] {
  wall east west north                 // plain walls — several in one statement
  wall south { door Main at <offset> size (w,h) [open] }   // wall WITH openings: one side
  wall west  { window W at <offset> size (w,h) [sill <s>] [open] }
  item asset { … } anchor center [gap (gx,gy)]   // furniture anchored inside the room
}
```

- `wall <side>…` sides are `north|south|east|west`. A `wall <side>` line may also
  add `height <h>` / `height_end <h>` (sloped).
- `door`/`window` `at <offset>` is measured along the wall from its start;
  `size (width, height)`; `window … sill <s>` sets the sill height; `open` = a bare
  hole (no leaf/glazing).

A **free-standing wall** (not a room side):

```wdl
wall Name from (x1,y1) to (x2,y2) [height <h>] [height_end <h>] [facing north|…] {
  … door/window openings …
}
```

- `from`/`to` are the wall's **centreline** endpoints; the wall is drawn as a rectangle
  `wall_thickness` wide, centred on that line.
- **Overlap walls at corners — they do NOT auto-mitre.** Two free-standing walls that
  merely *touch* at a shared endpoint leave an unfilled square notch (½·`wall_thickness`)
  at the corner, because each is just a rectangle capped at its endpoint. To fill the
  corner, **extend the endpoints so the wall bodies OVERLAP** — run at least one wall's
  end **half the wall thickness past** the shared point (overlapping by the full thickness
  is fine and simplest). For an L of thickness 8 meeting at `(160,40)`:

  ```wdl
  wall H from (40, 40)  to (164, 40)  height 108   // ends 4 (½·8) PAST the corner
  wall V from (160, 40) to (160, 160) height 108    // butts into H's overlapped body
  ```

  (Room walls handle their own corners; this only applies to `wall … from … to …`.)

## Objects — circulation & fittings

```wdl
staircase [name "N"] at (start_x, start_y) step (rise, tread, width)
  direction north|south|east|west
  [total_height <h>] [max_run <r>] [landing_depth <d>]
  [landing_thickness <t>] [turn clockwise|anticlockwise] [flight_gap <g>]

kitchen [name "N"] path ((x,y), (x,y), …) side left|right
  depth <d> height <h> [base_z <z>]        // path points are literal numbers
```

**Staircases are TOP-anchored — this is the #1 mistake.** You put a staircase on the
**UPPER** floor and it **DESCENDS** to the floor below:

- `at (x,y)` is the **TOP** of the stair (where it meets the floor it's declared on).
- `direction` is the **descent** direction (the way it travels going *down*).
- `total_height` is the **drop** to the floor below (omit → the floor-below's height).
- `max_run` caps a flight's run; exceed it and the stair auto-splits into switchback
  flights with turn landings (`landing_depth`/`turn`/`flight_gap` tune the switchback).

So a stair connecting the ground floor **up** to the first floor lives on the **First
Floor**, descending to the ground:

```wdl
floor 2 "First Floor" height 116 {
  slab at (…) size (…)
  staircase name "Stair" at (212, 64) step (7, 11, 44)   // top = this floor, at the landing
    direction south total_height 116                     // descends south to the floor below
}
```

Put it on the *lower* floor (thinking of it as "climbing up") and it descends the wrong way
— **below ground** — where it draws in 2D plans but is buried/invisible in 3D. `check.sh`
catches that (convention **C5**), but author it top-anchored from the start.

// three ways to name the GLB, in order of preference:
item [name "N"] f."sofa"                                  // 1. from an imported module (see Imports)
item [name "N"] "sofa"                                    // 2. a same-file / bare-imported `asset` id
item [name "N"] asset { id "sofa" src "…/sofa.glb" dims (w,h,d) [category "…"] }  // 3. inline one-off
  at (x,y) [rotation <deg>] [scale <s>]
  [anchor_to "RoomName" anchor center gap (gx,gy)]
```

Prefer the module form (`item f."bed_double"`) — `import "std-furniture" as f`
once and every piece is a short id, no URLs. The bare form (`item "sofa"`) needs
a matching top-level `asset "sofa" …` in the file (or a bare `import`). The inline
`asset { … }` block is only for a one-off GLB not in any pack. All three produce
the identical `{id,src,dims}` downstream. Furniture `dims` are the real-world size
in **metres** `(width, height, depth)`; `src` is a GLB URL (an unreachable GLB
shows a placeholder box, never a blank). `anchor` is one of `top-left top-center
top-right center-left center center-right bottom-left bottom-center bottom-right`.

**Orientation — this is how you point furniture the right way.** A piece's FRONT
(the side you sit at / the doors / the open side) faces a known compass direction
per its `rotation` (degrees):

| `rotation` | front faces |
|---|---|
| `0`   | **South** (the plot front / entrance side, +Y) |
| `90`  | East |
| `180` | North |
| `270` | West |

So a sofa against the NORTH wall (facing into the room, i.e. south) is `rotation
0`; against the SOUTH wall (facing north) it's `rotation 180`; against the WEST
wall (facing east) `rotation 90`. The floor plan (`wadi_preview plans`) draws a
small triangle on each piece's front edge so you can verify the way it points;
for a definitive 3D check use `wadi_capture_3d({ room: "…" })` (first-person from
inside the room).

## Imports & modules (reusable `.wdl` libraries)

A `.wdl` file can be a **module** — top-level declarations (no `house` needed) —
that another file `import`s. Two bundled ones: `std-furniture` (asset pack →
`item ns."id"`) and `konkan/base` (goal-tagged component pack → `use ns.Comp`;
Stairwell, Verandah, Otla, Bathroom, Kitchen, TulsiVrindavan, Parapet). The
`konkan_cottage` example (`wadi_examples`) assembles a whole house from both.

```wdl
house Home {
  import "std-furniture" as f       // aliased: refer to its assets as f."<id>"
  // import "std-furniture"          // bare: its ids drop into scope for item "<id>"
  floor 1 "G" slab_thickness 0 {
    room Bed at (20,20) size (160,200) { wall north east south west
      item f."bed_double" anchor center }
  }
}
```

A module file itself is just top-level `asset` (later: `component`) decls:

```wdl
// my-furniture.wdl — a house-less module (a reusable library)
asset "daybed" src "https://…/daybed.glb" dims (1.8, 0.4, 0.9) name "Daybed" category "Living"
```

Over MCP, `wadi_modules` lists importable modules and `wadi_module "<name>"`
shows a module's asset ids + dimensions (filter with a `query`). Import refs
resolve by name against the bundled `std-*` packs (a local `modules/` search
path and git refs come later).

## Objects — roof (one object; flat / shed / gable / hip)

The roof lives ALONE on its own top floor and you never set its Z (see
`roof-v2-guide.md`). `endpoint`: `closed` = hip triangle, `open` = gable end-wall.

```wdl
roof [name "N"] pitched|shed|flat
  [endpoint open|closed]
  [slope angle <deg> | slope height <ridge_h>]
  [overhang <o>] [slab_thickness <t>] [parapet <h> x <t>] [gable_wall_thickness <t>] {
    segment "id" from (x,y) to (x,y) width <w>
      [high_side left|right]                        // shed only
      [start_endpoint open|closed] [end_endpoint open|closed]
      [hip_setback (a,b)] [gable_overhang (a,b)] [hip_ridge_extension (a,b)]
      [overhang <o>]                                // uniform eave, all four sides
      [overhang_start <o>] [overhang_end <o>]       // per-side along the axis (shed;
                                                    //   on a gable end = gable_overhang)
      [overhang_low <o>] [overhang_high <o>]        // SHED eaves (down-slope / up-slope)
      [overhang_left <o>] [overhang_right <o>]      // PITCHED eaves (left / right of ridge)
      [tie_beams N]
    truss "segId" fink|mono_pitch at (pos, pos, …)
  }
```

Segment `from`/`to`/`width` and the `hip_setback`/… values accept formulas, so a
roof scales with the plot (e.g. `width House.W`, `hip_setback (Verandah.L, Padvi.L)`).

**Per-side overhang (cantilever one edge).** `overhang <o>` sets a uniform eave on
all four sides. Any sloping roof can override a side independently — each defaults to
`overhang`. **Along the axis:** `overhang_start` / `overhang_end` (on a shed, or a
gable open end — there they're the same as `gable_overhang`; a hip end is geometric,
tuned via `hip_setback`). **Eaves:** `overhang_low` / `overhang_high` on a **shed**
(down-slope / up-slope); `overhang_left` / `overhang_right` on a **pitched** roof
(the two eaves either side of the ridge). A bigger eave overhang also drops that
eave's edge along the same pitch, so the slope stays planar. (Per-eave on a *pitched*
roof is single-segment only — on a multi-segment roof the eaves share one height so
joints line up.)
Idiom: keep the roof FOOTPRINT (its supported edges) on the main room, then cantilever
one eave to cover an entry landing / stair — end the axis on the room wall and set a big
`overhang_end`:
```wdl
// footprint ends on the main room's east wall (x204 centreline → x208 outer);
// the east eave reaches 258, covering a landing that sticks out to x256.
segment "seg0" from (4,124) to (204,124) width 240 high_side right overhang 25 overhang_end 50
```

**Roof coordinates are wall centrelines (under `convention center`), same as
rooms.** `from`/`to` is the segment's ridge/axis and `width` its span *centred on
that axis*. Author them on the **same centreline grid as the walls** — a segment
whose axis + width match the rooms' centrelines auto-grows to the **outer wall
face** on every side (the compiler extends the axis by ½·wall_thickness at each end
and widens by wall_thickness, exactly the grow a room gets). `overhang` then
extends *beyond* the outer face. So to cover a footprint spanning wall centrelines
`x1..x2` (E–W) and `yA..yB` (N–S), write `from (x1, (yA+yB)/2) to (x2, (yA+yB)/2)
width (yB - yA)` — do **not** add ½-wall fudge factors; the convention handles it.
(Before this, a roof drawn on the grid sat half a wall-thickness *inside* the walls.)

## Components & layers

```wdl
component Bench {                 // a reusable mini-house in LOCAL coords (origin 0,0)
  param blen = 60 label "Bench length"
  beam name "Top" at (0,0) size (blen, 18) height 6
}
use Bench as "B1" at (x,y) with { blen = 80 }   // stamp it onto a floor

layer "structure" "Structure" [color "#rrggbb"] [group "Frame"]   // per-house layer registry
```

A component may carry a **`goal`** — a short description of what it accomplishes,
the discovery key for module lookup (`wadi_module` / a `wadi_modules` query):

```wdl
component Stairwell goal "climb to the next floor" {
  param rise = 116
  staircase name "Stair" at (0,0) step (7,11,44) direction south total_height rise
}
```

Components can also come from an **imported module** (see *Imports & modules*),
stamped with a namespaced `use ns.Comp`:

```wdl
house Home {
  import "konkan/base" as kb        // Stairwell, Verandah, Otla (goal-tagged)
  floor 1 "G" slab_thickness 0 {
    room Hall at (20,20) size (200,200) { wall north east south west }
    use kb.Stairwell at (60,60) with { rise = 116 }   // param args use `=`, not `:`
  }
}
```

`use ns.Comp` expands byte-identical to an inline `component`; keep module
components flat (they don't `use` other components). Un-overridden `param`s fall
back to their declared defaults.

## The `raw` escape (rarely needed)

Anything the first-class syntax doesn't cover can be written as literal JSON per
the `.wadi` schema (`data-model.md`):

```wdl
raw "type" { "field": 1, "formulas": { "field": "= expr" } }
```

## DSL-specific pitfalls

- **`convention center` and `units … per_unit 10`** belong at the top of every
  `house` — same as the JSON path. All the `coordinate-system.md` rules (Y-down,
  units, centreline abutment) apply identically; the DSL just writes them shorter.
- **Formulas are bare expressions**, not `"= …"` strings — the compiler emits the
  `= …` form for you. Write `at (main.x1, main.yA)`, not `at ("= main.x1", …)`.
- **`name "…"` is quoted; `room`/`pillar`/`var`/grid-line names are bare** ids
  (no spaces, and not a reserved word like `width`, `height`, `size`, `at`).
- **Roof alone on the top floor**; segment widths/positions come from the walls
  they sit on. See `roof-v2-guide.md`.
- **A pillar's `at` is its TOP-LEFT corner, not its centre.** To centre a column on
  `(cx,cy)`, author `at (cx - w/2, cy - l/2)`.
- **Free-standing walls don't auto-mitre at corners** — extend endpoints so the wall
  bodies overlap (≥ ½·`wall_thickness` past the shared point), or the corner is left
  as a gap.
- **Staircases are top-anchored** — put them on the UPPER floor; they descend to the
  floor below (`check.sh` C5 flags one that lands below ground). See the staircase note.
- **Structural conventions are enforced** — `check.sh` fails on floating floors
  (plinth-floor `height` ≠ plinth block height; a no-slab floor with nonzero
  `slab_thickness`) and warns on exterior room sides left open. See
  `conventions.md`; the DSL editor shows the same findings in its status pill.
- Compile after **every** edit; a parse error means the `.wadi` wasn't updated, so
  the live model just won't change — never silently wrong.
