// Gable-roof mesh — two sloping rectangular surfaces meeting at a
// central ridge, with vertical triangular gable-end walls at each
// end of the ridge. Simpler than hip: no hip diagonals, ridge runs
// the full length of the roof.
//
// Geometry recap for ridge_axis='y':
//   eave corners (all at eave_z):
//     NW (xw, yn),  NE (xe, yn),  SE (xe, ys),  SW (xw, ys)
//   ridge endpoints (at eave_z + wall_top_above_eave + ridge_h):
//     R1 = (ridge_x, yn),  R2 = (ridge_x, ys)   with ridge_x = (xw+xe)/2
//   faces:
//     W slope (rect): NW → SW → R2 → R1
//     E slope (rect): NE → R1 → R2 → SE
//     N gable-end wall (tri): NW → R1 → NE
//     S gable-end wall (tri): SE → R2 → SW

import { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "./coords";
import type { GableRoofGeom } from "../svg2d/roof/gableGeometry";

interface Props {
  geom: GableRoofGeom;
  plotWidth: number;
  plotLength: number;
  color?: string;
  gableWallColor?: string;
  shellLift?: number;
}

export function GableRoofMesh({
  geom,
  plotWidth,
  plotLength,
  color = "#c8582f",
  gableWallColor = "#f5f1e8",
  shellLift = 5,
}: Props) {
  const { slopeGeometry, gableWallGeometry } = useMemo(() => {
    return buildGableRoof(geom, plotWidth, plotLength, shellLift);
  }, [geom, plotWidth, plotLength, shellLift]);

  return (
    <group>
      <mesh geometry={slopeGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
      <mesh geometry={gableWallGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={gableWallColor}
          side={THREE.DoubleSide}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

// Split the shell into two BufferGeometries so the sloping tile
// surfaces and the (typically plaster-coloured) gable-end walls can
// take different materials without splitting draw calls per face.
function buildGableRoof(
  g: GableRoofGeom,
  plotWidth: number,
  plotLength: number,
  shellLift: number,
) {
  const t = (wx: number, wy: number, wz: number): Vec3 => ({
    x: wx - plotWidth / 2,
    y: wz,
    z: wy - plotLength / 2,
  });

  const eaveZ = g.eave_z + shellLift;
  const ridgeZ = eaveZ + g.wall_top_above_eave + g.ridge_h;
  const ridgeX = (g.eave_x_west + g.eave_x_east) / 2;

  const nw = t(g.eave_x_west, g.eave_y_north, eaveZ);
  const ne = t(g.eave_x_east, g.eave_y_north, eaveZ);
  const se = t(g.eave_x_east, g.eave_y_south, eaveZ);
  const sw = t(g.eave_x_west, g.eave_y_south, eaveZ);
  const r1 = t(ridgeX, g.ridge_y_start, ridgeZ);
  const r2 = t(ridgeX, g.ridge_y_end, ridgeZ);

  // ---- Sloping tile surfaces (west + east) ------------------------
  const slopeVerts: number[] = [
    nw.x, nw.y, nw.z, // 0
    ne.x, ne.y, ne.z, // 1
    se.x, se.y, se.z, // 2
    sw.x, sw.y, sw.z, // 3
    r1.x, r1.y, r1.z, // 4
    r2.x, r2.y, r2.z, // 5
  ];
  const slopeIdx: number[] = [
    // W slope (rectangle NW-SW-R2-R1) split into 2 tris, CCW from west
    0, 3, 5,
    0, 5, 4,
    // E slope (rectangle NE-R1-R2-SE) split into 2 tris, CCW from east
    1, 4, 5,
    1, 5, 2,
  ];
  const slopeGeometry = new THREE.BufferGeometry();
  slopeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(slopeVerts, 3),
  );
  slopeGeometry.setIndex(slopeIdx);
  slopeGeometry.computeVertexNormals();

  // ---- Vertical gable-end walls (north + south triangles) ---------
  // These are the plaster infill above the wall top, closing off each
  // end of the roof. They rise from the eave-level corners up to the
  // ridge endpoint.
  const gableVerts: number[] = [
    nw.x, nw.y, nw.z, // 0
    r1.x, r1.y, r1.z, // 1
    ne.x, ne.y, ne.z, // 2
    se.x, se.y, se.z, // 3
    r2.x, r2.y, r2.z, // 4
    sw.x, sw.y, sw.z, // 5
  ];
  const gableIdx: number[] = [
    // N gable end (NW → R1 → NE, CCW viewed from north)
    0, 1, 2,
    // S gable end (SE → R2 → SW, CCW viewed from south)
    3, 4, 5,
  ];
  const gableWallGeometry = new THREE.BufferGeometry();
  gableWallGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(gableVerts, 3),
  );
  gableWallGeometry.setIndex(gableIdx);
  gableWallGeometry.computeVertexNormals();

  return { slopeGeometry, gableWallGeometry };
}
