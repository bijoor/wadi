// Flat roof v2 derivation. Consumes a v2 RoofConfig with
// roof_type="flat" and emits a RoofSpec. Each segment contributes
// one flat_slab plane (the segment rectangle expanded by
// min_overhang on all sides).
//
// Joint resolution (Step 6) will later merge overlapping polygons
// from adjacent flat segments. For Phase 1 each segment is
// independent — multi-segment flats overlap visually at joints.
//
// Parapet handling: if parapet_height > 0, emit four "parapet"
// planes as vertical rectangles standing on the outer edges of
// the slab. Height in project units; thickness = parapet_thickness.

import type {
  Point2D,
  Point3D,
  RoofConfig,
  RoofPlane,
  RoofSegment,
  RoofSpec,
  StraightMember,
} from "./model";
import {
  segmentLeftNormal,
  segmentLength,
  segmentRect,
  segmentUnitVector,
} from "./segments";

export interface DeriveFlatOptions {
  wallTopZ: number;
  // Fallbacks match the legacy flat_roof defaults.
  defaultOverhang?: number;      // default 5
  defaultParapetHeight?: number; // default 30
  defaultParapetThickness?: number; // default 8
}

// Build a segment that represents the eave rectangle: the original
// segment stretched by `overhang` on each end, with width increased
// by 2·overhang. Used to derive the slab rectangle in one shot.
function expandSegment(seg: RoofSegment, overhang: number): RoofSegment {
  if (overhang === 0) return seg;
  const [ux, uy] = segmentUnitVector(seg);
  const dx = ux * overhang;
  const dy = uy * overhang;
  return {
    ...seg,
    start: [seg.start[0] - dx, seg.start[1] - dy],
    end: [seg.end[0] + dx, seg.end[1] + dy],
    width: seg.width + 2 * overhang,
  };
}

function to3D(pt: Point2D, z: number): Point3D {
  return [pt[0], pt[1], z];
}

export function deriveFlatRoof(
  cfg: RoofConfig,
  opts: DeriveFlatOptions,
): RoofSpec {
  if (cfg.roof_type !== "flat") {
    throw new Error(`deriveFlatRoof: expected roof_type="flat", got "${cfg.roof_type}"`);
  }
  const overhang = cfg.min_overhang ?? opts.defaultOverhang ?? 5;
  const parapetHeight =
    cfg.parapet_height ?? opts.defaultParapetHeight ?? 30;
  const parapetThickness =
    cfg.parapet_thickness ?? opts.defaultParapetThickness ?? 8;

  // The slab surface sits AT wall-top, exactly like every other roof's eave.
  // (The legacy flat roof added the slab's own thickness here, which floated
  // the flat roof a slab-thickness above the pitched/shed/hip variants — a
  // leftover we drop so all roof types share the same reference plane.)
  const eaveZ = opts.wallTopZ;

  const planes: RoofPlane[] = [];
  const members: StraightMember[] = [];

  for (const seg of cfg.segments) {
    if (segmentLength(seg) === 0) continue;

    const expanded = expandSegment(seg, overhang);
    const [sr, er, el, sl] = segmentRect(expanded);

    // Slab plane, CCW viewed from above (outward = +Z).
    planes.push({
      id: `${seg.id}.slab`,
      vertices: [to3D(sr, eaveZ), to3D(er, eaveZ), to3D(el, eaveZ), to3D(sl, eaveZ)],
      role: "flat_slab",
      source_segment_id: seg.id,
    });

    // Optional parapet: 4 vertical rectangles around the slab perimeter.
    if (parapetHeight > 0) {
      const zBottom = eaveZ;
      const zTop = eaveZ + parapetHeight;
      // sr → er (right edge), er → el (end edge), el → sl (left edge),
      // sl → sr (start edge).
      const edges: Array<[Point2D, Point2D, "right" | "end" | "left" | "start"]> = [
        [sr, er, "right"],
        [er, el, "end"],
        [el, sl, "left"],
        [sl, sr, "start"],
      ];
      for (const [a, b, side] of edges) {
        planes.push({
          id: `${seg.id}.parapet.${side}`,
          vertices: [
            to3D(a, zBottom),
            to3D(b, zBottom),
            to3D(b, zTop),
            to3D(a, zTop),
          ],
          role: "parapet",
          source_segment_id: seg.id,
          side_of_segment: side === "right" || side === "left" ? side : side,
        });
        members.push({
          id: `${seg.id}.parapet_cap.${side}`,
          start: to3D(a, zTop),
          end: to3D(b, zTop),
          role: "parapet_cap",
          source_segment_id: seg.id,
          section_size:
            parapetThickness != null ? [parapetThickness / 10, parapetThickness / 10] : undefined,
        });
      }
    }
  }

  // Keep exports referenced so tree-shakers don't complain in the
  // near-empty parapet-off case.
  void segmentLeftNormal;

  return { members, planes, trusses: [] };
}

// Convenience helper for the parity test — derive both the legacy
// FlatRoofGeom and the v2 spec, then extract the slab footprint
// from the v2 output so callers can diff.
export function flatSlabFootprint(spec: RoofSpec): {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  z: number;
} | null {
  const slab = spec.planes.find((p) => p.role === "flat_slab");
  if (!slab) return null;
  const xs = slab.vertices.map((v) => v[0]);
  const ys = slab.vertices.map((v) => v[1]);
  return {
    x_min: Math.min(...xs),
    x_max: Math.max(...xs),
    y_min: Math.min(...ys),
    y_max: Math.max(...ys),
    z: slab.vertices[0][2],
  };
}
