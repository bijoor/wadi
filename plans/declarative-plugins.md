# Declarative plugins: WDL-authored primitives (composition + GLB rigs)

Status: plan, for review. No code yet.

## Thesis

A developer (or an AI assistant) can add a new language primitive without editing the
base repository, by authoring it in WDL and registering it at runtime. Two ingredients:

1. **Composition of core primitives.** A primitive is a `component` (already a
   WDL-authored composition of core objects with params) that is *promoted* to a typed
   primitive. It expands into core objects, so it needs no new render code; the existing
   3D, 2D, elevation, and quantities pipeline draws it.
2. **Rigged GLBs.** The DSL gains syntax to manipulate a loaded GLB by its named nodes
   (move, hide, recolour, array a part, later morph and bone). One generic interpreter in
   the base applies the rig. A component that contains a rigged GLB is promoted the same
   way.

Everything is authored and tested in WDL, in the same playground/editor that already
renders it live. The only genuinely new runtime capability is registering a component as
a named type. Full code plugins (arbitrary `render3D`, CSG, procedural meshes) stay as
repository branches and PRs and are out of scope here.

## Why this shape (versus a separate plugin data format)

- No new authoring format. Plugins are `.wdl`, so the whole existing surface applies:
  editor, live preview, completion, hover, `check`/`preview`, share links, MCP.
- Reuses `expandComponent`/`placeComponent`, so a pure-composition primitive is zero new
  render code.
- Reuses the registry seams that already exist for runtime registration.
- Pure data/WDL, no code execution, so a plugin is safe to load from anywhere and an AI
  can write one.
- The promotion path is the same for composition-only and GLB-rigged primitives.

## What it builds on (grounded in current code)

- **Component library + expansion.** `component` instances (`houseConfig.ts`
  `componentObject` ~L406, `componentDef` ~L531) expand via
  `editor/src/svg2d/expand.ts` `expandComponent` (L508) and `placeComponent` (L453),
  which substitute params against the host scope and offset/rotate the stamped objects.
  Rotation is exact only at right angles for structural types (`ANY_ANGLE_TYPES =
  {item, wall}`, L429).
- **GLB rendering.** `editor/src/three/FurnitureItem.tsx` loads a GLB with drei
  `useGLTF`, clones the scene, bbox-measures it, and scales uniformly to the declared
  metric dims (`ItemGLB` useMemo, L52-76; units via `editor/src/three/units.ts`
  `metersToUnits`, L43). It never looks up nodes by name today, so the rig is new code
  in this one function. GLBs must carry stable node names to be riggable.
- **Registry seams (runtime).** `editor/src/registry/registry.ts` `registerNode` (L12)
  also calls `registerObjectSchema` (`houseConfig.ts` L483) and `registerBuiltinRole`.
  Validation runs `objectSchema = z.union([object, registeredObjectFallback])` (L493),
  so a registered schema extends validation without editing the closed union. A runtime
  `fieldsToZod(type, fields)` exists (`editor/src/registry/fieldSchema.ts` L64). Builtins
  self-register as an import side effect (L47-51); there is no explicit bootstrap hook
  yet.
- **DSL.** The generic `ObjectDecl` rule parses any `type "name" { field value }` with no
  grammar change; descriptors feed field order and completion, with a `__setDescriptors`
  seam. `use Name with { … }` already instantiates a component.
- **Module loading.** A `.wdl` module carries `asset`/`component` declarations. Three
  separate resolvers exist and are not shared: the editor/desktop cache
  (`wadi-dsl/playground/libraries.ts` `resolveModule` L118, folder auto-scan L88), the
  CLI (`wadi-dsl/src/cli/moduleResolver.ts` L17), and the MCP (`wadi-mcp/src/pipeline.ts`
  `stdResolveModule` L17, backed by the bundled `MODULES` map).
- **MCP.** `wadi-mcp/src/server.ts` registers tools with `server.registerTool` (e.g.
  `wadi_module` L368 shows a module's `asset`/`component` exports). It imports the real
  editor pipeline (`pipeline.ts` L6-11), so a runtime plugin registry inside that pipeline
  is exercised by MCP for schema/expand/2D. The three.js `render3D` path is not reachable
  headlessly, so GLB-rig rendering is verified only through the running app
  (`wadi_view_3d`/`wadi_capture_3d`).

## The three additions

### A. GLB rig: manipulate a GLB by named nodes, from the DSL

Author and test entirely in WDL, on a new **`model`** primitive (a rigged structural GLB,
kept separate from the furniture `item` so item's anchoring and catalog semantics stay
untouched). `model` shares GLB loading and metric scaling with `item`.

- **DSL syntax** (a rig block; illustrative):
  ```
  model pack."water_tank" at (200, 200) {
    node "lid"    rotate (0, lid_angle, 0)
    node "ladder" visible has_ladder
    node "body"   material color tank_color
    node "rung"   array count rungs step { translate (0, rung_gap, 0) }
  }
  ```
  Values are fields or formulas, so the rig is parametric.
- **Schema.** The `model` object carries an optional `rig: RigOp[]`, each op a small typed
  record (`node`, `op`, args). Validated like any object.
- **Interpreter.** A new `Model` R3F component (sharing GLB-load and metric-scale logic
  with `FurnitureItem`), after cloning the GLB, for each rig op does
  `clone.getObjectByName(node)` and applies it. Generic, data-driven, one place.
- **Rig vocabulary (v1):**
  - `translate` / `rotate` / `scale` a node.
  - `visible` (show or hide a node from a flag).
  - `material color` (recolour a named node).
  - `array`: clone a node N times, applying a **per-instance transform delta**
    (`translate` / `rotate` / `scale`, applied cumulatively, optionally `about` a pivot).
    Translate-only gives a linear array; rotate-about-a-centre gives a circular array;
    translate-up plus rotate-about-a-centre gives a **spiral/helix**. This makes helical
    and circular structures (for example a spiral staircase's steps) declarative rather
    than code.
- **Rig vocabulary (later):** `morph` (drive a glTF morph-target weight), `bone` (rotate a
  skeleton node), `stretch` with pinned nodes (3D nine-slice: named `stretchable` vs
  `fixed` parts).
- **GLB introspection.** Author time needs to know a model's riggable parts. Add a tool
  (editor panel and MCP `wadi_glb_inspect`) that lists node names, materials, morph
  targets, and skins for a `src`. This is what lets an AI write a correct rig.
- **Limit.** A rig interpolates and arranges existing geometry. It does not add vertices
  or cut holes. Boolean cuts and procedural meshes remain code-plugin territory.

### B. Component to typed primitive: promotion + runtime registration

- **Promotion declaration.** An inline marker on the component declaration exposes it as a
  type. The type name is namespaced (`pack.type`) to avoid clashes with core types and
  other plugins. Illustrative form:
  ```
  component WaterTank expose as pack.water_tank layer "structure" {
    param capacity = 1000  label "Capacity (L)"  kind extent  unit "L"
    param rungs    = 6      label "Ladder rungs"   kind int
    ...core objects + a rigged model, in local coords...
  }
  ```
- **params to fields.** Each `param` becomes a `FieldSpec`. `kind`/`unit` are optional
  annotations on the param; when absent, infer (`number` -> measure, `string` -> text).
  Promotion also adds the standard placement and common-tail fields automatically
  (`x`, `y`, `rotation?`, `z_offset`, `enabled`, `layer`, `material`).
- **Runtime registration.** For each promoted type, register a `NodeDefinition`:
  - `type`, `label`, `layerRole`, `addable`, `makeDefault` from the declaration.
  - `fields` from the derived set (drives the form, docs, DSL descriptors).
  - `schema` from `fieldsToZod`, via `registerObjectSchema` (no core union edit).
  - `expand`: reuse `expandComponent`/`placeComponent`, sourcing the component definition
    from the plugin registry instead of `hostConfig.components`, and mapping the object's
    field values to the component's params. No `render3D`/`planFootprint` needed for a
    pure composition; a footprint can be derived from the expanded objects.
  - Feed the field descriptor to the DSL (`__setDescriptors`) so the generic
    `type "name" { … }` form gets completion, positional args, and validation.
- **Using a promoted type.** `water_tank "T1" at (200, 200) { capacity 1500 }` compiles
  via the existing generic `ObjectDecl` path to `{type:"water_tank", capacity:1500, x, y}`;
  the registered `expand` turns it into core objects at resolve time. The compiler needs
  no special case. `use WaterTank with { … }` also keeps working for the un-promoted
  component.
- **Rotation limit** carries over: a promoted structural primitive is right-angle only.

### C. The loader and distribution

- **A plugin package is a `.wdl` module** whose components carry promotion markers (and
  may include rigged items). No separate manifest format is required if promotion is
  declared inline.
- **Bootstrap hook.** Add an explicit early step in the editor/viewer bootstrap
  (`editor/src/viewer/main.ts` / `main.tsx`) that: loads plugin modules from the sources
  below, compiles them, and registers every promoted type before the first render or
  expand. Registration is import-order sensitive, so this must run early.
- **Sources.** Reuse the existing module cache and folder scan for browser/desktop
  (`playground/libraries.ts`). Add a plugin source (a `plugins/` folder beside the file
  on desktop; the library cache in the browser; optionally an R2 bucket like templates and
  furniture).
- **Cross-surface.** The three resolvers are not shared, so a plugin must be threaded into
  each, or a plugin catalog baked into the bundled set. For MCP and CLI, promoted types
  must be registered inside the shared pipeline (a plugin-load step in
  `wadi-mcp/src/pipeline.ts`), sourcing from an embedded plugin catalog (extend
  `gen-assets.mjs` `MODULES`) or a passed-in set.
- **Trust.** Declarative plugins are data/WDL with no code execution, so they are safe to
  load from untrusted sources and from AI output. This is the core safety property that
  separates them from code plugins.

## MCP exposure (so an AI can author plugins)

- `wadi_glb_inspect(src)`: list a GLB's node names, materials, morph targets, and skins,
  so the assistant knows what it can rig.
- `wadi_plugins` / `wadi_plugin(name)`: list promoted primitives and show a plugin's
  fields and composition (extend `wadi_module`).
- `wadi_check` / `wadi_preview` accept a plugin set alongside the `.wdl`, so the assistant
  can author a plugin plus a house that uses it and verify both. 2D and schema and expand
  verify headlessly; GLB-rig rendering verifies through the running app
  (`wadi_capture_3d`).
- Embed a plugin-authoring reference (the rig vocabulary and the promotion rules) in the
  MCP `DOCS` set so the assistant can read the workflow.

Author loop for an AI: read the plugin reference, inspect a GLB for its parts, write a
component with a rig in WDL, verify with `check`/`preview`, add the promotion marker, and
register it.

## Phasing

- **P0. Promotion + runtime registration (composition only, no GLB rig).** The smallest
  slice and it removes the base-code constraint. Deliver: the promotion declaration, the
  params-to-fields derivation, the runtime `NodeDefinition` register with an `expand` that
  reuses `placeComponent`, schema via `fieldsToZod`, DSL descriptor feed, and the bootstrap
  loader. Prove with a composition primitive built from existing core types (for example a
  car porch: slab + four pillars + a roof).
- **P1. GLB rig capability.** The new `model` primitive, the DSL rig syntax, the schema,
  the generic `Model` interpreter, and `wadi_glb_inspect`. Author and test rigs live in
  WDL.
- **P2. Promote GLB-rigged components.** Falls out of P0 + P1; a component containing a
  rigged `model` is promoted with no extra machinery. Add examples.
- **P3. MCP authoring tools and distribution.** `wadi_plugins`/`wadi_plugin`, the
  plugin-aware `check`/`preview`, the embedded reference, cross-surface loading, and
  optional R2 hosting.
- **Optional. Generic solid primitives.** If composition needs shapes the core lacks (a
  cylinder for a tank), consider adding small parametric solids (`box`, `cylinder`,
  `prism`) as core primitives so more can be built without a GLB. Alternatively rely on
  GLBs for non-core shapes.

## Decisions

1. **Promotion surface:** inline marker on the `component` declaration (`expose as
   <ns.type>`). No separate `primitive` block.
2. **GLB rig host:** a new **`model`** primitive for rigged structural GLBs. `item` keeps
   its furniture semantics.
3. **params to fields:** support both. Infer the kind from the default (`number` ->
   measure, `string` -> text); optional `kind`/`unit` annotations on a param refine it.
4. **Type-name namespacing:** namespaced (`pack.water_tank`). The loader rejects a package
   whose namespace or type collides with a core type or another loaded plugin.
5. **Cross-surface loading:** a canonical file location plus an optional shared host,
   mirroring templates and furniture. A `plugins/` folder is resolved by the CLI and the
   desktop app; an optional R2 or URL catalog is fetched by the browser and MCP; the
   browser localStorage cache stays for quick local authoring. "Register once" means
   dropping the `.wdl` in `plugins/` or publishing it to the shared host, after which all
   three surfaces resolve it. (This is the practical option; a full unification of the
   three resolvers is possible later but is not needed to ship.)
6. **v1 rig vocabulary:** `translate` / `rotate` / `scale`, `visible`, `material color`,
   and `array` with a per-instance transform delta (so linear, circular, and spiral
   arrays are all v1). `morph`, `bone`, and `stretch` come later.

## Verification

- The parity gate stays 6/6; plugins are additive and must not change core output
  (`npm --prefix editor run parity-render`).
- New tests: promote a fixture component, register it, place it, and assert it expands to
  the expected core objects and renders in 2D; apply each rig op to a test GLB with known
  node names; a `check`/`preview` round-trip over MCP with a plugin set.

## Out of scope

- Full code plugins (arbitrary `render3D`, CSG, procedural meshes). These remain
  repository branches and PRs, per the current process in
  [`documentation/05-extending-the-dsl.md`](../documentation/05-extending-the-dsl.md) §4.1.
