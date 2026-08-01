# The Wadi DSL (`.wdl`) — authoring reference

You author houses in the **Wadi DSL** — a small, formal language (`.wdl`) that
compiles to a resolved `.wadi` (`house_config.json`). The DSL is **complete**:
every object type in the model has first-class syntax, so you rarely need the
`raw` escape. Authoring the DSL is more direct and less error-prone than writing
JSON — the grammar enforces structure, and `compile.sh` reports parse errors with
line:col.

**This file is the SYNTAX reference.** The *semantics* live in the other
references and apply unchanged — read them:

- `coordinate-system.md` — X→right, **Y→DOWN**, Z→up; **10 units = 1 ft**;
  the **centreline** convention. The #1 source of mistakes.
- `parametric-conventions.md` — the grid-first recipe for reusable templates.
- `roof-v2-guide.md` — roof segments, hip vs gable, trusses, joints.
- `data-model.md` — the underlying `.wadi` schema (what the DSL compiles to; also
  the field reference for the `raw` escape).

## The loop

1. Write / edit `house.wdl`.
2. `wadi-skill/architect/scripts/compile.sh house.wdl house.wadi` — parses,
   resolves formulas, and validates (schema + wall/roof geometry). Fix any
   reported error and re-run.
3. The **`.wdl` is the source of truth**; `house.wadi` is the compiled artifact
   the app watches/renders. Do NOT hand-edit the `.wadi` or rely on app form-edits
   — they are overwritten on the next compile. You own the `.wdl`.
4. `preview.sh house.wadi` → read the PNGs to check your work.

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

`at (x,y)` is the top-left corner; `size (w,l)` is width × length. All accept the
common tail.

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

## Objects — circulation & fittings

```wdl
staircase [name "N"] at (start_x, start_y) step (rise, tread, width)
  direction north|south|east|west
  [total_height <h>] [max_run <r>] [landing_depth <d>]
  [landing_thickness <t>] [turn clockwise|anticlockwise] [flight_gap <g>]

kitchen [name "N"] path ((x,y), (x,y), …) side left|right
  depth <d> height <h> [base_z <z>]        // path points are literal numbers

item [name "N"] asset { id "sofa" src "furniture/sofa.glb" dims (w,h,d) [category "…"] }
  at (x,y) [rotation <deg>] [scale <s>]
  [anchor_to "RoomName" anchor center gap (gx,gy)]
```

Furniture `dims` are the real-world size in **metres** `(width, height, depth)`;
`src` is a GLB URL (bundled ids resolve at `furniture/<id>.glb` — e.g. `sofa`,
`bed_double`, `dining_table`; an unreachable GLB shows a placeholder box, never a
blank). `anchor` is one of `top-left top-center top-right center-left center
center-right bottom-left bottom-center bottom-right`.

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
      [overhang <o>] [tie_beams N]
    truss "segId" fink|mono_pitch at (pos, pos, …)
  }
```

Segment `from`/`to`/`width` and the `hip_setback`/… values accept formulas, so a
roof scales with the plot (e.g. `width House.W`, `hip_setback (Verandah.L, Padvi.L)`).

## Components & layers

```wdl
component Bench {                 // a reusable mini-house in LOCAL coords (origin 0,0)
  param blen = 60 label "Bench length"
  beam name "Top" at (0,0) size (blen, 18) height 6
}
use Bench as "B1" at (x,y) with { blen = 80 }   // stamp it onto a floor

layer "structure" "Structure" [color "#rrggbb"] [group "Frame"]   // per-house layer registry
```

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
- Compile after **every** edit; a parse error means the `.wadi` wasn't updated, so
  the live model just won't change — never silently wrong.
