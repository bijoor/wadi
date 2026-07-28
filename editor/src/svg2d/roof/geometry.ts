// Roof geometry derivation — mirrors the setup block in
// svg_2d.py::generate_roof_sections_svg (lines 4133-4325 + 5399-5623).
// Returns a large "computed" object that all panel functions consume.
//
// All values are floats in Python; in JS they're plain numbers, and
// downstream emitters use `fFloat`/`f1`/`f2` as needed.

import type { HouseConfig } from "../expand";
import type { GlobalConfig } from "../config";

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

// NOTE: legacy compute functions (computeAll / computeAllRoofs) were
// removed with the legacy roof types. This module now only provides the
// RoofComputed types + IN_PER_UNIT constant still consumed by htmlBom.
