// Format PROJECT-UNIT values as PHYSICAL dimensions for labels + the summary,
// mirroring the main Wadi app's formatDimension (editor/src/svg2d/format.ts):
// `converted = units / perUnit`, then feet+inches for feet_inches, else a decimal
// with a unit suffix. The planner stores everything in project units; `unitSystem`
// + `perUnit` (from the Dimensions panel) say how to display them.

const SUFFIX = { feet: "'", meters: ' m', centimeters: ' cm', millimeters: ' mm' }
const AREA_UNIT = {
  feet_inches: 'ft²', feet: 'ft²', meters: 'm²', centimeters: 'cm²', millimeters: 'mm²',
}

/** Project units -> a physical length string, e.g. "12' 6"", "3.50 m". */
export function fmtLen(units, system = 'feet_inches', perUnit = 10, precision = 2) {
  const pu = Number(perUnit) > 0 ? Number(perUnit) : 10
  const converted = Number(units) / pu
  if (system === 'feet_inches') {
    let feet = Math.trunc(converted)
    let inches = Math.round((converted - feet) * 12)
    if (inches >= 12) { feet += Math.floor(inches / 12); inches %= 12 }
    if (feet > 0 && inches > 0) return `${feet}' ${inches}"`
    if (feet > 0) return `${feet}'`
    return `${inches}"`
  }
  return `${converted.toFixed(precision)}${SUFFIX[system] || ''}`
}

/** Project units² -> a physical area string, e.g. "600 ft²", "55.7 m²". */
export function fmtArea(units2, system = 'feet_inches', perUnit = 10) {
  const pu = Number(perUnit) > 0 ? Number(perUnit) : 10
  const converted = Number(units2) / (pu * pu)
  const decimals = system === 'feet_inches' || system === 'feet' ? 0 : 1
  return `${converted.toFixed(decimals)} ${AREA_UNIT[system] || 'u²'}`
}

/** Pull the display-unit settings out of a model's build block. */
export function unitsOf(build) {
  return { system: (build && build.unitSystem) || 'feet_inches', perUnit: (build && build.perUnit) || 10 }
}
