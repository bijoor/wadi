// Lazy Monaco editor for the in-viewer WDL pane. Reuses the DSL playground's
// Monarch highlighting (registerWadiDsl) + the in-process Langium LSP adapters
// (registerWadiLsp) for completion / hover / go-to-definition / find-references /
// rename — the same language services the standalone /dsl editor uses.
//
// The whole Monaco + LSP stack is code-split behind THIS module: wireWdlEditor
// dynamic-imports it only when the WDL pane first opens (the pane defaults
// closed), so a casual visitor never downloads Monaco.

import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
// Editor UI contributions that render the LSP providers' results — editor.api is
// lean and omits them. These are editor FEATURES, not the 80 basic-languages the
// full "monaco-editor" entry would pull in.
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js";
import "monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js";
import "monaco-editor/esm/vs/editor/contrib/rename/browser/rename.js";
import "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands.js";
import "monaco-editor/esm/vs/editor/contrib/peekView/browser/peekView.js";
// EDITING contributions. editor.api gives core typing + Backspace/Delete, but the
// line-level and convenience editing commands live in these contribs — without them
// you cannot delete/move/duplicate a line, cut/copy/paste by keyboard, delete a word,
// or use multiple cursors. Importing them makes the pane behave like a normal editor.
import "monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations.js";
import "monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js";
import "monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations.js";
import "monaco-editor/esm/vs/editor/contrib/cursorUndo/browser/cursorUndo.js";
import "monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js";
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController.js";
import "monaco-editor/esm/vs/editor/contrib/comment/browser/comment.js";
import "monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { registerWadiDsl, LANG_ID } from "wadi-wdl-monaco-lang";
import { registerWadiLsp } from "wadi-wdl-monaco-lsp";
import { stdResolveModule } from "../io/stdModules";
import { useConfigStore } from "../state/configStore";

export interface WdlEditorHandle {
  getValue(): string;
  /** Replace the text (no-op if unchanged, to avoid stealing the cursor). */
  setValue(v: string): void;
  onChange(cb: () => void): void;
  /** ⌘/Ctrl+Enter inside the editor (Monaco swallows the DOM keydown). */
  onApplyShortcut(cb: () => void): void;
  focus(): void;
  layout(): void;
  /** Toggle readOnly (used to make the main editor inert while the module editor
   *  overlay is open, so input for the module can't land in the main WDL). */
  setReadOnly(ro: boolean): void;
  /** Tear down the underlying Monaco instance (call when removing the editor DOM). */
  dispose(): void;
}

let registered = false;
function registerOnce(): void {
  if (registered) return;
  registered = true;
  // WDL is a custom plain-text-shaped language, so Monaco only needs its base
  // editor worker (no TS/JSON language workers).
  (self as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker: () => new editorWorker(),
  };
  registerWadiDsl(monaco);
  // Resolve the model's custom component modules FIRST, then the bundled std packs
  // (std-furniture, konkan/base) — matching the viewer's compile path — so completion,
  // hover, and go-to-definition work across imported components. `version` changes
  // whenever the module set does, so the LSP re-resolves after a module is added.
  const resolveModule = (ref: string): string | undefined =>
    useConfigStore.getState().modules[ref] ?? stdResolveModule(ref);
  const version = (): number => {
    const m = useConfigStore.getState().modules;
    let n = 0;
    for (const [k, v] of Object.entries(m)) n += k.length + v.length;
    return n;
  };
  registerWadiLsp({ resolveModule, version, languageId: LANG_ID });
}

export function mountWdlMonaco(container: HTMLElement, initialValue: string): WdlEditorHandle {
  registerOnce();
  const ed = monaco.editor.create(container, {
    value: initialValue,
    language: LANG_ID,
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    tabSize: 2,
    scrollBeyondLastLine: false,
    renderWhitespace: "none",
    wordWrap: "off",
    padding: { top: 8 },
  });

  // Robust selection-delete for Backspace/Delete. In some embedded webviews a real
  // Backspace/Delete keydown, when there is a selection, does not reach Monaco's
  // deleteLeft/deleteRight keybinding (it only removes a single char with no
  // selection), so a selection can't be deleted with the keyboard. We intercept
  // those keys at document capture BEFORE that path, and when THIS editor is focused
  // with a non-empty selection, delete it ourselves and stop the event. Collapsed
  // selections fall through to Monaco's normal single-char handling untouched.
  const onDocKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== "Backspace" && e.key !== "Delete") return;
    if (!ed.hasTextFocus()) return;
    const sel = ed.getSelection();
    if (!sel || sel.isEmpty()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    ed.trigger("keyboard", e.key === "Backspace" ? "deleteLeft" : "deleteRight", null);
  };
  document.addEventListener("keydown", onDocKeyDown, true);

  const handleObj: WdlEditorHandle = {
    getValue: () => ed.getValue(),
    setValue: (v) => {
      if (ed.getValue() !== v) ed.setValue(v);
    },
    onChange: (cb) => {
      ed.onDidChangeModelContent(() => cb());
    },
    onApplyShortcut: (cb) => {
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => cb());
    },
    focus: () => ed.focus(),
    layout: () => ed.layout(),
    setReadOnly: (ro) => ed.updateOptions({ readOnly: ro }),
    dispose: () => {
      document.removeEventListener("keydown", onDocKeyDown, true);
      ed.dispose();
    },
  };
  return handleObj;
}
