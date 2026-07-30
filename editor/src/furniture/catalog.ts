// Furniture catalog — the picker's built-in CC0 set (Kenney "Furniture Kit", CC0,
// kenney.nl). This is the FULL kit minus the structural pieces Wadi models
// parametrically (walls, doorways, stairs, floors). GLB files live in
// editor/public/furniture/<id>.glb (bundled, ~1.9 MB total) and are also mirrored to
// R2 (see scripts/publish-furniture.sh) so they can be served from the CDN. Each spec carries the piece's REAL-WORLD dimensions in metres;
// FurnitureItem normalises the GLB to that size, so the arbitrary native model scale
// doesn't matter. When a piece is placed, `furnitureAsset(id)` builds the inline
// `ItemAsset` (with a resolved `src`) that gets copied onto the object — keeping the
// .wadi self-contained.

import type { ItemAsset } from "../schema/houseConfig";

// Baked-in remote furniture host (Cloudflare R2 on our custom domain, CORS `*`). The
// GLBs live under the `furniture/` prefix of the wadi-templates bucket (published via
// scripts/publish-furniture.sh). Empty → bundled fallback. A localStorage override
// ("wadi.furnitureUrl") still wins; if the host is unreachable, FurnitureItem shows
// its placeholder box rather than failing.
export const REMOTE_FURNITURE_URL = "https://templates.wadi.house/furniture";

const OVERRIDE_KEY = "wadi.furnitureUrl";
const stripTrailingSlash = (u: string) => u.replace(/\/+$/, "");

/** Base URL for furniture GLBs (no trailing slash). Override → remote → bundled. */
export function furnitureBaseUrl(): string {
  try {
    const override = localStorage.getItem(OVERRIDE_KEY);
    if (override && override.trim()) return stripTrailingSlash(override.trim());
  } catch {
    /* localStorage blocked — ignore */
  }
  if (REMOTE_FURNITURE_URL) return stripTrailingSlash(REMOTE_FURNITURE_URL);
  // Bundled copy, base-aware so it resolves under the app's base path (/app/) too.
  return stripTrailingSlash(`${import.meta.env.BASE_URL}furniture`);
}

export function setFurnitureBaseUrl(url: string | null): void {
  try {
    if (url && url.trim()) localStorage.setItem(OVERRIDE_KEY, stripTrailingSlash(url.trim()));
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

/** Full GLB URL for a catalog id. */
export function furnitureUrl(id: string): string {
  return `${furnitureBaseUrl()}/${id}.glb`;
}

// A catalog entry: the piece's identity + real-world footprint. `src` is resolved on
// demand (furnitureAsset) so the stored asset can point at whatever host is active.
export interface FurnitureSpec {
  id: string;
  name: string;
  category: string;
  dimensions: [number, number, number]; // [w, h, d] in METRES (w across, d front-to-back)
}

// Curated from the Kenney Furniture Kit (CC0). Native/structural pieces (stairs, walls,
// doorways, floors) are intentionally excluded — Wadi models those parametrically.
export const FURNITURE_CATALOG: FurnitureSpec[] = [
  // Bedroom
  { id: "bed_double", name: "Double bed", category: "Bedroom", dimensions: [1.5, 0.5, 2.0] },
  { id: "bed_single", name: "Single bed", category: "Bedroom", dimensions: [0.9, 0.5, 1.9] },
  { id: "bed_bunk", name: "Bunk bed", category: "Bedroom", dimensions: [1.0, 1.7, 2.0] },
  { id: "wardrobe", name: "Wardrobe", category: "Bedroom", dimensions: [1.0, 1.8, 0.55] },
  { id: "bedside_table", name: "Bedside table", category: "Bedroom", dimensions: [0.5, 0.55, 0.4] },
  // Living
  { id: "sofa", name: "Sofa", category: "Living", dimensions: [1.9, 0.8, 0.9] },
  { id: "sofa_long", name: "Large sofa", category: "Living", dimensions: [2.5, 0.8, 0.9] },
  { id: "sofa_corner", name: "Corner sofa", category: "Living", dimensions: [2.4, 0.8, 2.4] },
  { id: "armchair", name: "Armchair", category: "Living", dimensions: [0.85, 0.8, 0.85] },
  { id: "recliner", name: "Recliner", category: "Living", dimensions: [0.9, 1.0, 0.95] },
  { id: "ottoman", name: "Ottoman", category: "Living", dimensions: [0.8, 0.45, 0.8] },
  { id: "coffee_table", name: "Coffee table", category: "Living", dimensions: [1.1, 0.4, 0.6] },
  { id: "side_table", name: "Side table", category: "Living", dimensions: [0.5, 0.5, 0.5] },
  { id: "tv_unit", name: "TV unit", category: "Living", dimensions: [1.5, 0.5, 0.4] },
  { id: "tv", name: "Television", category: "Living", dimensions: [1.2, 0.7, 0.1] },
  { id: "cabinet_wide", name: "Cabinet", category: "Living", dimensions: [1.6, 1.0, 0.4] },
  { id: "ceiling_fan", name: "Ceiling fan", category: "Living", dimensions: [1.2, 0.35, 1.2] },
  // Dining
  { id: "dining_table", name: "Dining table", category: "Dining", dimensions: [1.5, 0.75, 0.9] },
  { id: "round_table", name: "Round table", category: "Dining", dimensions: [1.1, 0.75, 1.1] },
  { id: "chair", name: "Chair", category: "Dining", dimensions: [0.5, 0.9, 0.5] },
  { id: "bench", name: "Bench", category: "Dining", dimensions: [1.4, 0.45, 0.4] },
  { id: "bar_stool", name: "Bar stool", category: "Dining", dimensions: [0.4, 1.05, 0.4] },
  // Kitchen
  { id: "kitchen_cabinet", name: "Base cabinet", category: "Kitchen", dimensions: [0.6, 0.9, 0.6] },
  { id: "kitchen_cabinet_upper", name: "Wall cabinet", category: "Kitchen", dimensions: [0.6, 0.7, 0.35] },
  { id: "kitchen_sink", name: "Kitchen sink", category: "Kitchen", dimensions: [0.6, 0.9, 0.6] },
  { id: "stove", name: "Stove", category: "Kitchen", dimensions: [0.6, 0.9, 0.65] },
  { id: "range_hood", name: "Range hood", category: "Kitchen", dimensions: [0.6, 0.45, 0.5] },
  { id: "fridge", name: "Fridge", category: "Kitchen", dimensions: [0.7, 1.8, 0.7] },
  { id: "microwave", name: "Microwave", category: "Kitchen", dimensions: [0.5, 0.3, 0.4] },
  { id: "coffee_machine", name: "Coffee machine", category: "Kitchen", dimensions: [0.25, 0.35, 0.3] },
  // Bathroom
  { id: "toilet", name: "Toilet", category: "Bathroom", dimensions: [0.5, 0.8, 0.7] },
  { id: "bathtub", name: "Bathtub", category: "Bathroom", dimensions: [0.75, 0.6, 1.6] },
  { id: "shower", name: "Shower", category: "Bathroom", dimensions: [0.9, 2.1, 0.9] },
  { id: "bathroom_sink", name: "Washbasin", category: "Bathroom", dimensions: [0.6, 0.85, 0.5] },
  { id: "bathroom_mirror", name: "Mirror", category: "Bathroom", dimensions: [0.6, 0.8, 0.05] },
  { id: "bathroom_cabinet", name: "Bathroom cabinet", category: "Bathroom", dimensions: [0.6, 0.7, 0.3] },
  { id: "washing_machine", name: "Washing machine", category: "Bathroom", dimensions: [0.6, 0.85, 0.6] },
  // Study / office
  { id: "desk", name: "Desk", category: "Study", dimensions: [1.2, 0.75, 0.6] },
  { id: "desk_corner", name: "Corner desk", category: "Study", dimensions: [1.4, 0.75, 1.4] },
  { id: "desk_chair", name: "Desk chair", category: "Study", dimensions: [0.6, 1.0, 0.6] },
  { id: "bookcase", name: "Bookcase", category: "Study", dimensions: [0.9, 1.8, 0.3] },
  { id: "monitor", name: "Monitor", category: "Study", dimensions: [0.55, 0.4, 0.2] },
  { id: "laptop", name: "Laptop", category: "Study", dimensions: [0.35, 0.03, 0.25] },
  // Lighting
  { id: "floor_lamp", name: "Floor lamp", category: "Lighting", dimensions: [0.4, 1.6, 0.4] },
  { id: "table_lamp", name: "Table lamp", category: "Lighting", dimensions: [0.3, 0.5, 0.3] },
  { id: "wall_light", name: "Wall light", category: "Lighting", dimensions: [0.2, 0.3, 0.15] },
  // Decor
  { id: "plant", name: "Potted plant", category: "Decor", dimensions: [0.5, 1.0, 0.5] },
  { id: "small_plant", name: "Small plant", category: "Decor", dimensions: [0.3, 0.45, 0.3] },
  { id: "coat_rack", name: "Coat rack", category: "Decor", dimensions: [0.5, 1.8, 0.5] },
  { id: "rug", name: "Rug", category: "Decor", dimensions: [1.6, 0.02, 2.3] },

  // ─────────────────────────────────────────────────────────────────────────
  // Full Kenney Furniture Kit — every remaining non-structural piece (stairs,
  // walls, doorways, floors are excluded; Wadi models those parametrically).
  // Dimensions are the model's own bbox scaled by the kit's ~1.9 unit→metre
  // factor, so the whole set shares one real-world scale.
  // Bedroom
  { id: "bedside_cabinet", name: "Bedside cabinet", category: "Bedroom", dimensions: [0.51, 0.44, 0.41] },
  { id: "bedside_table_drawers", name: "Bedside table (drawers)", category: "Bedroom", dimensions: [0.51, 0.5, 0.41] },
  { id: "pillow", name: "Pillow", category: "Bedroom", dimensions: [0.44, 0.42, 0.17] },
  { id: "pillow_blue", name: "Pillow (blue)", category: "Bedroom", dimensions: [0.44, 0.24, 0.12] },
  { id: "bolster", name: "Bolster pillow", category: "Bedroom", dimensions: [0.73, 0.42, 0.17] },
  { id: "bolster_blue", name: "Bolster (blue)", category: "Bedroom", dimensions: [0.98, 0.42, 0.17] },
  // Living
  { id: "sofa_design", name: "Design sofa", category: "Living", dimensions: [2.13, 0.76, 0.78] },
  { id: "sofa_design_corner", name: "Design corner sofa", category: "Living", dimensions: [2.56, 0.76, 2.56] },
  { id: "armchair_design", name: "Design armchair", category: "Living", dimensions: [1.39, 0.76, 0.78] },
  { id: "bench_cushion", name: "Cushioned bench", category: "Living", dimensions: [0.76, 0.87, 0.38] },
  { id: "bench_cushion_low", name: "Low cushioned bench", category: "Living", dimensions: [0.8, 0.38, 0.42] },
  { id: "tv_unit_doors", name: "TV unit (doors)", category: "Living", dimensions: [1.52, 0.59, 0.49] },
  { id: "tv_antenna", name: "TV (antenna)", category: "Living", dimensions: [0.5, 0.2, 0.15] },
  { id: "tv_vintage", name: "Vintage TV", category: "Living", dimensions: [0.78, 0.51, 0.51] },
  { id: "speaker", name: "Speaker", category: "Living", dimensions: [0.28, 1.21, 0.28] },
  { id: "speaker_small", name: "Small speaker", category: "Living", dimensions: [0.28, 0.57, 0.25] },
  { id: "radio", name: "Radio", category: "Living", dimensions: [0.6, 0.43, 0.19] },
  { id: "coffee_table_glass", name: "Glass coffee table", category: "Living", dimensions: [1.26, 0.44, 0.76] },
  { id: "coffee_table_glass_sq", name: "Glass coffee table (square)", category: "Living", dimensions: [0.76, 0.44, 0.76] },
  { id: "coffee_table_square", name: "Coffee table (square)", category: "Living", dimensions: [0.76, 0.44, 0.76] },
  { id: "side_table_cross", name: "Cross-leg side table", category: "Living", dimensions: [1.62, 0.66, 0.85] },
  { id: "side_table_cross_cloth", name: "Cross-leg table (cloth)", category: "Living", dimensions: [1.62, 0.66, 0.85] },
  { id: "side_table_drawers", name: "Side table (drawers)", category: "Living", dimensions: [1.02, 0.73, 0.42] },
  // Dining
  { id: "chair_cushion", name: "Cushioned chair", category: "Dining", dimensions: [0.38, 0.87, 0.38] },
  { id: "chair_modern", name: "Modern chair", category: "Dining", dimensions: [0.38, 0.87, 0.38] },
  { id: "chair_modern_frame", name: "Modern frame chair", category: "Dining", dimensions: [0.38, 0.87, 0.38] },
  { id: "chair_rounded", name: "Rounded chair", category: "Dining", dimensions: [0.38, 0.86, 0.38] },
  { id: "dining_table_glass", name: "Glass dining table", category: "Dining", dimensions: [1.6, 0.62, 0.85] },
  { id: "dining_table_cloth", name: "Dining table (cloth)", category: "Dining", dimensions: [1.6, 0.62, 0.85] },
  { id: "bar_stool_square", name: "Bar stool (square)", category: "Dining", dimensions: [0.29, 0.77, 0.28] },
  // Kitchen
  { id: "kitchen_island", name: "Kitchen island", category: "Kitchen", dimensions: [0.82, 0.8, 0.4] },
  { id: "kitchen_island_end", name: "Island end", category: "Kitchen", dimensions: [0.19, 0.8, 0.4] },
  { id: "blender", name: "Blender", category: "Kitchen", dimensions: [0.26, 0.43, 0.21] },
  { id: "kitchen_cabinet_corner", name: "Corner base cabinet", category: "Kitchen", dimensions: [0.87, 0.85, 0.87] },
  { id: "kitchen_cabinet_corner_round", name: "Corner base cabinet (round)", category: "Kitchen", dimensions: [0.85, 0.85, 0.85] },
  { id: "kitchen_cabinet_drawer", name: "Base cabinet (drawers)", category: "Kitchen", dimensions: [0.82, 0.85, 0.85] },
  { id: "kitchen_cabinet_upper_corner", name: "Wall cabinet (corner)", category: "Kitchen", dimensions: [0.41, 0.74, 0.4] },
  { id: "kitchen_cabinet_upper_double", name: "Wall cabinet (double)", category: "Kitchen", dimensions: [0.82, 0.74, 0.42] },
  { id: "kitchen_cabinet_upper_low", name: "Wall cabinet (low)", category: "Kitchen", dimensions: [0.82, 0.37, 0.42] },
  { id: "fridge_builtin", name: "Built-in fridge", category: "Kitchen", dimensions: [0.82, 1.65, 0.85] },
  { id: "fridge_large", name: "Large fridge", category: "Kitchen", dimensions: [0.99, 1.75, 0.77] },
  { id: "fridge_small", name: "Mini fridge", category: "Kitchen", dimensions: [0.82, 1.14, 0.55] },
  { id: "stove_electric", name: "Electric stove", category: "Kitchen", dimensions: [0.82, 0.85, 0.85] },
  { id: "range_hood_large", name: "Range hood (large)", category: "Kitchen", dimensions: [0.82, 0.7, 0.54] },
  { id: "toaster", name: "Toaster", category: "Kitchen", dimensions: [0.36, 0.25, 0.19] },
  { id: "trashcan", name: "Trash can", category: "Kitchen", dimensions: [0.39, 0.81, 0.44] },
  // Bathroom
  { id: "bathroom_cabinet_drawer", name: "Bathroom cabinet (drawers)", category: "Bathroom", dimensions: [0.82, 0.9, 0.61] },
  { id: "bathroom_sink_square", name: "Washbasin (square)", category: "Bathroom", dimensions: [0.82, 1.1, 0.57] },
  { id: "shower_square", name: "Shower (square)", category: "Bathroom", dimensions: [1.07, 2.08, 1.11] },
  { id: "toilet_square", name: "Toilet (square)", category: "Bathroom", dimensions: [0.58, 0.86, 0.74] },
  { id: "dryer", name: "Dryer", category: "Bathroom", dimensions: [0.74, 0.89, 0.72] },
  { id: "washer_dryer_stacked", name: "Washer-dryer (stacked)", category: "Bathroom", dimensions: [0.74, 1.79, 0.74] },
  // Study / office
  { id: "bookcase_closed", name: "Bookcase (closed)", category: "Study", dimensions: [0.76, 1.61, 0.47] },
  { id: "bookcase_low", name: "Bookcase (low)", category: "Study", dimensions: [0.76, 0.76, 0.47] },
  { id: "keyboard", name: "Keyboard", category: "Study", dimensions: [0.54, 0.05, 0.22] },
  { id: "mouse", name: "Mouse", category: "Study", dimensions: [0.09, 0.04, 0.16] },
  { id: "books", name: "Books", category: "Study", dimensions: [0.29, 0.2, 0.18] },
  // Lighting
  { id: "ceiling_lamp_square", name: "Ceiling lamp (square)", category: "Lighting", dimensions: [0.23, 0.44, 0.23] },
  { id: "floor_lamp_square", name: "Floor lamp (square)", category: "Lighting", dimensions: [0.23, 1.63, 0.23] },
  { id: "table_lamp_square", name: "Table lamp (square)", category: "Lighting", dimensions: [0.23, 0.55, 0.23] },
  // Decor
  { id: "small_plant_2", name: "Small plant (fern)", category: "Decor", dimensions: [0.18, 0.27, 0.18] },
  { id: "small_plant_3", name: "Small plant (cactus)", category: "Decor", dimensions: [0.19, 0.28, 0.16] },
  { id: "coat_hooks", name: "Coat hooks (wall)", category: "Decor", dimensions: [0.85, 0.53, 0.26] },
  { id: "doormat", name: "Doormat", category: "Decor", dimensions: [0.82, 0.02, 0.45] },
  { id: "rug_round", name: "Round rug", category: "Decor", dimensions: [1.75, 0.02, 1.75] },
  { id: "rug_rounded", name: "Rounded rug", category: "Decor", dimensions: [2.98, 0.02, 1.75] },
  { id: "rug_square", name: "Square rug", category: "Decor", dimensions: [1.72, 0.02, 1.75] },
  { id: "teddy_bear", name: "Teddy bear", category: "Decor", dimensions: [0.74, 0.85, 0.47] },
  { id: "box_closed", name: "Box (closed)", category: "Decor", dimensions: [0.4, 0.53, 0.4] },
  { id: "box_open", name: "Box (open)", category: "Decor", dimensions: [0.71, 0.53, 0.4] },
];

// Categories in catalog order (for the picker's category filter).
export const FURNITURE_CATEGORIES: string[] = [
  ...new Set(FURNITURE_CATALOG.map((a) => a.category)),
];

export function furnitureSpec(id: string): FurnitureSpec | undefined {
  return FURNITURE_CATALOG.find((a) => a.id === id);
}

/** Build the inline ItemAsset for a catalog id (with a resolved `src`). */
export function furnitureAsset(id: string): ItemAsset {
  const spec = furnitureSpec(id) ?? FURNITURE_CATALOG[0];
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    src: furnitureUrl(spec.id),
    dimensions: spec.dimensions,
  };
}

export const DEFAULT_FURNITURE_ID = FURNITURE_CATALOG[0].id;
