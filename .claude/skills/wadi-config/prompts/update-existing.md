# Updating an already-loaded config (the common live case)

The user is watching the live model and asks for a change ("make Bedroom 2
bigger", "add a north window in the kitchen", "raise the roof pitch", "extend the
verandah south by 3 ft"). Apply a **minimal patch**.

## Workflow

1. **Read the current working file** (the one the app has loaded). Don't work from
   memory — read the actual JSON.
2. **Locate the target object(s)** by `name`/`type`.
3. **Change only what's needed.** Preserve every other object **verbatim** — same
   order, same formatting — so the diff shows exactly what moved. Do not
   re-emit or "tidy" the whole file.
4. **Propagate dependents.** If the change moves an edge, fix the neighbours that
   were positioned relative to it (adjacent rooms, vertically-aligned baths, roof
   footprint). If a brief exists (`house_brief.md`), update it too.
5. **Validate** (`scripts/validate.mjs`), fix any errors, **save complete valid
   JSON**.
6. **Tell the user what changed** in one line ("Widened Bedroom 2 from 10→12 ft and
   shifted the ensuite east to match"). The app updates live; they react.

## Common edits → where they live

| Request | Edit |
|---|---|
| Resize a room | that `room`'s `width`/`length`; then shift neighbours so they still tile |
| Move a room | its `x`/`y`; check it still fits the plinth and doesn't overlap |
| Add a window/door | push an Opening into `room.walls.<side>.openings` (`kind`, `offset`, `width`, `height`) |
| Change wall height | `room.walls.<side>.height` (+ `height_end` for a slope) |
| Taller floor / ceiling | that floor's `height` / `wall_height` |
| Roof pitch/shape | the `roof` object — see `roof-v2-guide.md`; then validate |
| Add a whole room | new `room` object; place it against a neighbour's edge; recheck fit |

## Keep in mind

- **Units are ft × 10.** "3 ft south" = add 30 to Y (Y is DOWN).
- **`.strict()`** — a misspelled key fails validation; copy field names exactly.
- Don't renumber or reorder floors/objects unless that *is* the change.
- If a change would break the fit (overlap, out of plinth, roof not covering),
  say so and propose the adjustment rather than silently distorting the model.
