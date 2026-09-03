# From the `.wadi` data model to the `.wdl` grammar

How the Wadi Design Language (`.wdl`) grammar relates to the Wadi data model
(`.wadi` JSON), step by step: what is generated, what is hand-written, the field
types, and the composition rules.

The headline, stated plainly first: **the grammar is not auto-generated from the
`.wadi` JSON.** It is a hand-written Langium grammar, designed against the JSON's
shape, with one shared declarative layer (`fields`) that keeps the JSON schema, the
docs, the forms, and the generic DSL path in sync. The sections below trace the whole
chain against the real files.

## The two artifacts, and where truth lives

- **`.wadi`** is the data-model instance. Its shape is defined by the Zod
  `HouseConfig` schema in `editor/src/schema/houseConfig.ts`. This is the source of
  truth for *what a house is*.
- **`.wdl`** is the authored source. Its shape is defined by the Langium grammar in
  `wadi-dsl/src/language/wadi.langium`. It is ergonomic syntax for producing a
  `.wadi`.
- The bridge is the **compiler** `wadi-dsl/src/generator/toHouseConfig.ts`
  (`.wdl` AST to `.wadi` JSON) and its inverse **decompiler**
  `wadi-dsl/src/generator/fromHouseConfig.ts`.

The flow:

```
.wdl  --parse-->  AST  --compile-->  .wadi JSON  --validate-->  Zod
                                            --resolve-->  numbers  -->  render
```

The grammar exists to emit ASTs that map cleanly onto the JSON.

## Step 1 — The data model: the `.wadi` JSON as a Zod schema

A `.wadi` is a `HouseConfig`: a top-level object with `units`, `site`,
`houseDefaults`, `variables`, `points`, `grids`, `configurator`, `layers`,
`components`, and `floors`. Each floor holds an `objects` array, and every object is
one branch of a **discriminated union on `type`**
(`editor/src/schema/houseConfig.ts`):

```ts
export const object = z.discriminatedUnion("type", [ room, wall, pillar, beam, … ]);
export const objectSchema = z.union([object, registeredObjectFallback]);
```

The union has two halves: hand-written branches (room, wall, roof, and so on) and
**generated branches** imported from `schema/generated/objects.generated.ts`. That
generated file is where the `fields` layer feeds the JSON schema.

## Step 2 — The `fields` spine: one declaration, many projections

This is the part that literally starts from a single declaration and fans out. A
primitive declares its shape once as `FieldSpec[]`. Example,
`editor/src/schema/fields/beam.ts`:

```ts
export const beamFields: FieldSpec[] = [
  { name: "name",     kind: "text",   required: false, doc: "Label" },
  { name: "x",        kind: "coord",  doc: "Top-left X", unit: "project units" },
  { name: "width",    kind: "extent", doc: "X extent",  unit: "project units" },
  { name: "height",   kind: "extent", required: false, doc: "Vertical thickness" },
  { name: "z_offset", kind: "coord",  required: false },
];
```

The domain-neutral engine in `kernel/fieldSchema.ts` **projects** each field onto
four surfaces:

1. **Zod source** (`fieldsToZodSource`). A codegen script,
   `editor/scripts/gen-primitives.mjs`, writes it into `objects.generated.ts`, which
   houseConfig imports into the union. This is how `fields` becomes the JSON
   validator and the `z.infer` TypeScript type.
2. **Docs** (`fieldsToDocRows`), producing the generated `data-model.md`.
3. **Form control** (`fieldToFormControl`), producing an internal form-control spec (generated, not surfaced as a user editing surface).
4. **DSL descriptor** (via `wadi-dsl/src/generator/descriptors.ts`), driving the
   generic grammar path (Step 6).

One declaration, and the schema/docs/form/DSL cannot drift, because they are all
derived from it. A parity test asserts `fieldsToZod` equals the generated schema.

The registry of which primitives are generated this way is
`editor/src/schema/fields/index.ts` (`PRIMITIVE_FIELD_DECLS`).

### Field types (the `kind` presets)

Field types are two-tier (`kernel/fieldSchema.ts`):

- **Tier 1 (closed):** atoms `number | string | boolean | literal`; combinators
  `union`, `list`, `optional`; constraints
  `positive | nonneg | int | min | max | pattern`. This is the only part that is
  engine code.
- **Tier 2 (open, data):** named **presets** composed from Tier 1:

| `kind`   | resolves to                         | used for                 |
|----------|-------------------------------------|--------------------------|
| `coord`  | number                              | x, y, z_offset           |
| `extent` | number > 0                          | width, length, height    |
| `nonneg` | number ≥ 0                          | thickness                |
| `int`    | integer                             | step counts              |
| `text`   | string                              | name, label              |
| `flag`   | boolean or number                   | enabled-like switches    |
| `enum`   | literal union (values from the spec)| direction, roof_type     |

A `FieldSpec` carries `name`, `kind`, `required` (default true; false makes it
`.optional()`), `values` (for enum), plus doc-only `doc`/`unit`/`label`. Adding a new
field type is data (a new preset), not an engine change.

## Step 3 — The grammar: two tiers

The grammar is deliberately split by a banner into two tiers
(`wadi-dsl/src/language/wadi.langium`):

- **Parametric core (domain-neutral):** `Var`, `Point`, `Grid`/`GridLine`, the `Expr`
  formula sublanguage, `Configurator`, `TemplateMeta`, and the `Raw` JSON escape.
  Nothing here mentions a house. To formalize a different domain you keep this tier
  verbatim.
- **Wadi vocabulary (the domain):** `Units`, `Site`, `Defaults`, `Floor`, `Room`,
  `Wall`, `Pillar`, `Beam`, `Roof`, and the rest. This is the only tier you rewrite to
  retarget the method.

## Step 4 — Composition rules (how the grammar nests)

The entry rule mirrors the JSON's containment:

```
Model:  (Import | AssetDecl | Var | Point | Grid | Configurator | LayerDecl | ComponentDef)*
        ('house' ID '{' … (… | Floor)* '}')?
```

Two composition facts fall out of this:

- **A `.wdl` file is a module.** The same top-level declarations are legal both
  outside and inside `house { … }`, and they merge into the same arrays. A file with
  no `house` block is a pure asset/component library (the unit of reuse and import).
- **Containment matches the JSON:** `house` to `floors` to `Floor` to `FloorObject*`.
  A `Floor` contains a `FloorObject`, which is the grammar's mirror of the object
  union:

```
FloorObject: Room | Wall | Pillar | Beam | FloorSlab | Plinth | Ground
           | Staircase | SpiralStaircase | KitchenPlatform | Item | GlbModel
           | Component | Roof | Raw | ObjectDecl;
```

Deeper nesting is itself compositional:

- **Room to walls to openings.** `Room` optionally contains `RoomWall` and `RoomItem`;
  a `RoomWall` optionally contains `Opening` (door/window). So
  `room … { wall north east { window … } item … }` nests three levels.
- **Components.** `ComponentDef` is a mini-house in local coordinates; `Component`
  (`use Comp at (…)`) stamps it onto a floor. `use target=[ComponentDef:QualifiedName]`
  is a real Langium **cross-reference**, resolved by the Wadi scope provider across
  imported-module documents (in-file `Comp` or namespaced `ns.Comp`). Asset references
  for furniture (`item f."bed_double"`) work the same way.
- **Grid.** `Grid` contains `GridLine`s (`1 @ 60 thick 9 role structural`), a
  first-class parametric scaffold that rooms and pillars reference by name.

## Step 5 — The `Expr` sublanguage and the shared `Common` tail

Two grammar features cut across every primitive:

- **`Expr`** is a small expression sublanguage: `+ - * /`, unary minus, the pure
  functions `min/max/clamp/round/floor/ceil/abs`, and dotted references
  (`bay`, `main.x1`, `House.W`). It is a faithful port of the runtime evaluator in
  `editor/src/param/formula.ts`. Any numeric field that can be parametric is typed
  `= Expr` in the grammar. At compile time each `Expr` is serialized back to a
  `"= …"` string (or a bare number when it is a literal); see Step 7.
- **`fragment Common`** is the optional attribute tail
  (`z_offset`, `enabled`, `layer`) that every object carries. It is a Langium
  *fragment*, so it inlines into each rule with no wrapper AST node, and it mirrors the
  common tail the field engine appends to every generated Zod object
  (`COMMON_SOURCE_LINES` in `kernel/fieldSchema.ts`).

## Step 6 — Bespoke rules vs the generic `ObjectDecl`

Every shipped object type has an **ergonomic, keyword-led rule** (for example
`Room`, `Wall`, `SpiralStaircase`): `at (x, y)` placement plus named clauses, tuned to
read well. These are sugar.

Underneath sits one **generic rule**, `ObjectDecl`, the last branch of `FloorObject`:

```
ObjectDecl:
    type=QualifiedName name=NameRef?
    ('(' args+=Value (',' args+=Value)* ')')?
    ('{' fields+=FieldAssign* '}')?
    Common;
```

It parses *any* primitive by name; the semantics (positional-arg order, valid field
names) come from the descriptor manifest (`descriptors.ts`), which reads the very same
`fields` from Step 2. The consequence: a new primitive can be added and used from the
DSL with **zero grammar edits and no `langium generate`**. Keyword-led rules win when
they match; a non-keyword type name falls through to `ObjectDecl`.

One lexer detail makes this work: field-name keywords (`radius`, `direction`,
`total_height`, and so on) are made **soft** by the token builder
(`wadi-token-builder.ts`), so they lex as `ID` and match `FieldKey` without being
enumerated. Only a key that collides with a *hard* leader keyword (`at`, `size`, an
object type) needs quoting (`"height" 8`).

## Step 7 — Compile (`.wdl` to `.wadi`) and decompile

`compileDsl(wdl)` (`toHouseConfig.ts`) does three things: **parse** with Langium,
**link** cross-references (`use` targets, asset refs), then **map** the AST onto the
`HouseConfig` JSON. The parametric layer is preserved rather than evaluated:

```ts
// exprToValue: a literal number stays a number; anything else becomes a formula string
exprToValue(e) => isNum(e) ? e.value : `= ${exprToFormula(e)}`
```

So `width (House.W / 2)` compiles to `"formulas": { "width": "= House.W / 2" }` with a
numeric placeholder, exactly the shape the Zod schema expects. Folding those formulas
to final numbers is a **separate** step, `resolveParametric` (`editor/src/param/`),
run by the app, the MCP server, and `check.sh`. Keeping compile and resolve separate
is what lets the editor show a partial model when a formula fails, while the checkers
still flag it.

The **decompiler** `fromHouseConfig.ts` (`emitWdl`) is the inverse: it turns a
`.wadi` back into an editable `.wdl`, re-lifting `"= …"` strings into `Expr` syntax and
reconstructing the parametric layer (variables, points, grids, components, configurator).
A round-trip test asserts `compile(emit(cfg))` deep-equals `cfg`.

## So in what sense does it "start from the WADI JSON"?

Two senses, and it helps to keep them separate:

- **Conceptually / by design:** the JSON (the Zod `HouseConfig`) is the target. The
  grammar is authored so its AST maps onto that JSON, and the compiler is the explicit
  mapping. Change the JSON's meaning and you change the grammar and compiler to match.
- **Mechanically, for one path:** the `fields` layer *is* generated-from-once. A
  primitive's `fields` produce the JSON schema (via codegen), the docs, the form, and
  the generic DSL descriptor together. For a generic (`ObjectDecl`) primitive, the DSL
  surface really is derived from the same declaration as the JSON schema. For the
  keyword-sugared primitives, the bespoke grammar rule is hand-written, but its
  *meaning* still bottoms out in the same `fields`.

That two-tier split (a neutral parametric core plus a domain vocabulary, over a
declarative field engine) is the reusable method; see `documentation/06-the-method.md`
and `documentation/05-extending-the-dsl.md`.

## File map

| Concern | File |
|---|---|
| Data model (source of truth) | `editor/src/schema/houseConfig.ts` |
| Per-primitive field declarations | `editor/src/schema/fields/*.ts` (+ `index.ts`) |
| Field engine (kinds, projections) | `kernel/fieldSchema.ts` |
| Codegen: fields to Zod | `editor/scripts/gen-primitives.mjs` to `schema/generated/objects.generated.ts` |
| Grammar | `wadi-dsl/src/language/wadi.langium` |
| Generic-path descriptors | `wadi-dsl/src/generator/descriptors.ts` |
| Formula runtime (grammar mirror) | `editor/src/param/formula.ts` |
| Compiler (`.wdl` to `.wadi`) | `wadi-dsl/src/generator/toHouseConfig.ts` |
| Decompiler (`.wadi` to `.wdl`) | `wadi-dsl/src/generator/fromHouseConfig.ts` |
