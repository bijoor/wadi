import { readFileSync, writeFileSync } from "node:fs";
import { generateCompositeSheet } from "../src/svg2d/compositeSheet";

const path = process.argv[2];
const floorNum = Number(process.argv[3] ?? 0);
// Optional smart flags: e.g. `crossView,withinView,overlap` as argv[4].
const smartArg = (process.argv[4] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const smart = smartArg.length
  ? {
      crossView: smartArg.includes("crossView"),
      withinView: smartArg.includes("withinView"),
      overlap: smartArg.includes("overlap"),
    }
  : undefined;
const cfg = JSON.parse(readFileSync(path, "utf8"));
const svg = generateCompositeSheet(cfg, floorNum, { filter: smart ? { smart } : null });
const out = "/private/tmp/claude-502/-Users-ashutoshbijoor-Code-wadi/da8b7a3e-eb99-4bff-9512-bc7a34767937/scratchpad/composite.svg";
writeFileSync(out, svg);
console.log("wrote", out, "bytes", svg.length);
// Count dimension groups so we can compare with/without smart flags.
const dimGroups = (svg.match(/<g class="dimension"/g) ?? []).length;
console.log("dimension groups", dimGroups);
