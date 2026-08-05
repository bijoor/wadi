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
  // House wall thickness (project units). Used as the default gable-wall
  // thickness when the roof config doesn't override it.
  wallThickness?: number;
}

function resolveRise(slope: SlopeSpec | undefined, crossHalf: number): number {
  if (!slope) throw new Error("pitched: slope spec required");
  if (slope.by === "height") return slope.ridge_h;
  return crossHalf * Math.tan((slope.angle_deg * Math.PI) / 180);
}

// Pitch angle (radians) of a slope spec. A per-side spec given by HEIGHT is read
// as a symmetric ridge over crossHalf (angle = atan(ridge_h / crossHalf)) — the
// only sensible reading, since the two sides share ONE ridge line.
function slopeAngleRad(spec: SlopeSpec, crossHalf: number): number {
  if (spec.by === "angle") return (spec.angle_deg * Math.PI) / 180;
  return Math.atan(spec.ridge_h / crossHalf);
}

// Resolve a segment's pitch. When BOTH per-side slopes are set (asymmetric
// gable), the two eaves stay put and the ridge shifts across the width: given
// target angles αL, αR over the full width w, ridge height H = w·tanL·tanR /
// (tanL+tanR) and the left run = H/tanL, so the ridge sits `crossHalf − leftRun`
// off the centreline toward the left eave. Otherwise fall back to the symmetric
// `slope`. Returns the ridge rise, the cross-shift (+ = toward the left eave, by
// the segment's left normal), and each side's pitch tangent (for planar eaves).
function resolvePitch(
  seg: RoofSegment,
  cfg: RoofConfig,
  crossHalf: number,
): { ridgeH: number; ridgeShift: number; leftPitchTan: number; rightPitchTan: number } {
  const left = seg.slope_left_override ?? cfg.slope_left;
  const right = seg.slope_right_override ?? cfg.slope_right;
  if (left && right) {
    const tanL = Math.tan(slopeAngleRad(left, crossHalf));
    const tanR = Math.tan(slopeAngleRad(right, crossHalf));
    // A half-configured pair (blank angle from the form → NaN) or a degenerate
    // angle (≤0° / ≥90°) falls back to the symmetric slope rather than breaking
    // the whole roof.
    if (tanL > 0 && tanR > 0) {
      const width = 2 * crossHalf;
      const ridgeH = (width * tanL * tanR) / (tanL + tanR);
      const leftRun = ridgeH / tanL;
      return { ridgeH, ridgeShift: crossHalf - leftRun, leftPitchTan: tanL, rightPitchTan: tanR };
    }
  }
  const ridgeH = resolveRise(seg.slope_override ?? cfg.slope, crossHalf);
  const t = ridgeH / crossHalf;
  return { ridgeH, ridgeShift: 0, leftPitchTan: t, rightPitchTan: t };
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
  // Masonry gable-wall thickness (project units): roof override → house
  // wall thickness. Undefined leaves the plane thin (no extrusion).
  const gableWallThickness = cfg.gable_wall_thickness ?? opts.wallThickness;

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
    // Pitch — symmetric `slope`, or an asymmetric per-side pair that shifts the
    // ridge across the width (ridgeShift, applied via leftN below).
    const { ridgeH, ridgeShift, leftPitchTan, rightPitchTan } = resolvePitch(seg, cfg, crossHalf);
    const asym = ridgeShift !== 0;
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
    // to 0 explicitly to disable. `overhang_start`/`overhang_end` are
    // unified aliases (the same keyword shed uses); the more specific
    // `gable_overhang_*` wins if both are set.
    const gableOverhangStart =
      startRes === "open"
        ? (seg.gable_overhang_start ?? seg.overhang_start ?? minOverhang)
        : 0;
    const gableOverhangEnd =
      endRes === "open"
        ? (seg.gable_overhang_end ?? seg.overhang_end ?? minOverhang)
        : 0;

    // Use the ROOF-level global dCrit (min across all segments) so
    // multi-segment configs share the same eaveZ. For a single-
    // segment roof this equals the segment's own dCrit.
    const dCrit = globalDCrit;
    if (!(dCrit > 0)) {
      throw new Error(`pitched segment ${seg.id}: dCrit=${dCrit} — hip setbacks must be > 0`);
    }

    const ridgeZ = opts.wallTopZ + ridgeH;

    // Per-eave overhang (left/right of the ridge). Each defaults to the uniform
    // min_overhang → with no override eaveZLeft==eaveZRight==the old shared eaveZ,
    // so existing roofs are unchanged. A larger eave overhang extends that eave
    // further out (oCross) AND drops its outer edge (eaveDrop) along the same
    // pitch, keeping the slope planar. (Single-segment roofs only — see model.ts.)
    const ohLeft = seg.overhang_left ?? minOverhang;
    const ohRight = seg.overhang_right ?? minOverhang;
    // Asymmetric: each eave extends horizontally by its overhang and drops along
    // THAT side's pitch (keeps the plane planar with the shifted ridge). Symmetric:
    // the legacy multi-segment formula (dCrit is the shared global constraint).
    const eaveZLeft = asym
      ? opts.wallTopZ - ohLeft * leftPitchTan
      : opts.wallTopZ - (ohLeft * ridgeH) / dCrit;
    const eaveZRight = asym
      ? opts.wallTopZ - ohRight * rightPitchTan
      : opts.wallTopZ - (ohRight * ridgeH) / dCrit;
    const oCrossLeft = asym ? ohLeft : (ohLeft * crossHalf) / dCrit;
    const oCrossRight = asym ? ohRight : (ohRight * crossHalf) / dCrit;
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
    const backLeft = shift(startBase, leftN, crossHalf + oCrossLeft);   // BL
    const backRight = shift(startBase, rightN, crossHalf + oCrossRight); // BR
    const frontLeft = shift(endBase, leftN, crossHalf + oCrossLeft);    // FL
    const frontRight = shift(endBase, rightN, crossHalf + oCrossRight);  // FR

    // Ridge endpoints (on the segment centreline, at ridgeZ).
    //   closed → trim inward by hip_setback
    //   open   → extend past by gable_overhang
    //   joint  → run to the segment endpoint (no trim, no extension)
    // The ridge cross-position: centreline + ridgeShift·leftN (ridgeShift=0 unless
    // an asymmetric per-side pitch moved it). Applied to both ends so the ridge
    // line runs parallel to the segment axis, just off-centre.
    const ridgeStart2D: Point2D = shift(
      startRes === "closed"
        ? shift(seg.start, unit, +hipSetbackStart)
        : startRes === "open"
          ? shift(seg.start, unit, -gableOverhangStart)
          : seg.start,
      leftN, ridgeShift,
    );
    const ridgeEnd2D: Point2D = shift(
      endRes === "closed"
        ? shift(seg.end, unit, -hipSetbackEnd)
        : endRes === "open"
          ? shift(seg.end, unit, +gableOverhangEnd)
          : seg.end,
      leftN, ridgeShift,
    );
    const ridgeStart3D = to3D(ridgeStart2D, ridgeZ);
    const ridgeEnd3D = to3D(ridgeEnd2D, ridgeZ);

    // Two slope planes. Winding: CCW when viewed from OUTSIDE the roof
    // (i.e. from above and to the side of the slope).
    planes.push({
      id: `${seg.id}.slope.left`,
      vertices: [
        to3D(backLeft, eaveZLeft),
        ridgeStart3D,
        ridgeEnd3D,
        to3D(frontLeft, eaveZLeft),
      ],
      role: "slope",
      source_segment_id: seg.id,
      side_of_segment: "left",
      rafter_direction: normaliseVec3([
        backLeft[0] - ridgeStart2D[0],
        backLeft[1] - ridgeStart2D[1],
        eaveZLeft - ridgeZ,
      ]),
      purlin_direction: [unit[0], unit[1], 0],
    });
    planes.push({
      id: `${seg.id}.slope.right`,
      vertices: [
        to3D(backRight, eaveZRight),
        to3D(frontRight, eaveZRight),
        ridgeEnd3D,
        ridgeStart3D,
      ],
      role: "slope",
      source_segment_id: seg.id,
      side_of_segment: "right",
      rafter_direction: normaliseVec3([
        backRight[0] - ridgeStart2D[0],
        backRight[1] - ridgeStart2D[1],
        eaveZRight - ridgeZ,
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

    // Vent extension — when the ridge extends past a hip apex, brace
    // the flying ridge tip with 2 diagonal struts angling down to
    // the two hip diagonals at distance `ext` from the apex (matches
    // legacy `R1' / R2'`), AND cover it with two triangular shell
    // faces so the extension is roofed (not left open). Each cover
    // triangle shares the flying ridge (apex→tip), the vent strut
    // (tip→strutEnd) and the hip diagonal (strutEnd→apex).
    const emitVentExtension = (
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
      const sl = strutEnd(hipLeftEnd);
      const sr = strutEnd(hipRightEnd);
      members.push({
        id: `${seg.id}.vent_strut.${endName}.left`,
        start: ridgeTip, end: sl,
        role: "vent_strut", source_segment_id: seg.id,
      });
      members.push({
        id: `${seg.id}.vent_strut.${endName}.right`,
        start: ridgeTip, end: sr,
        role: "vent_strut", source_segment_id: seg.id,
      });
      // Shell covers over the flying-ridge extension (one per side).
      planes.push({
        id: `${seg.id}.vent_cover.${endName}.left`,
        vertices: [apex, ridgeTip, sl],
        role: "hip_face", source_segment_id: seg.id, side_of_segment: endName,
      });
      planes.push({
        id: `${seg.id}.vent_cover.${endName}.right`,
        vertices: [apex, ridgeTip, sr],
        role: "hip_face", source_segment_id: seg.id, side_of_segment: endName,
      });
    };
    if (startRes === "closed" && ridgeExtStart > 0) {
      // Hip diagonals at start: from apex (ridgeStart3D) to backLeft
      // and backRight eave corners. Struts angle down to those hip
      // diagonals; we brace them at distance `ridgeExtStart` from apex.
      emitVentExtension(
        ridgeMemberStart, ridgeStart3D,
        to3D(backLeft, eaveZLeft), to3D(backRight, eaveZRight),
        ridgeExtStart, "start",
      );
    }
    if (endRes === "closed" && ridgeExtEnd > 0) {
      emitVentExtension(
        ridgeMemberEnd, ridgeEnd3D,
        to3D(frontLeft, eaveZLeft), to3D(frontRight, eaveZRight),
        ridgeExtEnd, "end",
      );
    }

    // Ring beam — members around the segment rectangle at wall_top_z.
    // The two SIDE eaves (`.left` / `.right`) always get a flat member.
    // The END cross members (`.back` = start, `.front` = end) are the
    // eave-level band across an endpoint — but at an OPEN (gable) end the
    // wall RISES into a triangle, so a flat band there would sit buried
    // mid-wall. Suppress it; the raking `gable_band` (emitted below) rides
    // the top of the gable instead. Closed (hip) + joint ends keep the
    // flat member (the hip face sits on it). Multi-segment: Step 6 trims
    // shared edges.
    const rect = segmentRect(seg);
    for (const rb of ringBeamMembersForRect(rect, opts.wallTopZ, seg.id)) {
      if (startRes === "open" && rb.id.endsWith(".back")) continue;
      if (endRes === "open" && rb.id.endsWith(".front")) continue;
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
        const apexCross = shift(seg.start, leftN, ridgeShift);
        const apexAtWall: Point3D = [apexCross[0], apexCross[1], ridgeZ];
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
          thickness: gableWallThickness,
          // Extrude toward the house interior (start face → +unit).
          inward: [unit[0], unit[1], 0],
        });
        // Raking gable band up each slope edge (wall top → apex),
        // continuous with the eave ring beam at the wall corners.
        members.push({
          id: `${seg.id}.gable_band.start.left`,
          start: to3D(wallLeft, opts.wallTopZ),
          end: apexAtWall,
          role: "gable_band",
          source_segment_id: seg.id,
        });
        members.push({
          id: `${seg.id}.gable_band.start.right`,
          start: to3D(wallRight, opts.wallTopZ),
          end: apexAtWall,
          role: "gable_band",
          source_segment_id: seg.id,
        });
      } else {
        // Closed → hip triangle at the START endpoint.
        planes.push({
          id: `${seg.id}.hip_face.start`,
          vertices: [
            to3D(backRight, eaveZRight),
            to3D(backLeft, eaveZLeft),
            ridgeStart3D,
          ],
          role: "hip_face",
          source_segment_id: seg.id,
          side_of_segment: "start",
        });
        members.push({
          id: `${seg.id}.hip.start.left`,
          start: ridgeStart3D,
          end: to3D(backLeft, eaveZLeft),
          role: "hip",
          source_segment_id: seg.id,
        });
        members.push({
          id: `${seg.id}.hip.start.right`,
          start: ridgeStart3D,
          end: to3D(backRight, eaveZRight),
          role: "hip",
          source_segment_id: seg.id,
        });
      }
    }

    if (endIsLeaf) {
      if (endRes === "open") {
        const wallLeft = shift(seg.end, leftN, crossHalf);
        const wallRight = shift(seg.end, rightN, crossHalf);
        const apexCross = shift(seg.end, leftN, ridgeShift);
        const apexAtWall: Point3D = [apexCross[0], apexCross[1], ridgeZ];
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
          thickness: gableWallThickness,
          // Extrude toward the house interior (end face → −unit).
          inward: [-unit[0], -unit[1], 0],
        });
        members.push({
          id: `${seg.id}.gable_band.end.left`,
          start: to3D(wallLeft, opts.wallTopZ),
          end: apexAtWall,
          role: "gable_band",
          source_segment_id: seg.id,
        });
        members.push({
          id: `${seg.id}.gable_band.end.right`,
          start: to3D(wallRight, opts.wallTopZ),
          end: apexAtWall,
          role: "gable_band",
          source_segment_id: seg.id,
        });
      } else {
        planes.push({
          id: `${seg.id}.hip_face.end`,
          vertices: [
            to3D(frontLeft, eaveZLeft),
            to3D(frontRight, eaveZRight),
            ridgeEnd3D,
          ],
          role: "hip_face",
          source_segment_id: seg.id,
          side_of_segment: "end",
        });
        members.push({
          id: `${seg.id}.hip.end.left`,
          start: ridgeEnd3D,
          end: to3D(frontLeft, eaveZLeft),
          role: "hip",
          source_segment_id: seg.id,
        });
        members.push({
          id: `${seg.id}.hip.end.right`,
          start: ridgeEnd3D,
          end: to3D(frontRight, eaveZRight),
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
        const centre2D = interpolatePoint(seg, along);
        // Bottom chord spans the full width (eave to eave); the apex sits over
        // the ridge (shifted off-centre for an asymmetric pitch) so the two top
        // chords take the left/right angles.
        const leftBase = shift(centre2D, leftN, crossHalf);
        const rightBase = shift(centre2D, rightN, crossHalf);
        const apex2D = shift(centre2D, leftN, ridgeShift);
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
