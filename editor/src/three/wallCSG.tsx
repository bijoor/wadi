// CSG-based wall renderer. Subtracts opening cuboids from a wall box so
// doors and windows become actual holes rather than flat overlays.
//
// Geometry is built with three-bvh-csg's Evaluator + Brush and cached
// per (wall + openings) via useMemo, so panning the camera or toggling
// unrelated layers doesn't retrigger CSG.

import { useMemo } from "react";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { lateriteMaps, wallUvK } from "./procTextures";

export interface WallOpening {
  // Local-space (wall-relative) rectangle to subtract. All coords are
  // in world units on the wall's principal axes:
  //   along:  offset along the wall's length axis
  //   from:   offset from the wall's bottom (i.e. sill_height for
  //           windows, 0 for doors)
  //   width:  extent along the wall's length axis
  //   height: extent up the wall
  along: number;
  from: number;
  width: number;
  height: number;
  kind: "door" | "window";
  // When true, leave the opening bare (hole only) — no window/door fill.
  open?: boolean;
}

interface Props {
  // Wall centre in Three-space (Y is up). `cy` is anchored to `height`
  // (the START height) — see buildWallGeometry — so a sloped wall keeps
  // the same bottom as a flat one of that height.
  cx: number;
  cy: number;
  cz: number;
  // Wall extents. `length` runs along the wall; `depth` is wall thickness.
  length: number;
  depth: number;
  height: number;
  // Optional END height for a sloped top. When present and != height, the
  // top slants from `height` at the start end (local -X) to `heightEnd` at
  // the end (local +X). Omitted / equal ⇒ a plain flat-top box.
  heightEnd?: number;
  // Wall's orientation as a rotation around the Y axis, in radians.
  // 0 = wall runs along X (east-west); Math.PI/2 = along Z (north-south).
  rotY: number;
  color: string;
  openings: WallOpening[];
  // Project units settings (system + per_unit). Scales the laterite texture so
  // its physical block size stays constant across projects with different units.
  units?: { system?: string; per_unit?: number };
  // External (weather-facing) walls get the laterite stone texture; internal
  // partitions stay flat-painted (`color`) so the two read distinctly. Default
  // external when unspecified.
  external?: boolean;
  // For external walls, which face is the weather face — the sign of the wall's
  // LOCAL +Z (thickness) axis (+1, -1, or 0 = both). Everything except the
  // opposite (inner) face gets the laterite texture — outer face, top, ends and
  // opening reveals included — so exposed edges wrap in brick; only the inner
  // face stays flat-painted (interior surface).
  outerSign?: number;
}

// A single shared evaluator — creating one per mesh is wasteful.
const evaluator = new Evaluator();
evaluator.useGroups = false;

export function WallWithOpenings(props: Props) {
  const { cx, cy, cz, length, depth, height, heightEnd, rotY, color, openings, units, external = true, outerSign = 0 } = props;

  const uvK = wallUvK(units);
  const geometry = useMemo(() => {
    const g = buildWallGeometry(length, depth, height, heightEnd, openings, uvK);
    // Split the mesh into two material groups: the outward (weather) face →
    // laterite, everything else (inner face, top, ends, opening reveals) →
    // plain paint. Only needed for external walls.
    if (external) splitOuterFaceGroups(g, outerSign);
    return g;
  }, [length, depth, height, heightEnd, openings, uvK, external, outerSign]);

  const laterite = lateriteMaps();

  return (
    <mesh
      geometry={geometry}
      position={[cx, cy, cz]}
      rotation={[0, rotY, 0]}
      castShadow
      receiveShadow
    >
      {external ? (
        // group 0 = outward face (laterite stone); group 1 = every other face
        // (interior paint) — so the inside of an external wall reads as interior.
        <>
          <meshStandardMaterial
            attach="material-0"
            map={laterite.map}
            bumpMap={laterite.bump}
            bumpScale={1.2}
            roughness={0.95}
            metalness={0}
          />
          <meshStandardMaterial attach="material-1" color={color} roughness={0.9} metalness={0} />
        </>
      ) : (
        // Interior partitions: flat paint (as before), for clear contrast.
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      )}
    </mesh>
  );
}

// Reorder a wall's triangles into two contiguous index runs — the outward
// (weather) face first, then everything else — and set two geometry groups
// (materialIndex 0 = outer/laterite, 1 = inner/plain). The wall is authored in
// its LOCAL frame with thickness along Z, so the outward face is the big face
// whose triangle normal points along `outerSign * Z`. outerSign 0 (both faces
// weather-facing) textures both big faces.
function splitOuterFaceGroups(geom: THREE.BufferGeometry, outerSign: number): void {
  const pos = geom.getAttribute("position");
  if (!pos) return;
  const existing = geom.getIndex();
  const triCount = existing ? existing.count / 3 : pos.count / 3;
  const gi = (i: number) => (existing ? existing.getX(i) : i);
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  const brick: number[] = [], plain: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = gi(t * 3), b = gi(t * 3 + 1), c = gi(t * 3 + 2);
    vA.fromBufferAttribute(pos, a);
    vB.fromBufferAttribute(pos, b);
    vC.fromBufferAttribute(pos, c);
    ab.subVectors(vB, vA);
    ac.subVectors(vC, vA);
    n.crossVectors(ab, ac).normalize();
    // ONLY the inner big face (the Z-face opposite the weather face) is interior
    // paint; every other face — outer face, top, ends, opening reveals — is
    // exterior brick, so the wall's exposed edges/corners wrap in brick rather
    // than showing bare plaster trim. outerSign 0 (freestanding) ⇒ no inner
    // face, so the whole wall is brick.
    const isInnerFace = outerSign !== 0 && Math.abs(n.z) > 0.5 && Math.sign(n.z) === -outerSign;
    (isInnerFace ? plain : brick).push(a, b, c);
  }
  geom.setIndex(brick.concat(plain));
  geom.clearGroups();
  if (brick.length) geom.addGroup(0, brick.length, 0);
  if (plain.length) geom.addGroup(brick.length, plain.length, 1);
}

// The wall is built in its LOCAL frame — origin at the wall's centre,
// X along wall length, Y up, Z across wall thickness. The caller
// rotates it into world orientation via rotY.
function buildWallGeometry(
  length: number,
  depth: number,
  height: number,
  heightEnd: number | undefined,
  openings: WallOpening[],
  uvK: number,
): THREE.BufferGeometry {
  // Flat top (box) unless a distinct end height is given, in which case
  // build a sloped-top prism. Both share the same bottom (local Y =
  // -height/2), so the caller's `cy` and the opening-cutter maths (which
  // use `height`) are identical for either.
  const wallGeom =
    heightEnd === undefined || heightEnd === height
      ? new THREE.BoxGeometry(length, height, depth)
      : buildSlopedWall(length, depth, height, heightEnd);
  if (openings.length === 0) return applyPlanarUV(wallGeom, uvK);

  let brush = new Brush(wallGeom);
  brush.updateMatrixWorld();

  for (const op of openings) {
    // Cutter extends slightly beyond the wall thickness (depth + a hair)
    // so CSG doesn't leave a razor-thin sliver on the far face.
    const cutterGeom = new THREE.BoxGeometry(
      op.width,
      op.height,
      depth + 0.5,
    );
    const cutter = new Brush(cutterGeom);
    // Position the cutter in the wall's local frame:
    //   X: opening centre along the wall's length
    //   Y: opening centre stacked from bottom
    //   Z: 0 (centred through wall thickness)
    cutter.position.set(
      op.along + op.width / 2 - length / 2,
      op.from + op.height / 2 - height / 2,
      0,
    );
    cutter.updateMatrixWorld();

    brush = evaluator.evaluate(brush, cutter, SUBTRACTION);
    cutterGeom.dispose();
  }

  // Extract the final geometry from the resulting brush.
  const outGeom = brush.geometry.clone();
  wallGeom.dispose();
  return applyPlanarUV(outGeom, uvK);
}

// Project UVs onto the wall's principal face using its LOCAL frame: U = local
// x (along the wall's length), V = local y (up). Because every wall is built
// axis-aligned in local space with its face normal along ±Z, this maps the
// laterite texture cleanly across the visible faces at a consistent world
// scale (thin end/reveal faces smear a little but are largely hidden).
function applyPlanarUV(geom: THREE.BufferGeometry, uvK: number): THREE.BufferGeometry {
  const pos = geom.getAttribute("position");
  if (!pos) return geom;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * uvK;
    uv[i * 2 + 1] = pos.getY(i) * uvK;
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geom;
}

// A wall with a sloped top: same bottom (local Y = -heightStart/2) as the
// equivalent flat box of `heightStart`, with the top edge running from
// `heightStart` at the start end (local -X) to `heightEnd` at the end
// (+X). Built as an extruded trapezoidal profile (XY), depth along Z.
function buildSlopedWall(
  length: number,
  depth: number,
  heightStart: number,
  heightEnd: number,
): THREE.BufferGeometry {
  const bottom = -heightStart / 2;
  const s = new THREE.Shape();
  s.moveTo(-length / 2, bottom);               // start-bottom
  s.lineTo(length / 2, bottom);                // end-bottom
  s.lineTo(length / 2, bottom + heightEnd);    // end-top
  s.lineTo(-length / 2, bottom + heightStart); // start-top
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  // ExtrudeGeometry runs Z from 0..depth; recentre across the wall thickness.
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// Openings are filled by <OpeningPane> (see ./openings) — a framed, glazed
// window or a slab door dropped into the CSG hole.
