// Write the catalog LISTING (manifest.json) for a static templates host — the
// filenames a plain HTTP host (bundled copy, R2 bucket) can't list on its own.
//
//   npx tsx scripts/gen-catalog-index.ts
//
// This is NOT a metadata index: each `.wadi` is self-describing (its `template`
// block carries title/description/style/roof; counts are derived), so the app
// indexes the folder by reading each file. Listable sources (a local folder, a
// Google Drive folder) need no manifest at all — only static HTTP hosts do.
//
// publish-templates.sh runs this first, so a publish always ships a fresh listing.

import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "editor/public/templates");
const MANIFEST = join(DIR, "manifest.json");
const LEGACY_INDEX = join(DIR, "index.json");

const files = readdirSync(DIR)
  .filter((f) => /\.(wadi|json)$/i.test(f) && f !== "index.json" && f !== "manifest.json")
  .sort();

writeFileSync(MANIFEST, JSON.stringify(files, null, 2) + "\n");

// Retire the old metadata index if it's still lying around — the manifest + the
// self-describing files fully replace it.
try {
  readFileSync(LEGACY_INDEX);
  rmSync(LEGACY_INDEX);
  console.log(`removed legacy index.json (superseded by manifest.json + self-describing files)`);
} catch {
  /* already gone */
}

console.log(`catalog listing → ${MANIFEST}`);
for (const f of files) console.log(`  ${f}`);
