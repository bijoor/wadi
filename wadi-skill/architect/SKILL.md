# Wadi architect — author `.wadi` house designs with a live 3D preview

You are the architect/editor. The user describes a house (in words, or with a
sketch/photo); you write or update its `.wadi` file (a `house_config.json`), and the
**Wadi desktop app re-renders the 3D model live** as you save. The user watches and
steers with follow-up messages.

This skill is **agent-neutral** — it is plain instructions + reference docs + scripts,
usable by any coding agent (Claude Code, Google Antigravity, …). Agent-specific
entrypoints live outside this folder (e.g. `.claude/skills/wadi-architect/` for Claude
Code, `AGENTS.md` at the repo root); they just point here.

## What you need to run this

- **Read/write files** and **run shell + Node** (the only capabilities assumed).
- The **Wadi repo checked out**, with the editor deps installed once
  (`npm --prefix editor install`) — the `validate` and `preview` scripts reuse the
  app's own TypeScript, so they flag exactly what the app would.
- For the *live* 3D loop: the **Wadi desktop app** installed and watching the file you
  edit. Without the app you can still author + validate + render preview images.

## The live loop (read this first, every session)

You edit a file on disk; the Wadi desktop app watches it and rebuilds the 3D model
within ~1 s of every save — no manual reload.

**Starting a NEW model — set it up, no manual steps for the user:**
1. Write a valid starter config to a `.wadi` file (use `examples/blank.json` as the
   base) at a path the user wants, e.g. `~/Documents/<name>.wadi`.
2. Open it in the installed app so it becomes the watched file (macOS):
   ```bash
   open -a Wadi "<ABS_PATH>.wadi"
   ```
   The file association loads it — into the running window if the app is open,
   otherwise it launches with it. Either way, that file is now the live-watched one.
   (On other platforms, or a dev build, ask the user to **Load** the file once via the
   app's Load button — that also sets the watched path.)
3. Build the house into **that same file**. Each save updates the model live.

**Editing an EXISTING model:** the user has their `.wadi` open in the app (or you open
it). Edit that exact file.

**Always:**
- **Tell the user which file path you are editing**, and edit only that path.
- Save **complete, valid** JSON each time — the watcher ignores unparseable/invalid
  saves, so a broken write just shows nothing new (it won't corrupt the model).

## Two ways users work with you

- **Brief → house.** They describe requirements ("3-bed L-shaped bungalow, ~1500 sq
  ft, hip roof"). You *derive* the base config. Keep a running **design brief** as the
  source of truth so later changes re-derive cleanly — see `prompts/design-brief.md`.
  This is Wadi's "higher-level language": the brief is the intent, the config is the
  derived artifact, you are the compiler.
- **Drawings → house (recreate an existing design).** **Do NOT try to read dimensions
  off an architect's drawing yourself — it's unreliable and produces the wrong house.**
  Instead run a **guided dialog**: the USER reads their drawing and describes each
  piece in plain terms (names, sizes in feet, where things sit), and YOU do all the
  coordinate / scale / convention work, building **one room at a time** and rendering
  after each so they confirm. Ask **spatially** ("how big? which corner? next to
  what?"), never for coordinates. Never build the whole plan from one answer. Full
  method in `prompts/sketch-to-config.md`.
- **Iterate.** They react to the live model ("make Bedroom 2 bigger", "add a north
  window"). Apply a **minimal patch** — see `prompts/update-existing.md`.

## The data model & references (read lazily — don't dump them all up front)

- **`reference/data-model.md`** — the **complete, authoritative** shape of a `.wadi`
  file: every object type, field, type, requiredness, units, and semantics. **Generated
  from the Zod schema** (`editor/src/schema/houseConfig.ts`) so it can never drift —
  regenerate with `scripts/gen-schema-doc.mjs` after any schema change. Read before
  writing any object type you're unsure of.
- **`reference/coordinate-system.md`** — the #1 source of mistakes. X→right, **Y→DOWN**
  (Inkscape frame, not Y-up), Z→up. Units: **10 project units = 1 ft** by default. Read
  before placing anything.
- **`reference/roof-v2-guide.md`** — the unified `roof` object (segments, hip vs gable,
  joints, trusses, shed). Its fields are freeform in the schema (validated at
  derivation), so this guide is the field reference for roofs. Read before touching a
  roof.
- **`reference/parametric-conventions.md`** — how to build a **fully-parametric** model
  (a reusable template that stays valid under any knob change): the variables →
  size-points → grid-corners recipe, wall compensation, proportional rooms with
  minimums, opening/door placement, pillar–opening alignment, the two-step
  build-and-resolve flow, and the scale-sweep verification. Read before authoring or
  editing a parametric template.
- **`examples/`** — correct, validated houses to copy shapes from. Every example here
  is built on the current conventions (esp. the centreline convention), so **copy
  from these, not from memory or older files.** Currently `coastal_konkan.wadi` (a
  single-storey coastal modern-Konkan home); more are added as templates are authored.
  (The prior set of examples was removed — it predated the centreline convention and
  taught it wrong.)

## Validate before (and after) you save

Run the validator — it checks BOTH the schema and the roof/wall compute pipeline
(catches zero-length roof segments, missing slope, bad openings that the schema alone
misses):

```bash
cd editor && npx tsx ../wadi-skill/architect/scripts/validate.mjs <ABS_PATH_TO_config.json>
```

Exit 0 = valid; non-zero prints the exact `/path: message` errors. Fix and re-run
before telling the user it's ready.

## See your work (don't author blind)

You can't see the app's live render, but you CAN render the config to images and **read
them** to check your own edit — layout, sizes, openings, and roof are exactly where
mistakes happen:

```bash
wadi-skill/architect/scripts/preview.sh <ABS_PATH_TO_config.json>
```

It writes (and prints paths to) `plans.png` (floor plans — room layout + sizes),
`elevations.png` (front/back/left/right — heights + roof profile), and `roof.png` (roof
top view), plus all SVGs under `.../2d/`. **Read the PNGs** after a non-trivial edit and
confirm what you built matches the request (rooms in the right place, not overlapping,
correct sizes in feet, roof over the plinth). **If it doesn't match, fix the config and
re-render — repeat until it looks right, and only then tell the user it's ready.** It
reuses the app's own generators, so it matches the app's 2D tabs byte-for-byte. See
`prompts/verify-visually.md`.

## Top pitfalls (memorize)

- **Y is DOWN.** A room "to the north" has a *smaller* Y. Never treat Y as up.
- **Dimensions are project units, not feet.** `width: 120` is 12 ft. Multiply feet by
  10 (the default; `units.per_unit` can change it).
- **Set `"coord_convention": "center"`.** Then a room's `x,y,width,length` are wall
  **CENTRELINES**, and **two rooms that share a wall just ABUT on the shared line** — room
  A spans X `[0,150]`, room B `[150,300]`; the wall is centred on `150` and shared. No
  overlap, no `wall_thickness` math (the system grows to the outer face at render). On a
  grid, a room is simply `x:"= main.x1", width:"= main.x2 - main.x1"`. (Legacy files
  without the flag use the OUTER convention where adjacent rooms must overlap by
  `wall_thickness`.) See `coordinate-system.md` → "the centreline convention".
- **The roof footprint must cover the plinth footprint.** Roof segment widths and
  positions come from the walls they sit on, not arbitrary numbers.
- **The roof lives on its OWN top floor** (`floor_number` ABOVE the floors it covers,
  containing only the roof), and you **never set its Z** — the base height is computed
  from the plinth height + the `height`s of the floors below it. To move the roof
  up/down, change floor heights, not the roof. (See `reference/roof-v2-guide.md`.)
- **Floors stack; `floor_number` is 0-based** (the plinth floor = 0). Heights are
  independent per floor (`height`, `wall_height`, `slab_thickness` are unrelated
  fields).
- **Minimal patches.** Preserve unchanged objects verbatim so the user (and diffs) can
  see exactly what moved.
- **`.strict()` schema.** Unknown/misspelled keys are rejected — no silent typos.
