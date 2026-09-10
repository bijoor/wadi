// V2 roof preview — renders the RoofSpec produced by the new
// derive{Flat,Shed,Pitched}Roof pipeline, so users can compare it
// visually with the legacy pipeline.
//
// Members render as lines (colored by role — ridge/hip/valley/etc).
// Slope + gable_wall + hip_face planes render as translucent meshes.
// Trusses render as line triangles.
//
// This is a debug/comparison view only. When you toggle "v2 roof"
// on, the legacy roof meshes remain — they'll visually overlap.

import { useMemo } from "react";
import * as THREE from "three";
import { expandRoomWalls, type HouseConfig } from "../svg2d/expand";
import { readPlotBounds, toThreePos } from "./coords";
import { derivePitchedRoof } from "../svg2d/roof/v2/derivePitched";
import { deriveShedRoof } from "../svg2d/roof/v2/deriveShed";
import { resolveJoints, ridgeZFromConfig } from "../svg2d/roof/v2/resolveJoints";
import type {
  MemberRole,
  RoofPlane,
  RoofSpec,
  StraightMember,
  TrussTriangle,
} from "../svg2d/roof/v2/model";
import { findDemo, type V2DemoId } from "./v2Demos";
import { computeMergedV2Spec } from "./v2RoofFromHouse";

// Color per member role — matches architectural convention:
//   ridge = red, hip = orange, valley = blue, ring_beam = green,
//   others = grey.
const ROLE_COLOR: Partial<Record<MemberRole, string>> = {
  ridge: "#ef4444",
  hip: "#f97316",
  valley: "#3b82f6",
  ring_beam: "#22c55e",
  mid_ring: "#0d9488",
  rafter: "#a3a3a3",
  purlin: "#94a3b8",
  hip_beam: "#facc15",
  vent_strut: "#eab308",
  parapet_cap: "#d97706",
  truss_top_chord: "#a855f7",
  truss_bottom_chord: "#8b5cf6",
  truss_web: "#7c3aed",
  tie_beam: "#0ea5e9",
};

const PLANE_COLOR: Record<string, string> = {
  slope: "#0ea5e9",       // sky blue, translucent
  hip_face: "#f97316",     // orange
  gable_wall: "#84cc16",   // lime
  parapet: "#d97706",       // amber
  flat_slab: "#0ea5e9",     // sky
};

export function V2RoofMesh({
  config,
  showPlanes,
  showMembers,
  showTrusses,
  showJointsOnly,
  demoId,
}: {
  config: HouseConfig;
  showPlanes: boolean;
  showMembers: boolean;
  showTrusses: boolean;
  showJointsOnly: boolean;
  demoId: V2DemoId;
}) {
  const spec = useMemo(() => {
    try {
      const demo = findDemo(demoId);
      if (demo) {
        // Demo mode: hardcoded multi-segment config. Use a synthetic
        // wall_top_z since demos aren't tied to any floor.
        return computeDemoSpec(demo.config);
      }
      return computeMergedV2Spec(config);
    } catch (e) {
      console.warn("[v2roof] compute failed:", e);
      return null;
    }
  }, [config, demoId]);
  const plot = useMemo(() => readPlotBounds(expandRoomWalls(config)), [config]);

  if (!spec) return null;

  return (
    <group>
      {showPlanes && spec.planes.map((p) => (
        <PlaneMesh key={p.id} plane={p} plotWidth={plot.width} plotLength={plot.length} />
      ))}
      {showMembers && spec.members
        .filter((m) => !showJointsOnly || m.id.startsWith("joint."))
        .map((m) => (
          <MemberLine key={m.id} member={m} plotWidth={plot.width} plotLength={plot.length} />
        ))}
      {showTrusses && spec.trusses.map((t) => (
        <TrussLines key={t.id} truss={t} plotWidth={plot.width} plotLength={plot.length} />
      ))}
    </group>
  );
}

// Demo pipeline — runs the appropriate derive function based on
// roof_type, then resolveJoints for multi-seg pitched/shed. Fixed
// wall_top_z so demo sits above the plinth of any loaded house.
function computeDemoSpec(cfg: import("../svg2d/roof/v2/model").RoofConfig): RoofSpec {
  const wallTopZ = 100;
  let spec: RoofSpec;
  if (cfg.roof_type === "shed") {
    spec = deriveShedRoof(cfg, { wallTopZ });
    if (cfg.segments.length > 1) {
      spec = resolveJoints(cfg, spec, { wallTopZ, ridgeZ: wallTopZ });
    }
    return spec;
  }
  // Pitched (default). Flat demos not currently defined.
  spec = derivePitchedRoof(cfg, { wallTopZ });
  if (cfg.segments.length > 1) {
    const ridgeZ = ridgeZFromConfig(cfg, wallTopZ);
    spec = resolveJoints(cfg, spec, { wallTopZ, ridgeZ });
  }
  return spec;
}

function PlaneMesh({
  plane,
  plotWidth,
  plotLength,
}: {
  plane: RoofPlane;
  plotWidth: number;
  plotLength: number;
}) {
  const { geometry, color } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts: number[] = [];
    // Fan-triangulate: (v0, v1, v2), (v0, v2, v3), ...
    const pts = plane.vertices.map((v) => toThreePos(v[0], v[1], v[2], plotWidth, plotLength));
    for (let i = 1; i < pts.length - 1; i++) {
      verts.push(pts[0].x, pts[0].y, pts[0].z);
      verts.push(pts[i].x, pts[i].y, pts[i].z);
      verts.push(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    const c = PLANE_COLOR[plane.role] ?? "#64748b";
    return { geometry: g, color: c };
  }, [plane, plotWidth, plotLength]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function MemberLine({
  member,
  plotWidth,
  plotLength,
}: {
  member: StraightMember;
  plotWidth: number;
  plotLength: number;
}) {
  const { geometry, color } = useMemo(() => {
    const a = toThreePos(member.start[0], member.start[1], member.start[2], plotWidth, plotLength);
    const b = toThreePos(member.end[0], member.end[1], member.end[2], plotWidth, plotLength);
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, a.y, a.z),
      new THREE.Vector3(b.x, b.y, b.z),
    ]);
    const c = ROLE_COLOR[member.role] ?? "#94a3b8";
    return { geometry: g, color: c };
  }, [member, plotWidth, plotLength]);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
}

function TrussLines({
  truss,
  plotWidth,
  plotLength,
}: {
  truss: TrussTriangle;
  plotWidth: number;
  plotLength: number;
}) {
  const geometry = useMemo(() => {
    const bl = toThreePos(truss.bottom_left[0], truss.bottom_left[1], truss.bottom_left[2], plotWidth, plotLength);
    const br = toThreePos(truss.bottom_right[0], truss.bottom_right[1], truss.bottom_right[2], plotWidth, plotLength);
    const ap = toThreePos(truss.apex[0], truss.apex[1], truss.apex[2], plotWidth, plotLength);
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(bl.x, bl.y, bl.z),
      new THREE.Vector3(br.x, br.y, br.z),
      new THREE.Vector3(br.x, br.y, br.z),
      new THREE.Vector3(ap.x, ap.y, ap.z),
      new THREE.Vector3(ap.x, ap.y, ap.z),
      new THREE.Vector3(bl.x, bl.y, bl.z),
    ]);
  }, [truss, plotWidth, plotLength]);
  return (
    <lineSegments>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#c084fc" linewidth={1.5} />
    </lineSegments>
  );
}
