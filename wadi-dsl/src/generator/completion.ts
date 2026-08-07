// Descriptor-driven completion for the generic `ObjectDecl` path (P3b, deferred →
// now done). The generic path has no bespoke grammar rule, so Langium's grammar
// completion can't suggest its field/type names; we derive them from the SAME
// `fields` descriptor manifest the compiler + validator use (./descriptors). Pure
// (no Monaco) so it's unit-testable; playground/lsp.ts maps the result to Monaco
// completion items.

import { getDescriptor, knownPrimitiveTypes } from "./descriptors.js";

/** The identifier owning the innermost still-open `{` before the cursor — i.e. the
 *  block the cursor sits in (a primitive type, `floor`, `component`, `room`, …). */
export function enclosingHeaderType(before: string): string | null {
  const opens: number[] = [];
  for (let i = 0; i < before.length; i++) {
    if (before[i] === "{") opens.push(i);
    else if (before[i] === "}") opens.pop();
  }
  const open = opens[opens.length - 1];
  if (open == null) return null;
  // First identifier of the statement that opened this brace (after the previous
  // `{` / `}` / `;` / newline boundary).
  const m = before.slice(0, open).match(/(?:^|[{};\n])\s*([A-Za-z_]\w*)[^{}\n]*$/);
  return m?.[1] ?? null;
}

export type GenericCompletion =
  | { kind: "field"; type: string; items: string[] }
  | { kind: "type"; items: string[] }
  | null;

/** What to suggest at the cursor, given the text before it on/above the line.
 *  - inside a primitive's own block → its not-yet-used field names
 *  - at a `floor`/`component` statement start → contributed primitive type names */
export function genericCompletionsAt(before: string): GenericCompletion {
  const enclosing = enclosingHeaderType(before);
  if (enclosing) {
    const desc = getDescriptor(enclosing);
    if (desc) {
      const used = new Set(
        [...before.matchAll(/(?:^|[{;\n])\s*([A-Za-z_]\w*)\s/g)].map((x) => x[1]),
      );
      const items = [...desc.fieldNames].filter((f) => f !== "name" && !used.has(f));
      return { kind: "field", type: enclosing, items };
    }
  }
  const atStatementStart = /[{}\n]\s*[A-Za-z_]*$/.test(before);
  if (atStatementStart && (enclosing === "floor" || enclosing === "component")) {
    return { kind: "type", items: knownPrimitiveTypes() };
  }
  return null;
}
