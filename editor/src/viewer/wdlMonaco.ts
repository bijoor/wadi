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
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { registerWadiDsl, LANG_ID } from "wadi-wdl-monaco-lang";
import { registerWadiLsp } from "wadi-wdl-monaco-lsp";
import { stdResolveModule } from "../io/stdModules";

export interface WdlEditorHandle {
  getValue(): string;
  /** Replace the text (no-op if unchanged, to avoid stealing the cursor). */
  setValue(v: string): void;
  onChange(cb: () => void): void;
  /** ⌘/Ctrl+Enter inside the editor (Monaco swallows the DOM keydown). */
  onApplyShortcut(cb: () => void): void;
  focus(): void;
  layout(): void;
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
  // Resolve the bundled std modules (std-furniture, konkan/base) so the editor
  // validates/completes WDL that `import`s them — matching the viewer's compile
  // path and the wadi-mcp server. The bundled set never changes (version 0).
  registerWadiLsp({ resolveModule: stdResolveModule, version: () => 0, languageId: LANG_ID });
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

  return {
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
  };
}
