// User-authored reusable libraries for the WDL editor.
//
// A library is just a `.wdl` MODULE — top-level `component` / `asset` (and
// `import`) declarations, optionally with a demo `house` for preview — that
// another file pulls in with `import "name" as ns`. The primitives already exist
// (grammar + compiler); this adds the missing STORAGE + RESOLUTION so a user can
// save their own and have the editor find them.
//
// Two complementary, feature-compatible stores:
//   • SHELF — a named collection in localStorage. Works identically in the
//     browser and the desktop app; the baseline everywhere.
//   • FILES — desktop only: every `.wdl` beside the open file (and in a `modules/`
//     subfolder) is importable by its basename. Real files you can commit/share
//     and the agent + MCP can read.
//
// `resolveModule` consults them most-specific-first: project files → app shelf →
// bundled std packs (std-furniture, konkan/base).

import { stdResolveModule } from "./std-modules";

const SHELF_KEY = "wadi.dsl.libraries";

export type Shelf = Record<string, string>;

export function getShelf(): Shelf {
  try {
    const v = JSON.parse(localStorage.getItem(SHELF_KEY) || "{}");
    return v && typeof v === "object" ? (v as Shelf) : {};
  } catch {
    return {};
  }
}
function setShelf(s: Shelf): void {
  localStorage.setItem(SHELF_KEY, JSON.stringify(s));
}
export function saveToShelf(name: string, source: string): void {
  const s = getShelf();
  s[name] = source;
  setShelf(s);
}
export function deleteFromShelf(name: string): void {
  const s = getShelf();
  delete s[name];
  setShelf(s);
}

// A module name as it appears in `import "name"` — a path-ish token (letters,
// digits, _ - and /), no spaces. Mirrors how the bundled refs look ("konkan/base").
export function isValidModuleName(name: string): boolean {
  return /^[A-Za-z0-9_][A-Za-z0-9_\-/]*$/.test(name);
}

// ---- Desktop filesystem modules --------------------------------------------
// A sync cache (name → source) so the SYNCHRONOUS compile can resolve them;
// refreshed asynchronously from disk whenever the open file (or its folder)
// changes. Empty (and untouched) in the browser.
let fileModules: Record<string, string> = {};

/** The parent directory of an absolute file path (posix or windows separators). */
function dirOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(0, i) : "";
}
function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return (i >= 0 ? path.slice(i + 1) : path);
}

/**
 * Reload the filesystem module cache from the open file's folder and its
 * `modules/` subfolder. Every `*.wdl` there (except the open file itself — a file
 * can't import itself) becomes importable by its basename. Desktop only; a no-op
 * (and clears the cache) when there's no open file or the FS is unavailable.
 */
export async function reloadFileModules(openFilePath: string | null): Promise<void> {
  fileModules = {};
  if (!openFilePath) return;
  const dir = dirOf(openFilePath);
  if (!dir) return;
  try {
    const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
    const selfName = baseName(openFilePath);
    for (const root of [dir, `${dir}/modules`]) {
      let entries: { name: string; isFile?: boolean }[];
      try {
        entries = (await readDir(root)) as typeof entries;
      } catch {
        continue; // folder doesn't exist (e.g. no modules/) — fine
      }
      for (const e of entries) {
        if (!e.name || !e.name.endsWith(".wdl")) continue;
        if (root === dir && e.name === selfName) continue; // don't import self
        try {
          fileModules[e.name.replace(/\.wdl$/, "")] = await readTextFile(`${root}/${e.name}`);
        } catch {
          /* transient / unreadable — skip */
        }
      }
    }
  } catch {
    /* not desktop, or fs plugin unavailable — shelf still works */
  }
}

// ---- Resolution + listing ---------------------------------------------------

/** The resolver passed to `compileDsl`: project files → app shelf → bundled std. */
export function resolveModule(ref: string): string | undefined {
  return fileModules[ref] ?? getShelf()[ref] ?? stdResolveModule(ref);
}

export type LibEntry = { name: string; source: string; origin: "file" | "shelf" };

/** Everything importable right now (for the Library menu), files shadowing shelf. */
export function listLibraries(): LibEntry[] {
  const out: LibEntry[] = [];
  for (const [name, source] of Object.entries(fileModules)) out.push({ name, source, origin: "file" });
  for (const [name, source] of Object.entries(getShelf())) {
    if (!(name in fileModules)) out.push({ name, source, origin: "shelf" });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
