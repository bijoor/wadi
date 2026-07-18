# Recreate a house from drawings (PDF / sketch / CAD export)

Transcribing an existing design. **The #1 rule: build it INCREMENTALLY and compare
each step to the original. Never author the whole plan in one shot** — a
full house written at once is extremely hard to QC, and a single transcription
slip (a flipped Y, a wrong dimension, an overlap) hides in the crowd and is hard
to trace. Go piece by piece; render and check against the drawing each time.

## 1. Read the drawings first

- Claude Code reads PDFs directly (the Read tool renders each page). Open every
  relevant page.
- Establish and **state back to the user** before placing anything:
  - **Orientation** — where is north? (Usually up.) This sets the Y-DOWN mapping:
    the top of a north-up drawing → small Y.
  - **Units** — feet or meters? (Config is **ft × 10**; convert meters.)
  - **Plot / plinth** outer dimensions.
  - **Floors** — how many; which page is which floor.
  - **Which drawing is which** — floor plan (per floor), elevations, roof plan,
    sections.
- If any of these is unclear, ask — don't guess.

## 2. Build incrementally, comparing to the original at every step

1. **Frame first.** site + plinth + a `floor_slab` per floor + the floor stack
   (floor `height`s). Run `preview.sh`, Read it, confirm the outline and overall
   dimensions match the drawing.
2. **One room at a time.** Add a single `room` (`x, y, width, length`) →
   `preview.sh` → **Read the rendered plan and compare THAT room's position and
   size against the original drawing** → fix if off → only then move to the next
   room. Per room, check:
   - right **place** (remember Y is DOWN — north = smaller Y),
   - right **size** (ft × 10; the render labels feet — cross-check the numbers),
   - **no overlap** with already-placed rooms, inside the plinth.
3. **Openings** for that room (doors/windows in `walls.<side>.openings`) → render →
   compare their positions to the drawing.
4. **Repeat room by room** until the floor matches the plan.
5. **Next floor.** Same loop; watch **vertical alignment** of wet areas and the
   staircase against the floor below.
6. **Roof last.** On its own top floor (see `roof-v2-guide.md`); compare the roof
   plan + the elevations to the drawings.

Save after each increment — the live app also updates per save, so the user watches
it grow and can flag a problem early.

## 3. Why room by room (not all at once)

- Each render is a **small, checkable delta** against the source, so an error is
  obvious and localized the moment it appears.
- A whole-house render is a wall of rooms; a wrong Y-flip or dimension is easy to
  miss and painful to bisect after the fact.
- It keeps you honest: you literally look at the original next to your render for
  each piece.

## 4. Final cross-checks before saying it's done

- Total plot dimensions = the drawing.
- Room count + names per floor = the drawing.
- Roof footprint covers the plinth; hip/gable ends match the roof plan.
- Openings on the correct walls, within each wall's length.
- Run `validate.mjs`, then a final `preview.sh` and compare every floor + the
  elevations to the originals one more time.

> Tip: when comparing, render with `preview.sh` and Read your `plans.png`
> alongside the corresponding PDF page — put your transcription and the original
> side by side and reconcile differences before moving on.
