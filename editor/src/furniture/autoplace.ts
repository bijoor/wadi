// Furniture auto-placement engine (plans/room-templates-in-wadi.md, Part 1).
//
// A pure port of the floor-planner's furnitureFit.js + roomModules.js, rewired onto
// the app's REAL geometry (`anchorItem` from svg2d/furnitureAnchor.ts) instead of the
// planner's mirror. Two jobs, both pure (no I/O):
//
//   A. Orientation — a layout authored for a portrait room can be rotated 90° to fill a
//      landscape one; rotation also moves furniture onto different walls so the picker can
//      dodge doors. `rotateLayoutCW` turns the whole arrangement as one.
//   C. Door-position-aware placement — a piece conflicts only when its actual footprint
//      overlaps a door OPENING on its wall (not merely "that wall has a door"). `placePieces`
//      SLIDES a piece along its wall to the nearest clear spot, dropping it only when none
//      exists. `pickLayout` then keeps the arrangement that survives placement most fully.
//
// Anti-drift vs the planner mirror: position comes from the canonical `anchorItem`, the
// footprint scales via the canonical `metersToUnits`, and the AABB rotation is resolved as
// `piece.rotation ?? anchorFacing(anchor)` — exactly what expand.ts does before it renders —
// so a side/corner piece with implicit facing gets the SAME footprint here and at render
// (the old rotation bug came from those two disagreeing).

import { anchorItem, anchorFacing, type RoomRect } from "../svg2d/furnitureAnchor";
import { metersToUnits } from "../three/units";

const CLEAR = 2; // units of slack: a piece within CLEAR of an opening counts as overlapping

export type Side = "north" | "south" | "east" | "west";
export type Interval = [number, number];
export type SideIntervals = Partial<Record<Side, Interval[]>>;
export type Units = { system?: string; per_unit?: number };

// A furniture asset. The engine reads only `dimensions` (the footprint), but the WHOLE
// asset must survive placement into the config — `src` (the GLB URL) and the correction
// fields (offset/corrRotation/corrScale) are what the 3D renderer needs to draw the real
// mesh; dropping them leaves only a bounding-box placeholder. So this carries the known
// fields plus an index signature for the rest, and the loader passes the asset through
// verbatim rather than rebuilding a subset.
export interface FurnitureAsset {
  id: string;
  name?: string;
  src?: string;
  dimensions: [number, number, number]; // metres
  [key: string]: unknown;
}

// A furniture piece in a layout, and the shape emitted into a room's furniture body.
export interface Piece {
  name?: string;
  asset: FurnitureAsset;
  anchor: string; // 9-point enum
  gap_x?: number;
  gap_y?: number;
  rotation?: number; // explicit yaw°; absent = anchorFacing(anchor)
  scale?: number;
}

// A room-type layout from the template pack. `w`/`l` is the TARGET size (the smallest room
// the arrangement was designed to fill); `height` is an optional room-level wall height a
// template may carry (out of scope here — the engine only places furniture, but it passes
// `height` through so a caller could apply it).
export interface Layout {
  id: string;
  type: string;
  w: number; // target width (X extent, project units)
  l: number; // target length (Y extent, project units)
  height?: number;
  pieces: Piece[];
  rotated?: boolean;
}

// The room being furnished. `rect`/`wallT`/`units`/`doorIntervals` enable geometry-aware
// placement (C); without them the picker falls back to a coarse wall-level door count.
export interface PlaceContext {
  rect?: RoomRect; // { x, y, w, l }
  wallT?: number;
  units?: Units;
  doorIntervals?: SideIntervals; // hard — pieces are shifted/dropped off these
  gapIntervals?: SideIntervals; // soft — tie-breaker only, never shifts/drops a piece
  openSides?: Set<Side> | Side[]; // coarse fallback: walls that carry a door/gap
  w?: number; // room width for the fit filter (defaults to rect.w)
  l?: number; // room length for the fit filter (defaults to rect.l)
}

// The engine's output for one placed piece — maps directly to the schema's roomItem.
export interface PlacedItem {
  name: string;
  asset: FurnitureAsset;
  anchor: string;
  gap_x?: number;
  gap_y?: number;
  rotation?: number;
  scale?: number;
}

// ---- anchors -----------------------------------------------------------------------

type H = "left" | "center" | "right";
type V = "top" | "center" | "bottom";

// First token = vertical, second = horizontal; "center" alone = both. Mirrors
// furnitureAnchor.parseAnchor (kept private there).
function parseAnchor(a?: string): { h: H; v: V } {
  const s = String(a ?? "center").toLowerCase();
  if (s === "center") return { h: "center", v: "center" };
  const [vTok, hTok] = s.split("-");
  const v: V = vTok === "top" ? "top" : vTok === "bottom" ? "bottom" : "center";
  const h: H = hTok === "left" ? "left" : hTok === "right" ? "right" : "center";
  return { h, v };
}

// The wall(s) an anchor touches: top=north, bottom=south, left=west, right=east; `center`
// touches none (freestanding, never conflicts with a wall's door).
export function occupiedWalls(anchor: string): Side[] {
  const { h, v } = parseAnchor(anchor);
  const w: Side[] = [];
  if (v === "top") w.push("north");
  if (v === "bottom") w.push("south");
  if (h === "left") w.push("west");
  if (h === "right") w.push("east");
  return w;
}

// ---- A: orientation ----------------------------------------------------------------

// Where each anchor lands after rotating the layout 90° clockwise (x east, y south).
const ANCHOR_CW: Record<string, string> = {
  "top-left": "top-right",
  "top-center": "center-right",
  "top-right": "bottom-right",
  "center-right": "bottom-center",
  "bottom-right": "bottom-left",
  "bottom-center": "center-left",
  "bottom-left": "top-left",
  "center-left": "top-center",
  center: "center",
};

// Rotate one piece 90° CW. Gaps are anchor-relative insets, so convert to an absolute
// east/south offset, rotate that vector ((e,s)->(-s,e)), then convert back to the new
// anchor's inset convention. Facing turns with the piece; we always set it EXPLICITLY
// because an anchor's derived facing does not rotate consistently for corners.
export function rotatePieceCW(p: Piece): Piece {
  const { h, v } = parseAnchor(p.anchor);
  const gx = p.gap_x ?? 0;
  const gy = p.gap_y ?? 0;
  const east = h === "right" ? -gx : gx;
  const south = v === "bottom" ? -gy : gy;
  const east2 = -south;
  const south2 = east;
  const na = ANCHOR_CW[p.anchor] || "center";
  const { h: nh, v: nv } = parseAnchor(na);
  const ngx = nh === "right" ? -east2 : east2;
  const ngy = nv === "bottom" ? -south2 : south2;
  const eff = p.rotation != null ? p.rotation : anchorFacing(p.anchor);
  const out: Piece = { ...p, anchor: na, rotation: (((eff + 270) % 360) + 360) % 360 };
  if (ngx) out.gap_x = ngx;
  else delete out.gap_x;
  if (ngy) out.gap_y = ngy;
  else delete out.gap_y;
  return out;
}

// A layout rotated 90° CW: target w/l swap, every piece rotates. `rotated` marks it.
export function rotateLayoutCW(layout: Layout): Layout {
  return {
    ...layout,
    w: layout.l,
    l: layout.w,
    pieces: (layout.pieces || []).map(rotatePieceCW),
    rotated: true,
  };
}

// Candidate arrangements: all FOUR rotations (0/90/180/270). A furniture-free layout has
// nothing to rotate.
function orientationsOf(layout: Layout): Layout[] {
  if (!layout.pieces || !layout.pieces.length) return [layout];
  const out = [layout];
  let cur = layout;
  for (let i = 0; i < 3; i++) {
    cur = rotateLayoutCW(cur);
    out.push(cur);
  }
  return out;
}

// ---- C: door-position-aware placement ----------------------------------------------

interface Box {
  x: number;
  y: number;
  halfX: number;
  halfY: number;
}

// A piece's plan centre + AABB half-extents. Position comes from the canonical `anchorItem`
// (so it can never drift from what the pipeline draws); the half-extents are the same AABB
// `anchorItem` computes internally, recomputed here because it returns only { x, y }. Both
// use the RESOLVED rotation (`piece.rotation ?? anchorFacing(anchor)`) — the fix for the
// planner mirror's rotation bug.
function pieceBox(piece: Piece, rect: RoomRect, wallT: number, units?: Units): Box {
  const rotation = piece.rotation != null ? piece.rotation : anchorFacing(piece.anchor);
  const scale = piece.scale ?? 1;
  const dim = piece.asset?.dimensions ?? [0, 0, 0];
  const { x, y } = anchorItem(
    rect,
    { anchor: piece.anchor, gapX: piece.gap_x, gapY: piece.gap_y, rotation, scale, dimensions: dim },
    wallT,
    units,
  );
  const fw = metersToUnits(dim[0], units) * scale;
  const fd = metersToUnits(dim[2], units) * scale;
  const th = (rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(th));
  const s = Math.abs(Math.sin(th));
  const halfX = (fw / 2) * c + (fd / 2) * s;
  const halfY = (fw / 2) * s + (fd / 2) * c;
  return { x, y, halfX, halfY };
}

// A piece's axis-aligned plan footprint (project units) — the box it occupies, with the
// rotation-resolved half-extents. Useful for a 2D overlay and for validating placement.
export function pieceFootprint(
  piece: Piece,
  rect: RoomRect,
  wallT: number,
  units?: Units,
): { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; halfX: number; halfY: number } {
  const b = pieceBox(piece, rect, wallT, units);
  return { x0: b.x - b.halfX, y0: b.y - b.halfY, x1: b.x + b.halfX, y1: b.y + b.halfY, cx: b.x, cy: b.y, halfX: b.halfX, halfY: b.halfY };
}

// Does `piece` overlap a door opening on a wall it sits on? `doorsBySide[side]` is a list of
// [lo,hi] opening intervals along that wall (absolute X for north/south, absolute Y for
// east/west).
function pieceHitsDoor(piece: Piece, rect: RoomRect, wallT: number, units: Units | undefined, doorsBySide: SideIntervals): boolean {
  for (const side of occupiedWalls(piece.anchor)) {
    const doors = doorsBySide[side];
    if (!doors || !doors.length) continue;
    const box = pieceBox(piece, rect, wallT, units);
    const horiz = side === "north" || side === "south";
    const lo = horiz ? box.x - box.halfX : box.y - box.halfY;
    const hi = horiz ? box.x + box.halfX : box.y + box.halfY;
    if (doors.some(([d0, d1]) => hi > d0 - CLEAR && lo < d1 + CLEAR)) return true;
  }
  return false;
}

// How many pieces of a layout land on an opening (precise; the C score).
export function doorOverlapCount(pieces: Piece[], rect: RoomRect, wallT: number, units: Units | undefined, doorsBySide: SideIntervals): number {
  let n = 0;
  for (const p of pieces || []) if (pieceHitsDoor(p, rect, wallT, units, doorsBySide)) n++;
  return n;
}

// Free sub-ranges of [lo,hi] not covered by any obstacle interval (interval subtraction).
function subtractIntervals(lo: number, hi: number, obstacles: Interval[]): Interval[] {
  const obs = obstacles
    .map(([a, b]) => [Math.max(a, lo), Math.min(b, hi)] as Interval)
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0]);
  const free: Interval[] = [];
  let cur = lo;
  for (const [a, b] of obs) {
    if (a > cur) free.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (cur < hi) free.push([cur, hi]);
  return free;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Return `piece` with its gap set so its along-wall centre lands at `center` (the other axis
// is untouched). Inverts the anchor math in pieceBox for the moved axis.
function withAlongCenter(piece: Piece, side: Side, center: number, aHalf: number, rect: RoomRect, wallT: number): Piece {
  const { h, v } = parseAnchor(piece.anchor);
  const out: Piece = { ...piece };
  if (side === "north" || side === "south") {
    const ix0 = rect.x + wallT;
    const ix1 = rect.x + rect.w - wallT;
    const gx = h === "left" ? center - ix0 - aHalf : h === "right" ? ix1 - aHalf - center : center - (ix0 + ix1) / 2;
    out.gap_x = round1(gx);
  } else {
    const iy0 = rect.y + wallT;
    const iy1 = rect.y + rect.l - wallT;
    const gy = v === "top" ? center - iy0 - aHalf : v === "bottom" ? iy1 - aHalf - center : center - (iy0 + iy1) / 2;
    out.gap_y = round1(gy);
  }
  return out;
}

// Try to slide one piece along each door-carrying wall it sits on so its footprint clears the
// opening, staying inside the room and off the other openings and the `others` pieces. Returns
// the moved piece, or null if no clear spot exists on some blocked wall (then it's dropped).
function shiftClear(piece: Piece, others: Piece[], rect: RoomRect, wallT: number, units: Units | undefined, doorsBySide: SideIntervals): Piece | null {
  let p = piece;
  for (const side of occupiedWalls(piece.anchor)) {
    const doors = doorsBySide[side];
    if (!doors || !doors.length) continue;
    const horiz = side === "north" || side === "south";
    const box = pieceBox(p, rect, wallT, units);
    const aCenter = horiz ? box.x : box.y;
    const aHalf = horiz ? box.halfX : box.halfY;
    const cLo = horiz ? box.y - box.halfY : box.x - box.halfX;
    const cHi = horiz ? box.y + box.halfY : box.x + box.halfX;
    const innerLo = horiz ? rect.x + wallT : rect.y + wallT;
    const innerHi = horiz ? rect.x + rect.w - wallT : rect.y + rect.l - wallT;
    const lo = innerLo + aHalf;
    const hi = innerHi - aHalf;
    if (lo > hi) return null; // the piece can't sit on this wall at all
    // Center-exclusion zones: each door, and each other piece sharing this lane, grown by our
    // half-extent + clearance. PAD keeps landing on a zone edge (after rounding) clear.
    const PAD = CLEAR + 1;
    const obstacles: Interval[] = doors.map(([d0, d1]) => [d0 - aHalf - PAD, d1 + aHalf + PAD]);
    for (const o of others) {
      const ob = pieceBox(o, rect, wallT, units);
      const oc0 = horiz ? ob.y - ob.halfY : ob.x - ob.halfX;
      const oc1 = horiz ? ob.y + ob.halfY : ob.x + ob.halfX;
      if (Math.min(cHi, oc1) - Math.max(cLo, oc0) <= CLEAR) continue; // not in our lane
      const oa0 = horiz ? ob.x - ob.halfX : ob.y - ob.halfY;
      const oa1 = horiz ? ob.x + ob.halfX : ob.y + ob.halfY;
      obstacles.push([oa0 - aHalf - PAD, oa1 + aHalf + PAD]);
    }
    const blocked = (c: number) => obstacles.some(([o0, o1]) => c > o0 + 1e-6 && c < o1 - 1e-6);
    if (aCenter >= lo - 1e-6 && aCenter <= hi + 1e-6 && !blocked(aCenter)) continue; // already clear
    const free = subtractIntervals(lo, hi, obstacles);
    if (!free.length) return null;
    let bestC: number | null = null;
    let bestD = Infinity;
    for (const [f0, f1] of free) {
      const c = Math.max(f0, Math.min(aCenter, f1));
      const d = Math.abs(c - aCenter);
      if (d < bestD) {
        bestD = d;
        bestC = c;
      }
    }
    if (bestC == null) return null;
    p = withAlongCenter(p, side, bestC, aHalf, rect, wallT);
  }
  return p;
}

// Place a layout's pieces clear of the door openings: a piece on an opening is SLID along its
// wall to the nearest clear spot; only if it can't clear is it dropped. Pieces are handled in
// order, each seeing the ones already placed (at their new spots) plus the rest (at their
// authored spots) as obstacles.
export function placePieces(pieces: Piece[], rect: RoomRect, wallT: number, units: Units | undefined, doorsBySide: SideIntervals): Piece[] {
  const result: Piece[] = [];
  const all = pieces || [];
  for (let i = 0; i < all.length; i++) {
    const others = result.concat(all.slice(i + 1));
    const placed = shiftClear(all[i], others, rect, wallT, units, doorsBySide);
    if (placed) result.push(placed);
  }
  return result;
}

// True when we have enough context to score/carve by real geometry (else the coarse fallback).
// `units` is INTENTIONALLY not required — it is optional metadata (a config with no `units`
// defaults to feet_inches / per_unit 10, and metersToUnits applies that default), so requiring
// it here silently disabled door-aware placement for any unit-less config: the furniture was
// dropped in raw, overlapping the doors. Geometry needs the rect, the wall thickness, and the
// door intervals; the footprint scale comes from `units` OR its default.
export function canPlaceByGeometry(ctx: PlaceContext): boolean {
  return !!(ctx && ctx.rect && ctx.wallT != null && ctx.doorIntervals);
}

// ---- layout selection --------------------------------------------------------------

const area = (l: Layout): number => (l.w || 0) * (l.l || 0);

// Coarse fallback score (no room geometry): how many pieces sit on a wall that carries a
// door/gap, whether or not their footprint actually reaches the opening.
function conflictCount(layout: Layout, openSides: Set<Side>): number {
  let n = 0;
  for (const p of layout.pieces) for (const wall of occupiedWalls(p.anchor)) if (openSides.has(wall)) n++;
  return n;
}

// Does a layout's target size fit inside a room of w x l? A furniture-free layout always fits.
const FIT_TOL = 1;
function fits(layout: Layout, w?: number, l?: number): boolean {
  if (!layout.pieces || layout.pieces.length === 0) return true;
  if (!w || !l) return true; // unknown room size: don't filter by size
  return (layout.w || 0) <= w + FIT_TOL && (layout.l || 0) <= l + FIT_TOL;
}

// Pick the arrangement for a typed room: among the layouts of its type (each in all four
// rotations) that FIT the room, the one that KEEPS THE MOST furniture after door placement,
// then the fewest soft-gap overlaps, then the fuller target, then pool order. Falls back to
// the coarse wall-level door count when room geometry is missing. Returns the chosen (possibly
// rotated) layout, or null for a plain / too-small room.
export function pickLayout(layouts: Layout[], roomType: string, ctx: PlaceContext = {}): Layout | null {
  const options = (layouts || []).filter((l) => l.type === roomType);
  if (!options.length) return null;
  const open = ctx.openSides instanceof Set ? ctx.openSides : new Set(ctx.openSides || []);
  const useGeom = canPlaceByGeometry(ctx);
  const fitW = ctx.w ?? ctx.rect?.w;
  const fitL = ctx.l ?? ctx.rect?.l;

  const pool: Layout[] = [];
  for (const l of options) for (const c of orientationsOf(l)) if (fits(c, fitW, fitL)) pool.push(c);
  if (!pool.length) return null;

  if (!useGeom) {
    let best = pool[0];
    let bestScore = conflictCount(pool[0], open);
    for (let i = 1; i < pool.length; i++) {
      const s = conflictCount(pool[i], open);
      if (s < bestScore || (s === bestScore && area(pool[i]) > area(best))) {
        best = pool[i];
        bestScore = s;
      }
    }
    return best;
  }

  const rect = ctx.rect as RoomRect;
  const wallT = ctx.wallT as number;
  const key = (c: Layout) => {
    const placed = placePieces(c.pieces, rect, wallT, ctx.units, ctx.doorIntervals ?? {});
    return {
      kept: placed.length,
      gaps: doorOverlapCount(placed, rect, wallT, ctx.units, ctx.gapIntervals ?? {}),
      a: area(c),
    };
  };
  let best = pool[0];
  let bk = key(best);
  for (let i = 1; i < pool.length; i++) {
    const c = pool[i];
    const k = key(c);
    if (
      k.kept > bk.kept ||
      (k.kept === bk.kept && k.gaps < bk.gaps) ||
      (k.kept === bk.kept && k.gaps === bk.gaps && k.a > bk.a)
    ) {
      best = c;
      bk = k;
    }
  }
  return best;
}

function piecesToItems(pieces: Piece[]): PlacedItem[] {
  return pieces.map((p, i) => {
    const it: PlacedItem = {
      name: `${p.asset.name || p.asset.id}${i ? " " + (i + 1) : ""}`,
      asset: p.asset,
      anchor: p.anchor,
    };
    if (p.gap_x != null) it.gap_x = p.gap_x;
    if (p.gap_y != null) it.gap_y = p.gap_y;
    if (p.rotation != null) it.rotation = p.rotation;
    if (p.scale != null) it.scale = p.scale;
    return it;
  });
}

export interface AutoplaceResult {
  items: PlacedItem[];
  height?: number;
  template: string | null;
  rotated: boolean;
}

// Auto-furnish one typed room: pick the best-fitting arrangement, place its pieces clear of the
// doors (geometry-aware when the context has room geometry), and return the surviving pieces as
// anchored items ready to write into the room's furniture body. `height` is the chosen layout's
// optional room-level wall height, passed through for a caller that wants it (the engine itself
// only places furniture — see the plan's furniture-only scope).
export function autoplaceRoom(layouts: Layout[], roomType: string, ctx: PlaceContext = {}): AutoplaceResult {
  const layout = pickLayout(layouts, roomType, ctx);
  if (!layout) return { items: [], height: undefined, template: null, rotated: false };
  let pieces = layout.pieces;
  if (canPlaceByGeometry(ctx)) {
    pieces = placePieces(pieces, ctx.rect as RoomRect, ctx.wallT as number, ctx.units, ctx.doorIntervals ?? {});
  }
  return { items: piecesToItems(pieces), height: layout.height, template: layout.id, rotated: !!layout.rotated };
}

// ---- opening intervals -------------------------------------------------------------

// A flattened opening as `expandRoomWalls` produces it (svg2d/expand.ts): absolute plan x/y,
// width, and the wall it faces. The engine reads only these fields.
export interface FlatOpening {
  type: string; // "door" | "window" | "gap"
  x: number;
  y: number;
  width: number;
  direction: Side;
}

// Group a room's expanded openings into per-side intervals for the placement engine: door
// intervals are HARD (pieces shift/drop off them), gap intervals are SOFT (tie-breaker only).
// The interval runs along the wall axis in absolute plan coords — X for north/south, Y for
// east/west — matching pieceBox. Windows are ignored (furniture may sit under a window).
export function openingIntervals(openings: FlatOpening[]): { doorIntervals: SideIntervals; gapIntervals: SideIntervals } {
  const doorIntervals: SideIntervals = {};
  const gapIntervals: SideIntervals = {};
  for (const op of openings || []) {
    if (op.type !== "door" && op.type !== "gap") continue;
    const horiz = op.direction === "north" || op.direction === "south";
    const start = horiz ? op.x : op.y;
    const interval: Interval = [start, start + op.width];
    const target = op.type === "door" ? doorIntervals : gapIntervals;
    (target[op.direction] ||= []).push(interval);
  }
  return { doorIntervals, gapIntervals };
}
