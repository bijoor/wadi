// Compute v2 RoofSpecs from a HouseConfig.
//
// Handles BOTH:
//   - Legacy roof objects (hip_roof / gable_roof / flat_roof / shed_roof)
//     via `oldRectRoofToSegments` adapter.
//   - New v2 unified roof objects (type: "roof") — used directly.
//
// Per-roof errors are logged and skipped so one bad config doesn't
// take out the whole pipeline.

import { expandRoomWalls, type HouseConfig } from "../../expand";
import { DEFAULT_GLOBAL_CONFIG } from "../../config";
import { computeTopFloorWallTopZ } from "../../roofGeometry";
import { oldRectRoofToSegments } from "./adapters";
import { derivePitchedRoof } from "./derivePitched";
import { deriveFlatRoof } from "./deriveFlat";
import { deriveShedRoof } from "./deriveShed";
import { resolveJoints, ridgeZFromConfig } from "./resolveJoints";
import { computeAggregateBom, DEFAULT_V2_FRAMING, type FramingConfig } from "./bom";
import { populateRoofFraming } from "./rafters";
import { populateEaveMembers } from "./eaveMembers";
import { trimAtJoints } from "./trimAtJoints";
import type { RoofConfig, RoofSpec } from "./model";

// Legacy roof types the adapter can convert.
const LEGACY_ROOF_TYPES = new Set([
  "hip_roof", "gable_roof", "flat_roof", "shed_roof",
]);

export interface ComputeFromHouseOptions {
  // Which roof objects to include:
  //   "all"        — v2 + legacy (default; matches full-scene rendering)
  //   "v2Only"     — only type:"roof" objects
  //   "legacyOnly" — only legacy types (hip/gable/flat/shed)
  filter?: "all" | "v2Only" | "legacyOnly";
}

// Merged spec across ALL matching roof objects. Everything gets
// derived, then joint-resolved (per roof; cross-object joints are
// Phase 3), then concatenated.
export function computeMergedV2Spec(
  config: HouseConfig,
  opts: ComputeFromHouseOptions = {},
): RoofSpec {
  const filter = opts.filter ?? "all";
  const merged: RoofSpec = { members: [], planes: [], trusses: [] };
  const hc = expandRoomWalls(config);
  const houseDefaults = (hc as { defaults?: { floor_height?: number; slab_thickness?: number } })
    .defaults;

  for (let fi = 0; fi < (hc.floors ?? []).length; fi++) {
    const floor = hc.floors![fi];
    const objects = (floor.objects as Array<Record<string, unknown>>) ?? [];
    for (const obj of objects) {
      const t = obj.type as string | undefined;
      const isV2 = t === "roof";
      const isLegacy = LEGACY_ROOF_TYPES.has(t ?? "");
      if (!isV2 && !isLegacy) continue;
      if (filter === "v2Only" && !isV2) continue;
      if (filter === "legacyOnly" && !isLegacy) continue;
      try {
        const framingRaw = (obj.framing as Partial<FramingConfig> | undefined) ?? {};
        const framing: FramingConfig = { ...DEFAULT_V2_FRAMING, ...framingRaw };
        // V2 roofs sit directly on wall-top-Z with no extra beam
        // offset — floor height is assumed to already include the
        // beam. Pass beamOffset = 0.
        const wallTopZ = computeTopFloorWallTopZ(
          fi,
          DEFAULT_GLOBAL_CONFIG,
          0,
          hc.floors as Array<{ height?: number; slab_thickness?: number }>,
          houseDefaults,
          (hc.plinth as { height?: number } | undefined)?.height,
        );
        const v2Cfg: RoofConfig = isV2
          ? (obj as unknown as RoofConfig)
          : oldRectRoofToSegments(obj);
        const spec = deriveOne(v2Cfg, wallTopZ, framing);
        merged.members.push(...spec.members);
        merged.planes.push(...spec.planes);
        merged.trusses.push(...spec.trusses);
      } catch (e) {
        console.warn(`[v2roof] roof on floor ${fi} skipped:`, e);
      }
    }
  }
  return merged;
}

function deriveOne(
  cfg: RoofConfig,
  wallTopZ: number,
  framing?: FramingConfig,
): RoofSpec {
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
  // Trim planes + boundary members at joints FIRST — this yields
  // the final face polygons that rafters/purlins should fill.
  if (cfg.segments.length > 1) {
    spec = trimAtJoints(spec);
  }
  // Now populate rafters + purlins by filling each face polygon
  // (slope or hip_face). Face-based emission handles trimmed and
  // extended polygons uniformly.
  if (framing) {
    spec = populateRoofFraming(spec, framing, cfg, wallTopZ);
  }
  // Eave-perimeter members (pani_patti, eave_L_channel,
  // corner_double_angle) — face-based emission from final polygon
  // eave edges + hip diagonals.
  spec = populateEaveMembers(spec);
  return spec;
}

// Extract per-roof framing overrides so the BOM can size each row's
// members correctly. Falls back to DEFAULT_V2_FRAMING for anything
// missing.
export function collectV2FramingSpecs(
  config: HouseConfig,
  opts: ComputeFromHouseOptions = {},
): Array<{ spec: RoofSpec; framing?: Partial<FramingConfig> }> {
  const filter = opts.filter ?? "all";
  const out: Array<{ spec: RoofSpec; framing?: Partial<FramingConfig> }> = [];
  const hc = expandRoomWalls(config);
  const houseDefaults = (hc as { defaults?: { floor_height?: number; slab_thickness?: number } })
    .defaults;

  for (let fi = 0; fi < (hc.floors ?? []).length; fi++) {
    const floor = hc.floors![fi];
    const objects = (floor.objects as Array<Record<string, unknown>>) ?? [];
    for (const obj of objects) {
      const t = obj.type as string | undefined;
      const isV2 = t === "roof";
      const isLegacy = LEGACY_ROOF_TYPES.has(t ?? "");
      if (!isV2 && !isLegacy) continue;
      if (filter === "v2Only" && !isV2) continue;
      if (filter === "legacyOnly" && !isLegacy) continue;
      try {
        const framing = (obj.framing as Record<string, unknown> | undefined) ?? {};
        void framing;   // no longer used for beam offset — kept for reference
        const wallTopZ = computeTopFloorWallTopZ(
          fi,
          DEFAULT_GLOBAL_CONFIG,
          0,
          hc.floors as Array<{ height?: number; slab_thickness?: number }>,
          houseDefaults,
          (hc.plinth as { height?: number } | undefined)?.height,
        );
        const v2Cfg: RoofConfig = isV2
          ? (obj as unknown as RoofConfig)
          : oldRectRoofToSegments(obj);
        const resolvedFraming: FramingConfig = {
          ...DEFAULT_V2_FRAMING,
          ...(framing as Partial<FramingConfig>),
        };
        const spec = deriveOne(v2Cfg, wallTopZ, resolvedFraming);
        out.push({ spec, framing: framing as Partial<FramingConfig> });
      } catch (e) {
        console.warn(`[v2roof] framing collect on floor ${fi} skipped:`, e);
      }
    }
  }
  return out;
}

// Convert v2 BOM rows to the legacy FrameMember shape so they can
// mix with hip/gable/flat/shed contributions in the main BOM tables.
// Called with `filter: "v2Only"` to avoid double-counting legacy
// roofs (which contribute via their own compute paths).
export function collectV2AsLegacyFrameMembers(
  config: HouseConfig,
): Array<{
  item: string;
  matSpec: string;
  extraNote: string;
  count: number;
  maxLenFt: number;
  totalLenFt: number;
}> {
  const specs = collectV2FramingSpecs(config, { filter: "v2Only" });
  if (specs.length === 0) return [];
  const { frame } = computeAggregateBom(specs);
  return frame.map((row, i) => ({
    item: `${row.item} (v2 #${i + 1})`,
    matSpec: row.matSpec,
    extraNote: row.role,
    count: row.count,
    maxLenFt: row.maxLenFt,
    totalLenFt: row.totalLenFt,
  }));
}
