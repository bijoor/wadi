# Parametric model conventions (reusable house templates)

How to author a **fully-parametric** `.wadi` — a model that stays valid under *any*
knob change (resize the plot, widen a room, add a floor) instead of a one-off with
baked-in numbers. This is the recipe behind the atale house and
`library/single_story_cottage.wadi` (worked generator:
`library/build_cottage.mjs` + `library/resolve.mts`). Use it when building a
**template** for the library / picker; skip it for a quick fixed sketch.

The engine: `variables` → `points` → per-object `formulas`, resolved topologically
by `editor/src/param/resolve.ts`. Formula ops: `+ - * /`, `min`, `max`, `clamp`,
`round`, `floor`, `ceil`, `abs` (no `eval`, no comparisons/ternary).

## 1. Three-layer structure

Keep these three layers cleanly separated — don't smear geometry math into rooms.

1. **`variables`** — the knobs. Base dims (`floorH`, `slabH`, `wallT`), **derived**
   vars (`wallC = "=2*wallT"`, `wallH = "=floorH-slabH"`), standard **opening
   sizes** (`doorW/doorH`, `winW/winH/winSill`, `entranceW`, `rearDoorW`, `doorMargin`),
   and **room-proportion** knobs (see §3). Variables may reference only other
   variables (they resolve before points).
2. **Size points** — each room's **INTERNAL clear floor size** (`x` = width, `y` =
   length). Fixed rooms are proportion formulas (§3); **absorber** rooms take the
   remainder (`Living.y = "=House.L-Verandah.L-Kitchen.L-Padvi.L-5*wallT"`) so the
   envelope total is conserved with no gaps/overlaps. Points may reference variables
   and other points (e.g. `House.W`).
3. **Grid points** — every room's **CORNERS** (`Room_TL`, `Room_BR`). **ALL** wall
   math lives here: `Bed_BR = {x:"=Bedroom.W+wallC", y:"=Bed_TL.Y+Bedroom.L+wallC"}`.
   Grid points chain off each other (`Maj_TL.y = "=Bed_TL.Y+Bedroom.L+wallT"`).

Rooms then link to **two corners only** — no size math inside the room:
```js
formulas: { x:"=Bed_TL.X", y:"=Bed_TL.Y", width:"=Bed_BR.X-Bed_TL.X", length:"=Bed_BR.Y-Bed_TL.Y" }
```

## 2. Wall compensation — count the walls

- **Size points are INTERNAL** (clear floor); **room objects are EXTERNAL** (outer
  footprint) → the grid corners add `wallC` (= 2·`wallT`), one wall thickness on each
  side.
- A remainder-absorber filling a plot dimension across **N stacked rooms** spans
  **N+1 walls** (2 exterior + N−1 partitions): `clear = House.dim − (N+1)*wallT`.
  1 room → `−wallC`; 2 rooms → `−3*wallT`; 3 rooms → `−2*wallC`. **Always count the
  walls** — the classic bug is copying a `−2*wallC` from a 3-room column into a
  2-room one, leaving the house a `wallT` short of the plot edge.
- **Corner-offset rule:** any object placed by `House.dim − size` (a pillar flush to
  the right/bottom edge, etc.) MUST set that **size dimension explicitly**, or the
  offset and the geometry disagree. E.g. a square pillar sets **both** `width` and
  `length` to `pillarT` — leaving `length` at a renderer default makes the
  `House.L − pillarT` corner offset stop matching the pillar.

## 3. Proportional rooms with a floor

Fixed rooms are a **percentage of the house with an absolute minimum**, so they scale
with the plot but never get unusably small:
```js
Bedroom: { x:"=max(minBedroomW, round(pctBedroomW*House.W))",
           y:"=max(minBedroomL, round(pctBedroomL*House.L))" }
```
- **Widths** key off `House.W`, **depths** off `House.L`. `round()` keeps whole units;
  absorbers soak up the rounding so the plot still fills exactly.
- Two vars per fixed dim: `pct<Room><W/L>` + `min<Room><W/L>`. The `min` governs small
  plots, the `pct` governs large ones.
- The fixed percentages in each direction must sum to **leave the absorbers positive**.

## 4. Openings

- Opening sizes are **standard variables**, never inline literals.
- Every opening is **positioned by formula** from its room's corner span.
- **Windows and wide entrances are CENTERED** — `ctr(span, w) = ((BR−TL) − w)/2`.
- **Internal doors are TUCKED into a corner** (conserves a continuous wall run for
  furniture): offset = `doorMargin` from one end (`lo`), or `(span − w) − doorMargin`
  from the other (`hi`). Pick the end that suits circulation.
- **Connecting doors** between two rooms must land inside their **shared-wall
  overlap** (partial-overlap walls: compute the offset to fall in the overlap).
- **Validate every opening:** `0 <= offset && offset + width <= wallSpan`, else
  `expandRoomWalls` throws. A connecting door also needs `overlap > doorW`.
- Declare a **shared wall once** — the room with the door declares it; the neighbour
  omits that side (its coincident wall is covered). Two solid declarations over one
  doorway fills the gap.

## 5. Pillars & colonnades

- **Flanking pillars key off the SAME centre the opening uses.** A verandah that is
  full-width can centre its entrance on the house; a **partial-width** verandah (e.g.
  a rear Padvi with a bathroom eating one corner) centres its door on the *verandah
  span*, so its flanking pillars must use the **verandah centre**, not the house
  centre — otherwise a pillar lands inside the doorway.
- **Corner pillars sit at that verandah's own corners.** Don't strand a pillar in
  front of a *different* room; a decision to put the corner pillar at the house corner
  vs the verandah's inner corner is deliberate (ask / confirm).

## 6. Konkan layout conventions

- **Central hall (Majghar) is the circulation hub** — every room opens into it, not
  into each other (no living↔bedroom door). Keeps privacy and frees wall runs.
- **Consolidate wet services** — kitchen and bathroom share one side/wall so plumbing
  runs together. (This also *decouples* the bathroom from the hall's walls: e.g.
  moving the bathroom to sit under the kitchen and be entered from the rear Padvi
  removed a bathroom-width coupling that had been overflowing the Majghar wall.)
- **Front verandah** (full-width, pillared) + **rear Padvi** (rear verandah).
- Give fixed rooms a comfortable **minimum** — a 6'×6' bathroom reads cramped; ~7'×7'
  is comfortable. Raise the `min`, not just the `pct`, so small plots benefit too.

## 7. Build & resolve — two steps

Zod `HouseConfig` is `.strict()` and validates **stored literals** *before* resolve,
so a `0` literal fails "expected > 0". Therefore:

1. **Author with formulas** + literal fallbacks that are valid positives (or `0` only
   where the formula always overwrites them). A small **generator** (`.mjs`) writes
   the config with the `formulas` maps.
2. **Resolve + validate + rewrite:** run `resolveParametric`, `HouseConfig.safeParse`,
   and write the **resolved** config back (keeps the `formulas`, fills the literals).
   See `library/resolve.mts`:
   ```bash
   node build_<model>.mjs && npx tsx resolve.mts <model>.wadi
   ```

## 8. Verify every change (non-negotiable)

- `resolveParametric` → **0 warnings**, and `HouseConfig.safeParse` succeeds.
- The rooms **fill the plot exactly** (right/bottom edges = House.W/House.L).
- **Every opening fits** — `expandRoomWalls(config, floor)` throws nothing on all floors.
- **Scale sweep** — resolve + expand at a small plot, a large plot, and an off-aspect
  plot; confirm no negative rooms, no opening overflow, no pillar/door overlap. This
  is the whole point of "parametric"; a change that only works at the default size
  isn't done.
- In the app: the **"Geometry issues" panel says "No geometry issues"**, and the floor
  plan looks right (via `scripts/preview.sh` or the live app).

See also: `reference/coordinate-system.md` (Y is DOWN, 10 units = 1 ft),
`reference/schema.md` (object fields), and `examples/` for non-parametric shapes.
