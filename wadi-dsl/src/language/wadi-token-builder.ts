// The token builder that makes field keywords SOFT (see soft-keywords.ts). It
// categorises every derived soft keyword's token as also-`ID`, so Chevrotain
// accepts it wherever a rule expects `ID` (a generic field key, an identifier),
// while it still matches as the keyword where a rule expects that keyword.

import { DefaultTokenBuilder, AstUtils } from "langium";
import type { GrammarAST, TokenBuilderOptions } from "langium";
import type { Stream } from "langium";
import type { TokenType } from "chevrotain";

type AbstractRule = GrammarAST.AbstractRule;
import { HARD_KEYWORDS, NEVER_SOFT } from "./soft-keywords.js";

const isWord = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z_][a-z0-9_]*$/i.test(v);

export class WadiTokenBuilder extends DefaultTokenBuilder {
  protected override buildKeywordTokens(
    rules: Stream<AbstractRule>,
    terminalTokens: TokenType[],
    options?: TokenBuilderOptions,
  ): TokenType[] {
    const tokens = super.buildKeywordTokens(rules, terminalTokens, options);
    const id = terminalTokens.find((t) => t.name === "ID");
    if (!id) return tokens;
    const soft = this.softKeywords(rules);
    for (const t of tokens) {
      if (soft.has(t.name)) t.CATEGORIES = [...(t.CATEGORIES ?? []), id];
    }
    return tokens;
  }

  // Derived soft set: every keyword that HEADS a field (i.e. is not a value keyword
  // — the right side of an assignment), minus the hard leaders and the never-soft
  // literals. Value keywords stay hard; only field markers become identifiers.
  private softKeywords(rules: Stream<AbstractRule>): Set<string> {
    const all = new Set<string>();
    const value = new Set<string>();
    for (const rule of rules) {
      for (const node of AstUtils.streamAst(rule)) {
        const n = node as { $type: string; value?: unknown; terminal?: unknown };
        if (n.$type === "Keyword" && isWord(n.value)) all.add(n.value);
        if (n.$type === "Assignment" && n.terminal) {
          for (const t of AstUtils.streamAst(n.terminal as never)) {
            const tt = t as { $type: string; value?: unknown };
            if (tt.$type === "Keyword" && isWord(tt.value)) value.add(tt.value);
          }
        }
      }
    }
    return new Set(
      [...all].filter((k) => !value.has(k) && !HARD_KEYWORDS.has(k) && !NEVER_SOFT.has(k)),
    );
  }
}
