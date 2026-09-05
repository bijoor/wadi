// One-time .wadi model migrations, keyed on `wadi_version` (see
// schema/houseConfig.ts CURRENT_WADI_VERSION). A file with no version (or a lower
// one) renders with its original semantics via the gates in svg2d/expand.ts; this
// upgrades it to the current version WITHOUT changing how it renders, by rewriting
// the affected authoring so the new engine reproduces the old geometry.
//
//   v1 → v2: room-wall opening `offset` moved from the OUTER wall corner to the
//   wall's CLEAR span (inner corner). To keep a v1 model pixel-identical, subtract
//   one wall thickness from every room-wall opening `offset` EXCEPT `center`-
//   anchored ones (the clear span is symmetric, so centred openings don't move).
//   Standalone `wall` openings are unaffected by the v2 change and are left alone.

import { CURRENT_WADI_VERSION } from "../schema/houseConfig";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";

type Bag = Record<string, unknown>;

function num(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Upgrade a config to CURRENT_WADI_VERSION, preserving its rendered geometry.
 *  A no-op (returns the same object) if it is already current. Numeric offsets
 *  only: a `= formula` offset is left as-is and its name collected in `skipped`,
 *  since rewriting a formula can't be done safely without the resolved value. */
export function migrateToCurrentVersion(
  config: Bag,
): { config: Bag; changed: boolean; skipped: string[] } {
  const from = num(config.wadi_version, 1);
  if (from >= CURRENT_WADI_VERSION) return { config, changed: false, skipped: [] };

  const out = structuredClone(config) as Bag;
  const skipped: string[] = [];
  const defaults = (out.defaults as { wall_thickness?: number } | undefined) ?? {};
  const houseT = num(defaults.wall_thickness, DEFAULT_GLOBAL_CONFIG.wall_thickness);

  // v1 → v2: shift room-wall opening offsets inward by one wall thickness.
  if (from < 2) {
    for (const fl of (out.floors as Bag[] | undefined) ?? []) {
      for (const o of (fl.objects as Bag[] | undefined) ?? []) {
        if (o.type !== "room") continue;
        const walls = o.walls;
        if (!walls || typeof walls !== "object" || Array.isArray(walls)) continue;
        const t = num((o as { wall_thickness?: number }).wall_thickness, houseT);
        for (const side of Object.keys(walls as Bag)) {
          const wc = (walls as Bag)[side] as { openings?: Bag[] } | undefined;
          for (const op of wc?.openings ?? []) {
            if (op.anchor === "center") continue; // symmetric ⇒ unchanged
            const hasFormula = (op.formulas as Bag | undefined)?.offset !== undefined;
            if (hasFormula) { skipped.push(String(op.name ?? "?")); continue; }
            // Shift inward by one thickness; clamp at 0. An opening that sat in the
            // corner region (offset < t) has no exact v2 spot — the clear span
            // starts at the inner corner — so it lands flush at the inner corner.
            if (typeof op.offset === "number") op.offset = Math.max(0, op.offset - t);
          }
        }
      }
    }
  }

  out.wadi_version = CURRENT_WADI_VERSION;
  return { config: out, changed: true, skipped };
}
