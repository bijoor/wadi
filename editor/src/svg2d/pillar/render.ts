// Port of svg_2d.py::_render_pillar_view — the shared renderer used by
// both `generate_pillar_elevation_view` and `generate_pillar_section_view`.
//
// Byte-parity approach: Python distinguishes int vs float in f-strings
// (`f"{5}" -> "5"`, `f"{5.0}" -> "5.0"`). JS has one Number type, so we
// call `f()` (bare) or `fFloat()` (adds trailing .0 for whole numbers)
// depending on which type Python would've kept at each interpolation.
// Python type propagation used to derive each site:
//   int / int   → float (Python 3)
//   int * float → float
//   int + int   → int
//   sum(ints)   → int, sum(floats) → float
// JSON scalars stay whatever type they're stored as (all-int in this cfg).

import { DEFAULT_GLOBAL_CONFIG } from "../config";
import type { HouseConfig } from "../expand";
import { formatDimension, f, fFloat } from "../format";
import type { Pillar } from "./cluster";
import { projectPillar, projectSlabBand, type ViewType, type SlabLike } from "./project";
import { buildKeyPlanSvg } from "./keyPlan";

interface RenderedPillar {
  name: string;
  proj_x: number;      // float (product from projection arithmetic)
  visible_w: number;   // int (from pillar.width/length, both int)
  z_bottom: number;    // int
  z_top: number;       // int
  depth: number;       // float
}

export interface RenderPillarOptions {
  viewType: ViewType;
  pillarsToShow: Pillar[];
  title: string;
  scale?: number;
  allPillars?: Pillar[];
}

export function renderPillarView(
  houseConfig: HouseConfig,
  options: RenderPillarOptions,
): string {
  const scale = options.scale ?? 2.0;   // float
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plinthConfig = (houseConfig as any).plinth ?? {};
  const floors = houseConfig.floors ?? [];

  const gc = DEFAULT_GLOBAL_CONFIG;
  const houseDefaults = (houseConfig as { defaults?: { floor_height?: number; slab_thickness?: number } }).defaults;
  const plinth_height = plinthConfig.height ?? gc.plinth_height;   // int
  const slab_thickness =
    houseDefaults?.slab_thickness ?? gc.floor_slab_thickness ?? 8; // int
  // Prefer per-floor override on floor 0 → house default → global.
  const floor0 = floors[0] as { height?: number } | undefined;
  const floor_0_height =
    floor0?.height ?? houseDefaults?.floor_height ?? gc.floor_height ?? 100;   // int

  const building_width = plinthConfig.width ?? 0;    // int
  const building_length = plinthConfig.length ?? 0;  // int

  let view_extent: number;
  if (options.viewType === "front" || options.viewType === "back") {
    view_extent = building_width;
  } else {
    view_extent = building_length;
  }

  // Python type propagation:
  //   plinth_height, slab_thickness, p.height   are int
  //   floor_0_height = GLOBAL_CONFIG.floor_heights[0] = 100.0  is float
  // → z_floor1_slab_bottom and z_floor1_slab_top become float via
  // int + float. z_plinth_top / z_floor0_slab_top / z_pillar_start stay
  // int. Renderer uses these floor1 flags to decide f() vs fFloat().
  const z_plinth_top = plinth_height;                                 // int
  const z_floor0_slab_top = plinth_height + slab_thickness;           // int
  const z_pillar_start = z_floor0_slab_top;                            // int
  const z_floor1_slab_bottom = z_floor0_slab_top + floor_0_height;    // float (100.0)
  const z_floor1_slab_top = z_floor1_slab_bottom + slab_thickness;     // float

  const rendered: RenderedPillar[] = [];
  for (const p of options.pillarsToShow) {
    const proj = projectPillar(p, options.viewType, building_width, building_length);
    const p_height = p.height ?? floor_0_height;
    rendered.push({
      name: p.name ?? "",
      proj_x: proj.proj_x,
      visible_w: proj.visible_w,
      z_bottom: z_pillar_start,
      z_top: z_pillar_start + p_height,
      depth: proj.depth,
    });
  }
  rendered.sort((a, b) => a.depth - b.depth);

  const floor0_slabs: SlabLike[] = [];
  const floor1_slabs: SlabLike[] = [];
  for (const floorConfig of floors) {
    const fn = floorConfig.floor_number;
    for (const obj of floorConfig.objects ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = obj as any;
      if (o.type === "floor_slab") {
        const s: SlabLike = { x: o.x, y: o.y, width: o.width, length: o.length };
        if (fn === 0) floor0_slabs.push(s);
        else if (fn === 1) floor1_slabs.push(s);
      }
    }
  }

  const max_pillar_z = rendered.length > 0
    ? Math.max(...rendered.map((r) => r.z_top))
    : z_floor1_slab_top + 50;
  const total_height = max_pillar_z + 20;   // int

  const horizontal_margin = 160;   // int
  const top_margin = 40;
  const title_space = 50;
  const bottom_label_space = 110;
  const key_plan_size = 120;
  const key_plan_margin = 16;

  // Products with scale=2.0 make these floats
  let svg_width = view_extent * scale + 2 * horizontal_margin;   // float
  let svg_width_is_float = true;   // tracks Python's int/float assignment history
  const svg_height = total_height * scale + top_margin + title_space + bottom_label_space;  // float

  const min_canvas_for_title = 520 + key_plan_size + key_plan_margin;   // int
  if (svg_width < min_canvas_for_title) {
    svg_width = min_canvas_for_title;
    svg_width_is_float = false;
  }

  const svgWidthStr = svg_width_is_float ? fFloat(svg_width) : f(svg_width);
  const svgHeightStr = fFloat(svg_height);

  const z_to_y = (z: number): number => total_height - z;   // int - z; int when z is int

  const content_top = top_margin + title_space;   // int

  let svg = "" +
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidthStr}" ` +
    `height="${svgHeightStr}" viewBox="0 0 ${svgWidthStr} ${svgHeightStr}">\n` +
    `<title>${options.title}</title>\n` +
    '<defs>\n' +
    '  <style>text { font-family: Arial, sans-serif; }</style>\n' +
    '  <pattern id="slab_hatch" patternUnits="userSpaceOnUse" ' +
    'width="3" height="3" patternTransform="rotate(45)">\n' +
    '    <line x1="0" y1="0" x2="0" y2="3" stroke="#555" stroke-width="0.6"/>\n' +
    '  </pattern>\n' +
    '</defs>\n' +
    `<text x="${fFloat(svg_width / 2)}" y="${f(top_margin + 25)}" text-anchor="middle" ` +
    `font-size="20" font-weight="bold">${options.title}</text>\n`;

  // Key plan (top right)
  // insetOriginX = svg_width(float) - key_plan_size(int) - key_plan_margin(int) → float
  svg += buildKeyPlanSvg({
    allPillars: options.allPillars ?? options.pillarsToShow,
    highlightedPillars: options.pillarsToShow,
    buildingWidth: building_width,
    buildingLength: building_length,
    viewType: options.viewType,
    insetOriginX: svg_width - key_plan_size - key_plan_margin,
    insetOriginXIsFloat: svg_width_is_float,
    insetOriginY: key_plan_margin,
    insetOriginYIsFloat: false,
    insetSize: key_plan_size,
    insetSizeIsFloat: false,
  });

  svg += `<g transform="translate(${f(horizontal_margin)}, ${f(content_top)}) scale(${fFloat(scale)})">\n`;

  // Ground line — total_height is int, so z_to_y(0) is int
  const ground_y = z_to_y(0);
  svg += `<line x1="0" y1="${f(ground_y)}" x2="${f(view_extent)}" y2="${f(ground_y)}" ` +
    'stroke="#666" stroke-width="2" stroke-dasharray="5,5"/>\n';

  // Plinth band
  svg += `<rect x="0" y="${f(z_to_y(z_plinth_top))}" width="${f(view_extent)}" ` +
    `height="${f(plinth_height)}" fill="#A0826D" stroke="#000" stroke-width="0.5"/>\n`;

  for (const slab of floor0_slabs) {
    const [sx, sw] = projectSlabBand(slab, options.viewType, building_width, building_length);
    // sx, sw come from int arithmetic on int slab fields → int
    svg += `<rect x="${f(sx)}" y="${f(z_to_y(z_floor0_slab_top))}" width="${f(sw)}" ` +
      `height="${f(slab_thickness)}" fill="#808080" stroke="#000" stroke-width="0.5"/>\n`;
  }

  // Pillars — proj_x float, visible_w int, z_top-z_bottom int
  for (const r of rendered) {
    svg += `<rect x="${fFloat(r.proj_x)}" y="${f(z_to_y(r.z_top))}" ` +
      `width="${f(r.visible_w)}" ` +
      `height="${f(r.z_top - r.z_bottom)}" ` +
      'fill="none" stroke="#000" stroke-width="0.6"/>\n';
  }

  for (const slab of floor1_slabs) {
    const [sx, sw] = projectSlabBand(slab, options.viewType, building_width, building_length);
    // z_floor1_slab_top is float → z_to_y result is float
    svg += `<rect x="${f(sx)}" y="${fFloat(z_to_y(z_floor1_slab_top))}" width="${f(sw)}" ` +
      `height="${f(slab_thickness)}" fill="url(#slab_hatch)" stroke="#000" stroke-width="0.6"/>\n`;
  }

  // Per-pillar dimensions
  const text_size = 4.0;
  for (const r of rendered) {
    if (r.z_top > z_floor1_slab_top) {
      const seg_b = r.z_top - z_floor1_slab_top;             // int
      const mid_z = (z_floor1_slab_top + r.z_top) / 2;       // float (division)
      const cx = r.proj_x + r.visible_w / 2;                 // float
      svg += `<text x="${fFloat(cx)}" y="${fFloat(z_to_y(mid_z))}" text-anchor="middle" ` +
        `font-size="${fFloat(text_size)}" fill="#000" ` +
        `transform="rotate(-90 ${fFloat(cx)} ${fFloat(z_to_y(mid_z))})">` +
        `${formatDimension(seg_b)}</text>\n`;
    } else if (r.z_top < z_floor1_slab_bottom) {
      const seg_a = r.z_top - r.z_bottom;                    // int
      const mid_z = (r.z_bottom + r.z_top) / 2;              // float
      const cx = r.proj_x + r.visible_w / 2;                 // float
      svg += `<text x="${fFloat(cx)}" y="${fFloat(z_to_y(mid_z))}" text-anchor="middle" ` +
        `font-size="${fFloat(text_size)}" fill="#000" ` +
        `transform="rotate(-90 ${fFloat(cx)} ${fFloat(z_to_y(mid_z))})">` +
        `${formatDimension(seg_a)}</text>\n`;
    }
  }

  // Pillar names — label_anchor_y = z_to_y(0) + 6 = int + int = int
  const label_anchor_y = z_to_y(0) + 6;
  for (const r of rendered) {
    const cx = r.proj_x + r.visible_w / 2;   // float
    const name = r.name ? r.name.replace(/_/g, " ") : "";
    if (!name) continue;
    svg += `<text x="${fFloat(cx)}" y="${f(label_anchor_y)}" text-anchor="end" ` +
      `font-size="3.5" fill="#000" ` +
      `transform="rotate(-90 ${fFloat(cx)} ${f(label_anchor_y)})">${name}</text>\n`;
  }

  // Left-side Z-level dimension stack.
  // z_floor1_slab_bottom / z_floor1_slab_top are Python floats (floor_0_height
  // = 100.0), so the y_lo/y_hi derived from them are also floats. The other
  // two levels are all int. Flag each level so we render with the right formatter.
  const dim_levels: [number, number, boolean, boolean][] = [
    // z_lo, z_hi, z_lo_isFloat, z_hi_isFloat
    [0, z_plinth_top, false, false],
    [z_plinth_top, z_floor0_slab_top, false, false],
    [z_floor0_slab_top, z_floor1_slab_bottom, false, true],
    [z_floor1_slab_bottom, z_floor1_slab_top, true, true],
  ];
  const dim_x = -8;
  for (const [z_lo, z_hi, loFloat, hiFloat] of dim_levels) {
    const y_lo = z_to_y(z_lo);
    const y_hi = z_to_y(z_hi);
    const yLoStr = loFloat ? fFloat(y_lo) : f(y_lo);
    const yHiStr = hiFloat ? fFloat(y_hi) : f(y_hi);
    svg +=
      `<line x1="0" y1="${yLoStr}" x2="${f(dim_x)}" y2="${yLoStr}" ` +
      'stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n' +
      `<line x1="0" y1="${yHiStr}" x2="${f(dim_x)}" y2="${yHiStr}" ` +
      'stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n' +
      `<line x1="${f(dim_x)}" y1="${yLoStr}" x2="${f(dim_x)}" y2="${yHiStr}" ` +
      'stroke="#000" stroke-width="0.5"/>\n';
    const arrow = 1.5;   // float
    // y_lo - arrow is always float (int - float or float - float). Same for y_lo + arrow, etc.
    svg +=
      `<polygon points="${f(dim_x)},${yLoStr} ${fFloat(dim_x - arrow)},${fFloat(y_lo - arrow)} ` +
      `${fFloat(dim_x + arrow)},${fFloat(y_lo - arrow)}" fill="#000"/>\n` +
      `<polygon points="${f(dim_x)},${yHiStr} ${fFloat(dim_x - arrow)},${fFloat(y_hi + arrow)} ` +
      `${fFloat(dim_x + arrow)},${fFloat(y_hi + arrow)}" fill="#000"/>\n`;
    const mid_y = (y_lo + y_hi) / 2;   // always float (division)
    const text_x = dim_x - 4;          // int
    svg +=
      `<text x="${f(text_x)}" y="${fFloat(mid_y)}" text-anchor="middle" ` +
      `font-size="4" fill="#000" ` +
      `transform="rotate(-90 ${f(text_x)} ${fFloat(mid_y)})">` +
      `${formatDimension(z_hi - z_lo)}</text>\n`;
  }

  svg += "</g>\n</svg>\n";
  return svg;
}
