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

import { lazy, Suspense } from "react";
import { toThreePos } from "../../three/coords";
import { defaultLayerFor } from "../../three/layers";
import { furnitureUrl } from "../../furniture/catalog";
import { uniqueName } from "../../state/naming";
import { counterToWdl } from "../../../../wadi-dsl/src/generator/fromHouseConfig";
import type { HouseObject } from "../../schema/houseConfig";
import type { NodeDefinition } from "../types";

// Tiled cabinet door fronts (Phase B) — lazy so this headless-safe node never pulls
// three/drei at module load (only when a cabinet counter actually renders in 3D).
const CounterFronts = lazy(() =>
  import("../../three/CounterFronts").then((m) => ({ default: m.CounterFronts })),
);

// The Zod schema (free `counterObject` + nested `roomCounter`) lives in
// schema/houseConfig.ts, like `item`'s — the node contributes CAPABILITIES only
// (render/footprint/emit), so it registers no `schema` of its own.
export const counterNode: NodeDefinition = {
  type: "counter",
  label: "Counter",
  addable: true,
  layerRole: "structure",
  defaultLayerId: "structure",

  emitWdl: (obj) => counterToWdl(obj),

  makeDefault: (cfg, existing) =>
    ({
      type: "counter",
      name: uniqueName(existing, "Counter"),
      x: Math.round(cfg.site.plot_width / 2),
      y: Math.round(cfg.site.plot_length / 2),
      length: 100,
      depth: 22,
      height: 36,
    }) as HouseObject,

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
    // The 3D layer id is per-floor (`f<n>_<role>`); the literal role name is NOT a
    // mounted group, so it must go through defaultLayerFor like item/model do.
    const layerId = (obj.layer as string | undefined) ?? defaultLayerFor("counter", ctx.floorNum);
    const GRANITE = "#3f3f46";

    // Base-cabinet treatment: a distinct countertop slab + carcass body + a recessed
    // toe-kick plinth, instead of one solid block. Sized from the run's height/depth,
    // with optional overrides. Local frame (group at the floor base): Y up, length → X,
    // depth → Z. The plinth is inset on both depth faces (the back one hides in the wall,
    // the front one reads as the toe-kick), so it needs no front-direction detection.
    if (obj.cabinet) {
      const topT = Math.max(1, (obj.top_thickness as number | undefined) ?? Math.min(4, height * 0.15));
      const toe = Math.max(0, (obj.toe_kick as number | undefined) ?? Math.min(8, height * 0.22));
      const toeInset = Math.min(5, depth * 0.25);
      const bodyH = Math.max(0.5, height - topT - toe);
      return {
        layerId,
        node: (
          <group key={ctx.key} position={[c.x, baseZ, c.z]} rotation={[0, yaw, 0]}>
            <mesh position={[0, height - topT / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[length, topT, depth]} />
              <meshStandardMaterial color={GRANITE} roughness={0.6} />
            </mesh>
            <mesh position={[0, toe + bodyH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[length, bodyH, depth]} />
              <meshStandardMaterial color="#8a8a94" roughness={0.75} />
            </mesh>
            <Suspense fallback={null}>
              <CounterFronts
                src={furnitureUrl("cabinet_door")}
                length={length}
                bodyH={bodyH}
                baseY={toe}
                frontZ={-depth / 2}
              />
            </Suspense>
            {toe > 0 && (
              <mesh position={[0, toe / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[length, toe, Math.max(1, depth - 2 * toeInset)]} />
                <meshStandardMaterial color="#2a2a30" roughness={0.85} />
              </mesh>
            )}
          </group>
        ),
      };
    }

    // Solid platform (default) — a single block, the masonry otta.
    return {
      layerId,
      node: (
        <mesh
          key={ctx.key}
          position={[c.x, baseZ + height / 2, c.z]}
          rotation={[0, yaw, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[length, height, depth]} />
          <meshStandardMaterial color={GRANITE} roughness={0.7} />
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
