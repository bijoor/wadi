// Regenerate the template catalog's index.json from the .wadi/.json files in
// editor/public/templates/. The point: adding a template becomes "drop the file
// in the folder + run this" — no hand-editing the index.
//
//   npx tsx scripts/gen-catalog-index.ts
//
// It DERIVES the countable meta from each config (bedrooms, bathrooms, floors,
// parametric) and PRESERVES the editorial fields (title, description, style,
// roof, minWidthFt, minLengthFt) from the existing index.json, so re-running is
// safe. New templates get best-effort defaults + a "review" warning. The
// derivation lives in editor/src/templatePackage/catalogMeta.ts — the SAME module
// the in-app "Publish template" panel uses, so the two can never drift.
//
// publish-templates.sh runs this first, so a publish always ships a fresh index.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveTemplateEntry,
  type TemplateEntry,
} from "../editor/src/templatePackage/catalogMeta";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "editor/public/templates");
const INDEX = join(DIR, "index.json");

// --- load existing index (to preserve editorial fields + ordering) -----------
let existing: { templates: TemplateEntry[] } = { templates: [] };
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

const entriesById = new Map<string, TemplateEntry>();
const warnings: string[] = [];

for (const file of files) {
  const id = basename(file, extname(file));
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  } catch (e) {
    warnings.push(`  ! skipped ${file} — not valid JSON (${(e as Error).message})`);
    continue;
  }
  const prev = prevById.get(id);
  if (!prev) {
    warnings.push(
      `  + new template "${id}" — review title/description/style/roof/min* in index.json`,
    );
  }
  // Preserve the prior editorial fields (title/description/style/roof/min*).
  const editorial = prev
    ? {
        title: prev.title,
        description: prev.description,
        style: prev.meta?.style,
        roof: prev.meta?.roof,
        minWidthFt: prev.meta?.minWidthFt,
        minLengthFt: prev.meta?.minLengthFt,
      }
    : undefined;
  entriesById.set(id, deriveTemplateEntry(id, cfg, file, editorial));
}

// Keep the previous order for known ids; append any new ids alphabetically.
const orderedIds = [
  ...prevOrder.filter((id) => entriesById.has(id)),
  ...[...entriesById.keys()].filter((id) => !prevOrder.includes(id)),
];
const templates = orderedIds.map((id) => entriesById.get(id)!);

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
