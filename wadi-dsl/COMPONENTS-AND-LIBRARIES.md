# Components & libraries in the Wadi DSL

Reuse in the Wadi DSL (`.wdl`) comes in two layers:

- **Components** — a named, parametric *mini-house* (a stair, a bathroom, a
  verandah, a bench…) you define once and stamp onto any floor with `use`.
- **Libraries** — a `.wdl` file of components (and furniture `asset`s) that other
  files `import` and reuse. **A library *is* a `.wdl` file** — there's no separate
  format.

Both are first-class in the language. This guide shows how to author them and how
to save / load / resolve libraries in the WDL editor (web app + desktop app).

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
  staircase name "Stair" at (0, 0) step (7, 11, 44) direction south total_height rise
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
- `rotation <deg>` (optional) turns the whole stamped assembly about its origin —
  yaw°, 0=south, 90=east. **Right angles (0/90/180/270) are exact for any
  component**; a **non-right angle** is allowed **only for a furniture-only
  component** (a free angle on a component containing a room/pillar/beam/slab/
  staircase is a compile error — arbitrary structural rotation is a future need).
- `with { p = v, … }` overrides params; un-overridden params fall back to their
  declared defaults.
- A component expands **byte-identical** to writing its objects inline — pure
  reuse, no runtime cost, nothing special downstream.

### Rules & tips

- **Local coords.** Author everything relative to `(0, 0)`; `use … at (x, y)` does
  the placement.
- **Components nest freely.** A component — in-file *or* in an imported library —
  may `use` another component and place `item` furniture. A library component can
  `use` a sibling in the same library, `use` a component from a library it itself
  `import`s, and `item ns."id"` from its own imports. Imports resolve
  **transitively** (a library may import libraries), each relocated under its
  namespace, with a clear error on an import cycle.
- **Reserved param names.** A `param` name can't be a grammar keyword (`width`,
  `depth`, `height`, `size`, …) — use `across` / `deep` / `tall`, etc.
- **Furniture too.** A component can place `item` furniture (see the furniture
  section of the DSL reference).

---

## 2. Libraries (reusable `.wdl` modules)

A **library** is a `.wdl` file whose top level holds `component` / `asset` (and
`import`) declarations — **no `house` block needed**:

```wdl
// konkan-parts.wdl — a reusable library (a "module")
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

Shipped with the editor and MCP — importable by name anywhere, no loading needed:

- **`std-furniture`** — 120 furniture assets → `item f."bed_double"` after
  `import "std-furniture" as f`.
- **`konkan/base`** — goal-tagged Konkan parts (Stairwell, Verandah, Otla,
  Bathroom, Kitchen, TulsiVrindavan, Parapet) → `use kb.Verandah …` after
  `import "konkan/base" as kb`.

`examples/konkan_cottage.wdl` assembles a whole house from both.

### Want a live preview while authoring a library?

A house-less module has no floors, so the editor preview shows a *"no floors"*
notice — that's expected; it isn't a renderable house. To see your components as
you build them, give the library a **demo `house`** that `use`s them. Importers
pull only the library's `component` / `asset` exports and ignore the demo house.

---

## 3. Saving & reusing libraries in the WDL editor

The editor keeps a **cache of loaded libraries** that `import` resolves from —
**identical on the web app and the desktop app**. Open the **📚 Library** toolbar
menu:

| Action | What it does |
|---|---|
| **💾 Save current as library…** | Names the current file and puts it in the cache. |
| **📂 Load library file…** | Loads one *or more* `.wdl` files into the cache (multi-select). |
| *(the list of cached libraries)* | Click a name to insert its `import "…" as ns` line · **✎** opens it in the editor · **×** removes it from the cache. |

Each entry shows an origin badge — **saved** (from *Save current as library*) or
**file** (loaded from a `.wdl`).

### Resolution order

`import "name"` resolves in this order:

1. **Your cache** (saved + loaded libraries)
2. **Bundled packs** (`std-furniture`, `konkan/base`)

### Desktop: libraries as real files

In the desktop app, a library can simply be a **file on disk** — no explicit load:

- Any `.wdl` **beside your open file**, or in a **`modules/` subfolder**, is
  auto-loaded into the cache when you open the house — importable by its
  **basename** (`kitchens.wdl` → `import "kitchens"`).
- These are real files you can **commit, share, and version**, and the coding
  agent + MCP can read them.

### If a library isn't loaded

Open a house that imports something not in the cache and the editor names exactly
what's missing:

> ⚠ missing libraries "kitchens", "bathrooms" — 📚 Library → Load library file…

Load the named `.wdl`(s) — several at once — and it resolves.

---

## 4. MCP (for coding agents)

Over the Wadi MCP server:

- `wadi_modules [query]` — list importable modules (filter by a component **goal**
  keyword, e.g. "stairs", "sit-out").
- `wadi_module "<name>" [query]` — show a module's components (name + goal +
  params) and assets (id + dimensions).

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

See also: [`README.md`](README.md) (the DSL overview) and the authoring reference
at [`../wadi-skill/architect/reference/dsl.md`](../wadi-skill/architect/reference/dsl.md).
