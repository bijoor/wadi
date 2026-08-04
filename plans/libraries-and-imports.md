# Wadi modules & imports — a `.wdl` file is the unit of reuse

Status: **Phase 1 SHIPPED** (P1a–P1e, commits 0b28dfc · 8131267 · 440fd64 · 58ec274 · a267bbd).
Phases 2–3 (function modules + goals; save + git/URL sharing) not yet started.

## The model (refined per feedback)

There is **no separate "library" format**. A reusable component, function, or asset pack is
**just a `.wdl` file** — a *module*. The DSL gains **hierarchical construction**: any `.wdl`
can **import** other `.wdl` files (which can import others, transitively) and use their
definitions. This is exactly how code modules work.

Decisions locked in:
1. **A module = a full `.wdl` file.** No new file type/keyword; the same grammar +
   toolchain. A "reusable function" is a `.wdl` you saved and import elsewhere.
2. **Namespaces from day one.** Every import is aliased — `import "…" as ns` — and its
   exports are referenced `ns.Name` / `ns."asset-id"`. No global soup; no rename churn later.
3. **Sharing rides standard VCS, lean.** Modules are files; distribution/versioning is a
   git/GitHub repo of `.wdl` files (import by path now, by git/URL ref later) — no bespoke
   registry, minimal overhead.
4. **Explicit imports only; keep the core DSL lean.** Nothing auto-imports. The *shipped
   examples* may `import` a std pack for demonstration, but the language never does it
   implicitly.
5. **A module can carry anything a `.wdl` can** — `var` / `point` / `grid` / `component` /
   `asset` — because it *is* a full `.wdl`. Its exports are its top-level definitions.

## What exists to build on
- **In-file components already work** (`component Name { param … ; <objects> }` + `use Name
  at (x,y) with { … }`, recursively expanded in `svg2d/expand.ts::expandComponent`). Modules
  generalise this to **cross-file, namespaced, goal-tagged** reuse.
- **Furniture catalog** (`editor/src/furniture/catalog.ts`, `furnitureAsset(id)→{id,src,dims}`)
  → the payload of a shipped **`std-furniture.wdl`** module, generated from it so they can't
  drift. It stops being a hardcoded engine table.
- **VCS/dist precedent:** templates already live on R2 with an `index.json`; a git-repo of
  modules is the leaner, standard evolution of that.

---

## Design

### 1. A module file (a `.wdl`)
A `.wdl` may declare **top-level, exportable definitions**, and optionally a `house` body
that serves as the module's own live preview / test:
```wdl
// stairwell.wdl — a reusable "function"
import "std-primitives" as p           // modules can import modules (hierarchy)

component Stairwell goal "climb to the next floor" {
  param rise = 116
  param at_x = 0
  param at_y = 0
  staircase name "S" at (at_x, at_y) step (7,11,44) direction south total_height rise
}

// optional: a `house` body here just previews/tests Stairwell — NOT exported.
```
- **Exports** = the module's top-level `component`, `asset`, `var`, `point`, `grid` defs.
- A `house` body (if present) is the module's own demo and is **ignored on import**.
- `goal STRING` on a `component` is the discovery key (additive; schema `.catchall`).
- Named assets get a top-level declaration so a module can be a furniture pack:
  ```wdl
  // std-furniture.wdl (generated from FURNITURE_CATALOG)
  asset "bed_double" src "…/bed_double.glb" dims (1.5,0.5,2.0) name "Double bed" category "Bedroom"
  ```

### 2. Import + use (namespaced)
```wdl
house Home {
  import "konkan/base" as kb          // a module (path/name → resolved to a .wdl)
  import "std-furniture" as f
  …
  floor 1 "Ground" {
    use kb.Stairwell with { rise: 116, at_x: 208, at_y: 64 }   // a module function
    room Bed at (…) { item f."bed_double" anchor center }       // a module asset
  }
}
```
- `ns.Name` / `ns."asset-id"` / `ns.varName` — always namespaced (no bare cross-module refs).
- In-file (same-file) `component`/`asset` stay bare (`use Stairwell`, `item "id"` for a
  same-file `asset`), unchanged.
- Resolution of an import `ref`: **local path** (relative to the file / a module search path)
  now; **git/URL ref** later (Phase 3). Missing module / missing `ns.Name` → clear error.

### 3. Hierarchical construction
- A module `import`s other modules; imports are transitive but **namespaces do not leak** —
  `Home` sees only what *it* imported, under its own aliases. A module references its own
  imports via its own aliases. (Standard module scoping.)
- So abstraction stacks: `konkan/two-storey` imports `konkan/base` (Stairwell, Verandah,
  Plinth) and composes them into one `use kb2.TwoStoreyShell`. The model reaches for the
  **highest abstraction that matches the goal** and drills down only if needed — the point of
  #1/#3.

### 4. The `item "id"` shorthand
`item ns."bed_double"` (imported pack) or `item "bed_double"` (a same-file `asset`) resolves
to the same `{id, src, dims}` the explicit `asset {…}` block emits → **byte-identical
downstream**; renderers/estimator unchanged. Explicit inline `asset {…}` stays for one-offs.
The built-in items are the `std-furniture` module — imported explicitly (examples may
auto-import it).

### 5. Discovery = browse the module tree (not a flat list)
- `wadi_modules` — list resolvable modules (name, source: local / git, one-line summary).
- `wadi_module "<name>"` — its **exports**: components (name + **goal** + params) and assets
  (id + name + category + dims), plus what *it* imports. This is the module's "API surface"
  the model reads to pick an abstraction; hierarchical, not enumerated. A light `query` can
  keyword-match goals so "climb upstairs" surfaces `konkan/base`→`Stairwell`.
- `wadi_check` / `wadi_preview` validate + render the composed result as today.

### 6. Authoring, saving, sharing (VCS-lean)
- The user **or model** authors a module `.wdl`, `wadi_check`s it, and **saves** it to a
  module store:
  - **Local:** a `modules/` (or user) folder on the search path — importable by name now.
  - **Shared:** a **git/GitHub repo** of `.wdl` modules; `import "gh:org/repo/path@ref"` (or
    a URL) later. Versioning/PRs/history come free from git — the "standard tools, lean
    overhead" ask.
- MCP `wadi_save_module` / an app "Save as module" writes the file to the store. Every saved
  module is discoverable next session → the flywheel.

---

## How the model uses it (end-to-end)
1. Intent "let the user go upstairs" → `wadi_modules {query:"stairs"}` → `konkan/base` →
   `wadi_module "konkan/base"` → `Stairwell goal "climb to the next floor" (params rise,
   at_x, at_y)`.
2. `import "konkan/base" as kb`; `use kb.Stairwell with { rise: <floor height>, … }`; ask
   the user only the missing params; `wadi_check` + `wadi_preview`.
3. Furnishing: `wadi_module "std-furniture"` → ids → `item f."bed_double"`.
4. Nothing fits → author a new module, `wadi_check`, `wadi_save_module` → discoverable next
   time.

## Migration / compatibility
- Additive. In-file `component`/`use`, inline `item asset {…}`, and existing templates keep
  working. `import` + top-level `asset` + `goal` are all new, opt-in.

## Phasing
- **Phase 1 — module imports + assets + `item "id"`**: `import … as ns`, top-level `asset`,
  namespaced resolution, local-path module resolution; generate `std-furniture.wdl`;
  `wadi_modules`/`wadi_module` (assets first). Unlocks furniture via user-definable packs.
- **Phase 2 — function modules + goals**: `component … goal "…"` + cross-file `use ns.Comp`;
  `wadi_module` shows functions+goals; seed a `konkan/base` module (Stairwell, Verandah,
  Plinth, external-stair-with-landing, split-level).
- **Phase 3 — save + VCS sharing + deep hierarchy**: `wadi_save_module`; git/URL import refs;
  module→module import chains; app "Save as module".

## Decisions (locked)
1. **Top-level decls, `house` body optional.** The file top level is a list of
   declarations (`import`, `component`, `asset`, `var`, `point`, `grid`, `layer`) plus an
   optional `house { … }`. A pure-function/asset module has no `house`; a demo module adds
   one (its own preview, not exported).
2. **All top-level defs are exported.** No `export` marker for now; `private` added later.
3. **Bare name against a search path.** `import "std-furniture"` resolves against a search
   path = bundled `std-*` modules + a local `modules/` dir (relative paths also allowed).
4. **`std-furniture` is explicit.** Examples `import` it; the language never auto-imports.

## Phase 1 — implementation checklist (module imports + assets + `item "id"`) ✅ DONE
All seven items shipped. Grammar: top-level decls + optional `house`, `Import`/`AssetDecl`,
`item (assetRef | asset{…})`. Compiler: `compileDsl(text,{resolveModule})` + link pre-pass
(aliased `ns."id"` / bare `"id"` scopes) + `moduleExports()`. `std-furniture.wdl` generated
from the catalog (byte-identical, test-locked). MCP: `stdResolveModule` + `wadi_modules` /
`wadi_module`. Docs in dsl.md. 23 DSL tests + MCP smoke + client-test all green.

Link-based resolution (not Langium multi-doc): the compiler collects `import` refs, asks a
**resolver** for each module's `.wdl` text, parses it, extracts its exported `asset`s (P1) /
`component`s (P2), and links them into a namespaced scope before emitting.

1. **Grammar** (`wadi.langium`): make the top level `(Decl | 'house' House)`; `Decl` =
   `Import | ComponentDef | AssetDecl | Var | Point | Grid | Layer`.
   - `Import: 'import' ref=STRING ('as' ns=ID)?;`
   - `AssetDecl: 'asset' id=STRING 'src' src=STRING 'dims' '(' … ')' ('name' …)?('category' …)?;`
   - `Item`/`RoomItem`: allow `asset` to also be a **ref** — bare `id=STRING`
     (same-file/auto) or `ns=ID '.' id=STRING` (imported). Keep the inline `{…}` block.
   - Regenerate the AST; confirm existing examples still parse + compile (additive).
2. **Resolver interface** `resolveModule(ref) => string | undefined`, threaded through
   `compileDsl(text, { resolveModule })`. Implementations: MCP embeds `std-furniture` (via
   gen-assets); CLI/app read the search path.
3. **Link step** (in `toHouseConfig` / a pre-pass): parse each imported module, collect its
   `AssetDecl`s into `scope[ns][id] = {src,dims,name,category}`; error on unknown module.
4. **`item` resolution:** `item "id"` / `item ns."id"` → look up in scope → emit the same
   `{id,src,dims}` asset object the inline block produces (byte-identical). Unknown id →
   error with near-matches.
5. **Generate `std-furniture.wdl`** from `FURNITURE_CATALOG` (a `gen-std-modules.mjs`); ship
   it as a bundled module (embedded in MCP; on the app/CLI search path).
6. **MCP `wadi_modules` / `wadi_module`** (assets first): list modules + show a module's
   asset exports.
7. **Docs + tests:** `dsl.md`/playground `item` + `import`; DSL round-trip test (`item
   f."bed_double"` == inline asset; unknown id/module errors); examples still green.

Phase 2 adds `component … goal "…"` linking + `use ns.Comp` + function exports in
`wadi_module`. Phase 3 adds `wadi_save_module` + git/URL refs + module→module imports.
