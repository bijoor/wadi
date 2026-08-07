// 3D capability for the `spiral_staircase` primitive (P5). A helix of tread slabs
// winding around a central pole. Pure R3F (three primitives, no GLB) — lazy-loaded
// by registry/nodes/spiralStaircase so the node module stays headless-pure.
//
// Frame: placed by the node at the group origin (cx, baseY, cz) in THREE space
// (Y up, project units used directly, like a beam/pillar). Everything here is local
// to that origin. A tread sits at radius `midR` along a per-step-rotated local X, so
// step i lands at plan angle i·Δθ and height i·rise.

export interface SpiralStaircaseProps {
  cx: number;
  cz: number;
  baseY: number;
  radius: number;
  totalHeight: number;
  turns?: number;
  steps?: number;
  treadThickness?: number;
  poleRadius?: number;
}

export function SpiralStaircase({
  cx,
  cz,
  baseY,
  radius,
  totalHeight,
  turns,
  steps,
  treadThickness,
  poleRadius,
}: SpiralStaircaseProps) {
  const t = turns && turns > 0 ? turns : 1;
  const n = Math.max(4, Math.round(steps && steps > 0 ? steps : t * 12));
  const rise = totalHeight / n;
  const dTheta = (t * 2 * Math.PI) / n;
  const pole = poleRadius && poleRadius > 0 ? poleRadius : Math.max(1.5, radius * 0.08);
  const thick = treadThickness && treadThickness > 0 ? treadThickness : Math.max(1, rise * 0.35);
  const treadLen = Math.max(0.1, radius - pole); // radial span, pole → outer
  const midR = (pole + radius) / 2;
  const arc = (2 * Math.PI * radius) / n; // tangential spacing between treads
  const treadDepth = Math.max(treadLen * 0.35, Math.min(arc * 0.95, radius));

  const treads = [];
  for (let i = 0; i < n; i++) {
    treads.push(
      <group key={i} rotation={[0, -i * dTheta, 0]}>
        <mesh position={[midR, i * rise + thick / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[treadLen, thick, treadDepth]} />
          <meshStandardMaterial color="#b98a4a" roughness={0.7} />
        </mesh>
      </group>,
    );
  }

  return (
    <group position={[cx, baseY, cz]}>
      <mesh position={[0, totalHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[pole, pole, totalHeight, 20]} />
        <meshStandardMaterial color="#8a8a8a" metalness={0.35} roughness={0.55} />
      </mesh>
      {treads}
    </group>
  );
}
