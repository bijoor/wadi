// Configurator (Gharkul) read/write layer. Pure, DOM-free. Turns a template's
// `configurator` metadata into normalized, unit-converted inputs the owner UI can
// render, and turns owner edits back into `variables`/`points` store patches.
//
// A `target` is either a VARIABLE name ("floorH") or a POINT COORDINATE
// ("House.W" → points.House.x; W/L/X/Y/x/y are the resolver's synonyms). `min`/
// `max`/`step` live in RAW project units; `unit` only affects display.
import type { ConfiguratorInput, ConfiguratorSection, HouseConfig } from "../schema/houseConfig";

const DEFAULT_PER_UNIT = 10; // project units per 1 ft (matches unit_conversion default)

export type ParsedTarget =
  | { kind: "variable"; name: string }
  | { kind: "point"; name: string; coord: "x" | "y" };

const POINT_RE = /^([A-Za-z_]\w*)\.(W|L|X|Y|x|y)$/;

/** Resolve a target string against the config: a point coord if `<Point>.<W|L|…>`
 * names an existing point, otherwise a plain variable. */
export function parseTarget(config: HouseConfig, target: string): ParsedTarget {
  const m = POINT_RE.exec(target);
  if (m && config.points && m[1] in config.points) {
    return { kind: "point", name: m[1], coord: /[WXx]/.test(m[2]) ? "x" : "y" };
  }
  return { kind: "variable", name: target };
}

export function perUnitOf(config: HouseConfig): number {
  return (config.units as { per_unit?: number } | undefined)?.per_unit ?? DEFAULT_PER_UNIT;
}

export interface UnitConv {
  toDisplay: (raw: number) => number; // linear through the origin
  toRaw: (display: number) => number;
  suffix: string;
}
export function unitConv(unit: ConfiguratorInput["unit"], perUnit: number): UnitConv {
  switch (unit) {
    case "ft":
      return { toDisplay: (r) => r / perUnit, toRaw: (d) => d * perUnit, suffix: "ft" };
    case "m":
      return { toDisplay: (r) => r / perUnit, toRaw: (d) => d * perUnit, suffix: "m" };
    case "in":
      return { toDisplay: (r) => (r / perUnit) * 12, toRaw: (d) => (d / 12) * perUnit, suffix: "in" };
    case "percent":
      return { toDisplay: (r) => r * 100, toRaw: (d) => d / 100, suffix: "%" };
    case "units":
      return { toDisplay: (r) => r, toRaw: (d) => d, suffix: "u" };
    case "count":
    case "none":
    default:
      return { toDisplay: (r) => r, toRaw: (d) => d, suffix: "" };
  }
}

/** Current RAW value of a target from the (resolved) config. NaN if not a literal. */
export function readValue(config: HouseConfig, target: string): number {
  const t = parseTarget(config, target);
  if (t.kind === "point") {
    const p = config.points?.[t.name] as { x?: number | string; y?: number | string } | undefined;
    const v = p?.[t.coord];
    return typeof v === "number" ? v : NaN;
  }
  const v = config.variables?.[t.name];
  return typeof v === "number" ? v : NaN;
}

/** Store patch (full map) to set a target to `raw`. Apply the returned side via
 * `updateVariables` / `updatePoints`. */
export function writeValue(
  config: HouseConfig,
  target: string,
  raw: number,
): { variables?: HouseConfig["variables"] } | { points?: HouseConfig["points"] } {
  const t = parseTarget(config, target);
  if (t.kind === "point") {
    const points = { ...(config.points ?? {}) } as NonNullable<HouseConfig["points"]>;
    const prev = points[t.name] ?? { x: 0, y: 0 };
    points[t.name] = { ...prev, [t.coord]: raw };
    return { points };
  }
  const variables = { ...(config.variables ?? {}) } as NonNullable<HouseConfig["variables"]>;
  variables[t.name] = raw;
  return { variables };
}

export type Control = NonNullable<ConfiguratorInput["control"]>;
export function inferControl(input: ConfiguratorInput): Control {
  if (input.control) return input.control;
  if (input.options && input.options.length) return "select";
  if (input.unit === "percent") return "slider";
  if (typeof input.min === "number" && typeof input.max === "number") return "slider";
  return "number";
}

export interface ResolvedInput {
  input: ConfiguratorInput;
  control: Control;
  conv: UnitConv;
  rawValue: number;
  displayValue: number;
  displayMin?: number;
  displayMax?: number;
  displayStep?: number;
}

export interface ResolvedConfigurator {
  section: ConfiguratorSection | undefined;
  groups: NonNullable<ConfiguratorSection["groups"]>;
  inputs: ResolvedInput[];
}

/** Normalize a config's configurator section into render-ready, unit-converted
 * inputs (control inferred, min/max/step/value in display units). */
export function resolveInputs(config: HouseConfig): ResolvedConfigurator {
  const section = config.configurator as ConfiguratorSection | undefined;
  const perUnit = perUnitOf(config);
  const inputs: ResolvedInput[] = (section?.inputs ?? []).map((input) => {
    const conv = unitConv(input.unit, perUnit);
    const rawValue = readValue(config, input.target);
    const num = (v: number | undefined) => (typeof v === "number" ? conv.toDisplay(v) : undefined);
    return {
      input,
      control: inferControl(input),
      conv,
      rawValue,
      displayValue: conv.toDisplay(rawValue),
      displayMin: num(input.min),
      displayMax: num(input.max),
      displayStep: num(input.step),
    };
  });
  return { section, groups: section?.groups ?? [], inputs };
}
