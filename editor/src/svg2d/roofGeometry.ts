// Shared roof helper — pure math, no bpy, no I/O.
//
// The wall-top-Z computation below is used by the v2 unified roof
// pipeline (svg2d/roof/v2/computeFromHouse.ts, three/V2RoofSolid.tsx,
// svg2d/floorPlansAll.ts). The legacy hip/gable/flat/shed derivation
// that once lived here was removed with the legacy roof types.

import type { GlobalConfig } from "./config";

export function computeTopFloorWallTopZ(
  floorNumber: number,
  globalConfig: GlobalConfig,
  beamOffset = 0.0,
  // Optional per-floor overrides — if the caller passes the config's
  // `floors` array, each floor's own `.height` is preferred first.
  // House-level `houseDefaults.floor_height` comes next; the code
  // default in globalConfig is the final fallback.
  //
  // ROOF POSITION is a function of FLOOR_HEIGHTS ONLY. The plinth is now the
  // first floor (index 0), so summing floors[0..floorNumber-1] already includes
  // the plinth rise — the stack seeds at ground(0). slab_thickness is a separate
  // metadata field (RCC deck depth) and is NOT added into the vertical stack —
  // floor_height already represents the full floor-to-floor rise.
  floors?: Array<{ height?: number }>,
  houseDefaults?: { floor_height?: number },
): number {
  let z = 0;
  const defaultHeight =
    houseDefaults?.floor_height ??
    (globalConfig.floor_height as number | undefined) ??
    100;
  for (let f = 0; f < floorNumber; f++) {
    const perFloor = floors?.[f];
    z += perFloor?.height ?? defaultHeight;
  }
  z += beamOffset;
  return z;
}
