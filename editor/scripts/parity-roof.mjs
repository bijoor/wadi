// Byte-diff parity: TS roof SVG output vs the checked-in Python
// output in ../docs/. The TS port lives in editor/src/svg2d/roof/ and
// exports generateRoofSectionsSvg(cfg, outDir) which writes all 14
// files + the manifest to disk. This harness runs it into a scratch
// directory, then diffs each expected filename against ../docs/.
//
// Prerequisite: `python3 regenerate_combined_svgs.py` was run recently
// so ../docs/roof_*.svg reflect the current house_config.json.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { generateRoofSectionsSvg } from "../src/svg2d/roof/index.ts";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
// R3 moved roof outputs into docs/2d/roof/.
const docsDir = path.join(repoRoot, "docs", "2d", "roof");

const EXPECTED_SVGS = [
  "roof_plan.svg",
  "roof_top_view.svg",
  "roof_perspective.svg",
  "roof_section_aa.svg",
  "roof_section_bb.svg",
  "roof_slope_main.svg",
  "roof_slope_hip_n.svg",
  "roof_slope_hip_s.svg",
  "roof_framing_detail.svg",
  "roof_eave_cross_section.svg",
  "roof_truss_elevation.svg",
  "roof_materials_takeoff.svg",
  "roof_consolidated_bom.svg",
  "roof_tile_roofing.svg",
];

const cfg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "house_config.json"), "utf8"),
);

const scratchDir = fs.mkdtempSync(path.join(fs.realpathSync("/tmp"), "roof-parity-"));
await generateRoofSectionsSvg(cfg, scratchDir);

let passed = 0;
let failed = 0;

for (const filename of EXPECTED_SVGS) {
  const pyPath = path.join(docsDir, filename);
  const tsPath = path.join(scratchDir, filename);
  if (!fs.existsSync(pyPath)) {
    console.log(`  · ${filename}: no Python reference`);
    continue;
  }
  if (!fs.existsSync(tsPath)) {
    console.log(`  ✗ ${filename}: TS didn't produce this file`);
    failed++;
    continue;
  }
  const py = fs.readFileSync(pyPath, "utf8");
  const ts = fs.readFileSync(tsPath, "utf8");
  if (py === ts) {
    console.log(`  ✓ ${filename} (${ts.length} bytes)`);
    passed++;
  } else {
    console.log(`  ✗ ${filename}`);
    printFirstDiff(py, ts);
    failed++;
  }
}

// Optional manifest check
const manifestPy = path.join(docsDir, "roof_panels.json");
const manifestTs = path.join(scratchDir, "roof_panels.json");
if (fs.existsSync(manifestPy) && fs.existsSync(manifestTs)) {
  const py = fs.readFileSync(manifestPy, "utf8");
  const ts = fs.readFileSync(manifestTs, "utf8");
  if (py === ts) {
    console.log(`  ✓ roof_panels.json (${ts.length} bytes)`);
    passed++;
  } else {
    console.log(`  ✗ roof_panels.json`);
    printFirstDiff(py, ts);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} roof outputs byte-identical`);
console.log(`(scratch dir kept for inspection: ${scratchDir})`);
process.exit(failed === 0 ? 0 : 1);

function printFirstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length !== b.length) {
    console.log(`    lengths differ: Python=${a.length} TS=${b.length}`);
    const longer = a.length > b.length ? "Python" : "TS";
    const extra = (a.length > b.length ? a : b).slice(n, n + 120);
    console.log(`    extra ${longer} content at end: ${JSON.stringify(extra)}`);
    return;
  }
  const before = 60;
  const after = 120;
  const start = Math.max(0, i - before);
  console.log(`    diverges at char ${i} (line ${a.slice(0, i).split("\n").length}):`);
  console.log(`    Python: …${JSON.stringify(a.slice(start, i + after))}`);
  console.log(`    TS:     …${JSON.stringify(b.slice(start, i + after))}`);
}
