// Box primitives — one component per house-config object type. All
// coordinates arrive in Three.js space (post-toThreePos); the components
// just place a <boxGeometry> at the right centre with the right size.
//
// Coord mapping recap (from ./coords):
//   ThreeX = worldX (east)   width  = X extent
//   ThreeY = worldZ (up)     height = Z extent
//   ThreeZ = worldY (south)  depth  = Y extent

import { useMemo } from "react";
import type { Vec3 } from "./coords";
import { grassTexture } from "./procTextures";

interface CommonBoxProps {
  position: Vec3;
  size: Vec3;
  color: string;
  opacity?: number;
  onClick?: () => void;
}

function Box({ position, size, color, opacity = 1, onClick }: CommonBoxProps) {
  return (
    <mesh
      position={[position.x, position.y, position.z]}
      onClick={onClick}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[size.x, size.y, size.z]} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

// Ground plane — grassy lawn covering the plot (procedural, offline texture).
export function GroundPlane({ width, length }: { width: number; length: number }) {
  const w = width * 1.5;
  const l = length * 1.5;
  const grass = useMemo(() => grassTexture(Math.max(w, l) / 45), [w, l]);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.05, 0]}
      receiveShadow
    >
      <planeGeometry args={[w, l]} />
      <meshStandardMaterial map={grass} color="#8f9e78" roughness={1} metalness={0} />
    </mesh>
  );
}

// Plinth — one big slab, elevated to plinth-top.
export function PlinthBox({
  cx, cz, width, length, height,
}: {
  cx: number; cz: number; width: number; length: number; height: number;
}) {
  return (
    <Box
      position={{ x: cx, y: height / 2, z: cz }}
      size={{ x: width, y: height, z: length }}
      color="#a0826d"
    />
  );
}

// Shared RCC/concrete grey for slabs and beams — they're the same material,
// so they render identically (also used by the CSG-cut variants in House3D).
export const CONCRETE_COLOR = "#b8b8b8";

// Floor slab. `z` is the world-Z of the slab's bottom face.
export function FloorSlabBox({
  cx, cz, width, length, z, thickness,
}: {
  cx: number; cz: number; width: number; length: number;
  z: number; thickness: number;
}) {
  return (
    <Box
      position={{ x: cx, y: z + thickness / 2, z: cz }}
      size={{ x: width, y: thickness, z: length }}
      color={CONCRETE_COLOR}
    />
  );
}

// Beam — same concrete/RCC material as the slab, so it matches.
export function BeamBox({
  cx, cz, width, length, z, height,
}: {
  cx: number; cz: number; width: number; length: number;
  z: number; height: number;
}) {
  return (
    <Box
      position={{ x: cx, y: z + height / 2, z: cz }}
      size={{ x: width, y: height, z: length }}
      color={CONCRETE_COLOR}
    />
  );
}

// Pillar — cuboid centred at (cx, cz) with square footprint by default.
export function PillarBox({
  cx, cz, width, length, z, height,
}: {
  cx: number; cz: number; width: number; length: number;
  z: number; height: number;
}) {
  return (
    <Box
      position={{ x: cx, y: z + height / 2, z: cz }}
      size={{ x: width, y: height, z: length }}
      color="#f5f5f5"
    />
  );
}

// One wall segment as a box. Handles both axis-aligned room walls and
// standalone walls (which may be at arbitrary orientation — for now we
// assume axis-aligned; diagonal walls arrive in Phase 5's roof-frame
// pass if ever needed).
export function WallBox({
  cx, cz, width, depth, z, height, color = "#e8e5df",
}: {
  cx: number; cz: number; width: number; depth: number;
  z: number; height: number; color?: string;
}) {
  return (
    <Box
      position={{ x: cx, y: z + height / 2, z: cz }}
      size={{ x: width, y: height, z: depth }}
      color={color}
    />
  );
}

// Compound boundary wall — sandy/brick tone.
export function CompoundWallBox({
  cx, cz, width, depth, z, height,
}: {
  cx: number; cz: number; width: number; depth: number;
  z: number; height: number;
}) {
  return (
    <Box
      position={{ x: cx, y: z + height / 2, z: cz }}
      size={{ x: width, y: height, z: depth }}
      color="#c19a6b"
    />
  );
}

// Well parapet ring — short stone-grey cylinder (or box for non-circular).
export function WellBox({
  cx, cz, diameter, parapetHeight, z,
}: {
  cx: number; cz: number; diameter: number; parapetHeight: number; z: number;
}) {
  return (
    <mesh position={[cx, z + parapetHeight / 2, cz]} castShadow receiveShadow>
      <cylinderGeometry args={[diameter / 2, diameter / 2, parapetHeight, 32]} />
      <meshStandardMaterial color="#888888" roughness={0.9} />
    </mesh>
  );
}

// Solar panel array — flat dark-blue box tilted `tiltDeg` toward the sky,
// rotated to face compass bearing `azimuthDeg`. `y` = floor/roof level.
export function SolarPanelBox({
  cx, cz, width, depth, y, tiltDeg, azimuthDeg,
}: {
  cx: number; cz: number; width: number; depth: number;
  y: number; tiltDeg: number; azimuthDeg: number;
}) {
  const thickness = 2;
  // compass azimuth → Three.js Y rotation (south=+Z, azimuth=180 → no rotation)
  const rotY = ((180 - azimuthDeg) * Math.PI) / 180;
  const rotX = (tiltDeg * Math.PI) / 180;
  return (
    <mesh position={[cx, y + thickness / 2, cz]} rotation={[rotX, rotY, 0]} castShadow>
      <boxGeometry args={[width, thickness, depth]} />
      <meshStandardMaterial color="#1c2e6e" metalness={0.5} roughness={0.2} />
    </mesh>
  );
}

// Opening overlay — a thin darker rect painted on the wall face
// (approximation, no boolean subtraction yet). We centre a very thin
// box just outside the wall so it reads as a decal.
export function OpeningOverlay({
  cx, cz, width, depth, z, height, kind, orientation,
}: {
  cx: number; cz: number; width: number; depth: number;
  z: number; height: number;
  kind: "door" | "window";
  orientation: "ns" | "ew"; // ns = wall runs east-west, ew = wall runs north-south
}) {
  const color = kind === "door" ? "#4a2f1a" : "#7ab6ff";
  return (
    <Box
      position={{ x: cx, y: z + height / 2, z: cz }}
      size={{ x: width, y: height, z: depth }}
      color={color}
      opacity={kind === "window" ? 0.55 : 1}
    />
  );
  void orientation; // kept for future decal-rotation work
}
