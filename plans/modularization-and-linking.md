# Proper modularization & linking — a framework capability

**Status: SHIPPED ✅ (Path B, commit `1bb454a`).** The Wadi DSL compiler now
resolves `use`/`item` as real Langium cross-references via a `WadiScopeProvider`
over the imported-module documents (`wadi-dsl/src/language/wadi-scope.ts`), fed by
a sync `linkProject` loader in `toHouseConfig.ts`. Nested + transitive + cross-
library components work; output is **byte-identical** to the prior hand-rolled
linker on every example (parity-gated). Key realisation vs the plan below: a
self-contained ScopeProvider (reads imported ASTs straight from `LangiumDocuments`)
resolves references **lazily and synchronously** on `.ref` access, so **no async
`DocumentBuilder.build` is needed** and `compileDsl` kept its signature — the async
ripple the plan worried about (§7/§8) never materialised. Assets are cross-refs
too. Still open: the **LSP editor layer** (go-to-def / rename / find-references in
the WDL editor) — the linking substrate is in place, but wiring the Langium LSP
into the Monaco playground is a separate increment.

**History below** was the exploration/design (Path A vs B, the spike). Retained
for the rationale.

---

**Original status:** exploration / design (not started). Keep the current one-level
module system running; this is about the *right* long-term shape.

**Why this matters beyond Wadi.** The real product is a **framework for building
domain DSLs** — a Langium grammar + a custom execution engine — that a domain
expert drives with a coding agent. **Modularization and reuse ("author once,
reuse everywhere") is one of the framework's core value propositions, not a Wadi
feature.** So the module/linking layer should be designed as a *domain-neutral,
reusable capability* that every DSL built on the framework inherits — the same way
the formula engine and the resolver already are. For Wadi specifically we can live
with the current limits (in-file components, flat libraries); the point of this doc
is to design the general mechanism properly.

---

## 1. Where a module system sits in the method

`PARAMETRIC-DSL-METHOD.md` splits every DSL into a **domain-neutral core** and a
**domain vocabulary**. A module system is squarely in the *core*:

| Layer | Job | Domain-neutral? |
|---|---|---|
| Formula engine | evaluate `+ - * / min…` over named vars | ✅ reusable |
| Resolver | topological formula resolution, cycle-safe | ✅ reusable |
| **Module/linking** | **resolve names across files + namespaces; inline defs** | ✅ **should be reusable** |
| Vocabulary (grammar) | `room`, `wall`, `roof`… (or `panel`, `inverter`…) | ❌ per-domain |
| Execution engine | expand + render (house → GLB; farm → layout) | ❌ per-domain |

Reference resolution operates purely on **names, namespaces, and imports** — it
doesn't care whether a definition is a `room` or a `solar-string`. So a single,
well-built linker serves every domain DSL; each domain only declares *which of its
declaration types are importable/reusable*.

That reframes "nested components for Wadi" into: **build the framework's module
system once, correctly.**

---

## 2. Current state (what we have)

- Wadi uses Langium as a **pure parser**: `LangiumParser.parse(text)` → AST.
  `WadiModule = {}` — **no ScopeProvider, no Linker, no IndexManager, no document
  build**. References (`use ns.Comp`, `item f."id"`, `import "x"`) are plain
  `ID`/`STRING` properties, not Langium cross-references.
- All resolution is **manual**, in the generator (`toHouseConfig.ts`): a custom
  `resolveModule(ref) => text` callback returns a module's source, which is
  **re-parsed** and its **top-level** exports indexed into `ASSET_INDEX` /
  `NS_ASSET_INDEX` / component maps — a **one-level inliner** built against the
  **host file's** single global scope.
- **Consequence (the limitation):** a reference *inside* an imported module's
  component body is resolved in the *host's* scope, not the module's. So a library
  component that `use`s another component, or references `f."id"` via the module's
  own import, fails — the host never sees the module's private names/aliases.
  (Empirically: nested `use` is silently dropped; nested asset alias errors
  "no import aliased f".)

**What works well and must keep working:** in-file components (incl. nesting),
flat libraries, in-file composition of imported parts, the pluggable
`resolveModule` text callback that runs identically in browser / MCP / CLI, and
the **flatten-to-JSON** compile contract the execution engine consumes.

---

## 3. What "proper" modularization requires (domain-neutral checklist)

1. **Scoped resolution** — resolve each module's references in *its own* scope
   (its imports + local decls), not the importer's.
2. **Transitive imports** — importing A pulls in B (A's dependency) recursively;
   imports form a **graph** to walk, not a flat list.
3. **Name hygiene / relocation** — when many modules inline into one output,
   local names collide (two modules define `Leg`, both alias `f`). Rename to
   collision-free global keys and rewrite internal refs to match.
4. **Cycle detection** — reject `A→B→A` (and component cycles) instead of looping.
5. **N symbol kinds, uniformly** — components, assets, and *generically any*
   "named, exportable declaration" a domain marks reusable. One mechanism, not a
   copy per kind.
6. **Great errors + editor affordances** — dangling-ref detection, and (the agent
   value-add) **go-to-definition, find-references, rename across files**.
7. **Runs everywhere** — browser (playground), headless (MCP), CLI — no OS/FS
   assumptions; keep the `resolveModule(ref) => text` seam.
8. **Preserve the flatten-to-JSON contract** — the execution engine still receives
   one resolved, low-level document.

---

## 4. Two architectural paths

### Path A — extend the hand-written inliner

Add a linking pre-pass to `linkModules`: recursively resolve imports, carry each
module's private scope, and **qualify every intra-module reference** to a
`ns.`-prefixed global key before emitting; detect cycles.

- **+** Contained; keeps the lightweight text-resolver; no new Langium surface.
- **+** Ships fast; low risk to the current pipeline.
- **−** Bespoke to Wadi's generator — **doesn't generalize**; every future domain
  DSL re-implements its own linker.
- **−** No editor navigation (still just strings, not resolved references).
- **−** We'd be re-building, by hand, machinery Langium already ships.

### Path B — adopt Langium's scoping / linking

Model the references as real Langium **cross-references** and let the framework's
linker resolve them:

- Grammar: `use=[ComponentDef:QualifiedName]`, `asset=[AssetDecl:QualifiedName]`,
  imports as reference-bearing decls.
- A custom **`ScopeProvider` + `ScopeComputation`** encodes visibility (what an
  `import "…" as ns` exposes, qualified names, in-file-shadows-imported). **This is
  the reusable core piece** — parameterized by "which decl types are exportable."
- **Cross-document** via `IndexManager` + `DocumentBuilder`: register each
  imported module as an **in-memory `LangiumDocument`**, its text supplied by the
  *same* `resolveModule(ref) => text` seam. Langium then links across documents.
- The generator walks a **fully-linked AST** (refs already point to target nodes);
  expansion follows resolved references and inlines with deterministic relocation.
  No `ASSET_INDEX` bookkeeping.

- **+** The module system becomes a **domain-neutral framework service** every DSL
  inherits — directly serves the generalization goal.
- **+** Transitivity, scoping, cycles, hygiene are the linker's job, on
  well-trodden Langium patterns (its `domainmodel` example is the template).
- **+** Free editor wins: go-to-def / find-refs / rename / dangling-ref validation
  across files — high leverage for agent-assisted authoring.
- **−** Real migration: Wadi currently **skips** the document/build layer
  (`parse()` only). Path B introduces `LangiumDocumentFactory.fromString` +
  `DocumentBuilder.build`, cross-refs in the grammar, and the ScopeProvider.
- **−** Must re-validate that browser + headless still behave (Langium runs in the
  browser with `EmptyFileSystem` + in-memory docs, so feasible — but to prove).
- **−** The generator is rewritten to consume a linked AST rather than re-parsing.

---

## 5. Recommendation

**Given the goal is the framework (not just Wadi), invest in Path B — a proper,
reusable module/linking layer — and treat Path A only as a tactical fallback if a
Wadi-specific unblock is ever urgent (it isn't today).**

Rationale: modularization is a headline value proposition of the framework, and a
module system belongs in the **domain-neutral core**. Path A produces Wadi
plumbing that the next domain can't reuse; Path B produces a **capability every DSL
inherits**, on the exact substrate the framework already stands on (Langium). The
editor-navigation dividend (cross-file go-to-def / rename) compounds the
agent-authoring story that is the whole thesis.

The cost is real but bounded and *additive* — it does not require touching the
execution engine or the JSON contract.

---

## 6. Concrete shape of Path B

- **Grammar:** introduce a `QualifiedName` datatype rule and convert
  `use`/`item`/`import` targets to cross-references. In-file + imported decls unify
  under one name space per kind.
- **Reusable `ScopeProvider` (the core deliverable):** parameterized by a small
  per-DSL descriptor — "these declaration types are exportable; imports use
  `as ns`; qualified names look like `ns.Name`." Everything else (visibility,
  shadowing, transitivity) is generic. This is the artifact other domains reuse.
- **Documents from the seam:** an adapter that, on an unresolved import, calls
  `resolveModule(ref)`, wraps the text as an in-memory `LangiumDocument`, and hands
  it to `DocumentBuilder` — so browser / MCP / CLI keep their one text callback.
- **Linked-AST generator:** the domain engine's front-end walks resolved
  references; `expandComponent` follows a *node* (already the right definition in
  the right scope) and inlines with a deterministic `ns$Name` relocation, guarded
  by a cycle check on the import/definition graph.
- **Split of concerns:** `core/` (Langium module system: QualifiedName scoping,
  document adapter, cycle guard, relocation) is **reusable across domains**; only
  the *list of exportable decl types* and the *engine front-end* are Wadi's.

---

## 7. Keep-current-running / migration

Non-negotiable: the shipped one-level path stays green throughout.

1. Build Path B behind the existing `compileDsl` entry (or a sibling), gated so the
   old inliner remains the default until parity holds.
2. **Parity gate:** every `examples/*.wdl`, both templates, and the atale round-trip
   must compile to byte-identical resolved geometry under the new linker before it
   becomes default.
3. Add nesting/transitive/cycle test fixtures that the old path *couldn't* pass.
4. Flip the default; keep the old path one release as a fallback, then remove.

No grammar-breaking changes for existing files: cross-references are the same
surface syntax (`use ns.Comp`, `item ns."id"`), just resolved by the linker instead
of by hand.

---

## 8. Risks & open questions

- **Browser cost/perf** of the DocumentBuilder pipeline vs. the current single
  `parse()` — measure on a real multi-module design.
- **`resolveModule` → document identity:** stable URIs for in-memory modules;
  cache/invalidation when a module's text changes (desktop watch, editor edits).
- **Diamond imports / same alias in two modules** — validate the ScopeProvider
  keeps them distinct (the relocation must be per-module, not per-alias).
- **Engine contract:** confirm the execution engine only ever wants the flattened
  JSON (it does today) — if a future domain wants the linked AST, expose it, but
  don't couple the linker to any one engine.
- **Qualified-name ergonomics** for agents: how deep do names get (`a.b.c.Name`)?
  Keep it shallow; prefer re-export over deep chains.

---

## 9. Recommended next step — a decisive spike

Prove the risky 20% before committing:

> Model **one** cross-reference — `use` → `[ComponentDef]` — as a Langium
> cross-reference; add a minimal `ScopeProvider` + a `resolveModule`-backed
> in-memory document adapter; drive it through `DocumentBuilder.build`. Show a
> **library component that `use`s a sibling library component** resolves and
> expands (the case that fails today), in **both** the browser playground and the
> headless test harness, and measure the added compile time.

If the spike is clean, generalize the ScopeProvider to assets + imports and write
the parity gate. If browser cost or document plumbing bites, fall back to Path A as
the tactical unblock while rethinking B.

---

## 10. Spike result — PASSED ✅ (`wadi-dsl/spike/langium-linking/`)

The §9 spike was built and run headless. A ~15-line minimal Langium grammar
(`import`, `component`, `use=[Component:QualifiedName]`), a **~15-line custom
`ScopeProvider`** (local components by bare name + each `import "x" as ns`'s
exported components as `ns.Name` from the global index), and a **~25-line loader**
(the `resolveModule`-style `{name→text}` map → in-memory `LangiumDocument`s →
`DocumentBuilder.build`) resolve **every** case the current inliner can't:

| Case | Result |
|---|---|
| Cross-module namespaced `use l.A` | ✅ resolved to lib's `A` |
| **Library component `use`s a sibling** (`A → B` inside lib) — fails today | ✅ resolved |
| **Transitive `main → modA → modB`** — modA's own `b` alias, resolved in modA's scope | ✅ resolved |
| Dangling `use l.Nope` | ✅ 1 linking error (dangling detection works) |
| Headless build (EmptyFileSystem = the browser config), 2–3 modules | ✅ **~14 ms** |

**Takeaways:**

- Langium's linker + a custom `ScopeProvider` + `resolveModule`-backed in-memory
  documents handle scoped resolution, transitive imports, and dangling-ref
  detection **out of the box** — the four hard sub-problems of §3 are the linker's
  job, not ours. The only bespoke code is the visibility policy (the ScopeProvider),
  which is small and **domain-neutral** (parameterised by "the exportable decl
  type").
- **Browser confirmed.** The identical services (on `EmptyFileSystem`) were
  bundled by **Vite** — the playground's bundler — and run **client-side**: all
  four cases resolved in ~23 ms in the browser (`spike/langium-linking/browser/`).
  So there's no Node-only dependency in the linking path; it ships to the web app
  unchanged.
- Cost is negligible at this scale (~14 ms); measure on a real multi-module Wadi
  design during the port.

**Recommendation firmed:** proceed with **Path B**. The remaining work is a port,
not research: (1) add cross-references (`use`/`item`/`import`) to `wadi.langium`;
(2) generalise the ScopeProvider to two decl kinds (components + assets) with
in-file-shadows-imported; (3) switch `compileDsl`'s front-end from
`LangiumParser.parse` to `DocumentFactory.fromString` + `DocumentBuilder.build`,
feeding modules from the existing `resolveModule` seam; (4) rework the generator to
walk the linked AST and inline via deterministic `ns$Name` relocation with a cycle
guard; (5) parity-gate on every example + template + the atale round-trip before
flipping the default. Name mangling/relocation is now the only remaining
design-y bit; everything else is wiring Langium services Wadi already depends on.

Relates to: `plans/libraries-and-imports.md` (Phase 3), `PARAMETRIC-DSL-METHOD.md`
(the domain-neutral core), `wadi-dsl/COMPONENTS-AND-LIBRARIES.md` (current limits).
