// File System Access API integration (Chromium browsers) so the WEB app can OPEN
// and SAVE `.wadi` files anywhere the OS exposes — including cloud SYNC folders
// (Google Drive for Desktop, OneDrive, iCloud Drive, Dropbox). The provider syncs
// the file; Wadi never touches an OAuth flow. This is the "sync-folders first"
// cloud story for the browser (Tauri already writes to any local path natively).
//
// It also keeps the picked file's handle, so a subsequent Save writes back to the
// SAME file (a real "Save", not another download). Unsupported browsers (Safari,
// Firefox) fall back to the Blob download / file-input path in fileIO.ts.

// Minimal ambient shapes — declared locally so the build doesn't depend on the
// DOM lib's optional File System Access typings.
type FsPermissionState = "granted" | "denied" | "prompt";
interface FsWritable {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  name: string;
  kind?: "file";
  createWritable(opts?: { keepExistingData?: boolean }): Promise<FsWritable>;
  getFile(): Promise<File>;
  queryPermission?(d: { mode: "read" | "readwrite" }): Promise<FsPermissionState>;
  requestPermission?(d: { mode: "read" | "readwrite" }): Promise<FsPermissionState>;
}
interface FsDirHandle {
  name: string;
  kind: "directory";
  values(): AsyncIterableIterator<FsFileHandle | FsDirHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  queryPermission?(d: { mode: "read" | "readwrite" }): Promise<FsPermissionState>;
  requestPermission?(d: { mode: "read" | "readwrite" }): Promise<FsPermissionState>;
}
interface FsPickerWindow {
  showOpenFilePicker?(opts?: unknown): Promise<FsFileHandle[]>;
  showSaveFilePicker?(opts?: unknown): Promise<FsFileHandle>;
  showDirectoryPicker?(opts?: unknown): Promise<FsDirHandle>;
}

const fsWin = (): FsPickerWindow => window as unknown as FsPickerWindow;

/** True when the browser can open/save via the File System Access API. */
export function supportsFsAccess(): boolean {
  const w = fsWin();
  return typeof w.showOpenFilePicker === "function" && typeof w.showSaveFilePicker === "function";
}

// The handle of the file currently open/saved in this session, so Save can write
// back in place. Set only by the two pickers below; a load without a handle
// (drag-drop) leaves it null, and fileIO gates in-place Save on hasCurrentHandle().
let currentHandle: FsFileHandle | null = null;

export function hasCurrentHandle(): boolean {
  return currentHandle !== null;
}
export function currentHandleName(): string | null {
  return currentHandle?.name ?? null;
}
export function clearCurrentHandle(): void {
  currentHandle = null;
}

const WADI_TYPES = [
  { description: "Wadi house", accept: { "application/octet-stream": [".wadi"], "application/json": [".json"] } },
];

// A shared picker id so the browser REMEMBERS the last folder across sessions (and
// between Open and Save) — so a user who navigates to their Drive/OneDrive sync
// folder once lands back there next time. `startIn` seeds the very first use.
const PICKER_ID = "wadi-house";

// Ensure we may WRITE to a handle (a fresh picker handle is already granted;
// this covers a re-save later in the session). Returns false if the user denies.
async function ensureWritable(h: FsFileHandle): Promise<boolean> {
  if (!h.queryPermission || !h.requestPermission) return true;
  if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await h.requestPermission({ mode: "readwrite" })) === "granted";
}

/** Open a `.wadi` via the OS picker (cloud sync folders included). Reads its bytes
 *  and remembers the handle so Save writes back to the same file. */
export async function openWadiViaPicker(): Promise<{ bytes: Uint8Array; name: string }> {
  const handles = await fsWin().showOpenFilePicker!({
    id: PICKER_ID,
    startIn: "documents",
    types: WADI_TYPES,
    multiple: false,
    excludeAcceptAllOption: false,
  });
  const handle = handles[0];
  const file = await handle.getFile();
  const bytes = new Uint8Array(await file.arrayBuffer());
  currentHandle = handle;
  return { bytes, name: handle.name };
}

/** Save-As via the OS picker (choose any location, incl. a cloud sync folder).
 *  Writes the bytes and remembers the handle for later in-place Saves. */
export async function saveWadiViaPicker(bytes: Uint8Array, suggestedName: string): Promise<string> {
  const handle = await fsWin().showSaveFilePicker!({
    id: PICKER_ID,
    startIn: "documents",
    suggestedName,
    types: WADI_TYPES,
    excludeAcceptAllOption: false,
  });
  await writeHandle(handle, bytes);
  currentHandle = handle;
  return handle.name;
}

/** Write the bytes back to the currently open file (a real "Save"). Throws if no
 *  handle is held or write permission is denied. */
export async function saveWadiToCurrentHandle(bytes: Uint8Array): Promise<string> {
  if (!currentHandle) throw new Error("No open file to save to");
  await writeHandle(currentHandle, bytes);
  return currentHandle.name;
}

async function writeHandle(h: FsFileHandle, bytes: Uint8Array): Promise<void> {
  if (!(await ensureWritable(h))) throw new Error("Write permission denied");
  const w = await h.createWritable();
  await w.write(new Blob([bytes as BlobPart], { type: "application/zip" }));
  await w.close();
}

// ============================================================================
// DIRECTORY source — a whole FOLDER as the models catalog (Chromium). The user
// picks a folder once (e.g. a Google Drive sync folder); we list its .wadi files
// in the gallery, open them, and Save writes back to the same file. The folder
// handle is persisted in IndexedDB so it survives reloads (a return visit needs a
// one-time permission re-grant, which requires a user gesture).
// ============================================================================

export function supportsDirectoryPicker(): boolean {
  return typeof fsWin().showDirectoryPicker === "function";
}

let modelsDir: FsDirHandle | null = null;

// --- tiny IndexedDB kv, just to persist the directory handle (handles are
//     structured-cloneable, so they store/restore directly). ---
const IDB_NAME = "wadi-fs";
const IDB_STORE = "handles";
const DIR_KEY = "models-dir";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await idb();
  try {
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}
async function idbGet<T>(key: string): Promise<T | null> {
  const db = await idb();
  try {
    return await new Promise<T | null>((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const r = tx.objectStore(IDB_STORE).get(key);
      r.onsuccess = () => res((r.result as T) ?? null);
      r.onerror = () => rej(r.error);
    });
  } finally {
    db.close();
  }
}
async function idbDel(key: string): Promise<void> {
  const db = await idb();
  try {
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

export function hasModelsDir(): boolean {
  return modelsDir !== null;
}
export function modelsDirName(): string | null {
  return modelsDir?.name ?? null;
}

/** Pick a folder as the models source (Chromium). Persists the handle so it
 *  survives reloads. Returns the folder name, or null if the user cancelled. */
export async function pickModelsDirectory(): Promise<string | null> {
  try {
    const dir = await fsWin().showDirectoryPicker!({ id: PICKER_ID, mode: "readwrite", startIn: "documents" });
    modelsDir = dir;
    try { await idbSet(DIR_KEY, dir); } catch { /* private window — memory-only */ }
    return dir.name;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return null;
    throw e;
  }
}

/** Restore a previously-picked folder from IndexedDB (no permission request).
 *  Returns the folder name if one was stored, else null. */
export async function restoreModelsDirectory(): Promise<string | null> {
  if (modelsDir) return modelsDir.name;
  try {
    const dir = await idbGet<FsDirHandle>(DIR_KEY);
    if (dir && dir.kind === "directory") { modelsDir = dir; return dir.name; }
  } catch { /* ignore */ }
  return null;
}

/** Forget the models folder (memory + IndexedDB). */
export async function clearModelsDir(): Promise<void> {
  modelsDir = null;
  try { await idbDel(DIR_KEY); } catch { /* ignore */ }
}

/** True when a folder is selected but not yet readable this session (a return
 *  visit needs a one-time re-grant). Query only — no gesture required. */
export async function modelsDirNeedsPermission(): Promise<boolean> {
  if (!modelsDir) await restoreModelsDirectory();
  if (!modelsDir || !modelsDir.queryPermission) return false;
  return (await modelsDir.queryPermission({ mode: "read" })) !== "granted";
}

/** Re-grant read permission to the folder. MUST be called from a user gesture. */
export async function reconnectModelsDir(): Promise<boolean> {
  if (!modelsDir) await restoreModelsDirectory();
  if (!modelsDir) return false;
  if (!modelsDir.requestPermission) return true;
  return (await modelsDir.requestPermission({ mode: "read" })) === "granted";
}

async function ensureDirRead(): Promise<void> {
  if (!modelsDir) await restoreModelsDirectory();
  if (!modelsDir) throw new Error("No models folder selected.");
  if (modelsDir.queryPermission && (await modelsDir.queryPermission({ mode: "read" })) !== "granted") {
    throw new Error("Permission needed — click 📁 Change folder to reconnect this folder.");
  }
}

const isModelFile = (name: string): boolean =>
  /\.(wadi|json)$/i.test(name) &&
  name !== "index.json" && name !== "manifest.json" && name !== "catalog.json";

/** List the model file names (.wadi / .json) directly in the folder. */
export async function listModelsDirFiles(): Promise<string[]> {
  await ensureDirRead();
  const names: string[] = [];
  for await (const entry of modelsDir!.values()) {
    if (entry.kind !== "directory" && isModelFile(entry.name)) names.push(entry.name);
  }
  return names;
}

async function dirFileHandle(name: string): Promise<FsFileHandle> {
  await ensureDirRead();
  return modelsDir!.getFileHandle(name);
}

export async function readModelsDirBytes(name: string): Promise<Uint8Array> {
  const f = await (await dirFileHandle(name)).getFile();
  return new Uint8Array(await f.arrayBuffer());
}
export async function readModelsDirText(name: string): Promise<string> {
  return (await (await dirFileHandle(name)).getFile()).text();
}

/** Adopt a folder file as the current save target, so a later Save writes back to
 *  THIS file (in place) rather than opening a Save-As picker. */
export async function adoptModelsDirFile(name: string): Promise<void> {
  currentHandle = await dirFileHandle(name);
}
