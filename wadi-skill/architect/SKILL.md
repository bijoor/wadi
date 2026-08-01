# Wadi architect — author `.wdl` house designs with a live 3D preview

You are the architect/editor. The user describes a house (in words, or with a
sketch/photo); you write or update its **`.wdl`** file (the Wadi DSL), **compile** it to
a `.wadi` with one command, and the **Wadi desktop app re-renders the 3D model live** as
the compiled file updates. The user watches and steers with follow-up messages.

You author in the **Wadi DSL** (`.wdl`), not raw JSON. It's more direct (formulas,
grids, and the configurator are one-liners), the grammar enforces structure, and the
compiler reports parse errors with `line:col`. The DSL is **complete** — every object
type has first-class syntax — so it can express any house the model can hold.
**`reference/dsl.md` is your syntax reference; read it first.** The compiled `.wadi` is
the artifact the app renders; the `.wdl` is your source of truth.

This skill is **agent-neutral** — it is plain instructions + reference docs + scripts,
usable by any coding agent (Claude Code, Google Antigravity, …). Agent-specific
entrypoints live outside this folder (e.g. `.claude/skills/wadi-architect/` for Claude
Code, `AGENTS.md` at the repo root); they just point here.

## What you need to run this

- **Read/write files** and **run shell + Node** (the only capabilities assumed).
- The **Wadi repo checked out**, with deps installed once:
  `npm --prefix editor install` and `npm --prefix wadi-dsl install` (the latter also
  regenerates the DSL parser via its `prepare` hook). The `compile`, `validate`, and
  `preview` scripts reuse the app's own TypeScript, so they flag exactly what the app
  would.
- For the *live* 3D loop: the **Wadi desktop app** installed and watching the compiled
  `.wadi`. Without the app you can still author `.wdl` + compile + render preview images.

## The live loop (read this first, every session)

You edit `house.wdl`, **compile** it to `house.wadi`, and the Wadi desktop app —
watching the `.wadi` — rebuilds the 3D model within ~1 s. The `.wdl` is your source; the
`.wadi` is the compiled, live-watched artifact. Keep them side by side (same name).

**Starting a NEW model — set it up, no manual steps for the user:**
1. Write a starter `house.wdl` (copy the shape from `../../wadi-dsl/examples/` — start
   from `minimal.wdl`, or `coastal.wdl` for a full cottage) at a path the user wants,
   e.g. `~/Documents/<name>.wdl`.
2. Compile it (this also validates):
   ```bash
   wadi-skill/architect/scripts/compile.sh "<ABS>.wdl" "<ABS>.wadi"
   ```
3. Open the COMPILED `.wadi` so it becomes the watched file (macOS):
   ```bash
   open -a Wadi "<ABS>.wadi"
   ```
   The file association loads it (into the running window if open, else it launches).
   (Other platforms / dev build: ask the user to **Load** the `.wadi` once.)
4. Build the house by editing `house.wdl` and re-running `compile.sh` after each change
   — every successful compile updates the `.wadi`, and the app re-renders live.

**Editing an EXISTING model:** edit its `.wdl`, recompile to the `.wadi` the app watches.
(If only a `.wadi` exists — hand-made or app-authored — you may keep editing that JSON
directly per `data-model.md`. But once a house is authored as `.wdl`, the **`.wdl` OWNS
it**: don't also hand-edit the `.wadi` or use the app's forms on it — the next compile
overwrites those changes.)

**Always:**
- **Tell the user which `.wdl` you are editing** (and the `.wadi` it compiles to), and
  edit only that path.
- **Compile after every edit.** A parse/validation error leaves the last-good `.wadi`
  untouched — a broken write shows nothing new (never corrupts the model) — but fix it
  before telling the user anything changed.

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

- **`reference/dsl.md`** — **your primary reference: the complete `.wdl` SYNTAX** —
  the skeleton, the parametric core (var/point/grid/configurator/formulas), the common
  attribute tail (`enabled`/`z_offset`/`layer`/`material`), and the first-class syntax
  for every object type (rooms/walls/openings, slab/beam/plinth/ground/pillar,
  staircase/kitchen/item, roof, components, layers) plus the `raw` escape. Read this
  first, then the semantics references below.
- **`reference/data-model.md`** — the underlying **`.wadi` schema** the DSL compiles to:
  every object type, field, type, requiredness, units, semantics. **Generated from the
  Zod schema** (`editor/src/schema/houseConfig.ts`) so it can't drift — regenerate with
  `scripts/gen-schema-doc.mjs` after any schema change. It's the field reference for the
  `raw` escape and for understanding exactly what your `.wdl` produces.
- **`reference/coordinate-system.md`** — the #1 source of mistakes. X→right, **Y→DOWN**
  (Inkscape frame, not Y-up), Z→up. Units: **10 project units = 1 ft** by default. Read
  before placing anything.
- **`reference/roof-v2-guide.md`** — the unified `roof` object (segments, hip vs gable,
  joints, trusses, shed). Its fields are freeform in the schema (validated at
  derivation), so this guide is the field reference for roofs. Read before touching a
  roof.
- **`reference/parametric-conventions.md`** — how to build a **fully-parametric** model
  (a reusable template that stays valid under any knob change): the **grid-first**
  recipe — variables (knobs) → named grid lines (formulas of the house size) → rooms &
  columns that reference those lines — plus `coord_convention:center`, proportional grid
  lines with minimums, the `pilInset` flush-column rule, opening placement, and the
  scale-sweep verification. Read before authoring or editing a parametric template.
- **`../../wadi-dsl/examples/*.wdl`** — correct, validated `.wdl` houses to copy shapes
  from (every one passes the compile → resolve → schema+geometry pipeline in the DSL's
  test suite, so **copy from these, not from memory**): `minimal.wdl` (smallest house),
  `two_room.wdl` (no grid), `two_story.wdl` (multi-floor + hip roof), `coastal.wdl`
  (grid + configurator + full cottage), `complete.wdl` (every entity — beam, wall,
  kitchen, item, component, gable roof, layers). `examples/coastal_konkan.wadi` in this
  folder is a resolved `.wadi` for reference on the compiled output shape.

## Compile before (and after) every edit — it validates too

`compile.sh` does everything in one step: it parses the `.wdl` (reporting parse errors
with `line:col`), resolves formulas/grids into numbers, and runs the real schema +
roof/wall geometry validator on the result (catches zero-length roof segments, missing
slope, bad openings that the schema alone misses):

```bash
wadi-skill/architect/scripts/compile.sh "<ABS>.wdl" "<ABS>.wadi"
```

Exit 0 = compiled + valid (the `.wadi` is updated → the app re-renders). Non-zero prints
the exact `parse: …` or `/path: message` error — fix the `.wdl` and re-run before
telling the user anything is ready. (`validate.mjs` still exists to check a raw `.wadi`
directly, e.g. a hand-made JSON file.)

## See your work (don't author blind)

You can't see the app's live render, but you CAN render the config to images and **read
them** to check your own edit — layout, sizes, openings, and roof are exactly where
mistakes happen:

```bash
wadi-skill/architect/scripts/preview.sh <ABS>.wadi     # the COMPILED file
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
- **Minimal patches.** Preserve unchanged `.wdl` lines verbatim so the user (and diffs)
  can see exactly what moved.
- **Formulas are bare expressions in the DSL** — write `at (main.x1, main.yA)`, not
  `"= main.x1"`; the compiler emits the `= …` form. Quote only `name "…"` strings;
  `room`/`pillar`/`var`/grid-line names are bare identifiers.
- **Errors are caught at compile.** A parse error (bad syntax) or a `.strict()` schema
  error (unknown/misspelled key inside a `raw` block) fails `compile.sh` with the exact
  location — nothing reaches the model silently.
