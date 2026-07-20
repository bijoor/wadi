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

const site = z
  .object({
    reference_x: z.number(),
    reference_y: z.number(),
    plot_length: positive(),
    plot_width: positive(),
  })
  .strict();

const plinth = z
  .object({
    x: z.number(),
    y: z.number(),
    length: positive(),
    width: positive(),
    height: positive(),
  })
  .strict();

const opening = z
  .object({
    kind: z.enum(["door", "window"]),
    name: z.string().optional(),
    offset: nonNegative(),
    width: positive(),
    height: positive(),
    sill_height: z.number().optional(),
    direction: side.optional(),
    facing: side.optional(),
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
    layer: z.string().optional(),
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
    layer: z.string().optional(),
    name: z.string(),
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
    layer: z.string().optional(),
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

const room = z
  .object({
    type: z.literal("room"),
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
  })
  .strict();
export type Room = z.infer<typeof room>;

const wall = z
  .object({
    type: z.literal("wall"),
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
    layer: z.string().optional(),
    start_x: z.number(),
    start_y: z.number(),
    num_steps: z.number().int().positive(),
    step_rise: positive(),
    step_tread: positive(),
    step_width: positive(),
    direction: side,
    // Vertical position of the stair's FIRST step, as a lift above the
    // FLOOR BASE (slabZ; project units, 10 = 1 ft). Omitted → defaults to
    // the floor's resolved slab thickness, so it sits on the walking surface
    // as before. Set it for a second flight starting at a mid-height
    // landing — e.g. z_offset = slab_thickness + flight-1 num_steps ×
    // step_rise. Same convention as `room`.
    z_offset: z.number().optional(),
    material: z.string().optional(),
  })
  .strict();

// Flat door/window remain valid as a legacy schema — new configs nest
// them inside room.walls[side].openings or wall.openings.
const door = z
  .object({
    type: z.literal("door"),
    layer: z.string().optional(),
    name: z.string(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    height: positive(),
    direction: side,
    room: z.string().optional(),
    wall: z.string().optional(),
  })
  .strict();

const windowObj = z
  .object({
    type: z.literal("window"),
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
  })
  .strict();

// Roof schemas kept permissive — their structure (framing, trusses,
// ridge_ventilation) is fairly involved and validated inside
// create_hip_roof. The editor treats them as opaque object payloads for
// now; Phase 5 can add a dedicated roof editor.
const hipRoof = z
  .object({
    type: z.literal("hip_roof"),
  })
  .catchall(z.unknown());

const gableRoof = z
  .object({
    type: z.literal("gable_roof"),
  })
  .catchall(z.unknown());

const flatRoof = z
  .object({
    type: z.literal("flat_roof"),
  })
  .catchall(z.unknown());

const shedRoof = z
  .object({
    type: z.literal("shed_roof"),
  })
  .catchall(z.unknown());

// v2 roof — unified segment-based type that replaces hip/gable/flat/shed.
// Schema is permissive; the v2 pipeline (svg2d/roof/v2/) validates
// segments + slope + endpoint style at derivation time.
const roofV2 = z
  .object({
    type: z.literal("roof"),
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

export const object = z.discriminatedUnion("type", [
  floorSlab,
  pillar,
  beam,
  room,
  wall,
  staircase,
  door,
  windowObj,
  kitchenPlatform,
  hipRoof,
  gableRoof,
  flatRoof,
  shedRoof,
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
    objects: z.array(object),
  })
  .strict();
export type Floor = z.infer<typeof floor>;

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
  })
  .strict();
export type LayerDef = z.infer<typeof layerDef>;

export const HouseConfig = z
  .object({
    site,
    plinth,
    defaults: houseDefaults.optional(),
    units: houseUnits.optional(),
    // Configurable 3D visibility layers (optional; defaults applied when
    // absent). Objects opt in via their own `layer` field.
    layers: z.array(layerDef).optional(),
    floors: z.array(floor).min(1),
    _walls_expanded: z.boolean().optional(),
  })
  .strict();

export type HouseConfig = z.infer<typeof HouseConfig>;

export function validate(data: unknown): {
  ok: boolean;
  data?: HouseConfig;
  errors?: { path: string; message: string }[];
} {
  const result = HouseConfig.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => ({
      path: i.path.join("/") || "(root)",
      message: i.message,
    })),
  };
}
