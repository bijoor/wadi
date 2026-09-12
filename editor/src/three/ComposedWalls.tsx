// P0 render for the composed wall model (plans/wall-composition.md).
//
// Renders ONE wall solid per floor from composeWalls(): extrude the floor poché
// (outer contour + room-cavity holes) to wall height, CSG-subtract the openings
// (cut in centreline space, Q1), then group faces into brick vs paint by a
// per-face exposure probe (so corners and reveals decide on their own merits —
// the white-column fix, structurally). Behind a flag; the per-room path is the
// fallback.

import { useMemo } from "react";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { composeWalls, composedFloorInputs, pocheContours, type ComposedOpening, type BoundaryEdge } from "../model/composeWalls";
import type { WallInput, RoomRect } from "../model/composeWalls";
import { lateriteMaps } from "./procTextures";
export { composedFloorInputs };
export type { ComposedOpening };

const OVERCUT = 2; // extend the cut past the wall faces so it fully punches through

// Distance from plan point p to segment a-b.
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

// Split the wall solid into brick (exterior/laterite) and paint (interior) faces.
// A vertical face inherits the verdict of the NEAREST boundary edge whose outward
// normal it shares — so every triangle on one wall face agrees (no per-triangle
// zig-zag), matching the 2D plan and the estimator, which read the same edges.
// Top caps are brick (ring-beam datum), soffits interior.
function classifyGroups(geo: THREE.BufferGeometry, edges: BoundaryEdge[]): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute("position");
  const triCount = pos.count / 3;
  const brickTris: number[] = [];
  const paintTris: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < triCount; i++) {
    a.fromBufferAttribute(pos, i * 3); b.fromBufferAttribute(pos, i * 3 + 1); c.fromBufferAttribute(pos, i * 3 + 2);
    ab.subVectors(b, a); ac.subVectors(c, a); n.crossVectors(ab, ac).normalize();
    // world coords here are x=worldX, y=up, z=worldY (plan = x,z).
    let brick: boolean;
    if (Math.abs(n.y) > 0.6) {
      brick = n.y > 0; // top cap brick (ring-beam datum), soffit interior
    } else {
      const cx = (a.x + b.x + c.x) / 3, cz = (a.z + b.z + c.z) / 3;
      // Nearest boundary edge that faces the same way as this face.
      let best = Infinity, bestAligned = Infinity, brickAligned = true, brickNear = true;
      for (const e of edges) {
        const d = segDist(cx, cz, e.a.x, e.a.y, e.b.x, e.b.y);
        if (d < best) { best = d; brickNear = e.brick; }
        const dot = n.x * e.outward.x + n.z * e.outward.y;
        if (dot > 0.3 && d < bestAligned) { bestAligned = d; brickAligned = e.brick; }
      }
      brick = bestAligned < Infinity ? brickAligned : brickNear;
    }
    (brick ? brickTris : paintTris).push(i);
  }
  // reorder into two contiguous runs: brick first (group 0), then paint (group 1)
  const src = pos.array as ArrayLike<number>;
  const out = new Float32Array(pos.count * 3);
  let w = 0;
  const copyTri = (t: number) => { for (let k = 0; k < 9; k++) out[w++] = src[t * 9 + k]; };
  for (const t of brickTris) copyTri(t);
  for (const t of paintTris) copyTri(t);
  const res = new THREE.BufferGeometry();
  res.setAttribute("position", new THREE.BufferAttribute(out, 3));
  res.computeVertexNormals();
  res.clearGroups();
  res.addGroup(0, brickTris.length * 3, 0);
  res.addGroup(brickTris.length * 3, paintTris.length * 3, 1);
  return res;
}

export function ComposedWalls(props: {
  walls: WallInput[];
  rooms: RoomRect[];
  openings: ComposedOpening[];
  baseZ: number;
  wallHeight: number;
  plotWidth: number;
  plotLength: number;
  color?: string;
}) {
  const { walls, rooms, openings, baseZ, wallHeight, plotWidth, plotLength, color = "#e8e5df" } = props;
  const geometry = useMemo(() => {
    const { groups } = composeWalls(walls, rooms);
    const edges = groups.flatMap((g) => g.edges); // per-face brick/paint verdicts
    // Extrude each height-group's sub-poché to ITS OWN height, so collinear
    // same-thickness walls of different height render as a step, not one block.
    const geos: THREE.BufferGeometry[] = [];
    for (const g of groups) {
      if (g.height <= 0) continue;
      for (const s of pocheContours(g.poche)) {
        // Build the shape in (x, -y) so that, after ExtrudeGeometry (+Z) and
        // rotateX(-90°), the geometry lands in world coords (x=worldX, y=0..H,
        // z=worldY) — matching toThreePos's axis relabel.
        const shape = new THREE.Shape(s.outer.map((p) => new THREE.Vector2(p.x, -p.y)));
        for (const h of s.holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.y))));
        geos.push(new THREE.ExtrudeGeometry(shape, { depth: g.height, bevelEnabled: false, steps: 1 }));
      }
    }
    if (!geos.length) return null;
    let solid = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!solid) return null;
    solid.rotateX(-Math.PI / 2);

    // Subtract opening cuboids (axis-aligned, P0).
    let result: THREE.BufferGeometry = solid;
    if (openings.length) {
      const evaluator = new Evaluator();
      let brush = new Brush(solid);
      brush.updateMatrixWorld();
      for (const op of openings) {
        const across = op.thickness + OVERCUT;
        const box = op.axis === "x"
          ? new THREE.BoxGeometry(op.span, op.height, across)
          : new THREE.BoxGeometry(across, op.height, op.span);
        const cutter = new Brush(box);
        // The solid's y is 0..wallHeight (baseZ is added by the mesh position),
        // so cut in that local frame: sill is measured from the wall base.
        cutter.position.set(op.cx, op.sill + op.height / 2, op.cy);
        cutter.updateMatrixWorld();
        brush = evaluator.evaluate(brush, cutter, SUBTRACTION);
      }
      result = brush.geometry;
    }

    return classifyGroups(result, edges);
  }, [walls, rooms, openings, wallHeight, baseZ]);

  if (!geometry) return null;
  const laterite = lateriteMaps();
  return (
    <mesh geometry={geometry} position={[-plotWidth / 2, baseZ, -plotLength / 2]} castShadow receiveShadow>
      <meshStandardMaterial attach="material-0" map={laterite.map} bumpMap={laterite.bump} bumpScale={1.2} roughness={0.95} metalness={0} />
      <meshStandardMaterial attach="material-1" color={color} roughness={0.9} metalness={0} />
    </mesh>
  );
}
