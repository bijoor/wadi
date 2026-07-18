// Face-based emission of eave-perimeter members:
//   - pani_patti   (GI water strip along each eave edge)
//   - eave_L_channel (steel L-channel on top of pani patti)
//   - corner_double_angle (2 pieces along each hip diagonal)
//
// Runs AFTER trimAtJoints (and slope-extension by resolveJoints), so
// polygons are already in their final shape. Extended outside-corner
// eaves and joint-trimmed inside eaves are handled uniformly.

import type {
  Point3D,
  RoofSpec,
  StraightMember,
} from "./model";

export function populateEaveMembers(spec: RoofSpec): RoofSpec {
  const extra: StraightMember[] = [];

  // ------ pani_patti + eave_L_channel from each face's eave edge ------
  for (const plane of spec.planes) {
    if (plane.role !== "slope" && plane.role !== "hip_face") continue;
    const verts = dedupeVerts(plane.vertices);
    if (verts.length < 3) continue;
    const eaveZ = Math.min(...verts.map((v) => v[2]));
    // Walk the polygon edges; each edge whose BOTH endpoints are at
    // eave Z is an eave edge → emit pani_patti + eave_L_channel.
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      if (Math.abs(a[2] - eaveZ) > 0.1) continue;
      if (Math.abs(b[2] - eaveZ) > 0.1) continue;
      const idBase = `${plane.id}.eave.${i}`;
      extra.push({
        id: `${idBase}.pani_patti`,
        start: [...a],
        end: [...b],
        role: "pani_patti",
        source_segment_id: plane.source_segment_id,
        source_plane_id: plane.id,
      });
      extra.push({
        id: `${idBase}.eave_L_channel`,
        start: [...a],
        end: [...b],
        role: "eave_L_channel",
        source_segment_id: plane.source_segment_id,
        source_plane_id: plane.id,
      });
    }
  }

  // ------ corner_double_angle: 2 pieces along each hip diagonal ------
  // This includes closed-end hips (emitted by derivePitched) AND the
  // outside_hip at joints (emitted by resolveJoints).
  for (const m of spec.members) {
    if (m.role !== "hip") continue;
    // Skip the hip if it's actually a ridge-orthogonal joint hip that
    // isn't a diagonal — but joint outside_hips + endpoint hips are
    // ALL diagonals by construction.
    for (let leg = 0; leg < 2; leg++) {
      extra.push({
        id: `${m.id}.corner_double_angle.${leg}`,
        start: [...m.start],
        end: [...m.end],
        role: "corner_double_angle",
        source_segment_id: m.source_segment_id,
      });
    }
  }

  if (extra.length === 0) return spec;
  return { ...spec, members: [...spec.members, ...extra] };
}

function dedupeVerts(verts: Point3D[]): Point3D[] {
  const out: Point3D[] = [];
  for (const v of verts) {
    const last = out[out.length - 1];
    if (last
      && Math.abs(last[0] - v[0]) < 1e-3
      && Math.abs(last[1] - v[1]) < 1e-3
      && Math.abs(last[2] - v[2]) < 1e-3) continue;
    out.push(v);
  }
  if (out.length > 1) {
    const f = out[0], l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-3
     && Math.abs(f[1] - l[1]) < 1e-3
     && Math.abs(f[2] - l[2]) < 1e-3) out.pop();
  }
  return out;
}
