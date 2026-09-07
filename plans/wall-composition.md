# Wadi wall composition — a whole-model wall network, classified per face

Status: **design proposed, owner-initiated (2026-09-04), not started.** Supersedes
the per-room wall stamping in `editor/src/three/House3D.tsx` + the per-wall
external/internal verdict in `editor/src/estimate/wallArea.ts`. Builds on the
centreline model in [grid-convention.md](grid-convention.md) and the `center`
coord convention.

## Problem

Walls are built at the granularity of a ROOM. Each room emits its own four-sided
ring:

- North/south walls span the full room width and OWN the corner squares;
  east/west walls are inset by one wall-thickness at each end so they butt in
  (`House3D.tsx` ~682-693).
- Shared boundaries between two rooms are handled by ad-hoc OWNERSHIP bookkeeping
  (the planner declares the wall+door on the left/top room only, to avoid
  coincident-door collisions and double walls).
- Each room-side box then gets ONE external/internal verdict, which drives its
  material (laterite brick vs flat interior paint) in 3D and the wall-area split
  in the estimator.

This per-room decomposition manufactures the artifacts:

1. **Corner white column.** A corner block belongs to exactly one wall (the N/S
   one). When a room's external E/W wall meets an internal N/S wall, the corner's
   E/W-facing end cap inherits the *internal* verdict and is painted flat white,
   right next to the brick facade. Visible as a thin full-height white stripe at
   the ends of external east/west walls. (An interim per-face patch — probe each
   end cap and brick it when exposed — is committed on `feat/wadi-bundle-format`;
   see "What this retires".)
2. **Ownership bookkeeping.** Who declares a shared wall/door is a manual concern
   in the planner exporter and a source of "double wall" / "coincident door"
   bugs.
   - **A shared wall is drawn by exactly ONE room** (the east/south room), even
     when the two rooms differ in size or the boundary is only partially shared.
     The single owner's geometry then dictates the shared wall + any opening in
     it; the neighbour omits its side entirely. This is wrong: the wall belongs
     to neither room, and a partial or size-mismatched boundary has no correct
     single owner. The per-side model is binary (own the whole side or omit it),
     so it can't represent one side that is partly this room's and partly a
     neighbour's — a multi-neighbour side would double-wall or fill an opening.
   - **Opening placement is coupled to ownership**, so an opening can only live on
     the owner's wall. This is why the connection's DIRECTION (the flow arrow, "from"
     room) cannot decide which room carries the opening today — placement is fixed
     by position, not intent. Under composition the opening attaches to the composed
     wall section and the direction is free to be pure graph metadata (attribution /
     flow), decoupled from geometry.
   - **Openings on a crossing wall drift** because they are written against the
     shared guide lines rather than the wall's own extent. (Interim fix committed
     on `feat/wadi-bundle-format`: an opening's far edge is emitted as
     `nearGuide + <dimensionVar>` and a whole-wall opening anchors to the wall
     start, so it tracks the room's size. Composition supersedes this by owning the
     wall section directly.)
3. **The external/internal call is per whole wall**, so it has nowhere correct to
   land where an external and an internal wall meet.

Owner's framing: "consider internal and external classification once the entire
model is created, then examine all wall sections after we compose the entire
model" — i.e. stop thinking in room rings.

## Direction (owner-proposed)

Compose ONE wall solid per floor, then classify each face on its own merits.
A wall face is brick iff the point just beyond it is open to weather; a corner is
a JOIN in the solid, not a property a room owns.

## Decisions (owner-confirmed 2026-09-04)

1. **Merge policy on disagreement: split into subsections.** Where two coincident
   centrelines disagree on thickness or height, keep them as distinct sub-sections
   (do NOT average or max). Same centreline, different section per differing span.
2. **The method is angle-agnostic — it must not care whether a wall is
   axis-aligned or diagonal.** Rooms stay axis-aligned rectangles (no diagonal
   room walls; angular structure lives only in the roof), but a standalone `wall`
   is an arbitrary linear segment and MUST compose by the same mechanism. So the
   model works on line segments of any angle, not an axis-aligned special case.
3. **A full-span gap gaps the INTERNAL part of the wall, not the ends.** When a
   gap covers a whole shared wall, the corner/end regions stay solid because they
   are shared with the perpendicular walls that meet there; only the span between
   those joins is void. This falls out of the union model below (the ends are
   filled by the neighbouring walls' buffered rectangles).

## The model — centrelines buffered to thickness, unioned into the poché

The angle-agnostic formulation (decision 2). Model every wall as a CENTRELINE
buffered by half its thickness; the floor's wall solid (the poché) is the UNION
of those buffered rectangles. Per floor:

1. **Collect centrelines.** Every room contributes its four edges as centrelines
   (room rectangle edges under the `center` convention); every standalone `wall`
   contributes its segment directly. Each carries a thickness (house
   `wall_thickness`, or per-line tartan thickness once
   [grid-convention.md](grid-convention.md) lands ext/int bands) and a height
   (+ `height_end`).
2. **Buffer + union.** Buffer each centreline to a thickness rectangle and UNION
   them all (`editor/src/model/` already wraps `@flatten-js/core` for polygon
   booleans). The union does the work that ownership + corner-inset did by hand:
   - coincident/overlapping walls **merge** (double-wall problem gone),
   - junctions **fill themselves** where rectangles overlap (L, T, and X joins,
     at ANY angle — no mitre special-casing, decision 2),
   - the result is one polygon-with-holes: the floor poché.
   Where centrelines coincide but thickness/height differ, they stay distinct
   sub-sections (decision 1) rather than merging into one rectangle.
3. **Classify each boundary edge.** For every edge of the poché boundary, probe
   just outside it against the UNION of all room footprints on the floor. Brick
   iff exposed; interior otherwise. The corner comes out right for free — each
   boundary edge stands on its own, so an external run and an internal run meeting
   at a corner each keep their own finish (this is the white-column fix, done
   structurally instead of by the interim end-cap probe).
4. **Extrude + subtract openings.** Extrude the poché to wall height and subtract
   each opening (door / window / gap — see [gap primitive]) as a box, as the CSG
   path does today. A full-span gap removes only the poché INTERIOR span; the
   ends persist because they are the overlap with the perpendicular walls
   (decision 3).

Split-level / per-side heights: sections whose heights differ are not merged in
the extrude step (decision 1), so a stepped wall keeps its profile.

## Consumption boundary

Introduce a model-layer `composeWalls(floorConfig) -> WallSection[]` stage
(candidate home: `editor/src/model/` or a new `editor/src/walls/`), where a
`WallSection` carries: centreline + thickness + height, per-face brick flags, the
join geometry at each end, and the openings that fall on it. BOTH renderers
consume `WallSection[]`:

- 3D (`House3D.tsx`): build the CSG solid from sections + face-material groups
  from the per-face flags (the existing `WallWithOpenings` group machinery
  generalizes to N brick faces).
- 2D (`svg2d/floorPlan.ts`, `elevationView.ts`): draw wall lines + openings from
  the same sections.

Today each renderer re-derives walls from `expandRoomWalls` (`svg2d/expand.ts`),
the per-renderer chokepoint. `composeWalls` runs on the already-expanded config,
so `expandRoomWalls` stays the flattener and `composeWalls` becomes the shared
wall-solid builder. The estimator (`estimate/wallArea.ts`) also moves onto
sections (external/internal area falls straight out of the per-face flags), so the
render and the quantities can never disagree.

## What this retires

- The N/S-owns-corners + E/W-inset convention in `House3D.tsx`.
- The planner's shared-wall OWNERSHIP bookkeeping (`wallsFromGraph.js` `owns`).
- The whole-wall external/internal verdict (`roomSideIsExternal` /
  `classifyStandaloneWall` / `splitWallByCoverage`) — replaced by per-face probing
  on composed sections.
- The interim per-face end-cap patch (`pointExposedOnFloor` + `brickStart/brickEnd`
  in `wallCSG.tsx` / `House3D.tsx`) — a stopgap that fixed the visible white column
  without composing; delete once sections carry per-face flags natively.

## Interactions / constraints

- **Parity gate.** This changes 2D output, so the golden must be regenerated
  deliberately (`npx tsx scripts/parity-render.mjs --update`) as an intentional
  geometry change — not slipped in. (Note: 3/6 parity configs already drift on
  `feat/wadi-bundle-format` for unrelated reasons; reconcile before regenerating.)
- **Grid convention.** The centreline network IS the tartan grid's dual; this
  should consume grid lines directly once grids are canonical, and honor per-line
  ext/int thickness.
- **Pillar trim** ([Pillar-wall trim]) — walls already trim at pillars; fold the
  pillar faces into the junction-splitting so trimming is one mechanism, not two.
- **Wall coverage → material** ([Wall coverage material]) — the same-floor-outboard
  shelter rule (a verandah in front makes an outer face interior) becomes just
  another per-face probe on a section; keep the same-floor-only rule.
- **Split-level / per-side wall heights** must survive: sections carry height +
  `height_end`, merged only when heights agree (else keep as distinct sections).

## Open questions

1. **Opening → boundary-edge mapping.** An opening is authored on a room side /
   wall at an offset+width. After buffer+union it must be located on the poché to
   cut the right box. Straightforward for a segment that survives union unchanged;
   needs care where the union merged or split the host wall. Likely: keep each
   opening bound to its source centreline + span, and cut in centreline space
   before/independently of the boundary classification.
2. **Boundary-edge probe distance vs thin walls.** The just-outside probe must
   clear the wall's own thickness but not reach past a thin adjacent room. Reuse
   `probeDist = max(6, t*1.5)` from `wallArea.ts`, validated on the parity set.
3. **Union robustness at near-coincident centrelines** (float noise where a room
   edge and a wall nearly align). Snap centrelines to a tolerance before union.
4. **Poché boundary → 2D wall lines.** The floor plan currently strokes room
   rectangles; from the poché it strokes the boundary polygon instead. Confirm the
   dimension pipeline (which keys off room rects / wall bounds) still resolves.

## Phases

- **P0** — `composeWalls` behind a flag, 3D only, axis-aligned; assert it renders
  the balcony-ring example with 0 errors and no white column, matching the interim
  patch. Keep the old path as fallback.
- **P1** — Move the estimator onto sections; assert wall-area parity with today on
  the 6 parity configs (numbers, not bytes).
- **P2** — Move 2D (floor plan + elevation) onto sections; regenerate the parity
  golden as one intentional geometry change.
- **P3** — Delete the per-room ring path, the ownership bookkeeping, and the
  interim per-face patch. Consume grid lines + tartan thickness directly.
