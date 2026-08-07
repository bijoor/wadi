# Wadi as a DSL-Software Framework

### How a house designer became a reusable engine for building *domain-specific-language software* — one declaration per concept, projected onto every surface.

> **Companion to [`PARAMETRIC-DSL-METHOD.md`](PARAMETRIC-DSL-METHOD.md).** That
> document explains the *parametric layers* (variables, formulas, the resolver,
> the configurator). **This** document explains the *componentization framework*:
> how a new concept (a "primitive") is defined once and automatically shows up in
> the schema, the forms, the docs, and the DSL — and how the domain-neutral parts
> were extracted into a reusable kernel. Read this to articulate the approach; read
> that for the parametric machinery underneath.

---

## 0. The one-paragraph version

Wadi lets you design a house from a single declarative file and get a live 3D
model, dimensioned 2D plans, elevations, roof drawings, a property-panel editor,
and a typed text DSL — all from the same source of truth. The deeper result is not
the house designer; it is the **discovery that all of those surfaces can be
*generated* from one declaration per concept.** A concept — a wall, a beam, a
spiral staircase — declares its **fields** once (as data) and its **capabilities**
once (as code), and the framework projects those onto every surface. Adding a
brand-new object type is **~2 files**, no edits scattered across renderers. The
domain-neutral half of this machinery has been extracted into a **kernel** that a
completely different domain (a PCB tool, a solar-farm planner) can reuse verbatim.
Wadi is the *reference instance* of that framework.

---

## 1. The thesis: DSL-based software

Most "low-code / model-driven" tools hard-wire a fixed set of concepts into a
monolith: the schema knows about walls, the 3D renderer knows about walls, the
forms know about walls, the file format knows about walls — and adding a `pillar`
means touching all four in lockstep, by hand, forever. The coupling *is* the
product's ceiling.

The alternative Wadi pursues:

> **A concept is a single declaration. Every surface is a projection of it.**

If that holds, then:

- **Adding a concept is additive and local** — you write the declaration and its
  capabilities in one place; the schema, form, docs, and DSL fall out.
- **The surfaces cannot drift** — they are generated from the same source, and a
  parity harness proves it byte-for-byte on every change.
- **The engine is separable from the domain** — the projection machinery mentions
  no house, so it can be lifted out and pointed at another domain.

This is what "DSL-based software" means here: not just *a* DSL, but a **framework
for building domain-specific-language software**, where the domain is data and the
engine is reusable.

---

## 2. The central mechanism: one declaration → many projections

A primitive is defined by two things:

1. **`fields`** — *data*. The list of properties the concept has, each with a
   *kind* (`coord`, `extent`, `nonneg`, `int`, `text`, `flag`, `enum`), plus a doc
   string and unit. This is the whole shape of the concept.
2. **capabilities** — *code*. How the concept turns into pixels: a 3D renderer, a
   2D footprint, an optional decomposition (`expand`), a layer, an add-menu default.

From the **one `fields` declaration**, four surfaces are *generated*:

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

- **Schema.** A codegen step (`gen-primitives`) reads every primitive's `fields`
  and emits *typed* Zod source into a generated file, which the config union
  imports. So `z.infer` gives precise types — no dynamic/`any` schema. (The runtime
  builder is kept only for a parity test.)
- **Form.** `fieldToFormControl` maps each field's *kind* to a widget
  (`measure`/`text`/`select`/`flag`) with sensible defaults (min bound from the
  constraint, label from the humanized name, optionality from `required`). A
  primitive gets a working property-panel form from `fields` alone.
- **Docs.** `fieldsToDocRows` (and the doc comments the schema codegen emits) feed
  the human-readable data-model reference — so the docs an authoring agent reads
  cannot drift from the schema.
- **DSL.** The `fields` become a **descriptor** the text DSL consumes: positional
  arguments map to the field order, and unknown-field / arg-count **validation**
  and editor **completion** are derived from it.

Meanwhile the **capabilities** are consulted by a **registry**: the 3D scene, the
2D plan, the property panel, the add-menu, and the layer system each ask the
registry "who handles this type?" first, and fall back to the legacy per-type
switch for not-yet-migrated types. A new type = one registry entry; nothing
scattered.

The two-tier trick that keeps this open: field *kinds* are **presets** (Tier 2)
composed from a small closed set of atoms + constraints (Tier 1). Adding a kind is
**data**, not an engine release — exactly how Zod / JSON-Schema / protobuf treat
their type vocabularies.

---

## 3. The architecture

```
        ┌──────────────────────────────────────────────────────────────┐
        │                    @dslkit/kernel  (domain-NEUTRAL)           │
        │  fieldSchema  — fields → {schema-source, docs, form-control}  │
        │  stageRunner  — pure toposort-fold over a stage DAG           │
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

The **kernel** (`kernel/`) is the pure, domain-neutral engine: the field-projection
machinery and the stage runner. It imports *nothing* outside itself and node
builtins — not even zod. The Wadi domain consumes it through thin `export *` shims
(`editor/src/registry/fieldSchema.ts`, `editor/src/pipeline/stageRunner.ts`), so no
consumer changed when the code moved out. A **dependency-direction guardrail test**
(`kernelBoundary.test.ts`) fails CI if any kernel file ever imports domain code —
so the boundary can't silently rot. This is what makes "the engine is separable"
a *checked* claim rather than an aspiration.

*(The one runtime zod builder stays on the Wadi side, so the kernel needs no zod
dependency and the app keeps a single zod instance in its schema union.)*

### 3.2 Two registries

- **Primitive registry** — type → `NodeDefinition` (`fields`, `schema`, `render3D`,
  `planFootprint`, `expand`, `layerRole`, `makeDefault`). The socket a new object
  plugs into. Dispatchers *consult-first, fall-back* so migration never breaks the
  app mid-flight.
- **Stage registry** — the compositor is not a monolith but a **DAG of pure
  stages** (resolve → expand → edges → perimeter → dimensions → wall-trim →
  roof-derive → draw). `orderStages` toposorts them; `runStages` folds them over a
  shared context. This is a *build-not-adopt* decision: it is one page of code, not
  Airflow — synchronous, pure, byte-parity-preserving dataflow that runs on every
  edit.

The finding that shaped this: **3D and expansion are clean per-object** (registry
-routable), but **2D plan/elevation are pipeline/compositor-structured** (type-major
passes plus cross-object dimensioning and wall-trim). So primitives own their
per-object capabilities and independent 2D *fragments*; the *domain* owns the 2D
compositor. The boundary follows the real structure of the problem, not a tidy
diagram.

### 3.3 The two-track grammar

A parser generator produces a *static* grammar, so you cannot register a bespoke
rule per contributed primitive at runtime. The resolution — **two tracks**:

1. **A generic core rule** (`ObjectDecl`) parses *any* primitive by name:
   `type name? (positional, args) { key value … }`. Semantics come from the
   descriptor's `fields`. A contributed primitive needs **zero** grammar edits and
   no code-gen of the parser. *This is the framework's real grammar.*
2. **Optional bespoke sugar** — the hand-authored ergonomic rules (`wall north {
   window … }`) stay, as *sugar over* the generic core. A **promotion** path lets a
   contributed primitive graduate from generic syntax to bespoke sugar without ever
   breaking existing files (both syntaxes remain valid).

The layering is visible live: author a not-yet-registered type and the grammar
accepts it (zero parse errors) while the strict schema *gates* it — exactly the
design ("the front-end parses any name; the schema registers the real ones").

---

## 4. Adding a primitive in ~2 files — the `spiral_staircase` proof

This is the payoff. A genuinely new object type — a helical staircase — was added
the way the framework promises.

**File 1 — the declaration** (`editor/src/schema/fields/spiralStaircase.ts`):

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

Register it in the manifest, run the codegen, and — with **no other edits** — the
type is in the typed schema union, has a property-panel form, appears in the
data-model docs, and is a first-class DSL citizen:

```
spiral_staircase "Stair" { x 120 y 120 radius 45 total_height 110 turns 1.75 }
```

compiles, its fields validate, and the editor autocompletes them. Each value is a
**named parameter** (`radius 45`, not a cryptic positional `45`); a terse
positional form `(120, 120, 45, 110, 1.75)` is also accepted as sugar.

**File 2 — the capabilities** (`editor/src/registry/nodes/spiralStaircase.tsx`):

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

**Live proof:** in the WDL playground, `spiral_staircase "Stair" { x 120 y 120
radius 45 total_height 110 turns 1.75 }`, authored purely through the generic DSL
path with named parameters, renders as wooden treads
winding a central pole inside a room — and the editor's completion widget lists
`radius / total_height / turns / steps / tread_thickness / pole_radius / z_offset`.
Two files; every projection and capability derived from them.

---

## 5. The build process — how it was actually done

The framework was not built as a big rewrite. It was **phased, parity-gated, and
reversible**, so the app kept working at every step. This process is as much the
point as the result.

| Phase | What it delivered |
|---|---|
| **Parity harness first** | A self-referential golden snapshot — expand + combined plans + elevations + merged roof spec, hashed per config over 6 real configs. `npm run parity-render` must stay **6/6 byte-identical** after *every* increment. This is the safety net that made everything else safe. |
| **P1 — Registry, in place** | Extend the node descriptor; stand up the capability/view registry; convert the central 3D/2D/expand dispatchers to *consult-registry-first, fall-back-to-legacy* (the exact pattern already proven by the `item` furniture type). Derive the schema union, layer roles, and add-menu from the registry. |
| **P1½ — Compositor as a Stage DAG** | Introduce `Stage` + the toposort-fold runner; wrap the existing passes as named, ordered stages behind byte-identical output. Two registries now: primitives + stages. |
| **P2 — Field projections** | The two-tier field engine; `fields → typed schema source` (codegen-to-core, so no core/contributed split); `fields → form` (AutoForm); *invert* the data-model doc generator to read `fields`. All four projections now flow from one source. |
| **P3 — Generic DSL** | The generic `ObjectDecl` grammar + descriptor-driven compile / decompile / positional-args / validation / completion. Bespoke rules stay as sugar. |
| **P4 — Kernel extraction** | Lift the domain-neutral engine into `kernel/`, guarded by the dependency-direction test. |
| **P5 — The proof** | `spiral_staircase` — the first genuinely new primitive, added in ~2 files, rendered live. |

Two principles made the increments trustworthy:

- **Consult-first, fall-back.** Every dispatcher tried the new path and fell back to
  the old one, so a half-migrated system was always a *working* system.
- **A parity gate on every commit.** Refactors that must not change output are
  proven not to, mechanically — not by eyeball.

*(The two originally-deferred finishing threads — LSP completion-from-fields, and
the physical kernel extraction — were later completed the same way: green tests,
live verification, parity 6/6, committed.)*

---

## 6. Retargeting to a new domain

Because the kernel mentions no house, a second domain reuses it verbatim and
rewrites only the domain layer. The mechanical mapping (worked out in full for a
parametric **solar-PV farm** in
[`PARAMETRIC-DSL-METHOD.md` §13](PARAMETRIC-DSL-METHOD.md)):

| Keep verbatim (kernel + method) | Rewrite (domain) |
|---|---|
| field engine: `fields → {schema, docs, form}` | the primitive *catalogue* (panel, inverter, trench…) |
| stage-DAG runner | the compositor *stages* + the coordinate/units conventions |
| generic `ObjectDecl` grammar + descriptor-driven compile/validate/complete | the bespoke *sugar* rules (optional) |
| parametric engine + resolver (variables/points/grids/formulas) | the *views* (3D, plan, elevation, bill-of-materials) |
| capability + view registry + generic dispatch | the capability *vocabulary* + concrete renderers |

The "recipe" is: enumerate the domain's primitives and their `fields`; write their
capabilities against the registry; keep the parametric layer and the DSL front-end
as-is. The engine is the constant; the domain is the variable.

---

## 7. What is proven, and what is next

**Proven, live, and parity-gated:**

- One `fields` declaration → schema + form + docs + DSL, all four, non-drifting.
- A new primitive in ~2 files, rendered live (`spiral_staircase`).
- A domain-neutral kernel with an enforced dependency-direction boundary.
- A two-track grammar where any primitive parses generically and the schema gates.
- The compositor as a pure, ordered, byte-parity-preserving stage DAG.

**Open, deliberately:**

- Promoting the kernel from a *guarded boundary* to a *separately-published npm
  package* (needs workspace hoisting to keep a single zod instance).
- Migrating the remaining compositor-coupled types (wall/room) fully to `fields`
  for their schema/form/docs while keeping their 2D render in the compositor.
- A domain-agnostic *promotion* codegen (generic syntax → bespoke sugar).

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
| `wadi-dsl/` | the text DSL — grammar, compile, decompile, validate, complete |
| `wadi-dsl/src/generator/descriptors.ts` | the seam feeding `fields` to the DSL |
| `PARAMETRIC-DSL-METHOD.md` | the parametric-layer methodology (variables/formulas/resolver) |
| `plans/primitive-componentization.md` | the working design doc for this framework |

---

### The sentence to lead with

> *Wadi is a parametric house designer — but underneath it is a framework where a
> concept is declared once and the schema, the forms, the docs, and the language
> are projected from that declaration, on a domain-neutral kernel you can point at
> any other domain. Adding a new kind of thing is two files, and it shows up
> everywhere at once.*
