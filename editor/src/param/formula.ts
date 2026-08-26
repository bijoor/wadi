// Tiny arithmetic-formula evaluator for the parametric layer
// (plans/object-relationships-plan.md). Pure, dependency-free, and NO `eval`.
//
// Grammar (recursive descent):
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := '-' factor | '(' expr ')' | number | call | identifier
//   call   := name '(' (expr (',' expr)*)? ')'   // min/max/clamp/round/floor/ceil/abs
//   identifier := name ('.' name)*               // dotted: point fields, e.g. P.x
//   name       := [A-Za-z_][A-Za-z0-9_]*
//
// A formula source may carry a leading '=' (the storage convention); it is
// stripped before tokenizing. Evaluation never throws — parse / unknown-symbol
// / divide-by-zero errors are returned as `{ value: null, error }`.

export interface Scope {
  [symbol: string]: number;
}

export interface EvalResult {
  value: number | null;
  error?: string;
  deps: string[];
}

// ---- tokenizer -----------------------------------------------------------

type Tok =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "op"; v: "+" | "-" | "*" | "/" }
  | { k: "lp" }
  | { k: "rp" }
  | { k: "comma" };

function stripEquals(src: string): string {
  const s = src.trimStart();
  return s.startsWith("=") ? s.slice(1) : s;
}

function tokenize(src: string): Tok[] {
  const s = stripEquals(src);
  const toks: Tok[] = [];
  let i = 0;
  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isIdStart = (c: string) =>
    (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";
  const isIdPart = (c: string) => isIdStart(c) || isDigit(c) || c === ".";

  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      toks.push({ k: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ k: "lp" });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ k: "rp" });
      i++;
      continue;
    }
    if (c === ",") {
      toks.push({ k: "comma" });
      i++;
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(s[i + 1] ?? ""))) {
      let j = i;
      let seenDot = false;
      while (j < s.length && (isDigit(s[j]) || (s[j] === "." && !seenDot))) {
        if (s[j] === ".") seenDot = true;
        j++;
      }
      toks.push({ k: "num", v: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (isIdStart(c)) {
      let j = i;
      while (j < s.length && isIdPart(s[j])) j++;
      const name = s.slice(i, j);
      // Guard against a trailing/leading dot in the identifier.
      if (name.startsWith(".") || name.endsWith(".") || name.includes("..")) {
        throw new FormulaError(`bad identifier '${name}'`);
      }
      toks.push({ k: "id", v: name });
      i = j;
      continue;
    }
    throw new FormulaError(`unexpected character '${c}'`);
  }
  return toks;
}

class FormulaError extends Error {}

// ---- parser (to AST) -----------------------------------------------------

type Node =
  | { t: "num"; v: number }
  | { t: "ref"; name: string }
  | { t: "neg"; a: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; a: Node; b: Node }
  | { t: "call"; name: string; args: Node[] };

function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];

  function parseExpr(): Node {
    let node = parseTerm();
    for (;;) {
      const t = peek();
      if (t && t.k === "op" && (t.v === "+" || t.v === "-")) {
        eat();
        node = { t: "bin", op: t.v, a: node, b: parseTerm() };
      } else break;
    }
    return node;
  }

  function parseTerm(): Node {
    let node = parseFactor();
    for (;;) {
      const t = peek();
      if (t && t.k === "op" && (t.v === "*" || t.v === "/")) {
        eat();
        node = { t: "bin", op: t.v, a: node, b: parseFactor() };
      } else break;
    }
    return node;
  }

  function parseFactor(): Node {
    const t = peek();
    if (!t) throw new FormulaError("unexpected end of formula");
    if (t.k === "op" && t.v === "-") {
      eat();
      return { t: "neg", a: parseFactor() };
    }
    if (t.k === "op" && t.v === "+") {
      // unary plus — accept and ignore
      eat();
      return parseFactor();
    }
    if (t.k === "lp") {
      eat();
      const inner = parseExpr();
      const close = eat();
      if (!close || close.k !== "rp") throw new FormulaError("missing ')'");
      return inner;
    }
    if (t.k === "num") {
      eat();
      return { t: "num", v: t.v };
    }
    if (t.k === "id") {
      eat();
      // Function call: name '(' args ')'. Otherwise a plain variable/point ref.
      if (peek()?.k === "lp") {
        eat(); // '('
        const args: Node[] = [];
        if (peek()?.k !== "rp") {
          args.push(parseExpr());
          while (peek()?.k === "comma") {
            eat();
            args.push(parseExpr());
          }
        }
        const close = eat();
        if (!close || close.k !== "rp") throw new FormulaError("missing ')'");
        return { t: "call", name: t.v, args };
      }
      return { t: "ref", name: t.v };
    }
    throw new FormulaError("expected a number, name, or '('");
  }

  const node = parseExpr();
  if (p !== toks.length) throw new FormulaError("unexpected trailing input");
  return node;
}

function collectDeps(node: Node, out: Set<string>): void {
  switch (node.t) {
    case "ref":
      out.add(node.name);
      break;
    case "neg":
      collectDeps(node.a, out);
      break;
    case "bin":
      collectDeps(node.a, out);
      collectDeps(node.b, out);
      break;
    case "call":
      // Function names are builtins, not scope symbols — only args are deps.
      for (const a of node.args) collectDeps(a, out);
      break;
  }
}

// ---- public API ----------------------------------------------------------

// Symbols referenced by a formula, ignoring scope. Returns [] on parse error
// (the error resurfaces from evalFormula).
export function formulaDeps(src: string): string[] {
  try {
    const set = new Set<string>();
    collectDeps(parse(src), set);
    return [...set];
  } catch {
    return [];
  }
}

// Resolves a call/ref name the builtin table + flat scope don't cover — used for
// generated-guide accessors (`module.x(8)` and the `module.x8` shorthand). Return
// a finite number to satisfy the reference, or undefined to fall through to the
// normal "unknown symbol/function" error.
export type FnResolver = (name: string, args: number[]) => number | undefined;

// Parse + evaluate one formula against `scope`. Never throws. `fn` (optional)
// resolves names outside the builtin table + scope (generated-guide accessors).
export function evalFormula(src: string, scope: Scope, fn?: FnResolver): EvalResult {
  let ast: Node;
  const deps: string[] = [];
  try {
    ast = parse(src);
  } catch (e) {
    return { value: null, error: (e as Error).message, deps };
  }
  const depSet = new Set<string>();
  collectDeps(ast, depSet);
  deps.push(...depSet);

  let error: string | undefined;
  const setErr = (m: string) => {
    if (!error) error = m;
    return NaN;
  };
  // Builtin math functions. All pure; unknown name / bad arity → error.
  const applyFn = (name: string, args: number[]): number => {
    switch (name) {
      case "min":
        return args.length ? Math.min(...args) : setErr("min() needs at least 1 arg");
      case "max":
        return args.length ? Math.max(...args) : setErr("max() needs at least 1 arg");
      case "clamp":
        return args.length === 3
          ? Math.min(Math.max(args[0], args[1]), args[2])
          : setErr("clamp(x, lo, hi) needs 3 args");
      case "round":
        return args.length === 1 ? Math.round(args[0]) : setErr("round(x) needs 1 arg");
      case "floor":
        return args.length === 1 ? Math.floor(args[0]) : setErr("floor(x) needs 1 arg");
      case "ceil":
        return args.length === 1 ? Math.ceil(args[0]) : setErr("ceil(x) needs 1 arg");
      case "abs":
        return args.length === 1 ? Math.abs(args[0]) : setErr("abs(x) needs 1 arg");
      default: {
        // A generated-guide accessor call: `module.x(8)` → fn("module.x", [8]).
        const custom = fn?.(name, args);
        if (typeof custom === "number" && Number.isFinite(custom)) return custom;
        return setErr(`unknown function '${name}'`);
      }
    }
  };
  const evalNode = (n: Node): number => {
    switch (n.t) {
      case "num":
        return n.v;
      case "ref": {
        const v = scope[n.name];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        // Fallback: a generated-guide index shorthand `<id>.x8` computes lazily
        // as fn("<id>.x", [8]). (Negative/fractional indices need the call form.)
        if (fn) {
          const m = /^(.+\.[xy])(\d+)$/.exec(n.name);
          if (m) {
            const g = fn(m[1], [Number(m[2])]);
            if (typeof g === "number" && Number.isFinite(g)) return g;
          }
        }
        if (!error) error = `unknown or unresolved '${n.name}'`;
        return NaN;
      }
      case "neg":
        return -evalNode(n.a);
      case "bin": {
        const a = evalNode(n.a);
        const b = evalNode(n.b);
        switch (n.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            if (b === 0) {
              if (!error) error = "division by zero";
              return NaN;
            }
            return a / b;
        }
      }
      case "call":
        return applyFn(n.name, n.args.map(evalNode));
    }
  };

  const value = evalNode(ast);
  if (error) return { value: null, error, deps };
  if (!Number.isFinite(value)) {
    return { value: null, error: "non-finite result", deps };
  }
  return { value, deps };
}
