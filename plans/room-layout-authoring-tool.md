# Room-layout authoring tool — plan

## Why
Furniture layouts are authored by hand in `wadi-dsl/std-modules/rooms.wdl` and compiled to
`floor-planner/src/export/roomLayouts.json` by `npm run build-layouts`. Hand-writing anchor +
gap coordinates and checking overlaps by re-running the tsx validator is slow, and we need many
more layouts (per type, per size). This tool lets an author place furniture visually on a room
canvas, see overlaps/out-of-bounds live, and emit the `rooms.wdl` block to paste back.

## Principles
- **`rooms.wdl` stays the source of truth.** The tool EMITS a WDL block; the author pastes it in
  and runs `npm run build-layouts` (the authoritative check + compile). No hidden second source.
- **Gap-based underneath.** Placement is anchor + gap (what the pipeline actually uses). Dragging
  a piece just writes back its `gap_x`/`gap_y`, so it stays consistent with the form and the WDL
  (keeps the form-first studio ethos; the canvas is a faster way to set the same numbers).
- **Reuse the real math.** Footprints, overlap, and out-of-bounds use the same
  `furnitureFit.pieceBox` + margins the exporter and `check-room-layouts` use, so what the tool
  shows matches what the pipeline draws.

## Shape (per author direction)
The tool is a **library editor** over the whole layout pack, not a single-block emitter:
- **Library view** lists every layout with **name, type, size, and piece count**; pick one to
  **edit**, or **create a new room**.
- **Editor view**: set the room size on the same grid (project units); pull furniture from the
  standard catalog; each piece **attaches to one of the predefined anchor points only**, then is
  **translated (gap) and rotated**. A **2D preview** now; a **3D preview** is nice-to-have, a
  later phase.
- **Save** writes back the WDL file containing **all** rooms (later phase).

## Where it lives
A second top-level mode in the floor-planner: a **"🪑 Layouts"** toggle in the toolbar swaps the
body to a `LayoutEditor` (library list + canvas + sidebar) with its own small reducer — separate
undo, no collision with the house-doc autosave. Reuses `furnitureFit.js` and `styles.css`.

## Build order (author chose: minimal 1–2 first)
- **Now (minimal):** library list + 2D anchor editor (add from catalog, attach to an anchor,
  translate/rotate) + live overlap/out-of-bounds validation. No save/emit yet, no 3D.
- **Next:** Save to the full `rooms.wdl` (all rooms) + per-room WDL preview.
- **Later:** 3D preview; door-interaction preview.

## Data it needs
- **Full furniture catalog.** New build step `scripts/build-furniture-catalog.mjs` reads
  `std-furniture.wdl` and writes `src/export/furnitureCatalog.json` (`{id, src, dims, name,
  category}` per asset). `roomLayouts.json` only carries assets already used, so it can't drive an
  asset picker.
- **Existing layouts** (`roomLayouts.json`) — to load one for editing, and to suggest a free
  `at (x,y)` slot so the emitted block doesn't overlap the others in the pack.

## Editor model (local state)
A draft layout, same shape as a manifest entry:
`{ type, variant, w, h, height?, pieces: [{ asset, anchor, gap_x, gap_y, rotation }] }`.
Reducer actions: `SET_META`, `ADD_PIECE`, `UPDATE_PIECE`, `MOVE_PIECE` (drag → gaps),
`DELETE_PIECE`, `REORDER_PIECE`, `LOAD_LAYOUT`, `UNDO`, `REDO`.

## Phases

### Phase 1 — canvas + live preview (read-only)
- Draw the room rect at the target `(w, h)`, scaled to fit; the inner wall face (inset by
  `wallT = 8`); a light grid; the 9 anchor dots.
- Render each piece as its footprint box via `furnitureFit.pieceBox` (real anchor math + asset
  dims + rotation), labeled, with a small facing tick.
- Live validation overlay: pairwise overlap + out-of-bounds past the inner face, using the same
  `MARGIN` as `check-room-layouts`; offending boxes turn red with a one-line reason.

### Phase 2 — editing sidebar
- **Meta:** type (from `ROOM_TYPES`, or a custom slug), variant name, `w`/`h` (step by the grid),
  optional `height` (for balcony/terrace-style low-wall layouts).
- **Pieces:** a list with **add** (asset picker — catalog grouped by category, with search),
  **anchor** (9-grid selector), **gap x/y** (numeric, step by grid), **rotation** (0/90/180/270 +
  free), **delete**, **reorder**.
- **Canvas drag:** dragging a piece updates its `gap_x`/`gap_y` (snapped to the grid least-count)
  and writes back to the form. Optional rotate handle.

### Phase 3 — emit + round-trip
- **Copy WDL:** emit
  `room <type>_<variant> at (Xfree, Yfree) size (w, h) [height H] { item f."id" anchor A gap (gx, gy) [rotation r] ... }`,
  with `at` auto-placed at the next free slot computed from `roomLayouts.json`. Negative gaps are
  fine (the build step already reads negative-literal formulas).
- **Copy JSON:** the manifest entry (dev convenience for quick manual injection).
- **Validate:** run the same overlap/OOB check and report pass/fail inline.
- Workflow reminder in the UI: paste into `rooms.wdl` → `npm run build-layouts`.

### Phase 4 — load/edit existing + polish
- Load an existing layout from the manifest into the editor, tweak, re-emit.
- **Door preview toggle** (optional): toggle door sides and watch how A/C (rotation +
  shift/drop) would treat the layout, reusing `furnitureFit` (`rotateLayoutCW`, `placePieces`).
  Helps author door-friendly arrangements.

## Verification
- Author a layout in the tool, copy WDL, paste into `rooms.wdl`, run `npm run build-layouts`
  (check passes), confirm it lands in the manifest and the planner picks it for a matching room.
- Node test for the WDL emitter: emit → parse/build → identical pieces (round-trip).

## Non-goals (for now)
- No 3D preview — 2D footprints only (3D is the Wadi viewer's job).
- No direct write to `rooms.wdl` — the browser can't; copy-paste keeps the pack a reviewed source.
- Not part of the end-user studio — an author/dev tool (a discreet toolbar button; could sit
  behind a `?layouts` flag if we want it hidden from owners).
