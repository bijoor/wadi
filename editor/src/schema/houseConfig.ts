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
    x: z.number(),
    y: z.number(),
    width: positive(),
    length: positive(),
  })
  .strict();

const pillar = z
  .object({
    type: z.literal("pillar"),
    name: z.string(),
    x: z.number(),
    y: z.number(),
    // width or length may be absent — see create_pillar.
    width: positive().optional(),
    length: positive().optional(),
    height: positive(),
  })
  .strict();

const beam = z
  .object({
    type: z.literal("beam"),
    x: z.number(),
    y: z.number(),
    width: positive(),
    length: positive(),
    z_offset_ft: z.number().optional(),
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
    name: z.string(),
    x: z.number(),
    y: z.number(),
    width: positive(),
    length: positive(),
    height: positive().optional(),
    material: z.string().optional(),
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
    name: z.string(),
    start_x: z.number(),
    start_y: z.number(),
    end_x: z.number(),
    end_y: z.number(),
    height: positive().optional(),
    height_end: z.number().optional(),
    material: z.string().optional(),
    facing: side.optional(),
    openings: z.array(opening).optional(),
  })
  .strict();
export type Wall = z.infer<typeof wall>;

const staircase = z
  .object({
    type: z.literal("staircase"),
    start_x: z.number(),
    start_y: z.number(),
    num_steps: z.number().int().positive(),
    step_rise: positive(),
    step_tread: positive(),
    step_width: positive(),
    direction: side,
    material: z.string().optional(),
  })
  .strict();

// Flat door/window remain valid as a legacy schema — new configs nest
// them inside room.walls[side].openings or wall.openings.
const door = z
  .object({
    type: z.literal("door"),
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

export const object = z.discriminatedUnion("type", [
  floorSlab,
  pillar,
  beam,
  room,
  wall,
  staircase,
  door,
  windowObj,
  hipRoof,
  gableRoof,
]);
export type HouseObject = z.infer<typeof object>;

const floor = z
  .object({
    floor_number: z.number().int().nonnegative(),
    name: z.string(),
    // Per-floor overrides for the default floor_heights in GlobalConfig.
    // Height = wall height on that floor in project units (10 units = 1 ft).
    // Slab thickness = the horizontal slab between this floor and the one
    // above. Both fall back to GlobalConfig defaults when omitted.
    height: z.number().positive().optional(),
    slab_thickness: z.number().nonnegative().optional(),
    objects: z.array(object),
  })
  .strict();
export type Floor = z.infer<typeof floor>;

// House-level overrides for the built-in GlobalConfig defaults. Every
// floor without its own `.height` / `.slab_thickness` falls back to
// these; if these are absent too, the code defaults in
// DEFAULT_GLOBAL_CONFIG apply.
const houseDefaults = z
  .object({
    floor_height: z.number().positive().optional(),
    slab_thickness: z.number().nonnegative().optional(),
  })
  .strict();

export const HouseConfig = z
  .object({
    site,
    plinth,
    defaults: houseDefaults.optional(),
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
