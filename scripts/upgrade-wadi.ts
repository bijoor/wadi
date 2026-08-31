// Upgrade old `.wadi` files (legacy JSON, or an older bundle) to the current
// `.wadi` BUNDLE format (wadi.json + model.wdl + thumbnails/).
//
//   scripts/upgrade-wadi.sh <src> [<src>…] [--out <dir>]
//     <src>   a .wadi/.json file, or a directory of them
//     --out   destination directory (default: editor/public/templates)
//
// (run via scripts/upgrade-wadi.sh, which uses wadi-dsl's vite-node so the Langium
//  compiler resolves; plain `tsx` can't load langium's ESM-only exports.)
//
// It reproduces the app's save path exactly (fileIO.wadiBytesFor +
// wadiBundle.buildWadiBundle + migrateLegacyThumbnails):
//   • legacy JSON → validate, extract inline base64 thumbnails to bundle FILES,
//     decompile the config to model.wdl;
//   • older bundle → recompile its model.wdl and re-canonicalize its thumbnails.
// Thumbnails are renumbered to shot-1..N and the model.wdl `template` block is
// re-emitted to reference exactly the files bundled (repairs any shot-N drift).
// Image types are detected from MAGIC BYTES, so a mislabeled data-URL/file gets
// the right extension. Every upgrade is geometry-checked: compile(emit(cfg)) must
// expand to byte-identical floors, so we never ship a model.wdl that rebuilds a
// different house.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync, strToU8, strFromU8 } from "../editor/node_modules/fflate/esm/browser.js";
import { compileDsl } from "../wadi-dsl/src/generator/toHouseConfig.ts";
import { emitWdl } from "../wadi-dsl/src/generator/fromHouseConfig.ts";
import { resolveParametric } from "../editor/src/param/resolve.ts";
import { expandRoomWalls } from "../editor/src/svg2d/expand.ts";
import { validate } from "../editor/src/schema/houseConfig.ts";
import { deriveTemplateEntry } from "../editor/src/templatePackage/catalogMeta.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STD = join(REPO, "wadi-dsl/std-modules");
const THUMB_DIR = "thumbnails/";

const stdResolve = (ref: string): string | undefined => {
  const p = join(STD, `${ref}.wdl`);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
};
const opts = { resolveModule: stdResolve };

// ---- geometry oracle (mirrors wadi-dsl/test/decompile.test.ts) --------------
/* eslint-disable @typescript-eslint/no-explicit-any */
function norm(x: any): any {
  if (Array.isArray(x)) return x.map(norm);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(x).sort()) {
      if (k === "formulas") continue;
      o[k] = k === "walls" && Array.isArray(x[k]) ? [...x[k]].sort() : norm(x[k]);
    }
    return o;
  }
  return x;
}
const floorsSig = (cfg: any): string =>
  JSON.stringify(
    norm(expandRoomWalls(resolveParametric(cfg).config, undefined, { lenient: true }).floors),
  );

// ---- image type from MAGIC BYTES (not the possibly-wrong label) --------------
function sniffExt(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  )
    return "webp";
  if (b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  return null;
}
const mimeExt = (mime: string): string =>
  /jpe?g/i.test(mime) ? "jpg" : /webp/i.test(mime) ? "webp" : /gif/i.test(mime) ? "gif" : "png";

function decodeDataUrl(u: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(u);
  if (!m) return null;
  const bytes = m[2]
    ? new Uint8Array(Buffer.from(m[3], "base64"))
    : new Uint8Array(Buffer.from(decodeURIComponent(m[3])));
  return { bytes, ext: sniffExt(bytes) ?? mimeExt(m[1] || "image/png") };
}

// Renumber the preview images to thumbnails/shot-1..N, point template.thumbnails
// at exactly those paths, and return the files to bundle. Mutates cfg in place.
function setThumbs(
  cfg: Record<string, any>,
  ordered: Array<{ bytes: Uint8Array; ext: string }>,
): Record<string, Uint8Array> {
  const thumbs: Record<string, Uint8Array> = {};
  const paths = ordered.map((t, i) => {
    const path = `${THUMB_DIR}shot-${i + 1}.${t.ext}`;
    thumbs[path] = t.bytes;
    return path;
  });
  const template = (cfg.template as Record<string, unknown> | undefined) ?? undefined;
  if (paths.length) cfg.template = { ...(template ?? {}), thumbnails: paths };
  else if (template) {
    const { thumbnails: _drop, ...rest } = template;
    cfg.template = rest;
  }
  delete cfg.thumbnails;
  delete cfg.thumbnail;
  return thumbs;
}

function buildBundle(
  wdl: string,
  thumbs: Record<string, Uint8Array>,
  meta: unknown,
  cover: string | undefined,
): Uint8Array {
  const manifest: Record<string, unknown> = { format: "wadi-bundle", version: 2, main: "model.wdl" };
  if (meta !== undefined) manifest.meta = meta;
  if (cover) manifest.cover = cover;
  const entries: Record<string, Uint8Array> = {
    "wadi.json": strToU8(JSON.stringify(manifest, null, 2) + "\n"),
    "model.wdl": strToU8(wdl),
    ...thumbs,
  };
  return zipSync(entries, { level: 6 });
}

const isZip = (b: Uint8Array) =>
  b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** Upgrade one file's bytes → bundle bytes + a summary line. */
export function upgradeBytes(id: string, src: Uint8Array): { bytes: Uint8Array; note: string } {
  let config: Record<string, any>;
  let ordered: Array<{ bytes: Uint8Array; ext: string }>;

  if (isZip(src)) {
    const zip = unzipSync(src);
    const res = compileDsl(strFromU8(zip["model.wdl"]), opts);
    const v = validate(res);
    if (!v.ok || !v.data) throw new Error(`bundle model.wdl invalid: ${JSON.stringify(v.errors?.slice(0, 3))}`);
    config = v.data as Record<string, any>;
    ordered = Object.keys(zip)
      .filter((n) => n.startsWith(THUMB_DIR) && !n.endsWith("/"))
      .sort()
      .map((n) => {
        const bytes = zip[n];
        return { bytes, ext: sniffExt(bytes) ?? mimeExt(n) };
      });
  } else {
    const parsed = JSON.parse(strFromU8(src));
    const v = validate(parsed);
    if (!v.ok || !v.data) throw new Error(`schema invalid: ${JSON.stringify(v.errors?.slice(0, 3))}`);
    config = v.data as Record<string, any>;
    const inline: string[] = Array.isArray(config.thumbnails)
      ? (config.thumbnails as unknown[]).filter((s): s is string => typeof s === "string")
      : typeof config.thumbnail === "string"
        ? [config.thumbnail]
        : [];
    ordered = inline.map(decodeDataUrl).filter((d): d is { bytes: Uint8Array; ext: string } => !!d);
  }

  const thumbs = setThumbs(config, ordered);
  const wdl = emitWdl(config);

  // Round-trip geometry check.
  const back = compileDsl(wdl, opts);
  const bv = validate(back);
  if (!bv.ok || !bv.data) throw new Error(`emitted WDL failed schema: ${JSON.stringify(bv.errors?.slice(0, 3))}`);
  if (floorsSig(bv.data) !== floorsSig(config)) {
    throw new Error("round-trip geometry MISMATCH (emit(cfg) rebuilds a different house)");
  }

  const entry = deriveTemplateEntry(id, config as any, `${id}.wadi`, (config as any).template);
  const cover = (config as any).template?.thumbnails?.[0];
  const bytes = buildBundle(
    wdl,
    thumbs,
    { title: entry.title, description: entry.description, ...entry.meta },
    cover,
  );
  const note =
    `[${(bytes.length / 1024).toFixed(0)} KB, ${Object.keys(thumbs).length} thumb(s), ` +
    `${entry.meta.bedrooms}bd/${entry.meta.bathrooms}ba/${entry.meta.floors}fl` +
    `${entry.meta.parametric ? ", parametric" : ""}]  “${entry.title}”`;
  return { bytes, note };
}

// ---- CLI --------------------------------------------------------------------
function listInputs(srcs: string[]): string[] {
  const files: string[] = [];
  for (const s of srcs) {
    const p = resolve(s);
    if (!existsSync(p)) throw new Error(`no such path: ${s}`);
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) {
        if (/\.(wadi|json)$/i.test(f) && !f.startsWith(".")) files.push(join(p, f));
      }
    } else {
      files.push(p);
    }
  }
  return files;
}

// Skip the non-template control files a folder might contain.
const SKIP = new Set(["manifest.json", "index.json", "catalog.json"]);

function main(): void {
  const argv = process.argv.slice(2);
  let out = join(REPO, "editor/public/templates");
  const srcs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = resolve(argv[++i] ?? "");
    else srcs.push(argv[i]);
  }
  if (!srcs.length) {
    console.error("usage: upgrade-wadi.sh <src> [<src>…] [--out <dir>]");
    process.exit(2);
  }
  if (!existsSync(out)) mkdirSync(out, { recursive: true });

  const files = listInputs(srcs).filter((f) => !SKIP.has(basename(f)));
  let ok = 0;
  const fail: string[] = [];
  for (const file of files) {
    const id = basename(file).replace(/\.(wadi|json)$/i, "");
    try {
      const { bytes, note } = upgradeBytes(id, new Uint8Array(readFileSync(file)));
      writeFileSync(join(out, `${id}.wadi`), bytes);
      console.log(`✓ ${basename(file)}  →  ${id}.wadi  ${note}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${basename(file)}: ${e instanceof Error ? e.message : String(e)}`);
      fail.push(basename(file));
    }
  }
  console.log(`\n${ok}/${files.length} upgraded → ${out}`);
  if (fail.length) {
    console.error(`FAILED: ${fail.join(", ")}`);
    process.exit(1);
  }
}

main();
