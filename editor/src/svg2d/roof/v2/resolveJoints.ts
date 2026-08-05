// Joint resolution for RoofSpec.
//
// After each roof-type derivation runs, adjacent segments that share
// an endpoint form a JOINT. Joints need extra members (valley / hip)
// to describe how the two roof surfaces intersect. Slope-plane
// trimming (making the planes actually stop at the valley/hip line)
// is Step 6c; this file handles member emission only.
//
// Supports:
//   - pitched-pitched binary joints (ridges meet at joint apex;
//     valley or hip runs from apex down to inside corner)
//   - shed-shed binary joints (planes intersect on a diagonal; hip
//     when both high edges meet at inside corner, valley when both
//     low edges meet)
//
// Deferred: pitched-shed / pitched-flat cross-type joints; 3+
// segment multi-joints (Y/T junctions).

import type {
  Point2D,
  Point3D,
  RoofConfig,
  RoofSegment,
  RoofSpec,
  StraightMember,
} from "./model";
import {
  interpolatePoint,
  offsetLine,
  resolveEndpoints,
  segmentLength,
  segmentLeftNormal,
  segmentUnitVector,
} from "./segments";

export interface ResolveJointsOptions {
  wallTopZ: number;
  ridgeZ: number;  // wall_top + ridge_h (same across roof for now)
  // Shed-only: used to compute plane Z at arbitrary XY points.
  ridgeH?: number;
  minOverhang?: number;
  defaultShedHighSide?: "left" | "right";
}

// Intersect two lines defined by point + direction in 2D.
// Returns null when the lines are parallel.
function intersectLines(
  p1: Point2D, d1: Point2D,
  p2: Point2D, d2: Point2D,
): Point2D | null {
  const denom = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(denom) < 1e-12) return null;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const t = (dx * d2[1] - dy * d2[0]) / denom;
  return [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
}

// Dot product 2D.
function dot(a: Point2D, b: Point2D): number {
  return a[0] * b[0] + a[1] * b[1];
}

// Given a segment endpoint at the joint, and the OTHER segment,
// determine which side of this segment (left or right) is "inside"
// — i.e. faces the other segment's rectangle. Returned as ±1 to
// multiply against leftNormal (or -leftNormal for right).
function insideSideMultiplier(
  seg: { start: Point2D; end: Point2D; width: number },
  other: { start: Point2D; end: Point2D },
): 1 | -1 {
  // Midpoint of the other segment.
  const otherMid: Point2D = [
    (other.start[0] + other.end[0]) / 2,
    (other.start[1] + other.end[1]) / 2,
  ];
  // Vector from this segment's midpoint to other's midpoint.
  const segMid: Point2D = [
    (seg.start[0] + seg.end[0]) / 2,
    (seg.start[1] + seg.end[1]) / 2,
  ];
  const v: Point2D = [otherMid[0] - segMid[0], otherMid[1] - segMid[1]];
  // segmentLeftNormal expects a RoofSegment-shaped object; pass a
  // minimal struct.
  const leftN = segmentLeftNormal({ id: "_", ...seg });
  return dot(v, leftN) >= 0 ? 1 : -1;
}

// True iff `pt` is inside the axis-aligned bounding box of the given
// rectangle corners (INCLUSIVE — boundary counts). The inside-corner
// of a valley sits exactly on both rectangles' boundaries by
// construction, so strict inequality would misclassify it.
function pointInsideRectBBox(
  pt: Point2D,
  corners: readonly Point2D[],
  eps = 1e-6,
): boolean {
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const [x, y] of corners) {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  return pt[0] >= xMin - eps && pt[0] <= xMax + eps &&
         pt[1] >= yMin - eps && pt[1] <= yMax + eps;
}

// Convenience: 4 corners of segment.rectangle without dragging in
// segmentRect (avoids a circular-import risk).
function rectCorners(seg: { start: Point2D; end: Point2D; width: number }): Point2D[] {
  const half = seg.width / 2;
  const right = offsetLine({ id: "_", ...seg }, -half);
  const left = offsetLine({ id: "_", ...seg }, +half);
  return [right.start, right.end, left.end, left.start];
}

// Resolve every binary joint in the config's segment list. Emits
// valley (or hip) StraightMembers into `spec.members`.
export function resolveJoints(
  cfg: RoofConfig,
  spec: RoofSpec,
  opts: ResolveJointsOptions,
): RoofSpec {
  if (cfg.roof_type !== "pitched" && cfg.roof_type !== "shed") {
    // Flat roofs form a unified polygon — no valley/hip members
    // needed. Cross-type joints (pitched-shed etc.) are Phase 2.
    return spec;
  }

  const endpoints = resolveEndpoints(cfg.segments);
  const outMembers: StraightMember[] = [...spec.members];
  const outPlanes = spec.planes.map((p) => ({ ...p }));
  let jointIdx = 0;

  for (const entry of endpoints) {
    if (!entry.isJoint) continue;
    if (entry.refs.length !== 2) continue;   // multi-joints deferred

    const [refA, refB] = entry.refs;
    const segA = cfg.segments.find((s) => s.id === refA.segmentId);
    const segB = cfg.segments.find((s) => s.id === refB.segmentId);
    if (!segA || !segB) continue;
    if (segmentLength(segA) === 0 || segmentLength(segB) === 0) continue;

    const uA = segmentUnitVector(segA);
    const uB = segmentUnitVector(segB);
    const cross = uA[0] * uB[1] - uA[1] * uB[0];
    if (Math.abs(cross) < 1e-9) continue;   // collinear → straight continuation

    const insideA = insideSideMultiplier(segA, segB);
    const insideB = insideSideMultiplier(segB, segA);
    const wallA = offsetLine(segA, insideA * segA.width / 2);
    const wallB = offsetLine(segB, insideB * segB.width / 2);
    const corner = intersectLines(wallA.start, uA, wallB.start, uB);
    if (!corner) continue;

    let joint: JointResult | null = null;
    if (cfg.roof_type === "pitched") {
      joint = resolvePitchedJoint({
        segA, segB, insideA, insideB, corner, jointPoint: entry.point, opts,
      });
    } else {
      joint = resolveShedJoint({
        cfg, segA, segB, insideA, corner, jointPoint: entry.point, opts,
      });
    }
    if (!joint) continue;

    // For pitched VALLEY joints: the valley member should extend
    // from the ridge apex down to the inside-eave corner (where the
    // two slopes actually meet, at eave Z), not just to the wall
    // corner at wall-top Z. Trim direction is unaffected (inside
    // wall corner and inside eave corner lie on the same 45°
    // line from apex), only the visible valley length changes.
    if (joint.kind === "valley" && cfg.roof_type === "pitched") {
      const sideAInside = insideA === +1 ? "left" : "right";
      const sideBInside = insideB === +1 ? "left" : "right";
      const slopeAIn = outPlanes.find(
        (p) => p.source_segment_id === segA.id
          && p.side_of_segment === sideAInside
          && p.role === "slope",
      );
      const slopeBIn = outPlanes.find(
        (p) => p.source_segment_id === segB.id
          && p.side_of_segment === sideBInside
          && p.role === "slope",
      );
      if (slopeAIn && slopeBIn) {
        const eaveHalfA = outerEaveHalfWidth(slopeAIn, segA);
        const eaveHalfB = outerEaveHalfWidth(slopeBIn, segB);
        if (eaveHalfA != null && eaveHalfB != null) {
          const eaveLineA = offsetLine(segA, insideA * eaveHalfA);
          const eaveLineB = offsetLine(segB, insideB * eaveHalfB);
          const eaveCorner = intersectLines(
            eaveLineA.start, uA, eaveLineB.start, uB,
          );
          if (eaveCorner) {
            const eaveZ = Math.min(
              ...slopeAIn.vertices.map((v) => v[2]),
              ...slopeBIn.vertices.map((v) => v[2]),
            );
            joint.base = [eaveCorner[0], eaveCorner[1], eaveZ];
          }
        }
      }
    }

    const jointId = `joint.${jointIdx}.${joint.kind}`;
    outMembers.push({
      id: jointId,
      start: joint.apex,
      end: joint.base,
      role: joint.kind,
      source_segment_id: `${segA.id}+${segB.id}`,
    });

    // Annotate joint-facing slopes.
    const sideA = insideA === +1 ? "left" : "right";
    const sideB = insideB === +1 ? "left" : "right";
    for (const p of outPlanes) {
      if (
        (p.source_segment_id === segA.id && p.side_of_segment === sideA) ||
        (p.source_segment_id === segB.id && p.side_of_segment === sideB)
      ) {
        p.joint_edges = [...(p.joint_edges ?? []), jointId];
      }
    }

    // OUTSIDE-CORNER handling — for L-shape joints (valley kind),
    // the two wings' OUTSIDE slopes need to extend past the joint
    // apex to meet at the outside corner. Otherwise there's an open
    // triangular gap in the roof at the convex corner.
    //
    // We: (1) compute the outside corner from the intersection of
    // the two wings' outer eave lines, (2) emit an outside HIP
    // member from apex to that corner, (3) extend both outside
    // slope polygons to include the outside-corner vertex.
    if (joint.kind === "valley" && cfg.roof_type === "pitched") {
      const sideAOutside = insideA === +1 ? "right" : "left";
      const sideBOutside = insideB === +1 ? "right" : "left";
      const slopeAOut = outPlanes.find(
        (p) => p.source_segment_id === segA.id
          && p.side_of_segment === sideAOutside
          && p.role === "slope",
      );
      const slopeBOut = outPlanes.find(
        (p) => p.source_segment_id === segB.id
          && p.side_of_segment === sideBOutside
          && p.role === "slope",
      );
      if (slopeAOut && slopeBOut) {
        const outerHalfA = outerEaveHalfWidth(slopeAOut, segA);
        const outerHalfB = outerEaveHalfWidth(slopeBOut, segB);
        if (outerHalfA != null && outerHalfB != null) {
          const outWallA = offsetLine(segA, -insideA * outerHalfA);
          const outWallB = offsetLine(segB, -insideB * outerHalfB);
          const outsideCorner = intersectLines(
            outWallA.start, uA, outWallB.start, uB,
          );
          if (outsideCorner) {
            const eaveZ = Math.min(
              ...slopeAOut.vertices.map((v) => v[2]),
              ...slopeBOut.vertices.map((v) => v[2]),
            );
            const outsideCorner3D: Point3D = [
              outsideCorner[0], outsideCorner[1], eaveZ,
            ];
            const outsideJointId = `joint.${jointIdx}.outside_hip`;
            outMembers.push({
              id: outsideJointId,
              start: joint.apex,
              end: outsideCorner3D,
              role: "hip",
              source_segment_id: `${segA.id}+${segB.id}`,
            });
            // Extend outside slope polygons: replace the joint-end
            // outer corner vertex with the outside corner. The
            // extended eave forms the "ring" around the outside
            // perimeter (via face-based pani_patti / eave_L_channel).
            slopeAOut.vertices = replaceJointEndCorner(
              slopeAOut.vertices, segA, entry.point, insideA, outsideCorner3D,
            );
            slopeBOut.vertices = replaceJointEndCorner(
              slopeBOut.vertices, segB, entry.point, insideB, outsideCorner3D,
            );
          }
        }
      }
    }
    jointIdx++;
  }
  return { ...spec, members: outMembers, planes: outPlanes };
}

// From a slope plane's vertices, find the perpendicular distance
// from segment centerline to the eave line. This is halfW + oCross
// (with any hip setback / global dCrit already baked in).
function outerEaveHalfWidth(
  plane: { vertices: Point3D[] },
  seg: RoofSegment,
): number | null {
  if (plane.vertices.length === 0) return null;
  const ridgeZ = Math.max(...plane.vertices.map((v) => v[2]));
  const eaveZ = Math.min(...plane.vertices.map((v) => v[2]));
  if (ridgeZ - eaveZ < 0.1) return null;
  const eaveVerts = plane.vertices.filter(
    (v) => Math.abs(v[2] - eaveZ) < 0.1,
  );
  if (eaveVerts.length === 0) return null;
  const leftN = segmentLeftNormal(seg);
  const v = eaveVerts[0];
  return Math.abs(
    (v[0] - seg.start[0]) * leftN[0] + (v[1] - seg.start[1]) * leftN[1],
  );
}

// Replace the polygon vertex nearest to the joint-end outer corner
// with the outside-corner point. The joint end is whichever endpoint
// (segment.start or segment.end) matches `jointPoint`; the "outer"
// corner on that end is the one on the OUTSIDE side (opposite of
// inside).
function replaceJointEndCorner(
  verts: Point3D[],
  seg: RoofSegment,
  jointPoint: Point2D,
  inside: 1 | -1,
  outsideCorner: Point3D,
): Point3D[] {
  const distToStart = Math.hypot(
    jointPoint[0] - seg.start[0], jointPoint[1] - seg.start[1],
  );
  const distToEnd = Math.hypot(
    jointPoint[0] - seg.end[0], jointPoint[1] - seg.end[1],
  );
  const jointAtEnd = distToEnd < distToStart;
  const jointXY: Point2D = jointAtEnd ? seg.end : seg.start;
  // The joint-end outer corner has:
  //   - Same "along" position as jointXY (i.e. offset = 0 along
  //     segment direction from jointXY).
  //   - Perpendicular offset on the OUTSIDE side.
  // We identify it by proximity in XY to jointXY plus the OUTSIDE
  // half-width along -inside*leftN.
  const leftN = segmentLeftNormal(seg);
  const unit = segmentUnitVector(seg);
  const eaveZ = Math.min(...verts.map((v2) => v2[2]));
  // The joint-end OUTER eave corner is the eave-level vertex that is
  // (a) on the OUTSIDE side of the centerline and (b) at the JOINT end
  // of the segment — i.e. its projection ALONG the segment direction
  // (measured from the joint point) is ~0. The FAR eave corner sits a
  // full segment-length away along that axis. Picking by min |along|
  // is robust; the earlier residual-vs-diagonal heuristic mis-selected
  // the far corner on longer segments, producing a twisted slope quad.
  let bestIdx = -1;
  let bestAlong = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    if (Math.abs(v[2] - eaveZ) > 0.1) continue;   // eave-level only
    // Perpendicular signed distance from segment centerline.
    const perpSigned = (v[0] - seg.start[0]) * leftN[0]
                    + (v[1] - seg.start[1]) * leftN[1];
    // Outside side has sign = -inside (opposite of inside).
    if (Math.sign(perpSigned) !== -inside) continue;
    // Distance along the segment axis from the joint end (~0 at the
    // joint-end corner, ~segment length at the far corner).
    const along = Math.abs(
      (v[0] - jointXY[0]) * unit[0] + (v[1] - jointXY[1]) * unit[1],
    );
    if (along < bestAlong) {
      bestAlong = along;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return verts;
  const next = [...verts];
  next[bestIdx] = outsideCorner;
  return next;
}

interface JointResult {
  apex: Point3D;
  base: Point3D;
  kind: "valley" | "hip";
}

interface PitchedArgs {
  segA: RoofSegment;
  segB: RoofSegment;
  insideA: 1 | -1;
  insideB: 1 | -1;
  corner: Point2D;
  jointPoint: Point2D;
  opts: ResolveJointsOptions;
}

// Pitched-pitched — ridges meet at joint apex; valley/hip runs from
// apex down to inside corner at wall_top_z.
function resolvePitchedJoint(args: PitchedArgs): JointResult | null {
  const insideRectA = pointInsideRectBBox(args.corner, rectCorners(args.segA));
  const insideRectB = pointInsideRectBBox(args.corner, rectCorners(args.segB));
  const kind: "valley" | "hip" = insideRectA || insideRectB ? "valley" : "hip";
  return {
    apex: [args.jointPoint[0], args.jointPoint[1], args.opts.ridgeZ],
    base: [args.corner[0], args.corner[1], args.opts.wallTopZ],
    kind,
  };
}

interface ShedArgs {
  cfg: RoofConfig;
  segA: RoofSegment;
  segB: RoofSegment;
  insideA: 1 | -1;
  corner: Point2D;
  jointPoint: Point2D;
  opts: ResolveJointsOptions;
}

// Shed-shed — compute plane Z at the inside corner and at the joint
// segment endpoint for BOTH sheds. If both agree on the corner Z
// (i.e. their planes are aligned there), emit a member from
// corner-Z-3D to joint-endpoint-Z-3D. Classify:
//   corner_z > endpoint_z → HIP (roof folds down away from corner)
//   corner_z < endpoint_z → VALLEY (water pools at corner)
//
// If the two sheds' planes don't agree at the corner (within eps),
// the design is architecturally invalid — warn and skip the member.
function resolveShedJoint(args: ShedArgs): JointResult | null {
  const { cfg, segA, segB, corner, jointPoint, opts } = args;
  const zA_corner = shedZAt(cfg, segA, corner, opts);
  const zB_corner = shedZAt(cfg, segB, corner, opts);
  if (zA_corner === null || zB_corner === null) return null;

  if (Math.abs(zA_corner - zB_corner) > 0.1) {
    console.warn(
      `[shed joint] planes disagree at inside corner (${corner[0]},${corner[1]}): ` +
      `A=${zA_corner.toFixed(2)} B=${zB_corner.toFixed(2)}. Skipping joint member.`,
    );
    return null;
  }

  const cornerZ = (zA_corner + zB_corner) / 2;
  const endpointZA = shedZAt(cfg, segA, jointPoint, opts);
  const endpointZB = shedZAt(cfg, segB, jointPoint, opts);
  if (endpointZA === null || endpointZB === null) return null;
  const endpointZ = (endpointZA + endpointZB) / 2;

  const kind: "valley" | "hip" = cornerZ > endpointZ ? "hip" : "valley";
  return {
    apex: [corner[0], corner[1], cornerZ],
    base: [jointPoint[0], jointPoint[1], endpointZ],
    kind,
  };
}

// Compute the Z of a shed's slope plane at an arbitrary XY point
// on the segment centreline's coordinate system. Returns null if
// the point is far outside the segment's rectangle (couldn't be on
// the shed plane sensibly).
function shedZAt(
  cfg: RoofConfig,
  seg: RoofSegment,
  pt: Point2D,
  opts: ResolveJointsOptions,
): number | null {
  const slope = seg.slope_override ?? cfg.slope;
  if (!slope) return null;
  const highSide = seg.shed_high_side ?? opts.defaultShedHighSide ?? "left";
  const run = seg.width;
  const rise = slope.by === "height"
    ? slope.ridge_h
    : run * Math.tan((slope.angle_deg * Math.PI) / 180);

  // Perpendicular distance from segment centreline to pt (signed;
  // positive = LEFT of segment).
  const leftN = segmentLeftNormal(seg);
  const dx = pt[0] - seg.start[0];
  const dy = pt[1] - seg.start[1];
  const perpSigned = dx * leftN[0] + dy * leftN[1];

  // Distance from the LOW edge along the perpendicular axis.
  // LOW edge is at -w/2 on the low side. If highSide="left":
  //   low is at -w/2 relative to leftN (right side), so signed low = -w/2.
  //   distance from low = perpSigned - (-w/2) = perpSigned + w/2
  // If highSide="right":
  //   low is at +w/2 (left side), so signed low = +w/2.
  //   distance from low = w/2 - perpSigned
  const distFromLow = highSide === "left"
    ? perpSigned + run / 2
    : run / 2 - perpSigned;
  // Fraction along the slope: 0 = at low edge, 1 = at high edge.
  const frac = distFromLow / run;
  return opts.wallTopZ + frac * rise;
}

// Helper for the join-time consumer — a lot of callers already have
// wallTopZ + slope and want to compute ridgeZ once. Re-derives it
// from cfg.slope + (average width if per-segment differ).
export function ridgeZFromConfig(
  cfg: RoofConfig,
  wallTopZ: number,
): number {
  // Angle-based: pick average width across segments as reference.
  const widths = cfg.segments.map((s) => s.width);
  const meanHalf = widths.length ? (widths.reduce((a, b) => a + b, 0) / widths.length) / 2 : 0;
  // Tangent of a slope spec at the reference half-width (height → atan(h/half)).
  const tanOf = (s: { by: string; angle_deg?: number; ridge_h?: number }): number =>
    s.by === "height" ? (s.ridge_h ?? 0) / (meanHalf || 1) : Math.tan(((s.angle_deg ?? 0) * Math.PI) / 180);
  if (cfg.slope) {
    if (cfg.slope.by === "height") return wallTopZ + cfg.slope.ridge_h;
    return wallTopZ + meanHalf * Math.tan((cfg.slope.angle_deg * Math.PI) / 180);
  }
  // Per-side (asymmetric) pitch: no `slope`, but slope_left+slope_right. Same
  // ridge rise as derivePitched: H = width·tanL·tanR/(tanL+tanR), width = 2·half.
  if (cfg.slope_left && cfg.slope_right && meanHalf > 0) {
    const tL = tanOf(cfg.slope_left), tR = tanOf(cfg.slope_right);
    if (tL > 0 && tR > 0) return wallTopZ + (2 * meanHalf * tL * tR) / (tL + tR);
  }
  throw new Error("ridgeZFromConfig: cfg.slope (or slope_left + slope_right) required");
}

// Test helper — return members added by resolveJoints. Filtered by
// ID prefix (`joint.`) rather than role, since `role: "hip"` is
// also used for endpoint hip diagonals emitted by derivePitched.
export function jointMembers(
  spec: RoofSpec,
  role?: "valley" | "hip",
): StraightMember[] {
  return spec.members.filter(
    (m) => m.id.startsWith("joint.") && (!role || m.role === role),
  );
}

// Kept for symmetry with segments.ts; interpolatePoint isn't used
// in this file yet but will be needed once we start trimming slope
// planes to sub-segment ranges (Step 6c).
void interpolatePoint;
