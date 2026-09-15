# Furniture Catalog + Room Selection — Plan (for review)

## Status (2026-09-15)

- **0a DONE** — tabbed left-panel dock + tool registry (config + 2D filters migrated
  in); the tabs ride the open panel's outer edge like the WDL tab.
- **A1 DONE** — room selection by clicking a room in the 2D floor plan. Parity-safe
  hit layer (`interactiveRooms` flag on the viewer's `generateAllFloorPlans` path
  only; combined/parity SVG stays byte-identical). `editor/src/viewer/roomSelection.ts`
  → store `selection` + terracotta highlight, lightbox guarded on room clicks.
- **B1 DONE** — furniture catalog tool (`editor/src/viewer/furnitureCatalogPanel.tsx`),
  a left tool available when a room is selected. Composition canvas on wadi's anchor
  engine (`pieceFootprint`/`anchorPoints`/`validateLayout`), catalog grouped by
  `FURNITURE_CATEGORIES`, per-piece anchor + rotation, draft → Apply (writes
  `room.furniture` as not-auto + locked). Apply gated on a valid layout.
- **NEXT** — B1b: piece DRAG (gap_x/gap_y via `gapForCenter`); B2: kitchen counter as a
  catalog entry; A2 (WDL cursor → room) / A3 (3D click → room); widen the dock while
  the furniture tool is active if the canvas feels cramped.

---


## Why

The one real gap in the main app is a **visual furniture catalog** and a way to
**compose a room's furniture** (several anchored pieces) using the app's own 3D /
2D / anchor engine, instead of the separate floor-planner `LayoutEditor`. That
composition needs to target a **selected room**, and selecting a room is useful
well beyond furniture, so it is its own capability.

Three pieces:

- **0. Left panel system** — contextual tools live on the LEFT as a tabbed set (one
  visible at a time) driven by a tool registry; the WDL editor is the only RIGHT
  panel. Today's config + 2D-filters docks fold into it. This is the foundation the
  catalog plugs into.
- **A. Room selection** — one "selected room" in the app, settable and reflected
  from the 3D view, the 2D floor plan, and the WDL editor cursor.
- **B. Furniture catalog** — a LEFT tool that, for the selected room, shows the room
  canvas + the catalog and composes its `furniture` container as a draft, then
  Applies it to the model.

Part 0 is the foundation; A is valuable on its own; B builds on both.

### Explicitly out of scope (separate future track)

- Templates management, a library overlay, export, and **online module sharing /
  a curated-template marketplace**. That is its own design (how a `.wadi`'s
  `modules/` dependencies become shareable, and a possible revenue stream) and we
  will plan it separately.
- For now `wadi-dsl/std-modules/rooms.wdl` stays a special case edited **locally**.
- Composition is a **draft**: edits happen in the panel's room canvas and only
  reach the model on an explicit **Apply**, not live per-edit.
- The floor-planner `LayoutEditor` is left running for now, but B reuses its canvas
  and is the path to eventually retiring it.

---

## Part 0 — Left panel system (tabbed, extensible)

### Why

Contextual tools belong on the LEFT; the WDL editor is the only RIGHT panel. Today
there are two ad-hoc left docks — the configurator (`#viewer-config-dock`,
`body[data-config]`, `mountConfiguratorPanel()`, `main.ts:448`) and the 2D filters
(`#viewer-filters-dock`, `body[data-dim2d][data-filters]`, `#filters-toggle`) — each
with its own markup, CSS gating, and toggle. Adding the furniture catalog as a third
ad-hoc dock compounds the sprawl. Instead: ONE tabbed left dock with a tool
**registry**, so tools plug in and (later) become configurable.

### Design

- **One left dock**: `#viewer-left-dock` = a tab strip (`#viewer-left-tabs`) + a body
  (`#viewer-left-body`). Shown when the left panel is open (`data-left="open"`) and at
  least one tool is available. The existing `#left-toggle` pull-tab opens/closes it.
- **Tool registry** (`editor/src/viewer/leftPanels.ts`):
  ```ts
  interface LeftTool {
    id: string; label: string; icon?: string;
    available(ctx): boolean;                 // when its tab appears
    mount(body: HTMLElement, ctx): {         // build the panel body once
      update?(ctx): void; onShow?(): void; onHide?(): void; destroy?(): void;
    };
  }
  registerLeftTool(tool); getLeftTools();
  ```
  `ctx` = the app state tools need: active view (`2d` / `3d` / …), `selectedRoom`,
  `config`.
- **`mountLeftDock()`**: renders the tab strip from the AVAILABLE tools, keeps one
  active tool visible (mount on first show; `onShow` / `onHide` on switch),
  recomputes availability when app state changes (subscribe to the store + a
  view-change signal), and persists the active tool + open state in localStorage.
  When the active tool becomes unavailable (e.g. leave 2D with the filters tab
  open), fall back to the first available tool or collapse.

### Migration (behavior-preserving)

- Configurator → `registerLeftTool({ id:'config', available: has configurator inputs
  OR furnishable rooms, mount: <configurator body> })`.
- 2D filters → `registerLeftTool({ id:'filters', available: active view is 2D,
  mount: <filters body> })`.
- Their bodies move into the shared dock; the standalone `#viewer-config-dock` /
  `#viewer-filters-dock` and their separate toggles are removed. The `data-left`
  open/close + `#left-toggle` stay.

### Extensibility + config exposure (later)

- A new tool is one `registerLeftTool(...)` call — the furniture catalog is the first.
- Later: a config to enable / disable / reorder tools (like the per-type layer role
  prefs). The registry makes that a small add; not in scope now.

### Phasing (0)

- **0a** — the tabbed dock + registry + migrate config + filters (a refactor, no new
  tool, behavior preserved).
- The furniture catalog (Part B) then registers as the first NEW tool.

### Open questions (0)

- Tab affordance: text tabs vs icon tabs (space in a ~288px dock).
- Does any tool need to force itself open/active on an event (e.g. selecting a room
  auto-opens the furniture tool), or is switching always user-driven?

---

## Part A — Room selection (shared capability)

### Goal

A single `selectedRoom` that any of these three surfaces can set, and that all
three reflect:

1. **3D view** — click a room to select it.
2. **2D floor plan** — click a room to select it.
3. **WDL editor** — when the Monaco cursor is inside a room's block, that room
   becomes the selected room; and selecting a room elsewhere can reveal its block.

Selecting a room highlights it in 3D and 2D.

### Current state (refs)

- The store already has a `Selection` + `select()`
  (`editor/src/state/configStore.ts:14, 287`); rooms have a stable key
  `"${floorIdx}:${objIdx}"` and `interiorView.listRooms(config)` enumerates them
  (`editor/src/three/interiorView.ts:78-125`).
- 2D footprints / room shapes are drawn as anonymous SVG rects with **no
  per-object id** (`editor/src/svg2d/floorPlan.ts:762-765`) — hit-testing and
  highlight need an object-keyed id/class added there.
- 3D mounts `<House3D config>` (`editor/src/viewer/mount3D.tsx:146`); no room
  pick/raycast exists yet, only `enterRoom(key)` camera framing
  (`main.ts:2983`, `interiorView` `enter/exit`).
- WDL editor is Monaco + the in-process Langium LSP (`editor/src/viewer/wdlMonaco.ts`);
  the compiler is `wdlToConfig` (`editor/src/io/wdl.ts`).

### Design

- **Store**: a `selectedRoom` key (reuse/extend `Selection`), plus a subscribe so
  every surface re-renders its highlight.
- **2D**: give each room its object-keyed id/class in the floor-plan draw, add a
  click handler that sets `selectedRoom`, and a highlight style (outline / tint).
- **3D**: raycast the room floor/wall meshes on click, map the hit to the room
  object, set `selectedRoom`, highlight it (outline pass or material tint).
- **WDL**: on Monaco `cursorPositionChanged`, map the cursor offset to the
  enclosing room block and set `selectedRoom`; when a room is selected elsewhere,
  optionally scroll/flash its block. Needs an **object → source-range map**
  threaded out of `wdlToConfig` (the Langium AST nodes carry `$cstNode` offsets).

### Phasing (A)

- **A1** — `selectedRoom` in the store + 2D floor-plan click + highlight. Simplest,
  high value, unblocks B.
- **A2** — WDL cursor → room selection (needs the AST offset → object map) + reveal.
- **A3** — 3D click → room selection (raycast) + 3D highlight.

### Open questions (A)

- Threading per-object source ranges from the Langium parse through `wdlToConfig`
  so the cursor can resolve to an object (does anything already carry this? the
  LSP go-to-def suggests ranges are available).
- 3D highlight technique: outline pass vs a temporary material tint.
- Whether `selectedRoom` reuses the generic `Selection` or is a dedicated field
  (rooms need a distinct highlight from a selected wall/pillar/etc.).

---

## Part B — Furniture catalog (compose the room's furniture container)

### Goal

For the selected room, compose its `furniture` container in a **room
representation** like the current `LayoutEditor`: the room rect + inner wall face +
the nine anchor points + the existing furniture footprints, editable. Composition
happens in a **draft** — it does NOT reflect into the model on every edit. When
done, an explicit **Apply** writes the composed furniture into the model / WDL.

This lets us **reuse the `LayoutEditor` canvas** (already on wadi's anchor engine
after the refactor) instead of building a new composer, adapted to: seed from a
real model room, add the kitchen counter, and commit back to the model.

### Design

- **A LEFT tool** (registered in the Part 0 system, `id:'furniture'`, available when
  a room is selected) mounted as a React component in the left-dock body (the viewer
  already hosts React for R3F), reusing the `LayoutEditor` `Editor` canvas. The
  canvas + catalog want width, so the furniture tool may widen the left dock while
  active (see Open questions):
  - **Room canvas** — the selected room drawn to scale: outer rect + inner wall
    face + the nine `anchorPoints` + each furniture piece's footprint (rotated
    rectangle + facing tick). Click an anchor point to re-anchor the selected
    piece; drag a piece to set its gap; a small per-piece control for rotation
    (and, for a counter, length / depth / height + cabinet / sink / hob). Overlap
    and out-of-bounds are flagged in red with an "all clear / N issues" line —
    all already in the `LayoutEditor`, all on the wadi engine
    (`pieceFootprint` / `validateLayout` / `anchorPoints` / `gapForCenter`).
  - **Catalog browser** — `FURNITURE_CATALOG` grouped by `FURNITURE_CATEGORIES`
    (`editor/src/furniture/catalog.ts:61-214`), each entry its name (a GLB
    thumbnail later), plus a **Kitchen counter** entry. Click adds the piece to the
    DRAFT (anchor center), selected.
  - **Draft state** — the panel holds its own working copy of the room's furniture
    (seeded from the room on open). Edits mutate the draft only. Invalid drafts
    (overlap / out-of-bounds) can be blocked from Apply, same guard the
    `LayoutEditor` uses before it persists.

- **Seed** — on open, read the selected room's size + existing furniture
  (`room.furniture.items` / `counters`, falling back to `room.items`) into the
  draft.

- **Apply** — write the draft back into the model's room `furniture` container via
  `store().updateObject({floor, object}, { furniture })` (one undo step). Only then
  do the real 3D / 2D and the WDL text update. A "Cancel / discard" leaves the
  model untouched.

### Reuse

- The `LayoutEditor` `Editor` canvas (`floor-planner/src/components/LayoutEditor.jsx`)
  — the 2D room + anchor points + drag + validation, already React and already on
  wadi's anchor engine. Lifted into the app and adapted (seed from a model room +
  Apply back + counter + catalog). This is the path to eventually retiring the
  floor-planner `LayoutEditor`.
- Catalog: `catalog.ts` (`FURNITURE_CATALOG`, `FURNITURE_CATEGORIES`,
  `furnitureAsset(id)`).
- Counter: `editor/src/registry/nodes/counter.tsx` (`makeDefault`, `fields` /
  footprint capability, `counterToWdl`).
- Anchor + validation: `editor/src/furniture/autoplace.ts` (`pieceFootprint`,
  `validateLayout`) + `editor/src/svg2d/furnitureAnchor.ts` (`anchorByFootprint`,
  `anchorPoints`, `gapForCenter`, `anchorFacing`) — centralized.
- Model write: `configStore.updateObject`.

### Phasing (B)

- **B1** — the reused room canvas (anchor points + footprints + drag + validation)
  seeded from the selected room, GLB catalog add, draft state, and Apply-to-model.
  A working composer (drag included, since it comes with the canvas).
- **B2** — the kitchen counter as a catalog entry (draw its footprint in the
  canvas; edit length / depth / cabinet / sink / hob).
- **B3** (later) — nice-to-haves: GLB thumbnails, reorder, multi-select.

### Open questions (B)

- **Target container**: `room.furniture.*` (recommended — matches "compose the
  furniture container") vs `room.items`. The loader accepts either.
- **Left-dock width**: keep the standard ~288px and use a compact canvas, vs let the
  furniture tool widen the left dock while it is the active tab.
- Does a hand-composed container imply `auto` (engine-managed) or a plain
  `furniture { … }` (no `auto`)? A hand-composed set is not `auto`; a toggle could
  mark it auto-furnishable.
- The `LayoutEditor` is React/JSX in the floor-planner; the viewer is largely
  imperative TS. Lifting the canvas means either sharing the JSX component across
  both builds or moving it into `editor/src` and importing it in the floor-planner
  too (single source), which is the cleaner end state.

---

## Suggested build order

1. **0a** — the tabbed left dock + tool registry, migrating the config + 2D-filters
   panels into it (behavior-preserving refactor). Foundation.
2. **A1** — room selection via 2D click + highlight (unblocks choosing the room).
3. **B1** — the furniture tool: reused room canvas seeded from the selected room +
   catalog add + draft + Apply, registered as the first new left tool.
4. **B2** — the kitchen counter in the canvas.
5. **A2 / A3** — WDL-cursor and 3D-click selection, parallel and incremental.

## Non-goals recap

Templates, library/overlay, export, online sharing / marketplace, per-user runtime
template merge, and retiring the floor-planner `LayoutEditor` — all deferred to the
separate templates track.
