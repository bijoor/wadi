import { z } from "zod";
// Primitives migrated to the codegen-to-core model: their typed Zod schema is
// GENERATED from `fields` (schema/fields/*) → objects.generated.ts. Aliased to the
// union's existing member names. (P2b)
import {
  beam,
  floor_slab as floorSlab,
  pillar,
  plinth as plinthObject,
  ground as groundObject,
  spiral_staircase as spiralStaircase,
} from "./generated/objects.generated";

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
// NAMED guides: ordered, individually-named lines per axis (the original grid).
// Referenced by name: `<id>.x<name>` / `<id>.y<name>` (e.g. `main.x2`, `main.yC`).
const gridDef = z
  .object({
    x: z.array(gridLine).min(2), // vertical centrelines (west → east)
    y: z.array(gridLine).min(2), // horizontal centrelines (north → south)
  })
  .strict();
export type GridDef = z.infer<typeof gridDef>;

// GENERATED guides: a uniform family from origin + spacing, referenced by INDEX:
//   `<id>.x8`         integer shorthand (mirrors the named `.x2` shape)
//   `<id>.x(expr)`    call form — required for fractional/negative/computed indices
// resolving lazily to `origin + index · spacing`. `extent` (line counts per axis)
// exists only so the 2D plan can DRAW the uniform lines; referencing is lazy.
const generatedGuides = z
  .object({
    origin: z.tuple([numOrFormula, numOrFormula]).optional(), // default (0, 0)
    spacing: z.tuple([numOrFormula, numOrFormula]), // (dx, dy)
    extent: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
  })
  .strict();
export type GeneratedGuides = z.infer<typeof generatedGuides>;

// A `guides` object is EITHER named (x/y line lists) OR generated (spacing), never
// both — the union enforces it (each side is `.strict()`, so a named object can't
// also carry `spacing`, and vice versa).
const guidesDef = z.union([gridDef, generatedGuides]);
export type GuidesDef = z.infer<typeof guidesDef>;
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
// `plinth` + `ground` are GENERATED from fields (schema/fields/{plinth,ground}.ts),
// imported above as plinthObject / groundObject. (P2b)

const opening = z
  .object({
    kind: z.enum(["door", "window"]),
    name: z.string().optional(),
    // Numeric fields hold the RESOLVED value; a `= formula` for any of them lives
    // in `formulas` (e.g. formulas.offset), evaluated by resolveParametric against
    // the house variables/points — same pattern as every other object.
    formulas: formulaMap.optional(),
    // Any number: `center` anchor takes a signed shift; the resolved placement
    // is fit-checked against the wall in expand.ts, so a bad value errors there.
    offset: z.number(),
    // Which end of the wall `offset` is measured from, so the opening holds its
    // place when the wall/room scales — no formula needed. `start` (default,
    // legacy): offset from the wall start to the near edge. `end`: offset from
    // the wall end to the far edge (0 = flush to the end). `center`: signed
    // shift of the opening centre from the wall midpoint (0 = centred; may be
    // negative). Resolved to a start-based offset in expand.ts (openingAnchor.ts).
    anchor: z.enum(["start", "center", "end"]).optional(),
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

// `floor_slab` + `pillar` are GENERATED from fields (schema/fields/{floorSlab,
// pillar}.ts), imported above as floorSlab / pillar. (pillar x,y = TOP-LEFT corner;
// name required; width/length may be absent. floor_slab thickness defaults to the
// floor's slab_thickness.)

// `beam` + the box primitives above are all GENERATED from one `fields` source each
// (schema/fields/*) via gen-primitives → objects.generated.ts — the codegen-to-core
// model (P2b): fields drive schema + type + docs. Regenerate: `npm run gen-primitives`.

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
    // Rooms this room connects to, by name (same floor). Design intent + a
    // functional test (constraint C11): a declared connection must be adjacent
    // AND joined by a door. Symmetric and deduped; NOT geometry — it never moves
    // or sizes anything, and the renderer ignores it.
    connections: z.array(z.string()).optional(),
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
    // `climb` picks which end (start_x, start_y) is and which way the flight runs
    // in z as it extends into `direction`:
    //   • "up" (recommended): BOTTOM-anchored. Put the stair on the LOWER floor it
    //     rises FROM; (start_x, start_y) is the bottom step's near corner on that
    //     floor and the flight ASCENDS into `direction`. `rise_height` defaults to
    //     THIS floor's height (climb to the next level). The intuitive way.
    //   • "down" (DEFAULT, kept for older configs): TOP-anchored. Put the stair on
    //     the upper DESTINATION floor; (start_x, start_y) is the top connection and
    //     the flight DESCENDS into `direction`. `rise_height` defaults to the floor
    //     immediately BELOW this one.
    // Either way the body + landings fill the box [start, start + max_run] along
    // `direction`, and `z_offset` is the ANCHORED end's height above the floor base
    // (omitted → this floor's slab thickness, flush with the walking surface).
    climb: z.enum(["up", "down"]).optional(),
    start_x: z.number(),
    start_y: z.number(),
    // Total height the stair covers, top → floor below. The step COUNT is
    // derived: num_steps = round(rise_height / step_rise). Omitted → defaults to
    // the height of the floor immediately below this one. Formula-capable
    // (e.g. "= floor_height"). Replaces the old explicit `num_steps`.
    rise_height: positive().optional(),
    step_rise: positive(),
    step_tread: positive(),
    // BOX MODEL (preferred): give a `width` (X) × `length` (Y) rectangle and the
    // WHOLE staircase — flights + turn landings — is packed to fit INSIDE it.
    // (start_x,start_y) is then the box's min corner, NOT the first step, and each
    // flight's width is DERIVED from the box: two switchback lanes =
    // (lateral − flight_gap)/2, or the full box for a single flight. `direction`
    // picks the run axis (N/S → run along length/Y; E/W → run along width/X). The
    // model errors if the box is too small for even the tightest split. Omit both
    // to use the legacy `step_width` + `max_run` form below.
    width: positive().optional(),
    length: positive().optional(),
    // Legacy per-step width (required by the old form; derived from the box in the
    // box model). The expanded single-flight staircases the renderer consumes always
    // carry it.
    step_width: positive().optional(),
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
    // Standard placement: yaw° about the instance origin (clockwise, same sense as
    // item rotation: 0=south, 90=east). Right angles (0/90/180/270) are exact for
    // any component; a non-right angle is allowed only for furniture-only ones.
    rotation: z.number().optional(),
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

// A rig op manipulates one NAMED node of a `model`'s GLB (plans/declarative-plugins.md
// P1). Values are in the GLB's own space: translate/scale are node offsets/factors,
// rotate is Euler degrees, `about` is a pivot (so an array can be circular / spiral).
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const rigOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("translate"), node: z.string(), by: vec3 }).strict(),
  z.object({ op: z.literal("rotate"), node: z.string(), by: vec3 }).strict(),
  z.object({ op: z.literal("scale"), node: z.string(), by: vec3 }).strict(),
  z.object({ op: z.literal("visible"), node: z.string(), value: z.union([z.boolean(), z.number()]) }).strict(),
  z.object({ op: z.literal("material"), node: z.string(), color: z.string() }).strict(),
  z
    .object({
      op: z.literal("array"),
      node: z.string(),
      count: z.number().int().positive(),
      translate: vec3.optional(),
      rotate: vec3.optional(),
      scale: vec3.optional(),
      about: vec3.optional(),
    })
    .strict(),
]);

// A GLB placed at real scale and manipulated by a `rig` of named-node ops. Distinct
// from `item` (furniture, catalog + anchoring): `model` is a rigged structural asset.
// `asset.dimensions` is the real metre size, used for the 2D footprint and the scale.
const modelObject = z
  .object({
    type: z.literal("model"),
    formulas: formulaMap.optional(),
    enabled: enabledField.optional(),
    layer: z.string().optional(),
    name: z.string().optional(),
    asset: itemAsset,
    x: z.number(),
    y: z.number(),
    rotation: z.number().optional(), // yaw, degrees
    scale: positive().optional(), // uniform user resize
    z_offset: z.number().optional(),
    rig: z.array(rigOp).optional(),
  })
  .strict();

export const object = z.discriminatedUnion("type", [
  plinthObject,
  groundObject,
  componentObject,
  itemObject,
  modelObject,
  floorSlab,
  pillar,
  beam,
  room,
  wall,
  staircase,
  spiralStaircase,
  door,
  windowObj,
  kitchenPlatform,
  roofV2,
]);
export type HouseObject = z.infer<typeof object>;

// Registry-extensible object schema. A registered primitive (registry/nodes/*)
// PUSHES its Zod schema here via registerObjectSchema at registration time —
// "registration-push", so this LOW-LEVEL module never imports the registry (which
// would be a cycle: registry → nodes → schema). Floor/component object arrays
// validate against the built-in discriminated union OR any registered schema.
// No registered schema exists today ⇒ the fallback never fires ⇒ byte-identical
// validation for every existing config. (P1e; plans/primitive-componentization.md)
const REGISTERED_OBJECT_SCHEMAS: Record<string, z.ZodTypeAny> = {};
export function registerObjectSchema(type: string, schema: z.ZodTypeAny): void {
  REGISTERED_OBJECT_SCHEMAS[type] = schema;
}
const registeredObjectFallback = z.custom<HouseObject>((val) => {
  const t = (val as { type?: unknown } | null | undefined)?.type;
  if (typeof t !== "string") return false;
  const s = REGISTERED_OBJECT_SCHEMAS[t];
  return s ? s.safeParse(val).success : false;
});
/** Floor/component object schema: the built-in union, extended by the registry. */
export const objectSchema = z.union([object, registeredObjectFallback]);

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
    objects: z.array(objectSchema),
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
    // Field-projection annotations, used only when the component is `expose`d as a
    // typed primitive (plans/declarative-plugins.md). `kind` is a FieldKind preset
    // (coord/extent/nonneg/int/text/flag/enum); when absent the kind is inferred
    // from the default's type. `unit` is a doc-only unit hint.
    kind: z.string().optional(),
    unit: z.string().optional(),
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
    objects: z.array(objectSchema),
    // Promote this component to a typed primitive at load time
    // (plans/declarative-plugins.md P0). When present, the component registers a
    // NodeDefinition of type `expose.type` whose fields come from `params`; it can
    // then be used like any core object type. `type` is namespaced (`pack.thing`).
    expose: z
      .object({
        type: z.string(),
        label: z.string().optional(),
        layer: z.string().optional(),
      })
      .strict()
      .optional(),
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
    // First-class parametric GUIDES (plans/floor-planner-graph-integration.md).
    // Map of id → a named XOR generated guides object; objects place themselves by
    // referencing a guide in ordinary formulas (`main.x2`, `module.x8`). Optional;
    // reusable across templates. `grids` is the deprecated former name — still
    // read for backward-compat; the resolver merges both (guides wins on collision).
    guides: z.record(z.string(), guidesDef).optional(),
    grids: z.record(z.string(), guidesDef).optional(),
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
    // Catalog metadata that makes a `.wadi` SELF-DESCRIBING: the editorial fields
    // a gallery card needs that can't be derived from geometry (title, blurb,
    // style/roof tags, min plot). With this block + `thumbnails[]`, a folder of
    // `.wadi` files IS the catalog — the app lists the folder and indexes each
    // file, with no separate index.json to maintain (see io/templateSource.ts).
    // Non-strict so newer editorial fields don't break an older build.
    template: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        style: z.string().optional(),
        roof: z.string().optional(),
        minWidthFt: z.number().optional(),
        minLengthFt: z.number().optional(),
        tags: z.array(z.string()).optional(),
        // Cover-image source PATHS, relative to the .wdl dir (desktop resolves them
        // to the top-level `thumbnails` data URLs at compile time). Distinct from
        // the top-level `thumbnails` which holds the inlined data URLs.
        thumbnails: z.array(z.string()).optional(),
      })
      .optional(),
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
// Collect every `unrecognized_keys` issue, RECURSING into `invalid_union` errors.
// Object schemas now live behind a z.union (`objectSchema` — built-in union OR a
// registered primitive's schema), and z.union wraps its branch errors in an
// `invalid_union` issue, hiding the nested `unrecognized_keys` the stripper keys
// off. Descend into `unionErrors`, prefixing the union's own path, so unknown keys
// INSIDE objects are still found. Plain top-level unrecognized_keys are unchanged.
function collectUnrecognized(
  issues: readonly z.core.$ZodIssue[],
  base: PropertyKey[] = [],
): { path: PropertyKey[]; keys: string[] }[] {
  const out: { path: PropertyKey[]; keys: string[] }[] = [];
  for (const i of issues) {
    const p = [...base, ...i.path];
    if (i.code === "unrecognized_keys") {
      out.push({ path: p, keys: [...(i as { keys: readonly string[] }).keys] });
    } else if (i.code === "invalid_union") {
      // Zod v4: `errors` = one issue-array per union branch (paths RELATIVE to the
      // union's own position). Recurse each, prefixing the union path.
      const branches = (i as unknown as { errors?: (readonly z.core.$ZodIssue[])[] }).errors;
      if (Array.isArray(branches)) for (const br of branches) out.push(...collectUnrecognized(br, p));
    }
  }
  return out;
}

function stripUnknownKeys(data: unknown): { data: unknown; stripped: string[] } {
  if (!data || typeof data !== "object") return { data, stripped: [] };
  const cur = JSON.parse(JSON.stringify(data)); // config is JSON — safe deep clone
  const stripped: string[] = [];
  for (let pass = 0; pass < 12; pass++) {
    const res = HouseConfig.safeParse(cur);
    if (res.success) break;
    const unknown = collectUnrecognized(res.error.issues);
    if (unknown.length === 0) break; // remaining errors aren't unknown keys — stop
    for (const issue of unknown) {
      const parent = issue.path.reduce<unknown>(
        (o, k) => (o != null && typeof o === "object" ? (o as Record<string, unknown>)[k as string] : undefined),
        cur,
      );
      if (parent && typeof parent === "object") {
        for (const k of issue.keys) {
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
