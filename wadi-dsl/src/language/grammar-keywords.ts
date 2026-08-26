// Enumerate the grammar's keyword literals straight from the compiled grammar,
// split into FIELD markers (block openers / section words / property keys like
// `guides`, `connect`, `room`, `slope_left`) and VALUE keywords (enum
// alternatives on the RIGHT of an assignment: `north`, `flat`, `open`, …).
//
// Single source of truth so the Monaco highlighter (playground/dsl-language.ts)
// and the reference-coverage test stay in lockstep with the grammar and NEVER
// drift — adding a keyword to wadi.langium is enough for it to highlight.

import { AstUtils } from "langium";
import { WadiGrammar } from "./generated/grammar.js";

const isKeywordToken = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z_][a-z0-9_]*$/i.test(v);

export function collectGrammarKeywords(): { field: Set<string>; value: Set<string> } {
  const all = new Set<string>();
  const value = new Set<string>();
  const addValues = (root: unknown) => {
    for (const t of AstUtils.streamAst(root as Parameters<typeof AstUtils.streamAst>[0])) {
      const tt = t as { $type: string; value?: unknown };
      if (tt.$type === "Keyword" && isKeywordToken(tt.value)) value.add(tt.value);
    }
  };
  for (const node of AstUtils.streamAst(WadiGrammar())) {
    const n = node as { $type: string; value?: unknown; terminal?: unknown; dataType?: unknown };
    if (n.$type === "Keyword" && isKeywordToken(n.value)) all.add(n.value);
    // A keyword is a VALUE (enum alternative), not a field marker, when it is:
    //   • the terminal of an assignment (inline, e.g. kind=('door'|'window')), or
    //   • inside a datatype rule that returns a primitive (e.g.
    //     `Side returns string: 'north' | …` / `OpeningAnchor: 'start' | …`).
    if (n.$type === "Assignment" && n.terminal) addValues(n.terminal);
    if (n.$type === "ParserRule" && typeof n.dataType === "string") addValues(node);
  }
  const field = new Set([...all].filter((k) => !value.has(k)));
  return { field, value };
}
