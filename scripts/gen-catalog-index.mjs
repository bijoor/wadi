// Regenerate the template catalog's index.json from the .wadi/.json files in
// editor/public/templates/. The point: adding a template becomes "drop the file
// in the folder + run this" — no hand-editing the index.
//
//   node scripts/gen-catalog-index.mjs
//
// It DERIVES the countable meta from each config (bedrooms, bathrooms, floors,
// parametric) and PRESERVES the editorial fields (title, description, style,
// roof, minWidthFt, minLengthFt) from the existing index.json, so re-running is
// safe. New templates get best-effort defaults + a "review" warning.
//
// publish-templates.sh runs this first, so a publish always ships a fresh index.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "editor/public/templates");
const INDEX = join(DIR, "index.json");

const titleCase = (id) =>
  id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// A "room" object counts toward bedroom/bathroom totals by its name.
function countRooms(cfg) {
  const rooms = (cfg.floors ?? []).flatMap((f) =>
    (f.objects ?? []).filter((o) => o?.type === "room"),
  );
  const named = rooms.map((r) => String(r.name ?? ""));
  const bedrooms = named.filter((n) => /bed/i.test(n)).length;
  const bathrooms = named.filter((n) => /bath|toilet|\bwc\b/i.test(n)).length;
  return { rooms, bedrooms, bathrooms };
}

// Habitable storeys = floors that aren't a plinth / loft / roof-only level.
function countFloors(cfg) {
  const floors = cfg.floors ?? [];
  const habitable = floors.filter(
    (f) => !/plinth|loft|roof/i.test(String(f.name ?? "")),
  ).length;
  return Math.max(1, habitable);
}

const isParametric = (cfg) =>
  !!(cfg.variables && Object.keys(cfg.variables).length > 0);

// Rough default plot in display-feet (10 units = 1 ft in the atale convention),
// used only as a starting placeholder for brand-new templates.
function defaultPlotFt(cfg) {
  const w = Number(cfg?.site?.plot_width);
  const l = Number(cfg?.site?.plot_length);
  const ft = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v / 10) : undefined);
  return { minWidthFt: ft(w) ?? 30, minLengthFt: ft(l) ?? 40 };
}

// --- load existing index (to preserve editorial fields + ordering) -----------
let existing = { templates: [] };
try {
  existing = JSON.parse(readFileSync(INDEX, "utf8"));
} catch {
  /* first run — no index yet */
}
const prevById = new Map((existing.templates ?? []).map((t) => [t.id, t]));
const prevOrder = (existing.templates ?? []).map((t) => t.id);

// --- catalog files: every *.wadi / *.json config except index.json -----------
const files = readdirSync(DIR)
  .filter((f) => /\.(wadi|json)$/i.test(f) && f !== "index.json")
  .sort();

const entriesById = new Map();
const warnings = [];

for (const file of files) {
  const id = basename(file, extname(file));
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  } catch (e) {
    warnings.push(`  ! skipped ${file} — not valid JSON (${e.message})`);
    continue;
  }
  const prev = prevById.get(id);
  const { bedrooms, bathrooms } = countRooms(cfg);
  const floors = countFloors(cfg);
  const parametric = isParametric(cfg);
  const plot = defaultPlotFt(cfg);

  if (!prev) {
    warnings.push(
      `  + new template "${id}" — review title/description/style/roof/min* in index.json`,
    );
  }

  entriesById.set(id, {
    id,
    title: prev?.title ?? titleCase(id),
    description: prev?.description ?? "",
    file,
    meta: {
      bedrooms,
      bathrooms,
      floors,
      style: prev?.meta?.style ?? "—",
      roof: prev?.meta?.roof ?? "—",
      minWidthFt: prev?.meta?.minWidthFt ?? plot.minWidthFt,
      minLengthFt: prev?.meta?.minLengthFt ?? plot.minLengthFt,
      parametric,
    },
  });
}

// Keep the previous order for known ids; append any new ids alphabetically.
const orderedIds = [
  ...prevOrder.filter((id) => entriesById.has(id)),
  ...[...entriesById.keys()].filter((id) => !prevOrder.includes(id)),
];
const templates = orderedIds.map((id) => entriesById.get(id));

writeFileSync(INDEX, JSON.stringify({ templates }, null, 2) + "\n");

// --- report ------------------------------------------------------------------
console.log(`catalog index → ${INDEX}`);
for (const t of templates) {
  const m = t.meta;
  console.log(
    `  ${t.id}: ${m.bedrooms} bed, ${m.bathrooms} bath, ${m.floors} floor` +
      `${m.parametric ? ", parametric" : ""} (${t.file})`,
  );
}
if (warnings.length) {
  console.log("\nnotes:");
  for (const w of warnings) console.log(w);
}
