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
  kind: "door" | "window" | "gap";
  // When true, leave the opening bare (hole only) — no window/door fill. A `gap`
  // is inherently bare, so it is always treated as open.
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
  // A corner block belongs to ONE wall, so an INTERNAL wall that owns an external
  // corner would leave a bare (flat-paint) end cap next to the neighbouring
  // external wall's brick. These flag an END CAP as weather-exposed so it gets
  // brick even on an internal wall: `brickStart` = the local -X end (the wall's
  // start / smaller along-coord), `brickEnd` = the local +X end. On an EXTERNAL
  // wall the ends are already brick, so these are only consulted when the wall
  // body is internal.
  brickStart?: boolean;
  brickEnd?: boolean;
}

// A single shared evaluator — creating one per mesh is wasteful.
const evaluator = new Evaluator();
evaluator.useGroups = false;

export function WallWithOpenings(props: Props) {
  const { cx, cy, cz, length, depth, height, heightEnd, rotY, color, openings, units, external = true, outerSign = 0, brickStart = false, brickEnd = false } = props;

  // An internal wall is normally single-material flat paint, but if it owns an
  // exposed corner (an end cap open to weather) that end cap needs brick — so
  // the mesh is grouped whenever ANY face is brick, not only for external walls.
  const hasBrick = external || brickStart || brickEnd;
  const uvK = wallUvK(units);
  const geometry = useMemo(() => {
    const g = buildWallGeometry(length, depth, height, heightEnd, openings, uvK);
    // Split the mesh into two material groups (0 = laterite brick, 1 = plain
    // paint), deciding each face on its own: an external wall's outer face + top
    // + ends + reveals are brick and only the inner face is plain; an internal
    // wall is plain except for an exposed end cap flagged by brickStart/brickEnd.
    if (hasBrick) splitBrickGroups(g, external, outerSign, brickStart, brickEnd);
    return g;
  }, [length, depth, height, heightEnd, openings, uvK, external, outerSign, brickStart, brickEnd, hasBrick]);

  const laterite = lateriteMaps();

  return (
    <mesh
      geometry={geometry}
      position={[cx, cy, cz]}
      rotation={[0, rotY, 0]}
      castShadow
      receiveShadow
    >
      {hasBrick ? (
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

// Reorder a wall's triangles into two contiguous index runs — brick first, then
// plain paint — and set two geometry groups (materialIndex 0 = laterite, 1 =
// plain). The wall is authored in its LOCAL frame with X along its length, Y up,
// and thickness along Z, so faces are told apart by their triangle normal:
//   - big faces  (|n.z|>0.5): the two thickness faces (the wall's outer / inner)
//   - end caps   (|n.x|>0.5 AND at the extreme ±length/2): the wall's two ends
//   - reveals    (|n.x|>0.5 but interior in X): a door/window jamb
//   - top/bottom (n.y dominant)
// Decision, per face:
//   external wall → outer big face + top + ends + reveals brick, inner big face
//     plain (unchanged: outerSign is the sign of the outer big face's Z; 0 =
//     freestanding, so both big faces brick).
//   internal wall → all plain EXCEPT an end cap flagged brick because it owns an
//     exposed corner. This is the per-FACE fix: a corner shared by an external
//     and an internal wall no longer forces the whole corner block to one verdict.
function splitBrickGroups(
  geom: THREE.BufferGeometry,
  external: boolean,
  outerSign: number,
  brickStart: boolean,
  brickEnd: boolean,
): void {
  const pos = geom.getAttribute("position");
  if (!pos) return;
  const existing = geom.getIndex();
  const triCount = existing ? existing.count / 3 : pos.count / 3;
  const gi = (i: number) => (existing ? existing.getX(i) : i);
  // Half-length in local X, so an end cap (a triangle sitting at the extreme end)
  // is told apart from an interior opening reveal that also has an ±X normal.
  let halfLen = 0;
  for (let i = 0; i < pos.count; i++) halfLen = Math.max(halfLen, Math.abs(pos.getX(i)));
  const endEps = Math.max(0.25, halfLen * 1e-3);
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
    let isBrick: boolean;
    if (Math.abs(n.z) > 0.5) {
      // Big face: brick iff external and this is the outer face (outerSign 0 =
      // both faces weather → both brick).
      isBrick = external && (outerSign === 0 || Math.sign(n.z) === outerSign);
    } else if (Math.abs(n.x) > 0.5) {
      const cxT = (vA.x + vB.x + vC.x) / 3;
      const isEndCap = Math.abs(cxT) > halfLen - endEps;
      if (isEndCap) {
        // The wall's own end. On an external wall both ends brick (as before);
        // on an internal wall only an end flagged as an exposed corner.
        isBrick = external || (cxT > 0 ? brickEnd : brickStart);
      } else {
        // An interior opening reveal (jamb): brick only on an external wall.
        isBrick = external;
      }
    } else {
      // Top / bottom: brick only on an external wall (as before).
      isBrick = external;
    }
    (isBrick ? brick : plain).push(a, b, c);
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
    // An opening whose top reaches the wall top (a full-height gap / open
    // passage) would leave its cutter's top face COINCIDENT with the wall top —
    // CSG then leaves a razor sliver / z-fighting band there. Overshoot the top
    // by a hair in that case so the void reaches the top cleanly (this is what
    // the old "wall_height - 1" authoring hack was working around). The bottom
    // stays anchored at op.from, so doors/windows are unaffected.
    const reachesTop = op.from + op.height >= height - 1e-3;
    const cutH = op.height + (reachesTop ? 0.5 : 0);
    // Cutter extends slightly beyond the wall thickness (depth + a hair)
    // so CSG doesn't leave a razor-thin sliver on the far face.
    const cutterGeom = new THREE.BoxGeometry(
      op.width,
      cutH,
      depth + 0.5,
    );
    const cutter = new Brush(cutterGeom);
    // Position the cutter in the wall's local frame:
    //   X: opening centre along the wall's length
    //   Y: stacked from the bottom (op.from), so a taller cutH overshoots the top
    //   Z: 0 (centred through wall thickness)
    cutter.position.set(
      op.along + op.width / 2 - length / 2,
      op.from + cutH / 2 - height / 2,
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
