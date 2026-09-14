// Counter — the first PARAMETRIC furniture element (plans/parametric-furniture-elements.md).
// Replaces the ad-hoc `kitchen_platform` primitive: a continuous, arbitrarily sized slab
// (kitchen platform / otta, bathroom vanity, utility run) whose mesh and footprint come
// from its own scalar params (length/depth/height) instead of a GLB. Unlike the old
// primitive it is placed LIKE furniture — anchored to a room wall (anchor + gap) and
// auto-placeable — because it implements the shared `furniture` capability. L / U shapes
// are authored as multiple runs (one per wall).
//
// Local frame (rotation 0 = anchored to the north wall, facing south): `length` runs
// along local X (along the wall), `depth` projects along local Y (into the room). The
// anchor's facing (anchorFacing) then orients the run to whichever wall it hugs, so
// `length` always means "along the wall" and `depth` "into the room" for any wall.
//
// IMPORTANT: like item.tsx this module is imported by the HEADLESS 2D engine (floorPlan →
// registry), so top-level imports stay pure (no three.js). The 3D branch returns R3F
// intrinsic JSX (string tags — no three import); it only executes in the browser.

import { z } from "zod";
import { toThreePos } from "../../three/coords";
import { uniqueName } from "../../state/naming";
import { counterToWdl } from "../../../../wadi-dsl/src/generator/fromHouseConfig";
import type { HouseObject } from "../../schema/houseConfig";
import type { NodeDefinition } from "../types";

const counterAnchor = z.enum([
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
]);

// Zod schema — pushed into the config union via registerNode (registration-push).
const counterSchema = z
  .object({
    type: z.literal("counter"),
    formulas: z.record(z.string(), z.string()).optional(),
    enabled: z.union([z.boolean(), z.number()]).optional(),
    layer: z.string().optional(),
    locked: z.boolean().optional(),
    name: z.string().optional(),
    // Plan centre (project units). Optional: DERIVED at expand time when anchored to a
    // room (anchor_to); authored via `at (x, y)` for a free-standing run.
    x: z.number().optional(),
    y: z.number().optional(),
    rotation: z.number().optional(), // yaw, degrees (default = the anchor's facing)
    // Run geometry (project units). `length` is optional: when omitted it defaults to the
    // anchored wall's clear span (filled at expand), so a counter auto-fills its wall.
    length: z.number().positive().optional(),
    depth: z.number().positive(),
    height: z.number().positive(),
    z_offset: z.number().optional(), // lift above the floor base (default = slab thickness)
    base_z: z.number().optional(),   // ABSOLUTE base Z override (wins over z_offset)
    material: z.string().optional(),
    // Room-relative anchoring (mirrors item): follow a named room's wall.
    anchor_to: z.string().optional(),
    anchor: counterAnchor.optional(),
    gap_x: z.number().optional(),
    gap_y: z.number().optional(),
  })
  .strict();

export const counterNode: NodeDefinition = {
  type: "counter",
  label: "Counter",
  addable: true,
  schema: counterSchema,
  layerRole: "structure",
  defaultLayerId: "structure",

  emitWdl: (obj) => counterToWdl(obj),

  // `counter` is a registry-only type (not in the built-in HouseObject union — it
  // self-registers via registerObjectSchema), so cast through unknown.
  makeDefault: (cfg, existing) =>
    ({
      type: "counter",
      name: uniqueName(existing, "Counter"),
      x: Math.round(cfg.site.plot_width / 2),
      y: Math.round(cfg.site.plot_length / 2),
      length: 100,
      depth: 22,
      height: 36,
    }) as unknown as HouseObject,

  // Parametric furniture element: footprint in PROJECT UNITS, local frame (length = X,
  // depth = Y). A wall run whose length auto-fills the wall span when not authored.
  furniture: {
    placement: "wall",
    footprint: (obj, ctx) => {
      const length = (obj.length as number | undefined) ?? ctx.wallSpan;
      const depth = obj.depth as number | undefined;
      if (length == null || depth == null) return null;
      return { w: length, l: depth };
    },
  },

  render3D: (obj, ctx) => {
    const length = obj.length as number | undefined;
    const depth = obj.depth as number | undefined;
    const height = obj.height as number | undefined;
    const x = obj.x as number | undefined;
    const y = obj.y as number | undefined;
    if (length == null || depth == null || height == null || x == null || y == null) return null;
    const baseZ =
      (obj.base_z as number | undefined) ??
      ctx.band.slabZ + ((obj.z_offset as number | undefined) ?? ctx.band.slabThickness);
    const c = toThreePos(x, y, 0, ctx.plot.width, ctx.plot.length);
    // yaw°: config rotation is a world yaw about +Z (down); three's Y is inverted, so a
    // world yaw of `r` degrees is -r radians about the three Y axis. length → box local X,
    // depth → box local Z.
    const yaw = (-((obj.rotation as number | undefined) ?? 0) * Math.PI) / 180;
    return {
      layerId: (obj.layer as string | undefined) ?? "structure",
      node: (
        <mesh
          key={ctx.key}
          position={[c.x, baseZ + height / 2, c.z]}
          rotation={[0, yaw, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[length, height, depth]} />
          <meshStandardMaterial color="#3f3f46" roughness={0.7} />
        </mesh>
      ),
    };
  },

  planFootprint: (obj) => {
    const length = obj.length as number | undefined;
    const depth = obj.depth as number | undefined;
    if (length == null || depth == null) return null;
    return {
      cx: obj.x as number,
      cy: obj.y as number,
      w: length,
      d: depth,
      rot: (obj.rotation as number | undefined) ?? 0,
      label: obj.name as string | undefined,
    };
  },
};
