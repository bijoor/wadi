// Live config watcher — the "Claude as editor" half of the Phase 2
// live-preview loop (see plans/claude-skill-plan.md).
//
// When something OUTSIDE the app rewrites the house config on disk
// (Claude Code editing the file, an MCP server, a manual save from
// another tool), this watcher notices and reloads the model so the
// Tauri window updates without any user action.
//
// Strictly event-driven — no polling anywhere. We attach the fs
// plugin's native `watch()` (backed by the OS's file-change
// notifications via the Rust `notify` crate) to the absolute path of
// the file the user opened via the native Load dialog (`filePath`).
// Works in BOTH `tauri dev` and the installed/DMG app: whoever edits
// the config writes THIS path, and the OS pushes us an event.
//
// NOTE: the native `watch()`/`unwatch()` commands only exist when the
// `tauri-plugin-fs` crate is built with its `watch` feature enabled
// (see src-tauri/Cargo.toml). Without it, `watch()` rejects with
// "Command watch not found" and live reload silently no-ops.
//
// The startup model is auto-loaded over HTTP with no `filePath` (see
// main.ts). That is a ONE-SHOT read and is intentionally NOT watched:
// there is no local file handle behind an `http://…/house_config.json`
// URL to attach `notify` to, and polling it was just dead weight (a
// no-op against the frozen bundle in the installed app). To get live
// reloads, open the working file via Load — that sets `filePath` and
// this watcher attaches a native watch to it.
//
// Only runs inside Tauri; in a plain browser tab there's no local file
// to watch and fetch already returns the served copy.

import { isTauri } from "@tauri-apps/api/core";
import { readFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { useConfigStore } from "../state/configStore";
import { serializeConfig, parseConfigBytes } from "../io/fileIO";

const WATCH_DEBOUNCE_MS = 300;

// Cheap FNV-1a signature of the raw bytes, so a change event whose content is
// unchanged (or matches our own last save) is skipped without a full unzip +
// compile. `.wadi` is now a zip bundle, so we compare bytes, not decoded text.
function byteSig(bytes: Uint8Array): string {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return `${bytes.length}:${(h >>> 0).toString(16)}`;
}

export function startConfigWatcher(): void {
  // In a plain browser the fs plugin isn't available and there's no
  // external file to reconcile against — the served copy IS the source.
  if (!isTauri()) return;

  // Signature of the raw bytes we last saw on disk. Used to skip the expensive
  // unzip+compile when a change event fires but the content is unchanged. Reset
  // to null whenever the watched target changes so the new target is read fresh.
  let lastSeen: string | null = null;
  let inFlight = false;
  // A change event that arrives while a read is still in flight sets
  // this so we re-read once the current read settles — without it, the
  // final write in a rapid burst could be dropped (no next poll to
  // self-correct in a pure event-driven model).
  let pending = false;
  let unwatch: UnwatchFn | null = null;

  const applyBytes = async (path: string, bytes: Uint8Array): Promise<void> => {
    const sig = byteSig(bytes);
    if (sig === lastSeen) return; // unchanged since last read
    lastSeen = sig;

    const state = useConfigStore.getState();

    // The file may be caught mid-write (a partial zip / partial JSON) or hold an
    // intermediate state that doesn't compile yet. In both cases we skip this
    // revision and wait for the next change rather than flashing a broken model.
    // `.wadi` is a zip BUNDLE now (or a legacy JSON config); parseConfigBytes
    // detects which by magic bytes and returns the model + its WDL source.
    let loaded;
    try {
      // Pass the model's current modules so a watched plain `.wdl` that imports them
      // recompiles (a bundle carries its own and ignores this).
      loaded = await parseConfigBytes(bytes, state.filename ?? "house.wadi", state.modules);
    } catch (e) {
      console.warn(
        "[watch] config not loadable yet; waiting for next write:",
        e instanceof Error ? e.message : String(e),
      );
      return;
    }

    // Skip reloads triggered by the app's OWN save. Comparing raw bytes is
    // unreliable (the zip re-encode may differ byte-for-byte), so compare the
    // MODEL: if the file's WDL (bundle) or serialized config (legacy) already
    // matches the current model, there's nothing external to apply. (Without
    // this, an in-app Save bounces back through the watcher and wipes the undo
    // history for no reason.)
    if (state.config) {
      const sameByWdl =
        loaded.wdl != null && state.wdl != null && loaded.wdl.trim() === state.wdl.trim();
      const sameByJson =
        loaded.wdl == null &&
        serializeConfig(loaded.config).trim() === serializeConfig(state.config).trim();
      if (sameByWdl || sameByJson) return;
    }

    console.info("[watch] external config change → reloading model");
    useConfigStore
      .getState()
      // A bundle declares its modules (replace); a plain `.wdl` carries none, so keep
      // the model's current list (the user's added modules survive an external edit).
      .loadConfig(
        loaded.config,
        state.filename ?? "house.wadi",
        path,
        loaded.wdl,
        loaded.modules ?? state.modules,
      );
  };

  const readAndApply = async (path: string): Promise<void> => {
    if (inFlight) {
      // A read is already running; remember to re-read after it settles
      // so we never miss the latest write in a burst.
      pending = true;
      return;
    }
    inFlight = true;
    try {
      const bytes = await readFile(path);
      await applyBytes(path, bytes);
    } catch (e) {
      // Transient read errors (file briefly missing during an atomic
      // rename). Stay quiet-ish; the next change event will retry.
      console.warn(
        "[watch] read error (transient?):",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      inFlight = false;
      if (pending) {
        pending = false;
        void readAndApply(path);
      }
    }
  };

  const stopWatching = (): void => {
    if (unwatch) {
      unwatch();
      unwatch = null;
    }
  };

  const applyTarget = (path: string | null): void => {
    stopWatching();
    lastSeen = null;
    pending = false;

    // No file open → nothing to watch. The startup model is auto-loaded
    // over HTTP (no filePath) and is intentionally left static; open a
    // file via Load to get live, event-driven reloads.
    if (!path) return;

    void watch(path, () => void readAndApply(path), { delayMs: WATCH_DEBOUNCE_MS })
      .then((stop) => {
        unwatch = stop;
      })
      .catch((e) => {
        // Native watch couldn't start (e.g. the plugin's `watch` feature
        // isn't compiled in, or an unsupported filesystem). We do NOT
        // fall back to polling — the model stays on its last-loaded
        // state until you reload it. Surfaced here so the silence has an
        // explanation rather than looking like a bug.
        console.warn(
          "[watch] native watch failed to start; live reload disabled for",
          path,
          e instanceof Error ? e.message : String(e),
        );
      });
  };

  let watchedPath = useConfigStore.getState().filePath;
  applyTarget(watchedPath);

  // If the user opens a different file (filePath changes), tear down
  // the current watcher and re-attach to the new target.
  useConfigStore.subscribe((state) => {
    if (state.filePath !== watchedPath) {
      watchedPath = state.filePath;
      applyTarget(watchedPath);
    }
  });

  console.info(
    "[watch] live config watcher started (native fs watch, event-driven, " +
      "no polling). Open your working house_config.json via Load to watch " +
      "an external file.",
  );
}
