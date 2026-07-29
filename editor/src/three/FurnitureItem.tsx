// GLB furniture / decor instance (config `item` object). Loads the asset's GLB,
// scales it from metres into project units, auto-seats it on the floor, and places
// it at the item's plan centre with a yaw + uniform user resize.
//
// Robustness (borrowed from Pascal's item model-loader): a missing / failed / still-
// loading GLB never blanks the house — it falls back to a translucent "ghost" box at
// the asset's declared footprint, so the piece is still visible, correctly sized, and
// selectable while the real model is unavailable.
//
// Coordinate note: Wadi's three world is Y-up (toThreePos maps ThreeY = worldZ up), so
// a standard Y-up GLB drops in upright — we only need footprint placement + the
// metres→units scale. `offset`/`corrRotation`/`corrScale` are corrective transforms in
// the GLB's own metre space (usually all defaults for a clean CC0 model).

import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, MathUtils, Vector3, type Object3D } from "three";

export interface FurnitureItemProps {
  src: string;
  /** [w, h, d] in METRES. */
  dimensions: [number, number, number];
  /** Corrective transforms in the GLB's own metre space. */
  offset?: [number, number, number];
  corrRotation?: [number, number, number]; // degrees
  corrScale?: [number, number, number];
  /** Three-world placement: (cx, cz) = recentred plan centre, baseY = floor-top Z. */
  cx: number;
  cz: number;
  baseY: number;
  /** Yaw about the vertical axis, degrees. */
  yawDeg?: number;
  /** Uniform user resize on top of the real-world size. */
  userScale?: number;
  /** Project units per metre for this house (metersToUnits(1, units)). */
  unitsScale: number;
}

// Loads + seats the GLB. Suspends while loading; throws on load failure (both caught
// by the wrapper below).
function ItemGLB(props: FurnitureItemProps) {
  const { src, dimensions, offset, corrRotation, corrScale, cx, cz, baseY, yawDeg, userScale, unitsScale } = props;
  const gltf = useGLTF(src);

  // Clone so instances don't share one Object3D; bake the corrective transform; then
  // measure the result to (a) auto-seat it (base → 0, centred in plan, in native GLB
  // space) and (b) NORMALISE its scale. GLBs are not authored in a common unit (Kenney's
  // are at an arbitrary kit scale), so rather than trust the native size we scale the
  // model so its largest horizontal extent equals the asset's declared real-world
  // footprint (metres → project units). Proportions are preserved; the ghost box uses
  // the same declared size, so placeholder and real model read identically.
  const { node, seatX, seatY, seatZ, norm } = useMemo(() => {
    const clone = (gltf.scene as Object3D).clone(true);
    if (offset) clone.position.set(offset[0], offset[1], offset[2]);
    if (corrRotation) {
      clone.rotation.set(
        MathUtils.degToRad(corrRotation[0]),
        MathUtils.degToRad(corrRotation[1]),
        MathUtils.degToRad(corrRotation[2]),
      );
    }
    if (corrScale) clone.scale.set(corrScale[0], corrScale[1], corrScale[2]);
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const nativeHoriz = Math.max(size.x, size.z, 1e-6);
    const targetHorizUnits = Math.max(dimensions[0], dimensions[2]) * unitsScale;
    return {
      node: clone,
      seatX: -center.x,
      seatY: -box.min.y,
      seatZ: -center.z,
      norm: targetHorizUnits / nativeHoriz,
    };
  }, [gltf.scene, offset, corrRotation, corrScale, dimensions, unitsScale]);

  return (
    <group position={[cx, baseY, cz]} rotation={[0, MathUtils.degToRad(yawDeg ?? 0), 0]}>
      <group scale={norm * (userScale ?? 1)}>
        <group position={[seatX, seatY, seatZ]}>
          <primitive object={node} />
        </group>
      </group>
    </group>
  );
}

// Translucent placeholder at the asset footprint — shown while loading or when the GLB
// can't be fetched. Sized from the declared metre dimensions, so it stands in at the
// right scale.
function GhostBox({ dimensions, cx, cz, baseY, yawDeg, userScale, unitsScale, loading }: FurnitureItemProps & { loading?: boolean }) {
  const s = unitsScale * (userScale ?? 1);
  const w = dimensions[0] * s;
  const h = dimensions[1] * s;
  const d = dimensions[2] * s;
  return (
    <group position={[cx, baseY, cz]} rotation={[0, MathUtils.degToRad(yawDeg ?? 0), 0]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={loading ? "#9ca3af" : "#4f8f86"}
          transparent
          opacity={loading ? 0.25 : 0.5}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}

// R3F-compatible error boundary: renders the ghost box in place of a GLB that failed
// to load (bad URL, network error, unsupported file).
class ItemErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[item3d] GLB load failed — showing placeholder:", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function FurnitureItem(props: FurnitureItemProps) {
  return (
    <ItemErrorBoundary fallback={<GhostBox {...props} />}>
      <Suspense fallback={<GhostBox {...props} loading />}>
        <ItemGLB {...props} />
      </Suspense>
    </ItemErrorBoundary>
  );
}
