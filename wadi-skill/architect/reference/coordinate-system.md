# Coordinate system & units

This is the #1 source of mistakes. Read it before placing anything.

## Axes — Inkscape frame (Y is DOWN)

The config uses an **Inkscape-style 2D frame**, the same one the SVG floor plans
use directly:

```
   origin (0,0) ── X increases →  (east / right)
     │
     │  Y increases ↓  (south / DOWN)
     ▼
```

- **X** → right (east).
- **Y** → **DOWN** (south). This is NOT the math/Blender convention. A room "to
  the **north**" of another has a **smaller** Y. Moving something "up" on the plan
  = **decreasing** Y.
- **Z** → up (height), in the 3D model. Z isn't in the 2D placement fields; it's
  derived from `height`/floor stacking. `sill_height`, `z_offset`, `base_z`,
  `plinth.height`, wall `height` are vertical (Z) measures.

Every position field is the object's **top-left corner** in this frame:
`x`/`y` (rooms, slabs, beams, pillars), `start_x`/`start_y` + `end_x`/`end_y`
(walls, staircases), `path: [[x,y],…]` (kitchen platforms), roof segment
`start`/`end` (`[x, y]`).

Because Y points down:
- `plinth.length` runs along **X**; `plinth.width` runs along **Y**.
- A room's `width` runs along **X**; its `length` runs along **Y**.
- A north-up architect's sketch has its **Y flipped** when you transcribe it: the
  top of the drawing (north) maps to small Y, the bottom (south) to large Y.

## Units — 10 project units = 1 foot

All lengths/coordinates are **project units**. The display/dimension convention is
**`unit_conversion = 10` → 10 units = 1 ft**. So:

| The user says | Config value |
|---|---|
| 1 ft | 10 |
| 12 ft (a 12-foot room) | 120 |
| 45 ft (plot) | 450 |
| 6 in (0.5 ft) | 5 |

Always **multiply feet by 10**. `plot_length: 450` displays as `45'`.

> Aside you don't need for authoring: a separate Blender path uses
> `units_to_meters_ratio = 0.1` (1 unit = 0.1 m) for the 3D export, so the same
> `450` is treated as 45 m in Blender. The two constants serve different pipelines;
> for authoring the config, **only the 10-units-per-foot rule matters.**

### Changing how dimensions are *labelled*

The `10-units-per-foot` rule above is only the **default label**. The optional
top-level `units` block changes the drawing labels **without touching geometry** —
coordinates you write stay in project units either way:

```jsonc
"units": { "system": "meters", "per_unit": 100, "precision": 2 }
```

- `system` ∈ `feet_inches` (default), `feet`, `meters`, `centimeters`, `millimeters`.
- `per_unit` = project units per one display unit (the label divisor). Default `10`.
- `precision` = decimals for the decimal systems (default `2`; `feet_inches` ignores it).

So a 120-unit wall labels as `12'` by default, or `1.20 m` with the block above.
Never change coordinates to switch units — only add/edit this block.

### Label font sizes auto-scale (no config needed)

Dimension and room-label font sizes are **derived automatically** from the house's
physical span (larger of `plinth.length`/`plinth.width`), so text stays legible at
fit-to-view whether the house is tiny or huge. There is **no font-size field** to
set — don't try to add one. A house at the reference span (450 units ≈ 45 ft)
renders at the baseline sizes; larger/smaller houses scale proportionally (clamped
0.6×–6×).

## Rooms, walls, and sharing a wall between two rooms

A room's `x, y, width, length` is the **outer footprint** — the OUTSIDE face of its
walls. Each wall is drawn **inset inward** by `wall_thickness` (default 8), occupying
the band from the outer edge inward:

- north wall → `[y, y + t]`  · south wall → `[y + length − t, y + length]`
- west wall  → `[x, x + t]`  · east wall  → `[x + width − t,  x + width]`

(so the clear interior is `width − 2t` × `length − 2t`).

**Because walls are inset inward, two rooms that share a wall must OVERLAP by exactly
`wall_thickness` — never abut them.**

- **Abut (WRONG):** room A east face at 150, room B west face at 150 → A's east wall is
  `[142,150]` and B's west wall is `[150,158]`: **two walls back-to-back**, a 16-unit
  double wall. That is not how houses are built and it looks wrong in 3D.
- **Overlap (RIGHT):** room B west face at `150 − t = 142` → B's west wall is `[142,150]`,
  which **coincides** with A's east wall `[142,150]`: **one shared wall.**

Rule of thumb: *the neighbour's near face = this room's far face − `wall_thickness`.*
The two footprints overlap by `t` on the shared edge; the overlap band **is** the wall.

### Clean way to place a whole plan — a wall-centreline grid

Rather than juggle overlaps by hand, lay down **grid lines = wall centrelines** (both
X and Y), then give every room the outer rectangle bounded by its grid lines, **grown
by `t/2` on each side**:

```
room spanning grid lines [Gx0..Gx1] × [Gy0..Gy1]
  →  x = Gx0 − t/2,  width  = (Gx1 − Gx0) + t
     y = Gy0 − t/2,  length = (Gy1 − Gy0) + t
```

Every interior wall then sits centred on a shared grid line, so **adjacent rooms
automatically overlap by exactly `t`** (each grows `t/2` toward the shared line), and
exterior walls stick out `t/2` beyond the perimeter grid lines. The building outline
(and the `plinth`/`floor_slab`) = the perimeter grid lines ± `t/2`. This centreline
grid is also the basis for the parametric **grid-point** convention (see
`parametric-conventions.md`): name the grid lines as `points`, and rooms follow when the
grid flexes.

## Vertical (Z) fields recap

- `plinth.height` — how high the base sits above ground.
- floor `height` — floor-to-floor rise; floors stack on top of each other by these.
- floor `wall_height` — standing wall height on that floor.
- `slab_thickness` — RCC deck between a floor and the one above.
- opening `sill_height` — window sill height above its floor.
- `beam.z_offset`, `kitchen_platform.base_z` — vertical offsets.

## Sloping tops

A wall (or room wall side) with a sloping top sets both `height` (at the start)
and `height_end` (at the end). Full gable/hip geometry, though, comes from the
`roof` object, not from wall slopes — see `roof-v2-guide.md`.

## Quick self-check before saving

- Did I treat "north/up" as **smaller** Y?
- Are all my numbers in **project units** (feet × 10)?
- Do adjacent rooms **overlap by `wall_thickness`** on shared walls (not abut)?
- Does the plinth rectangle (`length`×`width`) contain all my rooms?
- Does the roof footprint cover the plinth?
