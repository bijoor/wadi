# Parametric furniture elements

Status: design of record. Branch `feat/wadi-bundle-format`, fork only (see the
submission-freeze note). Supersedes the ad-hoc `kitchen_platform` primitive.

## Motivation

Wadi has two furniture worlds that do not share machinery:

- **GLB `item`** (`editor/src/registry/nodes/item.tsx`): a fixed mesh, but it owns the
  good placement machinery — `anchor_to` a room, a 9-point `anchor`, `gap_x`/`gap_y`, a
  plan footprint derived from `asset.dimensions`, and full participation in the
  auto-placement engine (`editor/src/furniture/autoplace.ts`).
- **`kitchen_platform`**: procedural mesh (the valued part — a continuous, arbitrarily
  sized slab), but bolted on with absolute floor coordinates, no room relationship, no
  anchoring, no auto-placement, and a dozen scattered `if (obj.type === "kitchen_platform")`
  branches instead of a registry node.

The realisation: `item`'s placement machinery is **already general**. Nothing in the anchor
resolver (`svg2d/furnitureAnchor.ts`, `expand.ts`) or the auto-placement engine is
GLB-specific in principle. Only two things are item-specific: the **mesh source** (a GLB)
and the **footprint source** (`asset.dimensions`). Everything else — anchoring,
door-dodging, layout rotation, `locked`, layers, formulas, forms, docs — is source-agnostic.

So the fix is not "replace kitchen_platform"; it is to introduce a **capability** the
registry lacks: a *parametric furniture element* whose mesh and footprint come from its own
scalar parameters, riding the exact same rails as a GLB item. `counter` is the first
instance. After it, each further parametric element (wardrobe/almirah, storage loft, wall
shelf, seating ledge/diwan, bathroom vanity, pooja niche) is one registry file.

This is domain-valuable, not just tidy: Indian homes lean heavily on built-in masonry and
carpentry that is inherently "size it to the wall", which a fixed GLB catalog structurally
cannot cover.

This sits under the existing primitive-componentization arc
(`plans/primitive-componentization.md`): the parametric-furniture element is a capability
that views + the engine consume, exactly like `render3D` / `drawPlan`.

## The capability: `FurnitureElement`

A node opts into being placeable-like-furniture by exposing a small capability. Both the
GLB `item` and the procedural `counter` implement it; the anchor resolver and the
auto-placement engine read the capability, never a GLB directly.

```ts
interface FurnitureElement {
  // Plan bounding box in PROJECT UNITS, derived from the object's own params.
  // GLB item: metersToUnits(asset.dimensions).  counter: length/depth directly.
  footprint(obj, ctx): { w: number; l: number };
  // Seeds the auto-placer + the default facing:
  //   "wall"   — hugs one wall, sized to the clear span (counter, shelf, vanity)
  //   "corner" — sits in a corner (loft, corner cabinet)
  //   "free"   — floats (a GLB table/bed today)
  placement?: "wall" | "corner" | "free";
}
```

The 3D mesh and 2D footprint continue to come from the node's existing `render3D` /
`planFootprint` hooks. The capability adds only the two things the *placement* machinery
needs that were previously hard-wired to a GLB asset.

### Shared consumers (read the capability, not the GLB)

1. **Anchor resolution** (`svg2d/furnitureAnchor.ts` + `expand.ts`). The anchor+gap math
   already needs only a footprint and a rotation. Factor `anchorItem` into a
   footprint-core (`anchorByFootprint`, takes project-unit half-extents) plus a thin
   metres-taking wrapper (unchanged callers). `expand.ts`'s `anchoredItem` routes a
   non-item furniture element through the capability's `footprint()` instead of assuming
   `spec.asset.dimensions`. A counter anchors into a room exactly like an item.
2. **Auto-placement** (`furniture/autoplace.ts`). A `Piece` today carries a
   `FurnitureAsset` with metric `dimensions`. Add an optional project-unit `footprint`
   (and a `placement` hint) to `Piece`; `pieceBox` prefers it when present, else falls
   back to `metersToUnits(asset.dimensions)` (GLB path, byte-identical). After this, any
   `FurnitureElement` is auto-placeable with no further engine work.

The payoff: adding parametric element N+1 is **one registry file** (schema/fields via the
`fields` system → schema + DSL + form + docs; `footprint()`; `render3D`/`planFootprint`; a
small `RoomItem`-style grammar rule). It inherits anchoring, auto-placement, `locked`,
layers, formulas, and generated docs for free — no changes to expand, the engine, or the
renderer dispatch.

## First instance: `counter`

Renames and replaces `kitchen_platform`. Wall-agnostic (kitchen platform / otta, bathroom
vanity, utility slab). Renaming lets `kitchen` drop out of `HARD_KEYWORDS`
(`wadi-dsl/src/language/soft-keywords.ts`), removing the very keyword collision that
started this (`furniture auto type "kitchen"`).

- **Params:** `length` (default = the anchored wall's clear span, so it auto-fills),
  `depth`, `height`, plus the common tail (`enabled`/`layer`/`locked`/`formulas`/`name`)
  and `material`.
- **Placement:** `anchor_to` a room + `anchor` (which wall) + `gap`. `placement: "wall"`.
- **Mesh:** the existing procedural extrusion, but now a single wall-run box (length ×
  depth × height) instead of a polyline. Corners are handled by multiple runs (below).
- **L / U shapes = multiple runs** (owner decision 2026-09-14): one `counter` per wall (2
  for L, 3 for U), each anchored to its wall. The auto-placer sizes each to its wall's
  clear span and slides it off doors. Simpler and more standard than a wrap-around
  polyline, and it matches how casework is actually specified.
- **Auto-placement extension:** a "fit to clear span" wall-run piece, rather than a
  fixed-dimension loose piece. Small, additive.

## Rollout

1. **Substrate** (step 1, this pass). Add the `FurnitureElement` capability to
   `registry/types.ts`; factor `anchorItem` into `anchorByFootprint` + wrapper (pure,
   parity-safe); add the optional `footprint`/`placement` seam to the engine `Piece` +
   `pieceBox` (additive, GLB path byte-identical). No new object type yet, no behaviour
   change. Item stays identical; parity 6/6.
2. **`counter` node.** `editor/src/registry/nodes/counter.tsx` implementing the capability
   (schema/fields/render3D/planFootprint/emitWdl/facets + `footprint`/`placement`).
   Retrofit `item` onto the same capability. Register in `registry.ts`.
3. **DSL.** `counter` grammar rule (room-nested `RoomCounter` + optionally a free form),
   compile/emit; drop `kitchen` from `HARD_KEYWORDS`. Keep a legacy reader so existing
   `kitchen_platform` configs still load — map a `kitchen_platform` to one or more counter
   runs at load, or keep the legacy primitive readable for one release.
4. **Migrate + delete.** Convert the two demo files that use the old primitive
   (`wadi-dsl/examples/complete.wdl:70`, `wadi-dsl/std-modules/konkan/base.wdl:57`), then
   delete the scattered `kitchen_platform` branches (schema, House3D, floorPlan/shapes,
   defaultFactory, layerDefaults, promote, grammar rule, compile/emit, wdlReference).
5. **Tests + parity.** Engine tests for the fit-to-span wall run; round-trip tests for
   `counter`; parity 6/6.

## Files (from the code map)

- Substrate: `registry/types.ts`, `svg2d/furnitureAnchor.ts`, `furniture/autoplace.ts`,
  `svg2d/expand.ts` (`anchoredItem`).
- Counter node: new `registry/nodes/counter.tsx`, `registry/registry.ts`,
  `schema/houseConfig.ts`.
- DSL: `wadi-dsl/src/language/wadi.langium`, `.../soft-keywords.ts`,
  `.../generator/toHouseConfig.ts`, `.../generator/fromHouseConfig.ts`.
- Legacy removal: `three/House3D.tsx:439-488`, `svg2d/floorPlan.ts:269-276`,
  `svg2d/shapes.ts:154-177`, `state/defaultFactory.ts`, `state/layerDefaults.ts:19`,
  `registry/promote.ts:118`, `viewer/wdlReference.ts:149`.

## Non-goals

- Not a constraint solver; a counter's default length is the wall clear span, adjustable.
- Not GLB tiling: a monolithic platform stays a single procedural box (a Western modular
  cabinet run remains the GLB-item / `model`-rig story).
- Wall heights stay structural (unchanged from the room-templates scope decision).
