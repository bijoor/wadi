// HTML bill-of-materials tables that replace the old
// `consolidated_bom` and `tile_roofing` SVG panels in the viewer's
// Roof Details tab. The tables are computed from the same
// RoofComputed / HouseConfig data the SVG panels used, so the
// counts stay in sync with any config edit.
//
// Both functions return standalone HTML fragments (a wrapper <div>
// with an <h3> and <table>). They're inlined into the viewer's
// roof grid cards — no external stylesheet needed.

import type { RoofComputed } from "./geometry";
import type { HouseConfig } from "../expand";

// ---------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------

export interface TileDensities {
  mangaloreTilesPerSft: number;   // main pantile, default 1.33
  ceilingTilesPerSft: number;     // flat under-ceiling, default 1.5
  wastePct: number;               // 0..1, default 0.10
}

// Reads tile densities from roof.tile_density on the first hip_roof
// object in the config, falling back to industry defaults. Kept
// permissive so users can wire them into house_config.json without a
// schema change.
export function readTileDensities(cfg: HouseConfig): TileDensities {
  const defaults: TileDensities = {
    mangaloreTilesPerSft: 1.33,
    ceilingTilesPerSft: 1.5,
    wastePct: 0.10,
  };
  for (const floor of cfg.floors ?? []) {
    for (const obj of floor.objects ?? []) {
      if ((obj as { type?: string }).type !== "hip_roof") continue;
      const td = (obj as { tile_density?: Record<string, number> }).tile_density;
      if (!td) return defaults;
      return {
        mangaloreTilesPerSft: td.mangalore_per_sft ?? defaults.mangaloreTilesPerSft,
        ceilingTilesPerSft: td.ceiling_per_sft ?? defaults.ceilingTilesPerSft,
        wastePct: td.waste_pct ?? defaults.wastePct,
      };
    }
  }
  return defaults;
}

// Bill of materials for the roof FRAME — trusses, rafters, purlins,
// central ridge, hip ridges, ring beam, hip beams, vent struts. Counts
// / lengths are pulled straight out of RoofComputed (already resolved
// from the config).
export function frameBomHtml(computed: RoofComputed): string {
  const uToFt = (u: number) => u / 10.0; // 10 units = 1 foot in this project

  interface Row {
    item: string;
    spec: string;
    qty: string;
    lenEach: string;
    total: string;
  }
  const rows: Row[] = [];

  // Rafter/purlin counts + total lengths live on computed.totals (sum
  // across all slopes) — the per-slope numbers are in computed.slope_qty
  // and not on the Slope object itself.
  const t = computed.totals;
  const rafterSize = `${computed.rafter_size_in[0]}×${computed.rafter_size_in[1]} in`;
  rows.push({
    item: "Rafters",
    spec: `${rafterSize} MS (${computed.rafter_wall_mm} mm wall) · ${computed.rafter_spacing_in}″ o.c.`,
    qty: String(t.rafter_count),
    lenEach: `up to ${fmt(uToFt(t.rafter_max))} ft`,
    total: `${fmt(uToFt(t.rafter_total))} ft`,
  });

  rows.push({
    item: "Purlins",
    spec: `${computed.purlin_size_in[0]}×${computed.purlin_size_in[1]} in MS (${computed.purlin_wall_mm} mm wall) · ${computed.purlin_spacing_in}″ o.c.`,
    qty: String(t.purlin_count),
    lenEach: `up to ${fmt(uToFt(t.purlin_max))} ft`,
    total: `${fmt(uToFt(t.purlin_total))} ft`,
  });

  const centralRidgeFt = uToFt(computed.central_ridge_total);
  const hipRidgesFt = uToFt(computed.hip_ridges_total);
  rows.push({
    item: "Central ridge",
    spec: `${computed.ridge_size_in[0]}×${computed.ridge_size_in[1]} in MS (${computed.ridge_wall_mm} mm wall)`,
    qty: "1",
    lenEach: `${fmt(centralRidgeFt)} ft`,
    total: `${fmt(centralRidgeFt)} ft`,
  });
  rows.push({
    item: "Hip ridges",
    spec: `${computed.ridge_size_in[0]}×${computed.ridge_size_in[1]} in MS`,
    qty: "4",
    lenEach: `${fmt(hipRidgesFt / 4)} ft`,
    total: `${fmt(hipRidgesFt)} ft`,
  });

  if (computed.truss_count > 0) {
    rows.push({
      item: "Fink trusses (transverse)",
      spec: "chord + web bars — see roof section drawings",
      qty: String(computed.truss_count),
      lenEach: `chord ${fmt(uToFt(computed.truss_chord_total_each))} ft + web ${fmt(uToFt(computed.truss_web_total_each))} ft`,
      total: `${fmt(uToFt(computed.truss_count * (computed.truss_chord_total_each + computed.truss_web_total_each)))} ft`,
    });
  }

  if (computed.long_truss_count > 0) {
    rows.push({
      item: "Long trusses (ridge-line)",
      spec: "chord + web bars",
      qty: String(computed.long_truss_count),
      lenEach: `chord ${fmt(uToFt(computed.long_chord_total_each))} ft + web ${fmt(uToFt(computed.long_web_total_each))} ft`,
      total: `${fmt(uToFt(computed.long_truss_count * (computed.long_chord_total_each + computed.long_web_total_each)))} ft`,
    });
  }

  rows.push({
    item: "Ring beam",
    spec: `${computed.ring_beam_size[0]}×${computed.ring_beam_size[1]} in MS (${computed.ring_beam_wall} mm wall) · perimeter loop`,
    qty: "1 loop",
    lenEach: "",
    total: `${fmt(uToFt(computed.ring_beam_total))} ft`,
  });

  if (computed.hip_beam_total_count > 0) {
    rows.push({
      item: "Hip beams",
      spec: `${computed.hip_beam_size[0]}×${computed.hip_beam_size[1]} in MS`,
      qty: String(computed.hip_beam_total_count),
      lenEach: `${fmt(uToFt(computed.hip_beam_avg_len))} ft avg`,
      total: `${fmt(uToFt(computed.hip_beam_total_len))} ft`,
    });
  }

  if (computed.vent_strut_count > 0) {
    rows.push({
      item: "Ridge-vent struts",
      spec: "vertical struts under ridge cap",
      qty: String(computed.vent_strut_count),
      lenEach: `${fmt(uToFt(computed.vent_strut_len_each))} ft`,
      total: `${fmt(uToFt(computed.vent_strut_total))} ft`,
    });
  }

  // Eave detail items (previously only in the materials takeoff SVG).
  // Read straight off the framing config with the same defaults
  // materials.ts uses. `eave_perim_total` is in project units → /10 = ft.
  const framing = computed.framing;
  const pp = (framing.pani_patti as Record<string, unknown>) ?? {};
  const ppH = Number(pp.height_in ?? 6);
  const ppThk = Number(pp.thickness_mm ?? 1.2);
  const lchSz = (framing.eave_L_channel_size_in as [number, number]) ?? [1, 1];
  const lchWall = Number(framing.eave_L_channel_wall_mm ?? 3);
  const cornerSz = (framing.corner_double_angle_size_in as [number, number]) ?? [1, 1];
  const cornerWall = Number(framing.corner_double_angle_wall_mm ?? 3);
  const eavePerimFt = uToFt(computed.eave_perim_total);
  const hipRidgesTotalFt = uToFt(computed.hip_ridges_total);

  rows.push({
    item: "Pani Patti",
    spec: `${ppH.toFixed(0)}″ × ${ppThk} mm GI · water-protector strip`,
    qty: "4",
    lenEach: "",
    total: `${fmt(eavePerimFt)} ft`,
  });
  rows.push({
    item: "Eave L-channel",
    spec: `${lchSz[0]}×${lchSz[1]} in × ${lchWall} mm · on top of Pani Patti`,
    qty: "4",
    lenEach: "",
    total: `${fmt(eavePerimFt)} ft`,
  });
  rows.push({
    item: "Corner double angle",
    spec: `${cornerSz[0]}×${cornerSz[1]} in × ${cornerWall} mm · 2 legs per hip`,
    qty: "8",
    lenEach: `${fmt(hipRidgesTotalFt / 4)} ft`,
    total: `${fmt(2 * hipRidgesTotalFt)} ft`,
  });

  return renderTable("Frame BOM — steel takeoff by member", ["Item", "Spec", "Qty", "Length each", "Total length"], rows.map((r) => [r.item, r.spec, r.qty, r.lenEach, r.total]));
}

// Bill of materials for the roof COVERING — Mangalore tiles, ceiling
// tiles, ridge tiles. Quantities come from the tile-per-sft densities
// (config-configurable) multiplied by the total roof area, with a
// waste allowance applied to each row.
export function roofMaterialBomHtml(computed: RoofComputed, densities: TileDensities): string {
  const area = computed.total_roof_area_sft;
  const wasteMul = 1 + densities.wastePct;
  const ridgeRunFt = computed.total_ridge_run_ft;

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
