// Countertop slab with an optional SHAPED hole (the sink bowl outline) — Phase C polish
// of plans/parametric-furniture-elements.md. The border-box hole was rectangular; this
// cuts the actual bowl silhouette (derived from the GLB in Blender) via a THREE.Shape
// with a hole Path extruded to the slab thickness (no CSG).
//
// Coordinates: the counter's local frame is X = length, Z = depth, Y = up. A THREE.Shape
// lives in its own XY plane extruded along +Z, so we author the shape as (x, -z) and
// rotateX(-90°) to lay it flat (shape +Z → world +Y), then translate to the slab bottom.

import { useMemo } from "react";
import { Shape, Path, ExtrudeGeometry } from "three";

export interface CounterTopProps {
  length: number; // X extent (project units)
  depth: number; // Z extent
  thickness: number; // slab thickness (Y)
  bottomY: number; // local Y of the slab underside
  color: string;
  roughness: number;
  /** Hole outline in counter-local (x, z), or undefined for a solid slab. */
  hole?: { x: number; z: number }[];
}

export function CounterTop({ length, depth, thickness, bottomY, color, roughness, hole }: CounterTopProps) {
  const geometry = useMemo(() => {
    const hw = length / 2;
    const hd = depth / 2;
    const s = new Shape();
    // Outer rectangle, authored as (x, -z).
    s.moveTo(-hw, hd);
    s.lineTo(hw, hd);
    s.lineTo(hw, -hd);
    s.lineTo(-hw, -hd);
    s.closePath();
    if (hole && hole.length >= 3) {
      const p = new Path();
      hole.forEach((pt, i) => {
        const sx = pt.x;
        const sy = -pt.z;
        if (i === 0) p.moveTo(sx, sy);
        else p.lineTo(sx, sy);
      });
      p.closePath();
      s.holes.push(p);
    }
    const g = new ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); // shape XY → ground plane, extrude → up
    g.translate(0, bottomY, 0);
    return g;
  }, [length, depth, thickness, bottomY, hole]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}
