// Live config watcher — the "Claude as editor" half of the Phase 2
// live-preview loop (see plans/claude-skill-plan.md).
//
// When something OUTSIDE the app rewrites the house config on disk
// (Claude Code editing the file, an MCP server, a manual save from
// another tool), this poller notices and reloads the model so the
// Tauri window updates without any user action.
//
// Two watch strategies, picked per-tick from the store state:
//
//  1. filePath set  — the user opened an external working file via the
//     native dialog. Poll that absolute path through the Tauri fs
//     plugin. Works in BOTH `tauri dev` and the installed/DMG app, and
//     is the documented file-path contract: whoever edits the config
//     writes THIS path.
//  2. filePath null — the config was auto-loaded over HTTP from the
//     bundled/served docs/ copy. Poll that same URL. In `tauri dev`
//     the server serves the live docs/house_config.json (no-cache), so
//     auto-loaded sessions still go live. In the installed app the
//     bundled copy is frozen, so this simply never fires — harmless.
//
// Only runs inside Tauri; in a plain browser tab there's no local file
// to watch and fetch already returns the served copy.

import { isTauri } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useConfigStore } from "../state/configStore";
import { validate } from "../schema/houseConfig";
import { serializeConfig } from "../io/fileIO";

const POLL_MS = 700;
const CONFIG_URL = "house_config.json";

export function startConfigWatcher(): void {
  // In a plain browser the fs plugin isn't available and there's no
  // external file to reconcile against — the served copy IS the source.
  if (!isTauri()) return;

  // Last raw text we've seen on disk/over HTTP. Used to skip the
  // expensive parse+validate when nothing changed between ticks. Reset
  // to null whenever the watched target changes so the new target is
  // read fresh.
  let lastSeen: string | null = null;
  let watchedPath = useConfigStore.getState().filePath;
  let inFlight = false;

  // If the user opens a different file (filePath changes), drop the
  // baseline so we re-read the new target immediately.
  useConfigStore.subscribe((state) => {
    if (state.filePath !== watchedPath) {
      watchedPath = state.filePath;
      lastSeen = null;
    }
  });

  const tick = async (): Promise<void> => {
    if (inFlight) return; // a slow read is still running; skip this beat
    inFlight = true;
    try {
      const state = useConfigStore.getState();
      const path = state.filePath;
      const text = path
        ? await readTextFile(path)
        : await fetch(`${CONFIG_URL}?t=${Date.now()}`).then((r) =>
            r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)),
          );

      if (text === lastSeen) return; // unchanged since last poll
      lastSeen = text;

      // Skip reloads triggered by the app's OWN save: if the on-disk
      // text already matches what we'd serialize from the current
      // config, there's nothing external to apply. (Without this, an
      // in-app Save would bounce back through the watcher and wipe the
      // selection + undo history for no reason.)
      if (state.config && text.trim() === serializeConfig(state.config).trim()) {
        return;
      }

      // The file may be caught mid-write (partial JSON) or hold an
      // intermediate state that doesn't validate yet. In both cases we
      // skip this revision and wait for the next poll rather than
      // flashing a broken model — matches the plan's "ignore invalid
      // intermediate states" rule.
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        console.warn("[watch] config not parseable yet; waiting for next write");
        return;
      }
      const parsed = validate(raw);
      if (!parsed.ok || !parsed.data) {
        console.warn(
          "[watch] external config failed validation; keeping current model",
          parsed.errors,
        );
        return;
      }

      console.info("[watch] external config change → reloading model");
      useConfigStore
        .getState()
        .loadConfig(parsed.data, state.filename ?? "house_config.json", path);
    } catch (e) {
      // Transient read/HTTP errors (file briefly missing during an
      // atomic rename, dev server hiccup). Stay quiet-ish and retry.
      console.warn(
        "[watch] poll error (transient?):",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      inFlight = false;
    }
  };

  setInterval(() => void tick(), POLL_MS);
  console.info(
    `[watch] live config watcher started (every ${POLL_MS}ms). ` +
      "Open your working house_config.json via Load to watch an external file.",
  );
}
