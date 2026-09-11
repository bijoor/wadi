// V2 BOM aggregation — computed directly from RoofSpec, no per-
// roof-type branching. Replaces the ~600 lines of htmlBom.ts +
// gableBom.ts + flat/shed contribution helpers with a single code
// path that treats every roof (hip / gable / dutch / flat / shed /
// multi-segment) as the same shape.
//
// The output shape (FrameBomRow, MetalBomRow) matches what the
// existing HTML BOM tables consume, so v2 can drop into the
// existing renderer once callers switch.

import type {
  MemberRole,
  RoofSpec,
  StraightMember,
} from "./model";
import { buildFinkTrussMembers, type TrussSectionConfig } from "./truss";

// ---------------------------------------------------------------
// Framing configuration — the "how big is each stick" side of the
// BOM math. RoofSpec members carry positions + length; framing
// provides the section (H×W in) and wall thickness (mm) per role.
// ---------------------------------------------------------------

export interface FramingConfig {
  rafter_size_in: [number, number];
  rafter_wall_mm: number;
  rafter_spacing_in: number;
  purlin_size_in: [number, number];
  purlin_wall_mm: number;
  purlin_spacing_in: number;
  ridge_size_in: [number, number];
  ridge_wall_mm: number;
  hip_size_in?: [number, number];   // defaults to ridge_size_in
  hip_wall_mm?: number;
  valley_size_in?: [number, number]; // defaults to ridge_size_in
  valley_wall_mm?: number;
  ring_beam_size_in: [number, number];
  ring_beam_wall_mm: number;
  // Add a horizontal ring at mid-slope on each roof face (aligned with the
  // truss mid-height web node), rafter-sized. Off by default so existing
  // models are unchanged. Follows each face's own mid-height, so it works
  // under unequal pitch (the ring simply steps in Z at the hips).
  mid_ring?: boolean;
  // Add fabrication end-cut panels (hip + rafter cut sheets) to the Roof
  // Details tab. Off by default so a roof's detail sheet is unchanged.
  cut_sheets?: boolean;
  // Flat wall-top tie beams (ceiling ties). Default = ring-beam section.
  tie_beam_size_in?: [number, number];
  tie_beam_wall_mm?: number;
  // Truss section — chords carry the roof load, webs stiffen the
  // triangle. Legacy default is 2×4 chords + 2×2 webs (MS pipe).
  truss?: TrussSectionConfig;
  // Eave border elements.
  pani_patti?: { height_in: number; thickness_mm: number };
  eave_L_channel_size_in?: [number, number];
  eave_L_channel_wall_mm?: number;
  corner_double_angle_size_in?: [number, number];
  corner_double_angle_wall_mm?: number;
  material?: string;                 // "MS", "GI", etc. Default "MS".
}

// Sensible defaults so callers can pass a partial config and rely
// on fallbacks (roof.framing → houseDefaults → these).
export const DEFAULT_V2_FRAMING: FramingConfig = {
  rafter_size_in: [2, 4],
  rafter_wall_mm: 2,
  rafter_spacing_in: 36,
  purlin_size_in: [2, 1],
  purlin_wall_mm: 1.5,
  purlin_spacing_in: 12,
  ridge_size_in: [6, 3],
  ridge_wall_mm: 3,
  ring_beam_size_in: [4, 2],
  ring_beam_wall_mm: 3,
  material: "MS",
};

// ---------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------

export interface FrameBomRow {
  item: string;            // e.g. "Central ridge", "Hip ridges"
  role: MemberRole;
  matSpec: string;         // canonical material spec (grouping key)
  count: number;
  maxLenFt: number;        // longest single piece
  totalLenFt: number;      // sum across all pieces
}

export interface MetalBomRow {
  matSpec: string;
  totalLenFt: number;
  stockLenFt: number;         // stock length used for procurement math
  piecesToOrder: number;      // ceil(totalLenFt × (1 + waste_pct/100) / stockLenFt)
  contributingItems: string[]; // Frame BOM item names that feed this row
}

export interface MetalStockConfig {
  default_length_ft: number;
  cutting_waste_pct: number;
}

export const DEFAULT_METAL_STOCK: MetalStockConfig = {
  default_length_ft: 20,
  cutting_waste_pct: 5,
};

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const U_TO_FT = 1 / 10;   // 10 project units = 1 ft

// Canonical material spec string — matches the legacy `matSpec()` in
// htmlBom.ts so BOM rows can be diffed row-for-row during migration.
export function matSpec(
  size: [number, number],
  wallMm: number,
  material = "MS",
): string {
  return `${size[0]}×${size[1]} in × ${wallMm} mm ${material}`;
}

function memberLenU(m: StraightMember): number {
  const dx = m.end[0] - m.start[0];
  const dy = m.end[1] - m.start[1];
  const dz = m.end[2] - m.start[2];
  return Math.hypot(dx, dy, dz);
}

// Roles that count as "roof-frame member" for BOM. Excludes ephemeral
// annotations (truss_web etc are covered separately).
const FRAME_ROLES: MemberRole[] = [
  "ridge",
  "hip",
  "valley",
  "ring_beam",
  "mid_ring",
  "rafter",
  "purlin",
  "tie_beam",
  "hip_beam",
  "vent_strut",
  "parapet_cap",
  "pani_patti",
  "eave_L_channel",
  "corner_double_angle",
];

interface RoleAggregation {
  count: number;
  maxLenFt: number;
  totalLenFt: number;
}

function aggregateByRole(spec: RoofSpec): Map<MemberRole, RoleAggregation> {
  const out = new Map<MemberRole, RoleAggregation>();
  for (const m of spec.members) {
    if (!FRAME_ROLES.includes(m.role)) continue;
    const lenFt = memberLenU(m) * U_TO_FT;
    const cur = out.get(m.role) ?? { count: 0, maxLenFt: 0, totalLenFt: 0 };
    cur.count += 1;
    cur.totalLenFt += lenFt;
    if (lenFt > cur.maxLenFt) cur.maxLenFt = lenFt;
    out.set(m.role, cur);
  }
  return out;
}

// ---------------------------------------------------------------
// Frame BOM
// ---------------------------------------------------------------

export function computeFrameBom(
  spec: RoofSpec,
  framing: Partial<FramingConfig> = {},
): FrameBomRow[] {
  const cfg: FramingConfig = { ...DEFAULT_V2_FRAMING, ...framing };
  const material = cfg.material ?? "MS";
  const agg = aggregateByRole(spec);
  const rows: FrameBomRow[] = [];

  const push = (
    role: MemberRole,
    item: string,
    size: [number, number],
    wallMm: number,
  ) => {
    const a = agg.get(role);
    if (!a || a.count === 0) return;
    rows.push({
      item,
      role,
      matSpec: matSpec(size, wallMm, material),
      count: a.count,
      maxLenFt: a.maxLenFt,
      totalLenFt: a.totalLenFt,
    });
  };

  push("ridge", "Central ridge", cfg.ridge_size_in, cfg.ridge_wall_mm);
  push(
    "hip",
    "Hip ridges",
    cfg.hip_size_in ?? cfg.ridge_size_in,
    cfg.hip_wall_mm ?? cfg.ridge_wall_mm,
  );
  push(
    "valley",
    "Valleys",
    cfg.valley_size_in ?? cfg.ridge_size_in,
    cfg.valley_wall_mm ?? cfg.ridge_wall_mm,
  );
  push("ring_beam", "Ring beam", cfg.ring_beam_size_in, cfg.ring_beam_wall_mm);
  push("mid_ring", "Mid-slope ring", cfg.rafter_size_in, cfg.rafter_wall_mm);
  push("rafter", "Rafters", cfg.rafter_size_in, cfg.rafter_wall_mm);
  push("purlin", "Purlins", cfg.purlin_size_in, cfg.purlin_wall_mm);
  push(
    "tie_beam", "Tie beams",
    cfg.tie_beam_size_in ?? cfg.ring_beam_size_in,
    cfg.tie_beam_wall_mm ?? cfg.ring_beam_wall_mm,
  );
  // Vent struts — braces from extended ridge tip to hip diagonals.
  // Use same section as truss webs by default (2×2 MS pipe).
  push(
    "vent_strut", "Ridge vent struts",
    cfg.truss?.web_size_in ?? [2, 2],
    cfg.truss?.web_wall_mm ?? 2,
  );

  // Eave border elements — pani patti is a GI sheet strip (different
  // spec format from steel pipes), the L-channel and corner angles
  // are standard MS pipe.
  const paniPattiRow = agg.get("pani_patti");
  if (paniPattiRow && paniPattiRow.count > 0) {
    const pp = cfg.pani_patti ?? { height_in: 6, thickness_mm: 1.2 };
    // Pani Patti is always GI (galvanised iron sheet), not the roof-
    // level material. Format aligns with matSpec() so the metal BOM
    // groups it as its own spec.
    rows.push({
      item: "Pani Patti",
      role: "pani_patti",
      matSpec: `${pp.height_in}″ × ${pp.thickness_mm} mm GI`,
      count: paniPattiRow.count,
      maxLenFt: paniPattiRow.maxLenFt,
      totalLenFt: paniPattiRow.totalLenFt,
    });
  }
  push(
    "eave_L_channel", "Eave L-channel",
    cfg.eave_L_channel_size_in ?? [1, 1],
    cfg.eave_L_channel_wall_mm ?? 3,
  );
  push(
    "corner_double_angle", "Corner double angle",
    cfg.corner_double_angle_size_in ?? [1, 1],
    cfg.corner_double_angle_wall_mm ?? 3,
  );

  // Trusses. Each TrussTriangle produces 8 members via the Fink
  // pattern (2 top chords + 1 bottom chord + 1 king post + 2 diag +
  // 2 vert). Aggregate by role across all triangles.
  if (spec.trusses.length > 0) {
    const trussCfg = cfg.truss ?? {
      chord_size_in: [2, 4], chord_wall_mm: 3,
      web_size_in: [2, 2],   web_wall_mm: 2,
    };
    const trussAgg = new Map<MemberRole, RoleAggregation>();
    for (const t of spec.trusses) {
      const members = t.members ?? buildFinkTrussMembers(t, {
        ...trussCfg,
        material: trussCfg.material ?? material,
      });
      for (const m of members) {
        const lenFt = memberLenU(m) * U_TO_FT;
        const cur = trussAgg.get(m.role) ?? { count: 0, maxLenFt: 0, totalLenFt: 0 };
        cur.count += 1;
        cur.totalLenFt += lenFt;
        if (lenFt > cur.maxLenFt) cur.maxLenFt = lenFt;
        trussAgg.set(m.role, cur);
      }
    }
    const pushTruss = (
      role: MemberRole, item: string, size: [number, number], wallMm: number,
    ) => {
      const a = trussAgg.get(role);
      if (!a || a.count === 0) return;
      rows.push({
        item, role, matSpec: matSpec(size, wallMm, material),
        count: a.count, maxLenFt: a.maxLenFt, totalLenFt: a.totalLenFt,
      });
    };
    pushTruss("truss_top_chord",    "Truss top chord",    trussCfg.chord_size_in, trussCfg.chord_wall_mm);
    pushTruss("truss_bottom_chord", "Truss bottom chord", trussCfg.chord_size_in, trussCfg.chord_wall_mm);
    pushTruss("truss_web",          "Truss webs",         trussCfg.web_size_in,   trussCfg.web_wall_mm);
  }

  return rows;
}

// ---------------------------------------------------------------
// Metal BOM — aggregation by matSpec + stock-length calculation
// ---------------------------------------------------------------

export function computeMetalBom(
  frameRows: FrameBomRow[],
  stock: Partial<MetalStockConfig> = {},
): MetalBomRow[] {
  const stockCfg: MetalStockConfig = { ...DEFAULT_METAL_STOCK, ...stock };
  const groups = new Map<string, { totalLenFt: number; items: Set<string> }>();

  for (const row of frameRows) {
    const g = groups.get(row.matSpec) ?? { totalLenFt: 0, items: new Set() };
    g.totalLenFt += row.totalLenFt;
    g.items.add(row.item);
    groups.set(row.matSpec, g);
  }

  const out: MetalBomRow[] = [];
  for (const [spec, g] of groups) {
    const withWaste = g.totalLenFt * (1 + stockCfg.cutting_waste_pct / 100);
    const pieces = Math.ceil(withWaste / stockCfg.default_length_ft);
    out.push({
      matSpec: spec,
      totalLenFt: g.totalLenFt,
      stockLenFt: stockCfg.default_length_ft,
      piecesToOrder: pieces,
      contributingItems: Array.from(g.items).sort(),
    });
  }
  // Deterministic order: alphabetical by matSpec.
  return out.sort((a, b) => a.matSpec.localeCompare(b.matSpec));
}

// ---------------------------------------------------------------
// Convenience: compute both from a single spec + framing.
// ---------------------------------------------------------------

export function computeAllBom(
  spec: RoofSpec,
  framing: Partial<FramingConfig> = {},
  stock: Partial<MetalStockConfig> = {},
): { frame: FrameBomRow[]; metal: MetalBomRow[] } {
  const frame = computeFrameBom(spec, framing);
  const metal = computeMetalBom(frame, stock);
  return { frame, metal };
}

// -----------------------------------------------------------------
// Tile / material BOM helpers — total slope area and ridge run.
// -----------------------------------------------------------------

// Area of a 3D polygon via the "1/2 |Σ v_i × v_{i+1}|" formula
// (Newell's method). Works for planar convex polygons up to N=6ish
// which covers slope quads (4 verts) and hip/gable triangles (3).
function polygonArea3D(verts: ReadonlyArray<readonly [number, number, number]>): number {
  if (verts.length < 3) return 0;
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1, z1] = verts[i];
    const [x2, y2, z2] = verts[(i + 1) % verts.length];
    nx += (y1 - y2) * (z1 + z2);
    ny += (z1 - z2) * (x1 + x2);
    nz += (x1 - x2) * (y1 + y2);
  }
  return 0.5 * Math.hypot(nx, ny, nz);
}

// Total area (sqft) of all slope + hip_face planes — i.e. the
// pitched roof surface that gets tiled. Flat slabs and gable walls
// don't count (flat is a separate spec; gable is wall, not roof).
export function slopeAreaSft(spec: RoofSpec): number {
  let areaU2 = 0;
  for (const p of spec.planes) {
    if (p.role !== "slope" && p.role !== "hip_face") continue;
    areaU2 += polygonArea3D(p.vertices);
  }
  // 10 project units = 1 ft, so 100 u² = 1 sqft.
  return areaU2 / 100;
}

// Total run of ridge members in feet. Used for ridge tile counting.
export function ridgeRunFt(spec: RoofSpec): number {
  let ftTotal = 0;
  for (const m of spec.members) {
    if (m.role !== "ridge") continue;
    ftTotal += memberLenU(m) * U_TO_FT;
  }
  return ftTotal;
}

// Aggregate multiple specs (e.g. one per roof object) into a single
// BOM. Useful when a house has multiple roof objects; produces a
// combined Frame + Metal BOM as if they were one big roof.
export function computeAggregateBom(
  specs: Array<{ spec: RoofSpec; framing?: Partial<FramingConfig> }>,
  stock: Partial<MetalStockConfig> = {},
): { frame: FrameBomRow[]; metal: MetalBomRow[] } {
  const allFrame: FrameBomRow[] = [];
  for (const { spec, framing } of specs) {
    allFrame.push(...computeFrameBom(spec, framing));
  }
  // Merge frame rows by (item, matSpec) so multiple roofs' rafters
  // combine into one row instead of appearing as duplicates.
  const merged = new Map<string, FrameBomRow>();
  for (const row of allFrame) {
    const key = `${row.item}::${row.matSpec}`;
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, { ...row });
    } else {
      cur.count += row.count;
      cur.totalLenFt += row.totalLenFt;
      if (row.maxLenFt > cur.maxLenFt) cur.maxLenFt = row.maxLenFt;
    }
  }
  const frame = Array.from(merged.values()).sort((a, b) =>
    a.item.localeCompare(b.item),
  );
  const metal = computeMetalBom(frame, stock);
  return { frame, metal };
}
