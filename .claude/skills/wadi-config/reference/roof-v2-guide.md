# Roof v2 guide (the unified `roof` object)

The `roof` object replaces the legacy `hip_roof`/`gable_roof`/`flat_roof`/
`shed_roof`. It is **segment-based**. The schema is permissive; the real
validation happens in the compute pipeline, so **always run `validate.mjs`**
after writing a roof (it runs the exact derivation the app uses).

> **Strategy:** roof geometry is the subtlest part of the config. Don't
> hand-invent it — **copy the roof from the closest example** (see the shape map
> below), then adjust its segment coordinates/widths to your plinth, and validate.

## The core idea

A roof is a set of **segments**. Each segment is a line (`start`→`end`) with a
**`width`** measured *perpendicular* to it, and **the segment sits at the CENTRE
of that width** (the roof extends `width/2` to each side of the line). What the
line means depends on `roof_type`:

- **pitched** — the segment **is the ridge**; two symmetric slopes rise from the
  eaves up to it. Ends are covered per `default_endpoint`:
  - `"closed"` → **hip** (a sloped triangular hip face at the end).
  - `"open"` → **gable** (a vertical gable-end wall triangle).
- **shed** — the segment is the **high edge**; the roof slopes down perpendicular
  to the far side. `shed_high_side` names which side is high.
- **flat** — the segment's width band is a flat slab extruded down.

Segments can run in **any direction** (not just axis-aligned).

## Object shape

```jsonc
{
  "type": "roof",
  "roof_type": "pitched" | "shed" | "flat",
  "default_endpoint": "closed" | "open",   // pitched only: closed=hip, open=gable
  "min_overhang": 25,                       // > 0 — eave overhang beyond the walls
  "slope": { "by": "height", "ridge_h": 50 },   // rise above wall top …
  //  or   { "by": "angle",  "angle_deg": 30 },  // … or a pitch angle
  "segments": [
    {
      "id": "seg0",
      "start": [x, y], "end": [x, y],       // the ridge (pitched) / high edge (shed)
      "width": 200,                          // perpendicular span, segment centred in it
      "slope": { … },                        // optional per-segment slope override
      "shed_high_side": "…",                 // shed only
      "hip_setback_start": …, "hip_setback_end": …  // optional, tune closed hip faces
    }
  ],
  "trusses": [
    { "segment_id": "seg0", "type": "fink", "positions_along": [100, 210, 320] }
    //  type: "fink" (pitched)  |  "mono_pitch" (shed)
    //  positions_along: distances along the segment where a truss sits
  ],
  "framing": { … }   // optional overrides — omit unless asked
}
```

`slope` may be given once at the roof level (applies to all segments) or per
segment. `by: "height"` → `ridge_h` is the ridge rise above the wall top; `by:
"angle"` → `angle_deg` is the pitch.

## Joints (multi-segment shapes)

When two segments share an **exactly coincident endpoint**, the pipeline
auto-resolves that end as a **joint** (no hip/gable face there) — this is how L,
U, and closed-loop (courtyard) roofs are formed. Get the endpoints numerically
equal or they won't join.

## Shape → which example to copy

| Want | Segments | Copy from |
|---|---|---|
| Simple hip (one ridge, hipped ends) | 1, `pitched`, `closed` | `two_story_konkan.json` / `verandah_cottage.json` |
| Simple gable (one ridge, gable ends) | 1, `pitched`, `open` | same, set `default_endpoint: "open"` |
| **L-shape** (two wings) | 2, `pitched`, coincident inner endpoints | `l_shape_villa.json` |
| **Courtyard** (ridge loop) | 4, `pitched`, endpoints chained in a loop | `courtyard_home.json` |
| **Flat** roof/terrace | 1+, `flat` | `modern_flat.json` |
| Shed / mono-pitch (lean-to, verandah) | 1, `shed`, `shed_high_side` set | derive from a `pitched` seg; add `shed_high_side` + slope |

## Rules & pitfalls

- The roof **footprint must cover the plinth footprint** — segment lines +
  widths should span the walls they sit on. Mirror the example's relationship to
  its plinth.
- `min_overhang` must be **> 0**.
- Every segment needs an `id`; every truss references a real `segment_id`.
- Shed segments **require** a slope (`ridge_h` or `angle_deg`) and a
  `shed_high_side`, or derivation throws.
- After any roof edit: run `validate.mjs` — a zero-length segment, missing slope,
  or non-covering footprint fails there, not in the schema.
