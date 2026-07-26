// Physical-unit conversion for the 3D scene.
//
// Wadi's three.js world is measured in PROJECT UNITS (the same numbers the config
// carries — toThreePos only recentres, it never rescales). GLB assets, by contrast,
// are authored in METRES. To drop a metric GLB into the scene at the right size we
// need "how many project units is one metre" for the current house.
//
// A house's physical scale is fixed by `units`: `per_unit` project units equal ONE
// display unit, and a display unit spans FEET_PER_DISPLAY_UNIT[system] feet. So:
//   unitsPerFoot  = per_unit / FEET_PER_DISPLAY_UNIT[system]
//   unitsPerMeter = unitsPerFoot × 3.280839895
// (Mirrors the maps in procTextures.ts / interiorView.ts — keep them in step.)
//
// Default house (feet_inches, per_unit = 10): unitsPerFoot = 10, unitsPerMeter ≈ 32.8,
// so a 2 m sofa is ≈ 65.6 units wide — a quarter of a 270-unit (27 ft ≈ 8.2 m) plot.

export interface UnitsRef {
  system?: string;
  per_unit?: number;
}

const DEFAULT_PER_UNIT = 10;
const FEET_PER_METER = 3.280839895;
const FEET_PER_DISPLAY_UNIT: Record<string, number> = {
  feet_inches: 1,
  feet: 1,
  meters: 3.280839895,
  centimeters: 0.032808399,
  millimeters: 0.003280839,
};

export function unitsPerFoot(units?: UnitsRef): number {
  const perUnit = units?.per_unit ?? DEFAULT_PER_UNIT;
  const feetPerDisplayUnit = FEET_PER_DISPLAY_UNIT[units?.system ?? "feet_inches"] ?? 1;
  return perUnit / feetPerDisplayUnit;
}

export function unitsPerMeter(units?: UnitsRef): number {
  return unitsPerFoot(units) * FEET_PER_METER;
}

// Convert a length in metres into project units for the given house `units`.
export function metersToUnits(meters: number, units?: UnitsRef): number {
  return meters * unitsPerMeter(units);
}
