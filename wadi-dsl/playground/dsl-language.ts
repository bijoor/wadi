// Monaco language registration for the Wadi DSL — a Monarch tokenizer that
// mirrors the keywords/operators in src/language/wadi.langium so the code editor
// highlights .wdl source. (Phase 2 would replace this with the real Langium
// language server in a worker, so highlighting + completion come from the grammar
// itself — see wadi-dsl/README.md.)

import type * as Monaco from "monaco-editor";
import { collectGrammarKeywords } from "../src/language/grammar-keywords.js";

export const LANG_ID = "wdl";

// Pure formula functions (from param/formula.ts) — these are NOT grammar keywords
// (the formula is its own sub-language), so they're listed explicitly.
const FUNCTIONS = ["min", "max", "clamp", "round", "floor", "ceil", "abs"];

// DERIVE the highlighted keywords straight from the grammar so highlighting can
// never drift from wadi.langium (this is exactly why `guides` was un-highlighted
// while `grid` was — the old list was hand-maintained). FIELD markers colour as
// `keyword`, VALUE enum words (north/flat/open/…) as `type`, matching the two-tone
// look; formula functions stay `predefined`.
function grammarTokens(): { keywords: string[]; keywords2: string[] } {
  const { field, value } = collectGrammarKeywords();
  const fns = new Set(FUNCTIONS);
  return {
    keywords: [...field].filter((k) => !fns.has(k)),
    keywords2: [...value].filter((k) => !fns.has(k)),
  };
}

export function registerWadiDsl(monaco: typeof Monaco): void {
  monaco.languages.register({ id: LANG_ID, extensions: [".wdl"], aliases: ["Wadi DSL", "wdl"] });

  monaco.languages.setLanguageConfiguration(LANG_ID, {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
  });

  const { keywords, keywords2 } = grammarTokens();
  monaco.languages.setMonarchTokensProvider(LANG_ID, {
    keywords,
    keywords2,
    functions: FUNCTIONS,
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/"(?:[^"\\]|\\.)*"/, "string"],
        [/\b\d+(?:\.\d+)?\b/, "number"],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@keywords2": "type",
              "@functions": "predefined",
              "@default": "identifier",
            },
          },
        ],
        [/[{}[\]()]/, "@brackets"],
        [/[=+\-*/.,@:]/, "operator"],
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
    },
  });
}
