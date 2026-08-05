// Guard: every FIELD keyword in the grammar must appear in the WDL-editor's
// Reference panel (playground/reference.ts). That hand-written HTML is NOT
// generated from the grammar, so it silently drifts — `overhang_left`, then
// `slope_left`, were both added to the language and forgotten in the panel. This
// test enumerates the grammar's keywords straight from the compiled `WadiGrammar`
// and fails if a field keyword isn't documented, so adding a keyword forces a
// doc update (or an explicit exemption below).
//
// It only requires FIELD-MARKER keywords — a bare keyword that heads a property,
// e.g. `slope_left`, `width`, `overhang`. It does NOT require enum VALUE keywords
// (the right-hand side of an assignment: `north`, `flat`, `open`, `angle`, …),
// which the panel shows contextually as part of their field's syntax, not as
// their own entries. Field vs value is derived from the grammar itself: a keyword
// contained in some `Assignment`'s terminal is a value.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { AstUtils } from "langium";
import { WadiGrammar } from "../src/language/generated/grammar.js";

const here = dirname(fileURLToPath(import.meta.url));
const REFERENCE_TS = resolve(here, "../playground/reference.ts");

// Keywords intentionally NOT required in the quick-reference panel. Keep this
// tiny and justified — prefer documenting a keyword over exempting it.
const DOC_EXEMPT = new Set<string>([
  "null", // a formula/value literal (with true/false), not a house field
]);

const isKeywordToken = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z_][a-z0-9_]*$/i.test(v);

function collectKeywords(): { field: Set<string>; value: Set<string> } {
  const grammar = WadiGrammar();
  const all = new Set<string>();
  const value = new Set<string>();
  for (const node of AstUtils.streamAst(grammar)) {
    if (node.$type === "Keyword" && isKeywordToken(node.value)) all.add(node.value);
    // Keywords inside an assignment's terminal are VALUES (enum alternatives).
    if (node.$type === "Assignment" && node.terminal) {
      for (const t of AstUtils.streamAst(node.terminal)) {
        if (t.$type === "Keyword" && isKeywordToken(t.value)) value.add(t.value);
      }
    }
  }
  const field = new Set([...all].filter((k) => !value.has(k)));
  return { field, value };
}

// Word-boundary match (so `feet_inches` doesn't satisfy `feet`, and a keyword
// inside a longer identifier doesn't count).
const documentedIn = (kw: string, text: string): boolean =>
  new RegExp(`(^|[^a-z0-9_])${kw}([^a-z0-9_]|$)`, "i").test(text);

describe("Reference panel keeps up with the grammar", () => {
  const { field } = collectKeywords();
  const reference = readFileSync(REFERENCE_TS, "utf8");

  it("documents every field-marker keyword (or exempts it)", () => {
    const undocumented = [...field]
      .filter((k) => !DOC_EXEMPT.has(k) && !documentedIn(k, reference))
      .sort();
    expect(
      undocumented,
      `These grammar field keywords are missing from playground/reference.ts. ` +
        `Add them to the Reference panel, or (only for value literals) to DOC_EXEMPT:\n  ${undocumented.join(", ")}`,
    ).toEqual([]);
  });

  it("has no stale DOC_EXEMPT entries", () => {
    const stale = [...DOC_EXEMPT].filter((k) => !field.has(k)).sort();
    expect(stale, `DOC_EXEMPT lists keywords that are no longer grammar field keywords: ${stale.join(", ")}`).toEqual([]);
  });
});
