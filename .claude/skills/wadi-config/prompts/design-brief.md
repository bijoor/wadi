# Brief → house (Wadi's higher-level language)

This is how you turn a plain-English brief into a base `house_config.json`, and
keep it maintainable. **You are the compiler**: the brief is the high-level
intent, the config is the derived low-level artifact. Keeping the brief means the
user can change *requirements* ("add an ensuite", "make it L-shaped") and you
**re-derive** the affected objects — instead of the user hand-editing every
dependent coordinate.

## 1. Keep a design brief as the source of truth

Maintain a short brief alongside the config. Simplest: a file
`house_brief.md` next to `house_config.json`, or (if the user prefers one file) a
concise summary you restate in chat and update each turn. Capture **intent, not
coordinates**:

```md
# Design brief
- Plot: 45 x 27 ft. Shape: L. Floors: 2. Target: ~1500 sq ft.
- Ground: living+dining+kitchen open-plan (S/E), 1 bedroom w/ ensuite (NW),
  common bath, staircase (center), verandah (S).
- First: 2 bedrooms (both ensuite), balcony (S).
- Constraints: baths stacked vertically (plumbing); bedrooms get cross-ventilation.
- Roof: hip, ~5:12.
```

Update the brief whenever requirements change, then re-derive the config from it.

## 2. Interview to fill the brief (ask, don't assume)

Walk the user through, confirming as you go:

1. **Site** — plot dimensions (→ `site`, `plinth`). Orientation / where is north?
2. **Shape** — square / rectangular / L / U / courtyard. (Drives room layout and
   the roof segment topology.)
3. **Floor-space budget** — a rough built-up area cap (drives cost). Track running
   total as you place rooms.
4. **Floors** — how many; what goes on each.
5. **Rooms** — count and **types**. Each type has typical sizes/adjacencies (below).
6. **Relationships** — bedrooms with attached vs shared baths; living/dining/
   kitchen combined vs separate; verandah/balcony; staircase placement.
7. **Cross-floor constraints** — bathrooms/wet areas **aligned vertically** for
   plumbing; staircase footprint consistent between floors.
8. **Roof** — hip / gable / flat / shed; pitch. (Then follow `roof-v2-guide.md`.)

Only ask what you need; infer sensible defaults from the type table and state them
("I'll make the common bath 5×8 ft — say if you want it bigger").

## 3. Typical room sizes (starting points, project units = ft × 10)

| Room | Typical (ft) | Config (units) | Notes |
|---|---|---|---|
| Master bedroom | 12×14 | 120×140 | Often with ensuite |
| Bedroom | 10×12 | 100×120 | |
| Bathroom | 5×8 | 50×80 | Stack vertically across floors |
| Kitchen | 8×10 | 80×100 | Often + `kitchen_platform` |
| Living | 14×16 | 140×160 | May merge with dining |
| Dining | 10×12 | 100×120 | |
| Verandah / balcony | depth 6–8 | 60–80 deep | Along one side |
| Staircase footprint | ~4×10 | 40×100 | Keep aligned between floors |

These are defaults to confirm, not rules.

## 4. Derive the base config

Translate the brief into objects, in this order, respecting the schema
(`reference/schema.md`) and the **Y-down / ×10** frame
(`reference/coordinate-system.md`):

1. `site` + `plinth` from the plot.
2. Per floor: a `floor_slab` covering the footprint.
3. Lay out `room`s so they **tile without overlap** and stay inside the plinth.
   Compute each room's `x,y` from its neighbours (you are enforcing the positional
   relationships by hand — that's the point of keeping the brief: on a later
   change you recompute them).
4. Doors/windows as `openings` inside `room.walls.<side>`.
5. Staircase, pillars, kitchen platform as needed.
6. Roof — see `roof-v2-guide.md`; footprint must cover the plinth.
7. **Validate** (`scripts/validate.mjs`). Fix errors. Save.

## 5. Consistency rules to enforce while deriving

- Rooms don't overlap and fit within the plinth; sum of areas ≈ the floor budget.
- **Wet areas align vertically** across floors (same X/Y footprint) for plumbing.
- Staircase occupies the same footprint on each floor it serves.
- Roof segments/widths cover the outer walls (footprint = plinth).
- Openings sit within their wall's length (`offset + width ≤ wall length`).

## 6. On change, re-derive from the brief

When the user changes a requirement:
1. Update the **brief** first.
2. Re-derive only the affected objects, recomputing dependents (neighbouring room
   positions, aligned baths, roof footprint) so the model stays consistent.
3. Keep unchanged objects verbatim (minimal patch — see `update-existing.md`).
4. Validate, save, let the live model confirm.

This "edit the brief, re-derive the config" loop is what replaces a formula
engine: the *intent* is preserved and re-computable, so dependents follow
automatically.
