---
name: wadi-config
description: >-
  Author and edit Wadi house designs (house_config.json / .wadi files) from a
  plain-English brief or an architect's sketch, while the Wadi app live-previews
  the 3D model. Use whenever the user wants to create, modify, or reason about a
  Wadi house model — rooms, walls, roofs, floors, doors, windows, staircases,
  pillars, kitchen platforms — or mentions house_config.json, a .wadi file, or
  the Wadi designer.
---

# Wadi house config authoring

You are the editor. The user describes a house (in words, or with a sketch/photo);
you write or update its `house_config.json`, and the **Wadi app re-renders the 3D
model live** as you save. The user watches and steers with follow-up messages.

## The live loop (read this first, every session)

You edit a file on disk; the Wadi desktop app watches it and rebuilds the 3D
model within ~1 s of every save — no manual reload.

**Starting a NEW model — set it up yourself, no manual steps for the user:**
1. Write a valid starter config to a `.wadi` file (use `examples/blank.json` as the
   base) at a path the user wants, e.g. `~/Documents/<name>.wadi`.
2. Open it in the installed app so it becomes the watched file:
   ```bash
   open -a Wadi "<ABS_PATH>.wadi"
   ```
   The app's file association loads it — into the running window if the app is
   open, otherwise it launches with it. Either way, that file is now the
   live-watched one.
3. Build the house into **that same file**. Each save updates the model live.

**Editing an EXISTING model:** the user has their `.wadi`/`house_config.json` open
in the app (or you `open -a Wadi` it). Edit that exact file.

**Always:**
- **Tell the user which file path you are editing**, and edit only that path.
- Save **complete, valid** JSON each time — the watcher ignores unparseable/invalid
  saves, so a broken write just shows nothing new (it won't corrupt the model).
- `open -a Wadi` targets the **installed** `/Applications/Wadi.app`. If the user is
  running a dev build instead, ask them to Load the file once via the app's Load
  button (that also sets the watched path).

## Two ways users work with you

- **Brief → house.** They describe requirements ("3-bed L-shaped bungalow, ~1500
  sq ft, hip roof"). You *derive* the base config. Keep a running **design brief**
  as the source of truth so later changes re-derive cleanly — see
  `prompts/design-brief.md`. This is Wadi's "higher-level language": the brief is
  the intent, the config is the derived artifact, you are the compiler.
- **Sketch / drawings → house (recreate an existing design).** They attach a floor
  plan / elevation / PDF (Claude Code reads PDFs directly). **Transcribe it
  INCREMENTALLY — one room at a time: add a room, render with `preview.sh`, compare
  it against the original, fix, then do the next. Never author the whole plan in
  one shot** — it's extremely hard to QC and a single slip hides in the crowd. Full
  method in `prompts/sketch-to-config.md`.
- **Iterate.** They react to the live model ("make Bedroom 2 bigger", "add a north
  window"). Apply a **minimal patch** — see `prompts/update-existing.md`.

## Read references lazily (don't dump them all up front)

- **`reference/schema.md`** — the exact shape of `house_config.json`: every object
  type, its fields, types, ranges. Read before writing any object type you're
  unsure of.
- **`reference/coordinate-system.md`** — the #1 source of mistakes. X→right,
  **Y→DOWN** (Inkscape frame, not Y-up), Z→up. Units: **10 project units = 1 ft**.
  Read before placing anything.
- **`reference/roof-v2-guide.md`** — the unified `roof` object (segments, hip vs
  gable, joints, trusses, shed). Read before touching a roof.
- **`examples/`** — six real, valid houses (`two_story_konkan.json`,
  `courtyard_home.json`, `l_shape_villa.json`, `modern_flat.json`,
  `verandah_cottage.json`, `blank.json`). Use as few-shot references; copy shapes
  rather than inventing.

## Validate before (and after) you save

Run the validator — it checks BOTH the schema and the roof/wall compute pipeline
(catches zero-length roof segments, missing slope, bad openings that the schema
alone misses):

```bash
cd editor && npx tsx ../.claude/skills/wadi-config/scripts/validate.mjs <ABS_PATH_TO_config.json>
```

Exit 0 = valid; non-zero prints the exact `/path: message` errors. Fix and re-run
before telling the user it's ready. See `prompts/validation-loop.md` if present.

## See your work (don't author blind)

You can't see the app's live render, but you CAN render the config to images and
**Read them** to check your own edit — the layout, sizes, openings, and roof are
exactly where you make mistakes:

```bash
.claude/skills/wadi-config/scripts/preview.sh <ABS_PATH_TO_config.json>
```

It writes (and prints paths to) `plans.png` (floor plans — room layout + sizes),
`elevations.png` (front/back/left/right — heights + roof profile), and `roof.png`
(roof top view), plus all SVGs under `.../2d/`. **Read the PNGs** after a
non-trivial edit and confirm what you built matches the request (rooms in the
right place, not overlapping, correct sizes in feet, roof over the plinth).
**If it doesn't match, fix the config and re-render — repeat until it looks
right, and only then tell the user it's ready.** It reuses the app's own
generators, so it matches the app's 2D tabs byte-for-byte.
See `prompts/verify-visually.md`.

## Top pitfalls (memorize)

- **Y is DOWN.** A room "to the north" has a *smaller* Y. Never treat Y as up.
- **Dimensions are project units, not feet.** `width: 120` is 12 ft. Multiply feet
  by 10.
- **The roof footprint must cover the plinth footprint.** Roof segment widths and
  positions come from the walls they sit on, not arbitrary numbers.
- **The roof lives on its OWN top floor** (`floor_number` ABOVE the floors it
  covers, containing only the roof), and you **never set its Z** — the base height
  is computed from `plinth.height` + the `height`s of the floors below it. To move
  the roof up/down, change floor heights, not the roof. There is no Z field on the
  roof. (See `reference/roof-v2-guide.md`.)
- **Floors stack; `floor_number` is 0-based** (ground = 0). Heights are independent
  per floor (`height`, `wall_height`, `slab_thickness` are unrelated fields).
- **Minimal patches.** Preserve unchanged objects verbatim so the user (and diffs)
  can see exactly what moved.
- **`.strict()` schema.** Unknown/misspelled keys are rejected — no silent typos.
