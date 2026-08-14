// Shed (mono-pitch) roof v2 derivation.
//
// Per Design decision #10 + the plan's shed pseudocode:
//   - Segment sits at the centreline of the roof width.
//   - `shed_high_side` names which side of the segment is HIGH.
//     If "left" → high edge = offsetLine(seg, +w/2); low = -w/2.
//     If "right" → high = offsetLine(seg, -w/2);     low = +w/2.
//   - Overhang extends outward BOTH perpendicular (past low + high
//     eaves) and along the segment (past both endpoints).
//   - Low eave outer edge dips below wall_top_z by
//         eaveDrop = (min_overhang · rise) / run
//     where run = seg.width. High eave outer edge rises the same
//     amount past wall_top + rise.
//   - Open leaf endpoints emit a triangular gable_wall infill
//     spanning from wall_top_z at the low corner up to
//     wall_top_z + rise at the high corner (interior wall closes
//     the open end).

import type {
  Point2D,
  Point3D,
  RoofConfig,
  RoofPlane,
  RoofSegment,
  RoofSpec,
  SlopeSpec,
  StraightMember,
  TrussTriangle,
} from "./model";
import {
  interpolatePoint,
  isLeafEndpoint,
  offsetLine,
  resolveEndpoints,
  ringBeamMembersForRect,
  segmentLength,
  segmentRect,
  segmentUnitVector,
} from "./segments";

export interface DeriveShedOptions {
  wallTopZ: number;
  defaultOverhang?: number;         // default 20
  defaultShedHighSide?: "left" | "right";
  // House wall thickness (project units) — default gable-wall thickness.
  wallThickness?: number;
}

function resolveRise(
  slope: SlopeSpec | undefined,
  run: number,
): number {
  if (!slope) throw new Error("shed: slope spec required (ridge_h or angle_deg)");
  if (slope.by === "height") return slope.ridge_h;
  return run * Math.tan((slope.angle_deg * Math.PI) / 180);
}

function to3D(pt: Point2D, z: number): Point3D {
  return [pt[0], pt[1], z];
}

function extendSegment(seg: RoofSegment, byStart: number, byEnd: number): RoofSegment {
  if (byStart === 0 && byEnd === 0) return seg;
  const [ux, uy] = segmentUnitVector(seg);
  return {
    ...seg,
    start: [seg.start[0] - ux * byStart, seg.start[1] - uy * byStart],
    end: [seg.end[0] + ux * byEnd, seg.end[1] + uy * byEnd],
  };
}

export function deriveShedRoof(
  cfg: RoofConfig,
  opts: DeriveShedOptions,
): RoofSpec {
  if (cfg.roof_type !== "shed") {
    throw new Error(`deriveShedRoof: expected roof_type="shed", got "${cfg.roof_type}"`);
  }
  const roofOverhang = cfg.min_overhang ?? opts.defaultOverhang ?? 20;
  if (!(roofOverhang > 0)) {
    throw new Error("shed: min_overhang must be > 0");
  }
  const defaultHigh = opts.defaultShedHighSide ?? "left";
  const roofSlope = cfg.slope;
  // Masonry gable-wall thickness (project units): roof override → house
  // wall thickness. Undefined leaves the plane thin (no extrusion).
  const gableWallThickness = cfg.gable_wall_thickness ?? opts.wallThickness;

  const planes: RoofPlane[] = [];
  const members: StraightMember[] = [];
  const trusses: TrussTriangle[] = [];
  const endpoints = resolveEndpoints(cfg.segments);

  for (const seg of cfg.segments) {
    if (segmentLength(seg) === 0) continue;

    const slope = seg.slope_override ?? roofSlope;
    const highSide = seg.shed_high_side ?? defaultHigh;
    const run = seg.width;                     // perpendicular span low → high
    const rise = resolveRise(slope, run);
    if (!(rise > 0)) {
      throw new Error(`shed segment ${seg.id}: rise must be > 0`);
    }
    // Overhang: uniform per-segment default, with optional PER-SIDE
    // overrides (start/end along the axis; low/high on the two eaves).
    const overhang = seg.min_overhang ?? roofOverhang;
    const ohStart = seg.overhang_start ?? overhang;
    const ohEnd = seg.overhang_end ?? overhang;
    const ohLow = seg.overhang_low ?? overhang;
    const ohHigh = seg.overhang_high ?? overhang;
    // Each eave's outer edge drops (low) / rises (high) proportionally to
    // ITS own overhang, so the roof plane stays planar at the given pitch.
    const eaveDropLow = (ohLow * rise) / run;
    const eaveDropHigh = (ohHigh * rise) / run;

    // High/low signed perpendicular offsets, INCLUDING each eave's overhang.
    // offsetLine sign convention: +distance = LEFT of segment.
    const highSign = highSide === "left" ? +1 : -1;
    const highOffset = highSign * (seg.width / 2 + ohHigh);
    const lowOffset = -highSign * (seg.width / 2 + ohLow);

    // Extend segment along its axis by the (per-end) along-overhang.
    const extended = extendSegment(seg, ohStart, ohEnd);
    const highEdge = offsetLine(extended, highOffset);
    const lowEdge = offsetLine(extended, lowOffset);

    const zHigh = opts.wallTopZ + rise + eaveDropHigh;
    const zLow = opts.wallTopZ - eaveDropLow;

    // Slope quad — CCW when viewed from above/outward (normal has
    // both a horizontal component perpendicular to seg and a
    // vertical component upward). Order: low.start → low.end →
    // high.end → high.start.
    planes.push({
      id: `${seg.id}.slope`,
      vertices: [
        to3D(lowEdge.start, zLow),
        to3D(lowEdge.end, zLow),
        to3D(highEdge.end, zHigh),
        to3D(highEdge.start, zHigh),
      ],
      role: "slope",
      source_segment_id: seg.id,
      side_of_segment: highSide,
      rafter_direction: normaliseVec3([
        highEdge.start[0] - lowEdge.start[0],
        highEdge.start[1] - lowEdge.start[1],
        zHigh - zLow,
      ]),
      purlin_direction: normaliseVec3([
        extended.end[0] - extended.start[0],
        extended.end[1] - extended.start[1],
        0,
      ]),
    });

    // Ridge = high edge as a linear member (top of slope).
    members.push({
      id: `${seg.id}.ridge`,
      start: to3D(highEdge.start, zHigh),
      end: to3D(highEdge.end, zHigh),
      role: "ridge",
      source_segment_id: seg.id,
    });

    const startIsLeaf = isLeafEndpoint(endpoints, seg.id, "start");
    const endIsLeaf = isLeafEndpoint(endpoints, seg.id, "end");
    const unit = segmentUnitVector(seg);
    const leftN: Point2D = [-unit[1], unit[0]];       // +90° CCW (see segmentLeftNormal)
    const highIsLeft = highSide === "left";

    // Ring beam. The two SIDE eaves get a flat member — EXCEPT the HIGH
    // eave, which rides the TOP of the high infill wall (wall_top + rise),
    // not wall_top. The raking end cross-members (`.back` = start,
    // `.front` = end) are suppressed at open (leaf) ends — the raking
    // `gable_band` carries the band up the slope there.
    const rect = segmentRect(seg);
    // Centre the ring beam on the wall (rect is grown to the outer wall face).
    for (const rb of ringBeamMembersForRect(rect, opts.wallTopZ, seg.id, (opts.wallThickness ?? 0) / 2)) {
      if (startIsLeaf && rb.id.endsWith(".back")) continue;
      if (endIsLeaf && rb.id.endsWith(".front")) continue;
      const isHighEave =
        (highIsLeft && rb.id.endsWith(".left")) ||
        (!highIsLeft && rb.id.endsWith(".right"));
      if (isHighEave) {
        members.push({
          ...rb,
          start: [rb.start[0], rb.start[1], opts.wallTopZ + rise],
          end: [rb.end[0], rb.end[1], opts.wallTopZ + rise],
        });
      } else {
        members.push(rb);
      }
    }

    // Gable-end infill for open LEAF endpoints — the two RAKING
    // triangular ends. Triangle at the wall (segment endpoint BEFORE
    // along-extension) spanning wall_top_z along the bottom and
    // following the slope on top.
    for (const which of ["start", "end"] as const) {
      if (!isLeafEndpoint(endpoints, seg.id, which)) continue;

      // Bottom corners at wall_top_z, at the WALL positions (NOT
      // extended by along-overhang; the wall itself doesn't reach
      // into the eave overhang).
      const wallHigh = offsetLine(seg, highSign * seg.width / 2);
      const wallLow = offsetLine(seg, -highSign * seg.width / 2);

      const wallCornerHigh = which === "start" ? wallHigh.start : wallHigh.end;
      const wallCornerLow = which === "start" ? wallLow.start : wallLow.end;

      // Vertices: low-corner @ wall_top, high-corner @ wall_top,
      // high-corner @ wall_top + rise. The hypotenuse (low→high@rise)
      // is the underside of the slope at this endpoint.
      planes.push({
        id: `${seg.id}.gable_wall.${which}`,
        vertices: [
          to3D(wallCornerLow, opts.wallTopZ),
          to3D(wallCornerHigh, opts.wallTopZ),
          to3D(wallCornerHigh, opts.wallTopZ + rise),
        ],
        role: "gable_wall",
        source_segment_id: seg.id,
        side_of_segment: which,
        thickness: gableWallThickness,
        // Extrude toward the interior along the segment axis.
        inward: which === "start" ? [unit[0], unit[1], 0] : [-unit[0], -unit[1], 0],
      });
      // Raking gable band along the sloped top edge of the gable
      // wall (low@wall_top → high@wall_top+rise), continuous with the
      // eave ring beam at the low corner.
      members.push({
        id: `${seg.id}.gable_band.${which}`,
        start: to3D(wallCornerLow, opts.wallTopZ),
        end: to3D(wallCornerHigh, opts.wallTopZ + rise),
        role: "gable_band",
        source_segment_id: seg.id,
      });
    }

    // HIGH-eave infill wall. On the high side the roof is `rise` above
    // wall_top, leaving an open strip between the wall below and the
    // slope. Fill it with a vertical rectangle along the high wall line
    // (wall_top → wall_top + rise).
    //
    // The raking end walls span the FULL width (including the high corner)
    // and extrude one wall-thickness inward along the axis, so they already
    // occupy the corner columns. Inset this wall's ends by that thickness at
    // each LEAF end so the two don't overlap (the raking walls own the
    // corners) — the same convention room walls use (E/W inset so N/S own
    // the corners). Joint ends (no raking wall) are not inset.
    {
      const highLine = offsetLine(seg, highSign * (seg.width / 2));
      const insStart = startIsLeaf ? (gableWallThickness ?? 0) : 0;
      const insEnd = endIsLeaf ? (gableWallThickness ?? 0) : 0;
      const hStart: Point2D = [
        highLine.start[0] + unit[0] * insStart,
        highLine.start[1] + unit[1] * insStart,
      ];
      const hEnd: Point2D = [
        highLine.end[0] - unit[0] * insEnd,
        highLine.end[1] - unit[1] * insEnd,
      ];
      // Toward the interior = opposite the high (outward) side.
      const inwardHigh: Point3D = [-highSign * leftN[0], -highSign * leftN[1], 0];
      planes.push({
        id: `${seg.id}.gable_wall.high`,
        vertices: [
          to3D(hStart, opts.wallTopZ),
          to3D(hEnd, opts.wallTopZ),
          to3D(hEnd, opts.wallTopZ + rise),
          to3D(hStart, opts.wallTopZ + rise),
        ],
        role: "gable_wall",
        source_segment_id: seg.id,
        side_of_segment: highSide,
        thickness: gableWallThickness,
        inward: inwardHigh,
      });
    }

    // Mono-pitch trusses along the segment. positions_along = distance
    // from seg.start. Each truss spans the segment's width from LOW
    // wall corner to HIGH wall corner (bottom chord), with the apex
    // directly above the HIGH corner at wall_top + rise.
    const segTrussEntry = cfg.trusses?.find((t) => t.segment_id === seg.id);
    if (segTrussEntry) {
      const highN: Point2D = highSign === +1
        ? [-segmentUnitVector(seg)[1], segmentUnitVector(seg)[0]]        // leftN
        : [segmentUnitVector(seg)[1], -segmentUnitVector(seg)[0]];       // rightN
      const lowN: Point2D = [-highN[0], -highN[1]];
      for (let ti = 0; ti < segTrussEntry.positions_along.length; ti++) {
        const along = segTrussEntry.positions_along[ti];
        const center2D = interpolatePoint(seg, along);
        const halfW = seg.width / 2;
        const lowCorner2D: Point2D = [
          center2D[0] + lowN[0] * halfW,
          center2D[1] + lowN[1] * halfW,
        ];
        const highCorner2D: Point2D = [
          center2D[0] + highN[0] * halfW,
          center2D[1] + highN[1] * halfW,
        ];
        trusses.push({
          id: `${seg.id}.truss.${ti}`,
          bottom_left: to3D(lowCorner2D, opts.wallTopZ),          // LOW wall
          bottom_right: to3D(highCorner2D, opts.wallTopZ),        // HIGH wall
          apex: to3D(highCorner2D, opts.wallTopZ + rise),         // above HIGH
          source_segment_id: seg.id,
          kind: "mono_pitch",
        });
      }
    }
  }

  return { members, planes, trusses };
}

function normaliseVec3(v: [number, number, number]): [number, number, number] {
  const m = Math.hypot(v[0], v[1], v[2]);
  return m === 0 ? [0, 0, 0] : [v[0] / m, v[1] / m, v[2] / m];
}

// Test helpers ------------------------------------------------------

export interface ShedSlopeFootprint {
  low_z: number;
  high_z: number;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

export function shedSlopeFootprint(spec: RoofSpec): ShedSlopeFootprint | null {
  const slab = spec.planes.find((p) => p.role === "slope");
  if (!slab) return null;
  const xs = slab.vertices.map((v) => v[0]);
  const ys = slab.vertices.map((v) => v[1]);
  const zs = slab.vertices.map((v) => v[2]);
  return {
    low_z: Math.min(...zs),
    high_z: Math.max(...zs),
    x_min: Math.min(...xs),
    x_max: Math.max(...xs),
    y_min: Math.min(...ys),
    y_max: Math.max(...ys),
  };
}
