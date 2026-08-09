// Render the conventions reference doc from the constraint registry.
//
// Pure + shared by the generator script (editor/scripts/gen-conventions-doc.mjs)
// and the lockstep test (conventions-doc.test.ts), so the committed
// wadi-skill/architect/reference/conventions.md can never drift from the code —
// the same anti-drift pattern used for reference/data-model.md.

import type { Constraint } from "./types";

/** Placeholder in the preamble where the generated `## Cn` sections are injected. */
export const CONSTRAINTS_MARKER = "<!-- GENERATED:CONSTRAINTS -->";

function levelWord(level: string): string {
  return level === "error" ? "error" : "warning";
}

/** One `## Cn` section from a constraint's metadata + doc. */
export function renderConstraintSection(c: Constraint): string {
  return (
    `## ${c.id} — ${c.title} · **${levelWord(c.level)}**\n\n` +
    `**Statement.** ${c.doc.statement}\n\n` +
    `**Rationale.** ${c.doc.rationale}\n\n` +
    `**Fix.**\n\n${c.doc.fix}`
  );
}

/** The full doc: the hand-authored preamble with the marker replaced by the sections. */
export function renderConventionsDoc(constraints: Constraint[], preamble: string): string {
  if (!preamble.includes(CONSTRAINTS_MARKER)) {
    throw new Error(`preamble is missing the ${CONSTRAINTS_MARKER} marker`);
  }
  const body = constraints.map(renderConstraintSection).join("\n\n---\n\n");
  return preamble.replace(CONSTRAINTS_MARKER, body);
}
