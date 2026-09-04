// `solar_panel` registry node — a solar array placed at plan centre (x, y).
// Footprint comes from the asset dimensions (metres → project units) when an asset
// is present, or falls back to a 10-panel default box (w=33, d=17 project units).
// Renders as a FurnitureItem GLB when `asset` is provided; otherwise plan-only.
//
// Headless-pure top level (see item.tsx for the pattern).

import { lazy, Suspense } from "react";
import { toThreePos } from "../../three/coords";
import { metersToUnits as metersToUnits3D } from "../../three/units";
import { defaultLayerFor } from "../../three/layers";
import { SolarPanelBox } from "../../three/boxes";
import { metersToUnits as metersToUnitsPlan } from "../../svg2d/format";
import { solarPanelSchema } from "../../schema/houseConfig";
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

export const solarPanelNode: NodeDefinition = {
  type: "solar_panel",
  label: "Solar Panel",
  addable: true,
  layerRole: "site",

  schema: solarPanelSchema,

  makeDefault: (cfg, existing) =>
    ({
      type: "solar_panel",
      name: uniqueName(existing, "Solar Panel"),
      x: Math.round(cfg.site.plot_width / 2),
      y: 80,
      mount: "roof",
      capacity_kw: 3.5,
    }) as unknown as HouseObject,

  render3D: (obj, ctx) => {
    const asset = obj.asset as ItemAssetShape | undefined;
    const x = obj.x as number, y = obj.y as number;
    const mount = (obj.mount as string | undefined) ?? "roof";
    // Roof panels sit at wall-top (ridge level); ground panels start at slab.
    const baseY = mount === "roof"
      ? ctx.band.wallTop
      : ctx.band.slabZ + ((obj.z_offset as number | undefined) ?? 0);
    const c = toThreePos(x, y, 0, ctx.plot.width, ctx.plot.length);
    const layerId = (obj.layer as string | undefined) ?? defaultLayerFor("solar_panel", ctx.floorNum);

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
              userScale={(obj.scale as number | undefined) ?? 1}
              unitsScale={unitsScale}
            />
          </Suspense>
        ),
      };
    }

    return {
      layerId,
      node: (
        <SolarPanelBox
          key={ctx.key}
          cx={c.x}
          cz={c.z}
          width={33}
          depth={17}
          y={baseY}
          tiltDeg={(obj.tilt as number | undefined) ?? 15}
          azimuthDeg={(obj.azimuth as number | undefined) ?? 180}
        />
      ),
    };
  },

  planFootprint: (obj) => {
    const asset = obj.asset as ItemAssetShape | undefined;
    let w: number, d: number;
    if (asset?.dimensions) {
      w = metersToUnitsPlan(asset.dimensions[0]);
      d = metersToUnitsPlan(asset.dimensions[2]);
    } else {
      w = 33;
      d = 17;
    }
    return {
      cx: obj.x as number,
      cy: obj.y as number,
      w,
      d,
      rot: (obj.rotation as number | undefined) ?? 0,
      label: (obj.name as string | undefined) ?? "Solar Panel",
    };
  },
};
