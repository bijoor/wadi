// Shed (mono-pitch) roof geometry — a single sloped surface with a
// high edge (top of slope) and a low edge (bottom). Simpler than
// gable: no ridge in the middle, one direction of rafters.
//
// Convention: `slope_dir` names which edge is HIGH.
//   slope_dir='south' → high edge at y = eave_y_north, low at y = eave_y_south
//                       (roof pitches down toward south)
//   slope_dir='north' → high edge at y = eave_y_south, low at y = eave_y_north
//   slope_dir='east'  → high edge at x = eave_x_west, low at x = eave_x_east
//   slope_dir='west'  → high edge at x = eave_x_east, low at x = eave_x_west
// (Named after where the water RUNS TO, which is the low edge.)
//
// All dimensions in project units (10 units = 1 ft).

import { computeTopFloorWallTopZ } from "../roofGeometry";
import type { HouseConfig } from "../expand";
import type { GlobalConfig } from "../config";

export type SlopeDir = "north" | "south" | "east" | "west";

export interface ShedRoofGeom {
  eave_x_west: number;
  eave_x_east: number;
  eave_y_north: number;
  eave_y_south: number;
  eave_z_low: number;      // Z of the low eave edge
  eave_z_high: number;     // Z of the high eave edge
  slope_dir: SlopeDir;     // where the water runs to (low side)
  wall_top_above_eave: number; // eave drop
  slope_angle: number;     // degrees
  rise: number;            // vertical difference (project units)
  run: number;             // horizontal span between low and high edges
}

export interface ShedRoofConfig {
  type: "shed_roof";
  x?: number;
  y?: number;
  width?: number;
  length?: number;
  slope_dir?: SlopeDir;      // default "south"
  rise?: number;             // vertical rise of high edge above wall_top (units)
  min_pitch_deg?: number;    // alternative — derive rise from pitch
  min_overhang?: number;     // default 20
  material?: string;
  framing?: Record<string, unknown>;
  [k: string]: unknown;
}

export function deriveShedRoofGeometry(
  cfg: ShedRoofConfig,
  wallTopZ: number,
  roofW: number,
  roofL: number,
  roofX: number,
  roofY: number,
): ShedRoofGeom {
  const minOv = Number(cfg.min_overhang ?? 20);
  if (!(minOv > 0)) throw new Error("shed_roof.min_overhang must be > 0");
  const slope_dir: SlopeDir = (cfg.slope_dir ?? "south") as SlopeDir;
  // Run = horizontal span from low edge to high edge, before overhang.
  const run =
    slope_dir === "north" || slope_dir === "south" ? roofL : roofW;

  let rise: number;
  if (cfg.rise !== undefined) {
    rise = Number(cfg.rise);
    if (!(rise > 0)) throw new Error("shed_roof.rise must be > 0");
  } else if (cfg.min_pitch_deg !== undefined) {
    const mp = Number(cfg.min_pitch_deg);
    if (!(mp > 0 && mp < 90)) {
      throw new Error("shed_roof.min_pitch_deg must be in (0, 90)");
    }
    rise = run * Math.tan((mp * Math.PI) / 180);
  } else {
    throw new Error("shed_roof must specify one of 'rise' or 'min_pitch_deg'");
  }
  const slopeAngle = (Math.atan2(rise, run) * 180) / Math.PI;

  // eave_z at LOW edge: wall_top_z minus (overhang * rise / run) — the
  // low eave dips below wall_top by the overhang's projection along
  // the slope. Same math as hip/gable's `eaveDrop`.
  const eaveDrop = (minOv * rise) / run;
  const eaveZlow = wallTopZ - eaveDrop;
  // eave_z at HIGH edge: wall_top_z + rise + eaveDrop (the high side's
  // overhang RISES past wall_top by the same amount).
  const eaveZhigh = wallTopZ + rise + eaveDrop;

  return {
    eave_x_west: roofX - minOv,
    eave_x_east: roofX + roofW + minOv,
    eave_y_north: roofY - minOv,
    eave_y_south: roofY + roofL + minOv,
    eave_z_low: eaveZlow,
    eave_z_high: eaveZhigh,
    slope_dir,
    wall_top_above_eave: eaveDrop,
    slope_angle: slopeAngle,
    rise,
    run,
  };
}

export function deriveShedFromObject(
  cfg: ShedRoofConfig,
  floorNum: number,
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): ShedRoofGeom {
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
  return deriveShedRoofGeometry(cfg, wallTopZ, roofW, roofL, roofX, roofY);
}

export interface DerivedShedRoof {
  geom: ShedRoofGeom;
  config: ShedRoofConfig;
  floorNum: number;
}

export function deriveAllShedRoofs(
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): DerivedShedRoof[] {
  const out: DerivedShedRoof[] = [];
  for (let fi = 0; fi < (houseConfig.floors ?? []).length; fi++) {
    const floor = houseConfig.floors![fi];
    for (const obj of floor.objects ?? []) {
      if ((obj as { type?: string }).type !== "shed_roof") continue;
      const shed = obj as unknown as ShedRoofConfig;
      try {
        out.push({
          geom: deriveShedFromObject(shed, fi, houseConfig, globalConfig),
          config: shed,
          floorNum: fi,
        });
      } catch (e) {
        console.warn(`[shed] shed_roof on floor ${fi} skipped:`, e);
      }
    }
  }
  return out;
}
