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
import { entryFromConfig, type TemplateEntry } from "../templatePackage/catalogMeta";

// Baked-in remote catalog: the Cloudflare R2 bucket on our custom domain. Serves
// index.json + the template .wadi files with CORS `*`, so the web app, the
// tauri:// desktop app, and dev all read it. A user override in localStorage
// still wins; if this host is unreachable, fetches fall back to the bundled copy.
export const REMOTE_TEMPLATES_URL = "https://templates.wadi.house";

const BUNDLED_BASE = "/templates";
const OVERRIDE_KEY = "wadi.templatesUrl";
const DRIVE_KEY_KEY = "wadi.driveApiKey";
const LOCAL_DIR_KEY = "wadi.templatesDir";
const CACHE_DIR = "templates-cache";

const isTemplateFile = (name: string) =>
  /\.(wadi|json)$/i.test(name) && name !== "index.json" && name !== "manifest.json";

/** A local templates FOLDER (desktop only): the author manages `.wadi` files in
 *  it with Finder, and the app lists + indexes it — no publish, no index file.
 *  This is the same folder the Publish panel saves into. Empty string → unset. */
export function localTemplatesDir(): string {
  if (!isTauri()) return "";
  try {
    return localStorage.getItem(LOCAL_DIR_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}
export function setLocalTemplatesDir(dir: string | null): void {
  try {
    if (dir && dir.trim()) localStorage.setItem(LOCAL_DIR_KEY, dir.trim());
    else localStorage.removeItem(LOCAL_DIR_KEY);
  } catch {
    /* ignore */
  }
}

const stripTrailingSlash = (u: string) => u.replace(/\/+$/, "");

/** The active catalog source URL (no trailing slash). */
export function templatesBaseUrl(): string {
  try {
    const override = localStorage.getItem(OVERRIDE_KEY);
    if (override && override.trim()) return stripTrailingSlash(override.trim());
  } catch {
    /* localStorage blocked — ignore */
  }
  return REMOTE_TEMPLATES_URL ? stripTrailingSlash(REMOTE_TEMPLATES_URL) : BUNDLED_BASE;
}

/** Persist a user override (empty string clears it → back to the default). */
export function setTemplatesBaseUrl(url: string | null): void {
  try {
    if (url && url.trim()) localStorage.setItem(OVERRIDE_KEY, stripTrailingSlash(url.trim()));
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

/** Google API key used by the Drive adapter (read of public files). */
export function driveApiKey(): string {
  try {
    return localStorage.getItem(DRIVE_KEY_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}
export function setDriveApiKey(key: string | null): void {
  try {
    if (key && key.trim()) localStorage.setItem(DRIVE_KEY_KEY, key.trim());
    else localStorage.removeItem(DRIVE_KEY_KEY);
  } catch {
    /* ignore */
  }
}

/** True when the catalog is served from somewhere other than the bundled copy. */
export function isRemoteCatalog(): boolean {
  return templatesBaseUrl() !== BUNDLED_BASE;
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

/** Build the whole catalog by listing the folder and indexing each file. A file
 *  that fails to parse is skipped (it never blanks the gallery). */
export async function loadCatalog(): Promise<TemplateEntry[]> {
  const files = await listCatalogFiles();
  const entries: TemplateEntry[] = [];
  for (const file of files) {
    try {
      const cfg = JSON.parse(await fetchCatalogText(file)) as Record<string, unknown>;
      const id = file.replace(/\.(wadi|json)$/i, "");
      entries.push(entryFromConfig(id, cfg, file));
    } catch {
      /* skip an unreadable/invalid file */
    }
  }
  // Stable, friendly order: by title.
  return entries.sort((a, b) => a.title.localeCompare(b.title));
}

/** Drop any in-memory source state (Drive folder listing). Call on source change. */
export function resetCatalogSource(): void {
  driveIndexByFolder.clear();
}
