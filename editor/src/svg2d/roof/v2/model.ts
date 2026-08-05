// Roof v2 data model. Everything in project units (10 u = 1 ft).
//
// This module holds ONLY types. No math, no I/O — keeps the shape
// stable and lets utilities / derivations depend on it without
// pulling in behaviour.

export type Point2D = readonly [number, number];
export type Point3D = readonly [number, number, number];

// A single ridge line (or shed-high edge / flat centreline). Runs
// start → end; `width` is the perpendicular extent of the roof
// section centred on the line. `left` = +90° CCW from start→end;
// `right` = -90°.
export interface RoofSegment {
  id: string;
  start: Point2D;
  end: Point2D;
  width: number;

  // Per-segment overrides — fall back to roof-level values.
  slope_override?: SlopeSpec;
  // Per-side asymmetric pitch override (see RoofConfig.slope_left/right). Both
  // must be set to take effect; falls back to the roof-level per-side pair, then
  // to the symmetric `slope`.
  slope_left_override?: SlopeSpec;
  slope_right_override?: SlopeSpec;
  framing_override?: RoofFramingConfig;

  // Shed-only: which side of the segment is the high edge.
  shed_high_side?: "left" | "right";

  // Pitched-only endpoint style. Applies to a LEAF endpoint (one
  // not shared with any other segment). Joint endpoints ignore
  // these — joint resolution takes over.
  //   "open"   → covered by a vertical gable-end wall
  //   "closed" → covered by a sloped hip-face triangle
  start_endpoint?: EndpointStyle;
  end_endpoint?: EndpointStyle;

  // Pitched-only. For CLOSED endpoints: how far inward from the
  // segment endpoint the ridge is trimmed to make room for the
  // hip triangle. Default = width/2 (equal-pitch pyramid hip).
  // For OPEN endpoints: how far past the segment endpoint the
  // ridge extends (gable overhang). Default = 0.
  //
  // Legacy compat: the adapter fills these from
  // `trusses.positions[0]` / `alongLen - positions[-1]` so hip
  // roofs preserve their original ridge trim.
  hip_setback_start?: number;
  hip_setback_end?: number;
  gable_overhang_start?: number;
  gable_overhang_end?: number;

  // Pitched CLOSED endpoints only: how far PAST the hip apex the
  // ridge MEMBER extends (a "flying ridge" for ventilation). The
  // hip face plane + hip diagonals still meet at the true apex;
  // only the ridge member itself extends. In project units.
  // Legacy equivalent: ridge_ventilation.extension_ft × 10.
  hip_ridge_extension_start?: number;
  hip_ridge_extension_end?: number;

  // Overhang overrides — in project units. Fall-back chain:
  //   min_overhang (per-segment)  →  cfg.min_overhang  →  20
  //
  // Applies to the CROSS-side eaves (both left and right) and, for
  // shed roofs, to the along-direction end eaves too. Open-endpoint
  // (gable) overhangs are still controlled per-end by
  // `gable_overhang_start` / `gable_overhang_end`. Closed-endpoint
  // (hip) along-overhangs are derived from the segment's hip pitch
  // and are not directly overridable.
  min_overhang?: number;

  // Per-side overhang overrides — in project units. Each falls back to the
  // segment's uniform overhang (`min_overhang` → cfg.min_overhang → 20). Let
  // you cantilever one edge (e.g. a big `overhang_end` over an entry landing)
  // while keeping the others tight.
  //   • overhang_start / overhang_end — along the ridge AXIS, at seg.start /
  //     seg.end. On a PITCHED open (gable) end these alias gable_overhang_*.
  //     On a hip (closed) end the reach is geometric (hip_setback) — ignored.
  //   • overhang_low / overhang_high — SHED only: the down-slope (low) and
  //     up-slope (high) eaves.
  //   • overhang_left / overhang_right — PITCHED only: the two eaves, left /
  //     right of the ridge (by the segment's left normal). A larger eave
  //     overhang drops that eave's outer edge proportionally (per-side eaveZ),
  //     so the two slopes stay planar. NOTE: on a MULTI-segment pitched roof
  //     the eaves share one height for clean joints — set per-eave only on a
  //     single-segment roof, else the joint eaves may not line up.
  overhang_start?: number;
  overhang_end?: number;
  overhang_low?: number;
  overhang_high?: number;
  overhang_left?: number;
  overhang_right?: number;

  // Flat wall-top TIE BEAMS (horizontal ceiling ties): N members
  // running the full segment length (start→end), spread at equal
  // INTERIOR gaps across the segment width, sitting at wall-top Z
  // (below the roof, not on the slopes). 0 / omitted → none.
  tie_beam_count?: number;
}

export type EndpointStyle = "open" | "closed";

export type SlopeSpec =
  | { by: "angle"; angle_deg: number }
  | { by: "height"; ridge_h: number };

export interface RoofFramingConfig {
  rafter_size_ft?: [number, number];
  purlin_size_ft?: [number, number];
  rafter_spacing_oc_ft?: number;
  purlin_spacing_oc_ft?: number;
  ridge_size_ft?: [number, number];
  hip_size_ft?: [number, number];
  ring_beam_size_ft?: [number, number];
  wall_thickness_ft?: number;
  // Section of the raking gable band at the top of a gable wall (continuous with
  // the eave ring beam). Defaults to ring_beam_size_ft.
  gable_band_size_ft?: [number, number];
}

export interface TileConfig {
  mangalore_per_sft: number;
  ceiling_per_sft: number;
  waste_pct: number;
}

export interface MetalStockConfig {
  default_length_ft: number;
  cutting_waste_pct: number;
}

export interface TrussPositionSpec {
  segment_id: string;
  // "fink" for symmetric pitched roofs (bottom chord + 2 top chords +
  // king post + panel-point webs).
  // "mono_pitch" for shed roofs (right-triangle truss with the ridge
  // above the HIGH wall, sometimes called an asymmetric or shed
  // truss).
  type: "fink" | "mono_pitch";
  positions_along: number[];
}

// The unified roof object. Replaces flat_roof / shed_roof /
// gable_roof / hip_roof.
export interface RoofConfig {
  type: "roof";

  // "pitched" absorbs classical gable + hip; per-endpoint
  // open/closed distinguishes them.
  roof_type: "flat" | "shed" | "pitched";

  segments: RoofSegment[];

  // Applied to pitched-roof leaf endpoints that don't override.
  // Recommended default: "closed" (hip).
  default_endpoint?: EndpointStyle;

  slope?: SlopeSpec;
  // Independent per-side pitch for an ASYMMETRIC gable (saltbox). When BOTH are
  // set they override `slope`: the two eaves stay put (footprint unchanged) and
  // the ridge shifts across the width so the left/right slope planes take the
  // requested angles. Measured to the wall-top eave line (not any dropped
  // overhang tip). "left"/"right" are by the segment's left normal — the same
  // sides as overhang_left / overhang_right. Intended for a single-segment gable
  // (open endpoints); on a hip/closed end the ridge shift skews the hip.
  slope_left?: SlopeSpec;
  slope_right?: SlopeSpec;
  min_overhang?: number;      // default 20 (2 ft)
  framing?: RoofFramingConfig;
  material?: string;

  // Currently on hip_roof only — kept optional here.
  tile_density?: TileConfig;
  metal_stock?: MetalStockConfig;

  // Truss placement. Falls back to auto-placement if omitted.
  trusses?: TrussPositionSpec[];

  // Flat-roof extras.
  slab_thickness?: number;
  parapet_height?: number;
  parapet_thickness?: number;

  // Thickness of the masonry gable wall at OPEN endpoints (project units). The end
  // wall is built up as a solid wall following the roof profile, continuous with the
  // wall below. Defaults to the house wall thickness. Formula-drivable.
  gable_wall_thickness?: number;
}

// -----------------------------------------------------------------
// Derived spec — universal output of every derive* function.
// Rendering, BOM, and detail-panel code consume ONLY this shape.
// -----------------------------------------------------------------

export type PlaneRole =
  | "slope"
  | "gable_wall"
  | "parapet"
  | "hip_face"
  | "flat_slab";

export interface RoofPlane {
  id: string;
  vertices: Point3D[];          // CCW when viewed from outward
  role: PlaneRole;
  source_segment_id: string;
  side_of_segment?: "left" | "right" | "start" | "end";
  // For slope / hip_face planes; unit vectors in-plane.
  rafter_direction?: Point3D;
  purlin_direction?: Point3D;
  // Optional: joint members (valley / hip IDs) that logically trim
  // this plane's edge. Populated by resolveJoints. Full vertex
  // trimming is deferred — consumers use this to know when the
  // plane's shape is a fiction (its footprint includes an overlap
  // with a neighbour's plane that should be discounted).
  joint_edges?: string[];
  // For `gable_wall` planes: masonry wall thickness (project units), so the 3D
  // layer extrudes the triangle into a solid wall instead of a thin plane.
  thickness?: number;
  // For `gable_wall` planes: unit vector (project-unit space) pointing from the
  // wall's OUTER face toward the house interior. The 3D layer extrudes the
  // profile polygon along this by `thickness` (so the outer face stays flush
  // with the wall below), and treats the outer cap as external (brick).
  inward?: Point3D;
}

export type MemberRole =
  | "rafter"
  | "purlin"
  | "ridge"
  | "hip"
  | "valley"
  | "ring_beam"
  | "gable_band"         // raking band along the top of a gable wall
  | "hip_beam"
  | "vent_strut"
  | "parapet_cap"
  | "truss_top_chord"
  | "truss_bottom_chord"
  | "truss_web"
  | "tie_beam"           // flat wall-top ceiling tie (horizontal, along segment)
  // Eave border elements — flashing + trim that runs along the outer
  // roof perimeter. Legacy naming preserved for BOM continuity.
  | "pani_patti"          // GI water-protector strip along each eave
  | "eave_L_channel"      // steel L-channel sitting on top of pani patti
  | "corner_double_angle"; // 2 pieces per hip diagonal, riding the hip

export interface StraightMember {
  id: string;
  start: Point3D;
  end: Point3D;
  role: MemberRole;
  section_size?: [number, number];   // [width_ft, depth_ft]
  material?: string;
  source_segment_id?: string;
  // The face (RoofPlane.id) this member lies on. Used by
  // trimAtJoints to clip surface members (rafters/purlins/ring beam
  // etc.) against the face polygon after joint trimming.
  source_plane_id?: string;
}

export interface TrussTriangle {
  id: string;
  // Semantics depend on `kind`:
  //   fink        (symmetric):  bottom_left + bottom_right at wall
  //                              tops, apex at the ridge above the
  //                              segment centerline.
  //   mono_pitch  (shed):        bottom_left at LOW wall top,
  //                              bottom_right at HIGH wall top, apex
  //                              at the ridge DIRECTLY ABOVE
  //                              bottom_right (right-triangle shape).
  bottom_left: Point3D;
  bottom_right: Point3D;
  apex: Point3D;
  source_segment_id: string;
  kind?: "fink" | "mono_pitch";      // default "fink"
  members?: StraightMember[];        // populated by buildTrussMembers
}

// The universal output shape. Every derive*(cfg) returns this.
export interface RoofSpec {
  members: StraightMember[];
  planes: RoofPlane[];
  trusses: TrussTriangle[];
}

// Endpoint resolution — one entry per unique (x, y) point across
// all segment endpoints, snapped to within `epsilon`.
export interface EndpointRef {
  segmentId: string;
  which: "start" | "end";
}

export interface EndpointEntry {
  point: Point2D;                     // canonical coordinate
  refs: EndpointRef[];
  isJoint: boolean;                   // refs.length >= 2
}
