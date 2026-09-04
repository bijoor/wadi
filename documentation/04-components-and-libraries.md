# Components & libraries in the Wadi DSL

> Part of the [Wadi documentation](README.md). Prerequisite: the
> [authoring guide](03-authoring.md). This chapter covers **reuse**.

Reuse in the Wadi DSL (`.wdl`) comes in two layers:

- **Components**: a named, parametric *mini-house* (a stair, a bathroom, a
  verandah, a bench…) you define once and stamp onto any floor with `use`.
- **Libraries**: a `.wdl` file of components (and furniture `asset`s) that other
  files `import` and reuse. **A library *is* a `.wdl` file**. There is no separate
  format.

Both are first-class in the language. This guide shows how to author them and how the
WDL editor manages the modules a design imports (the 🧩 Modules panel), which travel
inside the saved `.wadi`.

---

## 1. Components

### Define a component

A component is authored in its **own local coordinates** (origin `(0, 0)`) so it
can be dropped anywhere. It may declare `param`s (knobs, with optional defaults),
local `var`/`point`s, and any floor objects.

```wdl
component Bench {
  param length = 60 label "Bench length"      // a knob (default 60)
  param seat   = 18
  beam name "Seat" at (0, 0) size (length, seat) height 6
}
```

An optional `goal "…"` documents intent and is the discovery key for module search
(see [Libraries](#2-libraries-reusable-wdl-modules) and [MCP](#4-mcp-for-coding-agents)):

```wdl
component Stairwell goal "climb to the next floor" {
  param rise = 116
  staircase name "Stair" at (0, 0) step (7, 11, 44) direction south climb up total_height rise
}
```

### Use (stamp) a component

`use` places a component on a floor at `(x, y)`, optionally naming the instance and
overriding params. **Param overrides use `=`** (not `:`):

```wdl
floor 1 "Ground" {
  use Bench at (40, 40)                        // all defaults
  use Bench as "LongBench" at (40, 120) with { length = 120 }
}
```

- `at (x, y)` offsets the component's local origin onto the floor.
- `rotation <deg>` (optional) turns the whole stamped assembly about its origin:
  yaw°, 0=south, 90=east. **Right angles (0/90/180/270) are exact for any
  component**; a **non-right angle** is allowed **only for a furniture-only
  component** (a free angle on a component containing a room/pillar/beam/slab/
  staircase is a compile error; arbitrary structural rotation is a future need).
- `with { p = v, … }` overrides params; un-overridden params fall back to their
  declared defaults.
- A component expands **byte-identical** to writing its objects inline. It has no
  runtime cost and nothing special downstream.

### Rules & tips

- **Local coords.** Author everything relative to `(0, 0)`; `use … at (x, y)` does
  the placement.
- **Components nest freely.** A component (in-file *or* in an imported library)
  may `use` another component and place `item` furniture. A library component can
  `use` a sibling in the same library, `use` a component from a library it itself
  `import`s, and `item ns."id"` from its own imports. Imports resolve
  **transitively** (a library may import libraries), each relocated under its
  namespace, with a clear error on an import cycle.
- **Reserved param names.** A `param` name can't be a grammar keyword (`width`,
  `depth`, `height`, `size`, …). Use `across` / `deep` / `tall`, etc.
- **Furniture too.** A component can place `item` furniture (see the furniture
  section of the DSL reference).

### Promote a component to a primitive (`expose as`)

A component can be **promoted to a runtime typed primitive**, so it reads and behaves
like a built-in object type (`pack.type`) instead of a `use` instance:

```wdl
component Bench goal "a place to sit" expose as garden.bench [layer "id"] [label "…"] {
  param length = 60
  beam name "Seat" at (0, 0) size (length, 18) height 6
}
```

`expose as <pack>.<type>` names the promoted primitive (a dotted `pack.type` id);
optional `layer "id"` and `label "…"` set its default layer and menu label. Once
exposed, `pack.type` is a first-class object type throughout the model, its `param`s
becoming that type's fields, so authors place it directly rather than through `use`.

---

## 2. Libraries (reusable `.wdl` modules)

A **library** is a `.wdl` file whose top level holds `component` / `asset` (and
`import`) declarations, with **no `house` block needed**:

```wdl
// konkan-parts.wdl - a reusable library (a "module")
component Otla goal "a raised front platform" {
  param across = 240
  param deep   = 40
  plinth name "Otla" at (0, 0) size (across, deep) height 15
}

asset "daybed" src "https://…/daybed.glb" dims (1.8, 0.4, 0.9) name "Daybed" category "Living"
```

Another file pulls it in with `import`, then stamps components with `use ns.Comp`
and places assets with `item ns."id"`:

```wdl
house Home {
  import "konkan-parts" as kp
  floor 1 "Ground" slab_thickness 0 {
    room Hall at (20, 20) size (200, 200) { wall north east south west }
    use kp.Otla at (20, 4) with { across = 200 }
    item kp."daybed" at (60, 60)
  }
}
```

### Two bundled packs

Shipped with the editor and MCP, importable by name anywhere with no loading needed:

- **`std-furniture`**: 120 furniture assets → `item f."bed_double"` after
  `import "std-furniture" as f`.
- **`konkan/base`**: goal-tagged Konkan parts (Stairwell, Verandah, Otla,
  Bathroom, Kitchen, TulsiVrindavan, Parapet) → `use kb.Verandah …` after
  `import "konkan/base" as kb`.

`examples/konkan_cottage.wdl` assembles a whole house from both.

### Want a live preview while authoring a library?

A house-less module has no floors, so the editor preview shows a *"no floors"*
notice. That's expected; it isn't a renderable house. To see your components as
you build them, give the library a **demo `house`** that `use`s them. Importers
pull only the library's `component` / `asset` exports and ignore the demo house.

---

## 3. Modules in the WDL editor (managing what `import` resolves)

A model carries a **module list**: the custom component `.wdl` files it imports.
That list travels **inside the saved `.wadi`** (each module a readable file under
`modules/`, mapped by import ref in the manifest), so a design is self-contained and
a component can be reused in other models by unzipping the `.wadi`. Inbuilt packs
(`std-furniture`, `konkan/base`) are always available and are not stored per model.

Open the **🧩 Modules** panel in the WDL editor. It lists every `import` in the
current WDL, each tagged:

| Tag | Meaning |
|---|---|
| **inbuilt** | a bundled std pack — always available, nothing to add |
| **bundled** | a custom module registered for this model (saved in the `.wadi`) |
| **missing** | imported but not registered yet — add it to resolve the import |

Panel actions:

| Action | What it does |
|---|---|
| **＋ New module (edit code)** | opens the same WDL editor to author or paste a component `.wdl` |
| **Add a .wdl file** | loads a component `.wdl` from disk into the model |
| **Edit** / **Replace** | edit a custom module's code, or replace it from a file |
| **Create** (on a *missing* import) | author the missing module, its ref pre-filled |
| **Remove** | drop a custom module |

A badge on the 🧩 Modules button counts any missing imports.

### Resolution order

`import "name"` resolves in this order:

1. The model's **custom modules** (the registry, saved in the `.wadi`)
2. The **bundled packs** (`std-furniture`, `konkan/base`)

### Desktop: sibling files auto-load

In the desktop app, opening a plain `.wdl` from disk auto-loads its imported
component files with no manual step: any `<ref>.wdl` **beside the file**, or in a
**`modules/` subfolder**, is read in and registered, importable by its **basename**
(`kitchens.wdl` → `import "kitchens"`). These are real files you can **commit,
share, and version**, and the coding agent + MCP read them. In a browser there is no
filesystem, so you add modules through the 🧩 Modules panel instead.

### Agents can add modules too

An AI agent registers a component module the same way it edits the main design, so
the module bundles into the `.wadi` and its `import` resolves:

- In the browser (WebMCP / `window.wadi`): `wadi_add_module(ref, wdl)`,
  `wadi_list_modules`, `wadi_remove_module`.
- In a live co-edit session (the hosted MCP server):
  `wadi_session_add_module(session, ref, wdl)`, `wadi_session_list_modules`.

Register the module, then `import "ref" as ns` in the main WDL and `use ns.Comp`.

---

## 4. MCP (for coding agents)

Over the Wadi MCP server:

- `wadi_modules [query]`: list the **bundled** importable modules (filter by a
  component **goal** keyword, e.g. "stairs", "sit-out").
- `wadi_module "<name>" [query]`: show a bundled module's components (name + goal +
  params) and assets (id + dimensions).

To REGISTER a custom component module (so it bundles into the user's `.wadi`), an
agent uses the surface it is on:

- **WebMCP** (agent in the browser): `wadi_add_module`, `wadi_list_modules`,
  `wadi_remove_module`.
- **Live co-edit session** (the hosted server): `wadi_session_add_module`,
  `wadi_session_list_modules`, alongside `wadi_session_get` / `wadi_session_set`.
- **Offline coding agent**: author the component `.wdl` as a sibling file next to the
  main `.wdl` (`<ref>.wdl` or `modules/<ref>.wdl`); the desktop app auto-loads it.

---

## 5. Quick reference

```wdl
// ── define a component ───────────────────────────────────────────────
component Name goal "…"? {           // goal optional (discovery key)
  param p = default label "…"?       // default & label optional
  …objects in LOCAL coords (origin 0,0)…
}

// ── stamp it (same file) ─────────────────────────────────────────────
use Name as "id"? at (x, y) [rotation <deg>] [with { p = v, … }]   // overrides use `=`
//   rotation: 0/90/180/270 for structural, any angle for furniture-only

// ── a library: a .wdl of component/asset decls, no `house` needed ─────
// then in another file:
import "name" as ns                  // ns.Comp · ns."assetId"
use  ns.Comp as "id"? at (x, y) [with { … }]
item ns."assetId" at (x, y)
```

See also: the [**authoring guide**](03-authoring.md) (the end-to-end tutorial) and the
dense syntax reference at
[`wadi-skill/architect/reference/dsl.md`](../wadi-skill/architect/reference/dsl.md).
