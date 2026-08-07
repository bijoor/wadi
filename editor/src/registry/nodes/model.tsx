// GLB model with a node RIG (`model` object; plans/declarative-plugins.md P1). Loads a
// GLB like `item`, but manipulates its NAMED nodes (move/hide/recolour/array) from the
// object's `rig`. Distinct type from `item` (which keeps furniture semantics: catalog +
// anchoring). Rendered by the shared FurnitureItem component with a `rig` prop.
//
// Like item.tsx, this module is imported by the HEADLESS 2D engine, so top-level imports
// stay pure (no three / React-DOM); the 3D component is pulled in LAZILY.

import { lazy, Suspense } from "react";
import { toThreePos } from "../../three/coords";
import { metersToUnits as metersToUnits3D } from "../../three/units";
import { defaultLayerFor } from "../../three/layers";
import { metersToUnits as metersToUnitsPlan } from "../../svg2d/format";
import type { RigOp } from "../../three/rig";
import type { NodeDefinition } from "../types";

const FurnitureItem = lazy(() =>
  import("../../three/FurnitureItem").then((m) => ({ default: m.FurnitureItem })),
);

interface ItemAssetShape {
  src: string;
  name?: string;
  dimensions: [number, number, number];
  offset?: [number, number, number];
  corrRotation?: [number, number, number];
  corrScale?: [number, number, number];
}

export const modelNode: NodeDefinition = {
  type: "model",
  label: "Model",
  // Not offered in the "+ Add" menu: a model needs a GLB asset, so it is authored in the
  // DSL (`model asset { … } { rig }`) or placed by a plugin, not spawned blank.
  addable: false,
  layerRole: "structure",

  render3D: (obj, ctx) => {
    const asset = obj.asset as ItemAssetShape | undefined;
    if (!asset?.dimensions) return null;
    const x = obj.x as number, y = obj.y as number;
    const baseZ = ctx.band.slabZ + ((obj.z_offset as number | undefined) ?? ctx.band.slabThickness);
    const c = toThreePos(x, y, 0, ctx.plot.width, ctx.plot.length);
    const unitsScale = metersToUnits3D(1, ctx.unitsRef);
    return {
      layerId: (obj.layer as string | undefined) ?? defaultLayerFor("model", ctx.floorNum),
      node: (
        <Suspense key={ctx.key} fallback={null}>
          <FurnitureItem
            src={asset.src}
            dimensions={asset.dimensions}
            offset={asset.offset}
            corrRotation={asset.corrRotation}
            corrScale={asset.corrScale}
            rig={obj.rig as RigOp[] | undefined}
            cx={c.x}
            cz={c.z}
            baseY={baseZ}
            yawDeg={(obj.rotation as number | undefined) ?? 0}
            userScale={(obj.scale as number | undefined) ?? 1}
            unitsScale={unitsScale}
          />
        </Suspense>
      ),
    };
  },

  planFootprint: (obj) => {
    const asset = obj.asset as ItemAssetShape | undefined;
    if (!asset?.dimensions) return null;
    return {
      cx: obj.x as number,
      cy: obj.y as number,
      w: metersToUnitsPlan(asset.dimensions[0]),
      d: metersToUnitsPlan(asset.dimensions[2]),
      rot: (obj.rotation as number | undefined) ?? 0,
      label: (obj.name as string | undefined) ?? asset.name,
    };
  },
};
