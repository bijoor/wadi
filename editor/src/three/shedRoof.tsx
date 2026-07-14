// Shed (mono-pitch) roof shell — a single sloped quadrilateral
// panel between the high and low eave edges. Two vertical
// triangular gable-end walls if slope_dir is N/S (or E/W flipped
// for the perpendicular case).

import { useMemo } from "react";
import * as THREE from "three";
import type { Vec3 } from "./coords";
import type { ShedRoofGeom } from "../svg2d/roof/shedGeometry";

interface Props {
  geom: ShedRoofGeom;
  plotWidth: number;
  plotLength: number;
  color?: string;
  wallColor?: string;
}

export function ShedRoofMesh({
  geom,
  plotWidth,
  plotLength,
  color = "#c8582f",
  wallColor = "#f5f1e8",
}: Props) {
  const { slopeGeometry, wallGeometry } = useMemo(
    () => buildShedRoof(geom, plotWidth, plotLength),
    [geom, plotWidth, plotLength],
  );
  return (
    <group>
      <mesh geometry={slopeGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh geometry={wallGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

function buildShedRoof(g: ShedRoofGeom, plotWidth: number, plotLength: number) {
  const t = (wx: number, wy: number, wz: number): Vec3 => ({
    x: wx - plotWidth / 2,
    y: wz,
    z: wy - plotLength / 2,
  });

  // Corners on the slope plane. For slope_dir='south' (low = south),
  // the north edge is HIGH (eave_z_high) and south is LOW (eave_z_low).
  // For 'north', reversed. For 'east'/'west', the high/low is along X.
  let nwZ: number, neZ: number, seZ: number, swZ: number;
  switch (g.slope_dir) {
    case "south":
      // Low = south → south edge low, north edge high
      nwZ = g.eave_z_high; neZ = g.eave_z_high;
      swZ = g.eave_z_low;  seZ = g.eave_z_low;
      break;
    case "north":
      // Low = north → north edge low, south edge high
      nwZ = g.eave_z_low;  neZ = g.eave_z_low;
      swZ = g.eave_z_high; seZ = g.eave_z_high;
      break;
    case "east":
      // Low = east → east edge low, west edge high
      nwZ = g.eave_z_high; swZ = g.eave_z_high;
      neZ = g.eave_z_low;  seZ = g.eave_z_low;
      break;
    case "west":
    default:
      // Low = west → west edge low, east edge high
      nwZ = g.eave_z_low;  swZ = g.eave_z_low;
      neZ = g.eave_z_high; seZ = g.eave_z_high;
      break;
  }

  const nw = t(g.eave_x_west, g.eave_y_north, nwZ);
  const ne = t(g.eave_x_east, g.eave_y_north, neZ);
  const se = t(g.eave_x_east, g.eave_y_south, seZ);
  const sw = t(g.eave_x_west, g.eave_y_south, swZ);

  // Slope surface (quadrilateral)
  const slopeVerts = [
    nw.x, nw.y, nw.z, // 0
    ne.x, ne.y, ne.z, // 1
    se.x, se.y, se.z, // 2
    sw.x, sw.y, sw.z, // 3
  ];
  const slopeIdx = [0, 1, 2, 0, 2, 3];
  const slopeGeometry = new THREE.BufferGeometry();
  slopeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(slopeVerts, 3));
  slopeGeometry.setIndex(slopeIdx);
  slopeGeometry.computeVertexNormals();

  // The two GABLE-END walls (triangular infill above wall top). Which
  // edges have triangles depends on slope_dir: for N/S slopes, the
  // triangles are on E and W ends (because ridge/high-edge runs E-W).
  // For E/W slopes, triangles are on N and S ends.
  const wallVerts: number[] = [];
  const wallIdx: number[] = [];
  const pushTri = (a: Vec3, b: Vec3, c: Vec3) => {
    const base = wallVerts.length / 3;
    wallVerts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    wallIdx.push(base, base + 1, base + 2);
  };
  if (g.slope_dir === "south" || g.slope_dir === "north") {
    // Triangles on E and W ends. Each is a trapezoid actually — high
    // corner + low corner + wall bottom on each end. But since our
    // walls come from below, the triangle is high-corner + low-corner
    // + midpoint-at-lower Z? Actually the roof only NEEDS the
    // trapezoidal END-GABLE infill from eave-Z-low to eave-Z-high,
    // spanning eave_y_north → eave_y_south on that end.
    // Simpler: a quad on each end (west + east) between (high) and (low).
    // West end quad: (eave_x_west, ey_n, nwZ) → (eave_x_west, ey_n, eave_z_low)
    //                → (eave_x_west, ey_s, eave_z_low) → (eave_x_west, ey_s, swZ)
    // Two triangles. Since nwZ != swZ (one high, one low), this forms a
    // trapezoid-like shape that closes off the end.
    const wLow = t(g.eave_x_west, g.eave_y_north, g.eave_z_low);
    const wLow2 = t(g.eave_x_west, g.eave_y_south, g.eave_z_low);
    pushTri(nw, wLow, wLow2); // may collapse if nwZ == eave_z_low
    pushTri(nw, wLow2, sw);
    const eLow = t(g.eave_x_east, g.eave_y_north, g.eave_z_low);
    const eLow2 = t(g.eave_x_east, g.eave_y_south, g.eave_z_low);
    pushTri(ne, eLow, eLow2);
    pushTri(ne, eLow2, se);
  } else {
    // slope_dir E or W → triangles on N and S ends
    const nLow = t(g.eave_x_west, g.eave_y_north, g.eave_z_low);
    const nLow2 = t(g.eave_x_east, g.eave_y_north, g.eave_z_low);
    pushTri(nw, nLow, nLow2);
    pushTri(nw, nLow2, ne);
    const sLow = t(g.eave_x_west, g.eave_y_south, g.eave_z_low);
    const sLow2 = t(g.eave_x_east, g.eave_y_south, g.eave_z_low);
    pushTri(sw, sLow, sLow2);
    pushTri(sw, sLow2, se);
  }
  const wallGeometry = new THREE.BufferGeometry();
  wallGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wallVerts, 3));
  wallGeometry.setIndex(wallIdx);
  wallGeometry.computeVertexNormals();

  return { slopeGeometry, wallGeometry };
}
