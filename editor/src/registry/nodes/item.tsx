// GLB furniture (`item`) — the reference registry node. Everything about the type
// lives here: its default, its form, its 3D render, its 2D footprint, its layer. The
// dispatchers just call these; nothing item-specific remains scattered in House3D /
// floorPlan / defaultFactory / layers / PropertyPanel.
//
// IMPORTANT: this module is imported by the HEADLESS 2D engine (floorPlan →
// registry) as well as the 3D/React app, so its TOP-LEVEL imports must stay pure
// (no three.js / React-DOM). The heavy 3D component + the form are pulled in LAZILY
// (only when actually rendered in the browser), keeping svg2d importable without three.

import { lazy, Suspense } from "react";
import { toThreePos } from "../../three/coords";
import { metersToUnits as metersToUnits3D } from "../../three/units";
import { defaultLayerFor } from "../../three/layers";
import { metersToUnits as metersToUnitsPlan } from "../../svg2d/format";
import { furnitureAsset, DEFAULT_FURNITURE_ID } from "../../furniture/catalog";
import { uniqueName } from "../../state/naming";
// Decompiler for this primitive: the shared PURE string builder in the sibling
// wadi-dsl emitter (imported by relative path — the same cross-package convention
// wadi-dsl uses to reach editor/src; fromHouseConfig is headless-pure, so this keeps
// the node headless-safe). The DSL switch and this `emitWdl` call the ONE builder —
// no drift, and no build alias needed since a relative path resolves everywhere.
import { itemToWdl } from "../../../../wadi-dsl/src/generator/fromHouseConfig";
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

export const itemNode: NodeDefinition = {
  type: "item",
  label: "Furniture",
  addable: true,
  defaultLayerId: "furniture",

  // Decompile: own the bespoke `item … at (x, y) …` line (the editor injects this
  // via fromHouseConfig's per-object hook; headless keeps the same builder).
  emitWdl: (obj) => itemToWdl(obj),

  makeDefault: (cfg, existing) => {
    return {
      type: "item",
      name: uniqueName(existing, "Furniture"),
      asset: furnitureAsset(DEFAULT_FURNITURE_ID),
      x: Math.round(cfg.site.plot_width / 2),
      y: Math.round(cfg.site.plot_length / 2),
      rotation: 0,
    } as HouseObject;
  },

  render3D: (obj, ctx) => {
    const asset = obj.asset as ItemAssetShape | undefined;
    if (!asset?.dimensions) return null;
    const x = obj.x as number, y = obj.y as number;
    const baseZ = ctx.band.slabZ + ((obj.z_offset as number | undefined) ?? ctx.band.slabThickness);
    const c = toThreePos(x, y, 0, ctx.plot.width, ctx.plot.length);
    const unitsScale = metersToUnits3D(1, ctx.unitsRef);
    return {
      layerId: (obj.layer as string | undefined) ?? defaultLayerFor("item", ctx.floorNum),
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
