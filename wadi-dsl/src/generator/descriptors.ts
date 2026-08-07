// The kernel SEAM: the primitive descriptors (each primitive's declarative
// `fields`) drive a SECOND surface here — the DSL — beyond the editor that owns
// them. This is the first cross-surface use of the descriptor manifest and the
// concrete step toward a domain-neutral `@dslkit/kernel` (plans/primitive-
// componentization.md §3): the generic `ObjectDecl` path (compile + validation +,
// later, completion) reads field NAMES + ORDER from here, per primitive, with no
// per-type code. Fields live in editor/src/schema/fields/* (pure TS, no React) —
// the same layer gen-primitives + the data-model doc read.

import { PRIMITIVE_FIELD_DECLS } from "../../../editor/src/schema/fields/index";

export interface PrimitiveDescriptor {
  type: string;
  /** Field names in POSITIONAL order — what `type name (a, b, …)` maps onto.
   *  Excludes `name` (that is the NameRef slot, not a positional argument). */
  positional: string[];
  /** Every valid field name, for unknown-field validation. */
  fieldNames: Set<string>;
}

function build(
  decls: readonly { type: string; fields: readonly { name: string }[] }[],
): Map<string, PrimitiveDescriptor> {
  const m = new Map<string, PrimitiveDescriptor>();
  for (const d of decls) {
    const names = d.fields.map((f) => f.name);
    m.set(d.type, {
      type: d.type,
      positional: names.filter((n) => n !== "name"),
      fieldNames: new Set(names),
    });
  }
  return m;
}

// The production descriptor set: every codegen'd primitive. (Today these are all
// keyword-sugared types that route to bespoke grammar rules, so the generic path
// sees them only once a NON-keyword primitive — e.g. spiral_staircase, P5 — is
// registered; the machinery is ready for it.)
const DEFAULT = build(PRIMITIVE_FIELD_DECLS);
let active = DEFAULT;

export const getDescriptor = (type: string): PrimitiveDescriptor | undefined => active.get(type);
export const knownPrimitiveTypes = (): string[] => [...active.keys()];

// ---- test seam ------------------------------------------------------------
// Swap the descriptor set — used by tests to inject a synthetic non-keyword
// primitive so the generic path is exercised without touching the real schema.
export function __setDescriptors(map: Map<string, PrimitiveDescriptor>): void {
  active = map;
}
export function __resetDescriptors(): void {
  active = DEFAULT;
}
export function makeDescriptor(type: string, positional: string[]): PrimitiveDescriptor {
  return { type, positional, fieldNames: new Set([...positional, "name"]) };
}
