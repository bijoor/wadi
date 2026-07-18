# House configuration rules

Rules for authoring `house_config.json` files by hand or from templates.
Follow these to get houses that render cleanly, have the right structural
layout, and don't hit the pipeline's validators.

## 1. Units

- All numeric dimensions are in **project units**.
- Conversion: **10 units = 1 ft = 12 inches**.
- Inch-based specs (member sizes, on-centre spacing) stay in inches —
  they're built to industry convention (`2×4`, `24″ o.c.`).

## 2. Coordinate system

- Origin is at the top-left (Inkscape convention).
- `+X` runs east, `+Y` runs south.
- Plot occupies `x ∈ [0, plot_width]`, `y ∈ [0, plot_length]`.
- 3D scene flips Y so `-Z = north`. A compass rose sits at the NW corner
  outside the plot in the viewer.

## 3. Wall thickness and shared walls

- Default `wall_thickness = 8` units (0.8 ft, ≈ 9.6 inches).
- **Adjacent rooms MUST overlap by `wall_thickness` at their shared
  edge.** If they only touch (no overlap), each room draws its own wall
  at the seam and you get **double-thickness walls**.
- Convention: each room's `width` × `length` is its **outer envelope**
  (walls included). Shared walls sit in the overlap zone.

### Overlap pattern

Two rooms side by side along X, sharing an east-west wall:

```
Room A: x=0,     width=200, length=200      →  occupies x=0..200
Room B: x=192,   width=108, length=200      →  occupies x=192..300
                            └── overlap 192..200 = the shared wall
```

`Room B.x = Room A.x + Room A.width - wall_thickness`.

For rooms sharing a north-south wall (stacked in Y), apply the same
pattern on `y` / `length`.

### Plot fit

Because rooms overlap on shared edges, laying out a grid uses less
space than the sum of room widths. For a plot 300 wide with two rooms
side by side (200 + 108, overlap 8), the total footprint is `200 + 108
- 8 = 300`. Check that your outermost rooms' edges land at the plot
boundary (0 and `plot_width` / `plot_length`).

## 4. Rooms

Required fields:

- `type: "room"`
- `name`: unique per floor. Referenced by dimensions labels and the tree.
- `x`, `y`: NW corner of the room's outer envelope (project units).
- `width`, `length`: outer dimensions.
- `walls` (recommended): the nested-dict form. Omitting `walls`
  entirely means "all four walls on with no openings" — you'll want
  to list walls to add openings.

Optional:

- `height`: override the floor's wall height for this room. Leave
  blank / omit for the default (from floor or global).
- `material`: palette key from `GLOBAL_CONFIG.colors` — controls the
  room's floor colour in 2D / 3D. Use `"verandah"` for verandahs.

### Wall semantics

- `walls` is a `Record<"north" | "south" | "east" | "west", …>` dict.
- **Omitting a side altogether = "no wall on that side"** (open porch,
  courtyard opening, etc.).
- **Listing a side with `{}` = "wall exists, no openings"**.
- **Listing with `{ openings: [...] }` = wall with door / window
  cutouts**.
- `walls: undefined` (whole key absent) is treated as "all four walls
  on" — the form fills the dict with all four sides for editing.

### Openings

Each opening is `{ kind: "door" | "window", name?, offset, width, height, sill_height? }`.

- `offset` is distance along the wall from its west/north corner
  (project units).
- `offset + width` must be `<= wall_length`.
- **Openings on the SAME wall must not overlap.** The form's
  `+ Door` / `+ Window` buttons auto-pick a non-overlapping offset;
  manual edits need to keep this true or the compute throws.

### Every room must have

- **At least one entrance** (a door on some wall). For interior rooms
  the door goes on the wall shared with the room you enter from —
  since walls between two rooms are shared, the door belongs to
  whichever room you consider the "outside" of.
- **A window on every outside-facing wall** (an outward wall = a wall
  that isn't shared with another interior room). This ensures each
  room has natural light + ventilation.
- Small rooms (bathroom, store) can use a smaller window (`30×40`)
  higher up (`sill_height: 40`).

### Typical opening sizes (project units)

| Purpose               | width | height | sill_height |
|-----------------------|-------|--------|-------------|
| Main entrance door    | 40    | 80     | —           |
| Interior door         | 30    | 80     | —           |
| Bathroom door         | 25    | 80     | —           |
| Living/bedroom window | 50    | 50     | 30          |
| Bathroom window       | 30    | 40     | 40          |
| Kitchen window        | 50    | 40     | 40          |

## 5. Floors

Required fields per floor:

- `floor_number`: 0 = ground, 1 = first, 2 = loft, etc.
- `name`
- `objects`: array of floor_slab, rooms, walls, pillars, staircase,
  doors/windows (flat), and roofs.

Optional:

- `height`: this floor's wall height in project units. Blank = falls
  back to `defaults.floor_height` on the config, then to the global
  code default (100 units = 10 ft).
- `slab_thickness`: the horizontal slab between this floor and the
  one below.

### House-level defaults

Add `defaults: { floor_height, slab_thickness }` at the top level to
override global defaults for the whole house. Each floor's own
`height` / `slab_thickness` still wins over house defaults.

## 6. Verandah pattern

A verandah is an open porch with pillars, typically along the front
of the house.

```json
{ "type": "room", "name": "Verandah",
  "x": 0, "y": 0, "width": 300, "length": 100,
  "material": "verandah",
  "walls": {
    "south": { "openings": [ { "kind": "door", "name": "Main_Entry", "offset": 130, "width": 40, "height": 80 } ] },
    "east": {},
    "west": {}
    // no "north" key = open front
  }
}
```

Add pillars along the open front:

```json
{ "type": "pillar", "name": "V_Pillar_NW", "x": 5, "y": 5,
  "width": 10, "length": 10, "height": 100 }
```

Verandahs commonly have 3–4 pillars evenly spaced.

## 7. Roofs

Four types, all Phase 1 complete: `hip_roof`, `gable_roof`,
`flat_roof`, `shed_roof`. All accept **`x, y, width, length`** in
project units so multiple roofs can be placed on the same floor
(Phase 2). Roofs live on their own **loft floor** above all living
floors so `wall_top_z` computes correctly.

### hip_roof required fields

```json
{ "type": "hip_roof",
  "x": 0, "y": 0, "width": 300, "length": 400,
  "ridge_axis": "y",
  "ridge_h": 70,             // or min_pitch_deg
  "min_overhang": 25,
  "trusses": {
    "type": "fink",
    "positions": [80, 200, 320]   // strictly increasing, >0 and < length
  }
}
```

- `ridge_axis` = "y" only currently supported.
- `trusses.positions` are Y offsets from the roof's NW corner (not
  the plot origin).

### gable_roof required fields

```json
{ "type": "gable_roof",
  "x": 0, "y": 0, "width": 300, "length": 400,
  "ridge_axis": "y",
  "ridge_h": 70,             // or min_pitch_deg
  "min_overhang": 25,
  "gable_overhang": 10       // optional overhang past the gable ends
}
```

Trusses on gables are OPTIONAL. Add them for spans > 4 m.

### flat_roof required fields

```json
{ "type": "flat_roof",
  "x": 0, "y": 0, "width": 300, "length": 400,
  "slab_thickness": 6,
  "overhang": 5,
  "parapet_height": 30,      // 0 = no parapet
  "parapet_thickness": 8
}
```

### shed_roof required fields

```json
{ "type": "shed_roof",
  "x": 0, "y": 0, "width": 300, "length": 400,
  "slope_dir": "south",      // where the water runs to
  "rise": 30,                // or min_pitch_deg
  "min_overhang": 20
}
```

### Frame overrides (any roof type)

```json
"framing": {
  "rafter_size_in": [2, 4],
  "rafter_spacing_in": 36,
  "purlin_size_in": [2, 1],
  "purlin_spacing_in": 12,
  "ridge_size_in": [6, 3],
  "ring_beam": { "size_in": [4, 2] }
}
```

Blank fields fall back to `GLOBAL_CONFIG.roof_framing` defaults.

### Tile density (hip only)

```json
"tile_density": {
  "mangalore_per_sft": 1.33,
  "ceiling_per_sft": 1.5,
  "waste_pct": 0.10
}
```

## 8. Staircase

```json
{ "type": "staircase",
  "start_x": 120, "start_y": 290,
  "num_steps": 12,
  "step_rise": 6, "step_tread": 10, "step_width": 40,
  "direction": "north"
}
```

Staircase footprint = `step_width × (num_steps × step_tread)`. Place
it inside a room (e.g. a Landing) so it doesn't overlap wall runs.

## 9. Multi-floor houses

- Floor 0 = ground. Contains rooms + slab + optional staircase.
- Floor N = upper floor. Contains rooms + slab.
- Floor N+1 = "Loft Floor" with just the roof (no rooms).

Roof compute assumes `wall_top_z` accumulates through all lower floors.
If you put the roof on floor 0 directly (no loft) the roof will sit
just above the plinth — usually wrong. Always add a loft floor for
the roof.

## 10. Common patterns

### Single-story cottage

Ground floor with rooms + Loft floor with hip/gable roof. See
`verandah_cottage.json`.

### Two-story home

Ground + First floors with rooms + Loft floor with roof. See
`two_story_wadi.json`.

### Courtyard home

Multiple rooms forming a U or C shape around an open courtyard. Each
wing gets its own roof (`x, y, width, length` positions each roof
over its wing). See `courtyard_home.json`.

### L-shaped villa

Main house + one wing at a right angle. Mixed roof types work well:
hip over the main, shed over the wing. See `l_shape_villa.json`.

### Modern flat-roof home

Rectangular footprint with `flat_roof` + parapet. Can add a `shed_roof`
over a covered porch for visual interest. See `modern_flat.json`.

## 11. Testing checklist

Before committing a new template, verify:

- [ ] All room dimensions fit within `plot_width` × `plot_length`.
- [ ] Adjacent rooms overlap by `wall_thickness` at shared walls.
- [ ] Every room has at least one door.
- [ ] Every outside-facing wall has at least one window.
- [ ] No openings overlap on the same wall.
- [ ] Roof `x + width <= plot_width` and `y + length <= plot_length`
      (or overhang extends past the plot — acceptable but note it).
- [ ] For hip roofs, `trusses.positions[0] > 0` and
      `positions[-1] < length`.
- [ ] Roof sits on a "Loft Floor" (dedicated floor above living floors).
- [ ] Loading the config in the editor renders without errors in the
      🐞 debug badge.
