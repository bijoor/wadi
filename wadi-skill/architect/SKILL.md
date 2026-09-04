# Wadi architect — author `.wdl` house designs with a live 3D preview

You are the architect/editor. The user describes a house (in words, or with a
sketch/photo); you write or update its **`.wdl`** file (the Wadi DSL), and the **Wadi
app's DSL editor renders the model live** from that same file. The user watches and
steers with follow-up messages — and can edit the `.wdl` alongside you.

You author in the **Wadi DSL** (`.wdl`), not raw JSON. It's more direct (formulas,
grids, and the configurator are one-liners), the grammar enforces structure, and the
compiler reports parse errors with `line:col`. The DSL is **complete** — every object
type has first-class syntax — so it can express any house the model can hold.
**`reference/dsl.md` is your syntax reference; read it first.**

**The `.wdl` IS the design — do not produce a `.wadi`.** The Wadi app's DSL previewer
compiles + renders the `.wdl` live (in-app), so a single `.wdl` file on disk is the
**shared source you and the human co-edit**. You never convert it to JSON; you just
author the `.wdl` and verify it with `check.sh`.

This skill is **agent-neutral** — it is plain instructions + reference docs + scripts,
usable by any coding agent (Claude Code, Google Antigravity, …). Agent-specific
entrypoints live outside this folder (e.g. `.claude/skills/wadi-architect/` for Claude
Code, `AGENTS.md` at the repo root); they just point here.

## What you need to run this

- **Read/write files** and **run shell + Node** (the only capabilities assumed).
- The **Wadi repo checked out**, with deps installed once:
  `npm --prefix editor install` and `npm --prefix wadi-dsl install` (the latter also
  regenerates the DSL parser via its `prepare` hook). The `check` and `preview` scripts
  reuse the app's own TypeScript, so they flag exactly what the app would.
- For the *live* render: the **Wadi app's DSL editor** open on the `.wdl` you edit —
  desktop **⌘⇧D → Open**, or the browser playground at `wadi.house/dsl`. It compiles +
  renders the `.wdl` live. Without it you can still author + `check` + render preview
  images yourself.

## The live loop (read this first, every session)

The **`.wdl` file is the single shared source.** You edit it; the Wadi app's DSL editor
— open on that same file — compiles and re-renders it live; the human can edit it too (in
the DSL editor, in their own editor, or by asking you). **You never produce or touch a
`.wadi`** — the app does the `.wdl` → render conversion.

**Starting a NEW model:**
1. Write a starter `house.wdl` (copy the shape from `../../wadi-dsl/examples/` — start
   from `minimal.wdl`, or `coastal.wdl` for a full cottage) at a path the user wants,
   e.g. `~/Documents/<name>.wdl`.
2. Tell the user to open it in the **Wadi DSL editor** (**⌘⇧D → Open** in the desktop
   app) so it renders live and watches the file.
3. Build the house by editing `house.wdl`. Run `check.sh` after each change to confirm it
   still compiles + validates; the editor re-renders as the file changes.

**Editing an EXISTING model:** edit its `.wdl`. Because it's a **co-edited** file, **read
it first** (the human may have changed it since your last edit) and make a **minimal
patch** — change only the lines you need and preserve the rest verbatim, so your edit
merges cleanly with theirs.

**Always:**
- **Tell the user which `.wdl` you are editing**, and edit only that path.
- **Run `check.sh` after every edit.** It runs the DSL compiler + validator against a
  **throwaway temp** (it does NOT create a `.wadi`) purely for feedback — fix any
  reported error before telling the user anything changed. A broken `.wdl` just makes the
  editor show a diagnostic and keep the last good render; it never corrupts anything.

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
- **`reference/conventions.md`** — the **structural coding conventions** every house
  must follow (plinth-floor height must match the plinth block, rooms must wall every
  exterior side, a floor with no slab must set `slab_thickness 0`, …). These are
  *enforced* by `check.sh` — errors fail, warnings are advisory — and shown in the DSL
  editor's status. Read it so you author sound houses the first time.
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

## Check after every edit (get compiler feedback — no `.wadi` produced)

`check.sh` runs the DSL end-to-end for **feedback only**: it parses the `.wdl` (reporting
parse errors with `line:col`), resolves formulas/grids into numbers, and runs the real
schema + roof/wall geometry validator (catches zero-length roof segments, missing slope,
bad openings that the schema alone misses), and finally the **structural conventions**
linter (`reference/conventions.md`: floating floors, open exterior walls, no-slab floors)
— all against a **throwaway temp** that is deleted. It never writes a `.wadi`; the app's
DSL previewer does the real conversion.

Convention **errors** (`✖ [C…]`) fail the check — fix them. Convention **warnings**
(`⚠ [C…]`) are printed but don't fail; fix them, or keep them if the open side is a
deliberate verandah.

```bash
wadi-skill/architect/scripts/check.sh "<ABS>.wdl"
```

Exit 0 = compiles + valid. Non-zero prints the exact `parse: …` or `/path: message`
error — fix the `.wdl` and re-run before telling the user anything is ready.

**If you have the `wadi_*` MCP tools** (from the `wadi-mcp` server) instead of a repo
checkout, use them — they're the same pipeline, no clone needed: `wadi_check(wdl)` for
this step, `wadi_preview(wdl)` for the images below, `wadi_scope(wdl)` to see the actual
resolved value of every variable/point/grid line before you place an object on it, and
`wadi_examples` / `wadi_reference` for the examples and these docs.

## See your work (don't author blind)

You can't see the app's live render, but you CAN render your `.wdl` to images and **read
them** to check your own edit — layout, sizes, openings, and roof are exactly where
mistakes happen. `preview.sh` takes the `.wdl` directly (it compiles to a throwaway temp
just for rendering — again, no persistent `.wadi`):

```bash
wadi-skill/architect/scripts/preview.sh "<ABS>.wdl"
```

It writes (and prints paths to) `plans.png` (floor plans — room layout + sizes),
`elevations.png` (front/back/left/right — heights + **roof profile**, the 2D view of the
built 3D model), and `roof.png` (roof top view), plus all SVGs under `.../2d/`. **Read
the PNGs** after a non-trivial edit and confirm what you built matches the request (rooms
in the right place, not overlapping, correct sizes in feet, roof over the plinth). **If
it doesn't match, fix the `.wdl` and re-render — repeat until it looks right, and only
then tell the user it's ready.** It reuses the app's own generators, so it matches the
app's 2D tabs byte-for-byte. See `prompts/verify-visually.md`.

## Site elements — first-class primitives

Three site primitives are available as **first-class DSL keywords** (no `raw`
needed). Full syntax is in `reference/dsl.md § Objects — site elements`; field
details in `reference/data-model.md`.

| Primitive | What it does | Placement anchor |
|---|---|---|
| `compound_wall` | Boundary / perimeter wall | `at (x, y)` = top-left corner |
| `well` | Water well (circular / square / rectangular) | `at (x, y)` = plan centre |
| `solar_panel` | Solar array (roof-mount or ground-mount) | `at (x, y)` = array centre |

**Trigger phrases and what to generate:**

- **"add a compound wall" / "add boundary wall" / "enclose the plot"** →
  Add four `compound_wall` objects on **floor 1** covering the plot perimeter
  (North, South, East, West), using the plot dimensions from `site.plot` and
  the house `wall_thickness`. Height ≈ 50 project units (5 ft).

- **"add a well" / "add a water well"** →
  Place one `well` in the **rear or side yard** (Y close to plot length, X ≥ 60
  units from any room boundary), `shape circular`, `diameter 30`. Keep it ≥ 60
  project units from any room wall.

- **"add solar panels" / "add solar array" / "add PV"** →
  Place a `solar_panel` with `mount roof` on **floor 2 or higher** (or `mount
  ground` on floor 1 for a ground array). Use `azimuth 180` (south-facing) and
  `tilt 15` for India / northern hemisphere. Set `capacity_kw` and `panel_count`
  as specified (omit if not given). Place at the midpoint of the roof band or
  garden area.

**Enum keywords are bare, not quoted.** Write `shape circular`, `mount roof`,
`mount ground` — NOT `shape "circular"`. See the DSL pitfalls note in `dsl.md`.

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
  fields) — *except* where the **structural conventions** require a match: the
  plinth-floor `height` must equal the plinth block height, and a floor with no slab
  must set `slab_thickness 0`, or the floors above float. See `reference/conventions.md`.
- **A partial `wall` list makes a room a whitelist.** A bare room (no `wall` lines) is
  enclosed on all four sides; add one `wall` line and every side you don't list becomes a
  hole. Wall every **exterior** side (convention C2). List plain sides compactly:
  `wall east west`, then the opening sides separately.
- **Minimal patches.** Preserve unchanged `.wdl` lines verbatim so the user (and diffs)
  can see exactly what moved.
- **Formulas are bare expressions in the DSL** — write `at (main.x1, main.yA)`, not
  `"= main.x1"`; the compiler emits the `= …` form. Quote only `name "…"` strings;
  `room`/`pillar`/`var`/grid-line names are bare identifiers.
- **Errors are caught by `check.sh`.** A parse error (bad syntax) or a `.strict()` schema
  error (unknown/misspelled key inside a `raw` block) fails `check.sh` with the exact
  location — and the app's DSL editor shows the same squiggle live; nothing reaches the
  model silently.
