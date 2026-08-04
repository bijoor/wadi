import { z } from "zod";

// Zod mirror of schema/house_config.schema.json. The JSON Schema on the
// Python side is the "wire format" reference; this file is the runtime
// validator + TypeScript source of truth for the editor. Keep them in
// sync — a CI check comparing `z.toJSONSchema(HouseConfig)` against the
// .json file can catch drift.

const side = z.enum(["north", "south", "east", "west"]);
export type Side = z.infer<typeof side>;

const positive = () => z.number().positive();
const nonNegative = () => z.number().nonnegative();

// Parametric layer (see plans/object-relationships-plan.md). A value is a
// FORMULA iff it's a string starting with "="; otherwise a literal number.
// `variables`/`points` entries may be authored as formulae; object numeric
// fields stay pure numbers and carry their formula (if any) in the object's
// `formulas` map, which the resolver evaluates into the numeric field. All of
// this is optional so existing files still pass the strict load gate.
const numOrFormula = z.union([z.number(), z.string()]);
// field name -> formula source ("= expr"). Kept as a loose string here; the
// resolver — not Zod — reports evaluation errors.
const formulaMap = z.record(z.string(), z.string());
// Optional presence switch on an object. `false` / `0` hides the object from
// every view (2D, 3D, roof, bounds); absent / `true` / non-zero shows it. Can be
// set manually, or driven by `formulas.enabled` (e.g. "= has_pooja") so a variable
// toggles a room on/off — the basis of switch-off template rooms. A number is
// allowed because the resolver writes the formula's numeric result here.
const enabledField = z.union([z.boolean(), z.number()]);

// ---- Grid (first-class parametric grid) — plans/grid-convention.md ----------
// A grid is a set of ordered wall-CENTRELINE positions per axis (X numbered
// `1,2,3…`, Y lettered `A,B,C…` by convention). A room/slab binds to a `cell`
// (its bounding line names) and a pillar to a `node`; the resolver derives
// x/y/width/length from the centrelines + wall thickness, so grids are
// thickness-independent and reusable across templates. `role` (structural |
// planning) is forward-compat for a future 2nd grid; `thickness` is the tartan
// minor-band width for that line (default = house wall_thickness).
const gridLine = z
  .object({
    name: z.string().min(1),
    at: numOrFormula,
    role: z.enum(["structural", "planning"]).optional(),
    thickness: numOrFormula.optional(),
  })
  .strict();
const gridDef = z
  .object({
    x: z.array(gridLine).min(2), // vertical centrelines (west → east)
    y: z.array(gridLine).min(2), // horizontal centrelines (north → south)
  })
  .strict();
export type GridDef = z.infer<typeof gridDef>;
// Objects don't bind to the grid with a special field — a grid line's position is
// published as a formula symbol (`<gridId>.x<name>` / `.y<name>`, see
// param/resolve.ts), so a room places itself with ordinary `formulas`, e.g.
// { x: "= main.x1", width: "= main.x5 - main.x1" }. With coord_convention:"center"
// those are wall centrelines and expandRoomWalls handles the wall extent.

const site = z
  .object({
    reference_x: z.number(),
    reference_y: z.number(),
    plot_length: positive(),
    plot_width: positive(),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
  })
  .strict();

// The plinth is now a normal object placed on the "Plinth" floor (the first
// floor, number 0), not a top-level config key. Its footprint + height match
// the old top-level plinth; the plinth floor's `height` drives the rise to the
// floor above (replacing the old hardcoded plinth_height seed).
const plinthObject = z
  .object({
    type: z.literal("plinth"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    material: z.string().optional(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    length: positive(),
    height: positive(),
    z_offset: z.number().optional(),
  })
  .strict();

// The ground plane, also on the Plinth floor. Extent defaults to the site plot
// when authored by the migration. `height` is an optional thickness (0 = a flat
// plane); slope fields are a later phase.
const groundObject = z
  .object({
    type: z.literal("ground"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    material: z.string().optional(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    length: positive(),
    height: z.number().nonnegative().optional(),
    z_offset: z.number().optional(),
  })
  .strict();

const opening = z
  .object({
    kind: z.enum(["door", "window"]),
    name: z.string().optional(),
    // Numeric fields hold the RESOLVED value; a `= formula` for any of them lives
    // in `formulas` (e.g. formulas.offset), evaluated by resolveParametric against
    // the house variables/points — same pattern as every other object.
    formulas: formulaMap.optional(),
    offset: nonNegative(),
    width: positive(),
    height: positive(),
    sill_height: z.number().optional(),
    direction: side.optional(),
    facing: side.optional(),
    // When true, the opening is left BARE (just a hole) — no glazing/frame for a
    // window, no leaf for a door — e.g. an open doorway or unglazed vent.
    open: z.boolean().optional(),
  })
  .strict();
export type Opening = z.infer<typeof opening>;

const roomWallSide = z
  .object({
    height: z.number().optional(),
    height_end: z.number().optional(),
    openings: z.array(opening).optional(),
  })
  .strict();

const floorSlab = z
  .object({
    type: z.literal("floor_slab"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    length: positive(),
    // Optional per-slab thickness override. Defaults to the floor's
    // slab_thickness (which itself defaults to house.defaults or the
    // code global). In project units.
    thickness: z.number().nonnegative().optional(),
    // Vertical position, as a lift above the FLOOR BASE (slabZ = plinth top
    // for floor 0, else the floor below's top; project units, 10 = 1 ft).
    // Default 0 → the slab's bottom sits at the floor base. Raise it to
    // place a slab at an intermediate height (e.g. a stair landing). See
    // the unified z_offset convention on `room`.
    z_offset: z.number().optional(),
  })
  .strict();

const pillar = z
  .object({
    type: z.literal("pillar"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string(),
    // TOP-LEFT CORNER (Inkscape frame), consistent with room / floor_slab /
    // beam. (Historically this was the pillar CENTER; changed for consistency.)
    x: z.number(),
    y: z.number(),
    // width or length may be absent — see create_pillar.
    width: positive().optional(),
    length: positive().optional(),
    height: positive(),
    // Lift above the FLOOR BASE (slabZ), project units. Default 0 — a pillar
    // rises from the floor base (plinth top on floor 0) through the slab to
    // the ring beam. Same convention as `beam`/`floor_slab`.
    z_offset: z.number().optional(),
  })
  .strict();

const beam = z
  .object({
    type: z.literal("beam"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    length: positive(),
    // Vertical thickness of the beam, in PROJECT UNITS. Optional —
    // defaults to the floor's slab_thickness. The 3D viewer + BeamForm
    // read this as `height`; note the Python builder currently reads a
    // `thickness` key instead (wadi_config.py) — see the known
    // field-name mismatch.
    height: positive().optional(),
    // Lift above the FLOOR BASE (slabZ), in PROJECT UNITS (10 units = 1 ft).
    // Default 0 — the beam's bottom sits at the floor base. Same convention
    // as `floor_slab`. (Was previously z_offset_ft in feet.)
    z_offset: z.number().optional(),
  })
  .strict();

const wallHeightsEntry = z.union([
  z.number(),
  z
    .object({
      height: z.number().optional(),
      height_end: z.number().optional(),
    })
    .strict(),
]);

// ---- Furniture (GLB `item`) — shared schema pieces --------------------------
// Defined BEFORE `room` so a room can nest its own `items[]`. Asset distances are
// METRES (the GLB's native unit); the 3D/2D layers scale them into project units.
// See registry/nodes/item + three/units.

// The asset backing a furniture item — stored INLINE so a .wadi is self-contained
// (share links / web load the GLB from `src`). A catalog is just a picker convenience.
const itemAsset = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    src: z.string(), // GLB URL (R2/CDN absolute, or bundled relative like /furniture/bed.glb)
    dimensions: z.tuple([positive(), positive(), positive()]), // [w, h, d] in METRES
    thumbnail: z.string().optional(),
    floorPlanUrl: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    offset: z.tuple([z.number(), z.number(), z.number()]).optional(),       // corrective, metres
    corrRotation: z.tuple([z.number(), z.number(), z.number()]).optional(), // corrective, degrees
    corrScale: z.tuple([positive(), positive(), positive()]).optional(),    // corrective, unitless
  })
  .strict();
export type ItemAsset = z.infer<typeof itemAsset>;

// 9-point anchor on a room's INNER footprint. First token = vertical (top = north …
// bottom = south), second = horizontal (left = west … right = east); "center" alone =
// both. The item aligns its matching edge/corner to this spot, held `gap` off it, into
// the room — so it reflows when the room is resized.
const itemAnchor = z.enum([
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
]);
export type ItemAnchor = z.infer<typeof itemAnchor>;

// A furniture piece nested INSIDE a room (room.items[]). It has NO x/y — its plan
// position is DERIVED at expand time from the parent room's footprint + `anchor` +
// per-axis gap (+ its own `rotation`). Flattened into a top-level `item` for every
// renderer. `gap_x`/`gap_y` are the inset (project units) kept from the anchor into
// the room (edge/corner anchor → clears the wall; centre anchor → signed offset,
// +x east / +y south). `gap_x`/`gap_y`/`rotation`/`scale`/`z_offset` are all plain
// numeric fields so each can be driven by a `= formula` (via the `formulas` map).
const roomItem = z
  .object({
    name: z.string().optional(),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    asset: itemAsset,
    anchor: itemAnchor.optional(), // default "center"
    gap_x: z.number().optional(),
    gap_y: z.number().optional(),
    rotation: z.number().optional(), // yaw, degrees
    scale: positive().optional(),
    z_offset: z.number().optional(),
  })
  .strict();
export type RoomItem = z.infer<typeof roomItem>;

const room = z
  .object({
    type: z.literal("room"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    length: positive(),
    // 0 accepted — semantically the same as absent ("use floor default").
    // Old configs that accidentally saved height: 0 keep loading; the
    // form treats 0 as "no override" and doesn't write it back.
    height: nonNegative().optional(),
    material: z.string().optional(),
    // Vertical position of the room (its floor + walls), as a lift above the
    // FLOOR BASE (slabZ = plinth top for floor 0, else the floor below's
    // top; project units, 10 = 1 ft). This is the UNIFIED z_offset
    // convention: every object is placed at `slabZ + z_offset`. When
    // OMITTED, on-slab objects (room, wall, staircase, kitchen_platform)
    // default z_offset to the floor's resolved slab thickness
    // (floor.slab_thickness → house.defaults.slab_thickness → code default),
    // so by default they sit on top of the slab, exactly as before. Set it
    // explicitly for split-level floors — e.g. a room raised onto a thicker
    // slab uses the same value the raised slab's top sits at.
    z_offset: z.number().optional(),
    walls: z
      .union([
        z.array(side).describe("Legacy list form"),
        z
          .object({
            north: roomWallSide.optional(),
            south: roomWallSide.optional(),
            east: roomWallSide.optional(),
            west: roomWallSide.optional(),
          })
          .strict()
          .describe("Nested form (canonical)"),
      ])
      .optional(),
    wall_heights: z.record(z.string(), wallHeightsEntry).optional(),
    // Furniture nested in this room. Each piece is anchored to the room's inner
    // footprint (see roomItem), so it reflows when the room resizes. Expanded into
    // top-level `item` objects at render time.
    items: z.array(roomItem).optional(),
  })
  .strict();
export type Room = z.infer<typeof room>;

const wall = z
  .object({
    type: z.literal("wall"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string(),
    start_x: z.number(),
    start_y: z.number(),
    end_x: z.number(),
    end_y: z.number(),
    height: positive().optional(),
    height_end: z.number().optional(),
    material: z.string().optional(),
    facing: side.optional(),
    // Lift above the FLOOR BASE (slabZ), project units. Omitted → defaults
    // to the floor's resolved slab thickness (sits on the slab, as before).
    // Set it for a split-level wall. Same convention as `room`.
    z_offset: z.number().optional(),
    openings: z.array(opening).optional(),
  })
  .strict();
export type Wall = z.infer<typeof wall>;

const staircase = z
  .object({
    type: z.literal("staircase"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    // A staircase belongs to the DESTINATION (upper) floor it leads to — put it
    // on that floor's `objects` so deleting the floor deletes the stair. It is
    // TOP-anchored and DESCENDS: (start_x, start_y) is the top connection where it
    // meets this floor, and the stair descends INTO `direction` from there (its
    // body + landings fill the box [start, start + max_run] along `direction`).
    // `z_offset` is the top's height above the floor base (omitted → this floor's
    // slab thickness, flush with the walking surface).
    start_x: z.number(),
    start_y: z.number(),
    // Total height the stair covers, top → floor below. The step COUNT is
    // derived: num_steps = round(rise_height / step_rise). Omitted → defaults to
    // the height of the floor immediately below this one. Formula-capable
    // (e.g. "= floor_height"). Replaces the old explicit `num_steps`.
    rise_height: positive().optional(),
    step_rise: positive(),
    step_tread: positive(),
    step_width: positive(),
    // The direction the stair EXTENDS from its top — the whole assembly fills the
    // allocated box from (start_x,start_y) going this way for up to `max_run`.
    direction: side,
    // ALLOCATED run: the length of space reserved for the stair along `direction`.
    // The WHOLE assembly (flights + turn landings) is kept within
    // [start, start+max_run]; when the run won't fit as one flight it auto-splits
    // into switchback flights (more flights when tight), expanded in
    // expandRoomWalls into plain staircases + floor_slab landings so every
    // renderer is unchanged. Omit → one flight, no length limit.
    max_run: positive().optional(),
    // Turn-landing depth (along the run). Omitted → equals step_width.
    landing_depth: positive().optional(),
    // Turn-landing slab thickness. Omitted → equals step_rise.
    landing_thickness: z.number().nonnegative().optional(),
    // Switchback handedness, reckoned DESCENDING from the top. Omitted →
    // "clockwise". Only affects split stairs.
    turn: z.enum(["clockwise", "anticlockwise"]).optional(),
    // Lateral gap between the two switchback flights (a stairwell void for a
    // spine wall). Omitted/0 → flights are adjacent. The turn landings widen to
    // bridge the gap. Only affects split stairs.
    flight_gap: positive().optional(),
    // Height of the stair's TOP above the floor base (slabZ; project units, 10 =
    // 1 ft). Omitted → this floor's slab thickness, so the top is flush with the
    // walking surface and the flights descend to the floor below. Raise it for an
    // internal step whose top sits above the floor.
    z_offset: z.number().optional(),
    material: z.string().optional(),
  })
  .strict();

// Flat door/window remain valid as a legacy schema — new configs nest
// them inside room.walls[side].openings or wall.openings.
const door = z
  .object({
    type: z.literal("door"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    height: positive(),
    direction: side,
    room: z.string().optional(),
    wall: z.string().optional(),
    open: z.boolean().optional(),
  })
  .strict();

const windowObj = z
  .object({
    type: z.literal("window"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    height: positive(),
    sill_height: nonNegative().optional(),
    direction: side,
    room: z.string().optional(),
    wall: z.string().optional(),
    open: z.boolean().optional(),
  })
  .strict();

// v2 roof — unified segment-based type that replaces hip/gable/flat/shed.
// Schema is permissive; the v2 pipeline (svg2d/roof/v2/) validates
// segments + slope + endpoint style at derivation time.
const roofV2 = z
  .object({
    type: z.literal("roof"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
  })
  .catchall(z.unknown());

// Kitchen platform — a polyline countertop / cooking slab that runs
// along the base of walls. Path is the wall-side edge; the platform
// extends `depth` units perpendicular to each segment on the given
// `side`. Renders as one box per path segment; corners meet at the
// shared point (no fancy mitering in v1).
const kitchenPlatform = z
  .object({
    type: z.literal("kitchen_platform"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    path: z.array(z.tuple([z.number(), z.number()])).min(2),
    side: z.enum(["left", "right"]),
    depth: positive(),           // horizontal extent from path (project units)
    height: positive(),          // vertical extent above its base (project units)
    // Lift above the FLOOR BASE (slabZ), project units. Omitted → defaults
    // to the floor's resolved slab thickness (sits on the slab top, as
    // before). Same convention as `room`.
    z_offset: z.number().optional(),
    base_z: z.number().optional(),   // ABSOLUTE base Z override (world units); wins over z_offset. Prefer z_offset.
    material: z.string().optional(),
  })
  .strict();

// An INSTANCE of a reusable component from the in-file `components` library.
// It references a component by id (`ref`), overrides the component's input
// variables via `params`, and places it at (x, y) with a `z_offset` lift on its
// parent floor. At render time `expandRoomWalls` flattens it into concrete
// objects (resolve component with param+origin overrides → recurse → offset),
// so no renderer needs to know about `component`.
const componentObject = z
  .object({
    type: z.literal("component"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    ref: z.string(),
    // Overrides for the component's declared input variables. A string starting
    // with "=" is a formula evaluated in the HOST scope (so it can reference the
    // host's variables/points); a number is used directly.
    params: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    x: z.number(),
    y: z.number(),
    z_offset: z.number().optional(),
  })
  .strict();

// A free-standing GLB furniture / decor instance placed directly on a floor (for
// pieces that aren't inside an enclosed room — outdoor/site/verandah decor, a loft
// item, etc.). `x`/`y` are the item's plan CENTRE. It MAY instead anchor to a named
// room via `anchor_to` + `anchor` + `gap`, in which case `x`/`y` are DERIVED at expand
// time (same anchor model as room-nested items). `rotation` is yaw°; `scale` is a
// uniform resize; `z_offset` lifts it above the floor base (default = slab thickness).
// (`itemAsset`, `itemAnchor`, `gapField` are defined above `room`.)
const itemObject = z
  .object({
    type: z.literal("item"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    asset: itemAsset,
    x: z.number(),
    y: z.number(),
    rotation: z.number().optional(), // yaw, degrees
    scale: positive().optional(),    // uniform user resize (default 1)
    z_offset: z.number().optional(),
    // Optional room-relative anchoring (for a free item that should follow a room).
    anchor_to: z.string().optional(), // room name on this floor
    anchor: itemAnchor.optional(),
    gap_x: z.number().optional(),
    gap_y: z.number().optional(),
  })
  .strict();

export const object = z.discriminatedUnion("type", [
  plinthObject,
  groundObject,
  componentObject,
  itemObject,
  floorSlab,
  pillar,
  beam,
  room,
  wall,
  staircase,
  door,
  windowObj,
  kitchenPlatform,
  roofV2,
]);
export type HouseObject = z.infer<typeof object>;

const floor = z
  .object({
    floor_number: z.number().int().nonnegative(),
    name: z.string(),
    // Per-floor overrides for the default heights in GlobalConfig.
    // In project units (10 units = 1 ft). All three are INDEPENDENT —
    // no relationship enforced between them:
    //   height           — floor-to-floor rise (drives roof wallTop-Z stack)
    //   wall_height      — standing wall height (floor top → ceiling)
    //   slab_thickness   — RCC deck between this floor and the one above
    // All fall back to GlobalConfig defaults when omitted.
    height: z.number().positive().optional(),
    wall_height: z.number().positive().optional(),
    slab_thickness: z.number().nonnegative().optional(),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    objects: z.array(object),
  })
  .strict();
export type Floor = z.infer<typeof floor>;

// A reusable component DEFINITION in the in-file `components` library. It is a
// mini-house: its own `variables`/`points` and a flat `objects` body authored in
// LOCAL coords (origin 0,0). `params` names which variables are the public
// inputs (label/default for the instance form). A `component` instance overrides
// those variables and places the body at its (x,y,z_offset). Stored once;
// referenced by many instances.
const componentParam = z
  .object({
    name: z.string(),
    label: z.string().optional(),
    description: z.string().optional(),
    default: z.number().optional(),
  })
  .strict();

const componentDef = z
  .object({
    name: z.string().optional(),
    // A short natural-language description of what this component accomplishes
    // (the discovery key for goal-based module lookup, e.g. "climb to the next
    // floor"). Purely metadata — renderers ignore it.
    goal: z.string().optional(),
    params: z.array(componentParam).optional(),
    variables: z.record(z.string(), numOrFormula).optional(),
    points: z
      .record(z.string(), z.object({ x: numOrFormula, y: numOrFormula }).strict())
      .optional(),
    objects: z.array(object),
  })
  .strict();
export type ComponentDef = z.infer<typeof componentDef>;

// House-level overrides for the built-in GlobalConfig defaults. Every
// floor without its own value falls back to these; if these are absent
// too, the code defaults in DEFAULT_GLOBAL_CONFIG apply.
const houseDefaults = z
  .object({
    floor_height: z.number().positive().optional(),
    wall_height: z.number().positive().optional(),
    slab_thickness: z.number().nonnegative().optional(),
    // House-wide wall thickness (project units). Per-object
    // `wall_thickness`/`thickness` overrides still win. Falls back to the
    // code default (DEFAULT_GLOBAL_CONFIG.wall_thickness = 8) when omitted.
    wall_thickness: z.number().positive().optional(),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
  })
  .strict();

// How dimensions are LABELLED on the drawings. Display-only — geometry
// always stays in project units; this just controls the text on the
// dimension lines. Omitted = the built-in default (feet & inches, 10
// project units = 1 ft).
const houseUnits = z
  .object({
    // feet_inches → 12' 6" ; the rest → decimal with a unit suffix.
    system: z
      .enum(["feet_inches", "feet", "meters", "centimeters", "millimeters"])
      .optional(),
    // Project units that equal ONE display unit (10 → 10 units = 1 ft;
    // 100 → 100 units = 1 m). Default 10.
    per_unit: z.number().positive().optional(),
    // Decimal places for the non-feet_inches systems.
    precision: z.number().int().nonnegative().optional(),
  })
  .strict();

// A visibility layer for the 3D view. Each object may reference a layer
// by `id` (via its `layer` field); the layers menu toggles whole layers
// on/off. Display-only — never affects geometry. Optional: when absent,
// a built-in default layer set is used, and objects fall back to an
// automatic per-type/floor mapping.
export const layerDef = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    color: z.string().optional(),
    // Friendly group for the owner "Show/hide layers" menu (e.g. "Roof",
    // "Walls"). Layers sharing a group toggle together. Optional.
    group: z.string().optional(),
  })
  .strict();
export type LayerDef = z.infer<typeof layerDef>;

// ---- Configurator (Gharkul owner UI) --------------------------------------
// Optional, author-supplied metadata: which `variables`/`points` a template
// exposes to end users, and how to present them. IGNORED by the resolver and
// every geometry consumer — read only by the owner-facing Configurator UI.
// `target` is a variable name (e.g. "floorH") or a point coordinate
// ("House.W" → points.House.x; W/L/X/Y/x/y are resolver synonyms). `min`/`max`/
// `step` are in RAW project units; `unit` only affects display.
const configuratorInput = z
  .object({
    target: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    control: z.enum(["slider", "number", "select", "toggle"]).optional(),
    unit: z.enum(["ft", "in", "m", "units", "percent", "count", "none"]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    options: z.array(z.object({ value: z.number(), label: z.string() }).strict()).optional(),
    group: z.string().optional(),
  })
  .strict();
export type ConfiguratorInput = z.infer<typeof configuratorInput>;

const configuratorSection = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    groups: z
      .array(z.object({ id: z.string().min(1), label: z.string(), description: z.string().optional() }).strict())
      .optional(),
    inputs: z.array(configuratorInput).min(1),
  })
  .strict();
export type ConfiguratorSection = z.infer<typeof configuratorSection>;

export const HouseConfig = z
  .object({
    // How a rectangular object's x/y/width/length relate to its walls
    // (plans/grid-convention.md). "center" (new/canonical): coordinates are wall
    // CENTRELINES — adjacent rooms ABUT on a shared line (no overlap), walls are
    // centred on the boundary, and expandRoomWalls grows each footprint by
    // wall_thickness/2 to the outer face. "outer" / absent (legacy): coordinates
    // are the OUTER wall face and adjacent rooms must overlap by wall_thickness.
    coord_convention: z.enum(["outer", "center"]).optional(),
    site,
    // Legacy top-level plinth (pre-"Plinth floor"). Tolerated but IGNORED so an
    // un-migrated file still loads (it just renders without a plinth/ground)
    // instead of failing .strict() validation. New configs put the plinth on
    // the Plinth floor as a `plinth` object.
    plinth: z.unknown().optional(),
    defaults: houseDefaults.optional(),
    units: houseUnits.optional(),
    // Configurable 3D visibility layers (optional; defaults applied when
    // absent). Objects opt in via their own `layer` field.
    layers: z.array(layerDef).optional(),
    // Parametric layer (plans/object-relationships-plan.md). Named scalar
    // variables (number or "= formula", may reference other variables) and
    // named 2D points; object `formulas` maps reference these. Optional —
    // absent = a plain non-parametric house, resolved as a no-op.
    variables: z.record(z.string(), numOrFormula).optional(),
    points: z
      .record(z.string(), z.object({ x: numOrFormula, y: numOrFormula }).strict())
      .optional(),
    // Reusable-component library (in-file). Map of id → ComponentDef. A
    // `component` object instantiates one by `ref`. Stored once; referenced by
    // many instances; edit here to update every instance.
    components: z.record(z.string(), componentDef).optional(),
    // First-class parametric grids (plans/grid-convention.md). Map of id →
    // GridDef (named X/Y wall centrelines). Rooms/slabs bind via `grid`+`cell`,
    // pillars via `grid`+`node`; the resolver derives their geometry from the
    // centrelines + wall thickness. Optional; reusable across templates.
    grids: z.record(z.string(), gridDef).optional(),
    // Configurator metadata (Gharkul owner UI). Optional; see plans/configurator-plan.md.
    configurator: configuratorSection.optional(),
    // Preview snapshots (data: URLs) captured by the architect editor and saved
    // WITH the template so the owner gallery can show real previews — multiple
    // angles + the floor plan. `thumbnails[0]` is the gallery cover. Optional;
    // excluded from share links (a preview isn't model data — see
    // io/shareLink.ts). `thumbnail` (singular) is the legacy one-image form,
    // still read as a fallback so old template files keep working.
    thumbnails: z.array(z.string()).optional(),
    thumbnail: z.string().optional(),
    floors: z.array(floor).min(1),
    _walls_expanded: z.boolean().optional(),
  })
  .strict();

export type HouseConfig = z.infer<typeof HouseConfig>;

// Forward-compat: a config authored by a NEWER build can carry keys this build's
// strict schema doesn't recognize. Iteratively drop exactly those keys (at any
// depth, using Zod's `unrecognized_keys` issues) so the design still loads —
// minus the options this build can't render — instead of being hard-rejected.
// Only unrecognized-key issues are stripped; any other error is left intact for
// the caller. Returns the cleaned clone + the dot-paths of every dropped key.
function stripUnknownKeys(data: unknown): { data: unknown; stripped: string[] } {
  if (!data || typeof data !== "object") return { data, stripped: [] };
  const cur = JSON.parse(JSON.stringify(data)); // config is JSON — safe deep clone
  const stripped: string[] = [];
  for (let pass = 0; pass < 12; pass++) {
    const res = HouseConfig.safeParse(cur);
    if (res.success) break;
    const unknown = res.error.issues.filter((i) => i.code === "unrecognized_keys");
    if (unknown.length === 0) break; // remaining errors aren't unknown keys — stop
    for (const issue of unknown) {
      const parent = issue.path.reduce<unknown>(
        (o, k) => (o != null && typeof o === "object" ? (o as Record<string, unknown>)[k as string] : undefined),
        cur,
      );
      if (parent && typeof parent === "object") {
        for (const k of (issue as unknown as { keys: string[] }).keys) {
          if (k in (parent as Record<string, unknown>)) {
            delete (parent as Record<string, unknown>)[k];
            stripped.push([...issue.path, k].join("/"));
          }
        }
      }
    }
  }
  return { data: cur, stripped };
}

export function validate(
  data: unknown,
  // `tolerant` (used for loading external/shared designs): if the strict parse
  // fails ONLY on unrecognized keys, strip them and retry, reporting `stripped`.
  opts?: { tolerant?: boolean },
): {
  ok: boolean;
  data?: HouseConfig;
  errors?: { path: string; message: string }[];
  stripped?: string[];
} {
  let result = HouseConfig.safeParse(data);
  if (!result.success && opts?.tolerant) {
    const s = stripUnknownKeys(data);
    if (s.stripped.length > 0) {
      const retry = HouseConfig.safeParse(s.data);
      if (retry.success) return { ok: true, data: retry.data, stripped: s.stripped };
      result = retry; // post-strip errors are the real incompatibility — report those
    }
  }
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => ({
      path: i.path.join("/") || "(root)",
      message: i.message,
    })),
  };
}
