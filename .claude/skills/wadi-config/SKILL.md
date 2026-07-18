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

1. The user has the **Wadi desktop app open** with their working
   `house_config.json` loaded (File → Load, which sets the watched absolute path).
   If they haven't, ask them to open the app and Load the file you'll edit.
2. You edit **that exact file**. On save, the app's file watcher re-reads it and
   rebuilds the model within ~1 s — no manual reload. (Details:
   `reference/live-workflow.md` if present, or just: edit → save → they see it.)
3. **Always tell the user which file path you are editing**, and edit only that
   path. In `cargo tauri dev` it is usually the repo's `house_config.json` (a
   symlink to `docs/house_config.json`); in the installed app it is whatever
   external file they opened.
4. Save **complete, valid** JSON each time (no partial writes) — the watcher
   ignores unparseable/invalid states, so a broken save just shows nothing new.

## Two ways users work with you

- **Brief → house.** They describe requirements ("3-bed L-shaped bungalow, ~1500
  sq ft, hip roof"). You *derive* the base config. Keep a running **design brief**
  as the source of truth so later changes re-derive cleanly — see
  `prompts/design-brief.md`. This is Wadi's "higher-level language": the brief is
  the intent, the config is the derived artifact, you are the compiler.
- **Sketch → house.** They attach a floor plan / elevation. Transcribe it — see
  `prompts/sketch-to-config.md` if present; core rule below.
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

## Top pitfalls (memorize)

- **Y is DOWN.** A room "to the north" has a *smaller* Y. Never treat Y as up.
- **Dimensions are project units, not feet.** `width: 120` is 12 ft. Multiply feet
  by 10.
- **The roof footprint must cover the plinth footprint.** Roof segment widths and
  positions come from the walls they sit on, not arbitrary numbers.
- **Floors stack; `floor_number` is 0-based** (ground = 0). Heights are independent
  per floor (`height`, `wall_height`, `slab_thickness` are unrelated fields).
- **Minimal patches.** Preserve unchanged objects verbatim so the user (and diffs)
  can see exactly what moved.
- **`.strict()` schema.** Unknown/misspelled keys are rejected — no silent typos.
