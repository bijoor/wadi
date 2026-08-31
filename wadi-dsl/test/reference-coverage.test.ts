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
import { collectGrammarKeywords } from "../src/language/grammar-keywords.js";

const here = dirname(fileURLToPath(import.meta.url));
// The Reference cheat-sheet moved from the retired playground into the viewer's
// WDL editor (the 📖 button); it stays hand-written, so this guard still applies.
const REFERENCE_TS = resolve(here, "../../editor/src/viewer/wdlReference.ts");

// Keywords intentionally NOT required in the quick-reference panel. Keep this
// tiny and justified — prefer documenting a keyword over exempting it.
const DOC_EXEMPT = new Set<string>([
  "null", // a formula/value literal (with true/false), not a house field
]);

// Shared with the Monaco highlighter (playground/dsl-language.ts) so both stay
// in lockstep with the grammar.
const collectKeywords = collectGrammarKeywords;

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
      `These grammar field keywords are missing from editor/src/viewer/wdlReference.ts. ` +
        `Add them to the Reference panel, or (only for value literals) to DOC_EXEMPT:\n  ${undocumented.join(", ")}`,
    ).toEqual([]);
  });

  it("has no stale DOC_EXEMPT entries", () => {
    const stale = [...DOC_EXEMPT].filter((k) => !field.has(k)).sort();
    expect(stale, `DOC_EXEMPT lists keywords that are no longer grammar field keywords: ${stale.join(", ")}`).toEqual([]);
  });
});
