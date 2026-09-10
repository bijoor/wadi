// Face-based rafter + purlin generation for v2 pitched roofs.
//
// For each SLOPE and HIP_FACE plane in the spec:
//   1. Compute a plane-local (u, v) basis:
//        u = horizontal direction in plane (parallel to eave/ridge).
//        v = up-slope direction in plane (perpendicular to u, +Z).
//   2. Project polygon vertices to (u, v).
//   3. Emit RAFTERS at spacing along u:
//        For each u_i, intersect the vertical line u=u_i with the
//        polygon to find (v_min, v_max) — emit a rafter between them.
//   4. Emit PURLINS at spacing along v:
//        For each v_i, intersect the horizontal line v=v_i with the
//        polygon to find (u_min, u_max) — emit a purlin between them.
//
// Handles arbitrary convex polygons — trimmed slopes (post-joint
// trim) and extended slopes (with outside-corner vertex) are filled
// correctly without special-cased hip-zone / main-slope branches.
//
// Runs AFTER trimAtJoints so faces are already in their final shape.

import type { FramingConfig } from "./bom";
import type {
  Point3D,
  RoofConfig,
  RoofSpec,
  StraightMember,
} from "./model";

const IN_TO_U = 10 / 12;

export function populateRoofFraming(
  spec: RoofSpec,
  framing: FramingConfig,
  cfg?: RoofConfig,
  wallTopZ?: number,
): RoofSpec {
  // Face-based emission works for any roof_type with sloped faces
  // (pitched hip/gable AND shed). Flat roofs have no slope so we skip.
  if (!cfg || cfg.roof_type === "flat" || wallTopZ == null) return spec;

  const rafterSpacingU = (framing.rafter_spacing_in ?? 36) * IN_TO_U;
  const purlinSpacingU = (framing.purlin_spacing_in ?? 12) * IN_TO_U;
  if (!(rafterSpacingU > 0) || !(purlinSpacingU > 0)) return spec;

  const extra: StraightMember[] = [];
  let counter = 0;

  for (const plane of spec.planes) {
    if (plane.role !== "slope" && plane.role !== "hip_face") continue;
    const uniqueVerts = dedupe(plane.vertices);
    if (uniqueVerts.length < 3) continue;
    const basis = planeBasis(uniqueVerts);
    if (!basis) continue;

    const uv = uniqueVerts.map((p) => projectToUV(basis, p));
    const uMin = Math.min(...uv.map((p) => p[0]));
    const uMax = Math.max(...uv.map((p) => p[0]));
    const vMin = Math.min(...uv.map((p) => p[1]));
    const vMax = Math.max(...uv.map((p) => p[1]));

    // RAFTERS — evenly spaced along u; emit interior line-polygon
    // intersections. Start/end at spacing/2 in from the polygon
    // corners so we don't double-count the ridge/eave corner rafters.
    const uSpan = uMax - uMin;
    if (uSpan > 1e-3) {
      const nR = Math.max(1, Math.floor(uSpan / rafterSpacingU) + 1);
      const gap = uSpan - (nR - 1) * rafterSpacingU;
      const off = gap / 2;
      for (let i = 0; i < nR; i++) {
        const u = uMin + off + i * rafterSpacingU;
        const range = intersectVerticalWithPolygon(uv, u);
        if (!range) continue;
        const [vLo, vHi] = range;
        if (vHi - vLo < 1e-3) continue;
        extra.push({
          id: `${plane.id}.rafter.${counter++}`,
          start: unprojectFromUV(basis, u, vLo),
          end: unprojectFromUV(basis, u, vHi),
          role: "rafter",
          source_segment_id: plane.source_segment_id,
          source_plane_id: plane.id,
        });
      }
    }

    // PURLINS — evenly spaced along v; skip the boundary heights
    // (eave and ridge already have members from other roles).
    const vSpan = vMax - vMin;
    if (vSpan > 1e-3) {
      const nP = Math.max(1, Math.floor(vSpan / purlinSpacingU));
      for (let i = 1; i < nP; i++) {
        const v = vMin + i * purlinSpacingU;
        if (v <= vMin + 1e-3 || v >= vMax - 1e-3) continue;
        const range = intersectHorizontalWithPolygon(uv, v);
        if (!range) continue;
        const [uLo, uHi] = range;
        if (uHi - uLo < 1e-3) continue;
        extra.push({
          id: `${plane.id}.purlin.${counter++}`,
          start: unprojectFromUV(basis, uLo, v),
          end: unprojectFromUV(basis, uHi, v),
          role: "purlin",
          source_segment_id: plane.source_segment_id,
          source_plane_id: plane.id,
        });
      }
    }

    // MID-SLOPE RING — one horizontal member at the geometric CENTER of each
    // face: the midpoint of its full up-slope extent, eave (including overhang)
    // to peak (ridge/apex). A face is planar, so this one point is at once
    // mid-height, mid-slope-length, and mid horizontal-run in plan — it reads
    // as centered from the top view and every elevation. Emitted per face from
    // the face polygon, so it works under UNEQUAL pitch (each face centers on
    // itself, the ring simply steps in Z at the hips where pitches differ; for
    // an equal-pitch hip every face shares the same mid-Z so the ring closes
    // into one clean planar loop whose corners meet on the hip edges).
    // Rafter-sized. Off unless framing.mid_ring.
    if (framing.mid_ring && vSpan > 1e-3) {
      const vMid = (vMin + vMax) / 2;
      const range = intersectHorizontalWithPolygon(uv, vMid);
      if (range) {
        const [uLo, uHi] = range;
        if (uHi - uLo >= 1e-3) {
          extra.push({
            id: `${plane.id}.mid_ring.${counter++}`,
            start: unprojectFromUV(basis, uLo, vMid),
            end: unprojectFromUV(basis, uHi, vMid),
            role: "mid_ring",
            source_segment_id: plane.source_segment_id,
            source_plane_id: plane.id,
          });
        }
      }
    }
  }

  // TIE BEAMS — flat wall-top ceiling ties. For each segment, N members
  // run the full segment length (start→end), spread at equal INTERIOR
  // gaps across the width, at wall-top Z (below the roof, not on a slope).
  for (const seg of cfg.segments ?? []) {
    const n = Math.max(0, Math.round(Number(seg.tie_beam_count ?? 0)));
    if (n <= 0) continue;
    const [sx, sy] = seg.start;
    const [ex, ey] = seg.end;
    const dx = ex - sx, dy = ey - sy;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    // unit perpendicular to the segment axis (in the XY plane)
    const px = -dy / segLen, py = dx / segLen;
    const W = seg.width;
    for (let k = 1; k <= n; k++) {
      const t = -W / 2 + (W * k) / (n + 1); // interior, equal gaps
      extra.push({
        id: `${seg.id}.tie_beam.${counter++}`,
        start: [sx + px * t, sy + py * t, wallTopZ],
        end: [ex + px * t, ey + py * t, wallTopZ],
        role: "tie_beam",
        source_segment_id: seg.id,
      });
    }
  }

  if (extra.length === 0) return spec;
  return { ...spec, members: [...spec.members, ...extra] };
}

// -------- polygon + plane helpers --------

interface PlaneBasis {
  origin: Point3D;
  uAxis: Point3D;
  vAxis: Point3D;
}

function planeBasis(verts: Point3D[]): PlaneBasis | null {
  const n = polygonNormalNewell(verts);
  if (!n) return null;
  const horLen = Math.hypot(n[0], n[1]);
  if (horLen < 1e-6) {
    // Horizontal plane (flat roof) — pick arbitrary uAxis.
    return {
      origin: [...verts[0]],
      uAxis: [1, 0, 0],
      vAxis: [0, 1, 0],
    };
  }
  // u = horizontal direction perpendicular to (nx, ny) — this
  // lies IN the plane (since it has no vertical component) AND is
  // horizontal (dz = 0).
  const uAxis: Point3D = [-n[1] / horLen, n[0] / horLen, 0];
  // v = perpendicular to u in the plane. v = n × u gives a vector
  // perpendicular to both, in the plane's tangent space.
  const vRaw: Point3D = [
    n[1] * uAxis[2] - n[2] * uAxis[1],
    n[2] * uAxis[0] - n[0] * uAxis[2],
    n[0] * uAxis[1] - n[1] * uAxis[0],
  ];
  // Ensure +Z (up-slope) direction.
  const vAxis: Point3D = vRaw[2] >= 0
    ? vRaw
    : [-vRaw[0], -vRaw[1], -vRaw[2]];
  return { origin: [...verts[0]], uAxis, vAxis };
}

function projectToUV(basis: PlaneBasis, p: Point3D): [number, number] {
  const dx = p[0] - basis.origin[0];
  const dy = p[1] - basis.origin[1];
  const dz = p[2] - basis.origin[2];
  return [
    dx * basis.uAxis[0] + dy * basis.uAxis[1] + dz * basis.uAxis[2],
    dx * basis.vAxis[0] + dy * basis.vAxis[1] + dz * basis.vAxis[2],
  ];
}

function unprojectFromUV(basis: PlaneBasis, u: number, v: number): Point3D {
  return [
    basis.origin[0] + u * basis.uAxis[0] + v * basis.vAxis[0],
    basis.origin[1] + u * basis.uAxis[1] + v * basis.vAxis[1],
    basis.origin[2] + u * basis.uAxis[2] + v * basis.vAxis[2],
  ];
}

function polygonNormalNewell(poly: Point3D[]): Point3D | null {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-9) return null;
  return [nx / len, ny / len, nz / len];
}

// Remove consecutive-duplicate vertices (produced by Sutherland-Hodgman
// when the trim intersection lies exactly on an existing vertex).
function dedupe(verts: Point3D[]): Point3D[] {
  const out: Point3D[] = [];
  for (const v of verts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - v[0]) < 1e-3
             && Math.abs(last[1] - v[1]) < 1e-3
             && Math.abs(last[2] - v[2]) < 1e-3) continue;
    out.push(v);
  }
  // Also drop the final vertex if it coincides with the first.
  if (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-3
     && Math.abs(f[1] - l[1]) < 1e-3
     && Math.abs(f[2] - l[2]) < 1e-3) out.pop();
  }
  return out;
}

// Intersect a vertical line (u = const) with a convex 2D polygon.
// Returns the [v_min, v_max] span of the polygon at that u, or null
// if the line is outside the polygon.
function intersectVerticalWithPolygon(
  uv: [number, number][], u: number,
): [number, number] | null {
  const vs: number[] = [];
  for (let i = 0; i < uv.length; i++) {
    const a = uv[i];
    const b = uv[(i + 1) % uv.length];
    if ((a[0] <= u + 1e-6 && u <= b[0] + 1e-6) ||
        (b[0] <= u + 1e-6 && u <= a[0] + 1e-6)) {
      const denom = b[0] - a[0];
      if (Math.abs(denom) < 1e-9) {
        vs.push(a[1]);
        vs.push(b[1]);
      } else {
        const t = (u - a[0]) / denom;
        vs.push(a[1] + t * (b[1] - a[1]));
      }
    }
  }
  if (vs.length < 2) return null;
  return [Math.min(...vs), Math.max(...vs)];
}

function intersectHorizontalWithPolygon(
  uv: [number, number][], v: number,
): [number, number] | null {
  const us: number[] = [];
  for (let i = 0; i < uv.length; i++) {
    const a = uv[i];
    const b = uv[(i + 1) % uv.length];
    if ((a[1] <= v + 1e-6 && v <= b[1] + 1e-6) ||
        (b[1] <= v + 1e-6 && v <= a[1] + 1e-6)) {
      const denom = b[1] - a[1];
      if (Math.abs(denom) < 1e-9) {
        us.push(a[0]);
        us.push(b[0]);
      } else {
        const t = (v - a[1]) / denom;
        us.push(a[0] + t * (b[0] - a[0]));
      }
    }
  }
  if (us.length < 2) return null;
  return [Math.min(...us), Math.max(...us)];
}
