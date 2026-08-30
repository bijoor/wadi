import { validate, type HouseConfig } from "../schema/houseConfig";
import { isTauri } from "@tauri-apps/api/core";
import { open as tauriOpen, save as tauriSave } from "@tauri-apps/plugin-dialog";
import { readFile, writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { parseWadiBytes, buildWadiBundle, currentBundleThumbnails } from "./wadiBundle";

// Load result — filePath is populated only when running inside Tauri,
// so `saveConfig` can distinguish "Save" (write in place) from
// "Save As" (needs a picker).
export interface LoadResult {
  config: HouseConfig;
  filename: string;
  filePath: string | null;
  // The `.wdl` source, when the loaded `.wadi` was a bundle (its model.wdl).
  // Undefined for a legacy JSON `.wadi` (the store decompiles instead) — kept
  // verbatim so hand-authored WDL and comments round-trip.
  wdl?: string;
}

export async function pickAndLoadConfig(): Promise<LoadResult> {
  if (isTauri()) {
    const selected = await tauriOpen({
      title: "Open house",
      multiple: false,
      directory: false,
      filters: [{ name: "Wadi house", extensions: ["wadi", "json"] }],
    });
    if (!selected || typeof selected !== "string") {
      throw new Error("Cancelled");
    }
    const bytes = await readFile(selected);
    return parseWadiBytes(bytes, basename(selected), selected);
  }
  const file = await pickJsonFile();
  const bytes = new Uint8Array(await file.arrayBuffer());
  return parseWadiBytes(bytes, file.name, null);
}

// Load a config from a KNOWN absolute path (no picker) — used by the
// native file-association flow when the OS launches us with a .wadi file.
// Tauri-only (reads through the fs plugin). Sets filePath so the live
// watcher attaches to the opened file.
export async function loadConfigFromPath(path: string): Promise<LoadResult> {
  const bytes = await readFile(path);
  return parseWadiBytes(bytes, basename(path), path);
}

// Parse a `.wadi` from raw BYTES (bundle or legacy JSON) — no file picker.
// Used by the drag-and-drop loader, which reads the dropped File as an
// ArrayBuffer so a zip bundle can be detected by its magic bytes.
export function parseConfigBytes(
  bytes: Uint8Array,
  filename = "dropped.wadi",
): Promise<LoadResult> {
  return parseWadiBytes(bytes, filename, null);
}

// Parse a legacy JSON `.wadi` from TEXT into a LoadResult (no bundle handling).
// Kept for the paste-import fallback (iOS Safari can't reliably select a custom
// `.wadi` in its picker, so the user can paste the JSON contents) — a pasted zip
// can't survive as text, so this path stays JSON-only.
export function parseConfigText(text: string, filename = "pasted.wadi"): LoadResult {
  return parseWadiBytes_syncJson(text, filename);
}

function parseWadiBytes_syncJson(text: string, filename: string): LoadResult {
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
  return { config: result.data, filename, filePath: null };
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

// Build the `.wadi` bytes to write for a save. A `.wadi` is now a ZIP BUNDLE
// (wadi.json + model.wdl + thumbnails/); the WDL source is the truth, so callers
// pass the store's live `wdl`. If no WDL is available (an unexpected edge), we
// fall back to legacy JSON bytes so a save can never silently lose the model —
// the loader detects either form by magic bytes.
async function wadiBytesFor(config: HouseConfig, wdl?: string): Promise<Uint8Array> {
  const src = (wdl ?? "").trim();
  if (src) return buildWadiBundle(src, currentBundleThumbnails());
  return new TextEncoder().encode(serializeConfig(config));
}

// Save the house as a `.wadi` bundle.
// - In Tauri with `filePath`: writes in place (Save). Returns the same path.
// - In Tauri without `filePath`: shows native save dialog (Save As). Returns the chosen path.
// - In the browser: triggers a Blob download using `defaultName`. Returns null.
export async function saveConfig(
  config: HouseConfig,
  filePath: string | null,
  defaultName = "house.wadi",
  wdl?: string,
): Promise<string | null> {
  const bytes = await wadiBytesFor(config, wdl);
  const name = toWadiName(defaultName);
  if (isTauri()) {
    let target = filePath;
    if (!target) {
      const chosen = await tauriSave({
        title: "Save house",
        defaultPath: name,
        filters: [{ name: "Wadi house", extensions: ["wadi"] }],
      });
      if (!chosen) throw new Error("Cancelled");
      target = chosen;
    }
    await writeFile(target, bytes);
    return target;
  }
  downloadBytes(bytes, name);
  return null;
}

// Export the current house as a `.wadi` bundle — the shareable native document
// that double-clicks open in the desktop app. The bundle carries the WDL source
// plus its thumbnail files, self-contained. Tauri: native save dialog. Browser:
// Blob download. Returns the saved path (Tauri) or null (browser).
export async function saveAsWadi(config: HouseConfig, wdl?: string): Promise<string | null> {
  const bytes = await wadiBytesFor(config, wdl);
  return saveBinary(bytes, "house.wadi", "Wadi House", ["wadi"], "application/zip");
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

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
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

// Name for a shared file whose TYPE must be recognized by messengers/OS choosers.
// A .wadi is JSON, but the unknown ".wadi" extension makes WhatsApp/Android treat
// it as generic binary. Use a SINGLE, unambiguous ".json" — a double ".wadi.json"
// gets collapsed back to ".wadi" by some Android file managers, so drop ".wadi"
// entirely. The content is JSON; the reader accepts .json/.wadi/.wadi.json.
export function toShareName(name?: string | null): string {
  return toWadiName(name).replace(/\.wadi$/i, ".json");
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

// Save binary bytes (e.g. a generated PDF). Mirrors saveText: native Save
// dialog + writeFile inside Tauri, Blob download in a plain browser tab.
export async function saveBinary(
  bytes: Uint8Array,
  defaultName: string,
  filterName: string,
  extensions: string[],
  mimeType = "application/octet-stream",
): Promise<string | null> {
  if (isTauri()) {
    const chosen = await tauriSave({
      title: `Save ${filterName}`,
      defaultPath: defaultName,
      filters: [{ name: filterName, extensions }],
    });
    if (!chosen) throw new Error("Cancelled");
    await writeFile(chosen, bytes);
    return chosen;
  }
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
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
