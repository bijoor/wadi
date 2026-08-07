// @dslkit/kernel — the composition runner (plans/primitive-componentization.md
// §2.5c). Domain-neutral: no imports at all.
//
// A compositor is a PURE, deterministic DAG of stages: each stage is a pure
// function of the accumulated context and returns additions to merge. This runner
// topologically orders stages by `dependsOn` and folds them over a shared context.
// It GENERALISES resolveParametric's toposort from "variables" to "stages".
//
// This is the WHOLE thing — deliberately ~a page, not an orchestration framework.
// Airflow/Temporal/etc. solve distributed, scheduled, stateful, retryable task
// orchestration; we need synchronous pure dataflow that runs on every edit, stays
// headless, and preserves byte-parity. Keep stages pure + dependency-declaring so
// incremental recompute (memoization) can bolt on later with no redesign.

/** A pure composition step. `run` reads the accumulated ctx and returns additions
 *  to fold in (or nothing for a read-only / assertion stage). */
export interface Stage<Ctx extends object> {
  id: string;
  /** Stage ids that must run before this one (a DAG edge). */
  dependsOn?: readonly string[];
  run(ctx: Readonly<Ctx>): Partial<Ctx> | void;
}

/** Topologically order stages by `dependsOn`. Deterministic (respects input order
 *  among independent stages). Throws on a cycle or an unknown dependency. */
export function orderStages<Ctx extends object>(stages: readonly Stage<Ctx>[]): Stage<Ctx>[] {
  const byId = new Map<string, Stage<Ctx>>();
  for (const s of stages) {
    if (byId.has(s.id)) throw new Error(`duplicate stage id "${s.id}"`);
    byId.set(s.id, s);
  }
  const state = new Map<string, "visiting" | "done">();
  const out: Stage<Ctx>[] = [];
  const visit = (s: Stage<Ctx>, chain: readonly string[]): void => {
    const st = state.get(s.id);
    if (st === "done") return;
    if (st === "visiting") throw new Error(`stage cycle: ${[...chain, s.id].join(" → ")}`);
    state.set(s.id, "visiting");
    for (const dep of s.dependsOn ?? []) {
      const d = byId.get(dep);
      if (!d) throw new Error(`stage "${s.id}" depends on unknown stage "${dep}"`);
      visit(d, [...chain, s.id]);
    }
    state.set(s.id, "done");
    out.push(s);
  };
  for (const s of stages) visit(s, []);
  return out;
}

/** Run stages in dependency order, folding each stage's output into a shared
 *  context (the "blackboard"). Returns the final context. Pure. */
export function runStages<Ctx extends object>(stages: readonly Stage<Ctx>[], seed: Ctx): Ctx {
  let ctx = seed;
  for (const s of orderStages(stages)) {
    const patch = s.run(ctx);
    if (patch) ctx = { ...ctx, ...patch };
  }
  return ctx;
}
