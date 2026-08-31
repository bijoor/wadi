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
  createWritable(opts?: { keepExistingData?: boolean }): Promise<FsWritable>;
  getFile(): Promise<File>;
  queryPermission?(d: { mode: "read" | "readwrite" }): Promise<FsPermissionState>;
  requestPermission?(d: { mode: "read" | "readwrite" }): Promise<FsPermissionState>;
}
interface FsPickerWindow {
  showOpenFilePicker?(opts?: unknown): Promise<FsFileHandle[]>;
  showSaveFilePicker?(opts?: unknown): Promise<FsFileHandle>;
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
