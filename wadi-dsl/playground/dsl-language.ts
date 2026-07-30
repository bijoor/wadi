// Monaco language registration for the Wadi DSL — a Monarch tokenizer that
// mirrors the keywords/operators in src/language/wadi.langium so the code editor
// highlights .wadidsl source. (Phase 2 would replace this with the real Langium
// language server in a worker, so highlighting + completion come from the grammar
// itself — see wadi-dsl/README.md.)

import type * as Monaco from "monaco-editor";

export const LANG_ID = "wadidsl";

// Structural keywords (block openers + section words).
const KEYWORDS = [
  "house", "convention", "center", "outer", "units", "site", "plot", "ref",
  "defaults", "floor", "room", "wall", "pillar", "var", "point", "grid",
  "configurator", "raw", "at", "size", "sill", "height", "thick", "role",
  "structural", "planning", "per_unit", "floor_height", "wall_height",
  "slab_thickness", "wall_thickness",
];
// Configurator control words + opening kinds + wall sides + unit systems.
const KEYWORDS2 = [
  "slider", "number", "toggle", "select", "step",
  "door", "window", "north", "south", "east", "west",
  "feet_inches", "feet", "meters", "centimeters", "millimeters",
];
// Pure formula functions (from param/formula.ts).
const FUNCTIONS = ["min", "max", "clamp", "round", "floor", "ceil", "abs"];

export function registerWadiDsl(monaco: typeof Monaco): void {
  monaco.languages.register({ id: LANG_ID, extensions: [".wadidsl"], aliases: ["Wadi DSL", "wadidsl"] });

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

  monaco.languages.setMonarchTokensProvider(LANG_ID, {
    keywords: KEYWORDS,
    keywords2: KEYWORDS2,
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
