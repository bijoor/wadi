// Gable-roof geometry derivation. Mirrors the hip-roof pipeline
// (roofGeometry.ts) but for the simpler two-slope shape:
//   - single ridge line running the full house length along ridge_axis
//   - two sloped rectangular surfaces (west + east for ridge_axis='y')
//   - two vertical triangular gable-end walls at the ridge ends
//
// Only ridge_axis='y' is supported in Phase 1a to match the hip pipeline
// convention; ridge_axis='x' can follow the same pattern once needed.

import { computeTopFloorWallTopZ } from "../roofGeometry";
import type { HouseConfig } from "../expand";
import type { GlobalConfig } from "../config";

export interface GableRoofGeom {
  eave_x_west: number;
  eave_x_east: number;
  eave_y_north: number;
  eave_y_south: number;
  eave_z: number;
  // Ridge endpoints. For ridge_axis='y' the ridge runs along Y so
  // ridge_y_start/end are the meaningful pair; ridge_x_start/end
  // equal each other at the centre.
  // For ridge_axis='x' the roles swap.
  ridge_y_start: number;
  ridge_y_end: number;
  ridge_x_start: number;
  ridge_x_end: number;
  ridge_h: number;               // above wall_top_z
  ridge_axis: "y" | "x";
  wall_top_above_eave: number;   // eaveDrop
  slope_angle_ew: number;        // slope angle (perpendicular-to-ridge)
}

export interface GableRoofConfig {
  type: "gable_roof";
  ridge_axis?: "y" | "x";
  // New unit-form fields (10 units = 1 ft). Matches room / floor_slab.
  ridge_h?: number;
  min_overhang?: number;
  gable_overhang?: number;
  // Backward-compat _ft fields — still read as a fallback when the unit
  // form isn't present.
  ridge_h_ft?: number;
  min_pitch_deg?: number;
  min_overhang_ft?: number;
  gable_overhang_ft?: number;
  framing?: {
    house_footprint_ft?: [number, number];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export function deriveGableRoofGeometry(
  hipRoof: GableRoofConfig,
  wallTopZ: number,
  houseTransU: number,
  houseLongU: number,
  // NEW (Phase 2): position offset in project units. Defaults to (0, 0)
  // so single-roof callers keep working; multi-roof callers pass the
  // gable object's `x, y` so eave coords come out in absolute world space.
  roofX: number = 0,
  roofY: number = 0,
): GableRoofGeom {
  const ridgeAxis = (hipRoof.ridge_axis ?? "y") as "y" | "x";
  if (ridgeAxis !== "y" && ridgeAxis !== "x") {
    throw new Error(
      `gable_roof.ridge_axis must be 'y' or 'x', got '${ridgeAxis}'`,
    );
  }
  const isY = ridgeAxis === "y";
  // "Cross" = perpendicular to ridge (the slope span). "Along" = with
  // the ridge (the length the ridge runs).
  const crossLen = isY ? houseTransU : houseLongU;

  const minOv = Number(
    hipRoof.min_overhang ??
      (hipRoof.min_overhang_ft !== undefined ? Number(hipRoof.min_overhang_ft) * 10.0 : 0),
  );
  if (minOv <= 0) throw new Error("gable_roof.min_overhang must be > 0");
  const gableOv = Math.max(
    0,
    Number(
      hipRoof.gable_overhang ??
        (hipRoof.gable_overhang_ft !== undefined ? Number(hipRoof.gable_overhang_ft) * 10.0 : 0),
    ),
  );

  // Ridge height above wall top — unit form, then ft, then pitch-based.
  let ridgeH: number;
  if (hipRoof.ridge_h !== undefined) {
    const v = Number(hipRoof.ridge_h);
    if (!(v > 0)) throw new Error("gable_roof.ridge_h must be > 0");
    ridgeH = v;
  } else if (hipRoof.ridge_h_ft !== undefined) {
    const v = Number(hipRoof.ridge_h_ft);
    if (!(v > 0)) throw new Error("gable_roof.ridge_h_ft must be > 0");
    ridgeH = v * 10.0;
  } else if (hipRoof.min_pitch_deg !== undefined) {
    const mp = Number(hipRoof.min_pitch_deg);
    if (!(mp > 0 && mp < 90)) {
      throw new Error("gable_roof.min_pitch_deg must be in (0, 90)");
    }
    ridgeH = (crossLen / 2.0) * Math.tan((mp * Math.PI) / 180);
  } else {
    throw new Error(
      "gable_roof must specify one of 'ridge_h' / 'ridge_h_ft' / 'min_pitch_deg'",
    );
  }

  // Eave drop from the outward overhang (measured on the cross axis).
  const halfCross = crossLen / 2.0;
  const eaveDrop = (minOv * ridgeH) / halfCross;
  const eaveZ = wallTopZ - eaveDrop;
  const pitchCross = (Math.atan(ridgeH / halfCross) * 180) / Math.PI;

  // Overhangs: minOv on the two cross-eaves, gableOv on the two
  // along-ends. Map to N/S/E/W based on ridge_axis.
  const oxWest = isY ? minOv : gableOv;
  const oxEast = isY ? minOv : gableOv;
  const oyNorth = isY ? gableOv : minOv;
  const oySouth = isY ? gableOv : minOv;

  // Ridge endpoints in world coords. Along axis (Y for ridge='y',
  // X for ridge='x') gets the two endpoints; the other axis gets a
  // constant equal to the centre.
  const centreY = roofY + houseLongU / 2;
  const centreX = roofX + houseTransU / 2;
  const ridge_y_start = isY ? roofY - gableOv : centreY;
  const ridge_y_end = isY ? roofY + houseLongU + gableOv : centreY;
  const ridge_x_start = isY ? centreX : roofX - gableOv;
  const ridge_x_end = isY ? centreX : roofX + houseTransU + gableOv;

  return {
    eave_x_west: roofX - oxWest,
    eave_x_east: roofX + houseTransU + oxEast,
    eave_y_north: roofY - oyNorth,
    eave_y_south: roofY + houseLongU + oySouth,
    eave_z: eaveZ,
    ridge_y_start,
    ridge_y_end,
    ridge_x_start,
    ridge_x_end,
    ridge_h: ridgeH,
    ridge_axis: ridgeAxis,
    wall_top_above_eave: eaveDrop,
    slope_angle_ew: pitchCross,
  };
}

// Derive geometry for one specific gable_roof object.
export function deriveGableFromObject(
  gable: GableRoofConfig,
  floorNum: number,
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): GableRoofGeom {
  const framing = gable.framing ?? {};
  const houseFt = framing.house_footprint_ft ?? [27.0, 45.0];
  const roofX = Number((gable as { x?: number }).x ?? 0);
  const roofY = Number((gable as { y?: number }).y ?? 0);
  const roofW = Number((gable as { width?: number }).width ?? houseFt[0] * 10.0);
  const roofL = Number((gable as { length?: number }).length ?? houseFt[1] * 10.0);
  const beamOffset = (framing.wall_thickness_ft as number | undefined) ??
    Number(globalConfig.wall_thickness ?? 8);
  const wallTopZ = computeTopFloorWallTopZ(
    floorNum,
    globalConfig,
    beamOffset,
    houseConfig.floors as Array<{ height?: number; slab_thickness?: number }>,
    (houseConfig as { defaults?: { floor_height?: number; slab_thickness?: number } }).defaults,
  );
  return deriveGableRoofGeometry(gable, wallTopZ, roofW, roofL, roofX, roofY);
}

// Backward-compat: returns the first gable_roof only.
export function deriveGableForHouse(
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): { geom: GableRoofGeom; config: GableRoofConfig; floorNum: number } | null {
  for (let fi = 0; fi < (houseConfig.floors ?? []).length; fi++) {
    const floor = houseConfig.floors![fi];
    for (const obj of floor.objects ?? []) {
      if ((obj as { type?: string }).type !== "gable_roof") continue;
      const gable = obj as unknown as GableRoofConfig;
      return {
        geom: deriveGableFromObject(gable, fi, houseConfig, globalConfig),
        config: gable,
        floorNum: fi,
      };
    }
  }
  return null;
}

export interface DerivedGableRoof {
  geom: GableRoofGeom;
  config: GableRoofConfig;
  floorNum: number;
}

// Iterate every gable_roof in the config. Phase 2 entry point.
export function deriveAllGableRoofs(
  houseConfig: HouseConfig,
  globalConfig: GlobalConfig,
): DerivedGableRoof[] {
  const out: DerivedGableRoof[] = [];
  for (let fi = 0; fi < (houseConfig.floors ?? []).length; fi++) {
    const floor = houseConfig.floors![fi];
    for (const obj of floor.objects ?? []) {
      if ((obj as { type?: string }).type !== "gable_roof") continue;
      const gable = obj as unknown as GableRoofConfig;
      try {
        out.push({
          geom: deriveGableFromObject(gable, fi, houseConfig, globalConfig),
          config: gable,
          floorNum: fi,
        });
      } catch (e) {
        console.warn(`[gable] gable_roof on floor ${fi} skipped:`, e);
      }
    }
  }
  return out;
}
