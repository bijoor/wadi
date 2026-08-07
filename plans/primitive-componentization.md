# Primitive Componentization — toward a generic DSL-software framework

**Status:** design, approved direction (Approach A: framework-first). Not yet built.
**Author intent:** Wadi is the *reference instance* of a general method for building
**DSL-based software**. The immediate abstraction step is to turn Wadi's hardcoded
object types into self-contained **primitive components**, so the domain-neutral
**kernel** can be lifted out and Wadi becomes "one app built on the kernel."

Related: [[project_object_registry]] (the partial registry we complete here),
[[project_modularization_linking]] (Langium-native linking, same substrate),
`plans/modularization-and-linking.md`, `plans/grid-convention.md`.

---

## 1. Why now / the thesis

Everything in the pipeline is stitched by ONE key — the object `type` string — but
each primitive must satisfy ~10 *surfaces*, and today those surfaces are hardcoded
central switches. Two tiers exist:

- **Render side:** a real but *half-finished* registry (`editor/src/registry/`).
  `item` is defined in **one file** (`registry/nodes/item.tsx`); dispatchers
  consult it first. But there is **no registry hook** for config-expansion
  (`svg2d/expand.ts`), 2D elevation (`svg2d/elevationView.ts`), or rich 2D plan
  draw (`svg2d/floorPlan.ts` offers only a footprint box), and the **Zod schema**
  is a central `discriminatedUnion` with no per-primitive hook.
- **DSL side:** **no registry at all.** A new type is hand-edited into the grammar
  (`wadi.langium` + the `FloorObject` union), `langium generate`, a per-type fn +
  `switch` case in the compiler (`toHouseConfig.ts`) and decompiler
  (`fromHouseConfig.ts`), a reference-doc entry (test-enforced), and the docs.

Concretely, adding a `spiral_staircase` today = **~15 render files + ~7 DSL files**.
That is core-team surgery, not extensibility — and it's the exact opposite of what a
"framework for DSL software" should require. The framework's whole value proposition
is: **a new domain primitive is a data-declaration + a few behavior functions in one
place, and every surface derives from it.**

The generalizable insight: a document is a tree of typed **nodes**; a **primitive**
defines a node type by declaring (a) its **fields** and (b) its **capabilities**.
*Fields* are pure data that PROJECT mechanically onto schema, DSL syntax, editor
form, and docs. *Capabilities* are the domain's pluggable outputs (Wadi: 3D mesh,
plan SVG, elevation SVG) consumed by registered **views**. The kernel knows about
fields, capabilities, and views generically; it knows nothing about "houses" or
"three.js."

---

## 2. Target architecture

### 2.1 Layering (the extraction boundary)

```
@dslkit/kernel        (domain-neutral — the framework)
  • registry: type → PrimitiveDefinition
  • field-schema: composable FieldKind[] → projections {zod, form, dsl, docs}
  • generic parse/emit (text ↔ node) driven by field-schema
  • parametric engine (formulas/variables/points) + resolve/expand driver
  • capability + view registry (generic dispatch; no central switch)
  • LSP glue (completion/hover/def/refs/rename from field-schema + registry)
  • editor shell hooks (property panel, add-menu, tree — data-driven)

@wadi/primitives      (Wadi domain — one folder per primitive)
  room/ wall/ roof/ pillar/ staircase/ spiral-staircase/ item/ …

@wadi/views           (Wadi output targets — each consumes capabilities)
  three-3d/  svg-plan/  svg-elevation/

wadi-app / wadi-dsl    (wiring: register primitives + views; units; conventions)
```

The kernel is what we publish/reuse for a *different* DSL-based product later; the
other three layers are Wadi. "Slowly abstracting Wadi's specifics out" = migrating
code left across these boundaries, primitive by primitive, until the kernel has no
`import ... from "../house..."`.

### 2.2 The `PrimitiveDefinition` (supersedes `NodeDefinition`)

```ts
interface PrimitiveDefinition {
  type: string;                    // discriminant (the single stitching key)
  title: string;
  fields: FieldSpec[];             // ← the ONE source (see 2.3)
  // --- kernel-driven, all optional ---
  expand?(node, ctx): Node[];      // decomposition (spiral → treads/landings)
  layerHint?: string | ((node, parentIdx) => string);
  addable?: boolean;
  makeDefault?(ctx): Node;         // or auto-derived from field defaults
  // --- capabilities: the open, domain-defined output/behavior set ---
  capabilities: Record<string, CapabilityHandler>;
  //   Wadi registers the *vocabulary*: "render3D" | "drawPlan" | "drawElevation".
  //   The kernel treats these as opaque names → handlers; VIEWS consume them.
}
```

`makeDefault`, the add-menu, the tree order, and the layer role all derive from
`fields`/`layerHint` — retiring the hardcoded `ADDABLE_TYPES` / `TYPE_ORDER` /
`BUILTIN_ROLE` central lists.

### 2.3 Field-schema — composable `FieldKind`s (the heart of componentization)

A primitive's `fields` is a list of typed slots. Each `FieldKind` is a reusable
component that knows how to project itself onto every surface:

```ts
interface FieldKind<T> {
  zod(): ZodType;                          // → schema
  formControl(): FormControlSpec;          // → property-panel field
  dslTokens(): DslFieldGrammar;            // → parse + pretty-print + LSP
  docRow(field): DocRow;                   // → data-model + dsl docs
  isFormulaField: boolean;                 // → routes through the `formulas` map
}
```

Built-in kinds (cover ~all current Wadi fields):
`measure` (formula-able number; the `Expr`/`put()` path), `int`, `enum(values)`,
`text`, `bool`, `point{x,y}`, `list<kind>`, `nested<fields>` (walls, segments),
`ref<type>` (Langium cross-ref — reuses Path B scoping for `use`/`item`).

**Payoff:** the Zod schema, the editor form, the DSL syntax, the LSP completion, and
the docs for a primitive are all *generated from `fields`* — not hand-written four
times and kept in sync by discipline. (Precedent: `data-model.md` is already
generated from the Zod schema via `gen-schema-doc.mjs`; we invert the source to
`fields` and fan out.)

### 2.4 Capability + View registry (generic dispatch, no switches)

A **view** is an output surface that declares which capability it consumes:

```ts
registerView({ id: "three-3d",       consumes: "render3D"     });
registerView({ id: "svg-plan",       consumes: "drawPlan"     });
registerView({ id: "svg-elevation",  consumes: "drawElevation"});
```

The generic driver walks the resolved+expanded document and, per node, looks up
`getPrimitive(node.type).capabilities[view.consumes]`. This single loop replaces the
per-type `switch` in `House3D.tsx`, `floorPlan.ts`, and `elevationView.ts`. A node
with no handler for a view is skipped (with an optional "unrenderable in <view>"
warning — reuses the banner channel from `three/geometryWarnings.ts`).

Because views are data, a *different* DSL product plugs in its own views
(`render-schematic`, `render-waveform`, …) without touching the kernel.

### 2.5 Parametric resolve/expand as a kernel service

`resolveParametric` + `expand` are already close to generic (variables/points/
per-object `formulas`, immutable, fast-path). Kernel-ize them: the engine is
domain-neutral; a primitive contributes only (a) which `fields` are formula-able
(from the `measure` kind) and (b) an optional `expand(node)`. The current hardcoded
`if (obj.type==="staircase")` / `"item"` branches in `expand.ts` become
`getPrimitive(node.type).expand?.(node, ctx)`.

### 2.5b The compositor boundary — per-object views vs pipeline views (FINDING, P1b–d)

Wiring the dispatchers surfaced a real structural split that the capability model
must respect:

- **Per-object views** — the **3D** view and **expand** are clean per-object loops:
  each node renders/decomposes independently. `render3D` and `expand` are true
  per-primitive capabilities (this is why `item` "just works" in 3D). ✅ routed
  through the registry.
- **Pipeline views** — the **2D plan** and **elevation** renderers are NOT
  per-object. They run **type-major passes** with **cross-object concerns**:
  perimeter dimensioning, edge classification, **wall-trim where walls butt into
  pillars** (`pillarRects`/`wallTrim`), and depth-sorted elevation projection with
  height bands. Pillars aren't even independently drawn — they're *collected* and
  the walls trim against them.

Consequence: a per-primitive `drawPlan`/`drawElevation` capability fits only the
**independent** objects (furniture footprints, and new self-contained primitives
like `spiral_staircase`). The **engine-coupled** types (wall, room, pillar) are NOT
per-primitive — their 2D output is a property of the **floor-plan/elevation
COMPOSITOR**, a domain service that owns dimensioning + trim + projection. So the
kernel boundary is: *primitives own their per-object capabilities (3D, expand,
independent 2D fragments); the domain owns the 2D compositor.* We do **not** try to
shred the compositor into per-primitive `drawPlan` calls — that would fight the
cross-object topology and break byte-parity for no gain.

Practical upshot for P1: `drawPlan` has a generic seam (no-op until an independent
primitive uses it); `drawElevation`'s ctx is **deferred to its first real consumer**
(the `spiral_staircase` elevation) rather than guessed; and **pillar is dropped as a
migration target** — it belongs to the compositor. The framework proof becomes
"**add an INDEPENDENT primitive with zero central edits**" (P5), not "migrate a
compositor-coupled legacy type."

### 2.6 The DSL grammar decision (the one genuinely hard part)

Langium generates a *static* parser, so we cannot register a bespoke grammar rule
per contributed primitive at runtime. Resolution — **two-track**, and this is the
domain-neutral answer:

1. **Generic core rule (kernel):** one grammar production parses ANY primitive:
   ```
   ObjectDecl: type=ID name=NameRef? ('(' args+=Expr (',' args+=Expr)* ')')?
               ('{' (fields+=FieldAssign | children+=ObjectDecl)* '}')?  Common;
   ```
   Semantics come from the descriptor's `fields`: positional `args` map to the
   first N fields, `key value` assignments to named fields, nesting to `nested`/
   `list` fields. Compile/emit/validate/LSP are all descriptor-driven. **This is
   the framework's real grammar** — fixed, domain-neutral; the vocabulary is data.
   A contributed `spiral_staircase` needs *zero* grammar edits and no `langium
   generate`.

2. **Optional bespoke sugar (per-domain, opt-in codegen):** a primitive may supply
   a `syntax` spec; a build step emits a dedicated `.langium` rule for prettier
   surface syntax (`wall north { window … }`). Wadi's existing hand-authored rules
   become this track — they keep their nice syntax, but as *generated sugar over
   the generic core*, not as the only way in.

Net: the generic path is the framework; sugar is a Wadi convenience. New/contributed
primitives ride the generic path; core Wadi types keep sugar via codegen.

**Promotion path (decided):** a contributed primitive starts on the generic
`ObjectDecl` syntax. When it is "promoted" (graduated to a first-class type), a
mechanism generates bespoke sugar for it from its descriptor — i.e. generic →
sugar is an *upgrade*, not a rewrite. The promoter itself is expected to be
**domain-specific** (Wadi decides what nice syntax a promoted house-primitive
gets), so the kernel defines only the hook/seam ("a primitive MAY carry a
`syntax` spec that a domain-supplied codegen consumes"); we deliberately do NOT
try to generalize the promotion codegen yet — too little signal. Both syntaxes
remain valid for a promoted type (generic stays a permanent fallback), so
existing `.wdl` never breaks on promotion.

---

## 3. What is kernel vs Wadi-specific (the boundary to enforce)

| Kernel (domain-neutral) | Wadi-specific |
|---|---|
| registry, `PrimitiveDefinition`, `FieldKind` machinery | the primitive folders (room/wall/roof/…) |
| field→{zod,form,dsl,docs} projections | the capability *vocabulary* (`render3D`/`drawPlan`/`drawElevation`) |
| generic parse/emit; generic core grammar rule | the *views* (three-3d, svg-plan, svg-elevation) |
| parametric engine + resolve/expand driver | units (`per_unit`, feet/inches), coordinate convention (Inkscape Y-down, center) |
| capability + view registry + generic dispatch | grid/convention conventions, layer taxonomy |
| LSP glue; editor-shell data-driven hooks | the `.wadi`/`.wdl` file identity, MCP server, personas |

Guardrail: a **lint/CI check** that the kernel package has no import that reaches
Wadi domain code (dependency-direction test), so the boundary can't silently rot.

---

## 4. Migration plan (parity-gated, primitive by primitive)

**P0 — this doc.** Fix the boundary + descriptor/capability shapes.

**P1 — Generalize the render registry (no kernel extraction yet, in-place).**
- Extend `NodeDefinition` → `PrimitiveDefinition`: add `fields`, `expand`,
  `capabilities` (fold today's `render3D`/`planFootprint` into it), `schema`.
- Stand up the **capability + view registry**; convert the 3 central switches
  (`House3D`, `floorPlan`, `elevationView`) + `expand.ts` to generic dispatch,
  **legacy-fallback-first** (exactly the pattern already used for `item`) so nothing
  breaks mid-migration.
- Derive the Zod union, layer roles, add-menu/order from the registry.
- **Parity gate:** byte-identical 2D SVGs + unchanged 3D for every repo config +
  all templates before/after (the existing dump-svgs / snapshot harness).

**P2 — Field-schema projections.** Build `fields → {zod, form, docs}` generators;
migrate `item` + one simple legacy type (`pillar`) to fully declarative `fields`.
Delete their bespoke schema/form once generated versions are byte-identical.

**P3 — Generic DSL core.** Generic `ObjectDecl` rule + descriptor-driven
compile/decompile + LSP completion from `fields`. Keep bespoke rules as generated
sugar. Round-trip + geometry parity gates (reuse `roundtrip.test.ts`).

**P4 — Extract `@dslkit/kernel`.** Move domain-neutral code into the package;
Wadi imports it. Dependency-direction CI check goes green. This is the actual
"abstract Wadi's specifics out" milestone.

**P5 — Acceptance: `spiral_staircase` authored purely through the framework** — one
folder: `fields` (center, radius, total_rise, tread_count, direction, …), `expand`
(helical tread/landing nodes), `capabilities.render3D` (helical mesh),
`capabilities.drawPlan` (circle + tread lines + up-arrow),
`capabilities.drawElevation`. **Zero central-file edits, zero grammar edits.** If
that holds, the framework is real.

---

## 5. Risks & tensions

- **Bespoke syntax vs generic grammar.** Mitigated by the two-track grammar; core
  types keep sugar. Watch: LSP quality on the generic path must match.
- **Byte-parity during migration.** Every phase is parity-gated; generic output must
  match hand-written output before the hand-written version is deleted.
- **Headless purity.** Kernel + `fields` + `svg-plan`/`svg-elevation` views must stay
  three.js-free (the `svg2d` engine imports primitives). The `item` lazy-import
  pattern (`lazy(() => import("three..."))`) is the rule; enforce via CI import lint.
- **Perf.** Generic dispatch adds a registry lookup per node; negligible vs CSG/derive
  cost, but keep the fast-path (`resolveParametric` no-op for non-parametric).
- **Scope.** P1 alone is large. Land it behind parity gates and ship incrementally;
  do NOT big-bang all primitives at once.

---

## 6. Open questions

- Do we version the descriptor contract (so third-party primitive packages can target
  a kernel version)? Likely yes at P4 — mirrors the schema-versioning strategy.
- Capability granularity: is `drawPlan` one hook, or split (footprint vs. detail vs.
  dimensions)? Decide when converting `floorPlan.ts`.
- Should `expand` be a capability too (so alternate expanders per view)? Default no —
  expansion is pre-view and shared; keep it a single kernel service.
