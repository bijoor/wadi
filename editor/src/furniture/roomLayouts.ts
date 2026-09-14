// Turn a compiled room-layout pack (a `house` of template rooms, e.g.
// wadi-dsl/std-modules/rooms.wdl) into the `Layout[]` the placement engine consumes
// (plans/room-templates-in-wadi.md, Phase 3). Pure: config in, layouts out.
//
// A template room is one furniture arrangement. Its native `type` (room_type) is the
// category; when absent we fall back to the id convention `<type>_<variant>` (e.g.
// `bedroom_l` -> `bedroom`) that the floor-planner uses today, so the loader works with
// the current pack AND future typed templates. The furniture pieces come from the room's
// `furniture` container body, or its plain `items` (older packs author items directly).

import type { Layout, Piece, FurnitureAsset } from "./autoplace";

interface RawAsset {
  id?: string;
  name?: string;
  dimensions?: [number, number, number];
}
interface RawItem {
  asset?: RawAsset;
  anchor?: string;
  gap_x?: number;
  gap_y?: number;
  rotation?: number;
  scale?: number;
  formulas?: Record<string, string>;
}
interface RawRoom {
  type?: string;
  name?: string;
  room_type?: string;
  width?: number;
  length?: number;
  height?: number;
  items?: RawItem[];
  furniture?: { items?: RawItem[] };
}
interface RawConfig {
  floors?: Array<{ objects?: RawRoom[] }>;
}

// The room CATEGORY: the native `type` (room_type) if declared, else the id convention
// `<type>_<variant>` -> `<type>` (strip a trailing `_<variant>`), matching the
// floor-planner's build-room-layouts derivation.
export function roomTypeOf(room: RawRoom): string {
  if (room.room_type) return room.room_type;
  return String(room.name ?? "").replace(/_[a-z0-9]+$/i, "");
}

// A gap can arrive as a plain number OR as a constant formula: the WDL generator emits a
// negative literal as `formulas.gap_x = "= -38"`, leaving the plain field 0. Honour the
// formula so a layout matches what expandRoomWalls actually draws (else every negative
// offset — the -x/-y side of a centred cluster — silently collapses to 0). Mirrors
// floor-planner/scripts/build-room-layouts.mjs.
function gapVal(it: RawItem, axis: "x" | "y"): number | undefined {
  const f = it.formulas?.[`gap_${axis}`];
  if (f != null) {
    const n = Number(String(f).replace(/^\s*=\s*/, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return it[`gap_${axis}` as "gap_x" | "gap_y"];
}

function itemToPiece(it: RawItem): Piece | null {
  const dims = it.asset?.dimensions;
  if (!it.asset || !Array.isArray(dims)) return null; // skip a malformed/asset-less item
  // Preserve the WHOLE asset (src + correction fields), not a subset — the 3D renderer
  // needs `src` (the GLB URL) to draw the real mesh instead of a bounding-box placeholder.
  const asset = { ...it.asset, id: it.asset.id ?? "", dimensions: dims } as unknown as FurnitureAsset;
  const p: Piece = { asset, anchor: it.anchor ?? "center" };
  const gx = gapVal(it, "x");
  const gy = gapVal(it, "y");
  if (gx != null) p.gap_x = gx;
  if (gy != null) p.gap_y = gy;
  if (it.rotation != null) p.rotation = it.rotation;
  if (it.scale != null) p.scale = it.scale;
  return p;
}

// The furniture pieces of a room: its `furniture` container body, or its plain `items`.
function roomPieces(room: RawRoom): Piece[] {
  const items = room.furniture?.items ?? room.items ?? [];
  return items.map(itemToPiece).filter((p): p is Piece => p !== null);
}

// One template room -> a Layout. `w`/`l` is the layout's TARGET size (the smallest room it
// was designed to fill); `height` carries a template's optional room-level wall height.
export function layoutFromRoom(room: RawRoom): Layout {
  const layout: Layout = {
    id: String(room.name ?? ""),
    type: roomTypeOf(room),
    w: room.width ?? 0,
    l: room.length ?? 0,
    pieces: roomPieces(room),
  };
  if (room.height != null) layout.height = room.height;
  return layout;
}

// Every template room in a compiled + resolved layout pack -> `Layout[]`. Pass a RESOLVED
// config (compileDsl + resolveParametric) so room sizes are numbers; item gap formulas are
// read directly (gapVal) because the resolver leaves those on the item.
export function configToLayouts(cfg: RawConfig): Layout[] {
  const out: Layout[] = [];
  for (const floor of cfg.floors ?? []) {
    for (const o of floor.objects ?? []) {
      if (o.type === "room") out.push(layoutFromRoom(o));
    }
  }
  return out;
}
