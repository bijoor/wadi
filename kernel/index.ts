// @dslkit/kernel — the domain-neutral core of the DSL-software framework
// (plans/primitive-componentization.md §3). Nothing here mentions houses, three.js,
// React, langium, or zod: it is pure TypeScript that any domain can build on.
//
//   • fieldSchema — the field engine: a primitive declares `fields` once; each
//     field projects to schema source, docs, and a form control.
//   • stageRunner — the compositor runner: a pure toposort-fold over a stage DAG.
//
// The Wadi domain (editor/) consumes this through thin re-export shims
// (registry/fieldSchema.ts, pipeline/stageRunner.ts). The dependency direction is
// enforced by the guardrail test (editor/src/registry/kernelBoundary.test.ts): the
// kernel must never import domain code.
export * from "./fieldSchema";
export * from "./stageRunner";
