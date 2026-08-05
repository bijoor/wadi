// Wadi WDL editor — reusable library CACHE.
//
// A library is a `.wdl` MODULE — top-level `component` / `asset` (and `import`)
// declarations, optionally with a demo `house` for preview — that another file
// pulls in with `import "name" as ns`. The primitives (grammar + compiler) already
// exist; this adds the missing STORAGE + RESOLUTION.
//
// ONE cache, ONE resolution path, both surfaces. A library is LOADED into the
// cache — by saving the current file, by opening a `.wdl`, or (desktop) by the
// folder auto-scan — and `resolveModule` reads the cache, so `import "name"`
// behaves identically in the browser and the Tauri app. The desktop folder-scan
// is just another loader feeding the same cache; resolution never diverges.
//
// resolveModule: cache → bundled std packs (std-furniture, konkan/base).

import { stdResolveModule } from "./std-modules";

const CACHE_KEY = "wadi.dsl.libraries";

export type LibOrigin = "saved" | "file";
export type CacheEntry = { source: string; origin: LibOrigin };
export type Cache = Record<string, CacheEntry>;

export function getCache(): Cache {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    if (!raw || typeof raw !== "object") return {};
    const out: Cache = {};
    for (const [k, v] of Object.entries(raw)) {
      // Back-compat with the first build, which stored `name → source` strings.
      if (typeof v === "string") out[k] = { source: v, origin: "saved" };
      else if (v && typeof v === "object" && typeof (v as { source?: unknown }).source === "string") {
        const e = v as { source: string; origin?: unknown };
        out[k] = { source: e.source, origin: e.origin === "file" ? "file" : "saved" };
      }
    }
    return out;
  } catch {
    return {};
  }
}
function setCache(c: Cache): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(c));
}

/** Put a library into the cache (last write wins by name). */
export function loadLibrary(name: string, source: string, origin: LibOrigin): void {
  const c = getCache();
  c[name] = { source, origin };
  setCache(c);
}
export function removeLibrary(name: string): void {
  const c = getCache();
  delete c[name];
  setCache(c);
}
export function getLibrarySource(name: string): string | undefined {
  return getCache()[name]?.source;
}

/** A module name as it appears in `import "name"` — a path-ish token, no spaces. */
export function isValidModuleName(name: string): boolean {
  return /^[A-Za-z0-9_][A-Za-z0-9_\-/]*$/.test(name);
}

function dirOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(0, i) : "";
}
export function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

/**
 * Desktop: load every `*.wdl` beside the open file (and in a `modules/` subfolder)
 * into the cache as `file`-origin entries, keyed by basename. The open file itself
 * is skipped (no self-import). Re-reads on each call, so a project's libraries stay
 * fresh. A no-op (and harmless) in the browser or when the FS is unavailable.
 */
export async function loadFolderLibraries(openFilePath: string | null): Promise<void> {
  if (!openFilePath) return;
  const dir = dirOf(openFilePath);
  if (!dir) return;
  try {
    const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
    const selfName = baseName(openFilePath);
    for (const root of [dir, `${dir}/modules`]) {
      let entries: { name?: string }[];
      try {
        entries = (await readDir(root)) as typeof entries;
      } catch {
        continue; // folder absent (e.g. no modules/) — fine
      }
      for (const e of entries) {
        if (!e.name || !e.name.endsWith(".wdl")) continue;
        if (root === dir && e.name === selfName) continue;
        try {
          loadLibrary(e.name.replace(/\.wdl$/, ""), await readTextFile(`${root}/${e.name}`), "file");
        } catch {
          /* transient / unreadable — skip */
        }
      }
    }
  } catch {
    /* not desktop, or fs plugin unavailable — the cache still works */
  }
}

/** The resolver passed to `compileDsl`: the cache, then the bundled std packs. */
export function resolveModule(ref: string): string | undefined {
  return getCache()[ref]?.source ?? stdResolveModule(ref);
}

export type LibEntry = { name: string; source: string; origin: LibOrigin };

/** Everything cached right now (for the Library menu). */
export function listLibraries(): LibEntry[] {
  return Object.entries(getCache())
    .map(([name, e]) => ({ name, source: e.source, origin: e.origin }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
