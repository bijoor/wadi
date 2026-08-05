// Runs the same linking spike as the headless test, but IN THE BROWSER, via the
// Vite bundler the playground uses. Proves Langium's DocumentBuilder + custom
// ScopeProvider + in-memory documents work client-side on EmptyFileSystem.

import { AstUtils, type LangiumDocument } from "langium";
import { isUse } from "../src/generated/ast.js";
import { buildProject } from "../src/loader.js";

const out = document.getElementById("out")!;
const lines: string[] = [];
const log = (s: string) => { lines.push(s); out.textContent = lines.join("\n"); };

function linkErrors(built: LangiumDocument[]): string[] {
  const errs: string[] = [];
  for (const d of built)
    for (const n of AstUtils.streamAllContents(d.parseResult.value))
      if (isUse(n) && n.target.error) errs.push(`${n.target.$refText}: ${n.target.error.message}`);
  return errs;
}

(async () => {
  try {
    const t0 = performance.now();
    // cross-module (l.A) + intra-module sibling (A → B)
    const r1 = await buildProject("main", { lib: `component B { }\ncomponent A { use B }`, main: `import "lib" as l\nuse l.A` });
    const e1 = linkErrors(r1.built);
    const main1 = r1.built.find((d) => d.uri.path.endsWith("main.mini"))!.parseResult.value as { uses: { target: { ref?: { name: string } } }[] };
    const lib1 = r1.built.find((d) => d.uri.path.endsWith("lib.mini"))!.parseResult.value as { components: { name: string; uses: { target: { ref?: { name: string } } }[] }[] };
    const laA = main1.uses[0].target.ref?.name;
    const aB = lib1.components.find((c) => c.name === "A")!.uses[0].target.ref?.name;

    // transitive chain main → modA → modB
    const r2 = await buildProject("main", { modB: `component Widget { }`, modA: `import "modB" as b\ncomponent Gadget { use b.Widget }`, main: `import "modA" as a\nuse a.Gadget` });
    const e2 = linkErrors(r2.built);
    const modA = r2.built.find((d) => d.uri.path.endsWith("modA.mini"))!.parseResult.value as { components: { uses: { target: { ref?: { name: string } } }[] }[] };
    const gW = modA.components[0].uses[0].target.ref?.name;

    // dangling (negative control)
    const r3 = await buildProject("main", { lib: `component B { }`, main: `import "lib" as l\nuse l.Nope` });
    const e3 = linkErrors(r3.built);

    const ms = (performance.now() - t0).toFixed(1);
    const pass = e1.length === 0 && laA === "A" && aB === "B" && e2.length === 0 && gW === "Widget" && e3.length === 1;
    log(`RESULT: ${pass ? "PASS ✅" : "FAIL ❌"}   (${ms} ms, in-browser)`);
    log(`  cross-module  l.A        → ${laA}   (link errors: ${e1.length})`);
    log(`  sibling       A → B      → ${aB}`);
    log(`  transitive    a.Gadget→b.Widget → ${gW}   (link errors: ${e2.length})`);
    log(`  dangling      l.Nope     → ${e3.length} linking error(s)`);
    (window as unknown as { __SPIKE_PASS: boolean }).__SPIKE_PASS = pass;
  } catch (e) {
    log("ERROR:\n" + (e as Error).stack);
    (window as unknown as { __SPIKE_PASS: boolean }).__SPIKE_PASS = false;
  }
})();
