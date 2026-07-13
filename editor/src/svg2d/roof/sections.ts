// section_aa_panel and section_bb_panel — svg_2d.py lines 7546-8369.
// section_panel_generic is the shared base.

import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { formatDimension } from "../format";
import { f, fFloat, f0, f1 } from "./format";

interface GenericGeom {
  bl: [number, number];
  br: [number, number];
  tl: [number, number];
  tr: [number, number];
  baseline_y: number;
  t_y: number;
  s_scale: number;
  cx: number;
  base_span: number;
  top_span: number;
  height_val: number;
}

function sectionPanelGeneric(opts: {
  x0: number; y0: number; w_p: number; h_p: number;
  title: string; is_trapezoid: boolean;
  base_span: number; top_span: number; height_val: number; angle_val: number;
  top_offset_left?: number; top_offset_right?: number;
  angle_left?: number; angle_right?: number;
  skip_base_corners?: boolean;
  y0IsFloat?: boolean; hIsFloat?: boolean;
}, computed: RoofComputed): { svg: string; geom: GenericGeom } {
  const {
    x0, y0, w_p, h_p, title, is_trapezoid,
    base_span, top_span, height_val, angle_val,
    top_offset_left, top_offset_right,
    angle_left, angle_right,
    skip_base_corners = false,
    y0IsFloat = false, hIsFloat = false,
  } = opts;
  void computed;
  const y0Fmt = y0IsFloat ? fFloat(y0) : f(y0);
  const hFmt = hIsFloat ? fFloat(h_p) : f(h_p);
  const title_h = 36;
  const inner_pad = 40;
  const draw_w = w_p - 2 * inner_pad;
  const draw_h = h_p - title_h - 2 * inner_pad;
  const s_scale = Math.min(draw_w / Math.max(base_span, 1), draw_h / Math.max(height_val, 1)) * 0.75;

  const base_px = base_span * s_scale;
  const top_px = top_span * s_scale;
  const h_px = height_val * s_scale;
  const cx = x0 + w_p / 2;
  const _bottom_reserve = 60;
  const baseline_y = y0 + title_h + inner_pad + draw_h - _bottom_reserve;
  const t_y = baseline_y - h_px;
  const bl: [number, number] = [cx - base_px / 2, baseline_y];
  const br: [number, number] = [cx + base_px / 2, baseline_y];
  let tl: [number, number], tr: [number, number];
  if (is_trapezoid) {
    if (top_offset_left !== undefined && top_offset_right !== undefined) {
      tl = [bl[0] + top_offset_left * s_scale, t_y];
      tr = [br[0] - top_offset_right * s_scale, t_y];
    } else {
      tl = [cx - top_px / 2, t_y];
      tr = [cx + top_px / 2, t_y];
    }
  } else {
    tl = tr = [cx, t_y];
  }

  let s = "";
  s += `<rect x="${f(x0)}" y="${y0Fmt}" width="${f(w_p)}" height="${hFmt}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  s += `<rect x="${f(x0)}" y="${y0Fmt}" width="${f(w_p)}" height="${f(title_h)}" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  const _title_yFmt = y0IsFloat ? fFloat(y0 + title_h - 12) : f(y0 + title_h - 12);
  s += `<text x="${fFloat(x0 + w_p / 2)}" y="${_title_yFmt}" text-anchor="middle" font-size="16" font-weight="600" fill="#222">${title}</text>\n`;

  let outline: string;
  if (is_trapezoid) {
    outline = `M ${f1(bl[0])} ${f1(bl[1])} L ${f1(br[0])} ${f1(br[1])} L ${f1(tr[0])} ${f1(tr[1])} L ${f1(tl[0])} ${f1(tl[1])} Z`;
  } else {
    outline = `M ${f1(bl[0])} ${f1(bl[1])} L ${f1(br[0])} ${f1(br[1])} L ${f1(tl[0])} ${f1(tl[1])} Z`;
  }
  s += `<path d="${outline}" fill="none" stroke="#8B4513" stroke-width="1.2" stroke-dasharray="6,4" opacity="0.55"/>\n`;

  const h_dim_x = bl[0] - 30;
  s += `<line x1="${fFloat(bl[0])}" y1="${fFloat(baseline_y)}" x2="${fFloat(h_dim_x - 6)}" y2="${fFloat(baseline_y)}" stroke="#0066cc" stroke-width="0.5" stroke-dasharray="3,3"/>\n`;
  s += `<line x1="${fFloat(cx)}" y1="${fFloat(t_y)}" x2="${fFloat(h_dim_x - 6)}" y2="${fFloat(t_y)}" stroke="#0066cc" stroke-width="0.5" stroke-dasharray="3,3"/>\n`;
  s += `<line x1="${fFloat(h_dim_x)}" y1="${fFloat(baseline_y)}" x2="${fFloat(h_dim_x)}" y2="${fFloat(t_y)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${fFloat(h_dim_x - 6)}" y="${fFloat((baseline_y + t_y) / 2)}" text-anchor="end" font-size="11" fill="#0066cc">h = ${formatDimension(height_val)}</text>\n`;

  const b_dim_y = baseline_y + 32;
  s += `<line x1="${fFloat(bl[0])}" y1="${fFloat(baseline_y)}" x2="${fFloat(bl[0])}" y2="${fFloat(b_dim_y + 6)}" stroke="#0066cc" stroke-width="0.5"/>\n`;
  s += `<line x1="${fFloat(br[0])}" y1="${fFloat(baseline_y)}" x2="${fFloat(br[0])}" y2="${fFloat(b_dim_y + 6)}" stroke="#0066cc" stroke-width="0.5"/>\n`;
  s += `<line x1="${fFloat(bl[0])}" y1="${fFloat(b_dim_y)}" x2="${fFloat(br[0])}" y2="${fFloat(b_dim_y)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
  s += `<text x="${fFloat(cx)}" y="${fFloat(b_dim_y - 5)}" text-anchor="middle" font-size="11" fill="#0066cc">${formatDimension(base_span)}</text>\n`;

  if (is_trapezoid && top_span > 0) {
    const t_dim_y = t_y - 48;
    s += `<line x1="${fFloat(tl[0])}" y1="${fFloat(t_y)}" x2="${fFloat(tl[0])}" y2="${fFloat(t_dim_y - 6)}" stroke="#0066cc" stroke-width="0.5" stroke-dasharray="3,3"/>\n`;
    s += `<line x1="${fFloat(tr[0])}" y1="${fFloat(t_y)}" x2="${fFloat(tr[0])}" y2="${fFloat(t_dim_y - 6)}" stroke="#0066cc" stroke-width="0.5" stroke-dasharray="3,3"/>\n`;
    s += `<line x1="${fFloat(tl[0])}" y1="${fFloat(t_dim_y)}" x2="${fFloat(tr[0])}" y2="${fFloat(t_dim_y)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
    s += `<text x="${fFloat(cx)}" y="${fFloat(t_dim_y - 5)}" text-anchor="middle" font-size="11" fill="#0066cc">ridge = ${formatDimension(top_span)}</text>\n`;
  }

  const base_corner_L = angle_left !== undefined ? angle_left : angle_val;
  const base_corner_R = angle_right !== undefined ? angle_right : angle_val;
  let top_corner_L = 0, top_corner_R = 0, apex_angle = 0;
  if (is_trapezoid) {
    top_corner_L = 180.0 - base_corner_L;
    top_corner_R = 180.0 - base_corner_R;
  } else {
    apex_angle = 180.0 - base_corner_L - base_corner_R;
  }

  if (!skip_base_corners) {
    s += `<text x="${fFloat(bl[0] + 8)}" y="${fFloat(baseline_y - 6)}" text-anchor="start" font-size="11" fill="#333">${f1(base_corner_L)}°</text>\n`;
    s += `<text x="${fFloat(br[0] - 8)}" y="${fFloat(baseline_y - 6)}" text-anchor="end" font-size="11" fill="#333">${f1(base_corner_R)}°</text>\n`;
  }
  if (is_trapezoid) {
    s += `<text x="${fFloat(tl[0] + 6)}" y="${fFloat(t_y + 14)}" text-anchor="start" font-size="11" fill="#333">${f1(top_corner_L)}°</text>\n`;
    s += `<text x="${fFloat(tr[0] - 6)}" y="${fFloat(t_y + 14)}" text-anchor="end" font-size="11" fill="#333">${f1(top_corner_R)}°</text>\n`;
  } else {
    s += `<text x="${fFloat(tl[0])}" y="${fFloat(t_y + 15)}" text-anchor="middle" font-size="11" fill="#333">${f1(apex_angle)}°</text>\n`;
  }

  let _pitch_lbl: string;
  if (angle_left !== undefined && angle_right !== undefined && Math.abs(angle_left - angle_right) > 0.1) {
    _pitch_lbl = `PITCH: N ${f1(angle_left)}° / S ${f1(angle_right)}°`;
  } else {
    _pitch_lbl = `PITCH: ${f1(angle_val)}°`;
  }
  const _pitch_yFmt = y0IsFloat ? fFloat(y0 + title_h + 18) : f(y0 + title_h + 18);
  s += `<text x="${f(x0 + w_p - 12)}" y="${_pitch_yFmt}" text-anchor="end" font-size="12" font-weight="600" fill="#8B4513">${_pitch_lbl}</text>\n`;

  return {
    svg: s,
    geom: { bl, br, tl, tr, baseline_y, t_y, s_scale, cx, base_span, top_span, height_val },
  };
}

export function sectionAaPanel(
  x0: number, y0: number, w_p: number, h_p: number,
  computed: RoofComputed, _layout: Layout,
): string {
  const {
    ridge_axis, span_x, span_y, slope_ew, slope_ns, h,
    truss_count, truss_effective_span_u, truss_effective_rise_u,
    wall_top_u, ridge_depth_u, ridge_width_u, ridge_size_in,
    rafter_size_in, purlin_size_in, purlin_spacing_in,
    IN_PER_UNIT, house_trans_u, wall_top_above_eave_ft,
    ring_beam_size, truss_bottom_chord_len, truss_king_post_len,
  } = computed;

  let base_span: number, angle_val: number;
  if (ridge_axis === "y") {
    base_span = span_x;
    angle_val = slope_ew;
  } else {
    base_span = span_y;
    angle_val = slope_ns;
  }
  const { svg: baseSvg, geom } = sectionPanelGeneric({
    x0, y0, w_p, h_p,
    title: "SECTION A–A : TRANSVERSE (perpendicular to ridge) — TRUSS PROFILE",
    is_trapezoid: false,
    base_span, top_span: 0.0, height_val: h, angle_val,
    hIsFloat: true, y0IsFloat: false,
  }, computed);
  let s = baseSvg;

  const { bl: bl_, br: br_, baseline_y: baseline_y_, t_y: t_y_, cx: cx_, s_scale: s_scale_ } = geom;
  const rafter_stroke_sec = "#8B4513";
  const purlin_fill_sec = "#a8c9e0";
  const purlin_stroke_sec = "#4a8fbf";
  const _rd_w_px_a = Math.max(6.0, ridge_width_u * s_scale_);
  void _rd_w_px_a;
  const raft_top_L: [number, number] = [cx_ - Math.max(6.0, ridge_width_u * s_scale_) / 2, t_y_];
  const raft_top_R: [number, number] = [cx_ + Math.max(6.0, ridge_width_u * s_scale_) / 2, t_y_];
  const _raft_line_w = Math.max(2.4, (rafter_size_in[1] / IN_PER_UNIT) * s_scale_ * 0.55);
  s += `<line x1="${f1(bl_[0])}" y1="${f1(bl_[1])}" x2="${f1(raft_top_L[0])}" y2="${f1(raft_top_L[1])}" stroke="${rafter_stroke_sec}" stroke-width="${f1(_raft_line_w)}" stroke-linecap="round"/>\n`;
  s += `<line x1="${f1(br_[0])}" y1="${f1(br_[1])}" x2="${f1(raft_top_R[0])}" y2="${f1(raft_top_R[1])}" stroke="${rafter_stroke_sec}" stroke-width="${f1(_raft_line_w)}" stroke-linecap="round"/>\n`;

  const _purlin_w_px = Math.max(3.0, (purlin_size_in[0] / IN_PER_UNIT) * s_scale_);
  const _purlin_d_px = Math.max(2.0, (purlin_size_in[1] / IN_PER_UNIT) * s_scale_);
  const _pitch = angle_val;
  const _purlin_step_slope_u = purlin_spacing_in / IN_PER_UNIT;
  const _purlin_step_horiz_u = _purlin_step_slope_u * Math.cos((_pitch * Math.PI) / 180);
  const _half_span_u = base_span / 2;
  const _n_purl = Math.trunc(_half_span_u / _purlin_step_horiz_u);
  const _raft_run_L_u = (raft_top_L[0] - bl_[0]) / s_scale_;
  const _raft_rise_L_px = raft_top_L[1] - baseline_y_;
  const _raft_run_R_u = (br_[0] - raft_top_R[0]) / s_scale_;
  const _raft_rise_R_px = raft_top_R[1] - baseline_y_;
  for (let i = 1; i <= _n_purl; i++) {
    const _dx_u = i * _purlin_step_horiz_u;
    const _dx_px = _dx_u * s_scale_;
    const pxL = bl_[0] + _dx_px;
    const _t_L = _raft_run_L_u > 0 ? Math.min(1.0, _dx_u / _raft_run_L_u) : 1.0;
    const pyL = baseline_y_ + _t_L * _raft_rise_L_px;
    s += `<g transform="translate(${f1(pxL)},${f1(pyL)}) rotate(${f1(-_pitch)})"><rect x="${f1(-_purlin_w_px / 2)}" y="${f1(-_purlin_d_px)}" width="${f1(_purlin_w_px)}" height="${f1(_purlin_d_px)}" fill="${purlin_fill_sec}" stroke="${purlin_stroke_sec}" stroke-width="0.6"/></g>\n`;
    const pxR = br_[0] - _dx_px;
    const _t_R = _raft_run_R_u > 0 ? Math.min(1.0, _dx_u / _raft_run_R_u) : 1.0;
    const pyR = baseline_y_ + _t_R * _raft_rise_R_px;
    s += `<g transform="translate(${f1(pxR)},${f1(pyR)}) rotate(${f1(_pitch)})"><rect x="${f1(-_purlin_w_px / 2)}" y="${f1(-_purlin_d_px)}" width="${f1(_purlin_w_px)}" height="${f1(_purlin_d_px)}" fill="${purlin_fill_sec}" stroke="${purlin_stroke_sec}" stroke-width="0.6"/></g>\n`;
  }

  if (truss_count > 0) {
    const { bl, br, baseline_y, t_y, cx, s_scale } = geom;
    void bl; void br;
    const web_stroke = "#8b0000";
    const web_w = 1.4;
    const chord_w = 2.4;
    const ring_stroke_sec = "#1e5aa6";
    const _truss_span_px = truss_effective_span_u * s_scale;
    const _truss_rise_px = truss_effective_rise_u * s_scale;
    const _wall_top_px = wall_top_u * s_scale;
    const _tbot_y = baseline_y - _wall_top_px;
    const _t_ttop_y = _tbot_y - _truss_rise_px;
    const _tbot_left = cx - _truss_span_px / 2;
    const _tbot_right = cx + _truss_span_px / 2;
    const _tbot_q1 = cx - _truss_span_px / 4;
    const _tbot_q3 = cx + _truss_span_px / 4;
    const _tmid_l = cx - _truss_span_px / 4;
    const _tmid_r = cx + _truss_span_px / 4;
    const _tmid_top_y = (_tbot_y + _t_ttop_y) / 2;

    s += `<line x1="${f1(_tbot_left)}" y1="${f1(_tbot_y)}" x2="${f1(cx)}" y2="${f1(_t_ttop_y)}" stroke="${web_stroke}" stroke-width="${chord_w}"/>\n`;
    s += `<line x1="${f1(cx)}" y1="${f1(_t_ttop_y)}" x2="${f1(_tbot_right)}" y2="${f1(_tbot_y)}" stroke="${web_stroke}" stroke-width="${chord_w}"/>\n`;
    s += `<line x1="${f1(_tbot_left)}" y1="${f1(_tbot_y)}" x2="${f1(_tbot_right)}" y2="${f1(_tbot_y)}" stroke="${web_stroke}" stroke-width="${chord_w}"/>\n`;
    const web_lines: Array<[[number, number], [number, number]]> = [
      [[cx, _t_ttop_y], [cx, _tbot_y]],
      [[cx, _t_ttop_y], [_tbot_q1, _tbot_y]],
      [[cx, _t_ttop_y], [_tbot_q3, _tbot_y]],
      [[_tmid_l, _tmid_top_y], [_tbot_q1, _tbot_y]],
      [[_tmid_r, _tmid_top_y], [_tbot_q3, _tbot_y]],
    ];
    for (const [a, b] of web_lines) {
      s += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${web_stroke}" stroke-width="${web_w}" opacity="0.9"/>\n`;
    }
    for (const p of [[_tbot_left, _tbot_y], [_tbot_q1, _tbot_y], [cx, _tbot_y], [_tbot_q3, _tbot_y], [_tbot_right, _tbot_y], [_tmid_l, _tmid_top_y], [cx, _t_ttop_y], [_tmid_r, _tmid_top_y]] as Array<[number, number]>) {
      s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.0" fill="${web_stroke}"/>\n`;
    }
    const _rb_sz = Math.max(4.0, (ring_beam_size[1] / IN_PER_UNIT) * s_scale);
    for (const [xr, yr] of [[_tbot_left, _tbot_y], [_tbot_right, _tbot_y]] as Array<[number, number]>) {
      s += `<rect x="${f1(xr - _rb_sz / 2)}" y="${f1(yr - _rb_sz / 2)}" width="${f1(_rb_sz)}" height="${f1(_rb_sz)}" fill="${ring_stroke_sec}" stroke="${ring_stroke_sec}"/>\n`;
    }
    // Central ridge beam
    const ridge_stroke_sec = "#5a3a17";
    const ridge_fill_sec = "#a6764a";
    const _rd_w_px = Math.max(6.0, ridge_width_u * s_scale);
    const _rd_h_px = Math.max(4.0, ridge_depth_u * s_scale);
    const _rd_x = cx - _rd_w_px / 2;
    const _rd_y = t_y;
    s += `<rect x="${f1(_rd_x)}" y="${f1(_rd_y)}" width="${f1(_rd_w_px)}" height="${f1(_rd_h_px)}" fill="${ridge_fill_sec}" stroke="${ridge_stroke_sec}" stroke-width="1.4"/>\n`;
    s += `<text x="${f1(_rd_x + _rd_w_px + 6)}" y="${f1(_rd_y + _rd_h_px / 2 + 4)}" text-anchor="start" font-size="10" fill="${ridge_stroke_sec}" font-weight="600">Ridge beam ${ridge_size_in[0]}"×${ridge_size_in[1]}"</text>\n`;

    // Walls
    const wall_fill = "#eeeeee";
    const wall_stroke = "#666";
    const _wall_thk_u = 8.0 / IN_PER_UNIT;
    const _wall_thk_px = _wall_thk_u * s_scale;
    const _wall_top_svg_y_a = baseline_y - wall_top_u * s_scale;
    const _wall_L_cx = cx - (house_trans_u / 2) * s_scale;
    const _wall_R_cx = cx + (house_trans_u / 2) * s_scale;
    s += `<rect x="${f1(_wall_L_cx - _wall_thk_px / 2)}" y="${f1(_wall_top_svg_y_a)}" width="${f1(_wall_thk_px)}" height="${f1(baseline_y - _wall_top_svg_y_a)}" fill="${wall_fill}" stroke="${wall_stroke}" stroke-width="0.9"/>\n`;
    s += `<rect x="${f1(_wall_R_cx - _wall_thk_px / 2)}" y="${f1(_wall_top_svg_y_a)}" width="${f1(_wall_thk_px)}" height="${f1(baseline_y - _wall_top_svg_y_a)}" fill="${wall_fill}" stroke="${wall_stroke}" stroke-width="0.9"/>\n`;
    s += `<text x="${f1(_wall_L_cx)}" y="${f1(baseline_y + 12)}" text-anchor="middle" font-size="10" fill="${wall_stroke}" font-weight="600">Wall</text>\n`;
    s += `<text x="${f1(_wall_R_cx)}" y="${f1(baseline_y + 12)}" text-anchor="middle" font-size="10" fill="${wall_stroke}" font-weight="600">Wall</text>\n`;

    s += `<text x="${f1(x0 + w_p - 12)}" y="${f1(y0 + 36 + 32)}" text-anchor="end" font-size="11" fill="${web_stroke}">Fink × ${truss_count} — ${formatDimension(truss_bottom_chord_len)} × ${formatDimension(truss_king_post_len)} rise, bottom chord on ring beam</text>\n`;
    s += `<text x="${f1(x0 + w_p - 12)}" y="${f1(y0 + 36 + 46)}" text-anchor="end" font-size="11" fill="${ring_stroke_sec}">Ring beam at wall top (${f0(wall_top_above_eave_ft * 12)}" above eave)</text>\n`;
  }
  return s;
}

export function sectionBbPanel(
  x0: number, y0: number, w_p: number, h_p: number,
  computed: RoofComputed, _layout: Layout,
  _y0IsFloat = false,
): string {
  const {
    ridge_axis, span_x, span_y, slopes, d_hip_n, d_hip_s, d_hip_w, d_hip_e,
    h, ridge_length, truss_count, truss_y_positions,
    IN_PER_UNIT, purlin_size_in, purlin_spacing_in, rafter_size_in,
    ring_beam_size, ridge_depth_u, ridge_size_in,
    eave_yn, eave_ys, eave_xw, eave_xe,
    wall_inset_long_n, wall_inset_long_s,
    wall_top_u, wall_top_above_eave_ft, truss_king_post_len,
    roof,
  } = computed;
  void ring_beam_size;

  let base_span: number, _pitch_L: number, _pitch_R: number, _tol_L: number, _tol_R: number;
  if (ridge_axis === "y") {
    base_span = span_y;
    _pitch_L = slopes[2].pitch;
    _pitch_R = slopes[3].pitch;
    _tol_L = d_hip_n;
    _tol_R = d_hip_s;
  } else {
    base_span = span_x;
    _pitch_L = slopes[2].pitch;
    _pitch_R = slopes[3].pitch;
    _tol_L = d_hip_w;
    _tol_R = d_hip_e;
  }
  const angle_val = (_pitch_L + _pitch_R) / 2.0;
  const { svg: baseSvg, geom } = sectionPanelGeneric({
    x0, y0, w_p, h_p,
    title: "SECTION B–B : LONGITUDINAL (along ridge) — TRUSS LOCATIONS",
    is_trapezoid: true,
    base_span, top_span: ridge_length, height_val: h, angle_val,
    top_offset_left: _tol_L, top_offset_right: _tol_R,
    angle_left: _pitch_L, angle_right: _pitch_R,
    skip_base_corners: true,
    hIsFloat: true, y0IsFloat: _y0IsFloat,
  }, computed);
  let s = baseSvg;

  const { bl: bl_b, br: br_b, tl: tl_b, tr: tr_b, baseline_y: baseline_y_b, t_y: t_y_b, s_scale: s_scale_b } = geom;
  void baseline_y_b;
  void t_y_b;
  const rafter_stroke_sec = "#8B4513";
  const purlin_fill_sec = "#a8c9e0";
  const purlin_stroke_sec = "#4a8fbf";
  const hip_pitch_n = slopes[2].pitch;
  const hip_pitch_s = slopes[3].pitch;
  const _raft_line_w_b = Math.max(2.4, (rafter_size_in[1] / IN_PER_UNIT) * s_scale_b * 0.55);
  s += `<line x1="${f1(bl_b[0])}" y1="${f1(bl_b[1])}" x2="${f1(tl_b[0])}" y2="${f1(tl_b[1])}" stroke="${rafter_stroke_sec}" stroke-width="${f1(_raft_line_w_b)}" stroke-linecap="round"/>\n`;
  s += `<line x1="${f1(br_b[0])}" y1="${f1(br_b[1])}" x2="${f1(tr_b[0])}" y2="${f1(tr_b[1])}" stroke="${rafter_stroke_sec}" stroke-width="${f1(_raft_line_w_b)}" stroke-linecap="round"/>\n`;

  const _purlin_w_px_b = Math.max(3.0, (purlin_size_in[0] / IN_PER_UNIT) * s_scale_b);
  const _purlin_d_px_b = Math.max(2.0, (purlin_size_in[1] / IN_PER_UNIT) * s_scale_b);
  const _purlin_step_slope_u_b = purlin_spacing_in / IN_PER_UNIT;
  const _hip_step_n_u = _purlin_step_slope_u_b * Math.cos((hip_pitch_n * Math.PI) / 180);
  const _hip_step_s_u = _purlin_step_slope_u_b * Math.cos((hip_pitch_s * Math.PI) / 180);
  const _n_hip_purl_n = _hip_step_n_u > 0 ? Math.trunc(d_hip_n / _hip_step_n_u) : 0;
  const _n_hip_purl_s = _hip_step_s_u > 0 ? Math.trunc(d_hip_s / _hip_step_s_u) : 0;
  const _hipL_run_u = (tl_b[0] - bl_b[0]) / s_scale_b;
  const _hipL_rise_px = tl_b[1] - bl_b[1];
  const _hipR_run_u = (br_b[0] - tr_b[0]) / s_scale_b;
  const _hipR_rise_px = tr_b[1] - br_b[1];
  for (let i = 1; i <= _n_hip_purl_n; i++) {
    const _dx_u = i * _hip_step_n_u;
    const _dx_px = _dx_u * s_scale_b;
    const pxN = bl_b[0] + _dx_px;
    const _t_N = _hipL_run_u > 0 ? Math.min(1.0, _dx_u / _hipL_run_u) : 1.0;
    const pyN = bl_b[1] + _t_N * _hipL_rise_px;
    s += `<g transform="translate(${f1(pxN)},${f1(pyN)}) rotate(${f1(-hip_pitch_n)})"><rect x="${f1(-_purlin_w_px_b / 2)}" y="${f1(-_purlin_d_px_b)}" width="${f1(_purlin_w_px_b)}" height="${f1(_purlin_d_px_b)}" fill="${purlin_fill_sec}" stroke="${purlin_stroke_sec}" stroke-width="0.6"/></g>\n`;
  }
  for (let i = 1; i <= _n_hip_purl_s; i++) {
    const _dx_u = i * _hip_step_s_u;
    const _dx_px = _dx_u * s_scale_b;
    const pxS = br_b[0] - _dx_px;
    const _t_S = _hipR_run_u > 0 ? Math.min(1.0, _dx_u / _hipR_run_u) : 1.0;
    const pyS = br_b[1] + _t_S * _hipR_rise_px;
    s += `<g transform="translate(${f1(pxS)},${f1(pyS)}) rotate(${f1(hip_pitch_s)})"><rect x="${f1(-_purlin_w_px_b / 2)}" y="${f1(-_purlin_d_px_b)}" width="${f1(_purlin_w_px_b)}" height="${f1(_purlin_d_px_b)}" fill="${purlin_fill_sec}" stroke="${purlin_stroke_sec}" stroke-width="0.6"/></g>\n`;
  }

  if (truss_count > 0) {
    const { bl, br, tl, tr, baseline_y, t_y, s_scale } = geom;
    void cx_from_geom(geom);
    let world_start: number, world_end: number;
    if (ridge_axis === "y") {
      world_start = eave_yn;
      world_end = eave_ys;
    } else {
      world_start = eave_xw;
      world_end = eave_xe;
    }
    function worldToSx(wy: number): number {
      return bl[0] + ((wy - world_start) / (world_end - world_start)) * (br[0] - bl[0]);
    }
    const truss_stroke = "#8b0000";
    const ring_stroke_sec = "#1e5aa6";
    const ridge_stroke_sec = "#5a3a17";
    const ridge_fill_sec = "#a6764a";
    const truss_svg_xs = truss_y_positions.map(worldToSx);
    const _wall_top_svg_y = baseline_y - wall_top_u * s_scale;
    const _ridge_bot_svg_y = t_y + ridge_depth_u * s_scale;

    // Ridge beam
    s += `<rect x="${f1(tl[0])}" y="${f1(t_y)}" width="${f1(tr[0] - tl[0])}" height="${f1(ridge_depth_u * s_scale)}" fill="${ridge_fill_sec}" stroke="${ridge_stroke_sec}" stroke-width="1.4"/>\n`;
    s += `<text x="${f1(tl[0] + 8)}" y="${f1(t_y + ridge_depth_u * s_scale / 2 + 4)}" text-anchor="start" font-size="10" fill="#ffffff" font-weight="700">Ridge beam ${ridge_size_in[0]}"×${ridge_size_in[1]}"</text>\n`;

    // Ring beam
    const _rb_start_sx = worldToSx(world_start + wall_inset_long_n);
    const _rb_end_sx = worldToSx(world_end - wall_inset_long_s);
    s += `<line x1="${f1(_rb_start_sx)}" y1="${f1(_wall_top_svg_y)}" x2="${f1(_rb_end_sx)}" y2="${f1(_wall_top_svg_y)}" stroke="${ring_stroke_sec}" stroke-width="2.6" opacity="0.95"/>\n`;
    s += `<text x="${f1(_rb_start_sx + 8)}" y="${f1(_wall_top_svg_y - 4)}" text-anchor="start" font-size="10" fill="${ring_stroke_sec}" font-weight="600">Ring beam</text>\n`;

    for (let i = 0; i < truss_svg_xs.length; i++) {
      const sx = truss_svg_xs[i];
      s += `<line x1="${f1(sx)}" y1="${f1(_ridge_bot_svg_y)}" x2="${f1(sx)}" y2="${f1(_wall_top_svg_y)}" stroke="${truss_stroke}" stroke-width="2.0" opacity="0.85"/>\n`;
      s += `<circle cx="${f1(sx)}" cy="${f1(_ridge_bot_svg_y)}" r="2.8" fill="${truss_stroke}"/>\n`;
      s += `<circle cx="${f1(sx)}" cy="${f1(_wall_top_svg_y)}" r="2.8" fill="${truss_stroke}"/>\n`;
      s += `<text x="${f1(sx)}" y="${f1(t_y - 6)}" text-anchor="middle" font-size="10" font-weight="700" fill="${truss_stroke}">T${i + 1}</text>\n`;
    }
    // Rise dim
    const _rise_dim_x = truss_svg_xs[truss_svg_xs.length - 1] + 20;
    s += `<line x1="${f1(_rise_dim_x)}" y1="${f1(_ridge_bot_svg_y)}" x2="${f1(_rise_dim_x)}" y2="${f1(_wall_top_svg_y)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
    s += `<text x="${f1(_rise_dim_x + 4)}" y="${f1((_ridge_bot_svg_y + _wall_top_svg_y) / 2 + 4)}" text-anchor="start" font-size="10" fill="#0066cc">rise ${formatDimension(truss_king_post_len)}</text>\n`;
    s += `<line x1="${f1(_rise_dim_x)}" y1="${f1(_wall_top_svg_y)}" x2="${f1(_rise_dim_x)}" y2="${f1(baseline_y)}" stroke="#0066cc" stroke-width="0.7" stroke-dasharray="3,2"/>\n`;
    s += `<text x="${f1(_rise_dim_x + 4)}" y="${f1((_wall_top_svg_y + baseline_y) / 2 + 4)}" text-anchor="start" font-size="9" fill="#666">wall top ${f0(wall_top_above_eave_ft * 12)}"</text>\n`;

    if (truss_count >= 2) {
      const dim_y = t_y - 22;
      const blue = "#0066cc";
      for (const sx of truss_svg_xs) {
        s += `<line x1="${f1(sx)}" y1="${f1(t_y - 14)}" x2="${f1(sx)}" y2="${f1(dim_y + 4)}" stroke="${blue}" stroke-width="0.5" stroke-dasharray="2,2"/>\n`;
      }
      for (let i = 0; i < truss_count - 1; i++) {
        const x1 = truss_svg_xs[i], x2 = truss_svg_xs[i + 1];
        const _spacing_u = Math.abs(truss_y_positions[i + 1] - truss_y_positions[i]);
        s += `<line x1="${f1(x1)}" y1="${f1(dim_y)}" x2="${f1(x2)}" y2="${f1(dim_y)}" stroke="${blue}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
        s += `<text x="${f1((x1 + x2) / 2)}" y="${f1(dim_y - 4)}" text-anchor="middle" font-size="10" fill="${blue}">${formatDimension(_spacing_u)}</text>\n`;
      }
    }
    // Walls
    const wall_fill_b = "#eeeeee";
    const wall_stroke_b = "#666";
    const _wall_thk_u_b = 8.0 / IN_PER_UNIT;
    const _wall_thk_px_b = _wall_thk_u_b * s_scale;
    const _wall_N_cx = worldToSx(world_start + wall_inset_long_n);
    const _wall_S_cx = worldToSx(world_end - wall_inset_long_s);
    for (const _wcx of [_wall_N_cx, _wall_S_cx]) {
      s += `<rect x="${f1(_wcx - _wall_thk_px_b / 2)}" y="${f1(_wall_top_svg_y)}" width="${f1(_wall_thk_px_b)}" height="${f1(baseline_y - _wall_top_svg_y)}" fill="${wall_fill_b}" stroke="${wall_stroke_b}" stroke-width="0.9"/>\n`;
    }
    s += `<text x="${f1(_wall_N_cx)}" y="${f1(baseline_y + 12)}" text-anchor="middle" font-size="10" fill="${wall_stroke_b}" font-weight="600">N wall</text>\n`;
    s += `<text x="${f1(_wall_S_cx)}" y="${f1(baseline_y + 12)}" text-anchor="middle" font-size="10" fill="${wall_stroke_b}" font-weight="600">S wall</text>\n`;

    // Base corners (on top)
    s += `<text x="${fFloat(bl[0] + 8)}" y="${fFloat(baseline_y - 6)}" text-anchor="start" font-size="11" fill="#333">${f1(_pitch_L)}°</text>\n`;
    s += `<text x="${fFloat(br[0] - 8)}" y="${fFloat(baseline_y - 6)}" text-anchor="end" font-size="11" fill="#333">${f1(_pitch_R)}°</text>\n`;

    // Position chain
    const _pos_dim_y = baseline_y + 62;
    const _n_wall_world = world_start + wall_inset_long_n;
    const _s_wall_world = world_end - wall_inset_long_s;
    const _pos_pts = [_wall_N_cx, ...truss_svg_xs, _wall_S_cx];
    const _pos_worlds = [_n_wall_world, ...truss_y_positions, _s_wall_world];
    for (const _px of _pos_pts) {
      s += `<line x1="${f1(_px)}" y1="${f1(baseline_y + 40)}" x2="${f1(_px)}" y2="${f1(_pos_dim_y + 4)}" stroke="#0066cc" stroke-width="0.5" stroke-dasharray="2,2"/>\n`;
    }
    for (let _i = 0; _i < _pos_pts.length - 1; _i++) {
      const _x1 = _pos_pts[_i], _x2 = _pos_pts[_i + 1];
      const _dist_u = Math.abs(_pos_worlds[_i + 1] - _pos_worlds[_i]);
      s += `<line x1="${f1(_x1)}" y1="${f1(_pos_dim_y)}" x2="${f1(_x2)}" y2="${f1(_pos_dim_y)}" stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
      s += `<text x="${f1((_x1 + _x2) / 2)}" y="${f1(_pos_dim_y - 4)}" text-anchor="middle" font-size="10" fill="#0066cc">${formatDimension(_dist_u)}</text>\n`;
    }
    const _lbls = ["N wall", ...Array.from({ length: truss_count }, (_, i) => `T${i + 1}`), "S wall"];
    for (let i = 0; i < _pos_pts.length; i++) {
      s += `<text x="${f1(_pos_pts[i])}" y="${f1(_pos_dim_y + 16)}" text-anchor="middle" font-size="10" fill="#0066cc">${_lbls[i]}</text>\n`;
    }

    // Overhang dims
    const _ovh_dim_y = _pos_dim_y + 34;
    const _oh_stroke = "#8B4513";
    s += `<line x1="${f1(bl[0])}" y1="${f1(baseline_y + 40)}" x2="${f1(bl[0])}" y2="${f1(_ovh_dim_y + 4)}" stroke="${_oh_stroke}" stroke-width="0.5" stroke-dasharray="2,2"/>\n`;
    s += `<line x1="${f1(_wall_N_cx)}" y1="${f1(_pos_dim_y + 20)}" x2="${f1(_wall_N_cx)}" y2="${f1(_ovh_dim_y + 4)}" stroke="${_oh_stroke}" stroke-width="0.5" stroke-dasharray="2,2"/>\n`;
    s += `<line x1="${f1(bl[0])}" y1="${f1(_ovh_dim_y)}" x2="${f1(_wall_N_cx)}" y2="${f1(_ovh_dim_y)}" stroke="${_oh_stroke}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
    s += `<text x="${f1((bl[0] + _wall_N_cx) / 2)}" y="${f1(_ovh_dim_y - 4)}" text-anchor="middle" font-size="10" fill="${_oh_stroke}">N overhang ${formatDimension(wall_inset_long_n)}</text>\n`;
    s += `<line x1="${f1(br[0])}" y1="${f1(baseline_y + 40)}" x2="${f1(br[0])}" y2="${f1(_ovh_dim_y + 4)}" stroke="${_oh_stroke}" stroke-width="0.5" stroke-dasharray="2,2"/>\n`;
    s += `<line x1="${f1(_wall_S_cx)}" y1="${f1(_pos_dim_y + 20)}" x2="${f1(_wall_S_cx)}" y2="${f1(_ovh_dim_y + 4)}" stroke="${_oh_stroke}" stroke-width="0.5" stroke-dasharray="2,2"/>\n`;
    s += `<line x1="${f1(_wall_S_cx)}" y1="${f1(_ovh_dim_y)}" x2="${f1(br[0])}" y2="${f1(_ovh_dim_y)}" stroke="${_oh_stroke}" stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n`;
    s += `<text x="${f1((_wall_S_cx + br[0]) / 2)}" y="${f1(_ovh_dim_y - 4)}" text-anchor="middle" font-size="10" fill="${_oh_stroke}">S overhang ${formatDimension(wall_inset_long_s)}</text>\n`;

    s += `<text x="${f1(x0 + w_p - 12)}" y="${f1(y0 + 36 + 32)}" text-anchor="end" font-size="11" fill="${truss_stroke}">${truss_count} common (Fink) trusses shown</text>\n`;
  }

  // Ridge-end ventilation (long-axis section)
  const vent_ext_u = Number(roof.ridge_ext_u ?? 0.0);
  if (vent_ext_u > 0) {
    const ext_px = vent_ext_u * s_scale_b;
    const ridge_stroke_bb = "#5a3a17";
    const ridge_w_bb = Math.max(2.2, (ridge_size_in[0] / IN_PER_UNIT) * s_scale_b * 0.4);
    const tl_ext: [number, number] = [tl_b[0] - ext_px, t_y_b];
    const tr_ext: [number, number] = [tr_b[0] + ext_px, t_y_b];
    s += `<line x1="${f1(tl_ext[0])}" y1="${f1(tl_ext[1])}" x2="${f1(tl_b[0])}" y2="${f1(tl_b[1])}" stroke="${ridge_stroke_bb}" stroke-width="${f1(ridge_w_bb)}" stroke-linecap="round"/>\n`;
    s += `<line x1="${f1(tr_b[0])}" y1="${f1(tr_b[1])}" x2="${f1(tr_ext[0])}" y2="${f1(tr_ext[1])}" stroke="${ridge_stroke_bb}" stroke-width="${f1(ridge_w_bb)}" stroke-linecap="round"/>\n`;

    const _strut_w = Math.max(1.4, ridge_w_bb * 0.55);
    const _dhip_2d = Math.sqrt(_tol_L ** 2 + h ** 2);
    const _dhip_3d = Math.sqrt(_tol_L ** 2 + (span_x / 2.0) ** 2 + h ** 2);
    const _dhip_2d_r = Math.sqrt(_tol_R ** 2 + h ** 2);
    const _dhip_3d_r = Math.sqrt(_tol_R ** 2 + (span_x / 2.0) ** 2 + h ** 2);
    void _dhip_2d; void _dhip_2d_r;
    const frac_L = _dhip_3d > 0 ? vent_ext_u / _dhip_3d : 0.0;
    const frac_R = _dhip_3d_r > 0 ? vent_ext_u / _dhip_3d_r : 0.0;
    function walkFrac(a: [number, number], b: [number, number], frac: number): [number, number] {
      return [a[0] + frac * (b[0] - a[0]), a[1] + frac * (b[1] - a[1])];
    }
    const foot_L = walkFrac(tl_b, bl_b, frac_L);
    const foot_R = walkFrac(tr_b, br_b, frac_R);
    s += `<line x1="${f1(tl_ext[0])}" y1="${f1(tl_ext[1])}" x2="${f1(foot_L[0])}" y2="${f1(foot_L[1])}" stroke="${ridge_stroke_bb}" stroke-width="${f1(_strut_w)}" stroke-dasharray="5,3" opacity="0.85"/>\n`;
    s += `<line x1="${f1(tr_ext[0])}" y1="${f1(tr_ext[1])}" x2="${f1(foot_R[0])}" y2="${f1(foot_R[1])}" stroke="${ridge_stroke_bb}" stroke-width="${f1(_strut_w)}" stroke-dasharray="5,3" opacity="0.85"/>\n`;

    const vent_lbl_color = "#0066cc";
    const _mid_L: [number, number] = [(tl_ext[0] + tl_b[0]) / 2.0, t_y_b - 12];
    const _mid_R: [number, number] = [(tr_b[0] + tr_ext[0]) / 2.0, t_y_b - 12];
    s += `<text x="${f1(_mid_L[0])}" y="${f1(_mid_L[1])}" text-anchor="middle" font-size="10" fill="${vent_lbl_color}">vent ext = ${formatDimension(vent_ext_u)}</text>\n`;
    s += `<text x="${f1(_mid_R[0])}" y="${f1(_mid_R[1])}" text-anchor="middle" font-size="10" fill="${vent_lbl_color}">vent ext = ${formatDimension(vent_ext_u)}</text>\n`;

    s += `<text x="${f1(x0 + w_p - 12)}" y="${f1(y0 + h_p - 12)}" text-anchor="end" font-size="11" fill="${ridge_stroke_bb}" font-style="italic">RIDGE-END VENTILATION — ridge cap extends ${formatDimension(vent_ext_u)} past each hip apex; wedge below is open on E &amp; W faces (mesh-screened)</text>\n`;
  }

  return s;
}

function cx_from_geom(_g: GenericGeom): void {}
