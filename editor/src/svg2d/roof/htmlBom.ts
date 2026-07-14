// HTML bill-of-materials tables that replace the old
// `consolidated_bom` / `tile_roofing` / `materials_takeoff` SVG panels
// in the viewer's Roof Details tab. All tables re-compute from the
// same RoofComputed + HouseConfig the SVG panels used, so they update
// live on any config edit.
//
// Three tables are produced:
//   1. Frame BOM         — one row per structural member (rafter, purlin,
//                          truss chord, truss web, ring beam, hip beam,
//                          vent strut, Pani Patti, eave L-channel,
//                          corner double angle).
//   2. Metal BOM by spec — same members aggregated by material section
//                          (e.g. "2×4 in × 2 mm MS"), summed total length,
//                          plus pieces-to-order at the configured stock
//                          length.
//   3. Roof material BOM — Mangalore tiles, ceiling tiles, ridge tiles,
//                          from configured tiles/sft × roof area × waste.

import type { RoofComputed } from "./geometry";
import type { HouseConfig } from "../expand";

// ---------------------------------------------------------------
// Public types + config readers
// ---------------------------------------------------------------

export interface TileDensities {
  mangaloreTilesPerSft: number;   // main pantile, default 1.33
  ceilingTilesPerSft: number;     // flat under-ceiling, default 1.5
  wastePct: number;               // 0..1, default 0.10
}

export interface MetalStockConfig {
  defaultLengthFt: number;                     // e.g. 20 ft mill length
  cuttingWastePct: number;                     // 0..1, applied on top of total length
  bySpec: Record<string, number>;              // matSpec → stock length ft (override)
}

// Reads tile densities from roof.tile_density on the first hip_roof
// object in the config, falling back to industry defaults.
export function readTileDensities(cfg: HouseConfig): TileDensities {
  const defaults: TileDensities = {
    mangaloreTilesPerSft: 1.33,
    ceilingTilesPerSft: 1.5,
    wastePct: 0.10,
  };
  const roof = findHipRoof(cfg);
  const td = (roof as { tile_density?: Record<string, number> } | undefined)?.tile_density;
  if (!td) return defaults;
  return {
    mangaloreTilesPerSft: td.mangalore_per_sft ?? defaults.mangaloreTilesPerSft,
    ceilingTilesPerSft: td.ceiling_per_sft ?? defaults.ceilingTilesPerSft,
    wastePct: td.waste_pct ?? defaults.wastePct,
  };
}

// Reads metal-stock config from roof.metal_stock. Defaults to 20 ft
// stock length and 0 % cutting waste; per-spec overrides let the user
// specify a different length for e.g. thinner sections that come in
// 12 ft or 6 m bars.
export function readMetalStock(cfg: HouseConfig): MetalStockConfig {
  const defaults: MetalStockConfig = {
    defaultLengthFt: 20,
    cuttingWastePct: 0,
    bySpec: {},
  };
  const roof = findHipRoof(cfg);
  const ms = (roof as { metal_stock?: Record<string, unknown> } | undefined)?.metal_stock;
  if (!ms) return defaults;
  return {
    defaultLengthFt: Number(ms.default_length_ft ?? defaults.defaultLengthFt),
    cuttingWastePct: Number(ms.cutting_waste_pct ?? defaults.cuttingWastePct),
    bySpec: (ms.by_spec as Record<string, number> | undefined) ?? {},
  };
}

function findHipRoof(cfg: HouseConfig): Record<string, unknown> | undefined {
  for (const floor of cfg.floors ?? []) {
    for (const obj of floor.objects ?? []) {
      if ((obj as { type?: string }).type === "hip_roof") {
        return obj as unknown as Record<string, unknown>;
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------
// Frame member data model (shared between Frame BOM + Metal BOM)
// ---------------------------------------------------------------

export interface FrameMember {
  item: string;          // display name, e.g. "Rafters", "Truss top chord"
  matSpec: string;       // canonical material spec, grouping key for Metal BOM
  extraNote: string;     // optional suffix for Frame BOM (spacing, description)
  count: number;         // pieces
  maxLenFt: number;      // longest single piece
  totalLenFt: number;    // sum across all pieces
}

// Canonicalise a size + wall into a comparable material spec string
// (used as the group key in Metal BOM). Format: "H×W in × T mm MS".
export function matSpec(size: [number, number], wallMm: number, material: string = "MS"): string {
  return `${size[0]}×${size[1]} in × ${wallMm} mm ${material}`;
}

// Build the canonical list of frame members. Each member represents
// one line-item on the Frame BOM AND contributes to a group on the
// Metal BOM (via matSpec).
export function collectFrameMembers(computed: RoofComputed): FrameMember[] {
  const uToFt = (u: number) => u / 10.0;
  const members: FrameMember[] = [];
  const t = computed.totals;
  const framing = computed.framing;

  members.push({
    item: "Rafters",
    matSpec: matSpec(computed.rafter_size_in, computed.rafter_wall_mm),
    extraNote: `${computed.rafter_spacing_in}″ o.c.`,
    count: t.rafter_count,
    maxLenFt: uToFt(t.rafter_max),
    totalLenFt: uToFt(t.rafter_total),
  });
  members.push({
    item: "Purlins",
    matSpec: matSpec(computed.purlin_size_in, computed.purlin_wall_mm),
    extraNote: `${computed.purlin_spacing_in}″ o.c.`,
    count: t.purlin_count,
    maxLenFt: uToFt(t.purlin_max),
    totalLenFt: uToFt(t.purlin_total),
  });
  members.push({
    item: "Central ridge",
    matSpec: matSpec(computed.ridge_size_in, computed.ridge_wall_mm),
    extraNote: "top ridge",
    count: 1,
    maxLenFt: uToFt(computed.central_ridge_total),
    totalLenFt: uToFt(computed.central_ridge_total),
  });
  members.push({
    item: "Hip ridges",
    matSpec: matSpec(computed.ridge_size_in, computed.ridge_wall_mm),
    extraNote: "4 diagonals",
    count: 4,
    maxLenFt: uToFt(computed.hip_ridges_total / 4),
    totalLenFt: uToFt(computed.hip_ridges_total),
  });

  // Trusses — break into their steel pieces so the Metal BOM can group.
  if (computed.truss_count > 0) {
    const trussCfg = computed.truss_cfg as Record<string, unknown>;
    const tcSz = (trussCfg.chord_size_in as [number, number]) ?? [2, 4];
    const tcWall = Number(trussCfg.chord_wall_mm ?? 3);
    const twSz = (trussCfg.web_size_in as [number, number]) ?? [2, 2];
    const twWall = Number(trussCfg.web_wall_mm ?? 2);
    const N = computed.truss_count;
    members.push({
      item: "Truss top chord",
      matSpec: matSpec(tcSz, tcWall),
      extraNote: `2 per truss × ${N}`,
      count: N * 2,
      maxLenFt: uToFt(computed.truss_top_chord_len),
      totalLenFt: uToFt(N * 2 * computed.truss_top_chord_len),
    });
    members.push({
      item: "Truss bottom chord",
      matSpec: matSpec(tcSz, tcWall),
      extraNote: `1 per truss × ${N}`,
      count: N,
      maxLenFt: uToFt(computed.truss_bottom_chord_len),
      totalLenFt: uToFt(N * computed.truss_bottom_chord_len),
    });
    members.push({
      item: "Truss king post",
      matSpec: matSpec(twSz, twWall),
      extraNote: `1 per truss × ${N}`,
      count: N,
      maxLenFt: uToFt(computed.truss_king_post_len),
      totalLenFt: uToFt(N * computed.truss_king_post_len),
    });
    members.push({
      item: "Truss web diagonals",
      matSpec: matSpec(twSz, twWall),
      extraNote: `2 per truss × ${N}`,
      count: N * 2,
      maxLenFt: uToFt(computed.truss_diag_len),
      totalLenFt: uToFt(N * 2 * computed.truss_diag_len),
    });
    members.push({
      item: "Truss web verticals",
      matSpec: matSpec(twSz, twWall),
      extraNote: `2 per truss × ${N}`,
      count: N * 2,
      maxLenFt: uToFt(computed.truss_vert_len),
      totalLenFt: uToFt(N * 2 * computed.truss_vert_len),
    });
  }

  // Long trusses (ridge-line) — same treatment.
  if (computed.long_truss_count > 0) {
    const longCfg = computed.long_truss_cfg as Record<string, unknown>;
    const lcSz = (longCfg.chord_size_in as [number, number]) ?? [2, 4];
    const lcWall = Number(longCfg.chord_wall_mm ?? 3);
    const N = computed.long_truss_count;
    // Long-truss members are grouped as one aggregate row per truss for now
    // (chord + web totals are provided as per-truss aggregates on RoofComputed).
    members.push({
      item: "Long-truss chord bars",
      matSpec: matSpec(lcSz, lcWall),
      extraNote: `${N} truss(es)`,
      count: N,
      maxLenFt: uToFt(computed.long_chord_total_each),
      totalLenFt: uToFt(N * computed.long_chord_total_each),
    });
  }

  members.push({
    item: "Ring beam",
    matSpec: matSpec(computed.ring_beam_size, computed.ring_beam_wall),
    extraNote: "perimeter loop",
    count: 4,
    maxLenFt: uToFt(Math.max(computed.house_trans_u, computed.house_long_u)),
    totalLenFt: uToFt(computed.ring_beam_total),
  });

  if (computed.hip_beam_total_count > 0) {
    members.push({
      item: "Hip beams",
      matSpec: matSpec(computed.hip_beam_size, computed.hip_beam_wall),
      extraNote: `avg ${fmt(uToFt(computed.hip_beam_avg_len))} ft`,
      count: computed.hip_beam_total_count,
      maxLenFt: uToFt(Math.max(computed.hip_beam_n_len, computed.hip_beam_s_len)),
      totalLenFt: uToFt(computed.hip_beam_total_len),
    });
  }

  if (computed.vent_strut_count > 0) {
    const trussCfg = computed.truss_cfg as Record<string, unknown>;
    const twSz = (trussCfg.web_size_in as [number, number]) ?? [2, 2];
    const twWall = Number(trussCfg.web_wall_mm ?? 2);
    members.push({
      item: "Ridge-vent struts",
      matSpec: matSpec(twSz, twWall),
      extraNote: "under ridge cap",
      count: computed.vent_strut_count,
      maxLenFt: uToFt(computed.vent_strut_len_each),
      totalLenFt: uToFt(computed.vent_strut_total),
    });
  }

  // Eave detail items.
  const pp = (framing.pani_patti as Record<string, unknown>) ?? {};
  const ppH = Number(pp.height_in ?? 6);
  const ppThk = Number(pp.thickness_mm ?? 1.2);
  const lchSz = (framing.eave_L_channel_size_in as [number, number]) ?? [1, 1];
  const lchWall = Number(framing.eave_L_channel_wall_mm ?? 3);
  const cornerSz = (framing.corner_double_angle_size_in as [number, number]) ?? [1, 1];
  const cornerWall = Number(framing.corner_double_angle_wall_mm ?? 3);
  const eavePerimFt = uToFt(computed.eave_perim_total);
  const hipRidgesTotalFt = uToFt(computed.hip_ridges_total);

  members.push({
    item: "Pani Patti",
    matSpec: `${ppH.toFixed(0)}″ × ${ppThk} mm GI strip`,
    extraNote: "water-protector strip",
    count: 4,
    maxLenFt: eavePerimFt / 4,
    totalLenFt: eavePerimFt,
  });
  members.push({
    item: "Eave L-channel",
    matSpec: matSpec(lchSz, lchWall),
    extraNote: "on top of Pani Patti",
    count: 4,
    maxLenFt: eavePerimFt / 4,
    totalLenFt: eavePerimFt,
  });
  members.push({
    item: "Corner double angle",
    matSpec: matSpec(cornerSz, cornerWall),
    extraNote: "2 legs per hip",
    count: 8,
    maxLenFt: hipRidgesTotalFt / 4,
    totalLenFt: 2 * hipRidgesTotalFt,
  });

  return members;
}

// ---------------------------------------------------------------
// Public entry points — the three HTML BOM tables
// ---------------------------------------------------------------

export function frameBomHtml(
  computeds: RoofComputed | RoofComputed[],
  extraMembers: FrameMember[] = [],
): string {
  const arr = Array.isArray(computeds) ? computeds : [computeds];
  // Concatenate hip members across all roofs, then append any extras
  // (gable members supplied by the caller). The hip loop tags rows
  // with roof # when there's more than one hip; gable rows come with
  // their own gable # in their item names.
  const hipMembers = arr.flatMap((c, ri) =>
    collectFrameMembers(c).map((m) => ({
      ...m,
      item: arr.length > 1 ? `${m.item} (hip #${ri + 1})` : m.item,
    })),
  );
  const members = [...hipMembers, ...extraMembers];
  const rows = members.map((m) => [
    m.item,
    m.extraNote ? `${m.matSpec} · ${m.extraNote}` : m.matSpec,
    String(m.count),
    m.count > 1 ? `up to ${fmt(m.maxLenFt)} ft` : `${fmt(m.maxLenFt)} ft`,
    `${fmt(m.totalLenFt)} ft`,
  ]);
  const totalRoofs = arr.length + (extraMembers.length > 0 ? 1 : 0);
  return renderTable(
    totalRoofs > 1
      ? `Frame BOM — steel takeoff (${arr.length} hip + gable members)`
      : "Frame BOM — steel takeoff by member",
    ["Item", "Spec", "Qty", "Length each", "Total length"],
    rows,
  );
}

export function metalBomHtml(
  computeds: RoofComputed | RoofComputed[],
  stock: MetalStockConfig,
  extraMembers: FrameMember[] = [],
): string {
  const arr = Array.isArray(computeds) ? computeds : [computeds];
  // Aggregate across every hip + gable member so pieces-to-order is
  // one purchase order for the whole project.
  const members = [...arr.flatMap((c) => collectFrameMembers(c)), ...extraMembers];
  // Group members by canonical matSpec, summing totalLenFt and tracking
  // which item names contribute.
  const groups = new Map<string, { totalLenFt: number; items: string[] }>();
  for (const m of members) {
    const g = groups.get(m.matSpec) ?? { totalLenFt: 0, items: [] };
    g.totalLenFt += m.totalLenFt;
    if (!g.items.includes(m.item)) g.items.push(m.item);
    groups.set(m.matSpec, g);
  }

  const wasteMul = 1 + stock.cuttingWastePct;
  const rows: string[][] = [];
  const sortedSpecs = [...groups.keys()].sort();
  for (const spec of sortedSpecs) {
    const g = groups.get(spec)!;
    const stockLen = stock.bySpec[spec] ?? stock.defaultLengthFt;
    const orderLen = g.totalLenFt * wasteMul;
    const pieces = stockLen > 0 ? Math.ceil(orderLen / stockLen) : 0;
    rows.push([
      spec,
      g.items.join(", "),
      `${fmt(g.totalLenFt)} ft`,
      `${fmt(stockLen)} ft`,
      `${pieces}`,
    ]);
  }

  const wasteNote = stock.cuttingWastePct > 0
    ? ` (incl. ${pct(stock.cuttingWastePct)} cutting waste)`
    : "";
  return renderTable(
    `Metal BOM by spec — pieces to order${wasteNote}`,
    ["Material spec", "Used in", "Total length", "Stock length", "Pieces"],
    rows,
  );
}

export function roofMaterialBomHtml(
  computeds: RoofComputed | RoofComputed[],
  densities: TileDensities,
  gableAreaSft: number = 0,
  gableRidgeRunFt: number = 0,
): string {
  const arr = Array.isArray(computeds) ? computeds : [computeds];
  // Sum tile-covered area and ridge-run across every roof — both hip
  // (from RoofComputed) and gable (caller supplies the pre-summed
  // contributions via the last two args).
  const area = arr.reduce((s, c) => s + c.total_roof_area_sft, 0) + gableAreaSft;
  const ridgeRunFt = arr.reduce((s, c) => s + c.total_ridge_run_ft, 0) + gableRidgeRunFt;
  const wasteMul = 1 + densities.wastePct;

  const mangaloreQty = Math.ceil(area * densities.mangaloreTilesPerSft * wasteMul);
  const ceilingQty = Math.ceil(area * densities.ceilingTilesPerSft * wasteMul);
  const ridgeQty = Math.ceil(ridgeRunFt * wasteMul);

  const rows: string[][] = [
    [
      "Mangalore tiles (main pantile)",
      `${densities.mangaloreTilesPerSft} tiles/sft × ${fmt(area)} sft × ${pct(densities.wastePct)} waste`,
      `${mangaloreQty.toLocaleString("en-US")} tiles`,
    ],
    [
      "Ceiling tiles (flat under-ceiling)",
      `${densities.ceilingTilesPerSft} tiles/sft × ${fmt(area)} sft × ${pct(densities.wastePct)} waste`,
      `${ceilingQty.toLocaleString("en-US")} tiles`,
    ],
    [
      "Ridge tiles (central + 4 hips)",
      `${fmt(ridgeRunFt)} ft × ${pct(densities.wastePct)} waste`,
      `${ridgeQty.toLocaleString("en-US")} run ft`,
    ],
  ];

  return renderTable("Roof material BOM — tile take-off from configured densities", ["Item", "Calculation", "Quantity"], rows);
}

// ---------------------------------------------------------------
// helpers
// ---------------------------------------------------------------

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
function pct(f: number): string {
  return `${Math.round(f * 100)}%`;
}

function renderTable(title: string, headers: string[], rows: string[][]): string {
  const style = `
    <style>
      .roof-bom-card { padding: 1rem 1.25rem; color: #1e293b; }
      .roof-bom-card h3 { margin: 0 0 0.75rem 0; font-size: 1rem; color: #B85028; font-weight: 600; }
      .roof-bom-card table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      .roof-bom-card th, .roof-bom-card td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
      .roof-bom-card th { background: #f8fafc; font-weight: 600; color: #334155; }
      .roof-bom-card tr:last-child td { border-bottom: none; }
      .roof-bom-card td:last-child, .roof-bom-card th:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    </style>`;
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `${style}<div class="roof-bom-card"><h3>${escapeHtml(title)}</h3><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
