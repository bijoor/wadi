// `well` registry node — a water well placed at plan centre (x, y). Three shapes:
// circular (diameter), square (width), rectangular (width × length). Renders as a
// FurnitureItem GLB when `asset` is provided; otherwise plan-only.
//
// Headless-pure top level (see item.tsx for the pattern).

import { lazy, Suspense } from "react";
import { toThreePos } from "../../three/coords";
import { metersToUnits as metersToUnits3D } from "../../three/units";
import { defaultLayerFor } from "../../three/layers";
import { WellBox } from "../../three/boxes";
import { wellSchema } from "../../schema/houseConfig";
import { uniqueName } from "../../state/naming";
import type { HouseObject } from "../../schema/houseConfig";
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

export const wellNode: NodeDefinition = {
  type: "well",
  label: "Well",
  addable: true,
  layerRole: "site",

  schema: wellSchema,

  makeDefault: (cfg, existing) =>
    ({
      type: "well",
      name: uniqueName(existing, "Well"),
      x: Math.round(cfg.site.plot_width / 2),
      y: Math.round(cfg.site.plot_length / 2),
      shape: "circular",
      diameter: 30,
    }) as unknown as HouseObject,

  render3D: (obj, ctx) => {
    const asset = obj.asset as ItemAssetShape | undefined;
    const x = obj.x as number, y = obj.y as number;
    const c = toThreePos(x, y, 0, ctx.plot.width, ctx.plot.length);
    const baseY = ctx.band.slabZ + ((obj.z_offset as number | undefined) ?? 0);
    const layerId = (obj.layer as string | undefined) ?? defaultLayerFor("well", ctx.floorNum);

    if (asset?.dimensions) {
      const unitsScale = metersToUnits3D(1, ctx.unitsRef);
      return {
        layerId,
        node: (
          <Suspense key={ctx.key} fallback={null}>
            <FurnitureItem
              src={asset.src}
              dimensions={asset.dimensions}
              offset={asset.offset}
              corrRotation={asset.corrRotation}
              corrScale={asset.corrScale}
              cx={c.x}
              cz={c.z}
              baseY={baseY}
              yawDeg={(obj.rotation as number | undefined) ?? 0}
              userScale={1}
              unitsScale={unitsScale}
            />
          </Suspense>
        ),
      };
    }

    const shape = (obj.shape as string | undefined) ?? "circular";
    const ph = (obj.parapet_height as number | undefined) ?? 10;
    const diam = shape === "circular"
      ? (obj.diameter as number | undefined) ?? 30
      : (obj.width as number | undefined) ?? 30;
    return {
      layerId,
      node: <WellBox key={ctx.key} cx={c.x} cz={c.z} diameter={diam} parapetHeight={ph} z={baseY} />,
    };
  },

  planFootprint: (obj) => {
    const shape = (obj.shape as string | undefined) ?? "circular";
    let w: number, d: number;
    if (shape === "circular") {
      const diam = (obj.diameter as number | undefined) ?? 30;
      w = diam;
      d = diam;
    } else if (shape === "square") {
      const side = (obj.width as number | undefined) ?? 30;
      w = side;
      d = side;
    } else {
      w = (obj.width as number | undefined) ?? 30;
      d = (obj.length as number | undefined) ?? 30;
    }
    return {
      cx: obj.x as number,
      cy: obj.y as number,
      w,
      d,
      rot: (obj.rotation as number | undefined) ?? 0,
      label: (obj.name as string | undefined) ?? "Well",
    };
  },
};
