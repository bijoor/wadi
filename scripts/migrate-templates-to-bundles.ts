// ONE-TIME migration: convert the legacy JSON `.wadi` (and `.json`) templates in
// editor/public/templates/ into `.wadi` ZIP BUNDLES.
//
//   ./editor/node_modules/.bin/tsx scripts/migrate-templates-to-bundles.ts
//
// For each legacy template it:
//   • decompiles the config to WDL (the bundle's model.wdl — the editable source),
//   • extracts the embedded base64 `thumbnails[]` to real files under thumbnails/,
//     and rewrites them as PATHS in `template { thumbnails … }` (so they round-trip
//     and stop bloating the source),
//   • embeds the derived catalog meta + cover path in wadi.json (so the gallery
//     indexes the bundle by reading one small manifest — no per-file WDL compile).
//
// After this, run scripts/gen-catalog-index.ts to (re)write manifest.json +
// catalog.json + the loose covers/ images. The build mirrors editor/public/templates
// to docs/; publish-templates.sh uploads the folder to R2.

import { readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "../editor/node_modules/fflate/esm/browser.js";
import { emitWdl } from "../wadi-dsl/src/generator/fromHouseConfig.ts";
import { deriveTemplateEntry } from "../editor/src/templatePackage/catalogMeta.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "editor/public/templates");

const SKIP = new Set(["manifest.json", "index.json", "catalog.json"]);

function decodeDataUrl(u: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(u);
  if (!m) return null;
  const mime = m[1] || "image/png";
  const ext = /jpe?g/.test(mime) ? "jpg" : /webp/.test(mime) ? "webp" : "png";
  const bytes = m[2]
    ? new Uint8Array(Buffer.from(m[3], "base64"))
    : new Uint8Array(Buffer.from(decodeURIComponent(m[3])));
  return { bytes, ext };
}

const files = readdirSync(DIR).filter(
  (f) => /\.(wadi|json)$/i.test(f) && !SKIP.has(f),
);

for (const file of files) {
  const id = file.replace(/\.(wadi|json)$/i, "");
  const cfg = JSON.parse(readFileSync(join(DIR, file), "utf8")) as Record<string, unknown> & {
    thumbnails?: string[];
    thumbnail?: string;
    template?: { thumbnails?: string[] } & Record<string, unknown>;
  };

  // Already a bundle? (zip magic) — skip.
  const head = readFileSync(join(DIR, file)).subarray(0, 4);
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
    console.log(`  skip ${file} (already a bundle)`);
    continue;
  }

  // Extract embedded thumbnails → files under thumbnails/, referenced by path.
  const embedded = cfg.thumbnails ?? (cfg.thumbnail ? [cfg.thumbnail] : []);
  const thumbFiles: Record<string, Uint8Array> = {};
  const paths: string[] = [];
  embedded.forEach((u, i) => {
    const dec = decodeDataUrl(u);
    if (!dec) return;
    const p = `thumbnails/shot-${i + 1}.${dec.ext}`;
    thumbFiles[p] = dec.bytes;
    paths.push(p);
  });

  // The WDL must reference the paths (not the base64), so set them on template
  // BEFORE decompiling, and drop the inline data URLs.
  cfg.template = { ...(cfg.template ?? {}) };
  if (paths.length) cfg.template.thumbnails = paths;
  delete cfg.thumbnails;
  delete cfg.thumbnail;

  const wdl = emitWdl(cfg);
  const entry = deriveTemplateEntry(id, cfg as never, `${id}.wadi`, cfg.template);
  const cover = paths[0];

  const manifest: Record<string, unknown> = {
    format: "wadi-bundle",
    version: 2,
    main: "model.wdl",
    meta: { title: entry.title, description: entry.description, ...entry.meta },
  };
  if (cover) manifest.cover = cover;

  const entries: Record<string, Uint8Array> = {
    "wadi.json": strToU8(JSON.stringify(manifest, null, 2) + "\n"),
    "model.wdl": strToU8(wdl),
    ...thumbFiles,
  };
  const bundle = zipSync(entries, { level: 6 });

  const outName = `${id}.wadi`;
  writeFileSync(join(DIR, outName), bundle);
  if (file !== outName) rmSync(join(DIR, file)); // drop the old .json name

  const before = readFileSync(join(DIR, outName)).length;
  console.log(
    `  ${file} → ${outName}  (wdl ${wdl.length}B, ${paths.length} thumb${paths.length === 1 ? "" : "s"}, bundle ${before}B)`,
  );
}

console.log(`\nMigrated ${files.length} template(s). Now run scripts/gen-catalog-index.ts.`);
