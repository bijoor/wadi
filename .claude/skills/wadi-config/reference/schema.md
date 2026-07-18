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
  "floors":   [ … ]         // required, at least 1
}
```

- **`site`** (required, strict): `reference_x` (number), `reference_y` (number),
  `plot_length` (>0), `plot_width` (>0). The overall plot the house sits on.
- **`plinth`** (required, strict): `x`, `y` (numbers, top-left corner),
  `length` (>0), `width` (>0), `height` (>0). The raised base. **Length runs along
  X, width along Y.** The roof footprint should cover this rectangle.
- **`defaults`** (optional, strict): house-wide fallbacks —
  `floor_height` (>0), `wall_height` (>0), `slab_thickness` (≥0). Any floor
  without its own value uses these; if absent, built-in code defaults apply.
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
`thickness` (≥0, optional — defaults to the floor's `slab_thickness`).

### `room`
The main building block. A rectangle with four walls.
- `name` (required string), `x`, `y` (top-left corner), `width` (>0, along X),
  `length` (>0, along Y).
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
`material` (optional).

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
