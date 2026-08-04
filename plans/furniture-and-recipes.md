# Furniture discovery + goal-tagged recipes

Status: **DESIGN — for review.** Not yet implemented.

## Why

Two gaps surfaced while driving the DSL from an agent (Bionic/LM Studio, Claude):

1. **Furniture is placeable but not discoverable.** The `item` primitive exists, but
   its `asset` is a full inline spec (`id` + GLB `src` URL + `dims`). The ~50-piece
   catalog (`editor/src/furniture/catalog.ts`) is exposed **nowhere** to the agent, and
   there's no id-only shorthand — so the model can't find what furniture exists or place
   it without inventing a URL.
2. **The model knows primitives but not *how to reach a goal*.** Asked "let the user
   climb to the next floor," it knows a `staircase` exists but not how to construct one,
   which params to ask the user for, or how it connects two floors. Same for "add a
   verandah," "raise the house on a plinth," etc. There's no goal→recipe layer.

Goal: a **discovery + guidance layer** over the existing primitives, and a library that
**grows richer as the DSL is used** (user-authored components can self-declare goals and
become discoverable recipes).

## Current state (facts)

- **DSL** (`wadi-dsl/src/language/wadi.langium`):
  - `Item` / `RoomItem` — `item [name "…"] asset { id "…" src "…" dims (dx,dy,dz) [name][category] } …`.
    The `asset` block is **mandatory and fully explicit**. No catalog reference.
  - `ComponentDef` (`component Name { param … ; <objects> }`) + `Component` instance
    (`use Name as "…" at (x,y) with { … }`). **No goal/intent metadata.**
  - `staircase`, `kitchen`, `roof`, etc. are first-class.
- **Catalog** (`editor/src/furniture/catalog.ts`) already exports everything we need —
  `FURNITURE_CATALOG` (id·name·category·dimensions), `FURNITURE_CATEGORIES`,
  `furnitureSpec(id)`, **`furnitureAsset(id)` → `{id, src, dims}`** (exactly the asset a
  shorthand must expand to), `furnitureUrl(id)`, `DEFAULT_FURNITURE_ID`.
- **Reach:** `wadi-dsl` generator already imports from `editor/src` (e.g.
  `resolveParametric`); `wadi-mcp` bundles `editor/src`. So both the DSL compiler and the
  MCP server can reuse the catalog with **zero duplication**.
- **Agent surface:** MCP tools today = `wadi_check`, `wadi_preview`, `wadi_examples`,
  `wadi_reference`, `wadi_view_3d`, `wadi_capture_3d`. Skill reference =
  `data-model.md` (generated), `dsl.md`, `roof-v2-guide.md`, `coordinate-system.md`,
  `parametric-conventions.md`, `conventions.md`, examples.

---

## Track A — Furniture discovery + catalog shorthand

### A1. DSL shorthand (id-only)
Add an alternative `Asset` form that references the built-in catalog by id:
```wdl
item "bed_double" at (x, y) [rotation <deg>] [scale <s>]        // free-standing
room Bedroom … { item "wardrobe" anchor top-left [gap (gx,gy)] } // room-anchored
```
- Grammar: make `Asset` a choice — the existing explicit block **OR** a bare
  `catalog=STRING` id. (Keep the explicit block for custom GLBs not in the catalog.)
- Compiler (`toHouseConfig.ts`): when the id form is used, call
  `furnitureAsset(id)` to emit the same `{id, src, dims}` the explicit form produces →
  **byte-identical downstream**; renderers/estimator unchanged.
- Validation: unknown id → a clear compile error listing near-matches (levenshtein) +
  "run wadi_furniture to list ids." Add a structural-lint/compile check.

### A2. Expose the catalog to the agent
- **Generated reference doc** `reference/furniture-catalog.md` — id · name · category ·
  dims (m) · footprint, grouped by category. **Generated from `FURNITURE_CATALOG`** (a
  `gen-furniture-doc.mjs`, same pattern as `data-model.md`'s generator) so it can't drift.
- **New MCP tool `wadi_furniture`** — `{ category?, search? }` → the matching catalog
  rows (id, name, category, dims). Lets the model answer "what beds are there?" and get
  the exact ids to use in `item "…"`.
- Playground `reference.ts` + `dsl.md`: document `item` properly (both asset forms +
  anchoring), currently barely mentioned.

### A3. Verification
- DSL round-trip test: `item "bed_double"` compiles to the same config as the explicit
  asset; unknown id errors. Editor renders it (byte-identical). `wadi_furniture` returns
  the catalog over the MCP protocol. All examples still pass.

---

## Track B — Goal-tagged recipes ("micro-goal → how to build it")

The core new idea: a **recipe** = a named micro-goal the model can look up, that tells it
**which primitive/component to use, what to ask the user, and a fill-in template.**

### B1. Recipe schema (data, authored once, embedded for the MCP)
```jsonc
{
  "goal": "stairs-between-floors",              // stable id
  "title": "Let the user climb to the next floor",
  "triggers": ["climb", "go upstairs", "connect floors", "staircase", "access upper floor"],
  "uses": ["staircase"],                         // primitives/components involved
  "summary": "A top-anchored staircase descends from the upper floor to the one below.",
  "ask": [                                        // params to gather from the USER
    { "name": "total_height", "desc": "floor-to-floor rise", "default": "= the upper floor's height (e.g. 116)" },
    { "name": "at",           "desc": "top landing position (x,y) on the UPPER floor" },
    { "name": "direction",    "desc": "which way it descends: north|south|east|west" },
    { "name": "step",         "desc": "(rise, tread, width) — default (7, 11, 44)" }
  ],
  "optional": [{ "name": "max_run", "desc": "auto-switchback if the run exceeds this" }],
  "template": "staircase name \"Stair\" at ({x}, {y}) step (7, 11, 44)\n  direction {direction} total_height {total_height} [max_run {max_run}]",
  "notes": "Place on the UPPER floor (top-anchored). See dsl.md staircase.",
  "example_ref": "coastal"                        // an example that demonstrates it
}
```

### B2. Where recipes live
- Authored as data under `wadi-skill/architect/recipes/*.json` (or one `recipes.json`).
- **Embedded into the MCP** by `gen-assets` (same mechanism as EXAMPLES/DOCS), so the
  server stays self-contained.

### B3. Agent surface
- `wadi_recipes` — `{ query? }` → list of `{goal, title, summary, triggers}` (optionally
  ranked by the user's intent text). "How do I let someone go upstairs?" → finds
  `stairs-between-floors`.
- `wadi_recipe` — `{ goal }` → the full recipe: params to ask, the template, notes,
  and a pointer to the demonstrating example.
- Skill reference doc `reference/recipes.md` (generated from the same data) for the
  file-authoring skill.

### B4. The flywheel — components that declare a goal
Let in-file (and, later, shared) components self-declare intent:
```wdl
component Stairwell goal "climb to the next floor" {
  param rise = 116
  staircase name "S" at (0, 0) step (7,11,44) direction south total_height rise
}
```
- Grammar: optional `goal STRING` on `ComponentDef` → emitted onto the component in the
  config (schema already `.catchall`, so additive).
- `wadi_recipes` merges **built-in recipes + any `goal`-tagged components** found in the
  current `.wdl` (passed in), so a user's own components become discoverable recipes. As
  people build reusable components, the recipe library grows for free — the "DSL evolves
  as it's used" property you asked for.

### B5. Seed recipes (first cut)
`stairs-between-floors`, `external-stair-with-landing` (the test-file pattern),
`raise-on-a-plinth` (add a Plinth floor), `add-a-verandah` (open-sided room + pillars),
`furnish-a-room` (uses `wadi_furniture`), `pitched-roof` / `shed-roof-with-overhang`,
`split-level-floor` (z_offset). Each cites a passing example.

### B6. Verification
- Every recipe's `template` (with sample params) compiles + passes `wadi_check`.
- `wadi_recipes`/`wadi_recipe` return over the MCP protocol; `goal`-tagged component
  round-trips and shows up in `wadi_recipes`.

---

## How the model uses it (end-to-end)
1. User: "I want to get to the first floor" → `wadi_recipes "climb upstairs"` →
   `stairs-between-floors`.
2. `wadi_recipe stairs-between-floors` → the params to ask + template.
3. Agent asks the user only the missing params (position, direction), fills the template,
   inserts it, `wadi_check` + `wadi_preview`.
4. Furnishing: `wadi_furniture {category:"Bedroom"}` → ids → `item "bed_double" …`.

## Phasing
- **Phase 1 — Track A** (furniture): shorthand + `wadi_furniture` + generated catalog doc
  + `dsl.md`. Self-contained, catalog already exists.
- **Phase 2 — Track B core**: recipe schema + data + `wadi_recipes`/`wadi_recipe` +
  reference doc + seed recipes.
- **Phase 3 — flywheel**: `component … goal "…"` grammar + merge user components into
  `wadi_recipes`.

## Open questions / decisions
1. **Shorthand syntax:** `item "bed_double"` (bare string) vs `item catalog "bed_double"`
   (explicit keyword). Bare string is terser; keyword is unambiguous vs a `name`. Lean:
   **bare string** (asset position is unambiguous in the grammar).
2. **Recipe ranking:** simple keyword/trigger match in the tool, or return all and let the
   model choose? Lean: return all + light keyword ranking (no model call in the server).
3. **Recipe authorship:** JSON (machine) vs Markdown-with-frontmatter (human-friendly,
   diffable). Lean: **JSON** generated *into* a Markdown reference doc.
4. **Do we also want a `wadi_furniture`/`wadi_recipes` equivalent in the file-authoring
   skill** (non-MCP), or is the generated reference doc enough there? Lean: reference doc
   only (the skill reads files).
5. Scope of the Phase-1 catalog doc: all ~50 items, or curated "starter" subset first?
