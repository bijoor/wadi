// The `.wadi` BUNDLE format.
//
// A `.wadi` file is now a ZIP archive — a small, self-contained project bundle:
//
//   my-house.wadi  (zip)
//   ├── wadi.json          { "format": "wadi-bundle", "version": 2, "main": "model.wdl" }
//   ├── model.wdl          the WDL source — the editable truth
//   └── thumbnails/        preview images as REAL files (never base64 in the WDL)
//       ├── cover.jpg
//       └── …
//
// The WDL is the source of the model; loading a bundle compiles `model.wdl`
// through the real pipeline. Thumbnails live as files referenced by PATH from the
// WDL's `template { thumbnails "…" }` block, so the WDL stays small and diffable,
// while the bundle is still one shareable file.
//
// BACKWARD COMPATIBILITY: older `.wadi` files are a plain JSON HouseConfig. The two
// are told apart by MAGIC BYTES — a zip always starts with "PK\x03\x04", JSON with
// "{" — so `parseWadiBytes` transparently loads either. Legacy JSON has its
// thumbnails embedded in the config; the bundle has them as files.
//
// fflate (the zip codec) is loaded via dynamic import() so it lands in its own lazy
// chunk and never weighs down the everyday viewer bundle — same treatment as the
// Langium WDL compiler.

import { validate, type HouseConfig } from "../schema/houseConfig";
import { wdlToConfig } from "./wdl";

export interface LoadedWadi {
  config: HouseConfig;
  /** The `.wdl` source. Present for a bundle (its model.wdl); undefined for a
   *  legacy JSON `.wadi`, where the store decompiles the config to WDL. */
  wdl?: string;
  /** Custom component modules the bundle carried (import ref → `.wdl` source).
   *  A key of the semantics: `undefined` means "no module info in this source, so
   *  the loader should PRESERVE the current model's modules" (a plain `.wdl` from
   *  disk); an object (possibly empty) means "REPLACE with exactly these" (a bundle
   *  always declares its full set). */
  modules?: Record<string, string>;
  filename: string;
  filePath: string | null;
}

const MANIFEST = "wadi.json";
const MODEL = "model.wdl";
const THUMB_DIR = "thumbnails/";
// Custom component modules ride here, one readable `.wdl` per import, so a `.wadi`
// unzips into reusable component files (mirrors how thumbnails/ works). The manifest
// carries the exact import-ref → path map so any ref shape round-trips.
const MODULE_DIR = "modules/";
const BUNDLE_VERSION = 2;

// The zip path a custom module's source is stored at. Keeps the import ref readable
// as a path under modules/ (so the unzipped file is browsable), guarding against
// path escapes; the manifest's ref→path map is the authority on load.
function modulePathForRef(ref: string): string {
  const clean = ref
    .replace(/^\.\//, "") // drop a leading ./
    .replace(/^\/+/, "") // no absolute paths
    .replace(/\.\.(?=\/|$)/g, "_") // no parent-dir escapes
    .replace(/\.wdl$/i, ""); // extension is added back once
  return `${MODULE_DIR}${clean}.wdl`;
}

// A zip local-file header always begins with "PK\x03\x04".
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
export function isWadiBundle(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

// Thumbnail files from the most-recently-loaded bundle (path -> bytes), kept so a
// load → edit → save round-trip preserves them. Newly captured shots (a later
// step) will add to this same store. Cleared when a legacy JSON or a fresh model
// is loaded (those carry no separate thumbnail files).
let bundleThumbnails: Record<string, Uint8Array> = {};

/** The thumbnail files (path -> bytes) that a save should re-bundle. */
export function currentBundleThumbnails(): Record<string, Uint8Array> {
  return bundleThumbnails;
}
/** Replace the carried thumbnail set (used by the capture flow / on New). */
export function setBundleThumbnails(next: Record<string, Uint8Array>): void {
  bundleThumbnails = next;
}

// --- Capture flow: shots become FILES in the bundle, referenced by PATH -------
//
// A captured shot arrives as a `data:` URL (a canvas snapshot). Instead of
// storing that base64 in the model (where the WDL decompiler would drop it, so it
// never round-trips), we decode it to a real file under `thumbnails/` and hand
// back its PATH. The path goes into the WDL's `template { thumbnails … }` block,
// so it survives every WDL edit; the bytes ride in the saved `.wadi` bundle.

// Session-unique filename counter, and a path -> display data-URL cache so the UI
// can show a shot without re-encoding its bytes each render.
let shotSeq = 0;
const thumbUrlCache = new Map<string, string>();

function mimeForPath(p: string): string {
  if (/\.jpe?g$/i.test(p)) return "image/jpeg";
  if (/\.webp$/i.test(p)) return "image/webp";
  return "image/png";
}

function bytesFromDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const m = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new Error("Not a data: URL");
  const mime = m[1] || "image/png";
  const body = m[3];
  const bin = m[2] ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(bin)}`;
}

// Add a captured shot (a data: URL) to the bundle as a file. Returns its PATH,
// which the caller stores in `config.template.thumbnails`.
export function addBundleThumbnail(dataUrl: string): string {
  const { bytes, mime } = bytesFromDataUrl(dataUrl);
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  const path = `${THUMB_DIR}shot-${++shotSeq}.${ext}`;
  bundleThumbnails[path] = bytes;
  thumbUrlCache.set(path, dataUrl); // reuse the original for display, no re-encode
  return path;
}

// Resolve a thumbnail entry to something an <img src> can show: a legacy `data:`
// URL passes through; a bundle PATH resolves from its file bytes (or "" if the
// path isn't in the current bundle).
export function thumbnailUrl(entry: string): string {
  if (entry.startsWith("data:")) return entry;
  const cached = thumbUrlCache.get(entry);
  if (cached) return cached;
  const bytes = bundleThumbnails[entry];
  if (!bytes) return "";
  const url = bytesToDataUrl(bytes, mimeForPath(entry));
  thumbUrlCache.set(entry, url);
  return url;
}

// Drop bundle files whose paths are no longer referenced (after a delete / an
// Auto-capture that replaces the whole set), so removed shots don't ride along.
export function pruneBundleThumbnails(keepPaths: string[]): void {
  const keep = new Set(keepPaths);
  for (const p of Object.keys(bundleThumbnails)) {
    if (p.startsWith(THUMB_DIR) && !keep.has(p)) {
      delete bundleThumbnails[p];
      thumbUrlCache.delete(p);
    }
  }
}

// Parse raw bytes into a loadable config. Three on-disk forms are accepted, told
// apart by magic bytes / extension: a `.wadi` ZIP bundle (PK header), a plain `.wdl`
// SOURCE file (the single source of truth, so a coding agent + the offline MCP server
// can edit a `.wdl` on disk and the desktop app watches + recompiles it live), and a
// legacy JSON `.wadi` config.
// `modules` (optional): custom component modules to compile a PLAIN `.wdl` against
// (a bundle carries its own, so this is ignored for a bundle). The live watcher
// passes the current model's modules so a watched `.wdl` that imports them still
// recompiles; a fresh Load omits it (std-only).
export async function parseWadiBytes(
  bytes: Uint8Array,
  filename: string,
  filePath: string | null = null,
  modules?: Record<string, string>,
): Promise<LoadedWadi> {
  if (isWadiBundle(bytes)) return parseBundle(bytes, filename, filePath);
  if (looksLikeWdl(bytes, filename)) return parseWdlSource(bytes, filename, filePath, modules);
  return parseLegacyJson(bytes, filename, filePath);
}

// A plain `.wdl` text file is neither a zip nor JSON. Prefer the extension when the
// name carries one; otherwise sniff: a legacy JSON config always starts with `{`
// (after an optional BOM + whitespace), while `.wdl` starts with `house` / `import` /
// a `//` comment. So "first non-space byte is not `{`" means WDL.
function looksLikeWdl(bytes: Uint8Array, filename: string): boolean {
  if (/\.wdl$/i.test(filename)) return true;
  if (/\.(wadi|json)$/i.test(filename)) return false;
  let i = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3; // UTF-8 BOM
  while (
    i < bytes.length &&
    (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)
  ) {
    i++;
  }
  return bytes[i] !== 0x7b; // not '{'
}

async function parseWdlSource(
  bytes: Uint8Array,
  filename: string,
  filePath: string | null,
  modules?: Record<string, string>,
): Promise<LoadedWadi> {
  const wdl = new TextDecoder().decode(bytes);
  const res = await wdlToConfig(wdl, modules);
  if (!res.ok || !res.config) {
    const details = res.errors.slice(0, 5).map((e) => `  ${e}`).join("\n");
    throw new Error(`This .wdl failed to compile:\n${details}`);
  }
  // A plain `.wdl` carries no bundled thumbnails; drop any from a prior load so a
  // Save of this source doesn't smuggle in unrelated preview files.
  bundleThumbnails = {};
  thumbUrlCache.clear();
  // Echo back the modules we compiled against so the caller can decide what the store
  // keeps: a fresh open with sibling modules auto-loaded (Tauri) passes them here and
  // they become the model's set; the watcher passes the current set to preserve it; a
  // plain open passes nothing (undefined) so the loader clears to none.
  return { config: res.config, wdl, modules, filename, filePath };
}

async function parseBundle(
  bytes: Uint8Array,
  filename: string,
  filePath: string | null,
): Promise<LoadedWadi> {
  const { unzipSync, strFromU8 } = await import("fflate");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (e) {
    throw new Error(`Not a readable .wadi bundle: ${e instanceof Error ? e.message : String(e)}`);
  }

  const wdlBytes = files[MODEL];
  if (!wdlBytes) {
    throw new Error(`This .wadi bundle has no ${MODEL}.`);
  }
  const wdl = strFromU8(wdlBytes);

  // Read the custom component modules this bundle carries so the main WDL's imports
  // resolve. The manifest's `modules` map (ref → path) is authoritative; if it is
  // absent (an older/hand-made bundle) fall back to deriving the ref from the file's
  // path under modules/.
  const manifest = files[MANIFEST]
    ? (() => {
        try { return JSON.parse(strFromU8(files[MANIFEST])) as Record<string, unknown>; }
        catch { return {}; }
      })()
    : {};
  const modules: Record<string, string> = {};
  const manifestModules = manifest.modules;
  if (manifestModules && typeof manifestModules === "object") {
    for (const [ref, path] of Object.entries(manifestModules as Record<string, string>)) {
      const data = files[path];
      if (data) modules[ref] = strFromU8(data);
    }
  } else {
    for (const [name, data] of Object.entries(files)) {
      if (name.startsWith(MODULE_DIR) && name.endsWith(".wdl")) {
        const ref = name.slice(MODULE_DIR.length).replace(/\.wdl$/i, "");
        modules[ref] = strFromU8(data);
      }
    }
  }

  const res = await wdlToConfig(wdl, modules);
  if (!res.ok || !res.config) {
    const details = res.errors.slice(0, 5).map((e) => `  ${e}`).join("\n");
    throw new Error(`The bundle's ${MODEL} failed to compile:\n${details}`);
  }

  // Keep the thumbnail files so a subsequent Save re-bundles them.
  const thumbs: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith(THUMB_DIR) && !name.endsWith("/")) thumbs[name] = data;
  }
  bundleThumbnails = thumbs;
  thumbUrlCache.clear();
  // Advance the shot counter past any loaded `shot-N.*` so a fresh capture in
  // this session can't overwrite a file the bundle already carries.
  for (const name of Object.keys(thumbs)) {
    const m = /shot-(\d+)\./.exec(name);
    if (m) shotSeq = Math.max(shotSeq, Number(m[1]));
  }

  // A bundle declares its FULL module set (possibly empty), so the loader replaces
  // the model's modules with exactly these.
  return { config: res.config, wdl, modules, filename, filePath };
}

async function parseLegacyJson(
  bytes: Uint8Array,
  filename: string,
  filePath: string | null,
): Promise<LoadedWadi> {
  const text = new TextDecoder().decode(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Not a Wadi bundle, and not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const result = validate(parsed);
  if (!result.ok || !result.data) {
    const errList = (result.errors ?? []).slice(0, 5);
    const details = errList.map((e) => `  /${e.path}: ${e.message}`).join("\n");
    throw new Error(
      `Config failed schema validation (${result.errors?.length} error${
        result.errors?.length === 1 ? "" : "s"
      }):\n${details}${(result.errors?.length ?? 0) > errList.length ? "\n  …" : ""}`,
    );
  }
  // A legacy JSON `.wadi` embeds its thumbnails as base64 in `config.thumbnails`
  // (the OLD R2 templates). Those never reach the WDL, so editing the WDL used to
  // drop the previews. MIGRATE them on load: decode each into a bundle file and
  // record its PATH in `config.template.thumbnails` — the field the decompiler
  // emits — so the previews carry into the WDL and survive editing, and the next
  // save writes a proper bundle.
  bundleThumbnails = {};
  thumbUrlCache.clear();
  migrateLegacyThumbnails(result.data as Record<string, unknown>);
  return { config: result.data, filename, filePath };
}

// Move a legacy config's inline `thumbnails`/`thumbnail` (base64 data URLs) into
// bundle files + `template.thumbnails` PATHS. No-op if the config already has
// template paths, or has no legacy thumbnails. Mutates the config in place.
function migrateLegacyThumbnails(cfg: Record<string, unknown>): void {
  const template = (cfg.template as { thumbnails?: unknown } | undefined) ?? undefined;
  if (Array.isArray(template?.thumbnails) && template.thumbnails.length) return; // already migrated

  const legacy: string[] = Array.isArray(cfg.thumbnails)
    ? (cfg.thumbnails as unknown[]).filter((s): s is string => typeof s === "string")
    : typeof cfg.thumbnail === "string"
      ? [cfg.thumbnail]
      : [];
  if (!legacy.length) return;

  const paths = legacy.map((u) => (u.startsWith("data:") ? addBundleThumbnail(u) : u));
  cfg.template = { ...(template ?? {}), thumbnails: paths };
  delete cfg.thumbnails;
  delete cfg.thumbnail;
}

// Extra manifest fields a save can embed so the CATALOG can index a bundle by
// reading only its small `wadi.json` — no WDL compile per file. `meta` is the
// derived+editorial catalog entry; `cover` is the gallery cover thumbnail path.
export interface BundleManifestExtra {
  meta?: unknown;
  cover?: string;
}

// Build a `.wadi` bundle (zip bytes) from the WDL source + thumbnail files + the
// model's custom component modules. Each module rides as a readable `.wdl` under
// modules/, and the manifest records the exact import-ref → path map so the loader
// re-resolves imports without guessing. Inbuilt std packs are NOT bundled (the app
// always has them); only custom modules travel with the model.
export async function buildWadiBundle(
  wdl: string,
  thumbnails: Record<string, Uint8Array> = bundleThumbnails,
  extra: BundleManifestExtra = {},
  modules: Record<string, string> = {},
): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import("fflate");
  const manifestObj: Record<string, unknown> = {
    format: "wadi-bundle",
    version: BUNDLE_VERSION,
    main: MODEL,
  };
  if (extra.meta !== undefined) manifestObj.meta = extra.meta;
  if (extra.cover) manifestObj.cover = extra.cover;
  const entries: Record<string, Uint8Array> = {
    [MODEL]: strToU8(wdl),
  };
  for (const [name, data] of Object.entries(thumbnails)) {
    // Guard: only bundle real thumbnail files.
    if (name.startsWith(THUMB_DIR) && !name.endsWith("/")) entries[name] = data;
  }
  const moduleMap: Record<string, string> = {};
  for (const [ref, src] of Object.entries(modules)) {
    if (typeof src !== "string" || !src.trim()) continue;
    let path = modulePathForRef(ref);
    // Avoid two refs colliding on one path (e.g. "a/b" and "a__b"): suffix a counter.
    if (entries[path] && strFromU8Safe(entries[path]) !== src) {
      let n = 2;
      const base = path.replace(/\.wdl$/i, "");
      while (entries[`${base}-${n}.wdl`]) n++;
      path = `${base}-${n}.wdl`;
    }
    entries[path] = strToU8(src);
    moduleMap[ref] = path;
  }
  if (Object.keys(moduleMap).length) manifestObj.modules = moduleMap;
  // Manifest is written LAST so its `modules` map reflects the real paths above.
  entries[MANIFEST] = strToU8(JSON.stringify(manifestObj, null, 2) + "\n");
  return zipSync(entries, { level: 6 });
}

// Decode already-encoded entry bytes for the collision check above (cheap; entries
// are small module sources).
function strFromU8Safe(bytes: Uint8Array): string {
  try { return new TextDecoder().decode(bytes); } catch { return ""; }
}

// --- Catalog helpers: index a bundle WITHOUT touching the loaded-model state ---
//
// These unzip a bundle for the gallery (its manifest + cover image) and must NOT
// mutate the module's `bundleThumbnails` (that belongs to the currently-open
// model, not a catalog preview). They also avoid compiling the WDL: the manifest
// carries the derived catalog meta, so indexing stays cheap.

/** The parsed `wadi.json` of a bundle, or null if the bytes aren't a bundle. */
export async function readBundleManifest(
  bytes: Uint8Array,
): Promise<Record<string, unknown> | null> {
  if (!isWadiBundle(bytes)) return null;
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const raw = files[MANIFEST];
  if (!raw) return {};
  try {
    return JSON.parse(strFromU8(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** The gallery cover image of a bundle as a display data URL: the manifest's
 *  `cover` path, else the first `thumbnails/` file. "" when there is none. */
export async function readBundleCoverUrls(bytes: Uint8Array): Promise<string[]> {
  if (!isWadiBundle(bytes)) return [];
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  let order: string[] = [];
  const manRaw = files[MANIFEST];
  if (manRaw) {
    try {
      const man = JSON.parse(strFromU8(manRaw)) as { cover?: string };
      if (man.cover) order = [man.cover];
    } catch {
      /* ignore */
    }
  }
  const thumbNames = Object.keys(files)
    .filter((n) => n.startsWith(THUMB_DIR) && !n.endsWith("/"))
    .sort();
  for (const n of thumbNames) if (!order.includes(n)) order.push(n);
  return order
    .filter((n) => files[n])
    .map((n) => bytesToDataUrl(files[n], mimeForPath(n)));
}
