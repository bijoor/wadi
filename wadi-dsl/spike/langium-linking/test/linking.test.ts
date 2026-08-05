// SPIKE: prove Langium's linker resolves the exact case Wadi's hand-rolled
// inliner drops today — a LIBRARY component that `use`s a SIBLING library
// component — across in-memory modules, plus a namespaced cross-module `use`.

import { describe, it, expect } from "vitest";
import { AstUtils, type LangiumDocument } from "langium";
import { isUse } from "../src/generated/ast.js";
import type { Model } from "../src/generated/ast.js";
import { buildProject } from "../src/loader.js";

// lib: component A `use`s its sibling B (INTRA-MODULE — the failing case today)
const LIB = `component B { }
component A { use B }`;
// main: a NAMESPACED cross-module `use l.A`
const MAIN = `import "lib" as l
use l.A`;

function errorsOf(built: LangiumDocument[]) {
  const parse = built.flatMap((d) =>
    [...d.parseResult.lexerErrors, ...d.parseResult.parserErrors].map((e) => `${d.uri.path}: ${e.message}`),
  );
  const link: string[] = [];
  for (const d of built) {
    for (const node of AstUtils.streamAllContents(d.parseResult.value)) {
      if (isUse(node) && node.target.error) link.push(`${d.uri.path}: ${node.target.$refText} — ${node.target.error.message}`);
    }
  }
  return { parse, link };
}

describe("langium cross-module linking spike", () => {
  it("resolves cross-module (l.A) AND intra-module (A → sibling B) references", async () => {
    const t0 = performance.now();
    const { built } = await buildProject("main", { lib: LIB, main: MAIN });
    const ms = performance.now() - t0;
    const { parse, link } = errorsOf(built);
    // eslint-disable-next-line no-console
    console.log(`\n  ⟶ spike build: ${ms.toFixed(1)}ms · parseErrs=${parse.length} · linkErrs=${link.length}`, link);

    expect(parse).toEqual([]);
    expect(link).toEqual([]);

    const main = built.find((d) => d.uri.path.endsWith("main.mini"))!.parseResult.value as Model;
    expect(main.uses[0].target.ref?.name).toBe("A"); // l.A resolved to lib's Component A

    const lib = built.find((d) => d.uri.path.endsWith("lib.mini"))!.parseResult.value as Model;
    const A = lib.components.find((c) => c.name === "A")!;
    expect(A.uses[0].target.ref?.name).toBe("B"); // A's `use B` resolved to lib's sibling B
  });

  it("resolves a transitive module→module chain with per-module import scopes", async () => {
    // modB defines Widget; modA imports modB and its Gadget uses b.Widget;
    // main imports modA and uses a.Gadget. main never mentions modB — it's pulled
    // in transitively, and modA's own `b` alias resolves in modA's OWN scope.
    const modB = `component Widget { }`;
    const modA = `import "modB" as b\ncomponent Gadget { use b.Widget }`;
    const main = `import "modA" as a\nuse a.Gadget`;
    const { built } = await buildProject("main", { modB, modA, main });
    const { parse, link } = errorsOf(built);
    expect(parse).toEqual([]);
    expect(link).toEqual([]);

    const A = built.find((d) => d.uri.path.endsWith("modA.mini"))!.parseResult.value as Model;
    // modA's Gadget.use → b.Widget resolved via modA's private import, not main's scope
    expect(A.components[0].uses[0].target.ref?.name).toBe("Widget");
  });

  it("flags a dangling cross-module reference (negative control)", async () => {
    const { built } = await buildProject("main", { lib: LIB, main: `import "lib" as l\nuse l.Nope` });
    const { link } = errorsOf(built);
    expect(link.length).toBe(1);
    expect(link[0]).toContain("l.Nope");
  });
});
