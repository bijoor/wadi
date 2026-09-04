// `compound_wall` registry node — a perimeter / boundary wall placed as a box
// (x, y = top-left corner, width east, length south). Renders as a FurnitureItem
// GLB when an `asset` is provided; otherwise appears only on the 2D plan.
//
// Headless-pure top level (imported by the 2D engine via the registry): the heavy
// R3F component is pulled in LAZILY, exactly like the `item` node.

import { lazy, Suspense } from "react";
import { toThreePos } from "../../three/coords";
import { metersToUnits as metersToUnits3D } from "../../three/units";
import { defaultLayerFor } from "../../three/layers";
import { CompoundWallBox } from "../../three/boxes";
import { compoundWallSchema } from "../../schema/houseConfig";
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

export const compoundWallNode: NodeDefinition = {
  type: "compound_wall",
  label: "Compound Wall",
  addable: true,
  layerRole: "walls",

  schema: compoundWallSchema,

  makeDefault: (cfg, existing) =>
    ({
      type: "compound_wall",
      name: uniqueName(existing, "Compound Wall"),
      x: Math.round(cfg.site.plot_width / 2) - 100,
      y: Math.round(cfg.site.plot_length / 2) - 4,
      width: 200,
      length: 8,
      height: 50,
    }) as unknown as HouseObject,

  render3D: (obj, ctx) => {
    const asset = obj.asset as ItemAssetShape | undefined;
    const cx = (obj.x as number) + (obj.width as number) / 2;
    const cy = (obj.y as number) + (obj.length as number) / 2;
    const w = obj.width as number;
    const d = obj.length as number;
    const h = obj.height as number;
    const c = toThreePos(cx, cy, 0, ctx.plot.width, ctx.plot.length);
    const baseY = ctx.band.slabZ + ((obj.z_offset as number | undefined) ?? 0);
    const layerId = (obj.layer as string | undefined) ?? defaultLayerFor("compound_wall", ctx.floorNum);

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

    return {
      layerId,
      node: <CompoundWallBox key={ctx.key} cx={c.x} cz={c.z} width={w} depth={d} z={baseY} height={h} />,
    };
  },

  planFootprint: (obj) => {
    const w = obj.width as number;
    const d = obj.length as number;
    return {
      cx: (obj.x as number) + w / 2,
      cy: (obj.y as number) + d / 2,
      w,
      d,
      rot: (obj.rotation as number | undefined) ?? 0,
      label: (obj.name as string | undefined) ?? "Compound Wall",
    };
  },

  emitWdl(obj) {
    const n = obj.name != null ? ` ${/^[A-Za-z_]\w*$/.test(String(obj.name)) ? obj.name : JSON.stringify(obj.name)}` : "";
    let s = `compound_wall${n} at (${obj.x}, ${obj.y}) size (${obj.width}, ${obj.length}) height ${obj.height}`;
    if (obj.thickness != null) s += `\n  thickness ${obj.thickness}`;
    if (obj.material != null) s += `\n  material ${JSON.stringify(obj.material)}`;
    if (obj.rotation != null) s += `\n  rotation ${obj.rotation}`;
    if (obj.z_offset != null) s += `\n  z_offset ${obj.z_offset}`;
    if (obj.enabled != null) s += `\n  enabled ${obj.enabled}`;
    if (obj.layer != null) s += `\n  layer ${JSON.stringify(obj.layer)}`;
    return s;
  },
};
