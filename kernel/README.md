# `@dslkit/kernel` — the domain-neutral DSL-software core

This directory is the **kernel** of the DSL-based-software framework that Wadi is
the reference instance of (`plans/primitive-componentization.md` §3). Its defining
property: **nothing here mentions a house, three.js, React, langium, or even zod.**
It is pure TypeScript. To build a *different* domain-specific DSL tool (a PCB
editor, a solar-farm planner), you keep this verbatim and swap only the domain
layer.

## What's in it

| Module | What it is |
|---|---|
| `fieldSchema.ts` | The **field engine**. A primitive declares its shape once as `fields` (data). Each field *projects* onto every surface: `fieldsToZodSource` (typed schema source), `fieldsToDocRows` (docs), `fieldToFormControl` (form). Two-tier so a new field *kind* is data (a preset), not an engine release. |
| `stageRunner.ts` | The **compositor runner**: `orderStages` (toposort with cycle/dup/unknown-dep guards) + `runStages` (fold over a shared context). A pure DAG runner — not an orchestration framework. |
| `index.ts` | Barrel re-export. |

## The boundary (and why it holds)

The kernel is consumed by the Wadi domain (`editor/`) through **thin re-export
shims** so no consumer import changed when the code moved here:

- `editor/src/registry/fieldSchema.ts` → `export * from kernel/fieldSchema` (plus
  the one *runtime* `fieldsToZod`, kept with its consumer so the kernel needs no
  zod dependency — production uses the `fieldsToZodSource` string emitter).
- `editor/src/pipeline/stageRunner.ts` → `export * from kernel/stageRunner`.

The **dependency direction is enforced**: `editor/src/registry/kernelBoundary.test.ts`
fails if any kernel file imports anything but other kernel files or node builtins —
so the kernel can never quietly grow a dependency on Wadi (or React/three/zod).

## Status

This is the kernel **boundary**, extracted and guarded. Promoting it to a
separately-published npm package with its own `node_modules` is a further step
(it needs workspace hoisting to keep a single `zod` instance across the app);
the boundary + guardrail here are what make the separation real and enforceable.
