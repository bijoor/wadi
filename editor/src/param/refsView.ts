// The data behind the "ƒx refs" lookup: every symbol an author can reference in
// an `= formula`, with its RESOLVED value. One shared shaping so the form editor's
// RefPopover, the WDL editor's panel, and the MCP `wadi_scope` tool all show the
// same thing. Values come from the same `scopeForConfig` the resolver uses.

import type { HouseConfig } from "../schema/houseConfig";
import { scopeForConfig } from "./resolve";

export interface RefVar {
  name: string;
  value: number | null;
  /** The `= …` source, if this variable is a formula (else undefined). */
  formula?: string;
}
export interface RefPoint {
  name: string;
  x: number | null;
  y: number | null;
}
export interface RefGridLine {
  /** The line name (`1`, `A`, …). */
  name: string;
  value: number | null;
}
export interface RefGrid {
  id: string;
  xLines: RefGridLine[];
  yLines: RefGridLine[];
}
export interface RefsView {
  variables: RefVar[];
  points: RefPoint[];
  grids: RefGrid[];
}

const isFormula = (v: unknown): v is string =>
  typeof v === "string" && v.trimStart().startsWith("=");

const num = (v: number | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Format a resolved value for display: integers plain, else rounded to 3 dp;
 *  `⚠` when unresolved. Shared so every surface renders values identically. */
export function formatRefValue(v: number | null): string {
  if (v === null) return "⚠";
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
}

/** Shape a config into the referenceable variables, points, and grid lines with
 *  their resolved values. Sort is source order for variables/points; grid lines
 *  keep their declared order (from the resolved scope keys). */
export function buildRefsView(config: HouseConfig | null | undefined): RefsView {
  const scope = scopeForConfig(config);
  const c = config as {
    variables?: Record<string, number | string>;
    points?: Record<string, { x: number | string; y: number | string }>;
  } | null;

  const variables: RefVar[] = Object.entries(c?.variables ?? {}).map(([name, val]) => ({
    name,
    value: num(scope[name]),
    formula: isFormula(val) ? val : undefined,
  }));

  const points: RefPoint[] = Object.keys(c?.points ?? {}).map((name) => ({
    name,
    x: num(scope[`${name}.x`]),
    y: num(scope[`${name}.y`]),
  }));

  // Grid lines land in the scope as `<id>.x<line>` / `<id>.y<line>` (line name is
  // 1+ chars, which distinguishes them from a point's single-char `.x`/`.y`
  // synonyms). Reconstruct the grids from those keys, preserving key order.
  const grids = new Map<string, { xLines: RefGridLine[]; yLines: RefGridLine[] }>();
  for (const [key, val] of Object.entries(scope)) {
    const m = key.match(/^(\w+)\.([xy])(.+)$/);
    if (!m) continue;
    const [, id, axis, line] = m;
    if (!grids.has(id)) grids.set(id, { xLines: [], yLines: [] });
    const g = grids.get(id)!;
    (axis === "x" ? g.xLines : g.yLines).push({ name: line, value: num(val) });
  }

  return {
    variables,
    points,
    grids: [...grids].map(([id, g]) => ({ id, ...g })),
  };
}
