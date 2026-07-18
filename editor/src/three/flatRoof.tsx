// Flat-roof shell — a horizontal slab covering the roof footprint,
// plus optional parapet walls around the perimeter. Renders as a
// stack of thin box meshes so the roof + parapet can take different
// materials without splitting draw calls per face.

import { useMemo } from "react";
import type { Vec3 } from "./coords";
import type { FlatRoofGeom } from "../svg2d/roof/flatGeometry";

interface Props {
  geom: FlatRoofGeom;
  plotWidth: number;
  plotLength: number;
  color?: string;         // slab (deck) colour
  parapetColor?: string;  // plaster / cream
}

export function FlatRoofMesh({
  geom,
  plotWidth,
  plotLength,
  color = "#8a8a8a",
  parapetColor = "#f5f1e8",
}: Props) {
  const boxes = useMemo(
    () => buildFlatRoof(geom, plotWidth, plotLength),
    [geom, plotWidth, plotLength],
  );
  return (
    <group>
      {/* Slab */}
      <mesh
        position={boxes.slab.pos}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[boxes.slab.size.x, boxes.slab.size.y, boxes.slab.size.z]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Parapet walls (N, S, E, W) — only rendered when parapet_height > 0 */}
      {boxes.parapet.map((p, i) => (
        <mesh key={i} position={p.pos} castShadow receiveShadow>
          <boxGeometry args={[p.size.x, p.size.y, p.size.z]} />
          <meshStandardMaterial color={parapetColor} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

interface Box {
  pos: [number, number, number];
  size: Vec3;
}

function buildFlatRoof(
  g: FlatRoofGeom,
  plotWidth: number,
  plotLength: number,
): { slab: Box; parapet: Box[] } {
  const t = (wx: number, wy: number, wz: number): Vec3 => ({
    x: wx - plotWidth / 2,
    y: wz,
    z: wy - plotLength / 2,
  });

  const slabW = g.eave_x_east - g.eave_x_west;
  const slabL = g.eave_y_south - g.eave_y_north;
  const slabCentreX = (g.eave_x_west + g.eave_x_east) / 2;
  const slabCentreY = (g.eave_y_north + g.eave_y_south) / 2;
  const slabCentreZ = g.slab_bottom_z + g.slab_thickness / 2;
  const c = t(slabCentreX, slabCentreY, slabCentreZ);
  const slab: Box = {
    pos: [c.x, c.y, c.z],
    size: { x: slabW, y: g.slab_thickness, z: slabL },
  };

  const parapet: Box[] = [];
  if (g.parapet_height > 0) {
    const pt = g.parapet_thickness;
    const ph = g.parapet_height;
    // Parapet sits on top of the slab.
    const parapetCentreZ = g.eave_z + ph / 2;
    // North parapet — runs along X at the north edge (y = eave_y_north).
    // Its FACE is at the outer eave; its centreline is inset by pt/2.
    const nc = t(slabCentreX, g.eave_y_north + pt / 2, parapetCentreZ);
    parapet.push({
      pos: [nc.x, nc.y, nc.z],
      size: { x: slabW, y: ph, z: pt },
    });
    // South parapet
    const sc = t(slabCentreX, g.eave_y_south - pt / 2, parapetCentreZ);
    parapet.push({
      pos: [sc.x, sc.y, sc.z],
      size: { x: slabW, y: ph, z: pt },
    });
    // West parapet — inset from the corners so it doesn't double up
    // with the N/S segments.
    const parapetL = slabL - 2 * pt;
    const wc = t(g.eave_x_west + pt / 2, slabCentreY, parapetCentreZ);
    parapet.push({
      pos: [wc.x, wc.y, wc.z],
      size: { x: pt, y: ph, z: parapetL },
    });
    // East parapet
    const ec = t(g.eave_x_east - pt / 2, slabCentreY, parapetCentreZ);
    parapet.push({
      pos: [ec.x, ec.y, ec.z],
      size: { x: pt, y: ph, z: parapetL },
    });
  }

  return { slab, parapet };
}
