import { validate, type HouseConfig } from "../schema/houseConfig";
import { isTauri } from "@tauri-apps/api/core";
import { open as tauriOpen, save as tauriSave } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

// Load result — filePath is populated only when running inside Tauri,
// so `saveConfig` can distinguish "Save" (write in place) from
// "Save As" (needs a picker).
export interface LoadResult {
  config: HouseConfig;
  filename: string;
  filePath: string | null;
}

export async function pickAndLoadConfig(): Promise<LoadResult> {
  if (isTauri()) {
    const selected = await tauriOpen({
      title: "Open house config",
      multiple: false,
      directory: false,
      filters: [{ name: "Wadi house", extensions: ["wadi", "json"] }],
    });
    if (!selected || typeof selected !== "string") {
      throw new Error("Cancelled");
    }
    const text = await readTextFile(selected);
    return parseAndValidate(text, basename(selected), selected);
  }
  const file = await pickJsonFile();
  const text = await file.text();
  return parseAndValidate(text, file.name, null);
}

// Load a config from a KNOWN absolute path (no picker) — used by the
// native file-association flow when the OS launches us with a .wadi file.
// Tauri-only (reads through the fs plugin). Sets filePath so the live
// watcher attaches to the opened file.
export async function loadConfigFromPath(path: string): Promise<LoadResult> {
  const text = await readTextFile(path);
  return parseAndValidate(text, basename(path), path);
}

function parseAndValidate(
  text: string,
  filename: string,
  filePath: string | null,
): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const result = validate(parsed);
  if (!result.ok || !result.data) {
    const errList = (result.errors ?? []).slice(0, 5);
    const details = errList.map((e) => `  /${e.path}: ${e.message}`).join("\n");
    throw new Error(
      `Config failed schema validation (${result.errors?.length} error${
        result.errors?.length === 1 ? "" : "s"
      }):\n${details}${
        (result.errors?.length ?? 0) > errList.length ? "\n  …" : ""
      }`,
    );
  }
  return { config: result.data, filename, filePath };
}

function pickJsonFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json,.wadi";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }
      resolve(file);
    });
    input.addEventListener("cancel", () => reject(new Error("Cancelled")));
    input.click();
  });
}

// Serialize with 2-space indent + trailing newline — matches the
// Python extractor so diffs against the repo copy stay clean.
// Exported so the config watcher can compare on-disk content against
// the current in-memory config and skip reloads caused by our own saves.
export function serializeConfig(config: HouseConfig): string {
  const clean = { ...config };
  delete (clean as { _walls_expanded?: boolean })._walls_expanded;
  return JSON.stringify(clean, null, 2) + "\n";
}

// Save the config.
// - In Tauri with `filePath`: writes in place (Save). Returns the same path.
// - In Tauri without `filePath`: shows native save dialog (Save As). Returns the chosen path.
// - In the browser: triggers a Blob download using `defaultName`. Returns null.
export async function saveConfig(
  config: HouseConfig,
  filePath: string | null,
  defaultName = "house.wadi",
): Promise<string | null> {
  const text = serializeConfig(config);
  if (isTauri()) {
    let target = filePath;
    if (!target) {
      const chosen = await tauriSave({
        title: "Save house",
        defaultPath: toWadiName(defaultName),
        filters: [{ name: "Wadi house", extensions: ["wadi"] }],
      });
      if (!chosen) throw new Error("Cancelled");
      target = chosen;
    }
    await writeTextFile(target, text);
    return target;
  }
  downloadBlob(text, toWadiName(defaultName));
  return null;
}

// Export the current house as a `.wadi` file — the shareable native
// document that double-clicks open in the desktop app. The payload is
// plain house_config JSON (same bytes as Save), so the app's existing
// load/validate/watch path handles it unchanged; only the extension +
// OS file association make it special. Tauri: native save dialog. Browser:
// Blob download. Returns the saved path (Tauri) or null (browser).
export async function saveAsWadi(config: HouseConfig): Promise<string | null> {
  return saveText(
    serializeConfig(config),
    "house.wadi",
    "Wadi House",
    ["wadi"],
    "application/json",
  );
}

// Kept as an alias so any lingering call sites that only care about
// browser-style download don't break. New code should call saveConfig.
export function downloadConfig(config: HouseConfig, filename = "house.wadi") {
  downloadBlob(serializeConfig(config), toWadiName(filename));
}

function downloadBlob(text: string, filename: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

// Normalize any prior filename or display label to a clean `.wadi`
// filename. `.wadi` is THE house-document format now; `.json` is legacy.
// Strips a parenthetical annotation ("house_config.json (from repo)",
// "Blank House (template)"), any directory, and a trailing
// .wadi.json / .json / .wadi, then appends `.wadi`.
export function toWadiName(name?: string | null): string {
  let base = (name ?? "").trim().replace(/\s*\([^)]*\)\s*$/, "");
  base = basename(base)
    .replace(/\.wadi\.json$/i, "")
    .replace(/\.json$/i, "")
    .replace(/\.wadi$/i, "")
    .trim();
  return `${base || "house"}.wadi`;
}

// Generic text-save. Tauri: native save dialog + writeTextFile.
// Browser: Blob download. Returns the saved absolute path in Tauri,
// null in the browser. Rejects with Error("Cancelled") if the user
// dismisses the dialog.
export async function saveText(
  text: string,
  defaultName: string,
  filterName: string,
  extensions: string[],
  mimeType = "text/plain",
): Promise<string | null> {
  if (isTauri()) {
    const chosen = await tauriSave({
      title: `Save ${filterName}`,
      defaultPath: defaultName,
      filters: [{ name: filterName, extensions }],
    });
    if (!chosen) throw new Error("Cancelled");
    await writeTextFile(chosen, text);
    return chosen;
  }
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return null;
}
