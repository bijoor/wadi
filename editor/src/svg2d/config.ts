// Mirror of the Python `config.GLOBAL_CONFIG.dimensions` and the
// wall-thickness default. The full GLOBAL_CONFIG lives in house_config.py
// (with tuple color values, layer configs, etc.) — but the SVG generators
// only read the dimensions sub-dict and `wall_thickness`. Rather than
// serialize GLOBAL_CONFIG to JSON on the Python side (Phase 0's scope),
// we hard-code the defaults here so the editor stays fully client-side.
// Keep this in sync with `config.py::GLOBAL_CONFIG['dimensions']` and the
// override in house_config.py's `GLOBAL_CONFIG.update({...})` block.

export interface DimensionConfig {
  show_outer_dimensions: boolean;
  show_inner_dimensions: boolean;
  show_room_dimensions: boolean;
  show_opening_dimensions: boolean;
  dimension_offset: number;
  dimension_offset_increment: number;
  inner_dimension_offset: number;
  opening_dimension_offset: number;
  min_dimension_length: number;
  unit_display: "feet" | string;
  unit_conversion: number;
  precision: number;
  use_feet_inches: boolean;
  text_size: number;
  room_text_size: number;
  opening_text_size: number;
}

// Structural defaults for roof frame members. Each roof object's own
// `framing.*` block overrides these; the fallback chain is
//   roof.framing.X → houseConfig.defaults.framing.X → GC.roof_framing.X.
// Nominal sizes stay in inches (industry standard, "2×4", "6×3"); the
// on-centre spacing stays in inches too (o.c. is universally inches).
export interface RoofFramingDefaults {
  rafter_size_in: [number, number];
  rafter_spacing_in: number;
  purlin_size_in: [number, number];
  purlin_spacing_in: number;
  ridge_size_in: [number, number];
  ring_beam_size_in: [number, number];
  wall_thickness_mm?: {
    rafter?: number;
    purlin?: number;
    ridge?: number;
    ring_beam?: number;
  };
}

export interface GlobalConfig {
  wall_thickness: number;
  plinth_height: number;
  floor_slab_thickness: number;
  roof_thickness: number;
  beam_size: number;
  // Floor-to-floor height for any floor without an override — drives
  // the vertical stack used to compute wall-top / roof position.
  // INDEPENDENT of wall_height (no enforced relationship).
  floor_height: number;
  // Wall standing height (floor top → ceiling) for any floor without
  // an override — used by wall meshes / dimension labels. INDEPENDENT
  // of floor_height.
  wall_height: number;
  roof_framing: RoofFramingDefaults;
  elevation_rendering_priority: Record<string, number>;
  dimensions: DimensionConfig;
}

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  wall_thickness: 8,
  plinth_height: 30,
  floor_slab_thickness: 8,
  roof_thickness: 3,
  beam_size: 8,
  floor_height: 100.0,
  wall_height: 100.0,
  roof_framing: {
    rafter_size_in: [2, 4],
    rafter_spacing_in: 36,
    purlin_size_in: [2, 1],
    purlin_spacing_in: 12,
    ridge_size_in: [6, 3],
    ring_beam_size_in: [4, 2],
    wall_thickness_mm: {
      rafter: 2,
      purlin: 1.5,
      ridge: 3,
      ring_beam: 3,
    },
  },
  elevation_rendering_priority: {
    beam: 0,
    floor_slab: 1,
    room: 2,
    wall: 2,
    pillar: 3,
  },
  dimensions: {
    show_outer_dimensions: true,
    show_inner_dimensions: true,
    show_room_dimensions: true,
    show_opening_dimensions: true,
    dimension_offset: 30,
    dimension_offset_increment: 20,
    inner_dimension_offset: 15,
    opening_dimension_offset: 8,
    min_dimension_length: 10,
    unit_display: "feet",
    unit_conversion: 10.0,
    precision: 1,
    use_feet_inches: true,
    text_size: 10,
    room_text_size: 12,
    opening_text_size: 8,
  },
};

// --- Legibility text scaling ------------------------------------------
// The dimension/label font sizes above are authored in PROJECT UNITS for
// a reference drawing whose physical span (larger of plinth length/width)
// is REF_SPAN. All plan/elevation text is drawn inside the scaled group,
// so with a fixed font-size the on-screen text (when the whole drawing is
// fit to view) is ∝ fontModel / span — i.e. it shrinks as the house grows
// and balloons for tiny houses. To keep legibility roughly constant we
// scale the font sizes with the house's physical span.
//
// Mirrors the setDimensionUnits() pattern: a module-level "active" factor
// set once per render pass by the entry point (rebuildSvgMap / dump-svgs)
// before generating a batch of SVGs. Default 1 — standalone callers that
// never set it (e.g. the parity harness) keep the historical sizes.
export const TEXT_SCALE_REF_SPAN = 450;

let activeTextScale = 1;

// Physical span of a house config, used as the scaling input.
//
// This must track the actual DRAWN extent — the object bounding box that
// sets each floor plan's viewBox — NOT the plinth. The plinth can be wildly
// out of sync with the placed objects (e.g. an early-stage model with a big
// declared plinth but only a slab drawn), which would over/under-scale the
// text. We mirror floorPlan's bbox (floor_slab/beam/room + wall endpoints)
// and take the largest span across all floors so text is uniform across a
// house's drawings. Plinth, then site, are fallbacks only when nothing is
// drawn yet.
export function houseSpanUnits(hc: unknown): number {
  const o = hc as {
    floors?: Array<{ objects?: Array<Record<string, unknown>> }>;
    plinth?: { length?: number; width?: number };
    site?: { plot_length?: number; plot_width?: number };
  } | null;

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  let best = 0;
  for (const fl of o?.floors ?? []) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const obj of fl.objects ?? []) {
      const t = obj.type as string;
      if (t === "floor_slab" || t === "beam" || t === "room") {
        const x = num(obj.x), y = num(obj.y);
        const w = num(obj.width), l = num(obj.length);
        if (x !== undefined && y !== undefined && w !== undefined && l !== undefined) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x + w > maxX) maxX = x + w;
          if (y + l > maxY) maxY = y + l;
        }
      } else if (t === "wall") {
        const sx = num(obj.start_x), sy = num(obj.start_y);
        const ex = num(obj.end_x), ey = num(obj.end_y);
        if (sx !== undefined && sy !== undefined && ex !== undefined && ey !== undefined) {
          minX = Math.min(minX, sx, ex);
          maxX = Math.max(maxX, sx, ex);
          minY = Math.min(minY, sy, ey);
          maxY = Math.max(maxY, sy, ey);
        }
      }
    }
    if (Number.isFinite(minX) && Number.isFinite(maxX)) {
      best = Math.max(best, maxX - minX, maxY - minY);
    }
  }
  if (best > 0) return best;

  // Fallbacks: nothing drawable yet — use the plinth, then the site plot.
  const pl = o?.plinth;
  const span = Math.max(num(pl?.length) ?? 0, num(pl?.width) ?? 0);
  if (span > 0) return span;
  const s = o?.site;
  return Math.max(num(s?.plot_length) ?? 0, num(s?.plot_width) ?? 0);
}

// Factor from a physical span (project units). Clamped so tiny houses
// don't get illegibly small text and huge ones don't explode.
export function computeTextScale(spanUnits: number): number {
  if (!(spanUnits > 0)) return 1;
  return Math.min(Math.max(spanUnits / TEXT_SCALE_REF_SPAN, 0.6), 6);
}

// Set the active factor for the current render pass. `undefined`/0 resets
// to 1 (historical sizes).
export function setTextScale(factor: number | undefined): void {
  activeTextScale = factor && factor > 0 ? factor : 1;
}

export function getTextScale(): number {
  return activeTextScale;
}

// Scale a base font size by the active factor. Whole results stay whole
// (so factor === 1 is byte-identical); others round to 1 decimal to keep
// the SVG tidy.
export function scaledTextSize(base: number): number {
  const v = base * activeTextScale;
  return Number.isInteger(v) ? v : Math.round(v * 10) / 10;
}
