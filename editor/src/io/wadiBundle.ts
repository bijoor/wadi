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
  filename: string;
  filePath: string | null;
}

const MANIFEST = "wadi.json";
const MODEL = "model.wdl";
const THUMB_DIR = "thumbnails/";
const BUNDLE_VERSION = 2;

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

// Parse raw `.wadi` bytes (bundle OR legacy JSON) into a loadable config.
export async function parseWadiBytes(
  bytes: Uint8Array,
  filename: string,
  filePath: string | null = null,
): Promise<LoadedWadi> {
  if (isWadiBundle(bytes)) return parseBundle(bytes, filename, filePath);
  return parseLegacyJson(bytes, filename, filePath);
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

  const res = await wdlToConfig(wdl);
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

  return { config: res.config, wdl, filename, filePath };
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
  // A legacy JSON `.wadi` embeds its thumbnails inside the config; it has no
  // separate thumbnail files. Clear the carried set — the store decompiles the
  // config to WDL, and the next save writes a fresh bundle.
  bundleThumbnails = {};
  thumbUrlCache.clear();
  return { config: result.data, filename, filePath };
}

// Extra manifest fields a save can embed so the CATALOG can index a bundle by
// reading only its small `wadi.json` — no WDL compile per file. `meta` is the
// derived+editorial catalog entry; `cover` is the gallery cover thumbnail path.
export interface BundleManifestExtra {
  meta?: unknown;
  cover?: string;
}

// Build a `.wadi` bundle (zip bytes) from the WDL source + thumbnail files.
export async function buildWadiBundle(
  wdl: string,
  thumbnails: Record<string, Uint8Array> = bundleThumbnails,
  extra: BundleManifestExtra = {},
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
    [MANIFEST]: strToU8(JSON.stringify(manifestObj, null, 2) + "\n"),
    [MODEL]: strToU8(wdl),
  };
  for (const [name, data] of Object.entries(thumbnails)) {
    // Guard: only bundle real thumbnail files.
    if (name.startsWith(THUMB_DIR) && !name.endsWith("/")) entries[name] = data;
  }
  return zipSync(entries, { level: 6 });
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
