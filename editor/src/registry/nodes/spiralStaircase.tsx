// `spiral_staircase` registry node (P5) — the first primitive contributed entirely
// through the framework. Schema / form / docs / DSL all derive from its `fields`
// (schema/fields/spiralStaircase); THIS file adds the capabilities: 3D render + 2D
// plan footprint + its layer + add-menu default.
//
// Headless-pure top level (imported by the 2D engine via the registry): the heavy
// R3F component is pulled in LAZILY, exactly like the `item` node.

import { lazy, Suspense } from "react";
import { toThreePos } from "../../three/coords";
import { defaultLayerFor } from "../../three/layers";
import { uniqueName } from "../../state/naming";
import { spiralStaircaseFields } from "../../schema/fields/spiralStaircase";
import { SPIRAL_POLE } from "./spiralStaircase.constraints";
import { spiralStaircaseToWdl } from "../../../../wadi-dsl/src/generator/fromHouseConfig"; // shared pure decompiler builder (see item.tsx)
import type { HouseObject } from "../../schema/houseConfig";
import type { NodeDefinition } from "../types";

const SpiralStaircase = lazy(() =>
  import("../../three/SpiralStaircase").then((m) => ({ default: m.SpiralStaircase })),
);

export const spiralStaircaseNode: NodeDefinition = {
  type: "spiral_staircase",
  label: "Spiral staircase",
  addable: true,
  layerRole: "structure",
  fields: spiralStaircaseFields, // → AutoForm (no bespoke Form needed)
  constraints: [SPIRAL_POLE], // per-primitive rule (P5) — merged into allConstraints()

  // Decompile: own the bespoke `spiral_staircase … radius … total_height …` line.
  emitWdl: (obj) => spiralStaircaseToWdl(obj),

  makeDefault: (cfg, existing) =>
    ({
      type: "spiral_staircase",
      name: uniqueName(existing, "Spiral"),
      x: Math.round(cfg.site.plot_width / 2),
      y: Math.round(cfg.site.plot_length / 2),
      radius: 40,
      total_height: 108,
      turns: 1.5,
    }) as HouseObject,

  render3D: (obj, ctx) => {
    const radius = obj.radius as number | undefined;
    const total = obj.total_height as number | undefined;
    if (!radius || !total) return null;
    const x = obj.x as number, y = obj.y as number;
    const baseY = ctx.band.slabZ + ((obj.z_offset as number | undefined) ?? ctx.band.slabThickness);
    const c = toThreePos(x, y, 0, ctx.plot.width, ctx.plot.length);
    return {
      layerId: (obj.layer as string | undefined) ?? defaultLayerFor("spiral_staircase", ctx.floorNum),
      node: (
        <Suspense key={ctx.key} fallback={null}>
          <SpiralStaircase
            cx={c.x}
            cz={c.z}
            baseY={baseY}
            radius={radius}
            totalHeight={total}
            turns={obj.turns as number | undefined}
            steps={obj.steps as number | undefined}
            treadThickness={obj.tread_thickness as number | undefined}
            poleRadius={obj.pole_radius as number | undefined}
          />
        </Suspense>
      ),
    };
  },

  // Plan footprint: the outer-radius bounding square, centred on (x, y).
  planFootprint: (obj) => {
    const radius = obj.radius as number | undefined;
    if (!radius) return null;
    return {
      cx: obj.x as number,
      cy: obj.y as number,
      w: 2 * radius,
      d: 2 * radius,
      label: (obj.name as string | undefined) ?? "Spiral",
    };
  },
};
