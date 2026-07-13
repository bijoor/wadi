// Regenerate all SVG outputs from house_config.json without opening
// the browser. Calls the same TypeScript generators the editor's UI
// uses, so the output is byte-identical to what a user would download
// from the editor's Plans / Elevations tabs.
//
// Usage:
//   npx tsx scripts/dump-svgs.mjs [--in <config.json>] [--out <dir>]
//
// Defaults:
//   --in   ../house_config.json  (repo root)
//   --out  ../docs               (repo's GH Pages folder)
//
// Writes under <out>/:
//   2d/floor_plans/floor_plan_0_Ground_Floor.svg
//   2d/floor_plans/floor_plan_1_First_Floor.svg
//   2d/floor_plans/floor_plans_combined.svg
//   2d/elevations/elevation_{front,back,left,right}.svg
//   2d/elevations/elevations_combined.svg
//   2d/roof/roof_*.svg  (14 files)
//   2d/roof/roof_panels.json
//
// Prints a one-line summary per file plus a total. Exits non-zero if
// the input JSON fails Zod validation.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { generateAllFloorPlans } from "../src/svg2d/floorPlansAll.ts";
import { generateCombinedFloorPlans } from "../src/svg2d/floorPlansCombined.ts";
import { generateAllElevations } from "../src/svg2d/elevationsAll.ts";
import { generateCombinedElevations } from "../src/svg2d/elevationsCombined.ts";
import { generateRoofSectionsSvg } from "../src/svg2d/roof/index.ts";
import { validate } from "../src/schema/houseConfig.ts";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(args.in ?? path.join(repoRoot, "house_config.json"));
const outDir = path.resolve(args.out ?? path.join(repoRoot, "docs"));

if (!fs.existsSync(inputPath)) {
  console.error(`✗ input not found: ${inputPath}`);
  process.exit(2);
}

// Per-type subdirs. Created up-front so the generators can write into
// them. Existing dirs are left alone.
const floorPlansDir = path.join(outDir, "2d", "floor_plans");
const elevationsDir = path.join(outDir, "2d", "elevations");
const roofDir = path.join(outDir, "2d", "roof");
fs.mkdirSync(floorPlansDir, { recursive: true });
fs.mkdirSync(elevationsDir, { recursive: true });
fs.mkdirSync(roofDir, { recursive: true });

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
// Validate for shape (fail loudly on schema errors) but pass the RAW
// JSON to the generator. Zod's parsed result reshapes optional/undef
// fields in ways that can shift SVG element ordering vs. Python's
// dict-iteration order, so keeping the untouched object matches the
// parity-harness reference output exactly.
const result = validate(raw);
if (!result.ok) {
  console.error(`✗ ${inputPath} failed schema validation:`);
  for (const e of (result.errors ?? []).slice(0, 10)) {
    console.error(`   /${e.path}: ${e.message}`);
  }
  process.exit(1);
}
const cfg = raw;

console.log(`↳ input:  ${path.relative(process.cwd(), inputPath)}`);
console.log(`↳ output: ${path.relative(process.cwd(), outDir)}\n`);

let written = 0;
const write = (dir, name, content) => {
  if (!content) return;
  const filepath = path.join(dir, name);
  fs.writeFileSync(filepath, content, "utf8");
  const rel = path.relative(outDir, filepath);
  console.log(`  ✓ ${rel.padEnd(50)} ${(content.length / 1024).toFixed(1).padStart(6)} KB`);
  written++;
};

// Per-floor plans → 2d/floor_plans/
for (const { filename, content } of generateAllFloorPlans(cfg)) {
  write(floorPlansDir, filename, content);
}
// Combined plan → 2d/floor_plans/
write(floorPlansDir, "floor_plans_combined.svg", generateCombinedFloorPlans(cfg));
// Per-view elevations → 2d/elevations/
for (const { view, content } of generateAllElevations(cfg)) {
  write(elevationsDir, `elevation_${view}.svg`, content);
}
// Combined elevations → 2d/elevations/
write(elevationsDir, "elevations_combined.svg", generateCombinedElevations(cfg));

// Roof panels — writes 14 SVGs + roof_panels.json manifest directly to
// disk (the port writes files itself rather than returning strings, to
// keep memory low for the ~144 KB master roof_plan.svg).
await generateRoofSectionsSvg(cfg, roofDir);
// Enumerate expected roof files so the summary line lists them
// regardless of whether they existed before this run.
const ROOF_FILES = [
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
  "roof_panels.json",
];
for (const f of ROOF_FILES) {
  const p = path.join(roofDir, f);
  if (!fs.existsSync(p)) continue;
  const rel = path.relative(outDir, p);
  const size = fs.statSync(p).size;
  console.log(`  ✓ ${rel.padEnd(50)} ${(size / 1024).toFixed(1).padStart(6)} KB`);
  written++;
}

console.log(`\n✓ ${written} files written to ${path.relative(process.cwd(), outDir)}`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--in" || a === "--input") out.in = argv[++i];
    else if (a === "--out" || a === "--output") out.out = argv[++i];
    else if (a === "-h" || a === "--help") {
      console.log(
        "usage: npx tsx scripts/dump-svgs.mjs [--in <config.json>] [--out <dir>]",
      );
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return out;
}
