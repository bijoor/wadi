// Hip-roof structural frame — ring beam, central ridge, hip beams,
// trusses (Fink), rafters, purlins. Rendered as box primitives from the
// same derived roof geometry the 2D roof plan uses (roofGeometry.ts),
// so the 3D preview and roof_top_view.svg / roof_perspective.svg agree.
//
// Coordinates arrive in world (Inkscape-style) units; we convert to
// Three-space via toThreePos. Sizes come from hip_roof.framing:
//   *_size_in       [width_in, depth_in]  — inches, 1 in = 10/12 units
//   *_spacing_in    inches between members
//
// Members are grouped into two visual buckets so the layer panel can
// hide them independently later:
//   frame_spine   — ring beam, ridge, hip beams, trusses  (darker)
//   frame_surface — rafters, purlins                       (lighter)

import { useMemo } from "react";
import * as THREE from "three";
import { toThreePos, type Vec3 } from "./coords";
import { DEFAULT_GLOBAL_CONFIG } from "../svg2d/config";

// Inch → world-unit conversion. The house config uses 10 units per foot,
// i.e. 10/12 units per inch. All framing sizes come in inches.
export const IN = 10 / 12;

// Fallback chain for the frame member specs: roof-level framing block
// wins over the GlobalConfig defaults. Called by both the hip renderer
// (below) and the gable renderer in gableRoofFrame.tsx.
export function resolveFraming(fr: RoofFraming): {
  ridge_size_in: [number, number];
  rafter_size_in: [number, number];
  purlin_size_in: [number, number];
  ring_beam_size_in: [number, number];
  rafter_spacing_in: number;
  purlin_spacing_in: number;
} {
  const g = DEFAULT_GLOBAL_CONFIG.roof_framing;
  return {
    ridge_size_in: fr.ridge_size_in ?? g.ridge_size_in,
    rafter_size_in: fr.rafter_size_in ?? g.rafter_size_in,
    purlin_size_in: fr.purlin_size_in ?? g.purlin_size_in,
    ring_beam_size_in: fr.ring_beam?.size_in ?? g.ring_beam_size_in,
    rafter_spacing_in: fr.rafter_spacing_in ?? g.rafter_spacing_in,
    purlin_spacing_in: fr.purlin_spacing_in ?? g.purlin_spacing_in,
  };
}

// Total frame-stack thickness at the wall crossing:
//   ring_beam_depth + rafter_depth + purlin_depth
// Plus a small clearance so the shell sits VISIBLY above the purlin
// tops (avoids z-fighting stripes where the shell and purlin
// coincide). Callers use this to lift the roof shell (HipRoofMesh).
// The ridge beam in roofFrame is also lifted by `shellLift - ridge_d/2`
// so the ridge beam top continues to align with the shell peak.
const SHELL_CLEARANCE_U = 1.5;
export function computeShellLift(framing: RoofFraming): number {
  const rbD = (framing.ring_beam?.size_in?.[1] ?? 2) * IN;
  const rfD = (framing.rafter_size_in?.[1] ?? 4) * IN;
  const plD = (framing.purlin_size_in?.[1] ?? 1) * IN;
  return rbD + rfD + plD + SHELL_CLEARANCE_U;
}

export interface RoofFrameGeom {
  eave_x_west: number;
  eave_x_east: number;
  eave_y_north: number;
  eave_y_south: number;
  eave_z: number;
  ridge_y_start: number;
  ridge_y_end: number;
  ridge_h: number;
  ridge_axis: "y" | "x";
  ridge_ext_u?: number;
  // Vertical rise from eave_z to the level the frame rests on (top of
  // the top-floor walls + ring beam). Ring beam / hip-end beams /
  // truss bottom chords all sit at eave_z + this. Comes from
  // `roof_geometry.derive_for_house`'s `wall_top_above_eave`.
  wall_top_above_eave?: number;
  // Ring beam anchors to the actual wall edges, not the eave. When
  // omitted the ring beam falls back to the eave corners.
  ring_beam_x_west?: number;
  ring_beam_x_east?: number;
  ring_beam_y_north?: number;
  ring_beam_y_south?: number;
}

export interface RoofFraming {
  // Hollow-tube nominal size [width, depth] in inches. Rendered as
  // solid boxes; wall thickness not visualised.
  ridge_size_in?: [number, number];
  rafter_size_in?: [number, number];
  purlin_size_in?: [number, number];
  rafter_spacing_in?: number;
  purlin_spacing_in?: number;
  ring_beam?: { size_in?: [number, number] };
  // Hip-end beams: `count_per_end` longitudinal beams (at wall-top
  // level) per hip end, from the outermost truss out to the eave.
  // When `extend_between_trusses` is true they continue through the
  // truss bays so the transverse bracing is continuous end-to-end.
  hip_end_beam?: {
    size_in?: [number, number];
    count_per_end?: number;
    extend_between_trusses?: boolean;
  };
  // Pani patti: folded GI water-protector strip along all 4 eaves.
  // Rendered as thin vertical panels starting at eave_z.
  pani_patti?: {
    height_in?: number;
    thickness_mm?: number;
  };
}

export interface RoofTrusses {
  positions?: number[];
  chord_size_in?: [number, number];
  web_size_in?: [number, number];
}

export interface RoofFrameProps {
  geom: RoofFrameGeom;
  framing: RoofFraming;
  trusses?: RoofTrusses;
  trussPositions: number[]; // world Y (or X, when ridge_axis='x') coords
  plotWidth: number;
  plotLength: number;
  // Render only members in this bucket. The caller emits two
  // RoofFrameMesh instances (one per bucket) into separate layer
  // groups so the layer panel can hide them independently.
  bucket: "spine" | "surface";
  color?: string;
  // Vertical lift applied to the roof shell mesh (HipRoofMesh's
  // `shellLift` prop). The frame uses it to place the central ridge,
  // hip ridges and truss peaks at the LIFTED ridge elevation so
  // (a) the ridge beam top aligns with the shell peak and
  // (b) the shell rests on the ridge beam rather than floating above.
  shellLift?: number;
}

export function RoofFrameMesh({
  geom, framing, trusses, trussPositions,
  plotWidth, plotLength,
  bucket,
  color,
  shellLift = 0,
}: RoofFrameProps) {
  const members = useMemo(
    () => buildFrame(geom, framing, trusses, trussPositions, plotWidth, plotLength, shellLift),
    [geom, framing, trusses, trussPositions, plotWidth, plotLength, shellLift],
  );
  const filtered = useMemo(
    () => members.filter((m) => m.bucket === bucket),
    [members, bucket],
  );
  const defaultColor = bucket === "spine" ? "#5a5a5a" : "#8a8a8a";
  return (
    <group>
      {filtered.map((m, i) => (
        <mesh key={i} position={m.pos} quaternion={m.q} castShadow receiveShadow>
          <boxGeometry args={[m.size.x, m.size.y, m.size.z]} />
          <meshStandardMaterial
            color={color ?? defaultColor}
            roughness={0.72}
          />
        </mesh>
      ))}
    </group>
  );
}

interface Member {
  pos: [number, number, number];
  q: [number, number, number, number];
  size: Vec3;
  bucket: "spine" | "surface";
}

// A "beam" runs from world p1 to p2 with a given cross-section
// [width_in, depth_in]. width = horizontal-perpendicular-to-beam;
// depth = vertical. Returns a Member with box size = [width, depth,
// length] in Three space, positioned at the midpoint and rotated to
// point from p1 to p2.
export function beamBetween(
  p1World: W,
  p2World: W,
  sizeIn: [number, number],
  plotWidth: number,
  plotLength: number,
  bucket: "spine" | "surface",
): Member {
  // toThreePos signature: (worldX, worldY_south, worldZ_up).
  // W convention:         { x=east, y=south, z=up }.
  const a = toThreePos(p1World.x, p1World.y, p1World.z, plotWidth, plotLength);
  const av = new THREE.Vector3(a.x, a.y, a.z);
  const b = toThreePos(p2World.x, p2World.y, p2World.z, plotWidth, plotLength);
  const bv = new THREE.Vector3(b.x, b.y, b.z);
  const mid = new THREE.Vector3().addVectors(av, bv).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(bv, av);
  const length = dir.length();
  // Orient the box's local X axis along the beam direction.
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    dir.clone().normalize(),
  );
  return {
    pos: [mid.x, mid.y, mid.z],
    q: [q.x, q.y, q.z, q.w],
    size: {
      x: length,
      y: sizeIn[1] * IN, // depth (vertical when horizontal)
      z: sizeIn[0] * IN, // width (perpendicular)
    },
    bucket,
  };
}

// Helper: world-coords Vec3-like object. (x,y) is Inkscape (X east, Y
// south); z is world Z (up).
export type W = { x: number; y: number; z: number };
export const w = (x: number, y: number, z: number): W => ({ x, y, z });

function buildFrame(
  g: RoofFrameGeom,
  fr: RoofFraming,
  trusses: RoofTrusses | undefined,
  trussPositions: number[],
  plotWidth: number,
  plotLength: number,
  shellLift: number,
): Member[] {
  const members: Member[] = [];
  const eaveZ = g.eave_z;
  // Structural frame Z: where trusses / ring beam / hip-end beams sit.
  // wall_top_above_eave = eave_drop = wall_top_z - eave_z.
  const wallTopZ = eaveZ + (g.wall_top_above_eave ?? 0);
  // Python's ridge_h is measured from wall_top_z, not eave_z. So the
  // TRUE ridge Z sits ridge_h above wall_top_z (~314 for the current
  // config), not eave_z + ridge_h (~294). The shell + frame both use
  // this corrected value so members at wall_top_z no longer poke
  // through the roof at the wall edge.
  const ridgeZ = wallTopZ + g.ridge_h;
  // Ring beam corners: default to the eave corners (old behaviour) if
  // the actual wall-edge coords aren't provided.
  const rbXw = g.ring_beam_x_west ?? g.eave_x_west;
  const rbXe = g.ring_beam_x_east ?? g.eave_x_east;
  const rbYn = g.ring_beam_y_north ?? g.eave_y_north;
  const rbYs = g.ring_beam_y_south ?? g.eave_y_south;

  // Fallback chain: roof-level framing → GC global framing defaults.
  const rf = resolveFraming(fr);
  const ridgeSize = rf.ridge_size_in;
  const rafterSize = rf.rafter_size_in;
  const purlinSize = rf.purlin_size_in;
  const ringBeamSize = rf.ring_beam_size_in;
  const hipBeamSize: [number, number] = fr.hip_end_beam?.size_in ?? [4, 2];
  const trussChordSize: [number, number] = trusses?.chord_size_in ?? [2, 4];
  const trussWebSize: [number, number] = trusses?.web_size_in ?? [2, 2];
  const rafterSpacingU = rf.rafter_spacing_in * IN;
  const purlinSpacingAlongSlopeU = rf.purlin_spacing_in * IN;

  // Shell rise from eave to ridge (world units). Python's `ridge_h`
  // measures WALL→RIDGE; total shell rise is that plus the eave drop.
  const shellRise = (g.wall_top_above_eave ?? 0) + g.ridge_h;

  // ---- Stacking convention (matches real construction) ---------
  // Python centres every frame member on its theoretical plane
  // (wall_top_z, ridge_z, eave_z…). That's fine for BOM but leaves
  // members mutually penetrating in a solid render. We layer them
  // vertically instead:
  //   concrete beam top  = wall_top_z
  //   ring beam bottom  = wall_top_z            (thickness rb_d up)
  //   hip-end beam      = same level as ring beam
  //   truss bottom chord bottom = wall_top_z + rb_d  (rests on ring)
  //   truss peak        = ridge_z − ridge_d − chord_d/2 (chord top ≡ ridge bottom)
  //   rafter bottom     = shell plane − rf_d − pl_d  → passes over ring beam
  //   purlin bottom     = rafter top
  //   shell plane       = purlin top
  // So the rafter's TOP is lifted by (rb_d + rf_d) from eave_z, and
  // purlin bottom (= rafter top) is lifted by the same amount. The
  // shell mesh gets an equal `shellLift` = rb_d + rf_d + pl_d so the
  // roof surface sits flush against the purlin tops. That value is
  // recomputed and passed from House3D so the two components stay
  // in sync.
  const ringBeamDepthU = ringBeamSize[1] * IN;
  const hipBeamDepthU = hipBeamSize[1] * IN;
  const ridgeDepthU = ridgeSize[1] * IN;
  const trussChordDepthU = trussChordSize[1] * IN;
  const rafterDepthU = rafterSize[1] * IN;
  const purlinDepthU = purlinSize[1] * IN;
  const ringBeamCenterZ = wallTopZ + ringBeamDepthU / 2;
  const hipBeamCenterZ = wallTopZ + hipBeamDepthU / 2;
  const trussBottomCenterZ = wallTopZ + ringBeamDepthU + trussChordDepthU / 2;
  const rafterTopLiftU = ringBeamDepthU + rafterDepthU;
  const purlinTopLiftU = rafterTopLiftU + purlinDepthU;
  const rafterZOffset = rafterTopLiftU - rafterDepthU / 2;
  const purlinZOffset = purlinTopLiftU - purlinDepthU / 2;

  // ---- Ridge lift ----------------------------------------------------
  // The shell mesh is drawn `shellLift` above the raw eave/ridge Z.
  // For the SHELL to visually rest on top of the central ridge beam
  // (not float above it), the ridge beam TOP surface must coincide
  // with the shell peak. Shell peak = ridge_z_raw + shellLift, so
  // ridge beam CENTER = ridge_z_raw + shellLift − ridge_d/2. We apply
  // the same uniform shift `ridgeShift` to the hip ridges (both apex
  // and eave-corner ends), the truss peak (which sits below the
  // ridge), and the vent-strut endpoints so the entire top of the
  // frame rises with the shell peak.
  const ridgeShift = shellLift - ridgeDepthU / 2;
  const ridgeCenterZ = ridgeZ + ridgeShift;                    // central ridge beam centre
  const eaveCornerZLifted = eaveZ + ridgeShift;                // hip ridge eave-corner Z

  // ---- Ring beam: metal rectangular frame ON TOP of the wall-top
  // (concrete) beams. Anchored to the actual wall edges
  // (rbXw/rbXe/rbYn/rbYs) not to the eave. Truss bottom chords are
  // welded to this ring.
  members.push(
    beamBetween(
      w(rbXw, rbYn, ringBeamCenterZ),
      w(rbXe, rbYn, ringBeamCenterZ),
      ringBeamSize, plotWidth, plotLength, "spine",
    ),
    beamBetween(
      w(rbXw, rbYs, ringBeamCenterZ),
      w(rbXe, rbYs, ringBeamCenterZ),
      ringBeamSize, plotWidth, plotLength, "spine",
    ),
    beamBetween(
      w(rbXw, rbYn, ringBeamCenterZ),
      w(rbXw, rbYs, ringBeamCenterZ),
      ringBeamSize, plotWidth, plotLength, "spine",
    ),
    beamBetween(
      w(rbXe, rbYn, ringBeamCenterZ),
      w(rbXe, rbYs, ringBeamCenterZ),
      ringBeamSize, plotWidth, plotLength, "spine",
    ),
  );

  if (g.ridge_axis === "y") {
    // ---- Central ridge (along Y) ---------------------------------
    const ridgeX = (g.eave_x_west + g.eave_x_east) / 2;
    members.push(
      beamBetween(
        w(ridgeX, g.ridge_y_start, ridgeCenterZ),
        w(ridgeX, g.ridge_y_end, ridgeCenterZ),
        ridgeSize, plotWidth, plotLength, "spine",
      ),
    );
    // Optional vent extension + its bracing struts
    const ext = g.ridge_ext_u ?? 0;
    if (ext > 1e-6) {
      members.push(
        beamBetween(
          w(ridgeX, g.ridge_y_start - ext, ridgeCenterZ),
          w(ridgeX, g.ridge_y_start, ridgeCenterZ),
          ridgeSize, plotWidth, plotLength, "spine",
        ),
        beamBetween(
          w(ridgeX, g.ridge_y_end, ridgeCenterZ),
          w(ridgeX, g.ridge_y_end + ext, ridgeCenterZ),
          ridgeSize, plotWidth, plotLength, "spine",
        ),
      );
      // Bracing struts — the cantilevered extension endpoint (R1' /
      // R2') is supported by two diagonal struts angling down-and-out
      // to the two adjoining hip beams at the same Y coordinate as
      // the endpoint. Structurally these prevent the extension from
      // sagging under gravity.
      const northExtY = g.ridge_y_start - ext;
      const southExtY = g.ridge_y_end + ext;
      const r1Prime: W = w(ridgeX, northExtY, ridgeCenterZ);
      const r2Prime: W = w(ridgeX, southExtY, ridgeCenterZ);
      // Python geometry: strut endpoint is at distance `ridge_ext_u`
      // along the hip beam from the apex (R1 or R2) toward the eave
      // corner. This keeps the strut symmetric and the same order of
      // magnitude as the extension itself. Apex + corner points use
      // the lifted ridgeCenterZ / eaveCornerZLifted so the vent
      // struts match the lifted hip-ridge geometry.
      const pointAlong = (a: W, b: W, dist: number): W => {
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len <= 0) return a;
        const tp = dist / len;
        return { x: a.x + tp * dx, y: a.y + tp * dy, z: a.z + tp * dz };
      };
      const R1 = w(ridgeX, g.ridge_y_start, ridgeCenterZ);
      const R2Point = w(ridgeX, g.ridge_y_end, ridgeCenterZ);
      const NW = w(g.eave_x_west, g.eave_y_north, eaveCornerZLifted);
      const NE = w(g.eave_x_east, g.eave_y_north, eaveCornerZLifted);
      const SW = w(g.eave_x_west, g.eave_y_south, eaveCornerZLifted);
      const SE = w(g.eave_x_east, g.eave_y_south, eaveCornerZLifted);
      members.push(
        beamBetween(r1Prime, pointAlong(R1, NW, ext), trussWebSize, plotWidth, plotLength, "spine"),
        beamBetween(r1Prime, pointAlong(R1, NE, ext), trussWebSize, plotWidth, plotLength, "spine"),
        beamBetween(r2Prime, pointAlong(R2Point, SW, ext), trussWebSize, plotWidth, plotLength, "spine"),
        beamBetween(r2Prime, pointAlong(R2Point, SE, ext), trussWebSize, plotWidth, plotLength, "spine"),
      );
    }

    // ---- 4 hip ridges (corner → ridge endpoint) ------------------
    // Python uses `ridge_size_in` for these (not hip_end_beam), because
    // they are structural ridges at the roof edge, not the flat beams
    // that sit inside the hip triangle at wall-top level. Both apex
    // and corner ends are lifted by `ridgeShift` so the hip ridge's
    // top surface tracks the shell edge from apex down to eave corner.
    const r1: W = w(ridgeX, g.ridge_y_start, ridgeCenterZ);
    const r2: W = w(ridgeX, g.ridge_y_end, ridgeCenterZ);
    members.push(
      beamBetween(w(g.eave_x_west, g.eave_y_north, eaveCornerZLifted), r1, ridgeSize, plotWidth, plotLength, "spine"),
      beamBetween(w(g.eave_x_east, g.eave_y_north, eaveCornerZLifted), r1, ridgeSize, plotWidth, plotLength, "spine"),
      beamBetween(w(g.eave_x_west, g.eave_y_south, eaveCornerZLifted), r2, ridgeSize, plotWidth, plotLength, "spine"),
      beamBetween(w(g.eave_x_east, g.eave_y_south, eaveCornerZLifted), r2, ridgeSize, plotWidth, plotLength, "spine"),
    );

    // ---- Fink trusses at each truss position ---------------------
    // Follows the Python convention: 5 bottom-chord panel points
    // (B0..B4 at 0%, 25%, 50%, 75%, 100% of the span), peak Tpk at
    // ridge x, plus half-height points T1m and T3m above B1 and B3.
    // Members: bottom chord (B0–B4), two top chords (B0–Tpk, Tpk–B4)
    // use trussChordSize; king post (Tpk–B2), two diagonals (Tpk–B1,
    // Tpk–B3), two verticals (T1m–B1, T3m–B3) use trussWebSize.
    // Truss peak: top face of the chord kisses the bottom of the
    // lifted central ridge beam. ridgeCenterZ already includes the
    // ridgeShift so the truss stretches up with the ridge.
    const trussPeakZ = ridgeCenterZ - ridgeDepthU / 2 - trussChordDepthU / 2;

    for (const yPos of trussPositions) {
      // Truss spans the actual walls (rbXw → rbXe). Bottom chord centre
      // sits on top of the ring beam; peak sits just below the central
      // ridge beam.
      const span = rbXe - rbXw;
      const B0: W = w(rbXw, yPos, trussBottomCenterZ);
      const B1: W = w(rbXw + 0.25 * span, yPos, trussBottomCenterZ);
      const B2: W = w(ridgeX, yPos, trussBottomCenterZ);
      const B3: W = w(rbXw + 0.75 * span, yPos, trussBottomCenterZ);
      const B4: W = w(rbXe, yPos, trussBottomCenterZ);
      const Tpk: W = w(ridgeX, yPos, trussPeakZ);
      const midZ = (trussBottomCenterZ + trussPeakZ) / 2;
      const T1m: W = w(rbXw + 0.25 * span, yPos, midZ);
      const T3m: W = w(rbXw + 0.75 * span, yPos, midZ);
      // Chords
      members.push(beamBetween(B0, B4, trussChordSize, plotWidth, plotLength, "spine"));
      members.push(beamBetween(B0, Tpk, trussChordSize, plotWidth, plotLength, "spine"));
      members.push(beamBetween(Tpk, B4, trussChordSize, plotWidth, plotLength, "spine"));
      // King post
      members.push(beamBetween(Tpk, B2, trussWebSize, plotWidth, plotLength, "spine"));
      // Fink diagonals — from peak down to the ¼ / ¾ bottom-chord points
      members.push(beamBetween(Tpk, B1, trussWebSize, plotWidth, plotLength, "spine"));
      members.push(beamBetween(Tpk, B3, trussWebSize, plotWidth, plotLength, "spine"));
      // Verticals — from ¼ / ¾ bottom-chord points up to the T1m/T3m
      // half-height points on the top chord
      members.push(beamBetween(B1, T1m, trussWebSize, plotWidth, plotLength, "spine"));
      members.push(beamBetween(B3, T3m, trussWebSize, plotWidth, plotLength, "spine"));
    }

    // ---- Hip-end beams -------------------------------------------
    // Longitudinal beams at wall-top level, `count_per_end` of them
    // across the width, from the outermost truss out to the eave.
    // When `extend_between_trusses` is on, also continue through the
    // interior truss bays so the transverse bracing is unbroken.
    const hipCount = fr.hip_end_beam?.count_per_end ?? 0;
    const hipBetween = fr.hip_end_beam?.extend_between_trusses ?? false;
    if (hipCount > 0 && trussPositions.length >= 2) {
      const sortedTrusses = [...trussPositions].sort((a, b) => a - b);
      const yFirst = sortedTrusses[0];
      const yLast = sortedTrusses[sortedTrusses.length - 1];
      const spanX = rbXe - rbXw;
      for (let i = 0; i < hipCount; i++) {
        const frac = (i + 1) / (hipCount + 1);
        const bx = rbXw + frac * spanX;
        // North end: from first truss to N wall (ring beam edge)
        members.push(beamBetween(
          w(bx, yFirst, hipBeamCenterZ),
          w(bx, rbYn, hipBeamCenterZ),
          hipBeamSize, plotWidth, plotLength, "spine",
        ));
        // South end: from last truss to S wall
        members.push(beamBetween(
          w(bx, yLast, hipBeamCenterZ),
          w(bx, rbYs, hipBeamCenterZ),
          hipBeamSize, plotWidth, plotLength, "spine",
        ));
        if (hipBetween) {
          for (let j = 0; j < sortedTrusses.length - 1; j++) {
            members.push(beamBetween(
              w(bx, sortedTrusses[j], hipBeamCenterZ),
              w(bx, sortedTrusses[j + 1], hipBeamCenterZ),
              hipBeamSize, plotWidth, plotLength, "spine",
            ));
          }
        }
      }
    }

    // ---- Pani patti (folded GI water-protector strips) ------------
    // Four upright thin strips along the eave perimeter (N, S, W, E).
    // Base sits at eave_z; rises `height_in` above.
    const ppCfg = fr.pani_patti;
    if (ppCfg) {
      const ppHeightIn = ppCfg.height_in ?? 6.0;
      const ppThicknessMm = ppCfg.thickness_mm ?? 1.2;
      const ppHeightU = ppHeightIn * IN;
      // 25.4 mm/in — convert thickness to inches then to units.
      const ppThicknessU = (ppThicknessMm / 25.4) * IN;
      // Use `beamBetween` — we treat the strip like a thin box.
      // section [thickness_in, height_in] → [through-wall, vertical].
      const ppSize: [number, number] = [ppThicknessMm / 25.4, ppHeightIn];
      const zCenter = eaveZ + ppHeightU / 2;
      // N: runs E-W along the north eave
      members.push(beamBetween(
        w(g.eave_x_west, g.eave_y_north, zCenter),
        w(g.eave_x_east, g.eave_y_north, zCenter),
        ppSize, plotWidth, plotLength, "spine",
      ));
      // S
      members.push(beamBetween(
        w(g.eave_x_west, g.eave_y_south, zCenter),
        w(g.eave_x_east, g.eave_y_south, zCenter),
        ppSize, plotWidth, plotLength, "spine",
      ));
      // W: runs N-S along the west eave
      members.push(beamBetween(
        w(g.eave_x_west, g.eave_y_north, zCenter),
        w(g.eave_x_west, g.eave_y_south, zCenter),
        ppSize, plotWidth, plotLength, "spine",
      ));
      // E
      members.push(beamBetween(
        w(g.eave_x_east, g.eave_y_north, zCenter),
        w(g.eave_x_east, g.eave_y_south, zCenter),
        ppSize, plotWidth, plotLength, "spine",
      ));
      void ppThicknessU;
    }

    // ---- Rafters on the two main slopes (W and E) ----------------
    // Match Python's placement exactly:
    //   n_r        = int(span_y / spacing) + 1
    //   gap        = span_y - (n_r - 1) * spacing
    //   first_off  = gap / 2
    //   y[i]       = eave_y_north + first_off + i * spacing
    // Every yPos gets a rafter — no corner skipping. At each yPos the
    // rafter's upper end depends on where yPos falls:
    //   yPos < ridge_y_start          → jack rafter, hits NW/NE hip
    //   ridge_y_start ≤ yPos ≤ ridge_y_end → common rafter, hits ridge
    //   yPos > ridge_y_end            → jack rafter, hits SW/SE hip
    const allRafterYs = collectMainRafterYs(
      g.eave_y_north, g.eave_y_south, rafterSpacingU,
    );
    for (const yPos of allRafterYs) {
      let upperWestX: number, upperEastX: number, upperZ: number;
      if (yPos < g.ridge_y_start) {
        // Jack rafter — hits the NW/NE hip beam at yPos. Interpolate
        // along the hip beam using the full shell rise, not ridge_h.
        const t = (yPos - g.eave_y_north) / (g.ridge_y_start - g.eave_y_north);
        upperWestX = g.eave_x_west + t * (ridgeX - g.eave_x_west);
        upperEastX = g.eave_x_east + t * (ridgeX - g.eave_x_east);
        upperZ = eaveZ + t * shellRise;
      } else if (yPos > g.ridge_y_end) {
        const t = (g.eave_y_south - yPos) / (g.eave_y_south - g.ridge_y_end);
        upperWestX = g.eave_x_west + t * (ridgeX - g.eave_x_west);
        upperEastX = g.eave_x_east + t * (ridgeX - g.eave_x_east);
        upperZ = eaveZ + t * shellRise;
      } else {
        // Common rafter — hits the central ridge at (ridgeX, yPos, ridgeZ).
        upperWestX = ridgeX;
        upperEastX = ridgeX;
        upperZ = ridgeZ;
      }
      // Rafter box is offset DOWN so its top sits at the shell plane.
      // West slope
      members.push(beamBetween(
        w(g.eave_x_west, yPos, eaveZ + rafterZOffset),
        w(upperWestX, yPos, upperZ + rafterZOffset),
        rafterSize, plotWidth, plotLength, "surface",
      ));
      // East slope
      members.push(beamBetween(
        w(g.eave_x_east, yPos, eaveZ + rafterZOffset),
        w(upperEastX, yPos, upperZ + rafterZOffset),
        rafterSize, plotWidth, plotLength, "surface",
      ));
    }

    // ---- Hip-end rafters (N and S hip triangles) -----------------
    // Rafters on the hip-end slopes run PERPENDICULAR to the eave they
    // attach to (i.e. along the Y axis at constant X, mirroring how
    // main-slope rafters run along X at constant Y). At each xPos the
    // rafter's upper end lands on the NW/NE (north hip end) or SW/SE
    // (south hip end) hip beam, depending on whether xPos is west or
    // east of the ridge centre.
    const hipXs = collectHipEndRafterXs(g.eave_x_west, g.eave_x_east, rafterSpacingU);
    const upperOnHip = (
      xPos: number,
      apexY: number,      // ridge_y_start for N, ridge_y_end for S
      eaveY: number,      // eave_y_north for N, eave_y_south for S
    ): { yUpper: number; zUpper: number } => {
      let t: number;
      if (xPos < ridgeX) {
        // Hip beam runs from (eave_x_west, eaveY, eaveZ) → (ridgeX, apexY, ridgeZ)
        t = (xPos - g.eave_x_west) / (ridgeX - g.eave_x_west);
      } else if (xPos > ridgeX) {
        // Hip beam runs from (eave_x_east, eaveY, eaveZ) → (ridgeX, apexY, ridgeZ)
        t = (g.eave_x_east - xPos) / (g.eave_x_east - ridgeX);
      } else {
        t = 1; // meets the apex exactly
      }
      return {
        yUpper: eaveY + t * (apexY - eaveY),
        zUpper: eaveZ + t * shellRise,
      };
    };
    for (const xPos of hipXs) {
      const nUp = upperOnHip(xPos, g.ridge_y_start, g.eave_y_north);
      members.push(beamBetween(
        w(xPos, g.eave_y_north, eaveZ + rafterZOffset),
        w(xPos, nUp.yUpper, nUp.zUpper + rafterZOffset),
        rafterSize, plotWidth, plotLength, "surface",
      ));
      const sUp = upperOnHip(xPos, g.ridge_y_end, g.eave_y_south);
      members.push(beamBetween(
        w(xPos, g.eave_y_south, eaveZ + rafterZOffset),
        w(xPos, sUp.yUpper, sUp.zUpper + rafterZOffset),
        rafterSize, plotWidth, plotLength, "surface",
      ));
    }

    // ---- Purlins on the two main slopes --------------------------
    // Purlins run parallel to the ridge. They march up the slope in
    // arc-length steps of `purlin_spacing_in`. Each step advances
    // horizontally by cos(slope) and vertically by sin(slope). The
    // main slope is a TRAPEZOID: at the eave it spans the full length
    // (eave_y_north … eave_y_south), at the ridge it spans only the
    // ridge extent (ridge_y_start … ridge_y_end). Each purlin's Y
    // endpoints are linearly interpolated between those two limits
    // based on how far up the slope it sits, so purlins fully cover
    // the triangular corners at the ends of the trapezoid.
    const halfSpan = (g.eave_x_east - g.eave_x_west) / 2;
    // Full shell slope arc length uses the total eave-to-ridge rise.
    const mainSlopeLen = Math.hypot(halfSpan, shellRise);
    const nMainPurlins = Math.max(1, Math.floor(mainSlopeLen / purlinSpacingAlongSlopeU));
    const cosMain = halfSpan / mainSlopeLen;
    const sinMain = shellRise / mainSlopeLen;
    for (let i = 1; i < nMainPurlins; i++) {
      const along = i * purlinSpacingAlongSlopeU;
      const t = along / mainSlopeLen;
      const dxSlope = along * cosMain;
      const dzSlope = along * sinMain;
      const yStart = g.eave_y_north + t * (g.ridge_y_start - g.eave_y_north);
      const yEnd = g.eave_y_south + t * (g.ridge_y_end - g.eave_y_south);
      // Purlin box is lifted so its bottom sits at the shell plane
      // (which is where the rafter tops are). Purlin then visually
      // rests on the rafter grid.
      const purlinZ = eaveZ + dzSlope + purlinZOffset;
      // West slope purlin
      members.push(beamBetween(
        w(g.eave_x_west + dxSlope, yStart, purlinZ),
        w(g.eave_x_west + dxSlope, yEnd, purlinZ),
        purlinSize, plotWidth, plotLength, "surface",
      ));
      // East slope purlin
      members.push(beamBetween(
        w(g.eave_x_east - dxSlope, yStart, purlinZ),
        w(g.eave_x_east - dxSlope, yEnd, purlinZ),
        purlinSize, plotWidth, plotLength, "surface",
      ));
    }

    // ---- Purlins on the hip-end triangles ------------------------
    // Each hip-end slope is a triangle whose base is the eave and
    // whose apex is R1 (north) or R2 (south). At slope-parameter t
    // (0 at eave, 1 at apex):
    //   Y coord   = eaveY + t*(apexY - eaveY)
    //   Z coord   = eaveZ + t*ridge_h
    //   X extent  = (eave_x_west + t*(ridgeX - eave_x_west))
    //             … (eave_x_east + t*(ridgeX - eave_x_east))
    // As t → 1 the X extent shrinks to a single point at ridgeX.
    const emitHipEndPurlins = (eaveY: number, apexY: number) => {
      const runY = Math.abs(apexY - eaveY);
      const slopeArc = Math.hypot(runY, shellRise);
      if (slopeArc < 1e-6) return;
      const n = Math.max(1, Math.floor(slopeArc / purlinSpacingAlongSlopeU));
      for (let i = 1; i < n; i++) {
        const along = i * purlinSpacingAlongSlopeU;
        const t = along / slopeArc;
        const yPos = eaveY + t * (apexY - eaveY);
        const zPos = eaveZ + t * shellRise + purlinZOffset;
        const xLeft = g.eave_x_west + t * (ridgeX - g.eave_x_west);
        const xRight = g.eave_x_east + t * (ridgeX - g.eave_x_east);
        members.push(beamBetween(
          w(xLeft, yPos, zPos),
          w(xRight, yPos, zPos),
          purlinSize, plotWidth, plotLength, "surface",
        ));
      }
    };
    emitHipEndPurlins(g.eave_y_north, g.ridge_y_start);
    emitHipEndPurlins(g.eave_y_south, g.ridge_y_end);
  }
  // ridge_axis='x' variant: mirror of the above with X/Y swapped.
  // Not exercised by current config; skipped for now.

  return members;
}

// Rafter positioning that matches Python's `_add_main_slope_rafters` and
// `_add_hip_end_rafters`:
//   n_r       = int(span / spacing) + 1
//   gap       = span - (n_r - 1) * spacing
//   first_off = gap / 2
//   pos[i]    = lo + first_off + i * spacing
// This produces one more rafter than the ceil-based approach and pulls
// them slightly inside the eave corners, matching what the Python
// pipeline emits (and the Blender frame).
function collectMainRafterYs(yNorth: number, ySouth: number, spacing: number): number[] {
  const span = ySouth - yNorth;
  if (span <= 0 || spacing <= 0) return [];
  const n = Math.floor(span / spacing) + 1;
  const gap = span - (n - 1) * spacing;
  const first = gap > 0 ? gap / 2 : 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(yNorth + first + i * spacing);
  return out;
}

function collectHipEndRafterXs(xWest: number, xEast: number, spacing: number): number[] {
  const span = xEast - xWest;
  if (span <= 0 || spacing <= 0) return [];
  const n = Math.floor(span / spacing) + 1;
  const gap = span - (n - 1) * spacing;
  const first = gap > 0 ? gap / 2 : 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(xWest + first + i * spacing);
  return out;
}
