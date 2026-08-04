// Room-relative furniture anchoring (pure math, no three.js / React).
//
// A furniture item can be anchored to a spot on a room's INNER footprint (a 3×3 grid
// of corners / edge-midpoints / centre) held a per-axis `gap` off it, into the room.
// The item aligns its own matching edge/corner to that spot, so e.g. a bed's headboard
// hugs the north wall, centred — and when the room is resized the anchor recomputes and
// the piece follows. Resolved at expand time into an absolute plan centre (x, y), so
// every renderer keeps reading plain x/y.
//
// Coordinate frame: world X = east (right), Y = south (down). "top" = north (smaller y),
// "bottom" = south (larger y); "left" = west, "right" = east.

import { metersToUnits } from "../three/units";

export interface RoomRect {
  x: number; // top-left corner (project units)
  y: number;
  w: number; // width (X extent)
  l: number; // length (Y extent)
}

export interface AnchorSpec {
  anchor?: string; // 9-point enum; default "center"
  gapX?: number; // per-axis inset from the anchor, into the room (project units)
  gapY?: number;
  rotation?: number; // yaw, degrees
  scale?: number; // uniform, default 1
  dimensions: [number, number, number]; // asset [w, h, d] in METRES
}

type H = "left" | "center" | "right";
type V = "top" | "center" | "bottom";

// First token = vertical, second = horizontal; "center" alone = both.
function parseAnchor(a?: string): { h: H; v: V } {
  const s = (a ?? "center").toLowerCase();
  if (s === "center") return { h: "center", v: "center" };
  const [vTok, hTok] = s.split("-");
  const v: V = vTok === "top" ? "top" : vTok === "bottom" ? "bottom" : "center";
  const h: H = hTok === "left" ? "left" : hTok === "right" ? "right" : "center";
  return { h, v };
}

// Compute the item's plan CENTRE (x, y) from the room rect + anchor spec.
// `wallT` = wall thickness (project units). The room rect edge is the wall's OUTER
// face, so the anchor rect is inset by the FULL wall thickness to reach the INNER
// wall face — furniture then hugs the visible inside surface, not the wall centerline.
// `units` = house units, to scale the asset's metric footprint into project units.
export function anchorItem(
  rect: RoomRect,
  spec: AnchorSpec,
  wallT: number,
  units?: { system?: string; per_unit?: number },
): { x: number; y: number } {
  const inset = wallT;
  const ix0 = rect.x + inset;
  const iy0 = rect.y + inset;
  const ix1 = rect.x + rect.w - inset;
  const iy1 = rect.y + rect.l - inset;

  const scale = spec.scale ?? 1;
  const fw = metersToUnits(spec.dimensions[0], units) * scale; // footprint width (X)
  const fd = metersToUnits(spec.dimensions[2], units) * scale; // footprint depth (Y)

  // Half-extents of the axis-aligned bounding box after yaw, so a rotated piece still
  // clears the wall it's anchored to.
  const th = ((spec.rotation ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(th));
  const s = Math.abs(Math.sin(th));
  const halfX = (fw / 2) * c + (fd / 2) * s;
  const halfY = (fw / 2) * s + (fd / 2) * c;

  const { h, v } = parseAnchor(spec.anchor);
  const gx = spec.gapX ?? 0;
  const gy = spec.gapY ?? 0;

  let x: number;
  if (h === "left") x = ix0 + halfX + gx;
  else if (h === "right") x = ix1 - halfX - gx;
  else x = (ix0 + ix1) / 2 + gx;

  let y: number;
  if (v === "top") y = iy0 + halfY + gy;
  else if (v === "bottom") y = iy1 - halfY - gy;
  else y = (iy0 + iy1) / 2 + gy;

  return { x, y };
}

// Default facing (yaw°) implied by an anchor: a piece anchored to a wall faces
// AWAY from that wall, into the room, per the item convention (rotation 0 =
// south, 90 = east, 180 = north, 270 = west). Used only when the item has no
// explicit `rotation` — an explicit rotation always wins. A corner anchors to two
// walls; the vertical edge (north/south) takes precedence so the rule is single-
// valued and predictable; `center` (no wall) keeps the south-facing default.
//   top → face south (0)   bottom → face north (180)
//   left → face east (90)  right → face west (270)   center → 0
export function anchorFacing(anchor?: string): number {
  const { h, v } = parseAnchor(anchor);
  if (v === "top") return 0;
  if (v === "bottom") return 180;
  if (h === "left") return 90;
  if (h === "right") return 270;
  return 0;
}
