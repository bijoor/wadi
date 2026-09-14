// Tiled cabinet door/drawer fronts for a `counter` with `cabinet` set (Phase B of
// plans/parametric-furniture-elements.md). Loads a front GLB (cabinet_door /
// cabinet_drawer) once and instances it N times across the carcass front, each scaled
// UNIFORMLY so the handle/panel proportions are preserved (a GLB front can't stretch to
// an arbitrary slot without distortion). N is chosen so each door is about as wide as it
// is when scaled to fill the body height, then every door is centred in its slot.
//
// Rendered INSIDE the counter's already-positioned+rotated group, so all coordinates are
// LOCAL to the run: X = along the length, Y = up from the floor base, Z = depth (the
// front/room face is -Z). A load failure renders nothing (the carcass still shows).

import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3, type Object3D } from "three";

export interface CounterFrontsProps {
  src: string;
  length: number; // run length (project units), local X
  bodyH: number; // carcass body height (project units), local Y span available
  baseY: number; // local Y of the body bottom (toe-kick height)
  frontZ: number; // local Z of the front (room-facing) face
  gap?: number; // gap between adjacent fronts (project units)
}

function FrontsGLB({ src, length, bodyH, baseY, frontZ, gap = 1.5 }: CounterFrontsProps) {
  const gltf = useGLTF(src);
  const { node, nw, nh, nt, cx, cy, cz } = useMemo(() => {
    const clone = (gltf.scene as Object3D).clone(true);
    clone.updateMatrixWorld(true);
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    return {
      node: clone,
      nw: Math.max(size.x, 1e-6),
      nh: Math.max(size.y, 1e-6),
      nt: Math.max(size.z, 1e-6),
      cx: center.x,
      cy: center.y,
      cz: center.z,
    };
  }, [gltf.scene]);

  // A door scaled to fill the body height is `nw/nh * bodyH` wide; tile that many across.
  const doorAtBodyH = (nw / nh) * bodyH;
  const count = Math.max(1, Math.round(length / Math.max(doorAtBodyH, 1e-6)));
  const slotW = length / count;
  // Uniform scale: fit within the slot width and the body height (whichever binds).
  const s = Math.min((slotW - gap) / nw, bodyH / nh);
  const halfT = (nt * s) / 2;

  // The room-facing front is +Z local; the door protrudes outward from that face.
  const out = Math.sign(frontZ) || 1;
  const doors: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const lx = -length / 2 + slotW * (i + 0.5);
    doors.push(
      <group key={i} position={[lx, baseY + bodyH / 2, frontZ + out * halfT]}>
        <group scale={s} position={[-cx * s, -cy * s, -cz * s] as [number, number, number]}>
          <primitive object={node.clone(true)} />
        </group>
      </group>,
    );
  }
  return <>{doors}</>;
}

// Never let a missing/failed GLB blank the model — render nothing on error.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function CounterFronts(props: CounterFrontsProps) {
  return (
    <Boundary>
      <Suspense fallback={null}>
        <FrontsGLB {...props} />
      </Suspense>
    </Boundary>
  );
}
