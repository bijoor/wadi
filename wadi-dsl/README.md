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

`examples/coastal.wadidsl` is a coastal Konkan cottage authored purely in the
DSL. `npm test` compiles it → resolves it with the **real** `param/resolve.ts`
→ validates it with the **real** `validate.mjs` (Zod schema + wall/roof geometry
pipeline). It passes. So the model is *fully representable* in the DSL, verified
by the actual Wadi engine rather than a parallel implementation.

One `.wadidsl` file exercises every construct:

- **parametric core** — `var`, `point`, a first-class `grid` with named
  centrelines + per-line `role`, the `configurator` (`slider` + `select`), and
  formulas (`main.x2 - main.x1`, `House.W / 2`, `(pillarW - wallT) / 2`);
- **domain vocabulary** — `floor`, `room` (`at (…) size (…)`), `wall` with
  `door`/`window` openings, `pillar`;
- the **`raw` escape** — `floor_slab`, `plinth`, `ground`, and the hip `roof`
  (nested segments/slope/trusses) expressed as literal JSON, so *nothing in the
  model is inexpressible* even before a primitive gets ergonomic sugar.

## Run it

```bash
npm install            # installs Langium + regenerates the parser (prepare hook)
npm test               # DSL → resolve → real schema+geometry pipeline (round-trip)

# Compile a .wadidsl to a .wadi (resolved, ready for the app / preview):
npm run gen -- examples/coastal.wadidsl /tmp/coastal.wadi
# Then render it with the skill's preview tool (from the repo root):
#   wadi-skill/architect/scripts/preview.sh /tmp/coastal.wadi
```

## How it maps to the pipeline

```
.wadidsl  ──parse──▶  Langium AST  ──generator──▶  HouseConfig JSON
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

`playground/` is a Monaco code editor that compiles `.wadidsl` **in the browser**
and drives the existing Wadi app (in a same-origin iframe) to render the model —
edit the code, the house rebuilds. No second renderer, and the app is used purely
as a viewer.

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

## Desktop live-watch (edit in VS Code → the Tauri app updates)

For a demo with a *real* editor and native rendering (no iframe/rAF quirks), use
`watch`: it recompiles the `.wadidsl` to a `.wadi` on every save, and the Wadi
desktop app — watching that file — live-reloads. The same file-watch loop the AI
architect skill uses, so the code editor (VS Code, or anything) is fully separate
from the renderer.

```bash
npm run watch -- examples/coastal.wadidsl /tmp/house.wadi
```

Then in the Wadi **desktop app**: `Load → /tmp/house.wadi`. Edit
`examples/coastal.wadidsl` in VS Code and hit save — the 3D model rebuilds. (The
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

- **Coverage.** The core tier is complete. In the domain tier, `room`, `wall`,
  `opening`, and `pillar` have ergonomic first-class syntax; every other
  primitive (roof, staircase, kitchen_platform, beam, item, component instance,
  …) is expressible today via the `raw` escape, and each is a mechanical ~10-line
  addition to promote to first-class syntax. `component` definitions/instances
  are the next core-tier rule to add.
- **References are textual, not yet linked.** `main.x1`, `bay`, `House.W` parse
  as dotted refs and serialize correctly, but are not yet Langium cross-
  references. Promoting them to `[GridLine]` / `[Var]` cross-references (with a
  scope provider) is what unlocks the LSP wins — go-to-def, find-refs, rename,
  and author-time "unknown grid line" errors. That's the natural next phase.
- **Sugar-that-lowers** (`enabled when roof_style == 3` → the branch-free
  arithmetic `1 - min(1, abs(roof_style - 3))`, unit literals, named enums) is
  designed-for but not yet implemented.
