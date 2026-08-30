// P1 parity gate — self-referential golden snapshot (NOT the retired-Python harness).
//
// For every repo config, render the surfaces a primitive-dispatch refactor could
// perturb — expansion, combined floor plans, combined elevations, and the merged
// v2 roof spec — hash each, and diff against a committed golden. Any byte change in
// any surface for any config fails the gate. This is what makes the P1 registry
// migration safe: convert a dispatcher, re-run, prove identical output.
//
// Usage:
//   npx tsx scripts/parity-render.mjs           # check against golden (exit 1 on drift)
//   npx tsx scripts/parity-render.mjs --update   # (re)write the golden (baseline)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import url from "node:url";
import { unzipSync, strFromU8 } from "fflate";

import { compileDsl } from "../../wadi-dsl/src/generator/toHouseConfig.ts";
import { resolveParametric } from "../src/param/resolve.ts";
import { validate } from "../src/schema/houseConfig.ts";
import { expandRoomWalls } from "../src/svg2d/expand.ts";
import { generateCombinedFloorPlans } from "../src/svg2d/floorPlansCombined.ts";
import { generateCombinedElevations } from "../src/svg2d/elevationsCombined.ts";
import { computeMergedV2Spec } from "../src/svg2d/roof/v2/computeFromHouse.ts";
import { setDimensionUnits } from "../src/svg2d/format.ts";
import { setTextScale, computeTextScale, houseSpanUnits } from "../src/svg2d/config.ts";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const GOLDEN = path.join(here, "parity-golden.json");

// Coverage: rooms/walls/openings/roof(hip+gable+shed+flat via roof_style)/pillars/
// staircase/furniture/plinth/ground/grid/formulas across these configs.
const CONFIGS = [
  ["house_config.json", path.join(repo, "house_config.json")],
  ["family_home", path.join(repo, "editor/public/templates/family_home.wadi")],
  ["single_story_cottage", path.join(repo, "editor/public/templates/single_story_cottage.wadi")],
  ["lib/coastal_konkan", path.join(repo, "library/coastal_konkan.wadi")],
  ["lib/family_home", path.join(repo, "library/family_home.wadi")],
  ["lib/single_story_cottage", path.join(repo, "library/single_story_cottage.wadi")],
];

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  return v;
};

function surfaces(rawCfg) {
  const { config } = resolveParametric(rawCfg);
  const res = validate(config);
  const cfg = res.ok ? res.data : config;
  // Same preamble the app + pipeline use before rendering SVGs.
  setDimensionUnits(cfg.units);
  setTextScale(computeTextScale(houseSpanUnits(cfg)));
  let roof;
  try {
    roof = JSON.stringify(canon(computeMergedV2Spec(cfg)));
  } catch (e) {
    roof = "THROW:" + (e instanceof Error ? e.message : String(e));
  }
  return {
    expand: sha(JSON.stringify(canon(expandRoomWalls(cfg)))),
    plans: sha(generateCombinedFloorPlans(cfg)),
    elevations: sha(generateCombinedElevations(cfg)),
    roof: sha(roof),
  };
}

// Load a repo config: a `.wadi` is now a zip BUNDLE (wadi.json + model.wdl), so
// compile its model.wdl the way the app does; a plain JSON config is read directly.
// This makes the gate also prove the JSON→bundle migration is geometry-neutral.
function readConfig(file) {
  const buf = readFileSync(file);
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const files = unzipSync(new Uint8Array(buf));
    return compileDsl(strFromU8(files["model.wdl"]));
  }
  return JSON.parse(buf.toString("utf8"));
}

const update = process.argv.includes("--update");
const out = {};
for (const [name, file] of CONFIGS) {
  if (!existsSync(file)) {
    console.error(`  ! missing config: ${file}`);
    process.exit(2);
  }
  out[name] = surfaces(readConfig(file));
}

if (update) {
  writeFileSync(GOLDEN, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote golden for ${CONFIGS.length} configs → ${path.relative(repo, GOLDEN)}`);
  process.exit(0);
}

if (!existsSync(GOLDEN)) {
  console.error("No golden yet — run with --update first.");
  process.exit(2);
}
const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
let failed = 0;
for (const [name] of CONFIGS) {
  const g = golden[name] ?? {};
  const n = out[name];
  const diffs = ["expand", "plans", "elevations", "roof"].filter((k) => g[k] !== n[k]);
  if (diffs.length) {
    failed++;
    console.log(`  ✗ ${name}: drift in ${diffs.join(", ")}`);
    for (const k of diffs) console.log(`      ${k}: golden ${g[k]} → now ${n[k]}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}
console.log(`\n${CONFIGS.length - failed}/${CONFIGS.length} configs byte-identical`);
process.exit(failed ? 1 : 0);
