# Wadi libraries & imports — reusable functions and asset catalogs

Status: **DESIGN — for review.** Not yet implemented. Supersedes the first cut
(`furniture-and-recipes.md`), which baked the catalog + recipes into the DSL/server.

## The reframing (user feedback)

Don't embed furniture catalogs or "recipes" in the DSL or the MCP server. Instead give the
DSL a **library system, like code** — the same mechanism serves both needs, and both become
**user/model-authorable, savable, reusable**, and **hierarchical** (libraries import
libraries; high-level functions compose low-level ones). Discovery is **navigating the
abstraction hierarchy** (browse a library, import what you need), *not* a flat enumerated
list.

Two flavours of library, one import mechanism:

| Library kind | Holds | Analogy |
|---|---|---|
| **Function library** | reusable `component`s (parametric mini-structures) that **declare a goal** | code modules / functions |
| **Asset library** | GLB furniture definitions (`id → src, dims, name, category`) | an asset pack / npm-of-models |

A house `.wdl` **imports** libraries and then uses their functions (`use Stairwell …`) and
assets (`item "bed_double"`). The built-in 50-piece catalog becomes just *one shipped asset
library*, not a hardcoded table — users define their own the same way.

## Why this is better
- **Extensible without touching the DSL/engine.** New furniture packs, new recipes = new
  library files, authored by users or the model. Nothing to recompile or republish.
- **Hierarchical abstraction.** A `TwoStoreyKonkanHouse` function imports and composes
  `Plinth`, `Stairwell`, `Verandah` from a base library; those compose primitives. The
  model works at the **highest abstraction that matches the goal** and drills down only as
  needed — instead of re-deriving everything from `wall`/`staircase` each time.
- **The flywheel.** Every reusable thing a user/model builds is a library artifact that the
  next session can discover and import. The DSL gets richer as it's used, by accretion of
  libraries, not by growing the core grammar.

## What exists to build on
- **In-file components already work**: `component Name { param … ; <objects> }` + `use Name
  as "…" at (x,y) with { … }`, recursively expanded (`svg2d/expand.ts` `expandComponent`).
  Libraries generalise this from *in-file* to *cross-file, named, importable, goal-tagged*.
- **Furniture catalog** (`editor/src/furniture/catalog.ts`) exports `FURNITURE_CATALOG`,
  `furnitureSpec(id)`, `furnitureAsset(id)→{id,src,dims}`. This becomes the payload of the
  **shipped** asset library; the resolver reads from *imported* libraries instead of a
  hardcoded import.
- **Distribution precedent**: templates already live on R2 (`templates.wadi.house`) with an
  `index.json`, fetched with an R2→bundled fallback (`io/templateSource`). Libraries reuse
  that pattern (`libraries.wadi.house` or a `libraries/` prefix + index).

---

## Design

### 1. Library file format
A library is a `.wdl`-family file with a `library` header instead of `house`:
```wdl
library "konkan-base" {                     // name (namespace)
  version "1.0"
  [import "std-primitives"]                 // libraries can import libraries (hierarchy)

  // ---- Function: a goal-tagged reusable component (parametric) ----
  component Stairwell goal "climb to the next floor" {
    param rise = 116
    param at_x = 0
    param at_y = 0
    staircase name "S" at (at_x, at_y) step (7,11,44) direction south total_height rise
  }

  component Verandah goal "add a covered open porch across the front" { … }

  // ---- Asset entries: GLB furniture (an asset library can live in the same file
  //      or be its own library with only assets) ----
  asset "bed_double"  src "…/bed_double.glb"  dims (1.5,0.5,2.0) name "Double bed" category "Bedroom"
  asset "wardrobe"    src "…/wardrobe.glb"    dims (1.0,1.8,0.55) name "Wardrobe"   category "Bedroom"
}
```
- `goal STRING` on a component is the discovery key (additive; schema `.catchall`).
- `asset …` lines are the catalog rows — a library can be pure-asset, pure-function, or mixed.
- `import` makes another library's functions + assets visible here (hierarchical).

### 2. Import in a house
```wdl
house Home {
  import "konkan-base"           // brings in its components + assets (+ its imports, transitively)
  import "my-furniture"          // a user's own GLB pack
  …
  floor 1 "Ground" {
    use Verandah at (4,4) with { … }     // a library function
    room Bed at (…) { item "bed_double" anchor center }   // a library asset, resolved by id
  }
}
```
- Resolution order for `item "id"` / `use Name`: current file → imported libraries (in
  order) → the shipped `std-*` libraries. Clear error on unknown id/name with near-matches
  and "which library defines it".
- Name collisions across libraries → error, or `import "lib" as ns` + `ns.Name` (decide;
  see open Q).

### 3. The `item "id"` shorthand (Track A, unchanged intent)
`item "bed_double"` resolves the id via the imported asset libraries to the same
`{id, src, dims}` the explicit `asset {…}` block emits → **byte-identical downstream**. The
explicit block stays for one-off GLBs. Bare-string form (decided). The catalog is no longer
special-cased: the built-in items are just the `std-furniture` library, always available.

### 4. Hierarchical discovery (Track B, reframed)
No flat `wadi_recipes` enumeration. Instead, **browse the library tree**:
- `wadi_libraries` — list available libraries (name, kind, short description, source:
  shipped / user / R2).
- `wadi_library "<name>"` — its contents: functions (name + **goal** + params) and assets
  (id + name + category + dims), and what it imports. This is the "table of contents" the
  model reads to pick an abstraction.
- A light `query` on `wadi_libraries`/`wadi_library` can keyword-match goals so "climb
  upstairs" surfaces the library + `Stairwell` function — but the primary model is *browse
  the hierarchy and import*, like reading a package's API.
- `wadi_check`/`wadi_preview` already validate/render the composed result.

### 5. Authoring & saving libraries (the point of #2/#4)
- The user **or the model** authors a library `.wdl`, `wadi_check`s it, and **saves** it to
  a library store. Two stores:
  - **Local**: a `libraries/` folder (repo, or a user dir the desktop app/CLI knows).
  - **Shared**: R2 (`libraries/…` + `index.json`), same publish path as templates.
- The desktop app + CLI + MCP resolve imports from: bundled `std-*` → local libraries → R2
  index. So a saved library is importable everywhere by name.
- `wadi_save_library` (MCP) / a "Save as library" action (app) writes it to the store.

### 6. Storage of the shipped catalog
Generate `std-furniture.wdl` (asset library) **from** `FURNITURE_CATALOG` so the shipped
pack and the editor's runtime catalog can't drift, and mark it always-imported (or
auto-import on first `item "id"` miss). Later, `FURNITURE_CATALOG` could even be *derived*
from `std-furniture.wdl` to make the library the single source of truth.

---

## How the model uses it (end-to-end)
1. Intent "let the user go upstairs" → `wadi_libraries {query:"stairs"}` → `konkan-base` →
   `wadi_library "konkan-base"` shows `Stairwell goal "climb to the next floor" (params:
   rise, at_x, at_y)`.
2. `import "konkan-base"`, `use Stairwell with { rise: <floor height>, at_x, at_y }`; ask
   the user only the missing params; `wadi_check` + `wadi_preview`.
3. Furnishing: `wadi_library "std-furniture"` (or a user pack) → ids → `item "bed_double"`.
4. If nothing fits, the model **authors a new component/asset**, `wadi_check`s, and
   `wadi_save_library` — now it's discoverable next time (flywheel).

## Migration / compatibility
- In-file `component`/`use` keep working unchanged (a library is just extracted in-file
  components). `item asset {…}` keeps working. All additive.
- Existing templates/examples unaffected until they opt into `import`.

## Phasing
- **Phase 1 — asset libraries + `item "id"`**: library file grammar (asset-only subset) +
  `import` + `item "id"` resolution; ship `std-furniture.wdl` generated from the catalog;
  `wadi_libraries`/`wadi_library` list assets. Concrete, unlocks furniture.
- **Phase 2 — function libraries + goals**: `component … goal "…"` + cross-file `import` of
  functions; `wadi_library` shows functions+goals; seed a `konkan-base` library
  (Stairwell, Verandah, Plinth, external-stair-with-landing, split-level).
- **Phase 3 — save/share + hierarchy**: `wadi_save_library` + local/R2 stores; library→library
  `import`; namespacing; app "Save as library".

## Open questions / decisions
1. **File identity:** one `.wdl` grammar with `house` **or** `library` at the top, or a
   distinct `.wdll` extension? (Lean: same grammar, `library` header — one toolchain.)
2. **Namespacing on collision:** hard error, or `import "lib" as ns` + `ns.Name`/`ns."id"`?
   (Lean: plain names, error on collision; add aliasing later.)
3. **Asset id namespacing:** are `item` ids global across imported asset libs, or lib-scoped?
   (Lean: global with collision error, matches furniture ergonomics.)
4. **Where user libraries live by default:** repo `libraries/`, an app-managed user folder,
   or R2-only? (Lean: local folder first, R2 for sharing in Phase 3.)
5. **Auto-import `std-furniture`** so `item "id"` "just works" without an explicit import,
   or require `import "std-furniture"` for explicitness? (Lean: auto-import the shipped
   std libs; explicit import for user libs.)
6. **Does a `library` also allow variables/points/grids** (shared knobs) or only
   components + assets? (Lean: components + assets first; shared vars later.)
