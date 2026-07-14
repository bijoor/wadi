// Port of roof_geometry.py. Pure math — no bpy, no I/O. Returns the same
// derived-geometry dict the Python side merges into the hip_roof config.
//
// Numeric-type note: Python uses `float(...)`, `math.tan`, `math.radians`
// and mixed float multiplication throughout — every value in the returned
// dict is a Python float. In JS these are just numbers; downstream
// consumers must format via `fFloat` to reproduce "0.0"/"1.0" trailing
// zeroes.

import type { GlobalConfig } from "./config";
import type { HouseConfig } from "./expand";

type HipRoof = Record<string, unknown>;

export function findHipRoof(
  houseConfig: HouseConfig,
): [HipRoof | null, number | null] {
  for (const floor of houseConfig.floors ?? []) {
    for (const obj of (floor.objects ?? []) as HipRoof[]) {
      if (obj.type === "hip_roof") {
        return [obj, (floor.floor_number as number | undefined) ?? 0];
      }
    }
  }
  return [null, null];
}

export function computeTopFloorWallTopZ(
  floorNumber: number,
  globalConfig: GlobalConfig,
  beamOffset = 0.0,
  // Optional per-floor overrides — if the caller passes the config's
  // `floors` array, each floor's own `.height` / `.slab_thickness` are
  // preferred first. House-level `houseDefaults` come next; the code
  // defaults in globalConfig are the final fallback.
  floors?: Array<{ height?: number; slab_thickness?: number }>,
  houseDefaults?: { floor_height?: number; slab_thickness?: number },
): number {
  let z = globalConfig.plinth_height as number;
  const defaultSlab =
    houseDefaults?.slab_thickness ??
    (globalConfig.floor_slab_thickness as number | undefined) ??
    0;
  const defaultHeight =
    houseDefaults?.floor_height ??
    (globalConfig.floor_height as number | undefined) ??
    100;
  for (let f = 0; f < floorNumber; f++) {
    const perFloor = floors?.[f];
    z += perFloor?.slab_thickness ?? defaultSlab;
    z += perFloor?.height ?? defaultHeight;
  }
  z += beamOffset;
  return z;
}

export function deriveHipRoofGeometry(
  hipRoof: HipRoof,
  wallTopZ: number,
  houseTransU: number,
  houseLongU: number,
  ridgeAxis: string = "y",
  // NEW (Phase 2): roof position in world coords. Defaults to (0,0)
  // so existing single-roof configs keep working — the derived
  // eave_x_west etc. become absolute world X/Y once these are added.
  roofX: number = 0,
  roofY: number = 0,
): Record<string, unknown> {
  if (ridgeAxis !== "y") {
    throw new Error(
      "deriveHipRoofGeometry currently supports ridge_axis='y' only",
    );
  }

  const trusses = hipRoof.trusses as { positions?: number[] } | undefined;
  if (!trusses || !trusses.positions) {
    throw new Error("hip_roof.trusses.positions is required");
  }
  const positions = trusses.positions;
  if (positions.length < 2) {
    throw new Error("hip_roof.trusses.positions needs at least two entries");
  }
  for (let i = 0; i < positions.length - 1; i++) {
    if (positions[i + 1] <= positions[i]) {
      throw new Error(
        "hip_roof.trusses.positions must be strictly increasing",
      );
    }
  }
  const ridgeYStart = Number(positions[0]);
  const ridgeYEnd = Number(positions[positions.length - 1]);
  if (ridgeYStart <= 0) {
    throw new Error(`trusses.positions[0]=${ridgeYStart} must be > 0`);
  }
  if (ridgeYEnd >= houseLongU) {
    throw new Error(
      `trusses.positions[-1]=${ridgeYEnd} must be < house_long_u (${houseLongU})`,
    );
  }

  const dMax = Math.max(
    houseTransU / 2.0,
    ridgeYStart,
    houseLongU - ridgeYEnd,
  );

  let ridgeH: number;
  // Prefer unit-form fields (matches room/pillar convention: 10 units = 1 ft).
  // The old `_ft` fields are still honoured for backward-compat with
  // existing configs.
  if ("ridge_h" in hipRoof && (hipRoof as { ridge_h?: number }).ridge_h !== undefined) {
    const v = Number((hipRoof as { ridge_h?: number }).ridge_h);
    if (!(v > 0)) throw new Error("hip_roof.ridge_h must be > 0");
    ridgeH = v;
  } else if ("ridge_h_ft" in hipRoof) {
    const v = hipRoof.ridge_h_ft as number;
    if (v <= 0) throw new Error("hip_roof.ridge_h_ft must be > 0");
    ridgeH = v * 10.0;
  } else if ("min_pitch_deg" in hipRoof) {
    const mp = Number(hipRoof.min_pitch_deg);
    if (!(mp > 0 && mp < 90)) {
      throw new Error("hip_roof.min_pitch_deg must be in (0, 90)");
    }
    ridgeH = dMax * Math.tan((mp * Math.PI) / 180);
  } else {
    throw new Error(
      "hip_roof must specify one of 'ridge_h' / 'ridge_h_ft' / 'min_pitch_deg'",
    );
  }

  const minOvU = (hipRoof as { min_overhang?: number }).min_overhang;
  const minOvFt = hipRoof.min_overhang_ft as number | undefined;
  const minOv = Number(minOvU ?? (minOvFt !== undefined ? minOvFt * 10.0 : 0));
  if (minOv <= 0) throw new Error("hip_roof.min_overhang must be > 0");

  const dCrit = Math.min(
    houseTransU / 2.0,
    ridgeYStart,
    houseLongU - ridgeYEnd,
  );

  const pitchEw =
    (Math.atan(ridgeH / (houseTransU / 2.0)) * 180) / Math.PI;
  const pitchN = (Math.atan(ridgeH / ridgeYStart) * 180) / Math.PI;
  const pitchS =
    (Math.atan(ridgeH / (houseLongU - ridgeYEnd)) * 180) / Math.PI;

  const eaveDrop = (minOv * ridgeH) / dCrit;
  const eaveZ = wallTopZ - eaveDrop;

  const oEw = (minOv * (houseTransU / 2.0)) / dCrit;
  const oN = (minOv * ridgeYStart) / dCrit;
  const oS = (minOv * (houseLongU - ridgeYEnd)) / dCrit;

  const ventCfg =
    (hipRoof.ridge_ventilation as Record<string, unknown> | null | undefined) ??
    {};
  let ridgeExtU =
    Math.max(0.0, Number(ventCfg.extension_ft ?? 0.0)) * 10.0;
  const maxExtU = Math.min(ridgeYStart - 1.0, houseLongU - ridgeYEnd - 1.0);
  if (ridgeExtU > maxExtU && maxExtU > 0) {
    ridgeExtU = maxExtU;
  }
  const hasRidgeVent = ridgeExtU > 1e-6;
  const ridgeYStartExt = ridgeYStart - ridgeExtU;
  const ridgeYEndExt = ridgeYEnd + ridgeExtU;

  return {
    // All X/Y outputs shifted by (roofX, roofY) so multiple positioned
    // roofs land at the correct absolute world coordinates. Existing
    // single-roof callers pass (0, 0) and behaviour is unchanged.
    eave_x_west: roofX + 0 - oEw,
    eave_x_east: roofX + houseTransU + oEw,
    eave_y_north: roofY + 0 - oN,
    eave_y_south: roofY + houseLongU + oS,
    eave_z: eaveZ,
    ridge_y_start: roofY + ridgeYStart,
    ridge_y_end: roofY + ridgeYEnd,
    ridge_h: ridgeH,
    ridge_axis: ridgeAxis,
    slope_angle_ew: pitchEw,
    slope_angle_ns: pitchN,
    slope_angle_ns_n: pitchN,
    slope_angle_ns_s: pitchS,
    wall_top_above_eave: eaveDrop,
    wall_top_above_eave_ft: eaveDrop / 10.0,
    overhang_ew_ft: oEw / 10.0,
    overhang_n_ft: oN / 10.0,
    overhang_s_ft: oS / 10.0,
    d_crit: dCrit,
    ridge_ext_u: ridgeExtU,
    ridge_ext_ft: ridgeExtU / 10.0,
    has_ridge_vent: hasRidgeVent,
    ridge_y_start_ext: roofY + ridgeYStartExt,
    ridge_y_end_ext: roofY + ridgeYEndExt,
    ridge_vent_cfg: { ...ventCfg },
  };
}

// Derive geometry for a specific hip_roof object on the given floor.
// Reads position + size from either the new `x, y, width, length` fields
// (project units) or falls back to `(0, 0)` + `framing.house_footprint_ft`
// (feet) for existing configs.
export function deriveHipRoofFromObject(
  hipRoof: HipRoof,
  floorNum: number,
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): Record<string, unknown> {
  const framing =
    (hipRoof.framing as Record<string, unknown> | undefined) ?? {};
  const houseFt = (framing.house_footprint_ft as [number, number] | undefined) ??
    [27.0, 45.0];
  const roofX = Number((hipRoof as { x?: number }).x ?? 0);
  const roofY = Number((hipRoof as { y?: number }).y ?? 0);
  const roofW = Number((hipRoof as { width?: number }).width ?? houseFt[0] * 10.0);
  const roofL = Number((hipRoof as { length?: number }).length ?? houseFt[1] * 10.0);
  let beamOffsetU: number;
  const beamU = (hipRoof as { beam_offset?: number }).beam_offset;
  if (beamU !== undefined) {
    beamOffsetU = Number(beamU);
  } else if ("beam_offset_ft" in hipRoof) {
    beamOffsetU = (hipRoof.beam_offset_ft as number) * 10.0;
  } else {
    beamOffsetU = Number(globalConfig.wall_thickness ?? 8);
  }
  const wallTopZ = computeTopFloorWallTopZ(
    floorNum,
    globalConfig,
    beamOffsetU,
    houseConfig.floors as Array<{ height?: number; slab_thickness?: number }>,
    (houseConfig as { defaults?: { floor_height?: number; slab_thickness?: number } }).defaults,
  );
  return deriveHipRoofGeometry(
    hipRoof,
    wallTopZ,
    roofW,
    roofL,
    (hipRoof.ridge_axis as string | undefined) ?? "y",
    roofX,
    roofY,
  );
}

// Backward-compat wrapper — returns the first hip_roof only. Kept so
// any lingering single-roof caller doesn't break; new code should use
// `deriveAllHipRoofs` to iterate every roof in the config.
export function deriveForHouse(
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): Record<string, unknown> | null {
  const [hipRoof, floorNum] = findHipRoof(houseConfig);
  if (hipRoof === null || floorNum === null) return null;
  return deriveHipRoofFromObject(hipRoof, floorNum, houseConfig, globalConfig);
}

export interface DerivedHipRoof {
  geom: Record<string, unknown>;
  config: HipRoof;
  floorNum: number;
}

// Iterate every hip_roof in the config and derive geometry for each.
// Phase 2 entry point — replaces the single-roof `deriveForHouse` for
// rendering pipelines that support multiple roofs.
export function deriveAllHipRoofs(
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): DerivedHipRoof[] {
  const out: DerivedHipRoof[] = [];
  for (let fi = 0; fi < (houseConfig.floors ?? []).length; fi++) {
    const floor = houseConfig.floors[fi];
    for (const obj of floor.objects ?? []) {
      if ((obj as { type?: string }).type !== "hip_roof") continue;
      try {
        out.push({
          geom: deriveHipRoofFromObject(obj as unknown as HipRoof, fi, houseConfig, globalConfig),
          config: obj as unknown as HipRoof,
          floorNum: fi,
        });
      } catch (e) {
        console.warn(`[roof] hip_roof on floor ${fi} skipped:`, e);
      }
    }
  }
  return out;
}
