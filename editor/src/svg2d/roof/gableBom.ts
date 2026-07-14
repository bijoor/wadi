// BOM contribution for gable_roof objects — parallel to
// collectFrameMembers(RoofComputed) in htmlBom.ts, but built from the
// simpler gable geometry (no hip beams, one straight ridge). Feeds
// the same FrameMember shape so Frame BOM + Metal BOM aggregate hip
// and gable roofs uniformly.

import type { HouseConfig } from "../expand";
import { deriveAllGableRoofs, type GableRoofConfig, type GableRoofGeom } from "./gableGeometry";
import { DEFAULT_GLOBAL_CONFIG } from "../config";
import { matSpec, type FrameMember } from "./htmlBom";

// 10 in = 1 unit's worth of length? No — 12 in = 1 ft = 10 units.
const IN_TO_U = 10 / 12;

function resolveFraming(cfg: GableRoofConfig) {
  const g = DEFAULT_GLOBAL_CONFIG.roof_framing;
  const fr = (cfg.framing as Record<string, unknown> | undefined) ?? {};
  return {
    rafter_size_in: (fr.rafter_size_in as [number, number] | undefined) ?? g.rafter_size_in,
    rafter_wall_mm: (fr.rafter_wall_mm as number | undefined) ?? g.wall_thickness_mm?.rafter ?? 2,
    rafter_spacing_in: (fr.rafter_spacing_in as number | undefined) ?? g.rafter_spacing_in,
    purlin_size_in: (fr.purlin_size_in as [number, number] | undefined) ?? g.purlin_size_in,
    purlin_wall_mm: (fr.purlin_wall_mm as number | undefined) ?? g.wall_thickness_mm?.purlin ?? 1.5,
    purlin_spacing_in: (fr.purlin_spacing_in as number | undefined) ?? g.purlin_spacing_in,
    ridge_size_in: (fr.ridge_size_in as [number, number] | undefined) ?? g.ridge_size_in,
    ridge_wall_mm: (fr.ridge_wall_mm as number | undefined) ?? g.wall_thickness_mm?.ridge ?? 3,
    ring_beam_size_in:
      ((fr.ring_beam as { size_in?: [number, number] } | undefined)?.size_in) ??
      g.ring_beam_size_in,
    ring_beam_wall_mm:
      (fr.ring_beam as { wall_mm?: number } | undefined)?.wall_mm ??
      g.wall_thickness_mm?.ring_beam ?? 3,
  };
}

// Members produced by one gable_roof. Called by the BOM aggregators
// once per gable object; results are concatenated with hip members.
export function collectGableMembers(
  geom: GableRoofGeom,
  cfg: GableRoofConfig,
  roofIdx: number,
): FrameMember[] {
  const uToFt = (u: number) => u / 10.0;
  const fr = resolveFraming(cfg);
  const members: FrameMember[] = [];

  const { eave_x_west: ex_w, eave_x_east: ex_e, ridge_y_start: rys, ridge_y_end: rye } = geom;
  const halfTrans = (ex_e - ex_w) / 2;
  const shellRise = geom.ridge_h + geom.wall_top_above_eave;
  const slopeLenU = Math.hypot(halfTrans, shellRise);
  const ridgeLenU = rye - rys;

  // ---- Rafters ------------------------------------------------
  const rafterSpacingU = fr.rafter_spacing_in * IN_TO_U;
  const rafterYs: number[] = [];
  for (let y = rys; y <= rye + 1e-6; y += rafterSpacingU) rafterYs.push(y);
  if (rafterYs[rafterYs.length - 1] < rye - 1e-6) rafterYs.push(rye);
  const rafterCountPerSlope = rafterYs.length;
  const rafterCount = rafterCountPerSlope * 2; // west + east slopes
  members.push({
    item: `Rafters (gable #${roofIdx + 1})`,
    matSpec: matSpec(fr.rafter_size_in, fr.rafter_wall_mm),
    extraNote: `${fr.rafter_spacing_in}″ o.c. · 2 slopes`,
    count: rafterCount,
    maxLenFt: uToFt(slopeLenU),
    totalLenFt: uToFt(rafterCount * slopeLenU),
  });

  // ---- Purlins ------------------------------------------------
  const purlinSpacingU = fr.purlin_spacing_in * IN_TO_U;
  const nPurlinsPerSlope = Math.max(0, Math.floor(slopeLenU / purlinSpacingU) - 1);
  const purlinCount = nPurlinsPerSlope * 2;
  members.push({
    item: `Purlins (gable #${roofIdx + 1})`,
    matSpec: matSpec(fr.purlin_size_in, fr.purlin_wall_mm),
    extraNote: `${fr.purlin_spacing_in}″ o.c. · ${nPurlinsPerSlope} per slope`,
    count: purlinCount,
    maxLenFt: uToFt(ridgeLenU),
    totalLenFt: uToFt(purlinCount * ridgeLenU),
  });

  // ---- Ridge beam ---------------------------------------------
  members.push({
    item: `Ridge beam (gable #${roofIdx + 1})`,
    matSpec: matSpec(fr.ridge_size_in, fr.ridge_wall_mm),
    extraNote: "top ridge",
    count: 1,
    maxLenFt: uToFt(ridgeLenU),
    totalLenFt: uToFt(ridgeLenU),
  });

  // ---- Ring beam ---------------------------------------------
  // Perimeter loop at wall top. Roof footprint is (width × length) or
  // fall back to (eave transverse minus overhang × ridge length).
  const rw = (cfg as { width?: number }).width;
  const rl = (cfg as { length?: number }).length;
  const roofW = rw ?? (ex_e - ex_w);
  const roofL = rl ?? ridgeLenU;
  const ringPerimU = 2 * (roofW + roofL);
  members.push({
    item: `Ring beam (gable #${roofIdx + 1})`,
    matSpec: matSpec(fr.ring_beam_size_in, fr.ring_beam_wall_mm),
    extraNote: "perimeter loop",
    count: 4,
    maxLenFt: uToFt(Math.max(roofW, roofL)),
    totalLenFt: uToFt(ringPerimU),
  });

  // ---- Trusses (optional) -------------------------------------
  const trusses = (cfg as { trusses?: { positions?: number[]; chord_size_in?: [number, number]; chord_wall_mm?: number; web_size_in?: [number, number]; web_wall_mm?: number } }).trusses;
  if (trusses?.positions && trusses.positions.length > 0) {
    const N = trusses.positions.length;
    const chordSz = trusses.chord_size_in ?? [2, 4];
    const chordWall = trusses.chord_wall_mm ?? 3;
    const webSz = trusses.web_size_in ?? [2, 2];
    const webWall = trusses.web_wall_mm ?? 2;
    // Simple triangle truss: 1 bottom chord (= trans span) + 2 top
    // chords (= slope length) + 1 king post (= ridge_h).
    const bottomChordLen = ex_e - ex_w;
    const topChordLen = slopeLenU;
    const kingPostLen = geom.ridge_h;
    members.push({
      item: `Truss bottom chord (gable #${roofIdx + 1})`,
      matSpec: matSpec(chordSz, chordWall),
      extraNote: `1 per truss × ${N}`,
      count: N,
      maxLenFt: uToFt(bottomChordLen),
      totalLenFt: uToFt(N * bottomChordLen),
    });
    members.push({
      item: `Truss top chord (gable #${roofIdx + 1})`,
      matSpec: matSpec(chordSz, chordWall),
      extraNote: `2 per truss × ${N}`,
      count: N * 2,
      maxLenFt: uToFt(topChordLen),
      totalLenFt: uToFt(N * 2 * topChordLen),
    });
    members.push({
      item: `Truss king post (gable #${roofIdx + 1})`,
      matSpec: matSpec(webSz, webWall),
      extraNote: `1 per truss × ${N}`,
      count: N,
      maxLenFt: uToFt(kingPostLen),
      totalLenFt: uToFt(N * kingPostLen),
    });
  }

  return members;
}

// Iterate all gable roofs and return their aggregate frame members.
// Called by main.ts alongside collectFrameMembers over hip roofs.
export function collectAllGableMembers(cfg: HouseConfig): FrameMember[] {
  const out: FrameMember[] = [];
  let gables;
  try {
    gables = deriveAllGableRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch (e) {
    console.warn("[gableBom] derivation failed:", e);
    return out;
  }
  gables.forEach((g, idx) => {
    out.push(...collectGableMembers(g.geom, g.config, idx));
  });
  return out;
}

// Tile-BOM contribution: (total_roof_area_sft, total_ridge_run_ft)
// summed across every gable. Same units as computed.total_roof_area_sft.
export function gableTileContribution(cfg: HouseConfig): { areaSft: number; ridgeRunFt: number } {
  let areaSft = 0;
  let ridgeRunFt = 0;
  let gables;
  try {
    gables = deriveAllGableRoofs(cfg, DEFAULT_GLOBAL_CONFIG);
  } catch {
    return { areaSft: 0, ridgeRunFt: 0 };
  }
  for (const g of gables) {
    const geom = g.geom;
    const halfTrans = (geom.eave_x_east - geom.eave_x_west) / 2;
    const shellRise = geom.ridge_h + geom.wall_top_above_eave;
    const slopeLenU = Math.hypot(halfTrans, shellRise);
    const ridgeLenU = geom.ridge_y_end - geom.ridge_y_start;
    // Area of both slopes = 2 * (slope length × ridge length).
    // Units: (u * u) / 100 = sft (10 u = 1 ft, so 100 sq units = 1 sft).
    areaSft += (2 * slopeLenU * ridgeLenU) / 100;
    // Ridge run (single ridge, no hips).
    ridgeRunFt += ridgeLenU / 10;
  }
  return { areaSft, ridgeRunFt };
}
