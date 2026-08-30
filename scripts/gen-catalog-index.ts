// Write the catalog listing for a static templates host — the files a plain HTTP
// host (bundled copy, R2 bucket) can't enumerate on its own.
//
//   npx tsx scripts/gen-catalog-index.ts
//
// Emits three things into editor/public/templates/:
//   • manifest.json — the filenames (the listing a static host can't provide).
//   • catalog.json  — a RICH index: one entry per template with its title,
//                     description, derived meta, and a loose cover image path.
//                     The app reads this ONE file to build the whole gallery, so a
//                     remote catalog of `.wadi` BUNDLES needs no per-file fetch or
//                     WDL compile.
//   • covers/<id>.* — the gallery cover image, extracted loose so a card shows a
//                     preview without downloading the whole bundle.
//
// A `.wadi` is now a zip BUNDLE: its wadi.json carries the meta + cover, so this
// reads that. A legacy JSON `.wadi`/`.json` is still handled (meta derived, cover
// taken from its first embedded data-URL thumbnail).
//
// publish-templates.sh runs this first, so a publish always ships a fresh index.

import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "../editor/node_modules/fflate/esm/browser.js";
import { deriveTemplateEntry, type TemplateEntry } from "../editor/src/templatePackage/catalogMeta.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "editor/public/templates");
const COVERS = join(DIR, "covers");
const MANIFEST = join(DIR, "manifest.json");
const CATALOG = join(DIR, "catalog.json");
const LEGACY_INDEX = join(DIR, "index.json");

const SKIP = new Set(["manifest.json", "index.json", "catalog.json"]);

function isZip(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

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

interface CatalogEntry extends TemplateEntry {
  cover?: string; // path relative to the catalog base, e.g. "covers/family_home.jpg"
}

const files = readdirSync(DIR)
  .filter((f) => /\.(wadi|json)$/i.test(f) && !SKIP.has(f))
  .sort();

// Rebuild covers/ from scratch so a removed template's cover doesn't linger.
if (existsSync(COVERS)) rmSync(COVERS, { recursive: true, force: true });
mkdirSync(COVERS, { recursive: true });

const catalog: CatalogEntry[] = [];

for (const file of files) {
  const id = file.replace(/\.(wadi|json)$/i, "");
  const bytes = new Uint8Array(readFileSync(join(DIR, file)));
  let entry: TemplateEntry;
  let coverBytes: Uint8Array | null = null;
  let coverExt = "png";

  if (isZip(bytes)) {
    const zip = unzipSync(bytes);
    const man = zip["wadi.json"] ? JSON.parse(strFromU8(zip["wadi.json"])) : {};
    const meta = (man.meta ?? {}) as Record<string, unknown>;
    entry = {
      id,
      file,
      title: (meta.title as string) || id,
      description: (meta.description as string) || "",
      meta: {
        bedrooms: Number(meta.bedrooms) || 0,
        bathrooms: Number(meta.bathrooms) || 0,
        floors: Number(meta.floors) || 1,
        style: (meta.style as string) || "—",
        roof: (meta.roof as string) || "—",
        minWidthFt: Number(meta.minWidthFt) || 30,
        minLengthFt: Number(meta.minLengthFt) || 40,
        parametric: !!meta.parametric,
        ...(Array.isArray(meta.tags) ? { tags: meta.tags as string[] } : {}),
      },
    };
    const coverName =
      (man.cover as string) ||
      Object.keys(zip).filter((n) => n.startsWith("thumbnails/") && !n.endsWith("/")).sort()[0];
    if (coverName && zip[coverName]) {
      coverBytes = zip[coverName];
      coverExt = /\.(jpe?g|webp|png)$/i.exec(coverName)?.[1].toLowerCase().replace("jpeg", "jpg") ?? "png";
    }
  } else {
    // Legacy JSON template.
    const cfg = JSON.parse(strFromU8(bytes)) as Record<string, unknown> & {
      thumbnails?: string[];
      thumbnail?: string;
      template?: Record<string, unknown>;
    };
    entry = deriveTemplateEntry(id, cfg as never, file, cfg.template as never);
    const firstThumb = cfg.thumbnails?.[0] ?? cfg.thumbnail;
    const dec = firstThumb ? decodeDataUrl(firstThumb) : null;
    if (dec) {
      coverBytes = dec.bytes;
      coverExt = dec.ext;
    }
  }

  let cover: string | undefined;
  if (coverBytes) {
    const coverFile = `${id}.${coverExt}`;
    writeFileSync(join(COVERS, coverFile), coverBytes);
    cover = `covers/${coverFile}`;
  }
  catalog.push({ ...entry, ...(cover ? { cover } : {}) });
}

catalog.sort((a, b) => a.title.localeCompare(b.title));

writeFileSync(MANIFEST, JSON.stringify(files, null, 2) + "\n");
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n");

// Retire the old metadata index if it's still lying around.
if (existsSync(LEGACY_INDEX)) {
  rmSync(LEGACY_INDEX);
  console.log("removed legacy index.json (superseded by manifest.json + catalog.json)");
}

console.log(`catalog listing → ${MANIFEST}`);
console.log(`catalog index   → ${CATALOG}`);
for (const e of catalog) console.log(`  ${e.file}  “${e.title}”  ${e.cover ?? "(no cover)"}`);
