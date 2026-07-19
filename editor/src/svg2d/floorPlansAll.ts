import { generateFloorPlanSvg, type FloorPlanRoofOverlay } from "./floorPlan";
import { expandRoomWalls, type HouseConfig } from "./expand";
import { derivePitchedRoof } from "./roof/v2/derivePitched";
import { deriveFlatRoof } from "./roof/v2/deriveFlat";
import { deriveShedRoof } from "./roof/v2/deriveShed";
import { resolveJoints, ridgeZFromConfig } from "./roof/v2/resolveJoints";
import { trimAtJoints } from "./roof/v2/trimAtJoints";
import { populateRoofFraming } from "./roof/v2/rafters";
import { populateEaveMembers } from "./roof/v2/eaveMembers";
import { DEFAULT_V2_FRAMING, type FramingConfig } from "./roof/v2/bom";
import { computeTopFloorWallTopZ } from "./roofGeometry";
import { DEFAULT_GLOBAL_CONFIG } from "./config";
import type { RoofConfig, RoofSpec } from "./roof/v2/model";

// Port of svg_2d.py::generate_all_floor_plans. Returns a map from
// generated filename to SVG contents. Callers write each entry to disk
// (Python side) or display them in the editor preview (browser side).
export interface FloorPlanFile {
  filename: string;
  content: string;
}

export function generateAllFloorPlans(houseConfig: HouseConfig): FloorPlanFile[] {
  const hc = expandRoomWalls(houseConfig);
  const houseDefaults = (hc as { defaults?: { floor_height?: number; slab_thickness?: number; wall_thickness?: number } })
    .defaults;
  const wallThickness = houseDefaults?.wall_thickness ?? DEFAULT_GLOBAL_CONFIG.wall_thickness;
  const out: FloorPlanFile[] = [];
  for (let fi = 0; fi < (hc.floors ?? []).length; fi++) {
    const floor = hc.floors![fi];
    const floorNum = (floor.floor_number as number | undefined) ?? 0;
    const floorName = (floor.name as string | undefined) ?? `Floor_${floorNum}`;
    const filename = `floor_plan_${floorNum}_${floorName.replace(/ /g, "_")}.svg`;
    // Compute a merged v2 roof spec for THIS floor's roof objects only.
    const roofOverlay = computeFloorRoofOverlay(hc, fi, houseDefaults);
    const content = generateFloorPlanSvg(floor, 2.0, roofOverlay ?? undefined, wallThickness);
    // Match Python: floors with no bounded 2D objects (e.g. loft with
    // only a hip_roof) return '' and Python skips writing them, so we
    // omit them from the output list too — but with a v2 roof overlay,
    // the roof itself provides bounds so those floors now render.
    if (!content) continue;
    out.push({ filename, content });
  }
  return out;
}

function computeFloorRoofOverlay(
  hc: HouseConfig,
  fi: number,
  houseDefaults: { floor_height?: number; slab_thickness?: number } | undefined,
): FloorPlanRoofOverlay | null {
  const floor = hc.floors![fi];
  const objects = (floor.objects as Array<Record<string, unknown>>) ?? [];
  const merged: RoofSpec = { members: [], planes: [], trusses: [] };
  let hasV2Roof = false;
  for (const obj of objects) {
    if (obj.type !== "roof") continue;
    hasV2Roof = true;
    try {
      const framingRaw = (obj.framing as Partial<FramingConfig> | undefined) ?? {};
      const framing: FramingConfig = { ...DEFAULT_V2_FRAMING, ...framingRaw };
      // V2 roofs sit directly on wall-top-Z — no extra beam offset.
      const wallTopZ = computeTopFloorWallTopZ(
        fi,
        DEFAULT_GLOBAL_CONFIG,
        0,
        hc.floors as Array<{ height?: number; slab_thickness?: number }>,
        houseDefaults,
        (hc.plinth as { height?: number } | undefined)?.height,
      );
      const cfg = obj as unknown as RoofConfig;
      let spec: RoofSpec;
      if (cfg.roof_type === "flat") {
        spec = deriveFlatRoof(cfg, { wallTopZ });
      } else if (cfg.roof_type === "shed") {
        spec = deriveShedRoof(cfg, { wallTopZ });
        if (cfg.segments.length > 1) {
          spec = resolveJoints(cfg, spec, { wallTopZ, ridgeZ: wallTopZ });
        }
      } else {
        spec = derivePitchedRoof(cfg, { wallTopZ });
        if (cfg.segments.length > 1) {
          const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
          spec = resolveJoints(cfg, spec, { wallTopZ, ridgeZ });
        }
      }
      if (cfg.segments.length > 1) {
        spec = trimAtJoints(spec);
      }
      spec = populateRoofFraming(spec, framing, cfg, wallTopZ);
      spec = populateEaveMembers(spec);
      merged.members.push(...spec.members);
      merged.planes.push(...spec.planes);
      merged.trusses.push(...spec.trusses);
    } catch (e) {
      console.warn(`[floorPlansAll] v2 roof on floor ${fi} skipped:`, e);
    }
  }
  return hasV2Roof ? { spec: merged } : null;
}
