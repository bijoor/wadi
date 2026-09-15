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

import { lazy, Suspense, type ReactNode } from "react";
import { toThreePos } from "../../three/coords";
import { defaultLayerFor } from "../../three/layers";
import { metersToUnits } from "../../three/units";
import { furnitureUrl, furnitureAsset } from "../../furniture/catalog";
import { uniqueName } from "../../state/naming";
import { counterToWdl } from "../../../../wadi-dsl/src/generator/fromHouseConfig";
import type { HouseObject } from "../../schema/houseConfig";
import type { NodeDefinition } from "../types";

// Tiled cabinet door fronts (Phase B) + the GLB fixture renderer (Phase C, a sink/hob
// seated on the top) — lazy so this headless-safe node never pulls three/drei at module
// load (only when a counter actually renders in 3D).
const CounterFronts = lazy(() =>
  import("../../three/CounterFronts").then((m) => ({ default: m.CounterFronts })),
);
const FurnitureItem = lazy(() =>
  import("../../three/FurnitureItem").then((m) => ({ default: m.FurnitureItem })),
);
const CounterTop = lazy(() =>
  import("../../three/CounterTop").then((m) => ({ default: m.CounterTop })),
);

// The kitchen_sink_bare bowl RIM outline, derived from the GLB in Blender (convex hull of
// the bowl, projected to plan), normalised to the model footprint (nx,ny in [-0.5..0.5]
// relative to the model bbox centre; nx = width, ny = Blender depth). Used to cut a
// bowl-shaped hole in the countertop that matches the recessed sink.
const SINK_BOWL_HULL: [number, number][] = [
  [-0.5, -0.3223], [-0.4786, -0.4112], [-0.4204, -0.4762], [-0.3409, -0.5], [0.3409, -0.5],
  [0.4204, -0.4762], [0.4786, -0.4112], [0.5, -0.3223], [0.5, -0.0278], [0.4786, 0.0611],
  [0.4204, 0.1262], [0.2342, 0.2942], [0.1676, 0.2948], [-0.1676, 0.2948], [-0.2342, 0.2942],
  [-0.4204, 0.1262], [-0.4786, 0.0611], [-0.5, -0.0278],
];

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
    const unitsScale = metersToUnits(1, ctx.unitsRef);

    // Everything lives in ONE group at the run's floor base (Y up, length → local X,
    // depth → local Z, front/room face = +local Z). Children are placed in that frame.
    const parts: ReactNode[] = [];

    // A sink recesses INTO the top: cut a BOWL-SHAPED hole in the countertop (the sink's
    // rim outline, derived from the GLB), and drop the sink so only the bowl sinks — the
    // rim sits at the top and the faucet stays above it.
    const hasSink = !!obj.sink;
    const sinkOff = (obj.sink_offset as number | undefined) ?? 0;
    // The sink GLB is scaled down (SINK_SCALE) to leave a margin on the counter. The rim
    // sits AT the counter top: drop by the rim height only (~34% of the model height).
    const SINK_SCALE = 0.8;
    const sd = furnitureAsset("kitchen_sink_bare").dimensions;
    const sinkW = SINK_SCALE * metersToUnits(sd[0], ctx.unitsRef);
    const sinkDp = SINK_SCALE * metersToUnits(sd[2], ctx.unitsRef);
    const sinkDrop = 0.34 * SINK_SCALE * metersToUnits(sd[1], ctx.unitsRef);
    // Bowl outline in counter-local (x, z): scale the normalised hull to the placed sink
    // footprint and apply the sink's 180° yaw (which flips X and Z; the bowl lands on -Z),
    // then offset to the sink position along the run.
    const holePts = hasSink
      ? SINK_BOWL_HULL.map(([nx, ny]) => ({ x: sinkOff - nx * sinkW, z: ny * sinkDp }))
      : undefined;
    // Countertop slab: a bowl-shaped hole (extruded THREE.Shape) when there's a sink, else
    // a plain box. `bottomY` is the slab underside.
    const topSlab = (bottomY: number, thickness: number, color: string, rough: number): ReactNode =>
      holePts ? (
        <Suspense key="top" fallback={null}>
          <CounterTop length={length} depth={depth} thickness={thickness} bottomY={bottomY} color={color} roughness={rough} hole={holePts} />
        </Suspense>
      ) : (
        <mesh key="top" position={[0, bottomY + thickness / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[length, thickness, depth]} />
          <meshStandardMaterial color={color} roughness={rough} />
        </mesh>
      );

    // Base geometry: the base-cabinet treatment (countertop slab + carcass body + recessed
    // toe-kick plinth) or a single solid block (the masonry otta). The plinth is inset on
    // both depth faces (the back hides in the wall, the front reads as the toe-kick).
    if (obj.cabinet) {
      const topT = Math.max(1, (obj.top_thickness as number | undefined) ?? Math.min(4, height * 0.15));
      const toe = Math.max(0, (obj.toe_kick as number | undefined) ?? Math.min(8, height * 0.22));
      const toeInset = Math.min(5, depth * 0.25);
      const bodyH = Math.max(0.5, height - topT - toe);
      parts.push(topSlab(height - topT, topT, GRANITE, 0.6));
      parts.push(
        <mesh key="body" position={[0, toe + bodyH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[length, bodyH, depth]} />
          <meshStandardMaterial color="#8a8a94" roughness={0.75} />
        </mesh>,
        <Suspense key="fronts" fallback={null}>
          <CounterFronts src={furnitureUrl("cabinet_door")} length={length} bodyH={bodyH} baseY={toe} frontZ={depth / 2} />
        </Suspense>,
      );
      if (toe > 0) {
        parts.push(
          <mesh key="toe" position={[0, toe / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[length, toe, Math.max(1, depth - 2 * toeInset)]} />
            <meshStandardMaterial color="#2a2a30" roughness={0.85} />
          </mesh>,
        );
      }
    } else {
      parts.push(topSlab(0, height, GRANITE, 0.7));
    }

    // Fixtures (Phase C): a sink (bowl + faucet) recessed into the top, and/or a gas
    // cooktop seated on the top, at an offset along the run (local X, 0 = centred). GLBs
    // auto-scale to their catalog dims. The sink is turned so its faucet sits at the back.
    const fixture = (id: string, offX: number, yawDeg: number, baseY: number, scale: number) => {
      const a = furnitureAsset(id);
      return (
        <Suspense key={id} fallback={null}>
          <FurnitureItem src={a.src} dimensions={a.dimensions} cx={offX} cz={0} baseY={baseY} yawDeg={yawDeg} userScale={scale} unitsScale={unitsScale} />
        </Suspense>
      );
    };
    // Sink: rim at the top (drop = rim height), scaled down. Hob: sits on the top.
    if (obj.sink) parts.push(fixture("kitchen_sink_bare", sinkOff, 180, height - sinkDrop, SINK_SCALE));
    if (obj.hob) parts.push(fixture("cooktop_hob", (obj.hob_offset as number | undefined) ?? 0, 0, height, 1));

    return {
      layerId,
      node: (
        <group key={ctx.key} position={[c.x, baseZ, c.z]} rotation={[0, yaw, 0]}>
          {parts}
        </group>
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
