// Pitched roof v2 derivation — unifies classical gable + hip.
//
// Each leaf endpoint of each segment carries an endpoint style:
//   "open"   → covered by a vertical gable-end wall triangle
//   "closed" → covered by a sloped hip-face triangle
// A single roof can mix them (dutch gable). Joint endpoints ignore
// the style; joint resolution (Step 6) handles those.
//
// Ridge placement per endpoint:
//   OPEN  → ridge extends past the segment endpoint by
//           gable_overhang_{start|end} (default 0).
//   CLOSED → ridge stops inward by hip_setback_{start|end}
//           (default seg.width/2, i.e. an equal-pitch pyramid hip).
//           Legacy compat: adapter fills this from
//           trusses.positions[0] / alongLen - positions[-1].
//
// Eave drop / overhang follows the legacy hip pipeline exactly:
//   dCrit    = min(width/2, hipSetbackStart if closed, hipSetbackEnd if closed)
//   eaveDrop = (min_overhang · ridge_h) / dCrit
//   oCross   = (min_overhang · width/2)         / dCrit
//   oStart   = closed ? (min_overhang · hipSetbackStart) / dCrit
//                     : gable_overhang_start
//   oEnd     = closed ? (min_overhang · hipSetbackEnd)   / dCrit
//                     : gable_overhang_end
// This preserves parity with legacy `deriveHipRoofGeometry` /
// `deriveGableRoofGeometry` for single-segment configs.

import type {
  EndpointStyle,
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
  resolveEndpoints,
  ringBeamMembersForRect,
  segmentLeftNormal,
  segmentLength,
  segmentRect,
  segmentUnitVector,
} from "./segments";

export interface DerivePitchedOptions {
  wallTopZ: number;
  defaultMinOverhang?: number;      // default 20
  defaultEndpoint?: EndpointStyle;  // cfg-level fallback if not on cfg
}

function resolveRise(slope: SlopeSpec | undefined, crossHalf: number): number {
  if (!slope) throw new Error("pitched: slope spec required");
  if (slope.by === "height") return slope.ridge_h;
  return crossHalf * Math.tan((slope.angle_deg * Math.PI) / 180);
}

function to3D(pt: Point2D, z: number): Point3D {
  return [pt[0], pt[1], z];
}

// Point offset from `pt` along `unit` by `distance`.
function shift(pt: Point2D, unit: Point2D, distance: number): Point2D {
  return [pt[0] + unit[0] * distance, pt[1] + unit[1] * distance];
}

export function derivePitchedRoof(
  cfg: RoofConfig,
  opts: DerivePitchedOptions,
): RoofSpec {
  if (cfg.roof_type !== "pitched") {
    throw new Error(`derivePitchedRoof: expected roof_type="pitched", got "${cfg.roof_type}"`);
  }
  const roofMinOverhang = cfg.min_overhang ?? opts.defaultMinOverhang ?? 20;
  if (!(roofMinOverhang > 0)) {
    throw new Error("pitched: min_overhang must be > 0");
  }
  // Per-segment override falls back to the roof-level value.
  const overhangFor = (seg: RoofSegment): number =>
    seg.min_overhang ?? roofMinOverhang;
  const defaultEndpoint: EndpointStyle =
    cfg.default_endpoint ?? opts.defaultEndpoint ?? "closed";

  const planes: RoofPlane[] = [];
  const members: StraightMember[] = [];
  const trusses: TrussTriangle[] = [];
  const endpoints = resolveEndpoints(cfg.segments);

  // FIRST PASS — compute each segment's per-hip constraint and take
  // the MIN across the whole roof as the "global dCrit". This makes
  // all segments share the same eaveZ + eaveDrop so multi-segment
  // roofs (L, U, courtyard) have their eaves line up at the outer
  // inside corners. Without this, wings with different widths
  // produce different eaveZ → visible gap at the trimmed joints.
  let globalDCrit = Infinity;
  for (const seg of cfg.segments) {
    if (segmentLength(seg) === 0) continue;
    const halfC = seg.width / 2;
    const startIsLeafG = isLeafEndpoint(endpoints, seg.id, "start");
    const endIsLeafG = isLeafEndpoint(endpoints, seg.id, "end");
    const startResG = !startIsLeafG
      ? "joint"
      : (seg.start_endpoint ?? defaultEndpoint);
    const endResG = !endIsLeafG
      ? "joint"
      : (seg.end_endpoint ?? defaultEndpoint);
    const hipSbS = startResG === "closed" ? (seg.hip_setback_start ?? halfC) : 0;
    const hipSbE = endResG === "closed" ? (seg.hip_setback_end ?? halfC) : 0;
    const d: number[] = [halfC];
    if (startResG === "closed") d.push(hipSbS);
    if (endResG === "closed") d.push(hipSbE);
    const segDCrit = Math.min(...d);
    if (segDCrit > 0 && segDCrit < globalDCrit) globalDCrit = segDCrit;
  }
  if (!Number.isFinite(globalDCrit)) globalDCrit = 0;   // no valid segments

  for (const seg of cfg.segments) {
    const alongLen = segmentLength(seg);
    if (alongLen === 0) continue;

    const crossHalf = seg.width / 2;
    const slope = seg.slope_override ?? cfg.slope;
    const ridgeH = resolveRise(slope, crossHalf);
    if (!(ridgeH > 0)) {
      throw new Error(`pitched segment ${seg.id}: rise must be > 0`);
    }
    // Per-segment min_overhang override (falls back to roof-level).
    const minOverhang = overhangFor(seg);

    // Endpoint resolution. Three states — leaf endpoints follow the
    // per-segment or roof-level style; joint endpoints are their own
    // state (no endcap, no ridge trim — the ridge extends to the
    // joint apex so it connects with the neighbour's ridge).
    type EndpointResolution = "open" | "closed" | "joint";
    const startIsLeaf = isLeafEndpoint(endpoints, seg.id, "start");
    const endIsLeaf = isLeafEndpoint(endpoints, seg.id, "end");
    const startRes: EndpointResolution = !startIsLeaf
      ? "joint"
      : (seg.start_endpoint ?? defaultEndpoint);
    const endRes: EndpointResolution = !endIsLeaf
      ? "joint"
      : (seg.end_endpoint ?? defaultEndpoint);

    // Hip setbacks (only used for closed leaf endpoints). Joints do
    // NOT trim — the ridge runs to the segment endpoint.
    const hipSetbackStart =
      startRes === "closed" ? (seg.hip_setback_start ?? crossHalf) : 0;
    const hipSetbackEnd =
      endRes === "closed" ? (seg.hip_setback_end ?? crossHalf) : 0;

    // Gable overhangs (only for open leaf endpoints). Default to
    // min_overhang so a plain gable end has an eave overhang
    // matching the side eaves — the architectural convention. Set
    // to 0 explicitly to disable.
    const gableOverhangStart =
      startRes === "open" ? (seg.gable_overhang_start ?? minOverhang) : 0;
    const gableOverhangEnd =
      endRes === "open" ? (seg.gable_overhang_end ?? minOverhang) : 0;

    // Use the ROOF-level global dCrit (min across all segments) so
    // multi-segment configs share the same eaveZ. For a single-
    // segment roof this equals the segment's own dCrit.
    const dCrit = globalDCrit;
    if (!(dCrit > 0)) {
      throw new Error(`pitched segment ${seg.id}: dCrit=${dCrit} — hip setbacks must be > 0`);
    }

    const eaveDrop = (minOverhang * ridgeH) / dCrit;
    const eaveZ = opts.wallTopZ - eaveDrop;
    const ridgeZ = opts.wallTopZ + ridgeH;

    const oCross = (minOverhang * crossHalf) / dCrit;
    // Along overhang: closed hips derive it from the hip pitch,
    // open gables use gable_overhang, joints get 0 (the neighbour
    // provides the roof coverage past this endpoint).
    const oStart =
      startRes === "closed"
        ? (minOverhang * hipSetbackStart) / dCrit
        : startRes === "open"
          ? gableOverhangStart
          : 0;
    const oEnd =
      endRes === "closed"
        ? (minOverhang * hipSetbackEnd) / dCrit
        : endRes === "open"
          ? gableOverhangEnd
          : 0;

    const unit = segmentUnitVector(seg);           // along direction
    const leftN = segmentLeftNormal(seg);          // perpendicular, left
    const rightN: Point2D = [-leftN[0], -leftN[1]];

    // Eave outline corners (extended past the segment endpoints).
    const startBase = shift(seg.start, unit, -oStart);
    const endBase = shift(seg.end, unit, +oEnd);
    const backLeft = shift(startBase, leftN, crossHalf + oCross);   // BL
    const backRight = shift(startBase, rightN, crossHalf + oCross); // BR
    const frontLeft = shift(endBase, leftN, crossHalf + oCross);    // FL
    const frontRight = shift(endBase, rightN, crossHalf + oCross);  // FR

    // Ridge endpoints (on the segment centreline, at ridgeZ).
    //   closed → trim inward by hip_setback
    //   open   → extend past by gable_overhang
    //   joint  → run to the segment endpoint (no trim, no extension)
    const ridgeStart2D: Point2D =
      startRes === "closed"
        ? shift(seg.start, unit, +hipSetbackStart)
        : startRes === "open"
          ? shift(seg.start, unit, -gableOverhangStart)
          : seg.start;
    const ridgeEnd2D: Point2D =
      endRes === "closed"
        ? shift(seg.end, unit, -hipSetbackEnd)
        : endRes === "open"
          ? shift(seg.end, unit, +gableOverhangEnd)
          : seg.end;
    const ridgeStart3D = to3D(ridgeStart2D, ridgeZ);
    const ridgeEnd3D = to3D(ridgeEnd2D, ridgeZ);

    // Two slope planes. Winding: CCW when viewed from OUTSIDE the roof
    // (i.e. from above and to the side of the slope).
    planes.push({
      id: `${seg.id}.slope.left`,
      vertices: [
        to3D(backLeft, eaveZ),
        ridgeStart3D,
        ridgeEnd3D,
        to3D(frontLeft, eaveZ),
      ],
      role: "slope",
      source_segment_id: seg.id,
      side_of_segment: "left",
      rafter_direction: normaliseVec3([
        backLeft[0] - ridgeStart2D[0],
        backLeft[1] - ridgeStart2D[1],
        eaveZ - ridgeZ,
      ]),
      purlin_direction: [unit[0], unit[1], 0],
    });
    planes.push({
      id: `${seg.id}.slope.right`,
      vertices: [
        to3D(backRight, eaveZ),
        to3D(frontRight, eaveZ),
        ridgeEnd3D,
        ridgeStart3D,
      ],
      role: "slope",
      source_segment_id: seg.id,
      side_of_segment: "right",
      rafter_direction: normaliseVec3([
        backRight[0] - ridgeStart2D[0],
        backRight[1] - ridgeStart2D[1],
        eaveZ - ridgeZ,
      ]),
      purlin_direction: [unit[0], unit[1], 0],
    });

    // Ridge member. For CLOSED endpoints, the ridge MEMBER may
    // extend PAST the hip apex by `hip_ridge_extension_*` (a flying
    // ridge for ventilation). The hip face plane + hip diagonals
    // still meet at the true apex — only the ridge line extends.
    const ridgeExtStart =
      startRes === "closed" ? (seg.hip_ridge_extension_start ?? 0) : 0;
    const ridgeExtEnd =
      endRes === "closed" ? (seg.hip_ridge_extension_end ?? 0) : 0;
    const ridgeMemberStart: Point3D =
      ridgeExtStart > 0
        ? [
            ridgeStart2D[0] - unit[0] * ridgeExtStart,
            ridgeStart2D[1] - unit[1] * ridgeExtStart,
            ridgeZ,
          ]
        : ridgeStart3D;
    const ridgeMemberEnd: Point3D =
      ridgeExtEnd > 0
        ? [
            ridgeEnd2D[0] + unit[0] * ridgeExtEnd,
            ridgeEnd2D[1] + unit[1] * ridgeExtEnd,
            ridgeZ,
          ]
        : ridgeEnd3D;
    members.push({
      id: `${seg.id}.ridge`,
      start: ridgeMemberStart,
      end: ridgeMemberEnd,
      role: "ridge",
      source_segment_id: seg.id,
    });

    // Vent struts — when the ridge extends past a hip apex, brace
    // the flying ridge tip with 2 diagonal struts angling down to
    // the two hip diagonals at distance `ext` from the apex.
    // Matches legacy `R1' / R2'` bracing.
    const emitVentStruts = (
      ridgeTip: Point3D,
      apex: Point3D,
      hipLeftEnd: Point3D,     // hip diagonal apex → left eave corner
      hipRightEnd: Point3D,    // hip diagonal apex → right eave corner
      ext: number,
      endName: "start" | "end",
    ) => {
      if (ext <= 0) return;
      const strutEnd = (hipEnd: Point3D): Point3D => {
        const len = Math.hypot(
          hipEnd[0] - apex[0], hipEnd[1] - apex[1], hipEnd[2] - apex[2],
        );
        if (len < 1e-6) return apex;
        const t = Math.min(1, ext / len);
        return [
          apex[0] + (hipEnd[0] - apex[0]) * t,
          apex[1] + (hipEnd[1] - apex[1]) * t,
          apex[2] + (hipEnd[2] - apex[2]) * t,
        ];
      };
      members.push({
        id: `${seg.id}.vent_strut.${endName}.left`,
        start: ridgeTip, end: strutEnd(hipLeftEnd),
        role: "vent_strut", source_segment_id: seg.id,
      });
      members.push({
        id: `${seg.id}.vent_strut.${endName}.right`,
        start: ridgeTip, end: strutEnd(hipRightEnd),
        role: "vent_strut", source_segment_id: seg.id,
      });
    };
    if (startRes === "closed" && ridgeExtStart > 0) {
      // Hip diagonals at start: from apex (ridgeStart3D) to backLeft
      // and backRight eave corners. Struts angle down to those hip
      // diagonals; we brace them at distance `ridgeExtStart` from apex.
      emitVentStruts(
        ridgeMemberStart, ridgeStart3D,
        to3D(backLeft, eaveZ), to3D(backRight, eaveZ),
        ridgeExtStart, "start",
      );
    }
    if (endRes === "closed" && ridgeExtEnd > 0) {
      emitVentStruts(
        ridgeMemberEnd, ridgeEnd3D,
        to3D(frontLeft, eaveZ), to3D(frontRight, eaveZ),
        ridgeExtEnd, "end",
      );
    }

    // Ring beam — 4 members around the segment rectangle at wall_top_z.
    // Multi-segment configs get one ring per segment; Step 6 will
    // trim members that lie on shared edges between adjacent segments.
    const rect = segmentRect(seg);
    for (const rb of ringBeamMembersForRect(rect, opts.wallTopZ, seg.id)) {
      members.push(rb);
    }

    // Endcaps. Only leaf endpoints get them; joints are handled by
    // resolveJoints (Step 6b).
    if (startIsLeaf) {
      if (startRes === "open") {
        // Vertical gable wall at the SEGMENT ENDPOINT (not extended
        // by overhang — the wall itself sits at the wall line).
        const wallLeft = shift(seg.start, leftN, crossHalf);
        const wallRight = shift(seg.start, rightN, crossHalf);
        const apexAtWall: Point3D = [seg.start[0], seg.start[1], ridgeZ];
        planes.push({
          id: `${seg.id}.gable_wall.start`,
          vertices: [
            to3D(wallRight, opts.wallTopZ),
            to3D(wallLeft, opts.wallTopZ),
            apexAtWall,
          ],
          role: "gable_wall",
          source_segment_id: seg.id,
          side_of_segment: "start",
        });
      } else {
        // Closed → hip triangle at the START endpoint.
        planes.push({
          id: `${seg.id}.hip_face.start`,
          vertices: [
            to3D(backRight, eaveZ),
            to3D(backLeft, eaveZ),
            ridgeStart3D,
          ],
          role: "hip_face",
          source_segment_id: seg.id,
          side_of_segment: "start",
        });
        members.push({
          id: `${seg.id}.hip.start.left`,
          start: ridgeStart3D,
          end: to3D(backLeft, eaveZ),
          role: "hip",
          source_segment_id: seg.id,
        });
        members.push({
          id: `${seg.id}.hip.start.right`,
          start: ridgeStart3D,
          end: to3D(backRight, eaveZ),
          role: "hip",
          source_segment_id: seg.id,
        });
      }
    }

    if (endIsLeaf) {
      if (endRes === "open") {
        const wallLeft = shift(seg.end, leftN, crossHalf);
        const wallRight = shift(seg.end, rightN, crossHalf);
        const apexAtWall: Point3D = [seg.end[0], seg.end[1], ridgeZ];
        planes.push({
          id: `${seg.id}.gable_wall.end`,
          vertices: [
            to3D(wallLeft, opts.wallTopZ),
            to3D(wallRight, opts.wallTopZ),
            apexAtWall,
          ],
          role: "gable_wall",
          source_segment_id: seg.id,
          side_of_segment: "end",
        });
      } else {
        planes.push({
          id: `${seg.id}.hip_face.end`,
          vertices: [
            to3D(frontLeft, eaveZ),
            to3D(frontRight, eaveZ),
            ridgeEnd3D,
          ],
          role: "hip_face",
          source_segment_id: seg.id,
          side_of_segment: "end",
        });
        members.push({
          id: `${seg.id}.hip.end.left`,
          start: ridgeEnd3D,
          end: to3D(frontLeft, eaveZ),
          role: "hip",
          source_segment_id: seg.id,
        });
        members.push({
          id: `${seg.id}.hip.end.right`,
          start: ridgeEnd3D,
          end: to3D(frontRight, eaveZ),
          role: "hip",
          source_segment_id: seg.id,
        });
      }
    }

    // Eave border elements — pani patti (GI water strip) + eave
    // L-channel run along the OUTER eave edges at eave_z. Corner
    // double angles ride each hip diagonal (2 pieces per hip).
    //
    // Eave-level members (pani_patti, eave_L_channel, corner_double_angle)
    // are emitted face-based post-trim in populateEaveMembers(), so
    // they follow the final (possibly extended-past-joint or trimmed)
    // face polygon edges instead of the raw segment rectangle.

    // Trusses. Positions are 'along' distances from segment.start.
    const segTrussEntry = cfg.trusses?.find((t) => t.segment_id === seg.id);
    if (segTrussEntry) {
      for (let ti = 0; ti < segTrussEntry.positions_along.length; ti++) {
        const along = segTrussEntry.positions_along[ti];
        const apex2D = interpolatePoint(seg, along);
        const leftBase = shift(apex2D, leftN, crossHalf);
        const rightBase = shift(apex2D, rightN, crossHalf);
        trusses.push({
          id: `${seg.id}.truss.${ti}`,
          bottom_left: to3D(leftBase, opts.wallTopZ),
          bottom_right: to3D(rightBase, opts.wallTopZ),
          apex: to3D(apex2D, ridgeZ),
          source_segment_id: seg.id,
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

export interface PitchedFootprint {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  eave_z: number;
  ridge_z: number;
}

// Collect the aggregate footprint of all slope planes for a given
// segment (or across all segments if segmentId omitted).
export function pitchedSlopeFootprint(
  spec: RoofSpec,
  segmentId?: string,
): PitchedFootprint | null {
  const slopes = spec.planes.filter(
    (p) => p.role === "slope" && (!segmentId || p.source_segment_id === segmentId),
  );
  if (slopes.length === 0) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const p of slopes) {
    for (const v of p.vertices) {
      xs.push(v[0]); ys.push(v[1]); zs.push(v[2]);
    }
  }
  return {
    x_min: Math.min(...xs),
    x_max: Math.max(...xs),
    y_min: Math.min(...ys),
    y_max: Math.max(...ys),
    eave_z: Math.min(...zs),
    ridge_z: Math.max(...zs),
  };
}

// Extract the ridge member for a segment.
export function pitchedRidge(
  spec: RoofSpec,
  segmentId?: string,
): StraightMember | undefined {
  return spec.members.find(
    (m) => m.role === "ridge" && (!segmentId || m.source_segment_id === segmentId),
  );
}
