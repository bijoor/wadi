// Gable-roof structural frame — mirrors RoofFrameMesh (hip) but for
// the simpler two-slope geometry: no hip diagonals, no hip beams, one
// straight ridge running the full length.
//
// Members (for ridge_axis = 'y'):
//   - Ring beam       — perimeter loop at wall-top height
//   - Ridge beam      — single beam along the ridge (Y = ridge_y_start..end)
//   - Rafters         — from ridge down to eaves (west + east slopes),
//                       spaced at rafter_spacing_in along Y
//   - Purlins         — parallel to ridge, march up each slope from
//                       eave to ridge at purlin_spacing_in
//   - Gable-end trusses (optional) — if trusses.positions supplied,
//                       simple triangle trusses spanning trans direction
//                       at those Y positions

import { useMemo } from "react";
import * as THREE from "three";
import {
  IN,
  beamBetween,
  computeShellLift,
  resolveFraming,
  w,
  type RoofFraming,
  type RoofFrameGeom,
  type RoofTrusses,
} from "./roofFrame";

export interface GableFrameProps {
  geom: RoofFrameGeom;         // reuse hip's geom shape — same fields we need
  framing: RoofFraming;
  trusses?: RoofTrusses;       // optional; only positions honoured here
  plotWidth: number;
  plotLength: number;
  bucket: "spine" | "surface";
  color?: string;
  shellLift?: number;
}

interface Member {
  pos: [number, number, number];
  q: [number, number, number, number];
  size: { x: number; y: number; z: number };
  bucket: "spine" | "surface";
}

export function GableRoofFrameMesh({
  geom,
  framing,
  trusses,
  plotWidth,
  plotLength,
  bucket,
  color,
  shellLift = 0,
}: GableFrameProps) {
  const members = useMemo(
    () => buildGableFrame(geom, framing, trusses, plotWidth, plotLength, shellLift),
    [geom, framing, trusses, plotWidth, plotLength, shellLift],
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
            metalness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

// Re-export so callers can size their shell lift consistently.
export { computeShellLift };

function buildGableFrame(
  g: RoofFrameGeom,
  fr: RoofFraming,
  trusses: RoofTrusses | undefined,
  plotWidth: number,
  plotLength: number,
  shellLift: number,
): Member[] {
  const members: Member[] = [];
  const eaveZ = g.eave_z;
  const wallTopZ = eaveZ + (g.wall_top_above_eave ?? 0);
  const ridgeZ = wallTopZ + g.ridge_h;

  const rbXw = g.ring_beam_x_west ?? g.eave_x_west;
  const rbXe = g.ring_beam_x_east ?? g.eave_x_east;
  const rbYn = g.ring_beam_y_north ?? g.eave_y_north;
  const rbYs = g.ring_beam_y_south ?? g.eave_y_south;

  const rf = resolveFraming(fr);
  const ridgeSize = rf.ridge_size_in;
  const rafterSize = rf.rafter_size_in;
  const purlinSize = rf.purlin_size_in;
  const ringBeamSize = rf.ring_beam_size_in;
  const rafterSpacingU = rf.rafter_spacing_in * IN;
  const purlinSpacingAlongSlopeU = rf.purlin_spacing_in * IN;

  const ringBeamDepthU = ringBeamSize[1] * IN;
  const rafterDepthU = rafterSize[1] * IN;
  const purlinDepthU = purlinSize[1] * IN;
  const ridgeDepthU = ridgeSize[1] * IN;

  // Vertical stack (matches hip's convention so the same shellLift works):
  //   wall_top = concrete beam top
  //   ring beam bottom = wall_top       → centre at wall_top + rb_d/2
  //   rafter top = shell plane − pl_d   → bottom at shell plane − pl_d − rf_d
  //   purlin bottom = rafter top        → centre at rafter top + pl_d/2
  //   shell = purlin top (= wall_top + shellLift where shellLift = rb_d+rf_d+pl_d)
  const ringBeamCenterZ = wallTopZ + ringBeamDepthU / 2;

  // --- Ring beam — 4 perimeter beams (spine) ------------------------
  members.push(
    beamBetween(
      w(rbXw, rbYn, ringBeamCenterZ),
      w(rbXe, rbYn, ringBeamCenterZ),
      ringBeamSize,
      plotWidth,
      plotLength,
      "spine",
    ),
  );
  members.push(
    beamBetween(
      w(rbXw, rbYs, ringBeamCenterZ),
      w(rbXe, rbYs, ringBeamCenterZ),
      ringBeamSize,
      plotWidth,
      plotLength,
      "spine",
    ),
  );
  members.push(
    beamBetween(
      w(rbXw, rbYn, ringBeamCenterZ),
      w(rbXw, rbYs, ringBeamCenterZ),
      ringBeamSize,
      plotWidth,
      plotLength,
      "spine",
    ),
  );
  members.push(
    beamBetween(
      w(rbXe, rbYn, ringBeamCenterZ),
      w(rbXe, rbYs, ringBeamCenterZ),
      ringBeamSize,
      plotWidth,
      plotLength,
      "spine",
    ),
  );

  // --- Central ridge beam (spine) -----------------------------------
  const ridgeX = (g.eave_x_west + g.eave_x_east) / 2;
  // Ridge sits so its BOTTOM is at ridge_z (shell peak Z). Center is
  // one half depth below.
  const ridgeCenterZ = ridgeZ - ridgeDepthU / 2 + shellLift;
  members.push(
    beamBetween(
      w(ridgeX, g.ridge_y_start, ridgeCenterZ),
      w(ridgeX, g.ridge_y_end, ridgeCenterZ),
      // Ridge cross-section: box.y = depth (vertical), box.z = width (horizontal-perp).
      ridgeSize,
      plotWidth,
      plotLength,
      "spine",
    ),
  );

  // --- Rafters on the two main slopes (surface) ---------------------
  // Rafters run from the ridge (top) down to the eave (bottom) on
  // each side. Space them along Y from ridge_y_start to ridge_y_end.
  const rafterYs: number[] = [];
  for (let y = g.ridge_y_start; y <= g.ridge_y_end + 1e-6; y += rafterSpacingU) {
    rafterYs.push(y);
  }
  // Ensure the last one exactly at ridge_y_end.
  if (rafterYs.length > 0 && rafterYs[rafterYs.length - 1] < g.ridge_y_end - 1e-6) {
    rafterYs.push(g.ridge_y_end);
  }

  // Rafter Z offset: shell top plane sits at wall_top_z + shellLift on
  // top of the ridge; here we need the rafter TOP to be at shell plane
  // - purlin depth. So rafter bottom = shell plane - purlin - rafter.
  // In flat Z terms per point we simply lower each endpoint by the
  // rafter half-depth so the beam runs at that centreline.
  const rafterLowerOffset = -rafterDepthU / 2 - purlinDepthU + shellLift;

  for (const yPos of rafterYs) {
    // West slope: from (eave_x_west, yPos, eaveZ) → (ridgeX, yPos, ridgeZ)
    members.push(
      beamBetween(
        w(g.eave_x_west, yPos, eaveZ + rafterLowerOffset),
        w(ridgeX, yPos, ridgeZ + rafterLowerOffset),
        rafterSize,
        plotWidth,
        plotLength,
        "surface",
      ),
    );
    // East slope
    members.push(
      beamBetween(
        w(g.eave_x_east, yPos, eaveZ + rafterLowerOffset),
        w(ridgeX, yPos, ridgeZ + rafterLowerOffset),
        rafterSize,
        plotWidth,
        plotLength,
        "surface",
      ),
    );
  }

  // --- Purlins on the two main slopes (surface) ---------------------
  // Slope length from ridge to eave along the slope surface.
  const halfTrans = (g.eave_x_east - g.eave_x_west) / 2;
  const shellRise = (g.wall_top_above_eave ?? 0) + g.ridge_h;
  const slopeLen = Math.hypot(halfTrans, shellRise);
  const nPurlins = Math.max(1, Math.floor(slopeLen / purlinSpacingAlongSlopeU));
  // Purlin centreline sits ABOVE the rafter (bottom-of-purlin = rafter-top).
  const purlinLowerOffset = -purlinDepthU / 2 + shellLift; // bottom at shell plane - pl_d
  // Actually with our shellLift stack: shell plane = wall_top + shellLift =
  // wall_top + rb + rf + pl. Rafter top = shell plane - pl_d. Purlin
  // bottom = rafter top = shell plane - pl_d. Purlin centre = shell
  // plane - pl_d/2.
  void purlinLowerOffset; // (unused — we compute per-step below)

  for (let i = 1; i < nPurlins; i++) {
    const t = i / nPurlins; // 0 = ridge, 1 = eave
    // Interpolate along one slope from ridge to eave.
    const x = ridgeX - t * halfTrans; // west slope; mirror for east
    const z = ridgeZ - t * shellRise;
    const zPurlinCenter = z - purlinDepthU / 2 + shellLift;
    // West slope purlin — runs the full length of the ridge
    members.push(
      beamBetween(
        w(x, g.ridge_y_start, zPurlinCenter),
        w(x, g.ridge_y_end, zPurlinCenter),
        purlinSize,
        plotWidth,
        plotLength,
        "surface",
      ),
    );
    // East slope purlin (mirror x)
    const xE = ridgeX + t * halfTrans;
    members.push(
      beamBetween(
        w(xE, g.ridge_y_start, zPurlinCenter),
        w(xE, g.ridge_y_end, zPurlinCenter),
        purlinSize,
        plotWidth,
        plotLength,
        "surface",
      ),
    );
  }

  // --- Optional gable-end trusses (spine) ---------------------------
  // If the user supplied trusses.positions, drop a simple triangle
  // truss (bottom chord + two top chords + king post) at each Y. Uses
  // the same chord/web sizes as hip so BOM math is consistent.
  const trussChordSize: [number, number] = trusses?.chord_size_in ?? [2, 4];
  const trussWebSize: [number, number] = trusses?.web_size_in ?? [2, 2];
  const chordBottomTopZ = wallTopZ + ringBeamDepthU + (trussChordSize[1] * IN);
  const chordBottomCenterZ = wallTopZ + ringBeamDepthU + (trussChordSize[1] * IN) / 2;
  const trussPeakZ = ridgeZ + shellLift - (ridgeDepthU) - (trussChordSize[1] * IN) / 2;
  for (const yPos of trusses?.positions ?? []) {
    // Bottom chord (rb-west to rb-east at chordBottomCenterZ)
    members.push(
      beamBetween(
        w(rbXw, yPos, chordBottomCenterZ),
        w(rbXe, yPos, chordBottomCenterZ),
        trussChordSize,
        plotWidth,
        plotLength,
        "spine",
      ),
    );
    // Two top chords: rb-west → peak, rb-east → peak
    members.push(
      beamBetween(
        w(rbXw, yPos, chordBottomTopZ),
        w(ridgeX, yPos, trussPeakZ),
        trussChordSize,
        plotWidth,
        plotLength,
        "spine",
      ),
    );
    members.push(
      beamBetween(
        w(rbXe, yPos, chordBottomTopZ),
        w(ridgeX, yPos, trussPeakZ),
        trussChordSize,
        plotWidth,
        plotLength,
        "spine",
      ),
    );
    // King post: peak → bottom-chord centre
    members.push(
      beamBetween(
        w(ridgeX, yPos, chordBottomCenterZ),
        w(ridgeX, yPos, trussPeakZ),
        trussWebSize,
        plotWidth,
        plotLength,
        "spine",
      ),
    );
  }

  void THREE; // keep import alive in case downstream tooling strips it
  return members;
}
