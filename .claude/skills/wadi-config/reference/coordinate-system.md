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
- Does the plinth rectangle (`length`×`width`) contain all my rooms?
- Does the roof footprint cover the plinth?
