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
import { Point } from "@flatten-js/core";
import { composeWalls, pocheContours, type WallInput, type RoomRect } from "../model/composeWalls";
import { rectRing, ringsToFootprint, footprintUnion, type Footprint } from "../model/geom";
import { lateriteMaps } from "./procTextures";

// An opening as an axis-aligned cut (P0 is axis-aligned): `axis` = the wall run,
// (cx,cy) = opening centre in plan, `span` = width along the wall.
export interface ComposedOpening {
  axis: "x" | "y"; cx: number; cy: number; span: number; height: number; sill: number; thickness: number;
  kind: "door" | "window" | "gap";
}

const OVERCUT = 2;    // extend the cut past the wall faces so it fully punches through
const FACE_PROBE = 4; // units outward from a boundary face to test exposure

function classifyGroups(geo: THREE.BufferGeometry, rooms: Footprint): THREE.BufferGeometry {
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
      const px = cx + n.x * FACE_PROBE, pz = cz + n.z * FACE_PROBE;
      brick = !rooms.contains(new Point(px, pz)); // exposed → brick
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

// Extract composeWalls inputs from a floor's expanded objects: each room's four
// FULL-SPAN side centrelines (no inset — the union fills the corners), standalone
// walls, room footprints, and openings (door/window/gap) as axis-aligned cuts.
type Obj = { type: string;[k: string]: unknown };
export function composedFloorInputs(objects: Obj[], defaultT: number, wallHeight: number): {
  walls: WallInput[]; rooms: RoomRect[]; openings: ComposedOpening[];
} {
  const walls: WallInput[] = [];
  const rooms: RoomRect[] = [];
  const openings: ComposedOpening[] = [];
  for (const o of objects) {
    if (o.type === "room") {
      const rx = o.x as number, ry = o.y as number, rw = o.width as number, rl = o.length as number;
      const t = (o.wall_thickness as number | undefined) ?? defaultT;
      rooms.push({ x: rx, y: ry, w: rw, l: rl });
      const raw = o.walls as string[] | Record<string, unknown> | undefined;
      const sides = raw ? (Array.isArray(raw) ? raw : Object.keys(raw)) : ["north", "south", "east", "west"];
      for (const sRaw of sides) {
        const s = String(sRaw).toLowerCase();
        if (s === "north") walls.push({ sx: rx, sy: ry + t / 2, ex: rx + rw, ey: ry + t / 2, thickness: t });
        else if (s === "south") walls.push({ sx: rx, sy: ry + rl - t / 2, ex: rx + rw, ey: ry + rl - t / 2, thickness: t });
        else if (s === "west") walls.push({ sx: rx + t / 2, sy: ry, ex: rx + t / 2, ey: ry + rl, thickness: t });
        else if (s === "east") walls.push({ sx: rx + rw - t / 2, sy: ry, ex: rx + rw - t / 2, ey: ry + rl, thickness: t });
      }
    } else if (o.type === "wall") {
      const t = (o.thickness as number | undefined) ?? defaultT;
      walls.push({ sx: o.start_x as number, sy: o.start_y as number, ex: o.end_x as number, ey: o.end_y as number, thickness: t });
    } else if (o.type === "door" || o.type === "window" || o.type === "gap") {
      const dir = String((o.direction as string | undefined) ?? "").toLowerCase();
      const t = defaultT;
      const w = o.width as number, h = (o.height as number | undefined) ?? wallHeight;
      const sill = o.type === "window" ? ((o.sill_height as number | undefined) ?? 0) : 0;
      const ox = o.x as number, oy = o.y as number;
      const kind = o.type as "door" | "window" | "gap";
      if (dir === "east" || dir === "west") {
        openings.push({ axis: "y", cx: ox + t / 2, cy: oy + w / 2, span: w, height: h, sill, thickness: t, kind });
      } else {
        openings.push({ axis: "x", cx: ox + w / 2, cy: oy + t / 2, span: w, height: h, sill, thickness: t, kind });
      }
    }
  }
  return { walls, rooms, openings };
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
    const { poche } = composeWalls(walls, rooms);
    const shapes = pocheContours(poche);
    if (!shapes.length || wallHeight <= 0) return null;
    const geos: THREE.BufferGeometry[] = [];
    for (const s of shapes) {
      // Build the shape in (x, -y) so that, after ExtrudeGeometry (+Z) and
      // rotateX(-90°), the geometry lands in world coords (x=worldX, y=0..H,
      // z=worldY) — matching toThreePos's axis relabel.
      const shape = new THREE.Shape(s.outer.map((p) => new THREE.Vector2(p.x, -p.y)));
      for (const h of s.holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.y))));
      geos.push(new THREE.ExtrudeGeometry(shape, { depth: wallHeight, bevelEnabled: false, steps: 1 }));
    }
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

    const rooms2d = rooms.length
      ? footprintUnion(rooms.map((r) => ringsToFootprint([rectRing(r.x, r.y, r.w, r.l)])))
      : ringsToFootprint([rectRing(0, 0, 0, 0)]);
    return classifyGroups(result, rooms2d);
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
