import { DEFAULT_GLOBAL_CONFIG } from "./config";

export type UnitSystem =
  | "feet_inches"
  | "feet"
  | "meters"
  | "centimeters"
  | "millimeters";

interface DimensionUnits {
  system: UnitSystem;
  perUnit: number; // project units that equal ONE display unit
  precision: number; // decimals for the non-feet_inches systems
}

// Default reproduces the historical behaviour exactly: feet & inches,
// 10 project units = 1 ft. (precision only affects decimal systems.)
const DEFAULT_UNITS: DimensionUnits = {
  system: "feet_inches",
  perUnit: DEFAULT_GLOBAL_CONFIG.dimensions.unit_conversion,
  precision: 2,
};

// Module-level "active" units, set from config.units by the render entry
// point (rebuildSvgMap / dump-svgs) before generating SVGs. SVG generation
// is synchronous, so a single set-then-render pass is safe.
let activeUnits: DimensionUnits = { ...DEFAULT_UNITS };

// Set the display units from a config's `units` block (any field omitted
// falls back to the default). Call once before generating a batch of SVGs.
export function setDimensionUnits(u?: {
  system?: UnitSystem;
  per_unit?: number;
  precision?: number;
}): void {
  activeUnits = {
    system: u?.system ?? DEFAULT_UNITS.system,
    perUnit: u?.per_unit ?? DEFAULT_UNITS.perUnit,
    precision: u?.precision ?? DEFAULT_UNITS.precision,
  };
}

// How many feet one display unit spans, per system (mirrors three/units.ts +
// procTextures.ts — keep in step). feet_inches/feet = 1 ft; metric systems convert.
const FEET_PER_DISPLAY_UNIT: Record<UnitSystem, number> = {
  feet_inches: 1,
  feet: 1,
  meters: 3.280839895,
  centimeters: 0.032808399,
  millimeters: 0.003280839,
};
const FEET_PER_METER = 3.280839895;

// Convert a real-world length in METRES into project units, using the active
// display units (set via setDimensionUnits before a render batch). Used to size
// GLB-furniture footprints (`item.asset.dimensions` are metric) on 2D plans.
export function metersToUnits(meters: number): number {
  const { system, perUnit } = activeUnits;
  const unitsPerFoot = perUnit / (FEET_PER_DISPLAY_UNIT[system] ?? 1);
  return meters * unitsPerFoot * FEET_PER_METER;
}

const SUFFIX: Record<Exclude<UnitSystem, "feet_inches">, string> = {
  feet: "'",
  meters: " m",
  centimeters: " cm",
  millimeters: " mm",
};

// Port of svg_2d.py::format_dimension. Byte-identical output for the default
// feet-inches path; the decimal systems render `converted.toFixed(precision)`
// plus a unit suffix.
export function formatDimension(length: number): string {
  const { system, perUnit, precision } = activeUnits;
  const converted = length / perUnit;

  if (system === "feet_inches") {
    let feet = Math.trunc(converted);
    const inches = (converted - feet) * 12;
    let inchesRounded = Math.round(inches);
    if (inchesRounded >= 12) {
      feet += Math.floor(inchesRounded / 12);
      inchesRounded = inchesRounded % 12;
    }
    if (feet > 0 && inchesRounded > 0) return `${feet}' ${inchesRounded}"`;
    if (feet > 0) return `${feet}'`;
    return `${inchesRounded}"`;
  }

  return `${converted.toFixed(precision)}${SUFFIX[system]}`;
}

// Python's default `f"{v}"` for floats emits `.0` for whole values
// (110.0), while ints render bare (110). JavaScript has one number type,
// so we recreate the Python behavior with a per-value check: values that
// were integers in the source JSON stay bare; anything with fractional
// part uses the default JS float formatting. We rely on the fact that
// JSON numbers with no decimal point become integer-valued JS numbers,
// while decimal ones become non-integer JS numbers. In the SVG output,
// e.g. Python's `f'{x}'` where x=110.0 emits `110.0`; where x=110 emits
// `110`. We reproduce this by tracking whether values arrived as ints.
//
// In practice the flat schema stores integers where the source used
// integers, and floats where it used floats. So JS's default number →
// string coercion won't add `.0`. We only need to *add* `.0` for
// derived-float values (e.g. `wall_thickness/2 = 4.0` in Python but 4
// in JS since 8/2 === 4 exactly). The `f()` helper below applies this
// where needed.
export function f(n: number): string {
  // If the number is integer-valued but was produced by float arithmetic
  // where Python would have kept it as a float (e.g. `0.5 + 0.5 = 1.0`
  // in Python renders as "1.0"), the caller must invoke `fFloat(n)`
  // instead. Default is Python's `int` rendering (no trailing .0).
  return String(n);
}

// Force Python float formatting: whole numbers render with a trailing
// `.0`. Use for values that were derived from float arithmetic on the
// Python side (e.g. `y + offset` where either operand was a float).
export function fFloat(n: number): string {
  if (Number.isInteger(n)) return `${n}.0`;
  return String(n);
}
