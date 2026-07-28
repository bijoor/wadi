// First-class v2 roof renderer for House3D. Unlike V2RoofMesh
// (debug overlay, translucent), this renders v2 roofs as SOLID
// meshes so they show up alongside legacy roofs in the main scene.
//
// Only processes objects with `type: "roof"` (skips legacy hip /
// gable / flat / shed which have their own renderers). Uses the
// shared v2 pipeline in v2RoofFromHouse.ts.
//
// Exports TWO components so House3D can assign each to the right
// layer bucket:
//   - V2RoofSolid  → shell planes (loft layer, "Roof shell")
//   - V2RoofFrame  → truss members (frame_spine, "Ridges & trusses")

import { useMemo } from "react";
import * as THREE from "three";
import { lateriteMaps, roofTileMaps, roofUvK, wallUvK } from "./procTextures";
import { expandRoomWalls, type HouseConfig } from "../svg2d/expand";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";
import { computeTopFloorWallTopZ } from "../svg2d/roofGeometry";
import { readPlotBounds, toThreePos } from "./coords";
import { derivePitchedRoof } from "../svg2d/roof/v2/derivePitched";
import { deriveFlatRoof } from "../svg2d/roof/v2/deriveFlat";
import { deriveShedRoof } from "../svg2d/roof/v2/deriveShed";
import { resolveJoints, ridgeZFromConfig } from "../svg2d/roof/v2/resolveJoints";
import { buildFinkTrussMembers } from "../svg2d/roof/v2/truss";
import { populateRoofFraming } from "../svg2d/roof/v2/rafters";
import { populateEaveMembers } from "../svg2d/roof/v2/eaveMembers";
import { trimAtJoints } from "../svg2d/roof/v2/trimAtJoints";
import { DEFAULT_V2_FRAMING, type FramingConfig } from "../svg2d/roof/v2/bom";
import type { MemberRole, RoofConfig, RoofPlane, RoofSpec, StraightMember } from "../svg2d/roof/v2/model";

// Material palette for solid rendering. Slopes use a warm terracotta
// (matches typical Konkan tile roofs). Endcap planes match.
const PLANE_MATERIAL: Record<string, string> = {
  slope: "#c2410c",         // terracotta / Mangalore tile
  hip_face: "#c2410c",
  gable_wall: "#e7c299",    // matches wall paint
  parapet: "#e7c299",
  flat_slab: "#8b8680",      // RCC grey
};

export function V2RoofSolid({ config }: { config: HouseConfig }) {
  const bundles = useMemo(() => {
    try {
      return collectV2Roofs(config);
    } catch (e) {
      console.warn("[v2solid] compute failed:", e);
      return [];
    }
  }, [config]);

  const plot = useMemo(() => readPlotBounds(expandRoomWalls(config)), [config]);
  // Tile UV scale keyed to the project's units→feet ratio, so the physical
  // tile size stays constant across projects with different ratios.
  const uvK = roofUvK((config as { units?: { system?: string; per_unit?: number } }).units);

  if (bundles.length === 0) return null;

  return (
    <group>
      {bundles.map((b, idx) => (
        <group key={idx}>
          {b.spec.planes
            // Gable walls are solid masonry — rendered as extruded prisms
            // by V2RoofGableWalls (on the top-floor Walls layer), not here.
            .filter((p) => p.role !== "gable_wall")
            .map((p) => (
              <SolidPlane key={p.id} plane={p} plotWidth={plot.width} plotLength={plot.length} uvK={uvK} />
            ))}
        </group>
      ))}
    </group>
  );
}

// Frame members for v2 roofs — ridges, hip diagonals, valleys, ring
// beams, and truss chords/webs. Separate export so House3D can push
// this into the "frame_spine" (Ridges & trusses) layer bucket while
// the shells stay in "loft".
export function V2RoofFrame({ config }: { config: HouseConfig }) {
  const bundles = useMemo(() => {
    try {
      return collectV2Roofs(config);
    } catch (e) {
      console.warn("[v2frame] compute failed:", e);
      return [];
    }
  }, [config]);

  const plot = useMemo(() => readPlotBounds(expandRoomWalls(config)), [config]);

  if (bundles.length === 0) return null;

  return (
    <group>
      {bundles.map(({ spec, framing }, idx) => {
        // Ridge / hip / valley / ring_beam members come from
        // derivePitched + resolveJoints. Truss chord/web members
        // come from expanding each TrussTriangle. Each member
        // renders as a rectangular BoxGeometry sized from this
        // roof's framing config (a 6×3 in ridge shows as an actual
        // 6-in wide × 3-in deep pipe, not a cylinder).
        const trussMembers: StraightMember[] = spec.trusses.flatMap((t) =>
          t.members ?? buildFinkTrussMembers(t),
        );
        const frameMembers = spec.members.filter(
          (m) => SPINE_MEMBER_ROLES.has(m.role),
        );
        return (
          <group key={idx}>
            {frameMembers.map((m) => (
              m.role === "pani_patti" ? (
                <PaniPattiStrip
                  key={m.id} member={m} framing={framing}
                  plotWidth={plot.width} plotLength={plot.length}
                />
              ) : (
                <FrameMemberBox
                  key={m.id} member={m}
                  section={sectionForMember(m.role, framing)}
                  plotWidth={plot.width} plotLength={plot.length}
                />
              )
            ))}
            {trussMembers.map((m) => (
              m.role === "pani_patti" ? (
                <PaniPattiStrip
                  key={m.id} member={m} framing={framing}
                  plotWidth={plot.width} plotLength={plot.length}
                />
              ) : (
                <FrameMemberBox
                  key={m.id} member={m}
                  section={sectionForMember(m.role, framing)}
                  plotWidth={plot.width} plotLength={plot.length}
                />
              )
            ))}
          </group>
        );
      })}
    </group>
  );
}

// Surface members — rafters + purlins on each slope/hip_face plane.
// Separate export so House3D can push this into the "frame_surface"
// (Purlins & rafters) layer bucket.
export function V2RoofSurface({ config }: { config: HouseConfig }) {
  const bundles = useMemo(() => {
    try {
      return collectV2Roofs(config);
    } catch (e) {
      console.warn("[v2surface] compute failed:", e);
      return [];
    }
  }, [config]);

  const plot = useMemo(() => readPlotBounds(expandRoomWalls(config)), [config]);

  if (bundles.length === 0) return null;

  return (
    <group>
      {bundles.map(({ spec, framing }, idx) => {
        const surfaceMembers = spec.members.filter(
          (m) => SURFACE_MEMBER_ROLES.has(m.role),
        );
        return (
          <group key={idx}>
            {surfaceMembers.map((m) => (
              <FrameMemberBox
                key={m.id} member={m}
                section={sectionForMember(m.role, framing)}
                plotWidth={plot.width} plotLength={plot.length}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

// Gable walls — solid masonry end walls shaped to the roof profile at
// OPEN endpoints. Rendered as extruded prisms (profile triangle ×
// thickness). Separate export so House3D can push them onto the
// top-floor Walls layer (they hide/show with the house walls).
export function V2RoofGableWalls({ config }: { config: HouseConfig }) {
  const bundles = useMemo(() => {
    try {
      return collectV2Roofs(config);
    } catch (e) {
      console.warn("[v2gable] compute failed:", e);
      return [];
    }
  }, [config]);

  const plot = useMemo(() => readPlotBounds(expandRoomWalls(config)), [config]);
  const uvK = wallUvK((config as { units?: { system?: string; per_unit?: number } }).units);

  if (bundles.length === 0) return null;

  return (
    <group>
      {bundles.map((b, idx) => (
        <group key={idx}>
          {b.spec.planes
            .filter((p) => p.role === "gable_wall")
            .map((p) => (
              <GableWallPrism
                key={p.id}
                plane={p}
                plotWidth={plot.width}
                plotLength={plot.length}
                uvK={uvK}
              />
            ))}
        </group>
      ))}
    </group>
  );
}

// Spine roles → "Ridges & trusses" layer (frame_spine).
const SPINE_MEMBER_ROLES: Set<StraightMember["role"]> = new Set([
  "ridge", "hip", "valley", "ring_beam", "gable_band",
  "truss_top_chord", "truss_bottom_chord", "truss_web",
  "pani_patti", "eave_L_channel", "corner_double_angle",
  "vent_strut", "tie_beam",
]);

// Surface roles → "Purlins & rafters" layer (frame_surface).
const SURFACE_MEMBER_ROLES: Set<StraightMember["role"]> = new Set([
  "rafter", "purlin",
]);

// Look up the rectangular pipe cross-section [width_in, depth_in]
// for a member role from the framing config. Convention (matches
// legacy roofFrame): sizeIn[0] = width (horizontal-perpendicular
// to the member), sizeIn[1] = depth (vertical when the member is
// horizontal).
const IN_TO_U = 10 / 12;
function sectionForMember(
  role: MemberRole,
  framing: FramingConfig,
): [number, number] {
  switch (role) {
    case "ridge":
      return framing.ridge_size_in;
    case "hip":
      return framing.hip_size_in ?? framing.ridge_size_in;
    case "valley":
      return framing.valley_size_in ?? framing.ridge_size_in;
    case "ring_beam":
      return framing.ring_beam_size_in;
    case "gable_band":
      // Raking band continuous with the ring beam → same section.
      return framing.ring_beam_size_in;
    case "tie_beam":
      return framing.tie_beam_size_in ?? framing.ring_beam_size_in;
    case "rafter":
      return framing.rafter_size_in;
    case "purlin":
      return framing.purlin_size_in;
    case "truss_top_chord":
    case "truss_bottom_chord":
      return framing.truss?.chord_size_in ?? [2, 4];
    case "truss_web":
    case "vent_strut":
      return framing.truss?.web_size_in ?? [2, 2];
    case "eave_L_channel":
      return framing.eave_L_channel_size_in ?? [1, 1];
    case "corner_double_angle":
      return framing.corner_double_angle_size_in ?? [1, 1];
    default:
      return [2, 2];
  }
}

// Color per role — subtle differentiation for visual debugging.
function colorForRole(role: StraightMember["role"]): string {
  switch (role) {
    case "ridge":                return "#3f3f46";   // dark slate — top spine
    case "hip":                  return "#4b4b4b";
    case "valley":               return "#374151";
    case "ring_beam":            return "#525252";
    case "gable_band":           return "#6b5b45";   // RC band up the gable rake
    case "tie_beam":             return "#0369a1";   // steel-blue wall-top tie
    case "pani_patti":           return "#9ca3af";   // GI galvanised — lighter
    case "eave_L_channel":       return "#6b7280";
    case "corner_double_angle":  return "#525252";
    default:                     return "#404040";   // truss members
  }
}

// Render one steel-pipe member as a rectangular box. Box local axes:
//   local X → member length
//   local Y → depth  (vertical when the member is horizontal)
//   local Z → width  (horizontal-perpendicular to the member)
// Rotation aligns local X with the member direction. Legacy convention:
// framing sizes are [width, depth] in inches (see roofFrame.beamBetween).
function FrameMemberBox({
  member,
  section,
  plotWidth,
  plotLength,
}: {
  member: StraightMember;
  section: [number, number];  // [width_in, depth_in]
  plotWidth: number;
  plotLength: number;
}) {
  const props = useMemo(() => {
    const a = toThreePos(member.start[0], member.start[1], member.start[2], plotWidth, plotLength);
    const b = toThreePos(member.end[0], member.end[1], member.end[2], plotWidth, plotLength);
    const av = new THREE.Vector3(a.x, a.y, a.z);
    const bv = new THREE.Vector3(b.x, b.y, b.z);
    const dir = new THREE.Vector3().subVectors(bv, av);
    const length = dir.length();
    if (length < 1e-6) return null;
    const mid = av.clone().add(bv).multiplyScalar(0.5);
    // Build a deterministic local basis so every beam has the same
    // cross-section orientation (depth axis toward world +Y).
    //   local +X = beam length direction
    //   local +Y = "up" in the plane perpendicular to +X, closest to
    //              world +Y (so DEPTH is vertical for horizontal beams,
    //              and for diagonal beams the depth still tilts "up")
    //   local +Z = +X × +Y (right-handed)
    const forward = dir.clone().normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    let up: THREE.Vector3;
    if (Math.abs(forward.dot(worldUp)) > 0.999) {
      // Beam is essentially vertical — use world +Z as substitute so
      // the basis stays well-defined.
      up = new THREE.Vector3(0, 0, 1);
    } else {
      up = worldUp
        .clone()
        .sub(forward.clone().multiplyScalar(worldUp.dot(forward)))
        .normalize();
    }
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const m = new THREE.Matrix4().makeBasis(forward, up, right);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    const widthU = section[0] * IN_TO_U;
    const depthU = section[1] * IN_TO_U;
    return {
      pos: [mid.x, mid.y, mid.z] as [number, number, number],
      quat: [q.x, q.y, q.z, q.w] as [number, number, number, number],
      // Box args: [X=length, Y=depth, Z=width].
      size: [length, depthU, widthU] as [number, number, number],
    };
  }, [member, plotWidth, plotLength, section]);
  if (!props) return null;
  const color = colorForRole(member.role);
  return (
    <mesh position={props.pos} quaternion={props.quat} castShadow receiveShadow>
      <boxGeometry args={props.size} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.4} />
    </mesh>
  );
}

// Pani patti — thin GI sheet standing on edge along the eave.
// Rendered as a BoxGeometry oriented so its HEIGHT is vertical and
// THICKNESS is horizontal-perpendicular to the eave line.
function PaniPattiStrip({
  member,
  framing,
  plotWidth,
  plotLength,
}: {
  member: StraightMember;
  framing: FramingConfig;
  plotWidth: number;
  plotLength: number;
}) {
  const { position, rotationY, length, thicknessU, heightU } = useMemo(() => {
    const a = toThreePos(member.start[0], member.start[1], member.start[2], plotWidth, plotLength);
    const b = toThreePos(member.end[0], member.end[1], member.end[2], plotWidth, plotLength);
    const dx = b.x - a.x, dz = b.z - a.z;
    // Length in the horizontal plane (pani patti runs along the eave,
    // essentially horizontal even though the eave's Z varies slightly).
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) {
      return {
        position: [a.x, a.y, a.z] as [number, number, number],
        rotationY: 0, length: 0, thicknessU: 0, heightU: 0,
      };
    }
    // BoxGeometry default axes: X = width, Y = height, Z = depth.
    // We want length along X (initially), then rotate around Y so
    // the box aligns with the eave direction on the horizontal plane.
    const angle = Math.atan2(-dz, dx);   // Three.js Y-up; z inverted
    const mid: [number, number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2];
    const pp = framing.pani_patti ?? { height_in: 6, thickness_mm: 1.2 };
    // height_in → project units (12 in = 10 units).
    const heightUnits = pp.height_in * (10 / 12);
    // thickness_mm → project units (1 in = 25.4 mm; 12 in = 10 units).
    let thicknessUnits = (pp.thickness_mm / 25.4) * (10 / 12);
    // Ensure the strip is visible even for architecturally-thin GI.
    thicknessUnits = Math.max(0.05, thicknessUnits);
    // Nudge strip up half its height so its BASE sits at the eave.
    const raised: [number, number, number] = [mid[0], mid[1] + heightUnits / 2, mid[2]];
    return {
      position: raised, rotationY: angle,
      length: len, thicknessU: thicknessUnits, heightU: heightUnits,
    };
  }, [member, framing, plotWidth, plotLength]);

  if (length === 0) return null;
  return (
    <mesh position={position} rotation={[0, rotationY, 0]} castShadow>
      <boxGeometry args={[length, heightU, thicknessU]} />
      <meshStandardMaterial color={colorForRole("pani_patti")} roughness={0.4} metalness={0.7} />
    </mesh>
  );
}

interface V2RoofBundle {
  spec: RoofSpec;
  framing: FramingConfig;
}

// Iterate ONLY v2 roofs (type: "roof"), derive each's spec + resolved
// framing config. Legacy roofs are skipped — they have their own
// dedicated renderers in House3D.
function collectV2Roofs(config: HouseConfig): V2RoofBundle[] {
  const out: V2RoofBundle[] = [];
  const hc = expandRoomWalls(config);
  const houseDefaults = (hc as {
    defaults?: { floor_height?: number; slab_thickness?: number; wall_thickness?: number };
  }).defaults;
  const wallThickness = houseDefaults?.wall_thickness ?? DEFAULT_GLOBAL_CONFIG.wall_thickness;

  for (let fi = 0; fi < (hc.floors ?? []).length; fi++) {
    const floor = hc.floors![fi];
    const objects = (floor.objects as Array<Record<string, unknown>>) ?? [];
    for (const obj of objects) {
      if (obj.type !== "roof") continue;
      try {
        const framingRaw = (obj.framing as Record<string, unknown> | undefined) ?? {};
        void framingRaw;
        // V2 roofs sit directly on wall-top-Z — no extra beam offset.
        // `z_offset` (default 0) lifts the whole roof above that natural
        // resting position (e.g. to clear a raised split-level section).
        const roofZOffset = Number((obj as { z_offset?: number }).z_offset ?? 0);
        const wallTopZ =
          computeTopFloorWallTopZ(
            fi,
            DEFAULT_GLOBAL_CONFIG,
            0,
            hc.floors as Array<{ height?: number; slab_thickness?: number }>,
            houseDefaults,
          ) + roofZOffset;
        const cfg = obj as unknown as RoofConfig;
        let spec: RoofSpec;
        if (cfg.roof_type === "flat") {
          spec = deriveFlatRoof(cfg, { wallTopZ });
        } else if (cfg.roof_type === "shed") {
          spec = deriveShedRoof(cfg, { wallTopZ, wallThickness });
        } else {
          spec = derivePitchedRoof(cfg, { wallTopZ, wallThickness });
          if (cfg.segments.length > 1) {
            const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
            spec = resolveJoints(cfg, spec, { wallTopZ, ridgeZ });
          }
        }
        const framing: FramingConfig = {
          ...DEFAULT_V2_FRAMING,
          ...(framingRaw as Partial<FramingConfig>),
        };
        // Same pipeline order as computeFromHouse.deriveOne():
        //   1. trim planes at joints (so faces are in final shape)
        //   2. populate rafters + purlins face-based
        //   3. populate eave members (pani_patti, eave_L_channel,
        //      corner_double_angle) face-based
        if (cfg.segments.length > 1) {
          spec = trimAtJoints(spec);
        }
        spec = populateRoofFraming(spec, framing, cfg, wallTopZ);
        spec = populateEaveMembers(spec);
        out.push({ spec, framing });
      } catch (e) {
        console.warn(`[v2solid] roof on floor ${fi} skipped:`, e);
      }
    }
  }
  return out;
}

// Shell offset above the frame — matches the rafter/purlin depth (in
// project units) so the shell polygon covers the framing members below
// it. Ridges/hips/valleys are intentionally left above the shell — they
// will be capped by dedicated ridge tiles in the finished model.
const SHELL_LIFT_U = 5;   // ≈ 6 in (rafter depth + a hair)

// Newell's method — computes a robust outward polygon normal from a
// planar 3D polygon. Returns null for degenerate polygons.
function polygonNormalNewell(
  poly: ReadonlyArray<readonly [number, number, number]>,
): [number, number, number] | null {
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

function SolidPlane({
  plane,
  plotWidth,
  plotLength,
  uvK,
}: {
  plane: RoofPlane;
  plotWidth: number;
  plotLength: number;
  uvK: number;
}) {
  const tiled = plane.role === "slope" || plane.role === "hip_face";
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    const uvs: number[] = [];
    const UV_K = uvK; // per-project scale → constant physical tile size
    // Compute the plane's outward normal (Newell) so we can lift the
    // shell along it, matching the tilt of the roof. Only slope +
    // hip_face planes get lifted; horizontal shells (flat_slab, etc.)
    // don't need the offset.
    let liftX = 0, liftY = 0, liftZ = 0;
    if (plane.role === "slope" || plane.role === "hip_face") {
      const n = polygonNormalNewell(plane.vertices);
      if (n) {
        // Newell's normal follows the polygon's winding order — for
        // hip_face triangles the winding is inverted vs slope
        // quadrilaterals, so the raw normal points DOWNWARD. Force
        // +Z so the shell always lifts UP (out of the roof).
        const flip = n[2] < 0 ? -1 : 1;
        liftX = n[0] * flip * SHELL_LIFT_U;
        liftY = n[1] * flip * SHELL_LIFT_U;
        liftZ = n[2] * flip * SHELL_LIFT_U;
      }
    }
    const pts = plane.vertices.map((v) => toThreePos(
      v[0] + liftX, v[1] + liftY, v[2] + liftZ,
      plotWidth, plotLength,
    ));
    // Fan-triangulate. Planar (X,Z) UVs so the clay-tile texture tiles
    // across the slope (the roof polygons ship without UVs).
    const uvOf = (p: { x: number; z: number }) => [p.x * UV_K, p.z * UV_K];
    for (let i = 1; i < pts.length - 1; i++) {
      verts.push(pts[0].x, pts[0].y, pts[0].z);
      verts.push(pts[i].x, pts[i].y, pts[i].z);
      verts.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
      uvs.push(...uvOf(pts[0]), ...uvOf(pts[i]), ...uvOf(pts[i + 1]));
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    return g;
  }, [plane, plotWidth, plotLength, uvK]);

  const color = PLANE_MATERIAL[plane.role] ?? "#8b8680";
  const tiles = tiled ? roofTileMaps() : null;

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={tiled ? "#ffffff" : color}
        map={tiles?.map ?? null}
        bumpMap={tiles?.bump ?? null}
        bumpScale={tiled ? 1.5 : 0}
        side={THREE.DoubleSide}
        roughness={tiled ? 0.92 : 0.85}
        metalness={0.0}
      />
    </mesh>
  );
}

// A gable wall: the roof-profile polygon (`gable_wall` plane) extruded
// to `plane.thickness` (project units) TOWARD the interior (along
// `plane.inward`), so its OUTER face stays flush with the masonry wall
// below. Rendered like a house wall — laterite/brick on the external
// (outer) face, plain paint on the interior face + edges.
function GableWallPrism({
  plane,
  plotWidth,
  plotLength,
  uvK,
}: {
  plane: RoofPlane;
  plotWidth: number;
  plotLength: number;
  uvK: number;
}) {
  const geometry = useMemo(() => {
    const t = plane.thickness ?? 0;
    const verts = plane.vertices;
    if (verts.length < 3 || !(t > 0)) return null;
    // Extrude toward the interior. Prefer the derived `inward` (keeps the
    // outer face on the wall line); fall back to the plane normal for
    // specs authored before `inward` existed.
    let inward = plane.inward;
    if (!inward) {
      const nn = polygonNormalNewell(verts);
      if (!nn) return null;
      inward = [-nn[0], -nn[1], -nn[2]];
    }
    type P3 = { x: number; y: number; z: number };
    // Front ring = base verts (OUTER face, on the wall line); back ring =
    // base + inward·t (INTERIOR face).
    const front: P3[] = verts.map((v) =>
      toThreePos(v[0], v[1], v[2], plotWidth, plotLength),
    );
    const back: P3[] = verts.map((v) =>
      toThreePos(
        v[0] + inward![0] * t,
        v[1] + inward![1] * t,
        v[2] + inward![2] * t,
        plotWidth,
        plotLength,
      ),
    );
    const pos: number[] = [];
    const uvs: number[] = [];
    // Planar brick UV like a house wall: U runs ALONG the wall (horizontal),
    // V is height. The horizontal tangent = worldUp × faceNormal; projecting
    // onto it gives true along-wall distance. (Using hypot(x,z) instead makes
    // U nearly constant across a wall offset from the origin, so the brick only
    // tiles vertically and reads as horizontal bands.)
    const nrm = polygonNormalNewell(
      front.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    );
    let tx = 1, tz = 0;
    if (nrm) {
      // up(0,1,0) × n = (n.z, 0, -n.x) — horizontal, in the wall plane.
      const hx = nrm[2], hz = -nrm[0];
      const len = Math.hypot(hx, hz);
      if (len > 1e-6) { tx = hx / len; tz = hz / len; }
    }
    const uvOf = (p: P3) => {
      uvs.push((p.x * tx + p.z * tz) * uvK, p.y * uvK);
    };
    const tri = (a: P3, b: P3, c: P3) => {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      uvOf(a); uvOf(b); uvOf(c);
    };
    const m = verts.length;
    // GROUP 0 (external / laterite): the OUTER cap only.
    for (let i = 1; i < m - 1; i++) tri(front[0], front[i], front[i + 1]);
    const extVerts = pos.length / 3;
    // GROUP 1 (internal / plain paint): inner cap (reverse winding) + sides.
    for (let i = 1; i < m - 1; i++) tri(back[0], back[i + 1], back[i]);
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      tri(front[i], back[i], back[j]);
      tri(front[i], back[j], front[j]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    g.clearGroups();
    g.addGroup(0, extVerts, 0);
    g.addGroup(extVerts, pos.length / 3 - extVerts, 1);
    return g;
  }, [plane, plotWidth, plotLength, uvK]);

  const laterite = lateriteMaps();
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      {/* group 0 — external face = laterite/brick (matches the wall below).
          DoubleSide: the extruded cap's winding can face either way depending
          on the gable's authored vertex order, so render both sides to avoid
          the outer face being culled (which would expose the plain inner cap). */}
      <meshStandardMaterial
        attach="material-0"
        map={laterite.map}
        bumpMap={laterite.bump}
        bumpScale={1.2}
        roughness={0.95}
        metalness={0}
        side={THREE.DoubleSide}
      />
      {/* group 1 — interior face + edges = plain paint */}
      <meshStandardMaterial
        attach="material-1"
        color={PLANE_MATERIAL.gable_wall}
        side={THREE.DoubleSide}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  );
}
