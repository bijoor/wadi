# Pascal adoption + Y‑up axes — assessment, blast‑radius, phased plan

Status: analysis complete, awaiting go on Phase 1. Date: 2026‑07‑26.

## 0. Purpose

Two linked questions:

1. Can we use **pascalorg/editor**'s plugin architecture + native objects to add
   object capabilities to Wadi faster (we have very few native objects)?
2. Should we move Wadi off its **Y‑down** plan convention to a conventional
   **Y‑up** model — for Pascal *and* for CAD interop (DXF/IFC)?

Source studied: `~/Code/pascalorg-editor` (cloned). Two deep code studies were
run against it (2D/parametric capability; plugin/node internals).

---

## 1. Pascal at a glance

- MIT‑licensed across all packages; published to npm as `@pascal-app/{core,viewer,editor,nodes,mcp}`.
- Bun/Turbo monorepo, a 3D architectural editor. **Meters, Y‑up** (three.js), plan on X‑Z.
- Layering (from `AGENTS.md`):
  - `core` — scene graph, node **schemas (Zod)**, stores (Zustand), registry — *pure logic, no three.js*.
  - `viewer` — the 3D canvas: react‑three‑fiber + three (0.185) + drei. Framework‑agnostic React.
  - `editor` — editor UI + the 2D floor‑plan mode + sheet/PDF export. **Peer‑deps Next.js 15 + 9 Radix packages + a private i18n pkg + pdfkit.**
  - `nodes` — the built‑in objects, shipped as the `pascal:core` plugin.
  - `mcp` — MCP server for AI scene manipulation; `ifc-converter` — IFC→scene (pure, `core`+`web-ifc`).

## 2. Plugin architecture + node model (the genuinely good part)

A plugin is pure data: `{ id, apiVersion:1, nodes: NodeDefinition[] }`, loaded at boot
(`loadPlugin`, `setPluginDiscovery`). One **`NodeDefinition`** bundles an entire
object in a single unit:

- `schema` (Zod) · `defaults` · `capabilities` · `category`
- `parametrics` — inspector‑field descriptors (UI metadata; **not** a computation engine)
- `geometry` — **pure** `(node, ctx) => THREE.Object3D` — OR `renderer` (R3F component)
- `floorplan` — **pure** `(node, ctx) => FloorplanGeometry` (SVG‑primitive *data*, for the 2D layer)
- `tool` / `affordanceTools` (placement/move) · `presentation` (palette/icon) · `mcp` (AI hints) · `system` (per‑frame)
- `relations` / `computeLevelData` (sibling lookups, batching)

Built‑ins use the exact same shape as third‑party plugins. This is the "add an
object once → get 3D + 2D + inspector + AI + placement" pattern we want.

Serialization: a **flat node map** — `{ nodes: Record<id,Node>, rootNodeIds, installedPlugins }`
forming a graph via `parentId` + per‑node `children[]`. Different from Wadi's
`floors[ objects[] ]`.

## 3. Native object catalog (47 kinds, `packages/nodes/src/<kind>/`)

- **Site/org:** site, building, level, zone, spawn, guide, scan.
- **Structure:** wall, slab, ceiling, column, fence, stair(+segment), elevator, structural‑grid; openings door(+segment)/window (hosted on wall, CSG‑cut); roof(+segment) + accessories: box/ridge/turbine/eyebrow vent, cupola, chimney, skylight, dormer, solar‑panel, gutter, downspout.
- **Furnish:** item (GLB catalog furniture), shelf, cabinet(+module).
- **Utility (MEP, typed ports):** duct‑segment/fitting/terminal, hvac‑equipment, lineset, liquid‑line, pipe‑segment/fitting/trap.
- **Analysis/docs:** measurement, construction‑dimension, drawing‑sheet.

**House‑relevant + additive to Wadi (mostly pure geometry, worth porting):** roof
accessories (chimney, skylight, dormer, vents, cupola, gutter, downspout, solar),
columns (cross‑sections/capitals), cabinets, GLB furniture (`item`), fence,
elevator, structural‑grid, dimensions/drawing‑sheet.

## 4. Verdict — Pascal's 2D CANNOT replace svg2d → keep svg2d

- Drawing types are a closed enum: `floor-plan | foundation-plan | reflected-ceiling-plan | roof-plan | site-plan`. **No elevations, no sections, no orthographic projections** as generated output (only elevation/section *callout bubbles* pointing at drawings Pascal can't produce).
- **No SVG file output** — only **PDF**, and it's **not headless**: it needs a live browser DOM (`createRoot`, `getBBox`, `requestAnimationFrame`) + editor Zustand stores.
- The whole 2D assembler/renderer/exporter lives in `@pascal-app/editor` (Next 15 + Radix + private i18n + pdfkit). Only the `FloorplanGeometry` *data type* (`core`) and the ~38 per‑node `floorplan()` builders (`nodes`) are reusable.

Wadi's svg2d is a **headless, multi‑projection (plan + elevation + section + roof)
SVG generator** — a different, more capable documentation product. Do not scrap it.
Worth *borrowing as ideas* (Phase 5): the `FloorplanGeometry` data contract, and
the **drawing‑sheet / schedules / keyed‑notes** model (Wadi has no plotting/sheet
layer — a genuine gap).

## 5. Verdict — Pascal has NO parametric engine → keep ours

- Whole‑repo grep: **no formula/expression engine, no named variables, no topological resolver, no shared parameter table.** `parametrics` is inspector‑field metadata + imperative per‑kind co‑update hooks (`derive`/`reconcile`); recompute is a dirty/re‑render cascade, not value recomputation.
- Model is the **inverse of Wadi's**: **walls are explicit line objects; rooms are *detected* from wall loops** (`zone.autoFromWalls`, `space-detection.ts`). Wadi is room‑first (room → 4 walls, re‑flowed by formulas).

Wadi's `param/` formula engine + room→walls (`expand`) is a real moat Pascal lacks.

## 6. Compatibility + what's actually reusable

Stacks align unusually well: **both are React + @react-three/fiber + three 0.185 +
three‑bvh‑csg + Zustand + Zod.** So porting Pascal's **pure `geometry()`/`floorplan()`
functions** into Wadi is mechanical (modulo a coordinate/unit transform). What is
NOT reusable: `@pascal-app/editor` (Next‑bound), their scene model wholesale (would
lose formulas + room→walls), their 2D pipeline.

**"How much of Wadi does Pascal replace?" → ≈ none wholesale.** Pascal is a
**native‑object geometry source + architectural blueprint**, not an engine swap.
This kills the "re‑platform onto Pascal" path.

## 7. Wadi code size (context for the above)

Total ≈ 37.3K LOC (excl. tests). Biggest subsystems:

| Subsystem | LOC | Share | Fate |
|---|---:|---:|---|
| svg2d (2D engine + roof + pillar) | 17.7K | 47% | **keep** (Pascal can't replace) |
| three (3D renderers) | 5.7K | 15% | keep; *augment* with ported Pascal geometry |
| forms (property panels) | 4.5K | 12% | keep |
| viewer (shell/gallery/personas/R2) | 3.9K | 11% | keep |
| param (formula engine) | 0.85K | 2% | **keep** (differentiator) |
| schema/estimate/io/state | ~2.8K | 8% | keep |

---

## 8. Axis/units — blast‑radius of an internal Y‑up migration

Scope clarifier: elevation is **already Z‑up** (`z_offset`, heights, floor stacking).
This is only a **plan‑Y flip** (Y‑south‑down → Y‑north‑up). Still wide:

1. **Coordinate fields:** `y` (plinth/ground/room/floor_slab/beam/pillar/door/window), `start_y`/`end_y` (wall), `start_y` (staircase), `reference_y` (site), `path[][1]` (kitchen), top‑level `points.y`, roof segment `end_y`. Object‑type‑aware: rect‑anchored need `y' = plotL − y − length`; point objects need `y' = plotL − y`.
2. **expand.ts** — room→wall/opening math (`y = ry + rl`, side offsets, `offsetObjects`) assumes Y grows south → sign flips.
3. **2D SVG renderers** (floorPlan, elevationView+All/Combined, dimensions, compositeSheet, pillar, drawFilter). Catch: SVG is Y‑down and **text can't be group‑flipped**, so each renderer must flip Y *per coordinate* → the SVG layer gets *more* complex, not less. (This is why Y‑down was originally chosen — Inkscape parity.)
4. **Roof engine** — `svg2d/roof/v2/*` + legacy + 3D roof meshes are deeply orientation‑coded (`"+Y = south"`, `left/right = ±Y`, `slope_dir north/south/east/west`, hip setbacks) with ~20 **parity tests**. Every one inverts.
5. **3D** — coords.ts (`worldY→threeZ` sign), House3D, roof meshes, staircase, wallCSG, boxes.
6. **estimate/wallArea** — N/S/E/W external/internal classification uses Y direction.
7. **Parametric formulas** — templates encode Y‑down (`y = House.L − pillarT`, roof `end_y = House.L`, `hip_setback`). Re‑express under Y‑up.
8. **File migration** — every `.wadi` (repo, `library/`, the R2 catalog, share links, user files).
9. **~40 test files** with baked coordinate/orientation expectations.

Cost: **large + high‑risk**, hitting the two most valuable/tested assets (the
dimensioned drawings and the roof engine), and it does *not* simplify the code.
Weeks, not days.

**Key export‑layer insight:** an *export‑boundary* flip operates on **resolved
outline geometry (corner polylines)**, so the anchor re‑derivation headache
(#1) and the roof orientation recoding (#4) largely disappear — you flip finished
coordinates, not the model's semantics. This is why Phase 1 (below) is cheap and
de‑risks the eventual internal migration.

---

## 9. Strategic conclusions

- **Keep** svg2d, the formula engine, and the room→walls model (Wadi's moat).
- Use Pascal as an **object‑geometry source + pattern blueprint**, not an engine swap.
- **Y‑up is right long‑term but not urgent** — because we're porting geometry, not
  adopting Pascal's runtime, a per‑object flip (from a canonical layer) suffices.
- Deliver CAD interop (DXF/IFC/glTF) via an **export‑boundary transform** now; defer
  the internal migration until geometry‑sharing volume justifies retiring the flip.

## 10. Phased plan

Priority: **get Pascal objects into Wadi — GLB furniture first.** DXF/glTF/IFC
exporters are deferred (future support only). The long‑term arc (object registry →
eventual Y‑up) is preserved but sequenced *behind* the object priority.

**Why furniture, not structure (audience call):** Wadi targets **local, material‑
specific vernacular homes — Konkan first, extensible to other regional architectures.**
Pascal's *structural* catalog (columns, MEP ducts/pipes, Western stairs/elevators,
roof accessories, structural grids) encodes **Western construction standards that
largely don't map to our idiom** — so those are low priority. Pascal's **`item`
(GLB furniture)** node is the opposite: it's **decor, style‑neutral, and universally
applicable**, and it's the fastest way to make our models *look* finished (populate
rooms with beds/tables/chairs/etc.). That is the near‑term win.

- **Phase 1 — Port Pascal's `item` (GLB furniture) into Wadi (NOW).** A new `item`
  object that loads a GLB asset and places it (`x`/`y`/yaw/scale/`z_offset`), a small
  **curated furniture catalog** (CC0 assets) + optional user‑GLB import, a picker in
  the form, and a 2D footprint symbol in plans. This is where the **meters→units +
  Y‑up→Wadi placement adapter** is genuinely needed (GLBs are authored in metres,
  Y‑up). Reference: Pascal `packages/nodes/src/item/*` + core `schema/nodes/item.ts`.
  See §11.
- **Phase 2 — Object registry (Path B).** Refactor per‑type dispatch into a
  `nodeRegistry` where each object = `{schema, geometry, svg2d, form, expand}`
  (blueprint: Pascal `NodeDefinition`); migrate `item` + 1–2 existing objects into it.
  Makes every subsequent port a **one‑file drop**. Current (Y‑down) convention.
- **Phase 3 — Selective structural ports (lower priority, only what fits Konkan).**
  Through the registry + adapter, port *only* objects that suit the vernacular idiom
  and read as a clear win — e.g. **chimney** (pitched‑roof masonry), maybe **skylight**.
  Explicitly **skip** the Western‑standard set (MEP, structural‑grid, elevator,
  Western roof accessories) unless a concrete house needs them. Incremental, MIT‑clean.
- **Phase 4 — Internal Y‑up migration (deferred, gated).** Long‑term "inevitable" but
  not urgent — we're *porting geometry*, not adopting Pascal's runtime, so the
  placement adapter's flip suffices per‑object. Trigger only when geometry‑sharing
  volume or CAD interop justifies retiring the flip. Reuses the adapter's transform +
  a parity harness + the object‑type‑aware migration (§8).
- **Phase 5 — Future support (deferred).** Exporters: **DXF / glTF / IFC** via a
  `sceneToCanonical` boundary transform (flip plan‑Y + units→meters — the same
  transform as P4; kept as the spec in §12 for when it's wanted). Plus Pascal *ideas*:
  drawing‑sheet + schedules + keyed/general‑notes (Wadi has no plotting layer), the
  `FloorplanGeometry` data‑contract to modernize svg2d internals, and **IFC import**
  (`ifc-converter` is standalone).

---

## 11. Phase 1 spec — GLB furniture (`item`)

Goal: populate Wadi models with furniture/decor so rooms *look* finished. Add an
`item` object that loads a GLB and places it. This is an **asset‑loading + placement**
capability, not parametric geometry — so the port is: schema + GLB loader + a curated
catalog + a picker form + a 2D footprint. The **meters→units + Y‑up placement adapter**
is genuinely needed here (GLBs are metric, Y‑up).

### 11.1 Reference (Pascal `item`)
- `packages/core/src/schema/nodes/item.ts` — the model: an instance carries
  `position/rotation/scale`; an embedded `asset = { id, name, thumbnail, src (GLB URL),
  dimensions:[w,h,d] metres, floorPlanUrl?, corrective offset/rotation/scale,
  attachTo?, surface? , tags }`.
- `packages/nodes/src/item/model-loader.ts` — a `GLTFLoader` subclass with retry
  (408/429/5xx) + an "unavailable" placeholder GLTF so a dead asset never blanks the
  scene. Borrow this robustness pattern.
- `packages/nodes/src/item/{floorplan.ts,renderer.tsx,tool.tsx,panel.tsx}` — 2D
  footprint (with optional top‑down `floorPlanUrl` image), 3D mount, placement tool,
  catalog panel.
- **Trim for v1:** drop wall/ceiling attachment (`attachTo`, `wallId`, `roofSegmentId`),
  support‑slab election, MEP `interactive` controls, per‑slot material overrides.
  Floor‑placed furniture only.

### 11.2 Asset source — DECIDED: curated CC0 set on R2 + user import
Pascal's GLBs are **server‑hosted, not in the MIT repo** — we supply our own. Chosen path:
a small **curated CC0 furniture set** (Kenney / Quaternius / Poly Pizza — CC0, safe to
host) **hosted on R2** reusing the `templateSource` infra + a `furniture/index.json`
catalog, **plus user‑GLB import** (drag a `.glb` → host/embed, add under "Mine"). Konkan/
regional pieces get added to the same catalog over time. Reuse `scripts/publish-templates.sh`
pattern for a `publish-furniture.sh`; `.env.r2` already holds the account‑level token.

### 11.3 Wadi implementation
- **Schema** (`schema/houseConfig.ts`): new `item` member —
  `{ type:"item", asset_id (catalog ref) | asset (embedded def), x, y, rotation? (yaw°),
  scale? (uniform, default 1), z_offset?, layer?, enabled?, name?, formulas? }` (`.strict`).
  `asset` def = `{ id, name, src, dimensions:[w,h,d] metres, thumbnail?, floorPlanUrl?,
  offset?, corrRotation?, corrScale? }`.
- **Units adapter** (`three/units.ts`, tiny): `metersToUnits(m, house) = m / metersPerUnit(house)`
  (formula §12.1). The GLB group is scaled by `1/metersPerUnit` so a 2 m sofa reads at
  the right size in Wadi's project‑unit world.
- **3D** (`three/FurnitureItem.tsx`): drei `useGLTF(src)` under `<Suspense>`; apply the
  asset's corrective `offset/rotation/scale`; scale by `metersToUnits`; place via
  `toThreePos` (`three/coords.ts`) at `(x,y)` + floor‑band base + `z_offset`; apply user
  `rotation` (yaw) + `scale`. Wadi's three world is Y‑up (`toThreePos` maps ThreeY=worldZ),
  so a Y‑up GLB drops in upright — only footprint placement + metric scaling needed.
  Wrap with the retry/placeholder loader pattern so a missing GLB shows a ghost box, not
  a crash. Dispatch from `House3D`'s per‑type switch; `useGLTF.preload` + dispose.
- **2D footprint** (`svg2d/floorPlan.ts` `svg_draw_item`): draw `dimensions [w,d]` as a
  rectangle at `(x,y)` rotated by yaw, with a name label; (later: embed `floorPlanUrl`
  top‑down image). Runs inside the flatten path so plans/composites pick it up.
- **Form** (`forms/ItemForm.tsx`): a **catalog picker** (thumbnail grid from
  `furniture/index.json`, filter by category/tags) + placement (`x`/`y`/`rotation`/`scale`
  via `ObjectMeasureField`) + `enabled` + layer. Default new items into a **Furniture**
  layer (`layers.ts`).
- **Add‑menu + palette**: `defaultFactory.makeDefault("item")` (first catalog asset at
  plot centre) + Sidebar `TYPE_ORDER`/`TYPE_LABEL` + `AddableObjectType`; optionally a
  small furniture palette (Pascal's Items tab, slimmed) for pick‑to‑place.

### 11.4 Tests
`houseConfig` accepts an `item`; a fixture house with one item resolves + expands
(`expandRoomWalls`, lenient); loader falls back to the placeholder on a bad `src`
(unit‑test `classifyItemModelLoadFailure`‑style logic if ported).

### 11.5 Done‑when
In the app: open a template, pick a bed/table/chair from the catalog, see it render in
3D on the floor at correct size, edit position/rotation/scale live, and see its footprint
in the floor plan. Furniture toggles under "Show/hide layers".

### 11.6 Feeds forward
Establishes the GLB asset pipeline (catalog + R2 host + user import + metric adapter) and
the `item` object's fit into Wadi's schema/3D/2D/form/layers — the surface Phase 2's
registry formalizes, and the base for further furniture/decor.

---

## 12. Deferred (Phase 5) — `sceneToCanonical` + exporters (DXF / glTF / IFC)

Kept as a ready spec for when CAD/BIM export is wanted (**not now**). A headless
boundary transform → a **conventional CAD scene** (meters, plan Y‑up/north, Z‑up)
feeding DXF/glTF/IFC. New code only; the plan‑Y flip here is the same transform
Phase 4's internal migration would use.

### 11.1 Target canonical convention
- Length unit: **meters**. There is **no** `units_to_meters_ratio` in the TS editor
  (that was the retired Blender path). Physical scale comes from `house.units`:
  `metersPerUnit = (FEET_PER_DISPLAY_UNIT[system] × 0.3048) / per_unit`, reusing the
  `FEET_PER_DISPLAY_UNIT` map already in `three/procTextures.ts` / `three/interiorView.ts`
  (`{ feet_inches:1, feet:1, meters:3.280839895, centimeters:0.032808399, millimeters:0.003280839 }`).
  Defaults: `system = "feet_inches"`, `per_unit = 10` → `metersPerUnit = 0.3048/10·1 = 0.03048`
  (so the default 450×270‑unit plot = 45×27 ft ≈ 13.72×8.23 m — physically correct).
  A `system:"meters"`, `per_unit:100` project → `metersPerUnit = 3.2808·0.3048/100 = 0.01`.
- Plan axes: **X east (+), Y north (+, up)**. Elevation: **Z up (+)**.
- Transform per plan point (r = `metersPerUnit`, `plotLength` in project units from
  `site.plot_length`): `X_m = x·r`, `Y_m = (plotLength − y)·r`. Extents/lengths: `·r`
  (no flip). Elevation: `Z_m = z·r` where z from `computeFloorZBands` + `z_offset`
  (already Z‑up).
- Origin: SW corner at (0,0) after flip. (Optional: recenter at plot midpoint — leave off for CAD.)
- Confirmed available: `expandRoomWalls` (`svg2d/expand.ts:91`), `computeFloorZBands`
  (`three/coords.ts:44`), and `saveText`/`serializeConfig` (`io/fileIO.ts`) for the UI.

### 11.2 Module: `editor/src/export/canonical.ts`
```ts
export interface CanonicalScene {
  units: "meters";
  up: "z";                       // Z-up, plan on X-Y (Y north)
  plot: { width: number; length: number }; // meters
  objects: CanonicalObject[];    // resolved, flattened, meters, Y-up
}
export interface CanonicalObject {
  id: string; type: string; name?: string; layer: string; floor: number;
  // 2D plan footprint as closed/open polylines (meters, Y-up):
  outlines: Array<Array<[number, number]>>;
  // vertical band (meters), for 3D/DXF-3D and future glTF/IFC:
  z: { base: number; top: number };
  meta?: Record<string, unknown>;
}
export function houseToCanonical(house: HouseConfig): CanonicalScene;
```
Implementation notes:
- Reuse `expandRoomWalls(house, { lenient:true })` to get flat, resolved objects
  (rooms already expanded to walls, components expanded, formulas resolved).
- Reuse `computeFloorZBands` for `z.base/top` per floor.
- Derive each object's `outlines` from its resolved plan geometry (wall = 2 endpoints
  → thick polyline via thickness; room/slab/pillar/beam = 4 corners; kitchen = path;
  door/window = opening rect on host wall). Reuse existing corner math where cheap;
  otherwise a small per‑type outline builder (this also seeds Phase 5's data contract).
- Apply the flip/scale on every emitted coordinate — **on the corners**, so anchor
  convention is irrelevant.

### 11.3 First exporter: `editor/src/export/dxf.ts`
```ts
export function houseToDxf(house: HouseConfig, opts?: { filter?: DrawFilter }): string;
```
- Consume `houseToCanonical`. Emit a minimal, valid **DXF R12 ASCII** (widest
  compatibility, no binary): `HEADER` (INSUNITS=6 meters), `TABLES` (one LAYER per
  Wadi layer/type + colors), `ENTITIES`:
  - object outlines → `LWPOLYLINE` (closed) on the object's layer;
  - openings → `LINE`/`LWPOLYLINE`;
  - room names / dims → `TEXT` (Y‑up, so text is upright in CAD).
- Pure string; no DOM. Layer names mirror Wadi's visibility layers/types.

### 11.4 UI (optional, small)
- Architect‑only "⬇ DXF" button on the **Floor Plans / Layout** tab → `houseToDxf` →
  save via the existing `saveText`/Tauri dialog (reuse `io/fileIO`).

### 11.5 Tests
- `canonical.test.ts`: for a known template, assert a specific object's outline in
  meters + Y‑up (e.g. a north‑edge wall lands at high Y), and that `plot` = plot·r.
- `dxf.test.ts`: `houseToDxf` output contains expected `LAYER`/`LWPOLYLINE`/`TEXT`
  and parses as valid DXF (structural assertions; optionally a dxf parser dep).

### 11.6 Fast‑follow (Phase 1b)
- `houseToCanonical3D` (neutral mesh list or a headless three scene) → **glTF/GLB**
  exporter (three `GLTFExporter`) for 3D interop and Pascal‑geometry round‑tripping.

### 11.7 Done‑when
- `houseToDxf(templates)` opens correctly in a CAD viewer (LibreCAD/AutoCAD), plan
  north‑up, at real metric scale; tests green; svg2d/roof/3D untouched.
</content>
</invoke>
