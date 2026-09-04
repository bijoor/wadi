# Wadi data model (`.wadi` / `house_config.json`)

> **Generated from `editor/src/schema/houseConfig.ts` — do not edit by hand.**
> Regenerate: `node scripts/gen-schema-doc.mjs <path/to/houseConfig.ts> reference/data-model.md`
> Some primitives (beam, floor_slab, pillar, plinth, ground) are generated from their
> `fields` (schema/fields/\*) into generated/objects.generated.ts — run `npm run gen-primitives`
> in editor/ first if you changed those, so the generated schemas (which this doc reads) are current.
> The Zod schema is the single source of truth; this file mirrors it (structure + the
> semantics carried in its comments) so it can't drift.

A `.wadi` file is one JSON object matching **HouseConfig**. Geometry is in **project
units** (a unitless grid; by default `units.per_unit = 10` means 10 units = 1 ft).
Plan coordinates are **Inkscape-style**: origin top-left, **X → right, Y → down**.
See `coordinate-system.md` for the coordinate/units detail and `parametric-conventions.md`
for variables/points/formulas.

## Fields shared by (almost) every object

These appear on most object types; documented once here, marked *(cross-cutting)* below.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `room` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  |  |
| `enabled` | boolean or number (`false`/`0` = hidden) |  |  |
| `layer` | string |  |  |
| `name` | string | **yes** |  |
| `material` | string |  |  |
| `z_offset` | number |  | Vertical position of the room (its floor + walls), as a lift above the FLOOR BASE (slabZ = plinth top for floor 0, else the floor below's top; project units, 10 = 1 ft). This is the UNIFIED z_offset convention: every object is placed at `slabZ + z_offset`. When OMITTED, on-slab objects (room, wall, staircase, kitchen_platform) default z_offset to the floor's resolved slab thickness (floor.slab_thickness → house.defaults.slab_thickness → code default), so by default they sit on top of the slab, exactly as before. Set it explicitly for split-level floors — e.g. a room raised onto a thicker slab uses the same value the raised slab's top sits at. |


- `type` — the discriminated-union tag; selects the object shape (values below).
- `formulas` — per-field `"= expression"` overrides; the resolver evaluates each into the
  matching numeric field. See `parametric-conventions.md`.
- `z_offset` — vertical lift above the floor base (slab top). On-slab objects (room, wall,
  staircase, kitchen_platform) default it to the floor's slab thickness; slab/beam/pillar/
  roof default to 0.

## Top level — HouseConfig

| field | type | req | notes |
|---|---|---|---|
| `coord_convention` | enum: `outer` `center` |  | How a rectangular object's x/y/width/length relate to its walls (plans/grid-convention.md). "center" (new/canonical): coordinates are wall CENTRELINES — adjacent rooms ABUT on a shared line (no overlap), walls are centred on the boundary, and expandRoomWalls grows each footprint by wall_thickness/2 to the outer face. "outer" / absent (legacy): coordinates are the OUTER wall face and adjacent rooms must overlap by wall_thickness. |
| `plinth` | any (freeform) |  | Legacy top-level plinth (pre-"Plinth floor"). Tolerated but IGNORED so an un-migrated file still loads (it just renders without a plinth/ground) instead of failing .strict() validation. New configs put the plinth on the Plinth floor as a `plinth` object. |
| `defaults` | [houseDefaults](#housedefaults) |  |  |
| `units` | [units](#units) |  |  |
| `layers` | array of [LayerDef](#layerdef) |  | Configurable 3D visibility layers (optional; defaults applied when absent). Objects opt in via their own `layer` field. |
| `variables` | map: string → number, or `"= formula"` string |  | Parametric layer (plans/object-relationships-plan.md). Named scalar variables (number or "= formula", may reference other variables) and named 2D points; object `formulas` maps reference these. Optional — absent = a plain non-parametric house, resolved as a no-op. |
| `points` | map: string → inline object |  |  |
| `components` | map: string → [ComponentDef](#componentdef) |  | Reusable-component library (in-file). Map of id → ComponentDef. A `component` object instantiates one by `ref`. Stored once; referenced by many instances; edit here to update every instance. |
| `guides` | map: string → `guidesDef` |  | First-class parametric GUIDES (plans/floor-planner-graph-integration.md). Map of id → a named XOR generated guides object; objects place themselves by referencing a guide in ordinary formulas (`main.x2`, `module.x8`). Optional; reusable across templates. `grids` is the deprecated former name — still read for backward-compat; the resolver merges both (guides wins on collision). |
| `grids` | map: string → `guidesDef` |  |  |
| `configurator` | [configurator](#configurator) |  | Configurator metadata (Gharkul owner UI). Optional; see plans/configurator-plan.md. |
| `thumbnails` | array of string |  | Preview snapshots (data: URLs) captured by the architect editor and saved WITH the template so the owner gallery can show real previews — multiple angles + the floor plan. `thumbnails[0]` is the gallery cover. Optional; excluded from share links (a preview isn't model data — see io/shareLink.ts). `thumbnail` (singular) is the legacy one-image form, still read as a fallback so old template files keep working. |
| `thumbnail` | string |  |  |
| `template` | inline object |  | Catalog metadata that makes a `.wadi` SELF-DESCRIBING: the editorial fields a gallery card needs that can't be derived from geometry (title, blurb, style/roof tags, min plot). With this block + `thumbnails[]`, a folder of `.wadi` files IS the catalog — the app lists the folder and indexes each file, with no separate index.json to maintain (see io/templateSource.ts). Non-strict so newer editorial fields don't break an older build. |
| `floors` | array of [floor](#floor) | **yes** |  |
| `_walls_expanded` | boolean |  |  |


## floor

| field | type | req | notes |
|---|---|---|---|
| `floor_number` | integer ≥ 0 | **yes** |  |
| `name` | string | **yes** |  |
| `height` | number > 0 |  | Per-floor overrides for the default heights in GlobalConfig. In project units (10 units = 1 ft). All three are INDEPENDENT — no relationship enforced between them: height — floor-to-floor rise (drives roof wallTop-Z stack) wall_height — standing wall height (floor top → ceiling) slab_thickness — RCC deck between this floor and the one above All fall back to GlobalConfig defaults when omitted. |
| `wall_height` | number > 0 |  |  |
| `slab_thickness` | number ≥ 0 |  |  |
| `formulas` | map: field name → `"= formula"` string |  |  |
| `enabled` | boolean or number (`false`/`0` = hidden) |  |  |
| `objects` | array of [Object types](#object-types) | **yes** |  |


## Object types (`floors[].objects[]`)

Every entry in a floor's `objects` array is one of these, tagged by `type`:

### `plinth`

The plinth is now a normal object placed on the "Plinth" floor (the first floor, number 0), not a top-level config key. Its footprint + height match the old top-level plinth; the plinth floor's `height` drives the rise to the floor above (replacing the old hardcoded plinth_height seed).

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `plinth` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  | Label |
| `material` | string |  | Material key |
| `x` | number | **yes** | Top-left X (project units) |
| `y` | number | **yes** | Top-left Y (project units) |
| `width` | number > 0 | **yes** | X extent (project units) |
| `length` | number > 0 | **yes** | Y extent (project units) |
| `height` | number > 0 | **yes** | Plinth height (project units) |
| `z_offset` | number |  | Lift above ground (project units) |


### `ground`

The ground plane, also on the Plinth floor. Extent defaults to the site plot when authored by the migration. `height` is an optional thickness (0 = a flat plane); slope fields are a later phase.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `ground` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  | Label |
| `material` | string |  | Material key |
| `x` | number | **yes** | Top-left X (project units) |
| `y` | number | **yes** | Top-left Y (project units) |
| `width` | number > 0 | **yes** | X extent (project units) |
| `length` | number > 0 | **yes** | Y extent (project units) |
| `height` | number ≥ 0 |  | Thickness (0 = flat) (project units) |
| `z_offset` | number |  | Lift above origin (project units) |


### `component`

An INSTANCE of a reusable component from the in-file `components` library. It references a component by id (`ref`), overrides the component's input variables via `params`, and places it at (x, y) with a `z_offset` lift on its parent floor. At render time `expandRoomWalls` flattens it into concrete objects (resolve component with param+origin overrides → recurse → offset), so no renderer needs to know about `component`.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `component` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  |  |
| `ref` | string | **yes** |  |
| `params` | map: string → union — see notes |  | Overrides for the component's declared input variables. A string starting with "=" is a formula evaluated in the HOST scope (so it can reference the host's variables/points); a number is used directly. |
| `x` | number | **yes** |  |
| `y` | number | **yes** |  |
| `rotation` | number |  | Standard placement: yaw° about the instance origin (clockwise, same sense as item rotation: 0=south, 90=east). Right angles (0/90/180/270) are exact for any component; a non-right angle is allowed only for furniture-only ones. |
| `z_offset` | number |  |  |


### `item`

A free-standing GLB furniture / decor instance placed directly on a floor (for pieces that aren't inside an enclosed room — outdoor/site/verandah decor, a loft item, etc.). `x`/`y` are the item's plan CENTRE. It MAY instead anchor to a named room via `anchor_to` + `anchor` + `gap`, in which case `x`/`y` are DERIVED at expand time (same anchor model as room-nested items). `rotation` is yaw°; `scale` is a uniform resize; `z_offset` lifts it above the floor base (default = slab thickness). (`itemAsset`, `itemAnchor`, `gapField` are defined above `room`.)

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `item` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  |  |
| `asset` | [ItemAsset](#itemasset) | **yes** |  |
| `x` | number | **yes** |  |
| `y` | number | **yes** |  |
| `rotation` | number |  |  |
| `scale` | number > 0 |  |  |
| `z_offset` | number |  |  |
| `anchor_to` | string |  | Optional room-relative anchoring (for a free item that should follow a room). |
| `anchor` | [ItemAnchor](#itemanchor) |  |  |
| `gap_x` | number |  |  |
| `gap_y` | number |  |  |


### `model`

A GLB placed at real scale and manipulated by a `rig` of named-node ops. Distinct from `item` (furniture, catalog + anchoring): `model` is a rigged structural asset. `asset.dimensions` is the real metre size, used for the 2D footprint and the scale.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `model` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  |  |
| `asset` | [ItemAsset](#itemasset) | **yes** |  |
| `x` | number | **yes** |  |
| `y` | number | **yes** |  |
| `rotation` | number |  |  |
| `scale` | number > 0 |  |  |
| `z_offset` | number |  |  |
| `rig` | array of `rigOp` |  |  |


### `floor_slab`
| field | type | req | notes |
|---|---|---|---|
| `type` | literal `floor_slab` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  | Label |
| `x` | number | **yes** | Top-left X (project units) |
| `y` | number | **yes** | Top-left Y (project units) |
| `width` | number > 0 | **yes** | X extent (project units) |
| `length` | number > 0 | **yes** | Y extent (project units) |
| `thickness` | number ≥ 0 |  | Slab thickness (defaults to floor's) (project units) |
| `z_offset` | number |  | Lift above floor base (project units) |


### `pillar`
| field | type | req | notes |
|---|---|---|---|
| `type` | literal `pillar` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string | **yes** | Label |
| `x` | number | **yes** | Top-left corner X (project units) |
| `y` | number | **yes** | Top-left corner Y (project units) |
| `width` | number > 0 |  | X extent (project units) |
| `length` | number > 0 |  | Y extent (project units) |
| `height` | number > 0 | **yes** | Column height (project units) |
| `z_offset` | number |  | Lift above floor base (project units) |


### `beam`
| field | type | req | notes |
|---|---|---|---|
| `type` | literal `beam` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  | Label |
| `x` | number | **yes** | Top-left X (project units) |
| `y` | number | **yes** | Top-left Y (project units) |
| `width` | number > 0 | **yes** | X extent (project units) |
| `length` | number > 0 | **yes** | Y extent (project units) |
| `height` | number > 0 |  | Vertical thickness (project units) |
| `z_offset` | number |  | Lift above floor base (project units) |


### `room`
| field | type | req | notes |
|---|---|---|---|
| `type` | literal `room` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string | **yes** |  |
| `x` | number | **yes** |  |
| `y` | number | **yes** |  |
| `width` | number > 0 | **yes** |  |
| `length` | number > 0 | **yes** |  |
| `height` | number ≥ 0 |  | 0 accepted — semantically the same as absent ("use floor default"). Old configs that accidentally saved height: 0 keep loading; the form treats 0 as "no override" and doesn't write it back. |
| `material` | string |  |  |
| `connections` | array of string |  | Rooms this room connects to, by name (same floor). Design intent + a functional test (constraint C11): a declared connection must be adjacent AND joined by a door. Symmetric and deduped; NOT geometry — it never moves or sizes anything, and the renderer ignores it. |
| `z_offset` | number |  | Vertical position of the room (its floor + walls), as a lift above the FLOOR BASE (slabZ = plinth top for floor 0, else the floor below's top; project units, 10 = 1 ft). This is the UNIFIED z_offset convention: every object is placed at `slabZ + z_offset`. When OMITTED, on-slab objects (room, wall, staircase, kitchen_platform) default z_offset to the floor's resolved slab thickness (floor.slab_thickness → house.defaults.slab_thickness → code default), so by default they sit on top of the slab, exactly as before. Set it explicitly for split-level floors — e.g. a room raised onto a thicker slab uses the same value the raised slab's top sits at. |
| `walls` | union — see notes |  |  |
| `wall_heights` | map: string → [wall_heights entry](#wall-heights-entry) |  |  |
| `items` | array of [RoomItem](#roomitem) |  | Furniture nested in this room. Each piece is anchored to the room's inner footprint (see roomItem), so it reflows when the room resizes. Expanded into top-level `item` objects at render time. |


### `wall`
| field | type | req | notes |
|---|---|---|---|
| `type` | literal `wall` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string | **yes** |  |
| `start_x` | number | **yes** |  |
| `start_y` | number | **yes** |  |
| `end_x` | number | **yes** |  |
| `end_y` | number | **yes** |  |
| `height` | number > 0 |  |  |
| `height_end` | number |  |  |
| `material` | string |  |  |
| `facing` | enum: `north` `south` `east` `west` |  |  |
| `z_offset` | number |  | Lift above the FLOOR BASE (slabZ), project units. Omitted → defaults to the floor's resolved slab thickness (sits on the slab, as before). Set it for a split-level wall. Same convention as `room`. |
| `openings` | array of [Opening](#opening) |  |  |


### `staircase`
| field | type | req | notes |
|---|---|---|---|
| `type` | literal `staircase` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  |  |
| `climb` | enum: `up` `down` |  | `climb` picks which end (start_x, start_y) is and which way the flight runs in z as it extends into `direction`: • "up" (recommended): BOTTOM-anchored. Put the stair on the LOWER floor it rises FROM; (start_x, start_y) is the bottom step's near corner on that floor and the flight ASCENDS into `direction`. `rise_height` defaults to THIS floor's height (climb to the next level). The intuitive way. • "down" (DEFAULT, kept for older configs): TOP-anchored. Put the stair on the upper DESTINATION floor; (start_x, start_y) is the top connection and the flight DESCENDS into `direction`. `rise_height` defaults to the floor immediately BELOW this one. Either way the body + landings fill the box [start, start + max_run] along `direction`, and `z_offset` is the ANCHORED end's height above the floor base (omitted → this floor's slab thickness, flush with the walking surface). |
| `start_x` | number | **yes** |  |
| `start_y` | number | **yes** |  |
| `rise_height` | number > 0 |  | Total height the stair covers, top → floor below. The step COUNT is derived: num_steps = round(rise_height / step_rise). Omitted → defaults to the height of the floor immediately below this one. Formula-capable (e.g. "= floor_height"). Replaces the old explicit `num_steps`. |
| `step_rise` | number > 0 | **yes** |  |
| `step_tread` | number > 0 | **yes** |  |
| `width` | number > 0 |  | BOX MODEL (preferred): give a `width` (X) × `length` (Y) rectangle and the WHOLE staircase — flights + turn landings — is packed to fit INSIDE it. (start_x,start_y) is then the box's min corner, NOT the first step, and each flight's width is DERIVED from the box: two switchback lanes = (lateral − flight_gap)/2, or the full box for a single flight. `direction` picks the run axis (N/S → run along length/Y; E/W → run along width/X). The model errors if the box is too small for even the tightest split. Omit both to use the legacy `step_width` + `max_run` form below. |
| `length` | number > 0 |  |  |
| `step_width` | number > 0 |  | Legacy per-step width (required by the old form; derived from the box in the box model). The expanded single-flight staircases the renderer consumes always carry it. |
| `direction` | enum: `north` `south` `east` `west` | **yes** | The direction the stair EXTENDS from its top — the whole assembly fills the allocated box from (start_x,start_y) going this way for up to `max_run`. |
| `max_run` | number > 0 |  | ALLOCATED run: the length of space reserved for the stair along `direction`. The WHOLE assembly (flights + turn landings) is kept within [start, start+max_run]; when the run won't fit as one flight it auto-splits into switchback flights (more flights when tight), expanded in expandRoomWalls into plain staircases + floor_slab landings so every renderer is unchanged. Omit → one flight, no length limit. |
| `landing_depth` | number > 0 |  | Turn-landing depth (along the run). Omitted → equals step_width. |
| `landing_thickness` | number ≥ 0 |  | Turn-landing slab thickness. Omitted → equals step_rise. |
| `turn` | enum: `clockwise` `anticlockwise` |  | Switchback handedness, reckoned DESCENDING from the top. Omitted → "clockwise". Only affects split stairs. |
| `flight_gap` | number > 0 |  | Lateral gap between the two switchback flights (a stairwell void for a spine wall). Omitted/0 → flights are adjacent. The turn landings widen to bridge the gap. Only affects split stairs. |
| `z_offset` | number |  | Height of the stair's TOP above the floor base (slabZ; project units, 10 = 1 ft). Omitted → this floor's slab thickness, so the top is flush with the walking surface and the flights descend to the floor below. Raise it for an internal step whose top sits above the floor. |
| `material` | string |  |  |


### `spiral_staircase`

A helical staircase: `steps` treads winding `turns` revolutions around a central pole, from the floor to `total_height`, within `radius`. Placed by its CENTRE (x, y). Optional fields fall back to sensible defaults at render time.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `spiral_staircase` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  | Label |
| `x` | number | **yes** | Centre X (project units) |
| `y` | number | **yes** | Centre Y (project units) |
| `radius` | number > 0 | **yes** | Outer radius (project units) |
| `total_height` | number > 0 | **yes** | Total rise (floor to top step) (project units) |
| `turns` | number > 0 |  | Revolutions (default 1) |
| `steps` | integer |  | Number of treads (default ~12 per turn) |
| `tread_thickness` | number > 0 |  | Tread slab thickness (project units) |
| `pole_radius` | number > 0 |  | Central pole radius (project units) |
| `z_offset` | number |  | Lift above floor base (project units) |


### `door`

Flat door/window remain valid as a legacy schema — new configs nest them inside room.walls[side].openings or wall.openings.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `door` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string | **yes** |  |
| `x` | number | **yes** |  |
| `y` | number | **yes** |  |
| `width` | number > 0 | **yes** |  |
| `height` | number > 0 | **yes** |  |
| `direction` | enum: `north` `south` `east` `west` | **yes** |  |
| `room` | string |  |  |
| `wall` | string |  |  |
| `open` | boolean |  |  |


### `window`
| field | type | req | notes |
|---|---|---|---|
| `type` | literal `window` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string | **yes** |  |
| `x` | number | **yes** |  |
| `y` | number | **yes** |  |
| `width` | number > 0 | **yes** |  |
| `height` | number > 0 | **yes** |  |
| `sill_height` | number ≥ 0 |  |  |
| `direction` | enum: `north` `south` `east` `west` | **yes** |  |
| `room` | string |  |  |
| `wall` | string |  |  |
| `open` | boolean |  |  |


### `kitchen_platform`

Kitchen platform — a polyline countertop / cooking slab that runs along the base of walls. Path is the wall-side edge; the platform extends `depth` units perpendicular to each segment on the given `side`. Renders as one box per path segment; corners meet at the shared point (no fancy mitering in v1).

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `kitchen_platform` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  |  |
| `path` | array of tuple `[n,n]` | **yes** |  |
| `side` | enum: `left` `right` | **yes** |  |
| `depth` | number > 0 | **yes** |  |
| `height` | number > 0 | **yes** |  |
| `z_offset` | number |  | Lift above the FLOOR BASE (slabZ), project units. Omitted → defaults to the floor's resolved slab thickness (sits on the slab top, as before). Same convention as `room`. |
| `base_z` | number |  |  |
| `material` | string |  |  |


### `roof`

v2 roof — unified segment-based type that replaces hip/gable/flat/shed. Schema is permissive; the v2 pipeline (svg2d/roof/v2/) validates segments + slope + endpoint style at derivation time.


> **Freeform:** extra fields are allowed (`.catchall`) and validated at derivation time. See `roof-v2-guide.md`.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `roof` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |


### `compound_wall`

compound_wall: perimeter / boundary wall A solid rectangular block placed by its TOP-LEFT (NW) corner. Renders as a GLB asset when `asset` is provided; otherwise plan-only. Four compound_wall objects typically enclose a plot (North, South, East, West sides).

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `compound_wall` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  |  |
| `x` | number | **yes** | Top-left (NW) corner X (project units) |
| `y` | number | **yes** | Top-left (NW) corner Y (project units) |
| `width` | number > 0 | **yes** | East extent — wall length along the X axis (project units) |
| `length` | number > 0 | **yes** | South extent — wall length along the Y axis (project units) |
| `height` | number > 0 | **yes** | Uniform wall height above grade (project units) |
| `thickness` | number > 0 |  | Wall body depth; defaults to house wall_thickness (project units) |
| `material` | string |  |  |
| `asset` | [ItemAsset](#itemasset) |  | Optional GLB for 3D render; omit for a plan-only footprint |
| `rotation` | number |  |  |
| `z_offset` | number |  |  |


### `well`

well: water well with circular, square, or rectangular footprint Placed by its plan CENTRE (x, y). `shape` defaults to circular; `diameter` is the outer diameter for circular wells; `width`/`length` for rectangular.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `well` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  |  |
| `x` | number | **yes** | Plan centre X (project units) |
| `y` | number | **yes** | Plan centre Y (project units) |
| `shape` | enum: `circular` `rectangular` `square` |  | Well footprint shape; default circular |
| `diameter` | number > 0 |  | Outer diameter for circular wells (project units) |
| `width` | number > 0 |  | Footprint width for rectangular or square wells (project units) |
| `length` | number > 0 |  | Footprint length for rectangular wells (project units) |
| `parapet_height` | number > 0 |  | Height of the raised parapet ring above grade (project units) |
| `asset` | [ItemAsset](#itemasset) |  | Optional GLB for 3D render; omit for plan-only |
| `rotation` | number |  |  |
| `z_offset` | number |  |  |


### `solar_panel`

solar_panel: solar array, roof-mount or ground-mount Placed by its plan CENTRE (x, y). `capacity_kw` and `panel_count` are metadata only (not used by geometry). `azimuth` (0=north, 180=south-facing) and `tilt` (degrees above horizontal) describe the panel orientation.

| field | type | req | notes |
|---|---|---|---|
| `type` | literal `solar_panel` | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  | *(shared — see top)* |
| `enabled` | boolean or number (`false`/`0` = hidden) |  | *(shared — see top)* |
| `layer` | string |  | *(shared — see top)* |
| `name` | string |  |  |
| `x` | number | **yes** | Array centre X (project units) |
| `y` | number | **yes** | Array centre Y (project units) |
| `mount` | enum: `roof` `ground` |  | Mounting type: roof-mount (default) or ground-mount |
| `capacity_kw` | number > 0 |  | Installed capacity in kilowatts peak (metadata only — not used by geometry) |
| `panel_count` | integer |  | Number of panels (metadata only) |
| `azimuth` | number |  | Panel orientation: compass bearing in degrees (0=north, 180=south-facing) |
| `tilt` | number |  | Panel pitch angle in degrees above horizontal |
| `asset` | [ItemAsset](#itemasset) |  | Optional GLB for 3D render; omit for plan-only |
| `rotation` | number |  | Plan yaw of the array footprint (degrees) |
| `scale` | number > 0 |  |  |
| `z_offset` | number |  |  |


## Shared & nested schemas

### site

Objects don't bind to the grid with a special field — a grid line's position is published as a formula symbol (`<gridId>.x<name>` / `.y<name>`, see param/resolve.ts), so a room places itself with ordinary `formulas`, e.g. { x: "= main.x1", width: "= main.x5 - main.x1" }. With coord_convention:"center" those are wall centrelines and expandRoomWalls handles the wall extent.

| field | type | req | notes |
|---|---|---|---|
| `reference_x` | number | **yes** |  |
| `reference_y` | number | **yes** |  |
| `plot_length` | number > 0 | **yes** |  |
| `plot_width` | number > 0 | **yes** |  |
| `formulas` | map: field name → `"= formula"` string |  |  |
| `enabled` | boolean or number (`false`/`0` = hidden) |  |  |


### houseDefaults

House-level overrides for the built-in GlobalConfig defaults. Every floor without its own value falls back to these; if these are absent too, the code defaults in DEFAULT_GLOBAL_CONFIG apply.

| field | type | req | notes |
|---|---|---|---|
| `floor_height` | number > 0 |  |  |
| `wall_height` | number > 0 |  |  |
| `slab_thickness` | number ≥ 0 |  |  |
| `wall_thickness` | number > 0 |  | House-wide wall thickness (project units). Per-object `wall_thickness`/`thickness` overrides still win. Falls back to the code default (DEFAULT_GLOBAL_CONFIG.wall_thickness = 8) when omitted. |
| `formulas` | map: field name → `"= formula"` string |  |  |
| `enabled` | boolean or number (`false`/`0` = hidden) |  |  |


### units

How dimensions are LABELLED on the drawings. Display-only — geometry always stays in project units; this just controls the text on the dimension lines. Omitted = the built-in default (feet & inches, 10 project units = 1 ft).

| field | type | req | notes |
|---|---|---|---|
| `system` | enum: `feet_inches` `feet` `meters` `centimeters` `millimeters` |  | feet_inches → 12' 6" ; the rest → decimal with a unit suffix. |
| `per_unit` | number > 0 |  | Project units that equal ONE display unit (10 → 10 units = 1 ft; 100 → 100 units = 1 m). Default 10. |
| `precision` | integer ≥ 0 |  | Decimal places for the non-feet_inches systems. |


### Opening

The plinth is now a normal object placed on the "Plinth" floor (the first floor, number 0), not a top-level config key. Its footprint + height match the old top-level plinth; the plinth floor's `height` drives the rise to the floor above (replacing the old hardcoded plinth_height seed). `plinth` + `ground` are GENERATED from fields (schema/fields/{plinth,ground}.ts), imported above as plinthObject / groundObject. (P2b)

| field | type | req | notes |
|---|---|---|---|
| `kind` | enum: `door` `window` | **yes** |  |
| `name` | string |  |  |
| `formulas` | map: field name → `"= formula"` string |  | Numeric fields hold the RESOLVED value; a `= formula` for any of them lives in `formulas` (e.g. formulas.offset), evaluated by resolveParametric against the house variables/points — same pattern as every other object. |
| `offset` | number | **yes** | Any number: `center` anchor takes a signed shift; the resolved placement is fit-checked against the wall in expand.ts, so a bad value errors there. |
| `anchor` | enum: `start` `center` `end` |  | Which end of the wall `offset` is measured from, so the opening holds its place when the wall/room scales — no formula needed. `start` (default, legacy): offset from the wall start to the near edge. `end`: offset from the wall end to the far edge (0 = flush to the end). `center`: signed shift of the opening centre from the wall midpoint (0 = centred; may be negative). Resolved to a start-based offset in expand.ts (openingAnchor.ts). |
| `width` | number > 0 | **yes** |  |
| `height` | number > 0 | **yes** |  |
| `sill_height` | number |  |  |
| `direction` | enum: `north` `south` `east` `west` |  |  |
| `facing` | enum: `north` `south` `east` `west` |  |  |
| `open` | boolean |  | When true, the opening is left BARE (just a hole) — no glazing/frame for a window, no leaf for a door — e.g. an open doorway or unglazed vent. |


### RoomWallSide
| field | type | req | notes |
|---|---|---|---|
| `height` | number |  |  |
| `height_end` | number |  |  |
| `openings` | array of [Opening](#opening) |  |  |


### RoomItem

A furniture piece nested INSIDE a room (room.items[]). It has NO x/y — its plan position is DERIVED at expand time from the parent room's footprint + `anchor` + per-axis gap (+ its own `rotation`). Flattened into a top-level `item` for every renderer. `gap_x`/`gap_y` are the inset (project units) kept from the anchor into the room (edge/corner anchor → clears the wall; centre anchor → signed offset, +x east / +y south). `gap_x`/`gap_y`/`rotation`/`scale`/`z_offset` are all plain numeric fields so each can be driven by a `= formula` (via the `formulas` map).

| field | type | req | notes |
|---|---|---|---|
| `name` | string |  |  |
| `formulas` | map: field name → `"= formula"` string |  |  |
| `enabled` | boolean or number (`false`/`0` = hidden) |  |  |
| `layer` | string |  |  |
| `asset` | [ItemAsset](#itemasset) | **yes** |  |
| `anchor` | [ItemAnchor](#itemanchor) |  |  |
| `gap_x` | number |  |  |
| `gap_y` | number |  |  |
| `rotation` | number |  |  |
| `scale` | number > 0 |  |  |
| `z_offset` | number |  |  |


### ItemAsset

Furniture (GLB `item`) — shared schema pieces Defined BEFORE `room` so a room can nest its own `items[]`. Asset distances are METRES (the GLB's native unit); the 3D/2D layers scale them into project units. See registry/nodes/item + three/units. The asset backing a furniture item — stored INLINE so a .wadi is self-contained (share links / web load the GLB from `src`). A catalog is just a picker convenience.

| field | type | req | notes |
|---|---|---|---|
| `id` | string | **yes** |  |
| `name` | string |  |  |
| `src` | string | **yes** |  |
| `dimensions` | tuple `[n>0,n>0,n>0]` | **yes** |  |
| `thumbnail` | string |  |  |
| `floorPlanUrl` | string |  |  |
| `category` | string |  |  |
| `tags` | array of string |  |  |
| `offset` | tuple `[n,n,n]` |  |  |
| `corrRotation` | tuple `[n,n,n]` |  |  |
| `corrScale` | tuple `[n>0,n>0,n>0]` |  |  |


### ComponentDef
| field | type | req | notes |
|---|---|---|---|
| `name` | string |  |  |
| `goal` | string |  | A short natural-language description of what this component accomplishes (the discovery key for goal-based module lookup, e.g. "climb to the next floor"). Purely metadata — renderers ignore it. |
| `params` | array of [ComponentParam](#componentparam) |  |  |
| `variables` | map: string → number, or `"= formula"` string |  |  |
| `points` | map: string → inline object |  |  |
| `objects` | array of [Object types](#object-types) | **yes** |  |
| `expose` | inline object |  | Promote this component to a typed primitive at load time (plans/declarative-plugins.md P0). When present, the component registers a NodeDefinition of type `expose.type` whose fields come from `params`; it can then be used like any core object type. `type` is namespaced (`pack.thing`). |


### ComponentParam

A reusable component DEFINITION in the in-file `components` library. It is a mini-house: its own `variables`/`points` and a flat `objects` body authored in LOCAL coords (origin 0,0). `params` names which variables are the public inputs (label/default for the instance form). A `component` instance overrides those variables and places the body at its (x,y,z_offset). Stored once; referenced by many instances.

| field | type | req | notes |
|---|---|---|---|
| `name` | string | **yes** |  |
| `label` | string |  |  |
| `description` | string |  |  |
| `default` | number |  |  |
| `kind` | string |  | Field-projection annotations, used only when the component is `expose`d as a typed primitive (plans/declarative-plugins.md). `kind` is a FieldKind preset (coord/extent/nonneg/int/text/flag/enum); when absent the kind is inferred from the default's type. `unit` is a doc-only unit hint. |
| `unit` | string |  |  |


### LayerDef

A visibility layer for the 3D view. Each object may reference a layer by `id` (via its `layer` field); the layers menu toggles whole layers on/off. Display-only — never affects geometry. Optional: when absent, a built-in default layer set is used, and objects fall back to an automatic per-type/floor mapping.

| field | type | req | notes |
|---|---|---|---|
| `id` | string (non-empty) | **yes** |  |
| `label` | string | **yes** |  |
| `color` | string |  |  |
| `group` | string |  | Friendly group for the owner "Show/hide layers" menu (e.g. "Roof", "Walls"). Layers sharing a group toggle together. Optional. |


### configurator
| field | type | req | notes |
|---|---|---|---|
| `title` | string |  |  |
| `description` | string |  |  |
| `groups` | array of inline object |  |  |
| `inputs` | array of [ConfiguratorInput](#configuratorinput) | **yes** |  |


### ConfiguratorInput

Configurator (Gharkul owner UI) Optional, author-supplied metadata: which `variables`/`points` a template exposes to end users, and how to present them. IGNORED by the resolver and every geometry consumer — read only by the owner-facing Configurator UI. `target` is a variable name (e.g. "floorH") or a point coordinate ("House.W" → points.House.x; W/L/X/Y/x/y are resolver synonyms). `min`/`max`/ `step` are in RAW project units; `unit` only affects display.

| field | type | req | notes |
|---|---|---|---|
| `target` | string (non-empty) | **yes** |  |
| `label` | string (non-empty) | **yes** |  |
| `description` | string |  |  |
| `control` | enum: `slider` `number` `select` `toggle` |  |  |
| `unit` | enum: `ft` `in` `m` `units` `percent` `count` `none` |  |  |
| `min` | number |  |  |
| `max` | number |  |  |
| `step` | number > 0 |  |  |
| `options` | array of inline object |  |  |
| `group` | string |  |  |


### ItemAnchor

9-point anchor on a room's INNER footprint. First token = vertical (top = north … bottom = south), second = horizontal (left = west … right = east); "center" alone = both. The item aligns its matching edge/corner to this spot, held `gap` off it, into the room — so it reflows when the room is resized.

Enum: `top-left` `top-center` `top-right` `center-left` `center` `center-right` `bottom-left` `bottom-center` `bottom-right`
