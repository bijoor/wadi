# wadi-dsl — the parametric house model as a formal DSL

A [Langium](https://langium.org) grammar that expresses the **complete Wadi
parametric house model** as a textual domain-specific language, then compiles it
back to the canonical `.wadi` JSON so it drives the **real** Wadi pipeline
(schema validation → formula resolution → 2D/3D rendering).

This package is a **demonstration**, not a productivity tool. Wadi's JSON + Zod
schema is already enough for coding agents. The point here is to prove that the
*generalizable method* in [`../PARAMETRIC-DSL-METHOD.md`](../PARAMETRIC-DSL-METHOD.md)
— "a parametric domain model can be formalized as a grammar, so a domain expert
can author reusable designs with a coding agent" — actually holds, using home
architecture as the worked example.

## The thesis: a two-tier grammar

The grammar ([`src/language/wadi.langium`](src/language/wadi.langium)) is written
in two tiers, split by a banner:

```
┌─ PARAMETRIC CORE  (domain-NEUTRAL) ──────────────────────────────┐
│  var · point · grid+lines · formula-expression sublanguage       │
│  · configurator (control knobs) · raw JSON escape                │
│  → reuse this tier VERBATIM to formalize another domain          │
├─ WADI VOCABULARY  (the domain layer) ────────────────────────────┤
│  house · floor · room · wall · opening · pillar                  │
│  → rewrite ONLY this tier to retarget the method                 │
└──────────────────────────────────────────────────────────────────┘
```

That split is the entire generalization claim, made executable: the reusable
asset is the **method (the core tier)**, not the house vocabulary.

## What it proves

`examples/coastal.wdl` is a coastal Konkan cottage authored purely in the
DSL. `npm test` compiles it → resolves it with the **real** `param/resolve.ts`
→ validates it with the **real** `validate.mjs` (Zod schema + wall/roof geometry
pipeline). It passes. So the model is *fully representable* in the DSL, verified
by the actual Wadi engine rather than a parallel implementation.

One `.wdl` file exercises every construct:

- **parametric core** — `var`, `point`, a first-class `grid` with named
  centrelines + per-line `role`, the `configurator` (`slider` + `select`), and
  formulas (`main.x2 - main.x1`, `House.W / 2`, `(pillarW - wallT) / 2`);
- **domain vocabulary — every object type is first-class** (no `raw` needed):
  `ground`, `plinth`, `floor_slab`, `beam`, `room` (with `wall`/`door`/`window`
  openings + anchored `item`s), free-standing `wall`, `pillar`, `staircase`,
  `kitchen`, `item` (furniture), `component` (library `def` + `use` instance),
  and the `roof` (flat / shed / gable / hip via `roof_type` + per-segment
  endpoints, with nested `segment`/`slope`/`truss`);
- a shared **attribute tail** on every object — `z_offset`, `layer`, `material`,
  and `enabled <expr>` (the on/off gate, e.g. `enabled 1 - min(1, abs(roof_style - 3))`).

## Samples (`examples/*.wdl`)

| File | What it shows |
|------|---------------|
| `minimal.wdl` | the smallest valid house — one floor, one room + a door/window |
| `two_room.wdl` | two rooms with **no grid** — explicit centrelines that abut on a shared wall |
| `two_story.wdl` | **multi-floor** (plinth + 2 storeys + hip roof), grid-driven, with a first-class staircase + roof |
| `coastal.wdl` | grid + configurator + a full cottage (ground/plinth/slab/rooms/pillars/roof) — the round-trip fixture |
| `complete.wdl` | **coverage showcase** — every object type first-class (beam, wall, kitchen, item, `component` def+use, gable roof, layers), no `raw` |
| `errors.wdl` | intentionally **broken** — for testing the error path (playground squiggles; watch keeps the last-good `.wadi`) |

Every valid sample is asserted through the real schema + geometry pipeline in
`test/roundtrip.test.ts`.

## Components & libraries — reuse

Two layers of reuse, both first-class in the grammar:

- **Component** — a named parametric *mini-house* (a stair, verandah, bench…) in
  local coords, stamped onto a floor with `use`:

  ```wdl
  component Stairwell goal "climb to the next floor" {
    param rise = 116
    staircase name "Stair" at (0, 0) step (7, 11, 44) direction south total_height rise
  }
  floor 2 "First" { use Stairwell at (208, 64) with { rise = 116 } }   // overrides use `=`
  ```

- **Library** — a `.wdl` file of `component` / `asset` declarations (no `house`
  needed) that another file `import`s:

  ```wdl
  import "konkan/base" as kb       // a module (bundled, or one of yours)
  floor 1 "G" { use kb.Verandah at (20, 20) with { across = 240 } }
  ```

  Components **nest**: a library component may `use` a sibling, `use` a component
  from a library it itself `import`s, and place `item` furniture from its own
  imports — imports resolve **transitively** (cycles are a compile error).

In the **WDL editor**, the **📚 Library** menu keeps a *cache of loaded libraries*
that `import` resolves from — the same on web and desktop. Load one by **Save
current as library**, **Load library file** (multi-select), or (desktop) by simply
dropping a `.wdl` beside your open file (or in a `modules/` subfolder — importable
by basename). Resolution order: **your cache → bundled packs**
(`std-furniture`, `konkan/base`). If a house imports something uncached, the editor
names exactly which libraries to load.

**Full guide:** [`COMPONENTS-AND-LIBRARIES.md`](COMPONENTS-AND-LIBRARIES.md).

## Run it

```bash
npm install            # installs Langium + regenerates the parser (prepare hook)
npm test               # DSL → resolve → real schema+geometry pipeline (round-trip)

# Compile a .wdl to a .wadi (resolved, ready for the app / preview):
npm run gen -- examples/coastal.wdl /tmp/coastal.wadi
# Then render it with the skill's preview tool (from the repo root):
#   wadi-skill/architect/scripts/preview.sh /tmp/coastal.wadi
```

## How it maps to the pipeline

```
.wdl  ──parse──▶  Langium AST  ──generator──▶  HouseConfig JSON
                                                       │ resolveParametric (real)
                                                       ▼
                                            resolved .wadi  ──▶  validate + render
```

- `src/language/wadi.langium` — the grammar (two tiers).
- `src/generator/toHouseConfig.ts` — AST → `HouseConfig`. Formula expressions
  serialize back to the `"= …"` strings the runtime resolver reads; grid-driven
  geometry fields get a placeholder number + a `formulas` entry, exactly as the
  app stores them.
- `src/cli/main.ts` — compile + resolve + emit.
- `test/roundtrip.test.ts` — the proof.

## The playground — a live code editor for the model

`playground/` is a Monaco code editor that compiles `.wdl` **in the browser**
and drives the existing Wadi app (in a same-origin iframe) to render the model —
edit the code, the house rebuilds. No second renderer, and the app is used purely
as a viewer. The toolbar has a **sample picker**, **Open** / **Save .wdl**,
**⬇ .wadi** (download the compiled model), and a **📖 Reference** panel — a DSL
cheat-sheet (keywords, first-class objects, and the `raw`-type field names).

```bash
npm run build:playground     # → docs/dsl (deploys at wadi.house/dsl)
# then serve docs/ and open /dsl, or:
npm run dev:playground
```

How it loads the model into the app, using the app's OWN paths:

- **first render** → the iframe boots at `/app/?panels=off&load=<blob url>`. The
  `?load` startup option (added to the app) loads a house directly and skips the
  picker — a first-class "open an existing house" entry point
  (`?load=<url>` deep-links to any config; bare `?load` is embed mode: skip the
  picker and await a programmatic load).
- **every edit after that** → `window.wadi.load(config)` updates the model
  in place (no reload).

`src/generator/toHouseConfig.ts` exposes `compileWithDiagnostics(text)` — a
never-throws compile returning the `HouseConfig` plus Monaco-shaped error markers.
`playground/dsl-language.ts` is a Monarch tokenizer for highlighting (Phase 2
would swap it for the real Langium language server in a Web Worker, so
highlighting + completion come from the grammar itself).

## Desktop DSL editor (native, offline — the playground in the Wadi app)

The Wadi **desktop app** ships the playground as a native window: **Window → DSL
Editor** (`⌘⇧D`). It's the same Monaco editor + live renderer side by side, but
running fully offline inside the app — no dev server, no VS Code, no `watch`
loop. Edit the `.wdl` on the left and the 3D model rebuilds on the right in
place. Everything it needs (the compiler, templates, furniture GLBs) is bundled,
so it works with no network.

Under the hood it's the exact same `docs/dsl` build the browser serves; the
desktop app just opens it in its own `WebviewWindow` (see `src-tauri/src/lib.rs`
`open_dsl_editor`), and it drives the app renderer through the same same-origin
iframe + `window.wadi.load()` path.

## Desktop live-watch (edit in VS Code → the Tauri app updates)

If you'd rather keep your own editor, `watch` recompiles the `.wdl` to a `.wadi`
on every save, and the Wadi desktop app — watching that file — live-reloads. The
same file-watch loop the AI architect skill uses, so the code editor (VS Code, or
anything) is fully separate from the renderer.

```bash
npm run watch -- examples/coastal.wdl /tmp/house.wadi
```

Then in the Wadi **desktop app**: `Load → /tmp/house.wadi`. Edit
`examples/coastal.wdl` in VS Code and hit save — the 3D model rebuilds. (The
output is fully resolved, so the app renders it directly; a compile error keeps
the last-good `.wadi` on disk so the model never blanks.)

## Other render paths

- **`?load=<url>`** — deep-link the web app straight to any hosted `.wadi`
  (`/app/?load=https://…/house.wadi`), skipping the picker.
- **`#w1=…` share link** — the app's zero-backend "open a house from a URL".

## Retargeting to another domain (the payoff)

To formalize, say, a solar-PV farm with the same method:

1. Keep the **PARAMETRIC CORE** section unchanged (var/point/grid/formula/
   configurator/raw).
2. Replace the **WADI VOCABULARY** section with `field`, `table`, `inverter`,
   `block` rules.
3. Point the generator at that domain's JSON model + validator.

Everything above the divider — the degrees of freedom, the grid scaffold, the
formula language, the control knobs — transfers without change.

## Scope / honest notes

This is a spike sized to *prove representability*, not a production front-end:

- **Coverage.** Complete. Both tiers are done: the core tier (var/point/grid/
  formula/configurator/raw) and the domain tier — **all 14 object types** in the
  model's discriminated union have ergonomic first-class syntax (ground, plinth,
  floor_slab, beam, room, wall, pillar, staircase, kitchen_platform, item,
  component, roof; `door`/`window` are authored as first-class room/wall
  `opening`s, the model's canonical form). The `components` library and per-house
  `layers` are first-class too. `raw` remains only as a deliberate escape hatch;
  no shipped example uses it (`complete.wdl` asserts this).
- **References are textual, not yet linked.** `main.x1`, `bay`, `House.W` parse
  as dotted refs and serialize correctly, but are not yet Langium cross-
  references. Promoting them to `[GridLine]` / `[Var]` cross-references (with a
  scope provider) is what unlocks the LSP wins — go-to-def, find-refs, rename,
  and author-time "unknown grid line" errors. That's the natural next phase.
- **Sugar-that-lowers** (`enabled when roof_style == 3` → the branch-free
  arithmetic `1 - min(1, abs(roof_style - 3))`, unit literals, named enums) is
  designed-for but not yet implemented.
