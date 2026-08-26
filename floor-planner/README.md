# Floor Planner

A planning tool that models a residential property as a **graph of rooms**. Each
node is a room (rectangular, area = real size); each edge is a connection between
two rooms. Everything is snapped to a **grid**, and all rooms live inside a
rectangular **plot** boundary. A plan can have **multiple floors**; the grid and
plot are shared by every floor, and each floor is edited independently.

This is a *manual* planning tool — you lay out and size rooms yourself. It does
not auto-generate or "shuffle" layouts. Its job is to keep your plan valid
(grid, plot containment, overlaps, connectivity) and show you what still needs
fixing.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed URL. `npm run build` produces a static bundle in `dist/`.

## The puzzle

A connection means the two rooms **share a wall** (at least one grid cell).
Connections are drawn as **dashed lines** — green when satisfied, red when the
rooms aren't adjacent.

Editing is **free — nothing is blocked or auto-moved**. You define the graph
(connect any two rooms) and then move/resize rooms until every relationship is
satisfied. The app continuously *shows* what's wrong; solving is up to you.

A plan is **solved** when:

- every connection is satisfied — connected rooms share a wall of ≥1 grid cell
  (unsatisfied ones are drawn **dashed red**),
- no two rooms overlap (overlapping rooms are outlined **red**), and
- every room is inside the plot (out-of-plot rooms are outlined **red**).

The Summary panel shows a live count of remaining issues and flips to
**"✓ All relationships satisfied"** when the puzzle is solved. Connections can be
created between *any* two rooms — a new connection simply shows as unsatisfied
until you arrange the rooms to share a wall.

## Working with the plan

**Drawing (primary):**
- **Draw Room** — pick the tool, then drag a rectangle on the grid. It snaps to
  whole grid cells.
- **Draw Edge** — pick the tool, then drag from one room to another to connect
  them (any two rooms; the connection shows unsatisfied until they share a wall).

**Direct manipulation (Select tool):**
- Click to select a room or connection. Connections sit on top of rooms with a
  wide hit-area, so clicking a connection always selects it (grab a clear part of
  a room, away from the connection lines, to move it).
- **Box-select**: drag a window over empty space to select every room it touches.
  **Shift-click** adds/removes a room from the selection.
- Drag a room to move it (snaps to grid). With several rooms selected they move
  **together**, and the sidebar shows only the group's overall position.
- Drag a room's handles to resize it. Moving/resizing anywhere is allowed;
  overlaps or leaving the plot are just flagged.
- **Zoom**: ⌘/Ctrl+scroll, trackpad pinch, or the on-canvas buttons (−/%/+/Fit).
  Plain scroll **pans**.

**Copy / duplicate**: ⌘/Ctrl+C then ⌘/Ctrl+V, or ⌘/Ctrl+D (or the Duplicate
button), copies the selected room(s) offset by one cell. When several rooms are
copied together, connections **between** them are duplicated too (links to rooms
outside the selection are not).

**The plot** is selected by clicking its border (interior clicks box-select). It
is fixed at the origin (0, 0); only its width/height can change — edit them in the
sidebar or, after selecting it, drag the right/bottom/corner handles.

**Forms (fallback):** the sidebar edits the selected object numerically — name,
position, size, colour for rooms; position/size for the plot.

**Floors:** the toolbar has a tab per floor (ordered bottom → top) and a **＋** to
add one above. The highlighted tab is the floor you're editing; only its rooms and
connections are interactive. The sidebar **Floors** panel renames, reorders (↑/↓),
duplicates (⧉), and deletes (✕) floors. **Duplicate a floor** to reuse a layout —
e.g. stack a 1BHK into a two-storey home, then edit the copy. Overlap, out-of-plot,
and connection checks are always scoped to a single floor (two rooms stacked on
different floors are not an overlap).

**Viewing floors** (toolbar, right of the floor tabs):
- **Single** — edit one floor. The floor immediately below shows as a faint dashed
  tracing so you can line rooms up with the storey underneath.
- **Overlay** — every floor superimposed in the same plot: the active floor stays
  solid and editable, the others draw as colour-coded outlines. A legend (top-left)
  maps each colour to its floor; click a legend entry to edit that floor.
- **Side by side** — all floors laid out as labelled plates next to each other,
  each a full mini floor-plan (rooms with names + dimensions, and connections).
  The **active floor's plate is fully editable** — its rooms show resize handles
  and can be dragged and resized in place, just like Single view. Click a room on
  any plate to focus that floor and select the room; click empty plate space to
  focus a floor without selecting.

**Copy rooms between floors:** select one or more rooms, then use **Copy to floor**
in the sidebar to clone them (with any connections among them) onto another floor
at the same position; the view jumps to that floor with the copies selected. You
can also ⌘/Ctrl+C on one floor and ⌘/Ctrl+V on another — paste lands on the floor
you're editing.

**Keyboard:** `V` select · `R` draw room · `E` draw edge · `[` / `]` switch floor
down / up · `Delete`/`Backspace` removes the selection · `⌘/Ctrl+Z` undo ·
`⇧⌘/Ctrl+Z` redo.

## Validation

The **Summary** panel continuously reports the active floor's rooms, connections,
overlaps, out-of-plot rooms, unsatisfied links, and plot / used / remaining area,
plus a house-wide total (floors · rooms). Checks are per floor — rooms stacked on
different floors never count as an overlap. Rooms that overlap or breach the plot
are outlined in red.

## Save & export

- **Save JSON** / **Load JSON** — the full model (grid, plot, floors, rooms, edges)
  round-trips through a portable JSON file.
- **Export SVG** — exports a standalone SVG. In Single/Overlay it's the floor
  being edited; in **Side by side** it's **all floors**, laid out as labelled
  plates just like the view.
- The plan also auto-saves to your browser's local storage and is restored on
  reload. **Reset** returns to the bundled sample apartment.

## Data model

```jsonc
{
  "grid":   { "cols": 40, "rows": 30, "cell": 26, "unit": "ft", "unitPerCell": 1 },
  "plot":   { "x": 0, "y": 0, "w": 30, "h": 20 },       // in grid cells, pinned at 0,0
  "floors": [ { "id": "f_ground", "name": "Ground" } ],  // ordered bottom -> top
  "rooms":  [ { "id", "name", "floor", "x", "y", "w", "h", "color" } ],  // floor = a floor id
  "edges":  [ { "id", "a", "b" } ]                      // a,b = room ids (same floor)
}
```

`grid` and `plot` are house-level (shared by every floor). Each room names the
`floor` it belongs to; an edge connects two rooms on the same floor. All positions
and sizes are integer grid cells; pixels are derived only at render time, so
nothing is ever off-grid. Older floorless files still load — they become a single
"Ground" floor automatically.

## Project layout

```
src/
  model/geometry.js   # overlap, shared-wall, plot-containment tests
  model/graph.js      # ids, edge helpers, analyze() health report
  store/reducer.js    # all state transitions + undo/redo
  store/initialState.js
  components/Canvas.jsx   # SVG viewport + all pointer interactions
  components/Sidebar.jsx  # per-object forms, grid controls, summary
  components/Toolbar.jsx  # tools, view toggle, save/load/export
  utils/storage.js    # localStorage + JSON/SVG file I/O
  utils/svgExport.js  # standalone-SVG generator
```

## Bridge to Wadi

This planner is the **schematic front stage** for [Wadi](https://wadi.house): you
block out the plot, grid, rooms, floors, and required connections here, then
materialize a Wadi `.wadi` model that carries walls, openings, roofs, and 3D. The
coordinate conventions line up 1:1, so materialization is a mapping, not a
transform:

| This model | Wadi | Note |
|---|---|---|
| origin top-left, X right, Y down | same (Inkscape-style) | no axis flip |
| room `x,y` = top-left corner, `w`/`h` extent | `at (x,y)` + `size (width, length)` | `h` → `length` |
| `plot` at `(0,0)` | `site.plot … ref (0,0)` | shared |
| cell coords × `unitPerCell` | continuous units × `per_unit` | one linear scale factor |
| a `floor` | a Wadi floor (floor *N*) | stacks in order |
| a `room` | a `room` with 4 default walls | emit **`convention center`** |
| coincident room edges (shared wall) | rooms abut on a shared grid centreline | falls out of center convention |

**Connections stay validation-only** — they are *not* promoted to Wadi geometry.
On materialization the `edges` are emitted as inert house-level metadata
(`functional_tests.adjacencies: [{ a, b, floor }]`, which the renderer ignores)
and a Wadi structural constraint checks that each declared pair actually shares a
wall in the built model. An unsatisfied connection then surfaces as a failed
functional test in Wadi's linter, exactly like its other C-rules — no `connect`
object, no schema change.

## Out of scope (for now)

- Automated / generative layout ("shuffle").
- Non-rectangular plots.
- The Wadi materializer itself (the mapping above is the spec; the exporter lives
  on the Wadi side).
