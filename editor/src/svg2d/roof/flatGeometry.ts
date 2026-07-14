// Flat-roof geometry — horizontal slab covering the footprint at
// wall_top_z + slab_thickness. Optional parapet wall around the
// perimeter. Simplest of the roof types: no ridge, no slopes, no
// hips.
//
// All dimensions in project units (10 units = 1 ft).

import { computeTopFloorWallTopZ } from "../roofGeometry";
import type { HouseConfig } from "../expand";
import type { GlobalConfig } from "../config";

export interface FlatRoofGeom {
  eave_x_west: number;
  eave_x_east: number;
  eave_y_north: number;
  eave_y_south: number;
  eave_z: number;            // top of the slab (walkable surface)
  slab_bottom_z: number;     // wall_top_z (bottom of the slab)
  slab_thickness: number;    // in project units
  parapet_height: number;    // 0 = no parapet
  parapet_thickness: number; // in project units
  overhang: number;          // horizontal overhang past the wall
}

export interface FlatRoofConfig {
  type: "flat_roof";
  x?: number;
  y?: number;
  width?: number;
  length?: number;
  slab_thickness?: number;   // default 6 (0.6 ft ≈ 7 in RCC)
  parapet_height?: number;   // default 30 (3 ft)
  parapet_thickness?: number; // default 8 (0.8 ft)
  overhang?: number;         // default 5
  material?: string;
  framing?: Record<string, unknown>;
  [k: string]: unknown;
}

export function deriveFlatRoofGeometry(
  cfg: FlatRoofConfig,
  wallTopZ: number,
  roofW: number,
  roofL: number,
  roofX: number,
  roofY: number,
): FlatRoofGeom {
  const overhang = Math.max(0, Number(cfg.overhang ?? 5));
  const slabThickness = Math.max(0.01, Number(cfg.slab_thickness ?? 6));
  const parapetHeight = Math.max(0, Number(cfg.parapet_height ?? 30));
  const parapetThickness = Math.max(0.01, Number(cfg.parapet_thickness ?? 8));

  return {
    eave_x_west: roofX - overhang,
    eave_x_east: roofX + roofW + overhang,
    eave_y_north: roofY - overhang,
    eave_y_south: roofY + roofL + overhang,
    slab_bottom_z: wallTopZ,
    eave_z: wallTopZ + slabThickness,
    slab_thickness: slabThickness,
    parapet_height: parapetHeight,
    parapet_thickness: parapetThickness,
    overhang,
  };
}

export function deriveFlatFromObject(
  cfg: FlatRoofConfig,
  floorNum: number,
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): FlatRoofGeom {
  const framing = cfg.framing ?? {};
  const roofX = Number(cfg.x ?? 0);
  const roofY = Number(cfg.y ?? 0);
  const roofW = Number(cfg.width ?? 300);
  const roofL = Number(cfg.length ?? 400);
  const beamOffset = (framing.wall_thickness_ft as number | undefined) ??
    Number(globalConfig.wall_thickness ?? 8);
  const wallTopZ = computeTopFloorWallTopZ(
    floorNum,
    globalConfig,
    beamOffset,
    houseConfig.floors as Array<{ height?: number; slab_thickness?: number }>,
    (houseConfig as { defaults?: { floor_height?: number; slab_thickness?: number } }).defaults,
  );
  return deriveFlatRoofGeometry(cfg, wallTopZ, roofW, roofL, roofX, roofY);
}

export interface DerivedFlatRoof {
  geom: FlatRoofGeom;
  config: FlatRoofConfig;
  floorNum: number;
}

export function deriveAllFlatRoofs(
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): DerivedFlatRoof[] {
  const out: DerivedFlatRoof[] = [];
  for (let fi = 0; fi < (houseConfig.floors ?? []).length; fi++) {
    const floor = houseConfig.floors![fi];
    for (const obj of floor.objects ?? []) {
      if ((obj as { type?: string }).type !== "flat_roof") continue;
      const flat = obj as unknown as FlatRoofConfig;
      try {
        out.push({
          geom: deriveFlatFromObject(flat, fi, houseConfig, globalConfig),
          config: flat,
          floorNum: fi,
        });
      } catch (e) {
        console.warn(`[flat] flat_roof on floor ${fi} skipped:`, e);
      }
    }
  }
  return out;
}
