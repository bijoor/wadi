// Furniture catalog — the picker's built-in CC0 set (Kenney "Furniture Kit", CC0,
// kenney.nl). GLB files live in editor/public/furniture/<id>.glb (bundled, ~350 KB
// total) and can also be mirrored to R2 (see scripts/publish-furniture.sh) for a CDN
// / larger catalog. Each spec carries the piece's REAL-WORLD dimensions in metres;
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
  // Bundled copy, base-aware so it resolves under /editor/ on the deployed site too.
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
