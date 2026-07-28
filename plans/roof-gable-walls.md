# Gable walls at open roof ends (replace the flat infill plane)

> **Status: BUILT** (model + derive + 3D extrusion + top-floor Walls layer +
> gable band in frame + tests). Steps 1–4 + 6 done; step 5 (BOM) still a
> follow-up. Verified live: open-gable house renders a solid triangular
> masonry gable wall shaped to the roof profile, on the top-floor Walls layer
> (stays visible when the Roof layer group is hidden).

## Problem
At an **open** roof endpoint (a gable end of a pitched roof, or the raked sides of a
shed roof) Wadi currently emits a thin `gable_wall` **RoofPlane** — a flat triangle
painted like a wall. It reads as a plane, not a wall. Real construction puts an actual
**masonry gable wall** there, shaped to the roof profile.

## Construction convention (researched)
- **Gable wall**: the end wall is built up as a triangle following the exact roof pitch,
  **continuous with the wall below**, up to the ridge; it closes the roof end and carries
  the verge rafters. → model a **solid wall with thickness**, not a plane.
- **Bands (IS 4326; Konkan = seismic zone III):**
  - **Roof band / ring beam** — continuous RC band at eave/wall‑top level around all
    walls. Wadi already models a `ring_beam` (4 members per segment rect at `wallTopZ`).
  - **Gable band** — band at the **top of the gable masonry, just below the purlins**,
    running **up the slope**, **continuous with the roof band** at the eaves. → NEW, one
    member per slope edge of the gable triangle.
- **Tie beams**: rafter outward thrust is resisted by ties = the **truss bottom chords**
  (already present). Gable walls support only the end rafters and don't remove the need
  for ties on interior spans → keep trusses unchanged.

## Decisions (user)
1. Gable wall thickness = **house wall thickness**, **overridable** by a param/formula
   (`roof.gable_wall_thickness`, project units).
2. Model **both** the eave ring beam (exists) **and** the gable band (new).
3. Gable wall renders on the **top floor's Walls** layer (hides/shows with walls).

## Current geometry (verified)
- `derivePitched.ts`: open endpoint → `gable_wall` plane = isoceles triangle
  `[wallRight@wallTopZ, wallLeft@wallTopZ, apex@ridgeZ]` (apex on the segment centre line).
  Slope edges: wallLeft→apex, wallRight→apex.
- `deriveShed.ts`: open leaf endpoint → right‑triangle
  `[low@wallTop, high@wallTop, high@wallTop+rise]`. Raking edge: low@wallTop → high@wallTop+rise.
- Ring beam: `segments.ts::ringBeamMembersForRect(rect, wallTopZ, segId)`.
- 3D: `three/V2RoofSolid.tsx` renders every plane via `<SolidPlane>` (thin polygon);
  `House3D` pushes `V2RoofSolid`→"loft", `V2RoofFrame`→"frame_spine",
  `V2RoofSurface`→"frame_surface". Derive opts = `{ wallTopZ, defaultMinOverhang?, defaultEndpoint? }`
  (no wall thickness today).

## Build plan
1. **model.ts**
   - `RoofConfig.gable_wall_thickness?: number` (project units; formula‑drivable).
   - `RoofPlane.thickness?: number` (set on `gable_wall` planes → drives 3D extrusion).
   - `MemberRole` += `"gable_band"`; `RoofFramingConfig.gable_band_size_ft?: [number,number]`
     (default = `ring_beam_size`).
2. **Derive opts**: thread `wallThickness` (house wall thickness, project units) into the
   derive opts from `computeFromHouse` / the roof derivation call sites.
3. **derivePitched.ts / deriveShed.ts**
   - Set `thickness = cfg.gable_wall_thickness ?? opts.wallThickness` on each `gable_wall` plane.
   - Emit **gable_band** members along the gable triangle's **slope edge(s)** at the wall
     top: pitched → 2 (wallLeft→apex, wallRight→apex); shed → 1 (low→high@rise). Sized from
     `framing.gable_band_size_ft ?? ring_beam_size`. Continuous with the ring beam at the eave.
4. **3D render**
   - New `V2RoofGableWalls` component: renders `role === "gable_wall"` planes as **extruded
     prisms** (triangle × `thickness`, extruded along the segment axis, inward), wall‑paint
     material. `V2RoofSolid` **skips** `gable_wall` planes.
   - `House3D`: `push(defaultLayerFor("wall", topFloorNum, layerDefaults), <V2RoofGableWalls/>)`
     — top‑floor Walls layer. `topFloorNum` = max floor_number.
   - **gable_band** members render in `V2RoofFrame` alongside `ring_beam` (frame_spine),
     with a colour.
5. **BOM** (follow‑up): gable‑band length rows; optionally gable‑wall area into the wall‑area
   estimator. Not blocking the geometry.
6. **Tests**: `gable_wall` planes carry `thickness`; open ends emit the right count of
   `gable_band` members (pitched 2/end, shed 1/end); closed ends emit none; parity holds.

## Refinement round 2 (review feedback — IN PROGRESS)

Live review of the first cut surfaced four defects. Root causes verified against
`house_config.wadi` (rooms use OUTER-footprint semantics — `roomOpeningToFlat`
puts the north wall at `y=ry` going inward, so the room-rect edge = outer wall
face) and a shed screenshot.

1. **Gable wall off-centre vs the wall below.** `GableWallPrism` extrudes the
   profile triangle SYMMETRICALLY (±½t) about the footprint edge, so it overhangs
   the wall below (whose outer face is ON that edge) by ½t. **Fix:** extrude
   INWARD (toward the interior) by the full thickness so the gable's outer face
   is flush with the wall below. Derive tags each `gable_wall` plane with an
   `inward: Point3D` unit vector (pitched start→+unit, end→−unit; shed toward the
   low side / interior). `GableWallPrism` builds front ring = base verts, back
   ring = base + inward·t.
2. **Shed: no wall on the OPEN (high-eave) end, only the raking sides.** The two
   raking triangular ends get walls; the high eave (where the roof rises `rise`
   above wall-top) is open. **Fix:** `deriveShed` emits an extra rectangular
   `gable_wall` along the high wall line: `[highStart@wallTop, highEnd@wallTop,
   highEnd@wallTop+rise, highStart@wallTop+rise]`, inward = toward low side.
3. **Ring beam must ride the top of the raised/raking wall, not sit flat at
   wall-top.** Where a gable wall exists the flat eave-level ring member is buried
   mid-wall. **Fix:** selective ring emission per side —
   - pitched OPEN end → drop the flat end member; the raking `gable_band`
     (wallLeft→apex, wallRight→apex) is the band. CLOSED (hip) end keeps its flat
     member (the hip sits on it) — preserve existing hip behaviour.
   - shed raking ends → drop the flat end member; `gable_band` (low→high@rise)
     carries it. Shed HIGH side → move its ring member UP to `wallTop+rise` (top
     of the high infill wall). Low side + pitched side eaves keep flat members.
4. **External vs internal wall faces on the gable.** Reuse the wall face system
   (`wallCSG` `external`/`outerSign`/`splitOuterFaceGroups` → brick outer, plain
   inner). The gable prism's OUTER cap (base-vert side) = brick (external); inner
   cap + sides = plaster. Compute the external side from `inward` (external =
   opposite of inward).

Build order: 1 (align) → 2 (shed high side) → 3 (ring relocation) → 4 (faces),
each verified live. Tests updated for the new plane/member counts + `inward`.

## Explicitly deferred
- **Roof‑type chooser** (Hip/Gable/Shed/Flat + per‑end open↔closed for architect + owner).
  Separate step — it also needs the shipped **templates** updated to the new endpoints, so
  do it after this geometry lands. The V2 model already supports it via `roof_type` +
  per‑endpoint `open`/`closed`.
- **Roof‑aware pillar heights** (tie the roof‑carrying columns to the roof, review 2026‑07‑28).
  Today pillars stop at the beam/eave level (Z=226 in atale), exactly at the gable base, so
  there is **no** gable↔pillar overlap. Once pillars are made to rise to the roof underside,
  they will. Decisions:
  - **Where the roof‑type → pillar‑height relation lives: the configurator re‑derive**
    (`wadi-config` / configurator), NOT the formula engine. Reason: the evaluator has no
    conditionals/string compare and no access to the derived roof, so it can't switch the
    height law when `roof_type` flips (pitched triangle `beam_top + rise·(1−|x−ridge_x|/(W/2))`
    vs shed ramp vs flat constant). The re‑derive step rewrites the pillar‑height formula +
    the roof together so they never disagree. Within‑a‑type parametrics ride shared House
    variables (`roof_rise`, `eave_z`, `ridge_x = House.W/2`) that both the roof and the pillar
    formulas reference. (A `roof_top(x,y)` formula function was considered and set aside — it
    would need the derived roof wired into the pure evaluator.)
  - **Gable‑wall ↔ pillar auto‑trim: deferred, built WITH the above.** When pillars extend
    into the gable, make gable walls CSG‑subtract any pillar that rises into them (mirror the
    regular wall→pillar trim; `allPillars` `{rect,z0,z1}` already exists in `House3D`; pass it
    into `V2RoofGableWalls`/`GableWallPrism`, subtract, then re‑split brick/plaster groups by
    triangle normal like `splitOuterFaceGroups`). Build it then so it can be verified against a
    real overlap. No‑op until pillars extend.
