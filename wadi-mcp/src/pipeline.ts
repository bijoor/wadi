// The Wadi pipeline, in-process — the same functions the app and the skill's
// scripts use, so results are byte-identical. No shelling out, no browser, no
// three.js: compile a .wdl, check it (schema + geometry + conventions), and
// render the 2D drawings to SVG, then rasterise to PNG.

import { compileDsl } from "../../wadi-dsl/src/generator/toHouseConfig";
import { resolveParametric } from "../../editor/src/param/resolve";
import { validate } from "../../editor/src/schema/houseConfig";
import { registerExposedComponents } from "../../editor/src/registry/promote";
import { computeMergedV2Spec } from "../../editor/src/svg2d/roof/v2/computeFromHouse";
import { lintStructure, partitionFindings } from "../../editor/src/lint/structural";
import { composeSheet } from "../../editor/src/pipeline/composeSheet";
import { Resvg } from "@resvg/resvg-js";
import { MODULES } from "./assets.generated";

// Serve the bundled std-* DSL modules to the DSL compiler so a design can
// `import "std-furniture"` (and future std packs) over MCP with no filesystem.
export function stdResolveModule(ref: string): string | undefined {
  return MODULES[ref]?.source;
}

export type ViewName = "plans" | "elevations" | "roof";
export const ALL_VIEWS: ViewName[] = ["plans", "elevations", "roof"];

export interface Finding {
  rule?: string;
  level: "error" | "warn";
  message: string;
  floor?: number;
  where?: string;
}
export interface CheckResult {
  ok: boolean;
  errors: Finding[];
  warnings: Finding[];
}

type Cfg = Record<string, unknown>;

/** Compile .wdl → resolved HouseConfig (formulas folded to numbers). Throws on parse error. */
export function compileConfig(wdl: string): Cfg {
  const compiled = compileDsl(wdl, { resolveModule: stdResolveModule }); // throws on syntax/import error
  // Register any exposed components as typed primitives before validate/expand.
  registerExposedComponents(compiled as never);
  const { config } = resolveParametric(compiled as never);
  return config as Cfg;
}

/** Full check: parse + resolve + schema + wall/roof geometry + structural conventions. */
export function checkWdl(wdl: string): CheckResult {
  let config: Cfg;
  try {
    config = compileConfig(wdl);
  } catch (e) {
    return { ok: false, errors: [{ level: "error", message: (e as Error).message }], warnings: [] };
  }

  const res = validate(config);
  if (!res.ok) {
    return {
      ok: false,
      errors: (res.errors ?? []).map((e) => ({ level: "error", message: `/${e.path}: ${e.message}` })),
      warnings: [],
    };
  }

  let roofWarnings: string[] = [];
  try {
    // Throws on fatal wall-opening / expansion errors; per-roof derivation
    // failures are collected on `.warnings` (a skipped roof renders as nothing,
    // so treat it as an ERROR the author must fix — not a silent drop).
    const spec = computeMergedV2Spec(res.data);
    roofWarnings = spec.warnings ?? [];
  } catch (e) {
    return { ok: false, errors: [{ level: "error", message: "geometry: " + (e as Error).message }], warnings: [] };
  }
  if (roofWarnings.length) {
    return {
      ok: false,
      errors: roofWarnings.map((message) => ({ level: "error" as const, message: "roof: " + message })),
      warnings: [],
    };
  }

  const { errors, warnings } = partitionFindings(lintStructure(res.data));
  const map = (f: (typeof errors)[number]): Finding => ({
    rule: f.rule,
    level: f.level,
    message: f.message,
    floor: f.floor,
    where: f.where,
  });
  return { ok: errors.length === 0, errors: errors.map(map), warnings: warnings.map(map) };
}

/** Render the requested 2D drawings to SVG strings (headless, byte-identical to the app). */
export function renderSvgs(wdl: string, views: ViewName[]): Array<{ view: ViewName; svg: string }> {
  const cfg = compileConfig(wdl); // may throw on parse error
  const res = validate(cfg);
  if (!res.ok) throw new Error("schema: " + (res.errors?.[0]?.message ?? "invalid config"));

  // Render the requested views THROUGH the compose Stage DAG (resolve → units →
  // view leaves). Byte-identical to the direct preamble+generate it replaces.
  const sheet = composeSheet(cfg as never, views);
  const artifact: Record<ViewName, string | undefined> = {
    plans: sheet.plans,
    elevations: sheet.elevations,
    roof: sheet.roofTop,
  };
  const out: Array<{ view: ViewName; svg: string }> = [];
  for (const v of views) {
    const svg = artifact[v];
    if (svg !== undefined) out.push({ view: v, svg });
  }
  return out;
}

/** Rasterise an SVG string to a PNG buffer at the given pixel width. */
export function rasterize(svg: string, width = 1600): Buffer {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return Buffer.from(r.render().asPng());
}
