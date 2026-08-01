// Exercise the in-process pipeline (no MCP protocol): check + render an example,
// and confirm a deliberately-broken design is caught. Run: npm run smoke.

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkWdl, renderSvgs, rasterize } from "../src/pipeline.ts";
import { EXAMPLES } from "../src/assets.generated.ts";

let failures = 0;
const ok = (cond, msg) => {
  console.error(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) failures++;
};

console.error("check — coastal (valid):");
const good = checkWdl(EXAMPLES.coastal);
ok(good.ok, `ok=${good.ok}, ${good.errors.length} errors, ${good.warnings.length} warnings`);

console.error("check — a C3 violation (floor with rooms, no slab, nonzero slab_thickness):");
const bad = EXAMPLES.minimal.replace("slab_thickness 0", "slab_thickness 80");
const badRes = checkWdl(bad);
ok(!badRes.ok && badRes.errors.some((e) => e.rule === "C3"), `caught C3: ${badRes.errors.map((e) => e.rule).join(",")}`);

console.error("check — a parse error:");
const parseRes = checkWdl("house { this is not valid");
ok(!parseRes.ok && parseRes.errors.length > 0, `caught: ${parseRes.errors[0]?.message?.slice(0, 60)}`);

console.error("render — coastal plans + roof → PNG:");
const svgs = renderSvgs(EXAMPLES.coastal, ["plans", "roof"]);
ok(svgs.length === 2, `rendered ${svgs.map((s) => s.view).join(", ")}`);
for (const { view, svg } of svgs) {
  const png = rasterize(svg, 1200);
  const p = join(tmpdir(), `wadi-smoke-${view}.png`);
  writeFileSync(p, png);
  const isPng = png.length > 8 && png[0] === 0x89 && png[1] === 0x50;
  ok(isPng && png.length > 1000, `${view}: ${(png.length / 1024).toFixed(0)} KB PNG → ${p}`);
}

console.error(failures ? `\n✗ ${failures} smoke failure(s)` : "\n✓ all smoke checks passed");
process.exit(failures ? 1 : 0);
