// Roof geometry derivation — mirrors the setup block in
// svg_2d.py::generate_roof_sections_svg (lines 4133-4325 + 5399-5623).
// Returns a large "computed" object that all panel functions consume.
//
// All values are floats in Python; in JS they're plain numbers, and
// downstream emitters use `fFloat`/`f1`/`f2` as needed.

import type { HouseConfig } from "../expand";
import { DEFAULT_GLOBAL_CONFIG, type GlobalConfig } from "../config";
import { deriveForHouse } from "../roofGeometry";

export interface Slope {
  code: string;
  title: string;
  base: number;
  top: number;
  perp_h: number;
  slant: number;
  pitch: number;
  is_tri: boolean;
  d_hip_left?: number;
  d_hip_right?: number;
  d_hip?: number;
}

export interface RoofComputed {
  roof: Record<string, unknown>;
  house_config: HouseConfig;
  global_config: GlobalConfig;
  ridge_axis: string;
  eave_xw: number;
  eave_xe: number;
  eave_yn: number;
  eave_ys: number;
  slope_ns: number;
  slope_ew: number;
  ridge_length: number;
  span_x: number;
  span_y: number;
  h: number;
  d_hip_n: number;
  d_hip_s: number;
  d_hip_w: number;
  d_hip_e: number;
  d_hip: number;
  main_perp_h: number;
  main_slant_n: number;
  main_slant_s: number;
  main_slant: number;
  hip_perp_h_n: number;
  hip_perp_h_s: number;
  hip_slant_n: number;
  hip_slant_s: number;
  hip_perp_h: number;
  hip_slant: number;
  slopes: Slope[];
  framing: Record<string, unknown>;
  rafter_size_in: [number, number];
  rafter_wall_mm: number;
  rafter_spacing_in: number;
  purlin_size_in: [number, number];
  purlin_wall_mm: number;
  purlin_spacing_in: number;
  ridge_size_in: [number, number];
  ridge_wall_mm: number;
  IN_PER_UNIT: number;
  rafter_spacing_u: number;
  purlin_spacing_u: number;
  // Truss-related
  truss_cfg: Record<string, unknown>;
  truss_count: number;
  truss_top_chord_len: number;
  truss_bottom_chord_len: number;
  truss_king_post_len: number;
  truss_diag_len: number;
  truss_vert_len: number;
  truss_chord_total_each: number;
  truss_web_total_each: number;
  truss_effective_span_u: number;
  truss_effective_rise_u: number;
  truss_y_positions: number[];
  // Materials calculations
  slope_qty: Record<string, SlopeQty>;
  totals: SlopeQtyTotals;
  hip_slant_n_val: number;
  hip_slant_s_val: number;
  hip_ridges_total: number;
  ridge_ext_u: number;
  has_ridge_vent: boolean;
  central_ridge_total: number;
  vent_strut_len_each: number;
  vent_strut_count: number;
  vent_strut_total: number;
  eave_perim_total: number;
  // Wall / ring beam
  house_ft: [number, number];
  house_trans_u: number;
  house_long_u: number;
  wall_inset_trans: number;
  wall_inset_long_n: number;
  wall_inset_long_s: number;
  wall_inset_long: number;
  wall_top_above_eave_ft: number;
  wall_top_u: number;
  ridge_depth_u: number;
  ridge_width_u: number;
  ring_beam_cfg: Record<string, unknown>;
  ring_beam_size: [number, number];
  ring_beam_wall: number;
  ring_beam_total: number;
  hip_beam_cfg: Record<string, unknown>;
  hip_beam_count_per_end: number;
  hip_beam_size: [number, number];
  hip_beam_wall: number;
  hip_beam_between_trusses: boolean;
  hip_beam_bay_total_len: number;
  hip_beam_bay_count: number;
  hip_beam_n_len: number;
  hip_beam_s_len: number;
  hip_beam_avg_len: number;
  hip_beam_total_len: number;
  hip_beam_total_count: number;
  // long truss stubs
  long_truss_cfg: Record<string, unknown>;
  long_truss_count: number;
  long_truss_positions: number[];
  long_bottom_chord_len: number;
  long_top_chord_len: number;
  long_side_chord_len: number;
  long_kingpost_len: number;
  long_ridge_end_vert_len: number;
  long_diag_len: number;
  long_diag_count_per_truss: number;
  long_chord_total_each: number;
  long_web_total_each: number;
  // Slope-area cache
  slope_areas_sft: Record<string, number>;
  total_roof_area_sft: number;
  waste_pct: number;
  area_with_waste_sft: number;
  // Procured items
  procured: Array<{
    name: string;
    qty: number;
    rate: number;
    unit: string;
    coverage: number;
    size: string;
    note: string;
  }>;
  subtotal: number;
  delivery: number;
  igst_rate: number;
  igst: number;
  grand_total: number;
  total_ridge_run_ft: number;
  indicotto_need: number;
  ceiling_need: number;
  ridge_need: number;
  indicotto_delta: string;
  indicotto_short: boolean;
  ceiling_delta: string;
  ceiling_short: boolean;
  ridge_delta: string;
  ridge_short: boolean;
}

export interface SlopeQty {
  rafter_count: number;
  rafter_total: number;
  rafter_max: number;
  purlin_count: number;
  purlin_total: number;
  purlin_max: number;
}
export interface SlopeQtyTotals {
  rafter_count: number;
  rafter_total: number;
  rafter_max: number;
  purlin_count: number;
  purlin_total: number;
  purlin_max: number;
}

export const IN_PER_UNIT = 12.0 / 10.0;

function inToU(inches: number): number {
  return inches / IN_PER_UNIT;
}

// Python: round-half-to-even (banker's rounding).
function pyRound(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

function sumConsistentUnits(u: number): number {
  const ft = u / 10.0;
  let feet = Math.trunc(ft);
  let inch = pyRound((ft - feet) * 12);
  if (inch >= 12) {
    feet += 1;
    inch -= 12;
  }
  return (feet * 12 + inch) / 1.2;
}

// Compute the full RoofComputed for every hip_roof in the config
// (Phase 2 — supports multiple roofs). Each roof is computed in
// isolation: the config is cloned with only that roof retained so
// computeAll's single-roof assumptions hold. Result is one entry per
// roof, in the same order they appear in the config.
export function computeAllRoofs(houseConfig: HouseConfig): RoofComputed[] {
  const out: RoofComputed[] = [];
  for (let fi = 0; fi < (houseConfig.floors ?? []).length; fi++) {
    const floor = houseConfig.floors[fi];
    for (let oi = 0; oi < (floor.objects ?? []).length; oi++) {
      const obj = floor.objects[oi] as { type?: string };
      if (obj.type !== "hip_roof") continue;
      // Clone the config and strip every hip_roof except the target
      // (identified by floor + object index). Non-roof objects are kept
      // so wall / plinth data stays available for the roof compute.
      const clone = JSON.parse(JSON.stringify(houseConfig)) as HouseConfig;
      for (let fj = 0; fj < clone.floors.length; fj++) {
        clone.floors[fj].objects = clone.floors[fj].objects.filter(
          (o, oj) => {
            const t = (o as { type?: string }).type;
            if (t !== "hip_roof") return true;
            return fj === fi && oj === oi;
          },
        );
      }
      try {
        const r = computeAll(clone);
        if (r) out.push(r);
      } catch (e) {
        console.warn(`[roof] computeAllRoofs: floor ${fi} obj ${oi} skipped:`, e);
      }
    }
  }
  return out;
}

export function computeAll(houseConfig: HouseConfig): RoofComputed | null {
  const globalConfig = DEFAULT_GLOBAL_CONFIG;

  // Find the hip_roof object
  let roof: Record<string, unknown> | null = null;
  for (const floor of houseConfig.floors ?? []) {
    for (const obj of (floor.objects ?? []) as Record<string, unknown>[]) {
      if (obj.type === "hip_roof") {
        roof = obj;
        break;
      }
    }
    if (roof) break;
  }
  if (!roof) return null;

  const derived = deriveForHouse(houseConfig, globalConfig);
  if (derived) {
    for (const [k, v] of Object.entries(derived)) {
      if (!(k in roof)) roof[k] = v;
    }
  }

  const ridge_axis = (roof.ridge_axis as string) ?? "y";
  const eave_xw = roof.eave_x_west as number;
  const eave_xe = roof.eave_x_east as number;
  const eave_yn = roof.eave_y_north as number;
  const eave_ys = roof.eave_y_south as number;
  const slope_uniform = roof.slope_angle as number | undefined;
  const slope_ns = (roof.slope_angle_ns as number | undefined) ?? slope_uniform ?? 0;
  const slope_ew = (roof.slope_angle_ew as number | undefined) ?? slope_uniform ?? 0;
  const ridge_length_override = roof.ridge_length as number | undefined;

  // Framing defaults come from DEFAULT_GLOBAL_CONFIG.roof_framing;
  // per-roof `framing.*` overrides win. Kept in inches — construction
  // spec convention.
  const framing = (roof.framing as Record<string, unknown>) ?? {};
  const rfGlobal = DEFAULT_GLOBAL_CONFIG.roof_framing;
  const rafter_size_in = (framing.rafter_size_in as [number, number]) ?? rfGlobal.rafter_size_in;
  const rafter_wall_mm = (framing.rafter_wall_mm as number) ?? rfGlobal.wall_thickness_mm?.rafter ?? 2;
  const rafter_spacing_in = (framing.rafter_spacing_in as number) ?? rfGlobal.rafter_spacing_in;
  const purlin_size_in = (framing.purlin_size_in as [number, number]) ?? rfGlobal.purlin_size_in;
  const purlin_wall_mm = (framing.purlin_wall_mm as number) ?? rfGlobal.wall_thickness_mm?.purlin ?? 1.5;
  const purlin_spacing_in = (framing.purlin_spacing_in as number) ?? rfGlobal.purlin_spacing_in;
  const ridge_size_in = (framing.ridge_size_in as [number, number]) ?? rfGlobal.ridge_size_in;
  const ridge_wall_mm = (framing.ridge_wall_mm as number) ?? rfGlobal.wall_thickness_mm?.ridge ?? 2;

  const rafter_spacing_u = inToU(rafter_spacing_in);
  const purlin_spacing_u = inToU(purlin_spacing_in);

  const span_x = eave_xe - eave_xw;
  const span_y = eave_ys - eave_yn;

  const ridge_y_start_override = roof.ridge_y_start as number | undefined;
  const ridge_y_end_override = roof.ridge_y_end as number | undefined;
  const ridge_x_start_override = roof.ridge_x_start as number | undefined;
  const ridge_x_end_override = roof.ridge_x_end as number | undefined;

  let h: number,
    d_hip_n: number,
    d_hip_s: number,
    d_hip_w: number,
    d_hip_e: number,
    ridge_length: number,
    d_hip: number,
    actual_ns_n: number,
    actual_ns_s: number,
    actual_ew_w: number,
    actual_ew_e: number,
    main_perp_h: number,
    main_slant_n: number,
    main_slant_s: number,
    main_slant: number,
    hip_perp_h_n: number,
    hip_perp_h_s: number,
    hip_slant_n: number,
    hip_slant_s: number,
    hip_perp_h: number,
    hip_slant: number;

  const slopes: Slope[] = [];

  if (ridge_axis === "y") {
    h = (span_x / 2.0) * Math.tan((slope_ew * Math.PI) / 180);
    if (ridge_y_start_override !== undefined && ridge_y_end_override !== undefined) {
      d_hip_n = Math.max(0.0, ridge_y_start_override - eave_yn);
      d_hip_s = Math.max(0.0, eave_ys - ridge_y_end_override);
    } else if (ridge_length_override !== undefined) {
      const _hd = Math.max(0.0, (span_y - ridge_length_override) / 2.0);
      d_hip_n = d_hip_s = _hd;
    } else {
      const _hd = h / Math.tan((slope_ns * Math.PI) / 180);
      d_hip_n = d_hip_s = _hd;
    }
    actual_ns_n = d_hip_n > 0 ? (Math.atan(h / d_hip_n) * 180) / Math.PI : 90.0;
    actual_ns_s = d_hip_s > 0 ? (Math.atan(h / d_hip_s) * 180) / Math.PI : 90.0;
    ridge_length = Math.max(0.0, span_y - d_hip_n - d_hip_s);
    d_hip = (d_hip_n + d_hip_s) / 2.0;
    d_hip_w = d_hip_n;
    d_hip_e = d_hip_s;

    main_perp_h = h / Math.sin((slope_ew * Math.PI) / 180);
    main_slant_n = Math.sqrt(d_hip_n ** 2 + main_perp_h ** 2);
    main_slant_s = Math.sqrt(d_hip_s ** 2 + main_perp_h ** 2);
    main_slant = Math.max(main_slant_n, main_slant_s);
    hip_perp_h_n = Math.sqrt(d_hip_n ** 2 + h ** 2);
    hip_perp_h_s = Math.sqrt(d_hip_s ** 2 + h ** 2);
    hip_slant_n = Math.sqrt((span_x / 2.0) ** 2 + hip_perp_h_n ** 2);
    hip_slant_s = Math.sqrt((span_x / 2.0) ** 2 + hip_perp_h_s ** 2);
    hip_perp_h = Math.max(hip_perp_h_n, hip_perp_h_s);
    hip_slant = Math.max(hip_slant_n, hip_slant_s);

    slopes.push(
      {
        code: "W",
        title: "WEST SLOPE (main, trapezoid)",
        base: span_y,
        top: ridge_length,
        perp_h: main_perp_h,
        slant: main_slant,
        pitch: slope_ew,
        is_tri: false,
        d_hip_left: d_hip_n,
        d_hip_right: d_hip_s,
      },
      {
        code: "E",
        title: "EAST SLOPE (main, trapezoid)",
        base: span_y,
        top: ridge_length,
        perp_h: main_perp_h,
        slant: main_slant,
        pitch: slope_ew,
        is_tri: false,
        d_hip_left: d_hip_n,
        d_hip_right: d_hip_s,
      },
      {
        code: "N",
        title: "NORTH SLOPE (hip end, triangle)",
        base: span_x,
        top: 0.0,
        perp_h: hip_perp_h_n,
        slant: hip_slant_n,
        pitch: actual_ns_n,
        is_tri: true,
        d_hip: d_hip_n,
      },
      {
        code: "S",
        title: "SOUTH SLOPE (hip end, triangle)",
        base: span_x,
        top: 0.0,
        perp_h: hip_perp_h_s,
        slant: hip_slant_s,
        pitch: actual_ns_s,
        is_tri: true,
        d_hip: d_hip_s,
      },
    );
  } else {
    h = (span_y / 2.0) * Math.tan((slope_ns * Math.PI) / 180);
    if (ridge_x_start_override !== undefined && ridge_x_end_override !== undefined) {
      d_hip_w = Math.max(0.0, ridge_x_start_override - eave_xw);
      d_hip_e = Math.max(0.0, eave_xe - ridge_x_end_override);
    } else if (ridge_length_override !== undefined) {
      const _hd = Math.max(0.0, (span_x - ridge_length_override) / 2.0);
      d_hip_w = d_hip_e = _hd;
    } else {
      const _hd = h / Math.tan((slope_ew * Math.PI) / 180);
      d_hip_w = d_hip_e = _hd;
    }
    actual_ew_w = d_hip_w > 0 ? (Math.atan(h / d_hip_w) * 180) / Math.PI : 90.0;
    actual_ew_e = d_hip_e > 0 ? (Math.atan(h / d_hip_e) * 180) / Math.PI : 90.0;
    ridge_length = Math.max(0.0, span_x - d_hip_w - d_hip_e);
    d_hip = (d_hip_w + d_hip_e) / 2.0;
    d_hip_n = d_hip_w;
    d_hip_s = d_hip_e;

    main_perp_h = h / Math.sin((slope_ns * Math.PI) / 180);
    main_slant_n = Math.sqrt(d_hip_w ** 2 + main_perp_h ** 2);
    main_slant_s = Math.sqrt(d_hip_e ** 2 + main_perp_h ** 2);
    main_slant = Math.max(main_slant_n, main_slant_s);
    hip_perp_h_n = Math.sqrt(d_hip_w ** 2 + h ** 2);
    hip_perp_h_s = Math.sqrt(d_hip_e ** 2 + h ** 2);
    hip_slant_n = Math.sqrt((span_y / 2.0) ** 2 + hip_perp_h_n ** 2);
    hip_slant_s = Math.sqrt((span_y / 2.0) ** 2 + hip_perp_h_s ** 2);
    hip_perp_h = Math.max(hip_perp_h_n, hip_perp_h_s);
    hip_slant = Math.max(hip_slant_n, hip_slant_s);

    slopes.push(
      {
        code: "N",
        title: "NORTH SLOPE (main, trapezoid)",
        base: span_x,
        top: ridge_length,
        perp_h: main_perp_h,
        slant: main_slant,
        pitch: slope_ns,
        is_tri: false,
        d_hip_left: d_hip_w,
        d_hip_right: d_hip_e,
      },
      {
        code: "S",
        title: "SOUTH SLOPE (main, trapezoid)",
        base: span_x,
        top: ridge_length,
        perp_h: main_perp_h,
        slant: main_slant,
        pitch: slope_ns,
        is_tri: false,
        d_hip_left: d_hip_w,
        d_hip_right: d_hip_e,
      },
      {
        code: "W",
        title: "WEST SLOPE (hip end, triangle)",
        base: span_y,
        top: 0.0,
        perp_h: hip_perp_h_n,
        slant: hip_slant_n,
        pitch: actual_ew_w,
        is_tri: true,
        d_hip: d_hip_w,
      },
      {
        code: "E",
        title: "EAST SLOPE (hip end, triangle)",
        base: span_y,
        top: 0.0,
        perp_h: hip_perp_h_s,
        slant: hip_slant_s,
        pitch: actual_ew_e,
        is_tri: true,
        d_hip: d_hip_e,
      },
    );
  }

  // ---- Compute slope quantities ----
  function computeSlopeQty(slope: Slope): SlopeQty {
    const base = slope.base;
    const top = slope.top;
    const perp_h = slope.perp_h;
    const is_tri = slope.is_tri;
    let d_hip_L: number, d_hip_R: number;
    if (is_tri) {
      d_hip_L = slope.d_hip ?? base / 2.0;
      d_hip_R = d_hip_L;
    } else {
      d_hip_L = slope.d_hip_left ?? (base - top) / 2.0;
      d_hip_R = slope.d_hip_right ?? (base - top) / 2.0;
    }
    const n_r = Math.trunc(base / rafter_spacing_u) + 1;
    const gap = base - (n_r - 1) * rafter_spacing_u;
    const first_off = gap > 0 ? gap / 2.0 : 0.0;
    const rafter_lens: number[] = [];
    for (let i = 0; i < n_r; i++) {
      const xf = first_off + i * rafter_spacing_u;
      let L: number;
      if (is_tri || top <= 0) {
        if (perp_h <= 0 || d_hip_L <= 0) {
          L = 0.0;
        } else if (xf < base / 2.0) {
          L = (perp_h * xf) / (base / 2.0);
        } else if (xf > base / 2.0) {
          L = (perp_h * (base - xf)) / (base / 2.0);
        } else {
          L = perp_h;
        }
      } else {
        if (perp_h <= 0 || (d_hip_L <= 0 && d_hip_R <= 0)) {
          L = perp_h;
        } else if (d_hip_L <= xf && xf <= base - d_hip_R) {
          L = perp_h;
        } else if (xf < d_hip_L) {
          L = d_hip_L > 0 ? (perp_h * xf) / d_hip_L : perp_h;
        } else {
          L = d_hip_R > 0 ? (perp_h * (base - xf)) / d_hip_R : perp_h;
        }
      }
      rafter_lens.push(L);
    }
    const n_p = Math.trunc(perp_h / purlin_spacing_u);
    const purlin_lens: number[] = [];
    for (let i = 1; i <= n_p; i++) {
      const y = Math.min(i * purlin_spacing_u, perp_h);
      let L: number;
      if (perp_h <= 0) {
        L = base;
      } else if (is_tri || top <= 0) {
        L = base * (1 - y / perp_h);
      } else {
        L = base - ((d_hip_L + d_hip_R) * y) / perp_h;
      }
      if (L > 0.5) purlin_lens.push(L);
    }
    return {
      rafter_count: rafter_lens.length,
      rafter_total: rafter_lens.reduce((a, b) => a + b, 0),
      rafter_max: rafter_lens.length > 0 ? Math.max(...rafter_lens) : 0.0,
      purlin_count: n_p,
      purlin_total: purlin_lens.reduce((a, b) => a + b, 0),
      purlin_max: purlin_lens.length > 0 ? Math.max(...purlin_lens) : 0.0,
    };
  }

  const slope_qty: Record<string, SlopeQty> = {};
  for (const sl of slopes) slope_qty[sl.code] = computeSlopeQty(sl);
  const qvalues = Object.values(slope_qty);
  const totals: SlopeQtyTotals = {
    rafter_count: qvalues.reduce((s, q) => s + q.rafter_count, 0),
    rafter_total: qvalues.reduce((s, q) => s + q.rafter_total, 0),
    rafter_max: qvalues.length > 0 ? Math.max(...qvalues.map((q) => q.rafter_max)) : 0,
    purlin_count: qvalues.reduce((s, q) => s + q.purlin_count, 0),
    purlin_total: qvalues.reduce((s, q) => s + q.purlin_total, 0),
    purlin_max: qvalues.length > 0 ? Math.max(...qvalues.map((q) => q.purlin_max)) : 0,
  };

  const hip_slant_n_val = hip_slant_n;
  const hip_slant_s_val = hip_slant_s;
  const hip_ridges_total = 2 * hip_slant_n_val + 2 * hip_slant_s_val;
  const ridge_ext_u = Number(roof.ridge_ext_u ?? 0.0);
  const has_ridge_vent = ridge_ext_u > 0;
  const central_ridge_total = ridge_length + 2 * ridge_ext_u;
  const vent_strut_len_each = has_ridge_vent ? ridge_ext_u * Math.sqrt(2.0) : 0.0;
  const vent_strut_count = has_ridge_vent ? 4 : 0;
  const vent_strut_total = vent_strut_count * vent_strut_len_each;

  const eave_perim_total = 2 * (sumConsistentUnits(span_x) + sumConsistentUnits(span_y));

  const house_ft = ((framing.house_footprint_ft as [number, number] | undefined) ??
    [(span_x * 1.2) / 12.0, (span_y * 1.2) / 12.0]) as [number, number];
  const house_trans_u = house_ft[0] * 10.0;
  const house_long_u = house_ft[1] * 10.0;

  let wall_inset_trans: number,
    wall_inset_long_n: number,
    wall_inset_long_s: number,
    wall_inset_long: number;
  if (ridge_axis === "y") {
    wall_inset_trans = (span_x - house_trans_u) / 2.0;
    wall_inset_long_n = -eave_yn;
    wall_inset_long_s = eave_ys - house_long_u;
    wall_inset_long = (wall_inset_long_n + wall_inset_long_s) / 2.0;
  } else {
    wall_inset_trans = (span_y - house_trans_u) / 2.0;
    wall_inset_long_n = -eave_xw;
    wall_inset_long_s = eave_xe - house_long_u;
    wall_inset_long = (wall_inset_long_n + wall_inset_long_s) / 2.0;
  }

  const wall_top_above_eave_ft = Number(
    roof.wall_top_above_eave_ft ??
      framing.wall_top_above_eave_ft ??
      1.333,
  );
  const wall_top_u = wall_top_above_eave_ft * 10.0;
  const ridge_depth_u = ridge_size_in[1] / IN_PER_UNIT;
  const ridge_width_u = ridge_size_in[0] / IN_PER_UNIT;
  const truss_effective_span_u = house_trans_u;
  const truss_effective_rise_u = h - wall_top_u - ridge_depth_u;

  // Trusses
  const truss_cfg = ((roof.trusses as Record<string, unknown> | undefined) ??
    (framing.truss as Record<string, unknown> | undefined) ??
    {}) as Record<string, unknown>;
  const truss_positions_cfg = (truss_cfg.positions as (number | string)[] | undefined) ?? [];
  const truss_count = Math.trunc(
    Number(truss_cfg.count ?? truss_positions_cfg.length),
  );

  let truss_top_chord_len = 0.0,
    truss_bottom_chord_len = 0.0,
    truss_king_post_len = 0.0,
    truss_diag_len = 0.0,
    truss_vert_len = 0.0,
    truss_chord_total_each = 0.0,
    truss_web_total_each = 0.0;

  if (truss_count > 0 && truss_effective_rise_u > 0) {
    const _panel_ratio = Number(truss_cfg.panel_ratio_bottom ?? 0.25);
    const _tspan = truss_effective_span_u;
    const _trise = truss_effective_rise_u;
    truss_top_chord_len = Math.sqrt((_tspan / 2.0) ** 2 + _trise ** 2);
    truss_bottom_chord_len = _tspan;
    truss_king_post_len = _trise;
    const _dx = _tspan * (0.5 - _panel_ratio);
    truss_diag_len = Math.sqrt(_dx ** 2 + _trise ** 2);
    truss_vert_len = _trise / 2.0;
    truss_chord_total_each = 2 * truss_top_chord_len + truss_bottom_chord_len;
    truss_web_total_each =
      truss_king_post_len + 2 * truss_diag_len + 2 * truss_vert_len;
  }

  // Position resolution
  let _n_ridge_end: number, _s_ridge_end: number;
  if (ridge_axis === "y") {
    _n_ridge_end = eave_yn + d_hip_n;
    _s_ridge_end = eave_ys - d_hip_s;
  } else {
    _n_ridge_end = eave_xw + d_hip_w;
    _s_ridge_end = eave_xe - d_hip_e;
  }
  const _ridge_center = (_n_ridge_end + _s_ridge_end) / 2.0;
  const _pos_map: Record<string, number> = {
    n_ridge_end: _n_ridge_end,
    ridge_center: _ridge_center,
    s_ridge_end: _s_ridge_end,
  };
  function _resolve_pos(p: number | string): number {
    if (typeof p === "number") return p;
    return _pos_map[p] ?? _ridge_center;
  }

  let truss_y_positions: number[];
  if (truss_positions_cfg.length > 0 && truss_positions_cfg.length === truss_count) {
    truss_y_positions = truss_positions_cfg.map((p) => _resolve_pos(p));
  } else if (truss_count > 1) {
    const _step = ridge_length / (truss_count - 1);
    truss_y_positions = Array.from({ length: truss_count }, (_, i) => _n_ridge_end + i * _step);
  } else if (truss_count === 1) {
    truss_y_positions = [_ridge_center];
  } else {
    truss_y_positions = [];
  }

  const ring_beam_cfg = (framing.ring_beam as Record<string, unknown> | undefined) ?? {};
  const ring_beam_size = (ring_beam_cfg.size_in as [number, number] | undefined) ?? [4, 2];
  const ring_beam_wall = (ring_beam_cfg.wall_mm as number | undefined) ?? 3;
  const ring_beam_total = 2 * (house_trans_u + house_long_u);

  const hip_beam_cfg = (framing.hip_end_beam as Record<string, unknown> | undefined) ?? {};
  const hip_beam_count_per_end = Math.trunc(Number(hip_beam_cfg.count_per_end ?? 3));
  const hip_beam_size = (hip_beam_cfg.size_in as [number, number] | undefined) ?? [4, 2];
  const hip_beam_wall = (hip_beam_cfg.wall_mm as number | undefined) ?? 2;
  const hip_beam_between_trusses = Boolean(hip_beam_cfg.extend_between_trusses ?? false);
  let hip_beam_bay_total_len = 0.0;
  let hip_beam_bay_count = 0;
  let hip_beam_n_len = 0.0,
    hip_beam_s_len = 0.0,
    hip_beam_avg_len = 0.0;

  if (truss_count >= 2 && ridge_axis === "y") {
    const _n_wall_y = eave_yn + wall_inset_long_n;
    const _s_wall_y = eave_ys - wall_inset_long_s;
    const _t1_y = truss_y_positions[0];
    const _tN_y = truss_y_positions[truss_y_positions.length - 1];
    hip_beam_n_len = Math.abs(_t1_y - _n_wall_y);
    hip_beam_s_len = Math.abs(_tN_y - _s_wall_y);
    hip_beam_avg_len = (hip_beam_n_len + hip_beam_s_len) / 2.0;
    if (hip_beam_between_trusses) {
      let _bay_span = 0.0;
      for (let j = 0; j < truss_y_positions.length - 1; j++) {
        _bay_span += Math.abs(truss_y_positions[j + 1] - truss_y_positions[j]);
      }
      hip_beam_bay_total_len = _bay_span * hip_beam_count_per_end;
      hip_beam_bay_count = (truss_y_positions.length - 1) * hip_beam_count_per_end;
    }
  } else if (truss_count >= 2) {
    const _w_wall_x = eave_xw + wall_inset_long_n;
    const _e_wall_x = eave_xe - wall_inset_long_s;
    const _t1_x = truss_y_positions[0];
    const _tN_x = truss_y_positions[truss_y_positions.length - 1];
    hip_beam_n_len = Math.abs(_t1_x - _w_wall_x);
    hip_beam_s_len = Math.abs(_tN_x - _e_wall_x);
    hip_beam_avg_len = (hip_beam_n_len + hip_beam_s_len) / 2.0;
    if (hip_beam_between_trusses) {
      let _bay_span = 0.0;
      for (let j = 0; j < truss_y_positions.length - 1; j++) {
        _bay_span += Math.abs(truss_y_positions[j + 1] - truss_y_positions[j]);
      }
      hip_beam_bay_total_len = _bay_span * hip_beam_count_per_end;
      hip_beam_bay_count = (truss_y_positions.length - 1) * hip_beam_count_per_end;
    }
  }

  const hip_beam_total_len =
    (hip_beam_n_len + hip_beam_s_len) * hip_beam_count_per_end + hip_beam_bay_total_len;
  const hip_beam_total_count = 2 * hip_beam_count_per_end + hip_beam_bay_count;

  // Tile roofing calcs (used by tile_panel, consolidated_bom, etc.)
  const slope_areas_sft: Record<string, number> = {};
  for (const sl of slopes) {
    const areaU2 = sl.is_tri
      ? 0.5 * sl.base * sl.perp_h
      : 0.5 * (sl.base + sl.top) * sl.perp_h;
    slope_areas_sft[sl.code] = areaU2 / 100.0;
  }
  const total_roof_area_sft = Object.values(slope_areas_sft).reduce((a, b) => a + b, 0);
  const waste_pct = 0.10;
  const area_with_waste_sft = total_roof_area_sft * (1 + waste_pct);
  const procured = [
    {
      name: "Indicotto rooftile 16×10",
      qty: 4150,
      rate: 48.5,
      unit: "tiles",
      coverage: 1.33,
      size: "406 × 254 mm",
      note: "main pantile — 1.33 tiles/sft",
    },
    {
      name: "Ceiling Tile 12×8 (Nutical Plain)",
      qty: 4700,
      rate: 30.0,
      unit: "tiles",
      coverage: 1.5,
      size: "305 × 203 mm",
      note: "flat under-ceiling — 1.5 tiles/sft",
    },
    {
      name: "Ridge tiles",
      qty: 100,
      rate: 70.0,
      unit: "run ft",
      coverage: 1.0,
      size: "per 1 running ft",
      note: "central ridge + 4 hip diagonals",
    },
    {
      name: "Semi glass tile 16×10",
      qty: 12,
      rate: 220.0,
      unit: "tiles",
      coverage: 1.33,
      size: "406 × 254 mm",
      note: "specialty — small qty for details",
    },
  ];
  const subtotal = procured.reduce((s, p) => s + p.qty * p.rate, 0);
  const delivery = 70000.0;
  const igst_rate = 0.12;
  const igst = Math.round((subtotal + delivery) * igst_rate * 100) / 100;
  const grand_total = subtotal + delivery + igst;
  const total_ridge_run_ft = (central_ridge_total + hip_ridges_total) / 10.0;

  const indicotto_need = pyRound(total_roof_area_sft * 1.33 * 1.1);
  const ceiling_need = pyRound(total_roof_area_sft * 1.5 * 1.1);
  const ridge_need = pyRound(total_ridge_run_ft * 1.1);

  function delta_str(ordered: number, needed: number): [string, boolean] {
    const d = ordered - needed;
    const pct = needed ? (d / needed) * 100 : 0;
    if (d >= 0) {
      return [`+${d.toLocaleString("en-US")} (+${pct.toFixed(0)}% margin)`, false];
    }
    return [`${d.toLocaleString("en-US")} (${pct.toFixed(0)}% SHORT)`, true];
  }
  const [indicotto_delta, indicotto_short] = delta_str(procured[0].qty, indicotto_need);
  const [ceiling_delta, ceiling_short] = delta_str(procured[1].qty, ceiling_need);
  const [ridge_delta, ridge_short] = delta_str(procured[2].qty, ridge_need);

  return {
    roof,
    house_config: houseConfig,
    global_config: globalConfig,
    ridge_axis,
    eave_xw,
    eave_xe,
    eave_yn,
    eave_ys,
    slope_ns,
    slope_ew,
    ridge_length,
    span_x,
    span_y,
    h,
    d_hip_n,
    d_hip_s,
    d_hip_w,
    d_hip_e,
    d_hip,
    main_perp_h,
    main_slant_n,
    main_slant_s,
    main_slant,
    hip_perp_h_n,
    hip_perp_h_s,
    hip_slant_n,
    hip_slant_s,
    hip_perp_h,
    hip_slant,
    slopes,
    framing,
    rafter_size_in,
    rafter_wall_mm,
    rafter_spacing_in,
    purlin_size_in,
    purlin_wall_mm,
    purlin_spacing_in,
    ridge_size_in,
    ridge_wall_mm,
    IN_PER_UNIT,
    rafter_spacing_u,
    purlin_spacing_u,
    truss_cfg,
    truss_count,
    truss_top_chord_len,
    truss_bottom_chord_len,
    truss_king_post_len,
    truss_diag_len,
    truss_vert_len,
    truss_chord_total_each,
    truss_web_total_each,
    truss_effective_span_u,
    truss_effective_rise_u,
    truss_y_positions,
    slope_qty,
    totals,
    hip_slant_n_val,
    hip_slant_s_val,
    hip_ridges_total,
    ridge_ext_u,
    has_ridge_vent,
    central_ridge_total,
    vent_strut_len_each,
    vent_strut_count,
    vent_strut_total,
    eave_perim_total,
    house_ft,
    house_trans_u,
    house_long_u,
    wall_inset_trans,
    wall_inset_long_n,
    wall_inset_long_s,
    wall_inset_long,
    wall_top_above_eave_ft,
    wall_top_u,
    ridge_depth_u,
    ridge_width_u,
    ring_beam_cfg,
    ring_beam_size,
    ring_beam_wall,
    ring_beam_total,
    hip_beam_cfg,
    hip_beam_count_per_end,
    hip_beam_size,
    hip_beam_wall,
    hip_beam_between_trusses,
    hip_beam_bay_total_len,
    hip_beam_bay_count,
    hip_beam_n_len,
    hip_beam_s_len,
    hip_beam_avg_len,
    hip_beam_total_len,
    hip_beam_total_count,
    long_truss_cfg: {},
    long_truss_count: 0,
    long_truss_positions: [],
    long_bottom_chord_len: 0.0,
    long_top_chord_len: 0.0,
    long_side_chord_len: 0.0,
    long_kingpost_len: 0.0,
    long_ridge_end_vert_len: 0.0,
    long_diag_len: 0.0,
    long_diag_count_per_truss: 0,
    long_chord_total_each: 0.0,
    long_web_total_each: 0.0,
    slope_areas_sft,
    total_roof_area_sft,
    waste_pct,
    area_with_waste_sft,
    procured,
    subtotal,
    delivery,
    igst_rate,
    igst,
    grand_total,
    total_ridge_run_ft,
    indicotto_need,
    ceiling_need,
    ridge_need,
    indicotto_delta,
    indicotto_short,
    ceiling_delta,
    ceiling_short,
    ridge_delta,
    ridge_short,
  };
}
