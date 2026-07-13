// Master canvas assembly + panel metadata tracking.
// Mirrors svg_2d.py lines 8371-8515 (compose) + 8522-8562 (per-panel split).

import type { RoofComputed } from "./geometry";
import type { Layout } from "./layout";
import { slopePanel } from "./slopePanel";
import { framingDetailPanel } from "./framingDetail";
import { trussElevationPanel } from "./trussPanel";
import { materialsTakeoffPanel } from "./materials";
import { consolidatedBomPanel } from "./consolidatedBom";
import { tilePanel } from "./tile";
import { topViewPanel } from "./topView";
import { perspectivePanel } from "./perspective";
import { sectionAaPanel, sectionBbPanel } from "./sections";
import { f, fFloat, f1 } from "./format";

export interface PanelMeta {
  id: string;
  title: string;
  x0: number;
  y0: number;
  width: number;
  height: number;
  svg: string;
  // Numeric-taint flags for byte-identical output when the value
  // arrived via Python float arithmetic (must render "N.0").
  x0IsFloat?: boolean;
  y0IsFloat?: boolean;
  widthIsFloat?: boolean;
  heightIsFloat?: boolean;
}

export interface ComposeOptions {
  // Raw contents of docs/2d/roof/roof-cross-section.svg. Node callers
  // read it from disk and pass it in; browser callers fetch it over
  // HTTP. When omitted, the eave panel is replaced by a "not found"
  // stub — the pipeline still succeeds.
  eaveCrossSectionSvg?: string;
}

export function compose(
  computed: RoofComputed,
  layout: Layout,
  options: ComposeOptions = {},
): {
  masterSvg: string;
  panels: PanelMeta[];
} {
  const {
    canvas_w,
    canvas_h,
    canvas_title_h,
    outer_pad,
    row_gap,
    col_gap,
    top_view_h,
    persp_row_h,
    panel_w,
    panel_h,
    section_h,
    framing_panel_h,
    external_eave_panel_w,
    external_eave_panel_h,
    truss_panel_h,
    materials_panel_h,
    consolidated_panel_h,
    tile_panel_h,
  } = layout;

  const panels: PanelMeta[] = [];
  function record(
    pid: string,
    title: string,
    x0: number,
    y0: number,
    w: number,
    h: number,
    svg_fragment: string,
    flags?: { x0IsFloat?: boolean; y0IsFloat?: boolean; widthIsFloat?: boolean; heightIsFloat?: boolean },
  ): string {
    panels.push({ id: pid, title, x0, y0, width: w, height: h, svg: svg_fragment, ...(flags ?? {}) });
    return svg_fragment;
  }

  const slopes = computed.slopes;

  let svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${f(canvas_w)}" height="${fFloat(canvas_h)}" viewBox="0 0 ${f(canvas_w)} ${fFloat(canvas_h)}">\n` +
    `<title>Hip Roof — Slope Views &amp; Framing</title>\n` +
    `<defs>\n` +
    `  <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n` +
    `    <path d="M0,0 L10,5 L0,10 z" fill="#0066cc"/>\n` +
    `  </marker>\n` +
    `  <style>text { font-family: -apple-system, Arial, sans-serif; }</style>\n` +
    `</defs>\n` +
    `<rect width="${f(canvas_w)}" height="${fFloat(canvas_h)}" fill="#fafafa"/>\n` +
    `<text x="${fFloat(canvas_w / 2)}" y="34" text-anchor="middle" font-size="22" font-weight="bold" fill="#222">Hip Roof — Slope Views &amp; Framing</text>\n`;

  // Row 0: top view
  const top_view_y0 = canvas_title_h + outer_pad;
  const top_view_w = canvas_w - 2 * outer_pad;
  svg += record(
    "top_view",
    "Roof plan — rafters, purlins & ring beam",
    outer_pad,
    top_view_y0,
    top_view_w,
    top_view_h,
    topViewPanel(outer_pad, top_view_y0, top_view_w, top_view_h, computed, layout),
  );

  // Row 1: perspective + section AA + section BB
  const persp_y0 = top_view_y0 + top_view_h + row_gap;
  svg += record(
    "perspective",
    "Isometric view — structural frame",
    outer_pad,
    persp_y0,
    panel_w,
    persp_row_h,
    perspectivePanel(outer_pad, persp_y0, panel_w, persp_row_h, computed, layout),
  );
  const right_col_x = outer_pad + panel_w + col_gap;
  svg += record(
    "section_aa",
    "Section A-A — long axis cross-section",
    right_col_x,
    persp_y0,
    panel_w,
    section_h,
    sectionAaPanel(right_col_x, persp_y0, panel_w, section_h, computed, layout),
    { heightIsFloat: true },
  );
  const _bb_y = persp_y0 + section_h + row_gap;
  svg += record(
    "section_bb",
    "Section B-B — short axis cross-section",
    right_col_x,
    _bb_y,
    panel_w,
    section_h,
    sectionBbPanel(right_col_x, _bb_y, panel_w, section_h, computed, layout, true),
    { y0IsFloat: true, heightIsFloat: true },
  );

  // Row 2: slope panels
  const grid_y0 = persp_y0 + persp_row_h + row_gap;
  const main_repr = { ...slopes[0] };
  const hip_n_repr = { ...slopes[2] };
  const hip_s_repr = { ...slopes[3] };
  main_repr.title = `MAIN SLOPES — ${slopes[0].code} &amp; ${slopes[1].code} (trapezoid, identical pair)`;
  const _hips_are_identical = Math.abs(hip_n_repr.pitch - hip_s_repr.pitch) < 0.1;
  if (_hips_are_identical) {
    hip_n_repr.title = `HIP ENDS — ${slopes[2].code} &amp; ${slopes[3].code} (triangle, identical pair)`;
  } else {
    hip_n_repr.title = `HIP END — ${slopes[2].code} (triangle, ${f1(hip_n_repr.pitch)}°)`;
    hip_s_repr.title = `HIP END — ${slopes[3].code} (triangle, ${f1(hip_s_repr.pitch)}°)`;
  }

  svg += record(
    "slope_main",
    main_repr.title.replace("&amp;", "&"),
    outer_pad,
    grid_y0,
    panel_w,
    panel_h,
    slopePanel(outer_pad, grid_y0, main_repr, computed, layout),
  );
  const _hip_n_x = outer_pad + panel_w + col_gap;
  svg += record(
    "slope_hip_n",
    hip_n_repr.title.replace("&amp;", "&"),
    _hip_n_x,
    grid_y0,
    panel_w,
    panel_h,
    slopePanel(_hip_n_x, grid_y0, hip_n_repr, computed, layout),
  );
  let framing_y0: number;
  if (!_hips_are_identical) {
    const grid_y0_s = grid_y0 + panel_h + row_gap;
    svg += record(
      "slope_hip_s",
      hip_s_repr.title.replace("&amp;", "&"),
      _hip_n_x,
      grid_y0_s,
      panel_w,
      panel_h,
      slopePanel(_hip_n_x, grid_y0_s, hip_s_repr, computed, layout),
    );
    framing_y0 = grid_y0_s + panel_h + row_gap;
  } else {
    framing_y0 = grid_y0 + panel_h + row_gap;
  }
  svg += record(
    "framing_detail",
    "Framing detail — metal pipe cross sections",
    outer_pad,
    framing_y0,
    canvas_w - 2 * outer_pad,
    framing_panel_h,
    framingDetailPanel(outer_pad, framing_y0, computed, layout),
  );

  // Eave cross-section (embed external file)
  const eave_y0 = framing_y0 + framing_panel_h + row_gap;
  let _eave_frag = "";
  _eave_frag += `<rect x="${f(outer_pad)}" y="${f(eave_y0)}" width="${f(external_eave_panel_w)}" height="${f1(external_eave_panel_h)}" fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n`;
  _eave_frag += `<rect x="${f(outer_pad)}" y="${f(eave_y0)}" width="${f(external_eave_panel_w)}" height="40" fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n`;
  _eave_frag += `<text x="${fFloat(outer_pad + external_eave_panel_w / 2)}" y="${f(eave_y0 + 27)}" text-anchor="middle" font-size="18" font-weight="600" fill="#222">EAVE CROSS SECTION — hand-drawn detail (docs/2d/roof/roof-cross-section.svg)</text>\n`;

  // Embed docs/2d/roof/roof-cross-section.svg if the caller supplied it.
  // Node callers read it from disk; browser callers fetch it. When it's
  // absent we fall back to a "not found" text stub (matching what Python
  // does when the file is missing).
  const external = options.eaveCrossSectionSvg;
  if (external) {
    const m = /<svg\b[^>]*>([\s\S]*)<\/svg>/.exec(external);
    const inner = m ? m[1] : "";
    const vbMatch = /viewBox\s*=\s*"([^"]+)"/.exec(external);
    const viewBox = vbMatch ? vbMatch[1] : "0 0 297 210";
    const _title_bar = 40;
    _eave_frag += `<svg x="${f(outer_pad)}" y="${f(eave_y0 + _title_bar)}" width="${f(external_eave_panel_w)}" height="${f1(external_eave_panel_h - _title_bar)}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">\n`;
    _eave_frag += inner;
    _eave_frag += `</svg>\n`;
  } else {
    _eave_frag += `<text x="${fFloat(outer_pad + external_eave_panel_w / 2)}" y="${fFloat(eave_y0 + external_eave_panel_h / 2)}" text-anchor="middle" font-size="14" fill="#b00">(docs/2d/roof/roof-cross-section.svg not found — panel skipped)</text>\n`;
  }
  svg += record(
    "eave_cross_section",
    "Eave cross section — hand-drawn detail",
    outer_pad,
    eave_y0,
    external_eave_panel_w,
    external_eave_panel_h,
    _eave_frag,
    { heightIsFloat: true },
  );

  // Truss elevation
  const truss_panel_y0 = eave_y0 + external_eave_panel_h + row_gap;
  svg += record(
    "truss_elevation",
    "Fink truss elevation — bottom chord on ring beam",
    outer_pad,
    truss_panel_y0,
    canvas_w - 2 * outer_pad,
    truss_panel_h,
    trussElevationPanel(outer_pad, truss_panel_y0, computed, layout, true),
    { y0IsFloat: true },
  );

  // Materials
  const materials_y0 = truss_panel_y0 + truss_panel_h + row_gap;
  svg += record(
    "materials_takeoff",
    "Materials takeoff — verification of quantities",
    outer_pad,
    materials_y0,
    canvas_w - 2 * outer_pad,
    materials_panel_h,
    materialsTakeoffPanel(outer_pad, materials_y0, computed, layout, true),
    { y0IsFloat: true },
  );

  // Consolidated BOM
  const consolidated_y0 = materials_y0 + materials_panel_h + row_gap;
  svg += record(
    "consolidated_bom",
    "Consolidated procurement list — totals by material spec",
    outer_pad,
    consolidated_y0,
    canvas_w - 2 * outer_pad,
    consolidated_panel_h,
    consolidatedBomPanel(outer_pad, consolidated_y0, computed, layout, true),
    { y0IsFloat: true },
  );

  // Tile roofing
  const tile_y0 = consolidated_y0 + consolidated_panel_h + row_gap;
  svg += record(
    "tile_roofing",
    "Tile roofing — procured items",
    outer_pad,
    tile_y0,
    canvas_w - 2 * outer_pad,
    tile_panel_h,
    tilePanel(outer_pad, tile_y0, computed, layout, true),
    { y0IsFloat: true },
  );

  svg += `</svg>\n`;

  return { masterSvg: svg, panels };
}
