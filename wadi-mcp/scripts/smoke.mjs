// Exercise the in-process pipeline (no MCP protocol): check + render an example,
// and confirm a deliberately-broken design is caught. Run: npm run smoke.

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkWdl, renderSvgs, rasterize, stdResolveModule } from "../src/pipeline.ts";
import { EXAMPLES, MODULES } from "../src/assets.generated.ts";
import { moduleExports } from "../../wadi-dsl/src/generator/toHouseConfig.ts";

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

console.error("modules — std-furniture bundled + importable:");
ok(!!stdResolveModule("std-furniture"), "stdResolveModule serves std-furniture");
const furniture = moduleExports(MODULES["std-furniture"].source);
ok(furniture.assets.length > 50, `std-furniture exports ${furniture.assets.length} assets`);

console.error("import — a design that `import`s std-furniture renders:");
const withFurniture = `house H {
  site { plot (300, 300) }
  import "std-furniture" as f
  floor 1 "G" slab_thickness 0 {
    room Bed at (20, 20) size (160, 200) { wall north east south west
      item f."bed_double" anchor center }
  }
}`;
const impChk = checkWdl(withFurniture);
ok(impChk.ok, `import design checks: ok=${impChk.ok}${impChk.ok ? "" : " — " + impChk.errors[0]?.message?.slice(0, 80)}`);
const impSvgs = renderSvgs(withFurniture, ["plans"]);
ok(impSvgs.length === 1 && impSvgs[0].svg.length > 1000, "import design renders a floor plan");

console.error("glb-inspect — a bundled furniture GLB lists its named nodes:");
const { inspectGlb } = await import("../src/glb.ts");
const { readFileSync: readGlb } = await import("node:fs");
const bed = inspectGlb(readGlb(new URL("../../editor/public/furniture/bed_double.glb", import.meta.url)));
ok(bed.nodes.length >= 2 && bed.nodes.some((n) => n.name === "cover"), `bed_double: ${bed.nodes.map((n) => n.name).join(", ")}`);

console.error(failures ? `\n✗ ${failures} smoke failure(s)` : "\n✓ all smoke checks passed");
process.exit(failures ? 1 : 0);
