// Template catalog source — where the "Choose your home" gallery gets its
// templates. Decoupled from the app deploy so new templates can be added to a
// cloud host WITHOUT rebuilding the site or the desktop app.
//
// Multi-source: the configured source URL is inspected and dispatched to an
// adapter, so different hosts are pluggable:
//   • generic  — any static HTTPS host (Cloudflare R2 public bucket, jsDelivr,
//                or the copy bundled with the app). Files fetched as
//                `${base}/${relPath}`.
//   • gdrive   — a shared Google Drive FOLDER via the Drive API. Files are
//                listed by name → id, then fetched with `?alt=media&key=`.
//                Requires a Google API key (Drive API) in a separate setting.
//
// Resolution order for the source:
//   1. a user override in localStorage ("wadi.templatesUrl")   — Settings UI
//   2. REMOTE_TEMPLATES_URL (baked-in default, once a host is live)
//   3. "/templates" (the copy bundled with the app — offline fallback)
//
// Every fetch tries the resolved source first; on failure it falls back to the
// on-disk cache (desktop, best-effort) and finally to the bundled copy, so the
// gallery always works — online, offline, or before a remote host exists.
//
// Templates are pure data (.wadi JSON, Zod-validated before load; formulas are
// a safe mini-language, no eval), so fetching them from a remote host is a data
// download, not code execution.

import { isTauri } from "@tauri-apps/api/core";
import { entryFromConfig, titleCase, type TemplateEntry } from "../templatePackage/catalogMeta";
import { isWadiBundle, readBundleManifest } from "./wadiBundle";
import {
  listModelsDirFiles,
  readModelsDirText,
  readModelsDirBytes,
} from "./fsAccess";

// Baked-in remote catalog: the Cloudflare R2 bucket on our custom domain. Serves
// index.json + the template .wadi files with CORS `*`, so the web app, the
// tauri:// desktop app, and dev all read it. A user override in localStorage
// still wins; if this host is unreachable, fetches fall back to the bundled copy.
export const REMOTE_TEMPLATES_URL = "https://templates.wadi.house";

const BUNDLED_BASE = "/templates";
const CACHE_DIR = "templates-cache";
const SOURCE_KEY = "wadi.templateSource";
// Pre-unification keys — migrated once into SOURCE_KEY, then removed.
const LEGACY_KEYS = { url: "wadi.templatesUrl", drive: "wadi.driveApiKey", dir: "wadi.templatesDir" };

const isTemplateFile = (name: string) =>
  /\.(wadi|json)$/i.test(name) && name !== "index.json" && name !== "manifest.json";

const stripTrailingSlash = (u: string) => u.replace(/\/+$/, "");

// The ONE templates-source preference. Everything about "where do templates come
// from" derives from this. `default` = the Wadi-hosted catalog (REMOTE_TEMPLATES_URL).
export type TemplateSource =
  | { kind: "default" }
  | { kind: "bundled" }
  | { kind: "local"; dir: string }
  // A browser folder chosen via the File System Access API (Chromium). Only a
  // MARKER is persisted here; the real directory handle lives in IndexedDB
  // (io/fsAccess) and is restored on load — a handle can't be serialized.
  | { kind: "browser-dir" }
  | { kind: "url"; url: string }
  | { kind: "gdrive"; url: string; apiKey: string };

const DEFAULT_SOURCE: TemplateSource = { kind: "default" };

function readKey(key: string): string {
  try {
    return localStorage.getItem(key)?.trim() ?? "";
  } catch {
    return "";
  }
}

// Fold the old three keys into one TemplateSource (once), then delete them.
function migrateLegacy(): TemplateSource | null {
  const dir = readKey(LEGACY_KEYS.dir);
  const url = readKey(LEGACY_KEYS.url);
  if (dir) return { kind: "local", dir };
  if (url) {
    return driveFolderId(url)
      ? { kind: "gdrive", url: stripTrailingSlash(url), apiKey: readKey(LEGACY_KEYS.drive) }
      : { kind: "url", url: stripTrailingSlash(url) };
  }
  return null;
}

/** The active templates-source preference (single source of truth). */
export function templateSource(): TemplateSource {
  const raw = readKey(SOURCE_KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw) as TemplateSource;
      if (p && typeof p === "object" && typeof p.kind === "string") return p;
    } catch {
      /* corrupt — fall through to default */
    }
  }
  const migrated = migrateLegacy();
  if (migrated) {
    setTemplateSource(migrated);
    try {
      for (const k of Object.values(LEGACY_KEYS)) localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
    return migrated;
  }
  return DEFAULT_SOURCE;
}

/** Persist the templates-source preference. */
export function setTemplateSource(p: TemplateSource): void {
  try {
    localStorage.setItem(SOURCE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

// --- derived views (the rest of the module + the UI read these) --------------

/** A local templates FOLDER (desktop only): the app lists + indexes it, and the
 *  Publish panel saves into it. Empty string when the source isn't a local one. */
export function localTemplatesDir(): string {
  if (!isTauri()) return "";
  const s = templateSource();
  return s.kind === "local" ? s.dir : "";
}

/** Absolute path of a catalog file when the source is a WRITABLE local folder
 *  (desktop), so opening it can set the model's filePath and Save writes back to
 *  the same file. Null for read-only sources (default / bundled / URL / Drive). */
export function localCatalogFilePath(relPath: string): string | null {
  const dir = localTemplatesDir();
  return dir ? joinPath(dir, relPath) : null;
}

/** The active catalog base URL (for the generic/gdrive/default HTTP adapters). */
export function templatesBaseUrl(): string {
  const s = templateSource();
  if (s.kind === "url" || s.kind === "gdrive") return stripTrailingSlash(s.url);
  if (s.kind === "bundled" || s.kind === "local") return BUNDLED_BASE;
  return stripTrailingSlash(REMOTE_TEMPLATES_URL); // default
}

/** Google API key used by the Drive adapter (read of public files). */
export function driveApiKey(): string {
  const s = templateSource();
  return s.kind === "gdrive" ? s.apiKey : "";
}

/** True when the catalog is served from a remote host (not bundled or local). */
export function isRemoteCatalog(): boolean {
  const k = templateSource().kind;
  return k === "default" || k === "url" || k === "gdrive";
}

// --- source detection --------------------------------------------------------

export type SourceKind = "generic" | "gdrive" | "local";

/** Pull a Drive folder id out of the common URL/spec shapes, else null. */
function driveFolderId(url: string): string | null {
  // https://drive.google.com/drive/folders/<ID>[?...]
  const m1 = /drive\.google\.com\/(?:drive\/)?folders\/([A-Za-z0-9_-]+)/.exec(url);
  if (m1) return m1[1];
  // ?id=<ID>  (open?id=… / uc?id=…)
  const m2 = /[?&]id=([A-Za-z0-9_-]+)/.exec(url);
  if (m2 && /drive\.google\.com|googleusercontent/.test(url)) return m2[1];
  // explicit spec: gdrive:<ID>
  const m3 = /^gdrive:([A-Za-z0-9_-]+)$/.exec(url.trim());
  if (m3) return m3[1];
  return null;
}

export function sourceKind(url = templatesBaseUrl()): SourceKind {
  if (localTemplatesDir()) return "local";
  return driveFolderId(url) ? "gdrive" : "generic";
}

// --- desktop disk cache (best-effort; guarded so a missing fs permission or a
// browser context degrades to network/bundled instead of breaking) -----------

const cacheName = (relPath: string) => relPath.replace(/[/\\]+/g, "_");

async function cacheWrite(relPath: string, text: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { mkdir, writeTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    await mkdir(CACHE_DIR, { baseDir: BaseDirectory.AppData, recursive: true }).catch(() => {});
    await writeTextFile(`${CACHE_DIR}/${cacheName(relPath)}`, text, {
      baseDir: BaseDirectory.AppData,
    });
  } catch {
    /* caching is optional */
  }
}

async function cacheRead(relPath: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { readTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    return await readTextFile(`${CACHE_DIR}/${cacheName(relPath)}`, {
      baseDir: BaseDirectory.AppData,
    });
  } catch {
    return null;
  }
}

// --- local folder adapter (desktop) ------------------------------------------
// The author drops `.wadi` files into a local folder; we list + read it with the
// filesystem. `join` avoids assuming a path separator.

function joinPath(dir: string, name: string): string {
  return dir.replace(/[/\\]+$/, "") + (dir.includes("\\") ? "\\" : "/") + name;
}

async function localListFiles(dir: string): Promise<string[]> {
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(dir);
  return entries
    .filter((e) => e.isFile && isTemplateFile(e.name))
    .map((e) => e.name);
}

async function localReadFile(dir: string, relPath: string): Promise<string> {
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  return readTextFile(joinPath(dir, relPath));
}

async function localReadBytes(dir: string, relPath: string): Promise<Uint8Array> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  return readFile(joinPath(dir, relPath));
}

// --- Google Drive adapter ----------------------------------------------------

// name → fileId for the active Drive folder (built once per folder via the
// Drive files.list API; the folder must be shared "anyone with the link").
const driveIndexByFolder = new Map<string, Map<string, string>>();

async function driveFolderMap(folderId: string, apiKey: string): Promise<Map<string, string>> {
  const cached = driveIndexByFolder.get(folderId);
  if (cached) return cached;
  const map = new Map<string, string>();
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  let pageToken = "";
  do {
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${q}` +
      `&key=${encodeURIComponent(apiKey)}&fields=nextPageToken,files(id,name)` +
      `&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Drive list HTTP ${r.status}`);
    const data = (await r.json()) as {
      files?: { id: string; name: string }[];
      nextPageToken?: string;
    };
    for (const f of data.files ?? []) map.set(f.name, f.id);
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  driveIndexByFolder.set(folderId, map);
  return map;
}

async function driveFetchText(folderId: string, relPath: string): Promise<string> {
  const apiKey = driveApiKey();
  if (!apiKey) {
    throw new Error(
      "This Google Drive source needs an API key — set it in the template source settings.",
    );
  }
  const map = await driveFolderMap(folderId, apiKey);
  const id = map.get(relPath);
  if (!id) throw new Error(`"${relPath}" not found in the Drive folder`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(apiKey)}`,
  );
  if (!r.ok) throw new Error(`Drive get HTTP ${r.status}`);
  return r.text();
}

async function driveFetchBytes(folderId: string, relPath: string): Promise<Uint8Array> {
  const apiKey = driveApiKey();
  if (!apiKey) {
    throw new Error(
      "This Google Drive source needs an API key — set it in the template source settings.",
    );
  }
  const map = await driveFolderMap(folderId, apiKey);
  const id = map.get(relPath);
  if (!id) throw new Error(`"${relPath}" not found in the Drive folder`);
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(apiKey)}`,
  );
  if (!r.ok) throw new Error(`Drive get HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

// --- unified fetch (adapter dispatch + cache + fallback) ----------------------

// A remote catalog can be unreachable in ways that HANG rather than fail fast —
// a captive portal, a firewall doing TLS interception (e.g. FortiGuard web
// filter), or plain packet loss. Cap every remote fetch so a stuck request
// falls through to the bundled copy quickly instead of freezing the gallery.
const REMOTE_FETCH_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a catalog text resource (index.json / a .wadi), with cache + fallback.
 *  `relPath` is the file name relative to the catalog (e.g. "index.json",
 *  "single_story_cottage.wadi"). */
export async function fetchCatalogText(relPath: string): Promise<string> {
  // A browser folder (File System Access) reads through its directory handle.
  if (templateSource().kind === "browser-dir") return readModelsDirText(relPath);
  // A configured local folder (desktop) wins: read straight off disk.
  const localDir = localTemplatesDir();
  if (localDir) return localReadFile(localDir, relPath);

  const base = templatesBaseUrl();
  const folderId = driveFolderId(base);
  const remote = base !== BUNDLED_BASE;
  try {
    let text: string;
    if (folderId) {
      text = await driveFetchText(folderId, relPath);
    } else {
      const bust = `${relPath.includes("?") ? "&" : "?"}t=${Date.now()}`;
      const url = `${base}/${relPath}${bust}`;
      // Only time-box genuinely remote hosts; the bundled base is same-origin.
      const r = remote
        ? await fetchWithTimeout(url, REMOTE_FETCH_TIMEOUT_MS)
        : await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      text = await r.text();
    }
    void cacheWrite(relPath, text); // refresh the offline copy
    return text;
  } catch (err) {
    // Remote/offline miss (blocked, timed out, or offline) → last-known cache
    // (desktop) …
    const cached = await cacheRead(relPath);
    if (cached !== null) return cached;
    // … then the bundled copy shipped with the app, unless that's already what
    // we tried.
    if (remote) {
      const r = await fetch(`${BUNDLED_BASE}/${relPath}?t=${Date.now()}`);
      if (r.ok) return r.text();
    }
    throw err;
  }
}

/** Fetch a catalog file as raw BYTES — needed to detect a `.wadi` zip bundle by
 *  its magic bytes and to read its thumbnail files. Mirrors fetchCatalogText's
 *  adapter dispatch (local disk / Drive / static host); no offline text-cache
 *  (a zip isn't text) but keeps the bundled fallback for a remote miss. */
export async function fetchCatalogBytes(relPath: string): Promise<Uint8Array> {
  if (templateSource().kind === "browser-dir") return readModelsDirBytes(relPath);
  const localDir = localTemplatesDir();
  if (localDir) return localReadBytes(localDir, relPath);

  const base = templatesBaseUrl();
  const folderId = driveFolderId(base);
  const remote = base !== BUNDLED_BASE;
  if (folderId) return driveFetchBytes(folderId, relPath);
  try {
    const bust = `${relPath.includes("?") ? "&" : "?"}t=${Date.now()}`;
    const url = `${base}/${relPath}${bust}`;
    const r = remote
      ? await fetchWithTimeout(url, REMOTE_FETCH_TIMEOUT_MS)
      : await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  } catch (err) {
    if (remote) {
      const r = await fetch(`${BUNDLED_BASE}/${relPath}?t=${Date.now()}`);
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
    }
    throw err;
  }
}

// --- auto-indexing: the folder IS the catalog --------------------------------
// Instead of a hand-maintained index.json, the app LISTS the templates folder and
// builds each entry from the self-describing `.wadi` (its `template` block +
// derived counts). Listing is native where the platform supports it:
//   • local folder → filesystem readDir
//   • Google Drive → Drive files.list
//   • generic static host (bundled / R2) → a filenames-only manifest.json; falls
//     back to a legacy index.json's file list so existing catalogs keep working.

/** List the template config filenames in the active source. */
export async function listCatalogFiles(): Promise<string[]> {
  if (templateSource().kind === "browser-dir") return listModelsDirFiles();
  const localDir = localTemplatesDir();
  if (localDir) return localListFiles(localDir);

  const base = templatesBaseUrl();
  const folderId = driveFolderId(base);
  if (folderId) {
    const map = await driveFolderMap(folderId, driveApiKey());
    return [...map.keys()].filter(isTemplateFile);
  }

  // Generic static host: try the filenames manifest, then a legacy index.json.
  try {
    const manifest = JSON.parse(await fetchCatalogText("manifest.json")) as unknown;
    if (Array.isArray(manifest)) return manifest.filter((f): f is string => typeof f === "string" && isTemplateFile(f));
  } catch {
    /* no manifest — fall back to a legacy index */
  }
  const legacy = JSON.parse(await fetchCatalogText("index.json")) as { templates?: { file?: string }[] };
  return (legacy.templates ?? []).map((t) => t.file).filter((f): f is string => typeof f === "string");
}

/** Build the whole catalog. FAST path: a rich `catalog.json` (title + meta + a
 *  loose cover path per template, generated by scripts/gen-catalog-index.ts) is
 *  read in ONE fetch — no per-file download or WDL compile, ideal for a remote
 *  bucket of bundles. FALLBACK: list the folder and index each file (a `.wadi`
 *  BUNDLE from its wadi.json meta, a legacy JSON from its config) — used for a
 *  Drive/local source with no catalog.json, or an older catalog. */
export async function loadCatalog(): Promise<TemplateEntry[]> {
  const fast = await tryLoadCatalogIndex();
  if (fast) return fast;
  return loadCatalogByListing();
}

/** Read the rich catalog.json if present. Returns null when there isn't one (so
 *  the caller falls back to per-file indexing). */
async function tryLoadCatalogIndex(): Promise<TemplateEntry[] | null> {
  let text: string;
  try {
    text = await fetchCatalogText("catalog.json");
  } catch {
    return null; // no rich index — fall back to listing
  }
  try {
    const raw = JSON.parse(text) as unknown;
    if (!Array.isArray(raw)) return null;
    const entries = raw.filter(
      (e): e is TemplateEntry => !!e && typeof e === "object" && typeof (e as TemplateEntry).file === "string",
    );
    return entries.length ? entries.sort((a, b) => a.title.localeCompare(b.title)) : null;
  } catch {
    return null;
  }
}

async function loadCatalogByListing(): Promise<TemplateEntry[]> {
  const files = await listCatalogFiles();
  const entries: TemplateEntry[] = [];
  for (const file of files) {
    try {
      const id = file.replace(/\.(wadi|json)$/i, "");
      const bytes = await fetchCatalogBytes(file);
      const entry = isWadiBundle(bytes)
        ? await bundleEntry(id, file, bytes)
        : entryFromConfig(id, JSON.parse(textFromBytes(bytes)) as Record<string, unknown>, file);
      entries.push(entry);
    } catch {
      /* skip an unreadable/invalid file */
    }
  }
  // Stable, friendly order: by title.
  return entries.sort((a, b) => a.title.localeCompare(b.title));
}

function textFromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// Index a bundle from its manifest `meta` (fast, no compile). If a bundle lacks
// meta (hand-made, or an older bundle), fall back to a filename title.
async function bundleEntry(id: string, file: string, bytes: Uint8Array): Promise<TemplateEntry> {
  const man = (await readBundleManifest(bytes)) ?? {};
  const meta = man.meta as Partial<TemplateEntry> & TemplateEntry["meta"];
  if (meta && typeof meta === "object") {
    return {
      id,
      file,
      title: (meta as { title?: string }).title || titleCase(id),
      description: (meta as { description?: string }).description || "",
      meta: {
        bedrooms: numOr(meta.bedrooms, 0),
        bathrooms: numOr(meta.bathrooms, 0),
        floors: numOr(meta.floors, 1),
        style: (meta.style as string) || "—",
        roof: (meta.roof as string) || "—",
        minWidthFt: numOr(meta.minWidthFt, 30),
        minLengthFt: numOr(meta.minLengthFt, 40),
        parametric: !!meta.parametric,
        ...(Array.isArray(meta.tags) ? { tags: meta.tags as string[] } : {}),
      },
    };
  }
  return { id, file, title: titleCase(id), description: "", meta: {
    bedrooms: 0, bathrooms: 0, floors: 1, style: "—", roof: "—",
    minWidthFt: 30, minLengthFt: 40, parametric: false,
  } };
}

function numOr(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Drop any in-memory source state (Drive folder listing). Call on source change. */
export function resetCatalogSource(): void {
  driveIndexByFolder.clear();
}
