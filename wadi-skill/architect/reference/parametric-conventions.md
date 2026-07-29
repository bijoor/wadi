# Parametric model conventions (reusable house templates)

How to author a **fully-parametric** `.wadi` — a template that stays valid under *any*
knob change (resize the plot, widen a room, add a floor) instead of a one-off with
baked-in numbers. Use it when building a **template** for the library / picker; skip it
for a quick fixed sketch.

The canonical worked example is **`examples/coastal_konkan.wadi`** — read it alongside
this. The engine: `variables` → `grids` → per-object `formulas`, resolved
topologically by `editor/src/param/resolve.ts`. Formula ops: `+ - * /`, `min`, `max`,
`clamp`, `round`, `floor`, `ceil`, `abs` (no `eval`, no comparisons/ternary).

## 0. The one big idea: the GRID is the parametric layer

A **grid** is a set of named wall-**centreline** lines — X (west→east: `1,2,3…`) and Y
(north→south: `A,B,C…`). Each line's position (`at`) is a formula of the house size and
your knobs. **Rooms don't compute their own geometry — they name grid lines.** Move a
line (or the knob its `at` depends on) and every room, slab and column on it follows.

```
House size + knobs  ──▶  grid line `at` formulas  ──▶  rooms/pillars reference lines
        (variables)            (the grids block)              (= main.x1, …)
```

This one-directional flow is the whole recipe. There is **no** room-corner point layer
and **no** per-room wall math (both existed in the old convention — don't use them).

## 1. Set the centreline convention

At the top of the house set:

```jsonc
"coord_convention": "center"
```

Then a rect object's `x, y, width, length` are wall **centrelines**, and **two rooms
that share a wall just ABUT on the shared line** — room A spans X `[x1,x4]`, room B
spans `[x4,x8]`, the wall is centred on `x4` and shared. No overlap, no `wallT` math;
the renderer grows each footprint to the outer face automatically. See
`coordinate-system.md` → "the centreline convention".

## 2. Variables — the knobs

- **Base dims:** `wallT` (wall thickness), `floorH`, `slabH`, plus derived helpers
  (`wallH = "=floorH-slabH"`).
- **Column sizes + inset:** `pillarW` (and `pillarL` if rectangular), and
  **`pilInset = "= (pillarW - wallT) / 2"`** — the amount a perimeter column must move
  inward to sit flush with the facade (see §5).
- **Opening sizes:** `doorW/doorH`, `winW/winH/winSill`, `entranceW`, `doorMargin` — never
  inline literals.
- **Room-proportion knobs:** `pct<Room><W/L>` + `min<Room><W/L>` (see §3).

Variables may reference only other variables (they resolve before the grid).

## 3. The grid — named lines as formulas

Define `grids.main` with X and Y lines. The **outer** lines anchor to the plinth edge;
**interior** lines carry the room-proportion logic:

```jsonc
"grids": { "main": {
  "x": [
    { "name": "1", "at": "= wallT / 2" },                                   // left outer face at 0
    { "name": "2", "at": "= max(minBedW, round(pctBedW * House.W)) + 3*wallT/2" },
    { "name": "8", "at": "= House.W - wallT / 2" }                          // right outer face at House.W
  ],
  "y": [ { "name": "A", "at": "= wallT / 2" }, { "name": "F", "at": "= House.L - wallT / 2" } ]
} }
```

- **Outer lines:** `1`/`A` at `wallT/2`, the last at `House.dim − wallT/2`. A wall
  centred on `wallT/2` has its outer face at `0`; on `House.W − wallT/2`, at `House.W`.
  So the building fills the plot exactly.
- **Interior lines — where pct/min lives.** Either a fixed **fraction** of the span
  (`round(wallT/2 + frac*(House.W - wallT))`, pure proportional — the coastal style) or
  a **`max(min, pct*House.dim)`** offset (keeps a room from getting unusably small on a
  tight plot — the cottage/family style). Because a room's clear interior is
  `(line-to-line) − wallT`, add `+ 3*wallT/2` to a `max(min, pct*…)` size so the KNOB
  equals the clear interior.
- Each grid line is published as a formula **symbol** `main.x<name>` / `main.y<name>`
  (`main.x1`, `main.yA`). Positions are conserved automatically — the lines partition
  the span, so there are no gaps/overlaps to reconcile.

## 4. Rooms, slabs, plinth — reference the grid, nothing else

```jsonc
{ "type":"room", "name":"Hall",
  "formulas": { "x":"= main.x1", "y":"= main.yA",
                "width":"= main.x4 - main.x1", "length":"= main.yC - main.yA" } }
```

- `x`/`y` = the room's top-left grid node; `width`/`length` = the span to another node.
- Adjacent rooms use the **same** line for their shared edge (room A `…x4`, room B
  `x:"= main.x4"`) → they abut and share one wall.
- The floor slab / plinth span the outermost lines (`main.x1 → main.x8`,
  `main.yA → main.yF`).
- **Keep valid placeholder literals** on `x/y/width/length` (positive numbers) — the
  strict schema checks stored literals *before* resolve. The resolver overwrites them.

## 5. Pillars — centre on a node, inset at the perimeter

In `center` mode a pillar's `(x,y)` is its **centre**, so it drops onto a grid node:

```jsonc
{ "type":"pillar", "name":"P_mid",
  "formulas": { "x":"= main.x3", "y":"= main.yF", "width":"= pillarW", "length":"= pillarW" } }
```

- **Interior columns** sit exactly on their node — reference the line directly.
- **Perimeter columns** are wider than the wall, so centred on an outer line they'd jut
  past the plinth. Move them inward by `pilInset` **in the formula** (self-describing —
  never rely on a renderer clamp):
  - on the **min** line (`x1`, `yA`): `"= (main.x1) + pilInset"`
  - on the **max** line (`x8`, `yF`): `"= (main.x8) - pilInset"`
  - a corner column does both; a front-row column that's interior in X only insets in Y.
- Because `pilInset = (pillarW − wallT)/2` is a formula, columns stay flush when you
  resize the plot, the wall, or the column.
- **Colonnade columns** between nodes: place by a named point / midpoint formula
  (`"= (main.x1 + main.x2)/2"`); still inset the axis that sits on an outer line.

## 6. Openings

- Opening sizes are **variables**; every opening is **positioned by formula** from its
  room's line span.
- **Windows / wide entrances are CENTRED:** offset `= ((span) − w)/2`.
- **Internal doors tuck into a corner** (`doorMargin` from one end) to keep a
  continuous wall run for furniture.
- **A shared wall is declared once** — the room with the door declares that side's
  opening; the neighbour omits the side (the coincident wall is already there).
- **Validate every opening:** `0 ≤ offset && offset + width ≤ wallSpan`, or
  `expandRoomWalls` throws.

## 7. Konkan layout conventions

- **Central hall (Majghar) is the circulation hub** — rooms open into it, not into each
  other. Preserves privacy and frees wall runs.
- **Consolidate wet services** — kitchen + bathroom share a wall so plumbing runs
  together.
- **Front verandah** (full-width, pillared) + **rear Padvi** (rear verandah).
- Give fixed rooms a comfortable **minimum** (a 6'×6' bathroom reads cramped; ~7'×7' is
  better) — raise the `min`, not just the `pct`.

## 8. Build & verify — the loop

1. **Author** the grid + formulas with valid placeholder literals.
2. **Validate:** `cd editor && npx tsx ../wadi-skill/architect/scripts/validate.mjs <ABS_PATH>`
   — resolves, schema-checks, and runs the wall/roof pipeline. Exit 0 = good.
3. **Render + read:** `wadi-skill/architect/scripts/preview.sh <ABS_PATH>` → look at the
   plans (rooms in place, columns flush, roof over the plinth).
4. **Scale sweep — the whole point.** Resolve + render at a **small**, a **large**, and
   an **off-aspect** plot (change `House.W`/`House.L` or the plot). Confirm: no negative
   rooms, rooms fill the plot exactly, every opening fits, **no column juts past the
   plinth**, no pillar/door overlap. A change that only works at the default size isn't
   done.
5. In the app: the **Geometry-issues panel says "No geometry issues"**, and the live 3D
   model updates on save.

See also `coordinate-system.md` (Y is DOWN, 10 units = 1 ft, the centreline rule),
`data-model.md` (every field), and `examples/coastal_konkan.wadi` (the reference).
