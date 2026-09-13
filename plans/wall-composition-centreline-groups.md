# Wall composition v2: centreline-union per (thickness, height) group

Status: DEFERRED (design captured 2026-09-13). Not started. The current
fat-rectangle union in `editor/src/model/composeWalls.ts` stays in place; this is
the intended cleaner replacement to consider later, alongside the grid/tartan work.

## Why revisit

The current composition buffers each wall centreline into a rectangle and takes the
polygon **union** of all rectangles (`@flatten-js/core`). flatten's boolean is
fragile on rectangles that only **touch** (shared edge, zero overlap), which is the
normal case in a wall grid (back-to-back room walls, L/T/cross junctions, collinear
runs). The workaround is `GROW = 0.5`: inflate every rectangle by 0.25u per face so
touches become small overlaps the boolean can handle.

That 0.25u inflation is the root cause of several downstream hacks:
- the poché is drawn 0.25u wider than the true wall on every exposed face;
- dimensions snap the 0.25 back off (`outerWallSegments`, composeWalls.ts ~L364);
- the pillar cut cannot be exact: an exact cut leaves a 0.25u wall lip hugging the
  column, so the cut has to clear ~0.25u, and any isotropic clear that eats the lip
  on one wall pulls the crossing wall back and opens a visible gap (the gap-vs-fight
  tradeoff we kept fighting).

## The idea

Group walls by (thickness, height). Within a group every wall is identical in both,
so:

1. **Union the centrelines, not rectangles.** A 1D operation. Coincident/collinear
   centrelines collapse trivially (kills double-wall for free) and never hits the
   touching-rectangle failure.
2. **Buffer the merged network once by T/2** using a real offset primitive
   (clipper2 or equivalent). One robust offset gives exact wall faces with proper
   miters at same-thickness L/T/cross junctions. No GROW, no 0.25 lip.
3. **Extrude each group's polygon to its own height.** This is the height-grouping
   we already have (`ComposedFloor.groups`), now keyed on thickness as well.

Result: exact faces everywhere, so the pillar cut becomes an exact cut with no gap
and no z-fight, and the dimension snap-back and the pillar-clear hack both disappear.

## What this simplifies vs today

- Removes the global GROW inflation and everything that compensates for it.
- Extends the existing height grouping to (thickness, height); the render already
  iterates groups.
- Swaps a many-way fragile 2D boolean for a 1D union plus a single robust offset per
  group.

## Risks / remaining work (all local, not global)

1. **Offset primitive is the enabling dependency.** Must be a genuine polygon offset
   (clipper2-style). If "buffer" is implemented as make-rectangles-then-re-union we
   are back to flatten + GROW. Adopting clipper2 is a dependency add + a parity
   re-baseline across the 6 configs.
2. **Group-to-group junctions** (thick meets thin, tall meets short) are drawn as
   separate solids. Make the thinner/shorter wall's centreline run **to or slightly
   into** its neighbour's centreline so its buffered end is buried inside the
   neighbour, not exactly coincident with its face. Buried faces are hidden -> no gap,
   no z-fight. Room walls already run full-span corner-to-corner so this is mostly
   free; standalone walls need to extend into the neighbour. The hard mixed-thickness
   case becomes a small hidden overlap instead of a global boolean.
3. **Classification + estimator run per group.** A buried end cap at a group boundary
   is still counted as a little wall area (tiny junction over-count; no render effect).
4. **2D outer-dimension contour** currently traces one poché. With per-group polygons,
   union the exact group polygons once for the outline (a boolean, but now on
   overlapping exact polygons = well-conditioned, not touching-only), or trace across
   them. Modest glue, not a redesign.
5. **Miter spikes** at acute angles / very short segments from the offset; cap with a
   miter limit. Not a threat for rectangular plans.

## Unchanged

Exposure classification (brick/paint) and opening cuts work on the buffered polygon
exactly as now. Pillars still cut each group's poché, but the poché is exact so the
cut is exact.

## Before building

- Adopt clipper2 (or equivalent) as the buffer op.
- Scan the real target files (surve, atale, coastal references) for the actual spread
  of wall thickness and height, to see how many groups a typical model yields and how
  common the group-boundary junctions in risk 2 really are.

Related: [[project_wall_composition_plan]], plans/wall-composition.md,
plans/grid-convention.md.
