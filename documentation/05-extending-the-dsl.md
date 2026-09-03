# Wadi as a DSL-software framework

### How one declaration per concept is projected onto every surface, and how the domain-neutral parts were extracted into a reusable kernel.

> Part of the [Wadi documentation](README.md), the advanced tier, for developers
> extending the language itself. If you only want to design houses, the
> [authoring guide](03-authoring.md) is all you need.
>
> Companion to [the parametric method](06-the-method.md). That document explains the
> parametric layers (variables, formulas, the resolver, the configurator). This
> document explains the componentization framework: how a new concept (a "primitive")
> is defined once and shows up in the schema, the forms, the docs, and the DSL, and
> how the domain-neutral parts were extracted into a reusable kernel. Read this for
> the approach; read that for the parametric machinery underneath.

---

## 0. The one-paragraph version

Wadi lets you design a house from a single declarative file and get a live 3D
model, dimensioned 2D plans, elevations, roof drawings, and a typed text DSL, all
from the same source of truth. The mechanism behind this
is that all of those surfaces are generated from one declaration per concept. A
concept (a wall, a beam, a spiral staircase) declares its fields once (as data) and
its capabilities once (as code), and the framework projects those onto every
surface. Adding a new object type is about 2 files, with no edits scattered across
renderers. The domain-neutral half of this machinery is extracted into a kernel
that a different domain (a PCB tool, a solar-farm planner) can reuse verbatim. Wadi
is the reference instance of that framework.

---

## 1. DSL-based software

Most low-code and model-driven tools hard-wire a fixed set of concepts into a
monolith: the schema knows about walls, the 3D renderer knows about walls, the
forms know about walls, and the file format knows about walls. Adding a `pillar`
means touching all four in lockstep, by hand. The coupling sets the product's
ceiling.

The alternative Wadi pursues:

> A concept is a single declaration. Every surface is a projection of it.

If that holds, then:

- Adding a concept is additive and local. You write the declaration and its
  capabilities in one place; the schema, form, docs, and DSL fall out.
- The surfaces cannot drift. They are generated from the same source, and a
  parity harness proves it byte-for-byte on every change.
- The engine is separable from the domain. The projection machinery mentions
  no house, so it can be lifted out and pointed at another domain.

This is what "DSL-based software" means here: a framework for building
domain-specific-language software, where the domain is data and the engine is
reusable.

---

## 2. The central mechanism: one declaration → many projections

A primitive is defined by two things:

1. `fields` (data). The list of properties the concept has, each with a
   kind (`coord`, `extent`, `nonneg`, `int`, `text`, `flag`, `enum`), plus a doc
   string and unit. This is the whole shape of the concept.
2. capabilities (code). How the concept turns into pixels: a 3D renderer, a
   2D footprint, an optional decomposition (`expand`), a layer, an add-menu default.

From the one `fields` declaration, four surfaces are generated:

```
                    ┌───────────────────────────────────────┐
                    │      fields  (one declaration)         │
                    │  [{name:"radius", kind:"extent", …}]   │
                    └───────────────────────────────────────┘
                        │        │          │           │
        fieldsToZodSource   fieldToFormControl  fieldsToDocRows   descriptor
                        │        │          │           │
                        ▼        ▼          ▼           ▼
                   ┌────────┐ ┌──────┐ ┌─────────┐ ┌───────────────┐
                   │ SCHEMA │ │ FORM │ │  DOCS   │ │ DSL  (grammar │
                   │ (typed │ │(Auto-│ │ (data-  │ │ +positional   │
                   │  Zod,  │ │ Form)│ │ model)  │ │ +validation   │
                   │ in the │ │      │ │         │ │ +completion)  │
                   │ union) │ │      │ │         │ │               │
                   └────────┘ └──────┘ └─────────┘ └───────────────┘
```

- Schema. A codegen step (`gen-primitives`) reads every primitive's `fields`
  and emits typed Zod source into a generated file, which the config union
  imports. So `z.infer` gives precise types, with no dynamic/`any` schema. (The runtime
  builder is kept only for a parity test.)
- Form. `fieldToFormControl` maps each field's kind to a widget
  (`measure`/`text`/`select`/`flag`) with defaults (min bound from the
  constraint, label from the humanized name, optionality from `required`). A
  primitive gets a generated form spec from `fields` alone (used internally, not
  exposed as a user editing surface).
- Docs. `fieldsToDocRows` (and the doc comments the schema codegen emits) feed
  the human-readable data-model reference, so the docs an authoring agent reads
  cannot drift from the schema.
- DSL. The `fields` become a descriptor the text DSL consumes: positional
  arguments map to the field order, and unknown-field and arg-count validation
  and editor completion are derived from it.

The capabilities are consulted by a registry: the 3D scene, the
2D plan, the add-menu, and the layer system each ask the
registry "who handles this type?" first, and fall back to the legacy per-type
switch for not-yet-migrated types. A new type is one registry entry, nothing
scattered.

The structural-conventions linter is another such surface. It is now a declarative
per-constraint registry (`editor/src/lint/constraints/`, currently C1 through C25 plus the
spiral's SP1), each rule a self-contained module (check + doc + fixtures) built on a
spatial query layer (`editor/src/model/`, a `@flatten-js/core` adapter). `structural.ts`
is a thin loop over `allConstraints()`, and `conventions.md` is generated from those
modules, so the linter, its docs, and per-primitive rules (`NodeDefinition.constraints`)
all fall out of one declaration each, the same as the four surfaces above.

The two-tier structure that keeps this open: field kinds are presets (Tier 2)
composed from a small closed set of atoms plus constraints (Tier 1). Adding a kind is
data, not an engine release, the same way Zod, JSON-Schema, and protobuf treat
their type vocabularies.

---

## 3. The architecture

```
        ┌──────────────────────────────────────────────────────────────┐
        │                    @dslkit/kernel  (domain-NEUTRAL)           │
        │  fieldSchema  : fields → {schema-source, docs, form-control}  │
        │  stageRunner  : pure toposort-fold over a stage DAG           │
        │  (mentions no house / three / react / langium / zod)          │
        └──────────────────────────────────────────────────────────────┘
                              ▲ consumed via thin re-export shims
        ┌─────────────────────┴────────────────────────────────────────┐
        │                     WADI  (the domain)                        │
        │                                                               │
        │  schema/fields/*   ─ the primitive declarations (data)        │
        │  registry/nodes/*  ─ the primitive capabilities (code)        │
        │  registry          ─ type → {schema, fields, render3D,        │
        │                       planFootprint, expand, layer, default}  │
        │  pipeline/compose  ─ the compositor as a Stage DAG            │
        │  wadi-dsl/         ─ the text DSL: grammar + compile + emit + │
        │                       validate + complete (fed by descriptors)│
        └───────────────────────────────────────────────────────────────┘
```

### 3.1 Kernel vs domain (and the guardrail)

The kernel (`kernel/`) is the domain-neutral engine: the field-projection
machinery and the stage runner. It imports nothing outside itself and node
builtins, not even zod. The Wadi domain consumes it through thin `export *` shims
(`editor/src/registry/fieldSchema.ts`, `editor/src/pipeline/stageRunner.ts`), so no
consumer changed when the code moved out. A dependency-direction guardrail test
(`kernelBoundary.test.ts`) fails CI if any kernel file ever imports domain code,
so the boundary cannot silently rot. This makes "the engine is separable"
a checked claim rather than an aspiration.

(The one runtime zod builder stays on the Wadi side, so the kernel needs no zod
dependency and the app keeps a single zod instance in its schema union.)

### 3.2 Two registries

- Primitive registry: type → `NodeDefinition` (`fields`, `schema`, `render3D`,
  `planFootprint`, `expand`, `layerRole`, `makeDefault`, `constraints`). The socket a new object
  plugs into. Dispatchers consult-first, fall-back, so migration never breaks the
  app mid-flight.
- Stage registry: the compositor is a DAG of pure
  stages (resolve → expand → edges → perimeter → dimensions → wall-trim →
  roof-derive → draw). `orderStages` toposorts them; `runStages` folds them over a
  shared context. This is a build-not-adopt decision: it is one page of code, not
  Airflow. It is synchronous, pure, byte-parity-preserving dataflow that runs on every
  edit.

The finding that shaped this: 3D and expansion are clean per-object (registry-routable),
but 2D plan/elevation are pipeline/compositor-structured (type-major
passes plus cross-object dimensioning and wall-trim). So primitives own their
per-object capabilities and independent 2D fragments; the domain owns the 2D
compositor. The boundary follows the structure of the problem, not a tidy
diagram.

### 3.3 The two-track grammar

A parser generator produces a static grammar, so you cannot register a bespoke
rule per contributed primitive at runtime. The resolution is two tracks:

1. A generic core rule (`ObjectDecl`) parses any primitive by name:
   `type name? (positional, args) { key value … }`. Semantics come from the
   descriptor's `fields`. A contributed primitive needs zero grammar edits and
   no code-gen of the parser. This is the framework's real grammar.
2. Optional bespoke sugar: the hand-authored ergonomic rules (`wall north {
   window … }`) stay, as sugar over the generic core. A promotion path lets a
   contributed primitive graduate from generic syntax to bespoke sugar without ever
   breaking existing files (both syntaxes remain valid).

The layering is visible live: author a not-yet-registered type and the grammar
accepts it (zero parse errors) while the strict schema gates it. That is the
design: the front-end parses any name; the schema registers the real ones.

---

## 4. Adding a primitive in ~2 files: the `spiral_staircase` case

A helical staircase, `spiral_staircase`, is a new object type defined in about two
files.

File 1, the declaration (`editor/src/schema/fields/spiralStaircase.ts`):

```ts
export const spiralStaircaseFields: FieldSpec[] = [
  { name: "name", kind: "text", required: false, doc: "Label" },
  { name: "x", kind: "coord", doc: "Centre X", unit: "project units" },
  { name: "y", kind: "coord", doc: "Centre Y", unit: "project units" },
  { name: "radius", kind: "extent", doc: "Outer radius", unit: "project units" },
  { name: "total_height", kind: "extent", doc: "Total rise", unit: "project units" },
  { name: "turns", kind: "extent", required: false, doc: "Revolutions" },
  { name: "steps", kind: "int", required: false, doc: "Number of treads" },
  // …tread_thickness, pole_radius, z_offset
];
```

With the declaration registered in the manifest and the codegen run, the type is in
the typed schema union, has a generated form spec (internal), appears in the data-model
docs, and is a DSL citizen, with no other edits. It reads in two forms.

The generic form uses named parameters in a block:

```
spiral_staircase "Stair" { radius 45 total_height 110 turns 1.75 }
```

A primitive can also carry bespoke sugar (§3.3): a second file, a grammar rule plus a
compile/emit pair, that lets it read like the built-in primitives, with `at (x, y)`
placement and named clauses and no braces:

```
spiral_staircase "Stair" at (120, 120) radius 45 total_height 110 turns 1.75
```

Both forms compile to the same object, and the `fields` declaration drives the schema,
form, and docs either way; only the surface syntax differs. A bespoke rule claims the
type keyword, so for a type that has one the generic form yields to it. The clause
keywords (`radius`, `turns`, …) stay usable as bare field keys on any generic
primitive: a soft-keyword token builder (`wadi-token-builder.ts`) makes every
field-marker keyword also lex as an identifier. The soft set is derived from the
grammar (field markers minus a small, stable set of object and statement leaders), so
no grammar edit is needed per primitive, and a primitive is still about two files.

File 2, the capabilities (`editor/src/registry/nodes/spiralStaircase.tsx`):

```ts
export const spiralStaircaseNode: NodeDefinition = {
  type: "spiral_staircase",
  label: "Spiral staircase",
  addable: true,
  layerRole: "structure",
  fields: spiralStaircaseFields,          // → AutoForm, no bespoke form needed
  makeDefault: (cfg, existing) => ({ … }),// add-menu default
  render3D: (obj, ctx) => ({ … }),        // helix of treads + central pole (lazy)
  planFootprint: (obj) => ({ … }),        // 2D footprint
};
```

Register the node, and the 3D scene, 2D plan, add-menu, and layers all pick it up.

File 3 (optional), a per-primitive structural constraint. A primitive can also ship
its own rule by setting `NodeDefinition.constraints?: Constraint[]`, which the
structural-conventions linter merges into `allConstraints()`. The spiral staircase
does exactly this: `editor/src/registry/nodes/spiralStaircase.constraints.ts` supplies
`SP1`, so the primitive carries its own validation alongside the shared C1 through C25 rules.

In the WDL playground, `spiral_staircase "Stair" at (120, 120)
radius 45 total_height 110 turns 1.75` renders as wooden treads
winding a central pole inside a room, and the editor's completion widget lists
`radius / total_height / turns / steps / tread_thickness / pole_radius / z_offset`.
Two files, with every projection and capability derived from them.

### 4.1 The steps, end to end

The two files above are the fields declaration and the capabilities node. In practice
you also register each in a manifest and run the schema codegen. A new type today lives
in the repository, so adding one is a branch and a pull request. The full sequence:

1. **Declare the fields.** Create `editor/src/schema/fields/<type>.ts` exporting a
   `FieldSpec[]`, one entry per property (`name`, `kind`, `doc`, optional `unit`,
   `required`). This is the whole shape of the type.
2. **Add it to the fields manifest.** One line in `PRIMITIVE_FIELD_DECLS`, in
   `editor/src/schema/fields/index.ts`.
3. **Run the schema codegen.** `npm --prefix editor run gen-primitives`. It reads the
   manifest and rewrites `editor/src/schema/generated/objects.generated.ts` (a
   generated file, not hand-edited). `gen-primitives:check` fails CI if it is stale.
4. **Add the type to the schema union.** In `editor/src/schema/houseConfig.ts`, import
   the generated const and add it to the `z.discriminatedUnion("type", [ … ])`. This is
   the one hand-edit to a shared file.
5. **Write the capabilities node.** Create `editor/src/registry/nodes/<type>.tsx`
   exporting a `NodeDefinition`: `type`, `label`, `addable`, `layerRole`, `fields`
   (reuse the declaration from step 1, so the form spec is generated internally),
   `makeDefault` (the add-menu default), and the render capabilities the type needs
   (`render3D`, `planFootprint`, and optionally `expand`, `drawPlan`, `drawElevation`).
6. **Register the node.** Add `registerNode(<type>Node)` to the list in
   `editor/src/registry/registry.ts`.
7. **Add the 3D component, if any.** If `render3D` draws geometry, add the React-Three
   component it imports (for example `editor/src/three/<Type>.tsx`).
8. **The DSL needs nothing for the generic form.** `<type> "name" { field value … }`
   parses and compiles with no grammar change. Bespoke sugar (`<type> "name" at (x, y)
   …`) is optional; it needs a grammar rule plus a compile function in `wadi-dsl`,
   followed by `npm --prefix wadi-dsl run langium:generate`.

Verify with the parity gate and the tests: `npm --prefix editor run parity-render`
(must stay 6/6) and `npm --prefix editor test`.

So it is two files of real content (steps 1 and 5) plus three build-time registration
and codegen touches (steps 2, 3, 4, 6). All of it is base-code, edited and shipped in a
build. Removing that constraint, so a type can be added without touching the base code,
is the job of a plugin loader, which is not built yet.

---

## 5. Build discipline

Two disciplines keep the framework correct as it changes, and let a change stay
additive and reversible rather than a rewrite.

- A parity gate. A self-referential golden snapshot (expand plus combined plans plus
  elevations plus the merged roof spec, hashed per config over 6 real configs) must
  stay 6/6 byte-identical. `npm run parity-render` is the gate. A refactor that must
  not change output is checked mechanically rather than by eye.
- Consult-first, fall-back dispatch. Every dispatcher (3D, 2D, expand, add-menu,
  layers) asks the registry first and falls back to the legacy per-type switch, so a
  partially-migrated system is still a working system.

Together they mean a new primitive, a new stage, or a moved module is added without a
rewrite, and the gate confirms nothing else moved.

---

## 6. Retargeting to a new domain

Because the kernel mentions no house, a second domain reuses it verbatim and
rewrites only the domain layer. The mapping (worked out in full for a
parametric solar-PV farm in
[the parametric method, §13](06-the-method.md)):

| Keep verbatim (kernel + method) | Rewrite (domain) |
|---|---|
| field engine: `fields → {schema, docs, form}` | the primitive *catalogue* (panel, inverter, trench…) |
| stage-DAG runner | the compositor *stages* + the coordinate/units conventions |
| generic `ObjectDecl` grammar + descriptor-driven compile/validate/complete | the bespoke *sugar* rules (optional) |
| parametric engine + resolver (variables/points/grids/formulas) | the *views* (3D, plan, elevation, bill-of-materials) |
| capability + view registry + generic dispatch | the capability *vocabulary* + concrete renderers |

The procedure is: enumerate the domain's primitives and their `fields`; write their
capabilities against the registry; keep the parametric layer and the DSL front-end
as-is. The engine is the constant; the domain is the variable.

---

## 7. Capabilities and open directions

What the framework provides:

- One `fields` declaration projects to the schema, form, docs, and DSL, all four,
  non-drifting.
- A new primitive is about 2 files and renders live (`spiral_staircase`).
- A domain-neutral kernel with an enforced dependency-direction boundary.
- A two-track grammar where any primitive parses generically and the schema gates it.
- The compositor is a pure, ordered, byte-parity-preserving stage DAG.

Open, by choice:

- Promoting the kernel from a guarded boundary to a separately-published npm
  package (needs workspace hoisting to keep a single zod instance).
- Migrating the remaining compositor-coupled types (wall/room) fully to `fields`
  for their schema/form/docs while keeping their 2D render in the compositor.
- A domain-agnostic promotion codegen (generic syntax → bespoke sugar).

---

## 8. Map of the code

| Path | Role |
|---|---|
| `kernel/` | domain-neutral engine (field projections + stage runner) + boundary guardrail |
| `editor/src/schema/fields/*` | primitive **declarations** (`fields`) |
| `editor/src/registry/` | the primitive registry, node definitions, and the field-engine shim |
| `editor/src/pipeline/` | the compositor: stage runner shim + compose layer |
| `editor/scripts/gen-primitives.mjs` | `fields → generated typed schema` codegen |
| `editor/scripts/parity-render.mjs` | the 6/6 byte-parity gate |
| `wadi-dsl/` | the text DSL: grammar, compile, decompile, validate, complete |
| `wadi-dsl/src/generator/descriptors.ts` | the seam feeding `fields` to the DSL |
| [`06-the-method.md`](06-the-method.md) | the parametric-layer methodology (variables/formulas/resolver) |
| [`../plans/primitive-componentization.md`](../plans/primitive-componentization.md) | the working design doc for this framework |

---

## Summary

Wadi is a parametric house designer. Underneath it is a framework where a
concept is declared once and the schema, the forms, the docs, and the language
are projected from that declaration, on a domain-neutral kernel that can be pointed at
another domain. Adding a new kind of object is about two files, and it shows up
across all the surfaces from that one declaration.
