# Functional-constraint testing mechanism

Status: **design, for build** (2026-08-08). Details out the "extensible conventions"
note in `project_dsl_conventions.md` and the "Planned conventions (not yet enforced)"
backlog at the bottom of `wadi-skill/architect/reference/conventions.md`.

## Problem

We already validate functional constraints on a house: the C1-C7 structural
conventions (a floor must not float, a room must wall every exterior side, a stair
must land on a floor, openings must not overlap, ...). They are enforced at author
time. But a single convention is spread across four uncoupled places with no shared
way to express it and no shared way to test it:

1. `editor/src/lint/structural.ts` - a `ConventionMeta` entry in `CONVENTIONS[]`.
2. the same file - a block inside `lintStructure(config)` that pushes findings.
3. `wadi-skill/architect/reference/conventions.md` - a hand-written `## Cn` section
   (Statement / Rationale / Fix), bundled into the MCP by `gen-assets`.
4. `editor/src/lint/structural.test.ts` - hand-rolled tests, shaped differently per rule.

Nothing keeps these in lockstep; the doc can drift from the code, and the cost of a
correct + tested + documented rule is high enough that the "planned conventions"
backlog never gets written.

## How we express a constraint (the syntax question)

We will **not** define a parsed grammar for constraints. In normal coding, tests are
not a separate language: `describe/it/expect().toEqual()` is a library in the host
language (an internal DSL), not a parser. A constraint has the same three parts as a
test: fixtures (data), a matcher vocabulary (functions), and a structure (a driver).
Only the matcher vocabulary is worth "defining", and it is a library, not a grammar.

A parsed constraint language (OCL / SHACL / Semgrep style) pays off only when
constraints are authored by non-programmers, shared across runtimes, or stored as
portable data. None hold here: we author the constraints, they run only in the TS
pipeline, and they routinely need real geometry (C2 samples points along each wall to
decide "open to weather"; C5 expands stair flights to find the bottom Z; a roof-coverage
rule runs the roof-v2 derivation). A data-expression language cannot express that
without becoming a general programming language.

So a constraint's `check` is written at one of two levels:

**(a) Raw predicate** - a plain TS function; full power, no shared vocabulary:
```ts
check(ctx) {
  const out = [];
  ctx.expanded.floors.forEach((f, i, all) => {
    if (i === 0 || i === all.length - 1 || !hasWalls(f)) return;   // skip plinth + top
    if (num(f.height) !== num(f.wall_height) + num(f.slab_thickness))
      out.push({ rule: "C4", level: "warn", floor: f.floor_number, message: "..." });
  });
  return out;
}
```

**(b) Embedded vocabulary** - the same rule through navigation + finding helpers:
```ts
check: forEachFloor({ skip: ["plinth", "top"], require: "walls" }, (f, report) => {
  if (f.height !== f.wall_height + f.slab_thickness)
    report(`height ${f.height} != wall_height ${f.wall_height} + slab_thickness ${f.slab_thickness}`);
})
```

**Decision: start with (a) + (b), and let (b) emerge.** We do not pre-build a matcher
library up front. Phase 1 ships only the finding builder (`report`) plus whatever
traversal the first migrated rule needs. Each subsequent rule either reuses an existing
helper or adds one. By the time C1-C7 are migrated, the vocabulary has settled from
real use rather than being guessed. A geometry-heavy rule always has the (a) escape
hatch inside the callback, so the vocabulary never blocks a rule it cannot express.

Deferred (revisit once patterns are visible): a declarative `relation({scope, assert,
message})` sugar for the purely relational rules (C1 `floor.height == plinth.height`),
which is tiny internal sugar over (b), not a grammar, and degrades to a `check`
callback for anything geometric.

## Model query layer (the foundation, build this first)

Most constraints are inter-object relationships: "is anything within D of this
point", "do these two footprints intersect", "which openings sit on this wall line",
"does the roof cover every room below it". Today that geometry is reimplemented ad hoc
in several places (`estimate/wallArea.ts` room rects + `roomSideOpenToWeather` + point
tests; `structural.ts`'s inline yaw-aware item footprint and opening-span overlap;
`svg2d/wallTrim.ts`'s wall/pillar overlap). Before writing more constraints we build one
**model query layer** that answers these questions, and constraints (and, over time, the
estimator and trim code) call into it instead of re-deriving geometry.

This layer is distinct from two things it is easy to confuse it with:
- the **parametric layer** (`param/` variables/points/grid/formulas) is authoring-time:
  how values *derive*. The query layer reads the *resulting* geometry of the resolved
  model. Formulas place a room; queries ask what that room now overlaps.
- **`three/coords.ts`** is 3D placement for rendering. The query layer is a headless,
  render-free spatial index used for reasoning, not drawing.

### Geometry it works in: true 2D plan shape + Z band

Full 3D solid/CSG intersection is unnecessary and heavy, but a bounding box is not
enough either: roof segments are triangles/trapezoids, a switchback staircase is a U, a
multi-segment roof or courtyard house is concave or has a hole, and a `model` (GLB)
footprint need not be rectangular. So an object's plan **footprint is its true polygon,
not its bbox** - a `@flatten-js/core` `Polygon`, which represents a general (possibly
concave, possibly holed / multi-part) area directly.

We do **not** hand-roll the geometry kernel or decompose shapes into convex pieces.
`@flatten-js/core` provides the exact boolean and predicate operations we need on general
polygons: `BooleanOperations` (unify / intersect / subtract), point-in-polygon
containment, and `distanceTo`, plus a spatial index for the broad phase. `geom.ts` is a
thin adapter over it (see below); the library choice is documented under Dependencies and
kept behind the `SpatialModel` facade so it is swappable.

Each object also carries a vertical **Z band** `[lo, hi]` from the floor's base elevation
and the object's own z/height; "two objects intersect" = their polygons overlap in plan
AND their Z bands overlap. This covers the real constraints: stair-lands-below-ground (Z
band dips below 0), roof-covers-footprint (plan coverage via `subtract`), opening/furniture
overlap (plan + shared wall/floor band), room-shelters-wall-below (plan overlap across
adjacent bands). The AABB is kept only as a broad-phase reject, never the test.

### Footprints come from registry facets (so custom primitives are queryable for free)

The index reads each object's footprint through the registry it already has. Two levels:
- primitives with a true non-box shape (roof segments, a concave `model`) expose a new
  `facets.footprintPoly(obj) -> Ring[]` returning the polygon rings (outer + any holes);
- everything else reuses the existing box facets: `facets.footprint` / `planFootprint`
  (yaw-aware `NodePlanFootprint`), then `facets.bbox` (`PlanAABB`), then a raw
  `x/y/w/(l|d)` fallback - each **lifted to a 4-point ring**.

`geom.ts` turns whichever the facet returns into a `@flatten-js/core` `Polygon`. Composite
primitives (staircase, component) need no polygon facet at all: they expand into leaf parts
before indexing, and each leaf contributes its own footprint (the whole is their union via
the library if a constraint ever needs it). Because the geometry source is the facet, **any
custom primitive that exposes a footprint (box or polygon) is spatially queryable with no
query-layer change** - the same generalization seam as the constraints themselves.

### API sketch

```ts
// editor/src/model/geom.ts  (thin adapter over @flatten-js/core, unit-tested)
import { Polygon } from "@flatten-js/core";
export interface Vec2 { x: number; y: number }
export type Ring = Vec2[];                          // one polygon ring, world plan coords
export type Footprint = Polygon;                    // a flatten-js Polygon (concave/holes/multi ok)
export interface AABB { minX: number; minY: number; maxX: number; maxY: number }
export interface ZBand { lo: number; hi: number }
export function ringsToFootprint(rings: Ring[]): Footprint;   // build from facet output
export function footprintsOverlap(a: Footprint, b: Footprint): boolean;   // intersect non-empty
export function footprintIntersection(a: Footprint, b: Footprint): Footprint | null;
export function footprintUnion(fs: Footprint[]): Footprint;               // BooleanOperations.unify
export function footprintContains(outer: Footprint, inner: Footprint): boolean; // subtract empty
export function footprintDistance(a: Footprint, b: Footprint): number;    // 0 if overlapping
export function pointToFootprint(p: Vec2, a: Footprint): number;          // 0 if inside
export function aabbOf(a: Footprint): AABB;                               // broad-phase box
export function bandsOverlap(a: ZBand, b: ZBand): boolean;

// editor/src/model/spatialModel.ts  (the index + query API)
export interface ModelNode {
  id: string; type: string; floor: number; layer?: string;
  footprint: Footprint; aabb: AABB; z: ZBand;
  raw: Record<string, unknown>;          // the resolved+expanded object
}
export interface SpatialModel {
  nodes: ModelNode[];
  byType(...t: string[]): ModelNode[];
  onFloor(n: number): ModelNode[];
  byLayer(id: string): ModelNode[];
  near(p: Vec2, radius: number, opts?: { types?: string[]; floor?: number }): ModelNode[];
  overlaps(a: ModelNode, b: ModelNode): boolean;                 // plan AND z overlap
  overlapping(a: ModelNode, opts?: { types?: string[] }): ModelNode[];
  intersection(a: ModelNode, b: ModelNode): Footprint | null;
  within(inner: ModelNode, outer: ModelNode): boolean;
  distance(a: ModelNode, b: ModelNode): number;
  onSegment(seg: [Vec2, Vec2], opts?): ModelNode[];             // openings on a wall line
  pairs(opts?: { types?: string[]; sameFloor?: boolean }): [ModelNode, ModelNode][];
}
export function buildSpatialModel(config: HouseConfig): SpatialModel;
```

Scale: a house is tens to low-hundreds of objects, so the broad phase is a cached AABB
per node (`pairs()` is naive O(n^2) with an AABB reject; `near`/region queries can use
`@flatten-js/core`'s own `PlanarSet` box index). No custom R-tree until profiling says
otherwise. The model is built once per lint/estimate run and handed to every constraint via
`ctx.model`.

### What the constraint vocabulary (b) becomes

With the query layer in place, (b) is mostly `report` plus query calls, and the current
inline geometry disappears into it. For example:

```ts
// C7 furniture overlap
for (const [a, b] of ctx.model.pairs({ types: ["item"], sameFloor: true }))
  if (ctx.model.overlaps(a, b)) report({ where: `${a.id} / ${b.id}`, message: "items overlap" });
```

C6 (openings on a shared wall) uses `onSegment` over the wall line; C2 keeps its
point-sampling but sources footprints from the model. The geom helpers replace the
one-off overlap/footprint math now living in `structural.ts` and `estimate/wallArea.ts`;
those modules adopt the shared layer opportunistically (constraints migrate onto it now;
the estimator can follow later without a big-bang rewrite), always keeping parity.

## The constraint module

New directory `editor/src/lint/constraints/`. One file per constraint, exporting a
`Constraint` that bundles the four things that are scattered today:

```ts
// editor/src/lint/constraints/types.ts
export interface CheckContext {
  raw: HouseConfig;       // as authored, formulas unresolved (for "field explicitly set" checks)
  resolved: HouseConfig;  // formulas applied (scopeForConfig / resolve)
  expanded: HouseConfig;  // + components/stairs/grid flattened per floor (expandRoomWalls)
  defaults: GlobalConfig; // merged global defaults
  model: SpatialModel;    // the query layer over `expanded` (see "Model query layer" below)
}

export interface ConstraintDoc { statement: string; rationale: string; fix: string; } // markdown

export interface ConstraintFixtures {
  pass: Array<{ name: string; config: PartialHouse }>;
  fail: Array<{ name: string; config: PartialHouse;
    expect?: { count?: number; level?: LintLevel; messageIncludes?: string } }>;
}

export interface Constraint {
  id: string;            // "C1"
  title: string;         // short one-liner (was ConventionMeta.title)
  level: LintLevel;      // default severity
  doc: ConstraintDoc;    // -> generated conventions.md section
  check(ctx: CheckContext): LintFinding[];
  fixtures: ConstraintFixtures;
}
```

`PartialHouse` is the loose fixture shape today's tests already use (the `house()`
helper in `structural.test.ts`). Fixtures are inline JSON objects colocated with the
rule, so the file reads as "here is the rule, here is exactly what trips it and what
does not". `CheckContext` carries both the authored config (C1 needs "height explicitly
set") and the resolved+expanded one (C2/C5 need geometry); `buildContext` resolves +
expands once per lint run, shared by every constraint (today several checks re-expand).

## Registry + thin linter (consumers unchanged)

```ts
// editor/src/lint/constraints/index.ts
export const CONSTRAINTS: Constraint[] = [C1, C2, C3, C4, C5, C6, C7];
```

```ts
// editor/src/lint/structural.ts  (still the public entrypoint)
export function lintStructure(config: HouseConfig): LintFinding[] {
  const ctx = buildContext(config);
  return allConstraints().flatMap((c) => c.check(ctx));   // allConstraints() = CONSTRAINTS today
}
export const CONVENTIONS: ConventionMeta[] =
  allConstraints().map(({ id, title, level }) => ({ id, title, level }));
// LintFinding, LintLevel, partitionFindings, formatFinding: unchanged re-exports.
```

The three consumers keep calling `lintStructure` / `partitionFindings` / reading
`CONVENTIONS` with no change: `check.sh` + `validate.mjs`, the DSL editor pill
(`lintCurrent` in `wadi-dsl/playground/main.ts`), and `wadi-mcp/src/pipeline.ts`
(`wadi_check`). `allConstraints()` is an indirection seam (returns `CONSTRAINTS` now)
so the per-primitive source can be merged in later without touching this function's
callers.

## Generic test driver (the "mechanism to add tests")

```ts
// editor/src/lint/constraints/constraints.test.ts
function runOne(c: Constraint, cfg: PartialHouse) {
  return c.check(buildContext(cfg as HouseConfig)).filter((f) => f.rule === c.id);
}
for (const c of allConstraints()) describe(`${c.id} ${c.title}`, () => {
  for (const f of c.fixtures.pass)
    it(`passes: ${f.name}`, () => expect(runOne(c, f.config)).toHaveLength(0));
  for (const f of c.fixtures.fail)
    it(`flags: ${f.name}`, () => {
      const found = runOne(c, f.config);
      expect(found.length).toBeGreaterThanOrEqual(f.expect?.count ?? 1);
      if (f.expect?.level) expect(found[0].level).toBe(f.expect.level);
      if (f.expect?.messageIncludes)
        expect(found.some((x) => x.message.includes(f.expect.messageIncludes))).toBe(true);
    });
  it("stays silent on every known-good house", () =>
    KNOWN_GOOD.forEach((h) => expect(runOne(c, h)).toHaveLength(0)));
});
```

Three guarantees per constraint, for free:
- **Sensitivity** - fires on each `fail` fixture, at the expected level/message.
- **Specificity** - stays silent on each `pass` fixture.
- **No-regression corpus** - raises no ERROR on the real shipped houses
  (`KNOWN_GOOD` = the 6 parity configs). Shipped houses are structurally sound (errors
  fail check.sh), so a new constraint erroring on one is caught. Advisory WARNINGS
  legitimately occur on them — an intentional verandah (C2) or a deliberate floor-height
  gap (C4) — so the corpus guard is scoped to error-level findings; a rule's warning
  specificity is covered by its own `pass` fixtures.

Adding a rule's tests is now just filling `fixtures.pass` / `fixtures.fail`. No new
`describe` blocks, no bespoke assertions.

## Generated documentation (anti-drift)

`editor/scripts/gen-conventions-doc.mjs` reads `allConstraints()` and emits
`conventions.md`: a hand-authored `conventions.preamble.md` (the "vertical model"
narrative + "Running the checks" footer stay hand-written) plus one generated `## Cn`
section per constraint, built from `doc.statement/rationale/fix` and `level`. A test
(`conventions-doc.test.ts`, mirroring `schema/generated/generated.test.ts`) asserts the
committed doc equals the generated output, so any code/doc drift fails CI. `gen-assets`
keeps bundling the resulting file into the MCP. This is the same anti-drift pattern
already used for `reference/data-model.md` (generated from the Zod schema).

## File layout

```
editor/src/model/               # the query layer (headless-pure, render-free)
  geom.ts                       # thin adapter over @flatten-js/core + z-band helpers
  geom.test.ts
  spatialModel.ts               # buildSpatialModel + ModelNode + SpatialModel queries
  spatialModel.test.ts
editor/src/lint/
  structural.ts                 # public entrypoint: buildContext + thin lintStructure + re-exports
  constraints/
    types.ts                    # Constraint, CheckContext, fixtures types
    context.ts                  # buildContext(config) -> { raw, resolved, expanded, defaults, model }
    vocab.ts                    # (b) helpers: report + traversal over ctx.model, GROWN as rules migrate
    index.ts                    # CONSTRAINTS registry + allConstraints()
    corpus.ts                   # KNOWN_GOOD: the 6 examples + shipped templates
    c1_plinth_height.ts ... c7_furniture_overlap.ts   # one file per constraint
    constraints.test.ts         # generic driver (sensitivity/specificity/corpus)
    conventions-doc.test.ts     # generated-doc lockstep guard
editor/scripts/gen-conventions-doc.mjs
wadi-skill/architect/reference/
  conventions.preamble.md       # hand-authored intro + footer
  conventions.md                # generated (preamble + per-constraint sections)
```

## Migration of C1-C7 (behaviour-preserving)

1. Land `types.ts`, `context.ts`, empty `vocab.ts`, `index.ts`, `corpus.ts`, and the
   generic driver; `lintStructure` delegates to `allConstraints().flatMap`. Migrate C1
   as the reference constraint (adds the first `report` helper + its traversal to
   `vocab.ts`).
2. Move each C2..C7 check body into its own file's `check(ctx)` (swapping local
   re-expansion for `ctx.expanded`), extracting a `vocab.ts` helper only when a second
   rule wants the same traversal. Lift each rule's `conventions.md` prose into `doc`,
   and convert its existing tests into `fixtures.pass/fail`.
3. Delete each old block + `CONVENTIONS` entry + doc section + old test as it migrates.
   When the last lands, `structural.test.ts` is gone (replaced by the driver) and
   `conventions.md` is generated.

Acceptance: `lintStructure` output identical before/after on the corpus (snapshot
findings on all known-good + a few curated bad houses), and
`npm --prefix editor run parity-render` stays 6/6 (no geometry touched, so it must).

## Generalization path: per-primitive constraints (the custom-primitive gap)

This is the known limitation and the reason the design is shaped the way it is. A
custom primitive registered through `editor/src/registry` (for example the
`spiral_staircase` proof) already owns its whole surface from one file - schema,
fields, form, 3D/2D render, expand - via `NodeDefinition`
(`editor/src/registry/types.ts`). But it gets **no structural coverage**: nothing
checks that a spiral stair lands on a floor, fits its shaft, and so on. The house-level
C-rules still apply where they can (overlaps, floating floors), but anything specific to
the new primitive is unchecked until we generalize.

The generalization, deferred but designed-for now:

- Add one optional hook to `NodeDefinition`: `constraints?: Constraint[]`, alongside the
  existing optional hooks (`expand`, `render3D`, `schema`, `fields`). A primitive ships
  its own rules in the same `Constraint` shape, its `check` scoped to instances of its
  own `type`.
- `allConstraints()` becomes `CONSTRAINTS.concat(registeredPrimitiveConstraints())` -
  the two sources merge into one finding stream. Because `lintStructure`, the generic
  driver, and the doc generator all iterate `allConstraints()`, they light up for
  primitive constraints with zero further change. A primitive's constraints get their
  own generated doc section and their own `fixtures`-driven tests automatically.

Why this stays a pure addition, not a rewrite: `Constraint` is already self-contained,
the registry is already the single extension point for a primitive, and every consumer
already iterates a list. Adding a second source of that list is a merge. We do not build
the hook in this pass; we ship the house-level mechanism first, watch the vocabulary
settle on real rules, then expose `constraints?` on `NodeDefinition` and let custom
primitives adopt it. Until then, the limitation is explicit: **new custom primitives are
structurally unchecked beyond the generic house-level rules.**

## New constraints this unlocks (backlog, now cheap)

Each is one file with fixtures. From the doc's "Planned conventions" list:
- **C8 Interior partition gap** - two rooms share a centreline and neither declares that
  wall, so there is no partition between them.
- **C9 Slab thickness matches slab object** - when a floor carries a `floor_slab`, its
  `slab_thickness` should equal the slab's own thickness.
- **C10 Roof footprint coverage** - roof segments should span the top occupied floor's
  footprint (uses `ctx.expanded` + the roof-v2 derivation).

Illustrative; ship the mechanism + C1-C7 migration first, then add these as small PRs.

## Verification

- `model/geom.test.ts` + `model/spatialModel.test.ts` green: overlap/intersection/union/
  containment/distance on rotated boxes AND non-box polygons (a trapezoid roof segment, a
  U-stair, an L/ring polygon with a hole), z-band overlap, facet-sourced footprints
  (including a custom-primitive polygon facet), and a few known queries on a fixture house.
- `npx tsc -b` clean; `npm --prefix editor run test -- run` green (the driver replaces
  the hand-written rule tests).
- Findings-parity: snapshot `lintStructure` on the known-good corpus + curated bad
  houses, assert identical before/after migration.
- `npm --prefix editor run parity-render` stays 6/6 (no geometry touched).
- `conventions-doc.test.ts` passes (committed doc == generated);
  `npm --prefix wadi-mcp run gen-assets` re-bundles the generated `conventions.md`.
- MCP smoke: `wadi_check` on a known-bad house still returns the same C-ids.

## Rollout

- **P0** Model query layer: add the `@flatten-js/core` dependency; `model/geom.ts` (the
  adapter: overlap/intersection/union/containment/distance over flatten polygons + z-band)
  + `model/spatialModel.ts` (`buildSpatialModel` reading footprints from registry facets),
  both unit-tested. No consumer yet; stands alone. This is the foundation the rest builds
  on and is the first thing to land.
- **P1** Constraint scaffolding: `types.ts` / `context.ts` (builds `ctx.model` via
  `buildSpatialModel`) / `vocab.ts` / `index.ts` / `corpus.ts` / generic driver;
  `lintStructure` delegates via `allConstraints()`. Migrate C1 as the reference
  constraint.
- **P2** Migrate C2-C7; grow `vocab.ts` from real use; delete old blocks/tests;
  findings-parity snapshot green.
- **P3** Generated doc: `gen-conventions-doc.mjs` + `conventions.preamble.md` + lockstep
  test; re-bundle into the MCP.
- **P4** (separate PRs) Backlog constraints C8-C10, one file each, to exercise the
  mechanism.
- **P5** (later, separate) Per-primitive `NodeDefinition.constraints?` hook + merge into
  `allConstraints()`; adopt it on the custom primitives.

## Dependencies

- **`@flatten-js/core`** is the geometry engine for the query layer: general-polygon
  boolean (unify / intersect / subtract), point-in-polygon, distance, and a `PlanarSet`
  spatial index. Pure JS, so it bundles cleanly in all three surfaces (Node tests, the
  esbuild MCP bundle, the Vite editor). Chosen over the leaner `rbush + polygon-clipping`
  combo and the heavier `JSTS`; those stay open as alternatives if flatten's robustness or
  bundle size disappoints later.
- It is used **only** inside `editor/src/model/geom.ts`. Every other module (spatialModel,
  constraints, estimator) goes through the `SpatialModel` / `geom.ts` facade, so the
  engine is swappable behind one seam. Pin the exact version + confirm bundle cost when the
  dep is added in P0.

## Out of scope

- No parsed constraint grammar (decided above); the declarative `relation(...)` sugar is
  deferred until patterns are visible.
- The parity/geometry golden harness stays as-is (render regression, a different
  concern).
- No change to the linter's three consumers or their output format.
- No formula-engine, schema, or renderer changes - constraints are pure predicates over
  an already-resolved/expanded `HouseConfig`.
