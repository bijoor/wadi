// Pure math helpers for RoofSegment. No I/O, no types beyond
// model.ts. Every helper is deterministic and axis-agnostic.

import type {
  EndpointEntry,
  EndpointRef,
  Point2D,
  RoofSegment,
} from "./model";

// Distance from segment.start to segment.end.
export function segmentLength(seg: RoofSegment): number {
  const dx = seg.end[0] - seg.start[0];
  const dy = seg.end[1] - seg.start[1];
  return Math.hypot(dx, dy);
}

// Unit vector in the direction start → end.
// Returns [0,0] for degenerate zero-length segments — callers
// must guard against that themselves; we don't throw because
// downstream code often iterates many segments and a single
// degenerate one shouldn't crash the batch.
export function segmentUnitVector(seg: RoofSegment): Point2D {
  const len = segmentLength(seg);
  if (len === 0) return [0, 0];
  return [(seg.end[0] - seg.start[0]) / len, (seg.end[1] - seg.start[1]) / len];
}

// Left-normal: perpendicular unit vector, +90° CCW from direction.
// For a segment pointing +Y, left-normal points -X.
// For a segment pointing +X, left-normal points +Y.
export function segmentLeftNormal(seg: RoofSegment): Point2D {
  const [ux, uy] = segmentUnitVector(seg);
  return [-uy, ux];
}

// Line offset perpendicular to the segment by `distance` (signed).
// Positive distance → left of segment (see segmentLeftNormal).
// Negative distance → right.
export function offsetLine(
  seg: RoofSegment,
  distance: number,
): { start: Point2D; end: Point2D } {
  const [nx, ny] = segmentLeftNormal(seg);
  const dx = nx * distance;
  const dy = ny * distance;
  return {
    start: [seg.start[0] + dx, seg.start[1] + dy],
    end: [seg.end[0] + dx, seg.end[1] + dy],
  };
}

// Four corners of the width-thick rectangle centred on the segment.
// Ordered CCW (viewed from above with +Y up on screen):
//   [start-right, end-right, end-left, start-left]
// where "left" and "right" are relative to segment direction.
export function segmentRect(seg: RoofSegment): [Point2D, Point2D, Point2D, Point2D] {
  const half = seg.width / 2;
  const right = offsetLine(seg, -half);
  const left = offsetLine(seg, +half);
  return [right.start, right.end, left.end, left.start];
}

// Point at `along` distance from segment.start toward segment.end.
// Clamped to [0, length].
export function interpolatePoint(seg: RoofSegment, along: number): Point2D {
  const len = segmentLength(seg);
  if (len === 0) return seg.start;
  const t = Math.max(0, Math.min(1, along / len));
  return [
    seg.start[0] + (seg.end[0] - seg.start[0]) * t,
    seg.start[1] + (seg.end[1] - seg.start[1]) * t,
  ];
}

// Snap-and-cluster all segment endpoints. Endpoints within
// `epsilon` of each other are treated as the same point.
// Default epsilon = 0.5 units (~0.6 in), per Design decision #2.
//
// Returned entries preserve the FIRST-SEEN point coordinates as
// the canonical one. Every RoofSegment endpoint is guaranteed to
// appear in exactly one entry.
export function resolveEndpoints(
  segments: RoofSegment[],
  epsilon = 0.5,
): EndpointEntry[] {
  const eps2 = epsilon * epsilon;
  const entries: EndpointEntry[] = [];

  const addRef = (pt: Point2D, ref: EndpointRef) => {
    for (const entry of entries) {
      const dx = entry.point[0] - pt[0];
      const dy = entry.point[1] - pt[1];
      if (dx * dx + dy * dy <= eps2) {
        entry.refs.push(ref);
        entry.isJoint = entry.refs.length >= 2;
        return;
      }
    }
    entries.push({ point: pt, refs: [ref], isJoint: false });
  };

  for (const seg of segments) {
    addRef(seg.start, { segmentId: seg.id, which: "start" });
    addRef(seg.end, { segmentId: seg.id, which: "end" });
  }
  return entries;
}

// Convenience — find the entry containing a given (segment, endpoint).
export function findEndpointEntry(
  entries: EndpointEntry[],
  segmentId: string,
  which: "start" | "end",
): EndpointEntry | undefined {
  return entries.find((e) =>
    e.refs.some((r) => r.segmentId === segmentId && r.which === which),
  );
}

// True iff the given (segment, endpoint) is not shared with any
// other segment. Leaves are the endpoints that need endcap
// treatment (open/closed).
export function isLeafEndpoint(
  entries: EndpointEntry[],
  segmentId: string,
  which: "start" | "end",
): boolean {
  const entry = findEndpointEntry(entries, segmentId, which);
  if (!entry) return true;
  return !entry.isJoint;
}

// Shrink a convex quad toward its centroid by `d` along each of its own two
// edge axes (so an axis-aligned rectangle insets `d` on every side).
function insetQuad(
  rect: readonly [Point2D, Point2D, Point2D, Point2D],
  d: number,
): [Point2D, Point2D, Point2D, Point2D] {
  if (!(d > 0)) return [rect[0], rect[1], rect[2], rect[3]];
  const cx = (rect[0][0] + rect[1][0] + rect[2][0] + rect[3][0]) / 4;
  const cy = (rect[0][1] + rect[1][1] + rect[2][1] + rect[3][1]) / 4;
  const ax = [rect[1][0] - rect[0][0], rect[1][1] - rect[0][1]];
  const bx = [rect[3][0] - rect[0][0], rect[3][1] - rect[0][1]];
  const al = Math.hypot(ax[0], ax[1]) || 1, bl = Math.hypot(bx[0], bx[1]) || 1;
  const ua: Point2D = [ax[0] / al, ax[1] / al];
  const ub: Point2D = [bx[0] / bl, bx[1] / bl];
  const move = (p: Point2D): Point2D => {
    const dx = p[0] - cx, dy = p[1] - cy;
    let a = dx * ua[0] + dy * ua[1];
    let b = dx * ub[0] + dy * ub[1];
    a -= Math.sign(a) * Math.min(d, Math.abs(a));
    b -= Math.sign(b) * Math.min(d, Math.abs(b));
    return [cx + a * ua[0] + b * ub[0], cy + a * ua[1] + b * ub[1]];
  };
  return [move(rect[0]), move(rect[1]), move(rect[2]), move(rect[3])];
}

// One StraightMember per edge of the CCW-ordered segment rectangle,
// at the given Z. Emits 4 members per rectangle. Multi-segment
// callers can compose these; Step 6 (joint resolution) will trim
// the shared edges. Until then, edges at joints overlap harmlessly.
//
// Kept in segments.ts so both pitched and flat/shed can use it.
export function ringBeamMembersForRect(
  rect: readonly [Point2D, Point2D, Point2D, Point2D],
  z: number,
  segmentId: string,
  inset = 0,
): Array<{
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  role: "ring_beam";
  source_segment_id: string;
  section_size?: [number, number];
}> {
  const out: Array<{
    id: string;
    start: [number, number, number];
    end: [number, number, number];
    role: "ring_beam";
    source_segment_id: string;
  }> = [];
  const labels: Array<"right" | "front" | "left" | "back"> = [
    "right", "front", "left", "back",
  ];
  // The segment rectangle is grown to the OUTER wall face (expand.ts center-
  // convention). `inset` (typically half the wall thickness) pulls the ring
  // beam back onto the wall centreline so it sits CENTRED on the wall — while
  // the rafters/eaves keep reaching the outer face. Inset toward the centroid
  // along the rectangle's own two axes.
  const r = insetQuad(rect, inset);
  for (let i = 0; i < 4; i++) {
    const a = r[i];
    const b = r[(i + 1) % 4];
    out.push({
      id: `${segmentId}.ring_beam.${labels[i]}`,
      start: [a[0], a[1], z],
      end: [b[0], b[1], z],
      role: "ring_beam",
      source_segment_id: segmentId,
    });
  }
  return out;
}
