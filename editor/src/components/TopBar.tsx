import { useEffect, useState } from "react";
import { useConfigStore } from "../state/configStore";
import { downloadConfig, pickAndLoadConfig } from "../io/fileIO";
import { validate } from "../schema/houseConfig";

// Keyboard shortcuts:
//   ⌘/Ctrl+O          — load .wadi / .json
//   ⌘/Ctrl+S          — download .wadi
//   ⌘/Ctrl+Z          — undo
//   ⌘/Ctrl+Shift+Z    — redo (also ⌘/Ctrl+Y on non-Mac)
//   ⌘/Ctrl+D          — duplicate selected object
//   Delete / Backspace — delete selected object
function useKeyboardShortcuts() {
  const config = useConfigStore((s) => s.config);
  const filename = useConfigStore((s) => s.filename);
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const selection = useConfigStore((s) => s.selection);
  const deleteObject = useConfigStore((s) => s.deleteObject);
  const duplicateObject = useConfigStore((s) => s.duplicateObject);

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      // Ignore shortcuts when the user is typing into a form field.
      const target = e.target as HTMLElement | null;
      const inTextInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useConfigStore.temporal.getState().redo();
        else useConfigStore.temporal.getState().undo();
        return;
      }
      if (isMod && (e.key.toLowerCase() === "y")) {
        e.preventDefault();
        useConfigStore.temporal.getState().redo();
        return;
      }
      if (inTextInput) return;

      if (isMod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        try {
          const { config, filename } = await pickAndLoadConfig();
          loadConfig(config, filename);
        } catch { /* cancelled / invalid — top bar shows the error */ }
        return;
      }
      if (isMod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (config) downloadConfig(config, filename ?? undefined);
        return;
      }
      if (isMod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selection) duplicateObject(selection);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        deleteObject(selection);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [config, filename, loadConfig, selection, deleteObject, duplicateObject]);
}

export function TopBar() {
  useKeyboardShortcuts();
  const config = useConfigStore((s) => s.config);
  const filename = useConfigStore((s) => s.filename);
  const dirty = useConfigStore((s) => s.dirty);
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const setValidationErrors = useConfigStore((s) => s.setValidationErrors);
  const validationErrors = useConfigStore((s) => s.validationErrors);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);

  // Force a re-render when temporal history changes so undo/redo buttons
  // enable/disable in step with the actual stack sizes.
  useEffect(() => {
    return useConfigStore.temporal.subscribe(() => setHistoryTick((t) => t + 1));
  }, []);
  void historyTick;

  const canUndo = useConfigStore.temporal.getState().pastStates.length > 0;
  const canRedo = useConfigStore.temporal.getState().futureStates.length > 0;

  const handleLoad = async () => {
    setLoadError(null);
    try {
      const { config, filename } = await pickAndLoadConfig();
      loadConfig(config, filename);
    } catch (e) {
      if (e instanceof Error && e.message === "Cancelled") return;
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDownload = () => {
    if (!config) return;
    downloadConfig(config, filename ?? undefined);
  };

  const handleValidate = () => {
    if (!config) return;
    const result = validate(config);
    setValidationErrors(result.ok ? [] : result.errors ?? []);
  };

  const isValid = validationErrors.length === 0;

  return (
    <header className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2">
      <a
        href="../"
        title="Back to 3D model viewer"
        className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
      >
        <span aria-hidden>🏗️</span>
        <span className="text-xs">Viewer</span>
      </a>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-slate-100">
          🏠 Wadi Editor
        </span>
        <span className="text-xs text-slate-400">
          {filename ? (
            <>
              {filename}
              {dirty && <span className="text-amber-400"> · modified</span>}
            </>
          ) : (
            "no file loaded"
          )}
        </span>
      </div>

      <div className="ml-4 flex gap-2">
        <button
          type="button"
          onClick={handleLoad}
          title="Open a Wadi house — .wadi or .json (⌘/Ctrl+O)"
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
        >
          Load…
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!config || !isValid}
          title="Download .wadi (⌘/Ctrl+S)"
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Download .wadi
        </button>
        <button
          type="button"
          onClick={handleValidate}
          disabled={!config}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          Validate
        </button>
      </div>

      <div className="ml-2 flex gap-1">
        <button
          type="button"
          onClick={() => useConfigStore.temporal.getState().undo()}
          disabled={!canUndo}
          title="Undo (⌘/Ctrl+Z)"
          className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={() => useConfigStore.temporal.getState().redo()}
          disabled={!canRedo}
          title="Redo (⌘/Ctrl+Shift+Z)"
          className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↷
        </button>
      </div>

      <div className="ml-auto text-sm">
        {config && isValid && (
          <span className="text-emerald-400">✓ valid</span>
        )}
        {!isValid && (
          <span className="text-red-400">
            ✗ {validationErrors.length} error
            {validationErrors.length === 1 ? "" : "s"}
          </span>
        )}
        {loadError && (
          <div className="mt-1 max-w-[36rem] whitespace-pre-wrap text-xs text-red-400">
            {loadError}
          </div>
        )}
      </div>
    </header>
  );
}
