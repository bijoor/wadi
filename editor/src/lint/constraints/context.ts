// Build the CheckContext once per lint run: resolve + expand + index, shared by
// every constraint. Kept lenient so a geometry-broken house still lints (the
// geometry pipeline reports those failures separately).

import { expandRoomWalls } from "../../svg2d/expand";
import { buildSpatialModel } from "../../model/spatialModel";
import { DEFAULT_GLOBAL_CONFIG } from "../../svg2d/config";
import type { HouseConfig } from "../../schema/houseConfig";
import type { CheckContext, ResolvedDefaults } from "./types";

const n = (v: unknown, d: number): number =>
  v != null && Number.isFinite(Number(v)) ? Number(v) : d;

export function buildContext(config: HouseConfig): CheckContext {
  const cfg = config as unknown as Record<string, unknown>;
  const d = (cfg.defaults as Record<string, unknown> | undefined) ?? {};
  const defaults: ResolvedDefaults = {
    wall_thickness: n(d.wall_thickness, DEFAULT_GLOBAL_CONFIG.wall_thickness),
    slab_thickness: n(d.slab_thickness, DEFAULT_GLOBAL_CONFIG.floor_slab_thickness),
    floor_height: n(d.floor_height, DEFAULT_GLOBAL_CONFIG.floor_height),
    wall_height: n(d.wall_height, DEFAULT_GLOBAL_CONFIG.wall_height),
  };

  // Callers resolve formulas before linting, so raw == resolved here today.
  let expanded: HouseConfig = config;
  try {
    expanded = expandRoomWalls(config, undefined, { lenient: true }) as unknown as HouseConfig;
  } catch {
    expanded = config;
  }

  return {
    raw: config,
    resolved: config,
    expanded,
    defaults,
    model: buildSpatialModel(expanded),
  };
}
