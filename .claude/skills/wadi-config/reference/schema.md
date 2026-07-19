# `house_config.json` schema

Derived from `editor/src/schema/houseConfig.ts` (Zod, the runtime source of
truth). The schema is **`.strict()`** — unknown/misspelled keys are **rejected**.
All dimensions are in **project units (10 units = 1 ft)** unless noted. All
coordinates use the **X-right / Y-down** frame (see `coordinate-system.md`).

## Top level

```jsonc
{
  "site":     { … },        // required
  "plinth":   { … },        // required
  "defaults": { … },        // optional — house-wide height defaults
  "units":    { … },        // optional — how dimensions are LABELLED (display-only)
  "layers":   [ … ],        // optional — configurable 3D visibility layers
  "floors":   [ … ]         // required, at least 1
}
```

- **`site`** (required, strict): `reference_x` (number), `reference_y` (number),
  `plot_length` (>0), `plot_width` (>0). The overall plot the house sits on.
- **`plinth`** (required, strict): `x`, `y` (numbers, top-left corner),
  `length` (>0), `width` (>0), `height` (>0). The raised base. **Length runs along
  X, width along Y.** The roof footprint should cover this rectangle.
- **`defaults`** (optional, strict): house-wide fallbacks —
  `floor_height` (>0), `wall_height` (>0), `slab_thickness` (≥0),
  `wall_thickness` (>0). Any floor without its own value uses the first three; if
  absent, built-in code defaults apply. **`wall_thickness` sets the house-wide wall
  thickness** (project units; default 8 = 0.8 ft) — a per-object
  `wall_thickness`/`thickness` still overrides it.
- **`units`** (optional, strict): controls **only how dimension text is labelled** on
  the plans/elevations/sections — geometry always stays in project units, so this
  never moves anything. Fields (all optional):
  - `system` — one of `"feet_inches"` (default; renders `12' 6"`), `"feet"`,
    `"meters"`, `"centimeters"`, `"millimeters"` (the last four render a decimal +
    suffix, e.g. `3.81 m`).
  - `per_unit` — project units that equal **one** display unit. Default `10`
    (10 units = 1 ft). For metric authored at 10-units-per-foot, use `100` for
    meters (≈100 units = 1 m is only right if you author in metric; pick the value
    that matches how you laid out coordinates).
  - `precision` — decimal places for the decimal systems (default `2`; ignored by
    `feet_inches`).
  Omit the whole block to keep the historical feet-&-inches labels.
- **`layers`** (optional): the toggle-able visibility groups in the 3D view's
  layers menu. Each is `{ id, label, color? }` (`id` required + unique; `color`
  is a CSS hex like `"#e88968"`). Any object can opt into a layer via its own
  optional **`layer`** field (set to a layer `id`). Objects **without** a `layer`
  fall back to an automatic per-type/floor mapping, so existing houses need no
  changes. Display-only — never affects geometry. Omit `layers` entirely to use
  the built-in default set (roof shell, walls, slabs, pillars, plinth, …).
- **`floors`** (required): array, **min 1**.

## Floor

```jsonc
{
  "floor_number": 0,          // int ≥ 0, 0-based (ground = 0), must stack in order
  "name": "Ground Floor",     // required string
  "height": 98,               // optional >0  — floor-to-floor rise (drives roof Z-stack)
  "wall_height": 90,          // optional >0  — standing wall height
  "slab_thickness": 8,        // optional ≥0  — RCC deck to the floor above
  "objects": [ … ]            // required array of objects (below)
}
```

`height`, `wall_height`, `slab_thickness` are **three INDEPENDENT fields** — no
relationship is enforced. Each falls back to `defaults` then code defaults.

## Objects (discriminated on `type`)

Every object has a `"type"`. Valid types: `floor_slab`, `pillar`, `beam`, `room`,
`wall`, `staircase`, `door`, `window`, `kitchen_platform`, `roof` (+ legacy
`hip_roof`/`gable_roof`/`flat_roof`/`shed_roof`). Prefer `room`+nested walls, and
the unified `roof`.

### `floor_slab`
The floor deck. `x`, `y` (top-left), `width` (>0, along X), `length` (>0, along Y),
`thickness` (≥0, optional — defaults to the floor's `slab_thickness`),
`z_offset` (optional, project units, default 0 — lifts the slab above the floor's
slab level; use it to place a **stair landing** at mid-height).

### `room`
The main building block. A rectangle with four walls.
- `name` (required string), `x`, `y` (top-left corner), `width` (>0, along X),
  `length` (>0, along Y).
- **Coordinates are the OUTSIDE face of the walls** (the outer footprint), not the
  centerline or the interior. The four walls are drawn INWARD from the rectangle
  edges by `wall_thickness` (default **8** units = 0.8 ft). So the interior/usable
  space = `(width − 2·wall_thickness) × (length − 2·wall_thickness)`, and two rooms
  sharing a partition should have their rectangles **abut** at that edge (each
  draws its own wall inward → a back-to-back partition).
  (NOTE: a standalone `wall` object below is different — its `start`/`end` are the
  wall **centerline**, not the outer face.)
- `height` (≥0, optional; 0 or absent = "use floor default"), `material` (optional).
- `walls` (optional): the **nested form** (canonical) is an object with any of
  `north`/`south`/`east`/`west`, each `{ height?, height_end?, openings?: [...] }`.
  (A legacy array-of-sides form also parses but don't emit it.)
- **Openings (doors/windows) go INSIDE `walls.<side>.openings`** — see Opening
  below. This is preferred over standalone `door`/`window` objects.

### Opening (inside `room.walls.<side>.openings[]` or `wall.openings[]`)
```jsonc
{ "kind": "door" | "window", "name": "?", "offset": ≥0, "width": >0, "height": >0,
  "sill_height": ?, "direction": "?side", "facing": "?side" }
```
`offset` = distance along the wall from its start corner to the opening's start.

### `wall`
A standalone (non-room-enclosing) wall segment.
- `name` (required), `start_x`, `start_y`, `end_x`, `end_y`, `height` (>0, optional),
  `height_end` (optional, for a sloping top), `material` (optional),
  `facing` (optional side), `openings` (optional array of Openings).

### `pillar`
`name` (required), `x`, `y`, `height` (>0). `width` and `length` are **both
optional** (a missing one is defaulted by the builder → square/round pillar).

### `beam`
`x`, `y`, `width` (>0, along X), `length` (>0, along Y), `height` (>0, optional —
vertical thickness, defaults to the floor's `slab_thickness`), `z_offset`
(optional — vertical lift above the floor slab, project units).

### `staircase`
`start_x`, `start_y`, `num_steps` (int >0), `step_rise` (>0), `step_tread` (>0),
`step_width` (>0), `direction` (required side: the way the stair climbs),
`z_offset` (optional, project units, default 0 — lifts the FIRST step above the
floor's walking surface), `material` (optional).

**Stairs with a landing** — compose from primitives: a first flight (`z_offset` 0),
a `floor_slab` **landing** at the turn, and a second flight, giving both the landing
slab and the second flight the **same** `z_offset = flight-1 num_steps × step_rise`.
With the landing slab the same thickness as the floor slab, its top lands exactly
where the second flight begins, so they meet cleanly. Turn `direction` between
flights for L/U-shaped stairs.

### `kitchen_platform`
A polyline countertop/cooking slab along the base of walls.
- `name` (optional), `path` (array of `[x, y]` points, **min 2**),
  `side` (`"left"` | `"right"` — which side of the path the platform extends to),
  `depth` (>0, perpendicular extent), `height` (>0, above floor slab top),
  `base_z` (optional Z override), `material` (optional).

### `roof`  (the unified v2 roof)
`{ "type": "roof", … }`. Schema is permissive (validated at compute time). Its
real structure — `roof_type`, `segments`, `slope`, `default_endpoint`,
`min_overhang`, `trusses`, `framing` — is documented in **`roof-v2-guide.md`**.
Read that before writing a roof. (Legacy `hip_roof`/`gable_roof`/`flat_roof`/
`shed_roof` still parse but prefer `roof`.)

## Minimal valid config

```json
{
  "site":   { "reference_x": 0, "reference_y": 0, "plot_length": 450, "plot_width": 270 },
  "plinth": { "x": 0, "y": 0, "length": 450, "width": 270, "height": 30 },
  "defaults": { "floor_height": 98, "wall_height": 90, "slab_thickness": 8 },
  "floors": [
    { "floor_number": 0, "name": "Ground Floor", "objects": [
      { "type": "floor_slab", "x": 0, "y": 0, "width": 450, "length": 270 }
    ] }
  ]
}
```

See `examples/blank.json` and the five furnished houses for complete, valid shapes.
