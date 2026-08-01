// Wadi DSL playground — a Monaco code editor that compiles .wdl IN THE
// BROWSER and drives the existing Wadi app (in a same-origin iframe) to render
// the model. Edit the code → the house rebuilds. No server, no second renderer,
// and NO app changes: the app is loaded as a pure renderer.
//
// Loading uses the app's OWN paths:
//   • first render → boot the iframe at /app/?panels=off&load=<blob url of the
//     compiled house>. The app's `?load` startup option loads it directly and
//     skips the picker (and frames the camera on its normal path).
//   • every edit after that → window.wadi.load(config) for an instant in-place
//     update (no reload).

import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { isTauri } from "@tauri-apps/api/core";
import { registerWadiDsl, LANG_ID } from "./dsl-language";
import { compileWithDiagnostics } from "../src/generator/toHouseConfig";
import { resolveParametric } from "../../editor/src/param/resolve";
import {
  lintStructure,
  partitionFindings,
  formatFinding,
  type LintFinding,
} from "../../editor/src/lint/structural";
import { REFERENCE_HTML } from "./reference";
import minimalSrc from "../examples/minimal.wdl?raw";
import twoRoomSrc from "../examples/two_room.wdl?raw";
import twoStorySrc from "../examples/two_story.wdl?raw";
import coastalSrc from "../examples/coastal.wdl?raw";
import completeSrc from "../examples/complete.wdl?raw";
import errorsSrc from "../examples/errors.wdl?raw";

const SAMPLES: Record<string, string> = {
  minimal: minimalSrc,
  two_room: twoRoomSrc,
  two_story: twoStorySrc,
  coastal: coastalSrc,
  complete: completeSrc,
  errors: errorsSrc,
};
let currentName = "minimal"; // base filename for Save / Download

// Monaco only needs its base editor worker (plain-text language, no TS/JSON).
self.MonacoEnvironment = { getWorker: () => new editorWorker() };

registerWadiDsl(monaco);

const editor = monaco.editor.create(document.getElementById("editor")!, {
  value: minimalSrc,
  language: LANG_ID,
  theme: "vs-dark",
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 13,
  tabSize: 2,
  scrollBeyondLastLine: false,
  renderWhitespace: "none",
});
const model = editor.getModel()!;

const frame = document.getElementById("preview") as HTMLIFrameElement;
const statusEl = document.getElementById("status")!;

function setStatus(text: string, error = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle("err", error);
}

// ---- Problems panel: the detailed, readable list of parse errors + lint findings.
const problemsEl = document.getElementById("problems")!;
const probListEl = document.getElementById("prob-list")!;
const probTitleEl = document.getElementById("prob-title")!;
document.querySelector(".prob-head")!.addEventListener("click", () => problemsEl.classList.toggle("collapsed"));
// The status pill expands the panel (in case it was collapsed) so a click reveals detail.
statusEl.style.cursor = "pointer";
statusEl.addEventListener("click", () => {
  if (!problemsEl.hidden) problemsEl.classList.remove("collapsed");
});

type DslDiagnostic = { startLineNumber: number; startColumn: number; message: string };

function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
function probRow(level: "error" | "warn", badge: string, message: string, line?: number, col?: number): string {
  const cls = `prob ${level}${line ? " jump" : ""}`;
  const data = line ? ` data-line="${line}" data-col="${col ?? 1}"` : "";
  const icon = level === "error" ? "✖" : "⚠";
  const loc = badge ? `<span class="loc">${escHtml(badge)}</span>` : "";
  return `<div class="${cls}"${data}><span class="ic">${icon}</span>${loc}<span class="msg">${escHtml(message)}</span></div>`;
}
// Render every diagnostic (parse errors, with line:col + jump) and lint finding
// (rule + level) into the panel. Hidden when there's nothing to show.
function renderProblems(diagnostics: DslDiagnostic[], findings: LintFinding[]): void {
  const rows: string[] = [];
  let e = 0;
  let w = 0;
  for (const d of diagnostics) {
    e++;
    rows.push(probRow("error", `Ln ${d.startLineNumber}:${d.startColumn}`, d.message, d.startLineNumber, d.startColumn));
  }
  for (const f of findings.filter((f) => f.level === "error")) {
    e++;
    rows.push(probRow("error", f.rule ?? "", f.message));
  }
  for (const f of findings.filter((f) => f.level === "warn")) {
    w++;
    rows.push(probRow("warn", f.rule ?? "", f.message));
  }
  if (!rows.length) {
    problemsEl.hidden = true;
    probListEl.innerHTML = "";
    return;
  }
  problemsEl.hidden = false;
  const counts =
    `<span class="prob-count">` +
    (e ? `<span class="e">✖ ${e}</span> ` : "") +
    (w ? `<span class="w">⚠ ${w}</span>` : "") +
    `</span>`;
  probTitleEl.innerHTML = `Problems ${counts}`;
  probListEl.innerHTML = rows.join("");
  probListEl.querySelectorAll<HTMLElement>(".prob.jump").forEach((el) => {
    el.addEventListener("click", () => {
      const ln = Number(el.dataset.line || 0);
      const col = Number(el.dataset.col || 1);
      if (ln) {
        editor.revealLineInCenter(ln);
        editor.setPosition({ lineNumber: ln, column: col });
        editor.focus();
      }
    });
  });
}

type Wadi = { load: (c: unknown) => unknown };

// The iframe's window.wadi appears once the viewer has booted. Resolve to it.
function whenWadiReady(timeoutMs = 15000): Promise<Wadi> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const w = frame.contentWindow as (Window & { wadi?: Wadi }) | null;
      if (w && w.wadi && typeof w.wadi.load === "function") return resolve(w.wadi);
      if (Date.now() - start > timeoutMs) return reject(new Error("viewer did not become ready"));
      setTimeout(tick, 120);
    };
    tick();
  });
}

let wadiPromise: Promise<Wadi> | null = null;
let booted = false;

// The 3D scene renders on demand; after a load, the async geometry (CSG
// openings, roof) settles a frame or two later, so nudge a re-render at the
// (already correctly framed) camera. A plain resize invalidates the R3F loop —
// we do NOT move the camera.
function pokeResize(): void {
  frame.contentWindow?.dispatchEvent(new Event("resize"));
}

// The 3D Canvas can mount at a 0/settling size inside the iframe and paint black
// until a real resize corrects the drawing-buffer size + camera aspect. The
// scene renders continuously, so ONE resize after the iframe has laid out fixes
// it for good — poke on an interval across the settle window so one lands late
// enough, then stop.
function nudgeUntilSettled(): void {
  let n = 0;
  const id = window.setInterval(() => {
    pokeResize();
    if (++n >= 16) window.clearInterval(id); // ~8s
  }, 500);
}

async function pushToViewer(config: Record<string, unknown>, findings: LintFinding[] = []): Promise<void> {
  try {
    if (!booted) {
      // Boot the app WITH the model present via ?load=<url>, so it runs its
      // normal camera-fit-to-house path. The config is served to the same-origin
      // iframe as a blob: URL.
      const blobUrl = URL.createObjectURL(
        new Blob([JSON.stringify(config)], { type: "application/json" }),
      );
      frame.src = `/app/?panels=off&load=${encodeURIComponent(blobUrl)}`;
      wadiPromise = whenWadiReady();
      await wadiPromise;
      booted = true;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000); // after the app fetched it
      nudgeUntilSettled(); // first paint: correct the canvas size once laid out
      applyRenderedStatus(findings);
      return;
    }
    const wadi = await wadiPromise!;
    wadi.load(config); // live, in-place render (scene renders continuously)
    pokeResize();
    applyRenderedStatus(findings);
  } catch (e) {
    setStatus(`preview: ${(e as Error).message}`, true);
  }
}

// Compile the current source; mark errors; render a valid model.
function run(): void {
  const { config, diagnostics } = compileWithDiagnostics(editor.getValue());
  monaco.editor.setModelMarkers(
    model,
    "wadi-dsl",
    diagnostics.map((d) => ({ ...d, severity: monaco.MarkerSeverity.Error })),
  );
  const findings = config ? lintCurrent(config) : [];
  renderProblems(diagnostics, findings);
  if (config) {
    setStatus("compiling…");
    void pushToViewer(config, findings);
  } else {
    const first = diagnostics[0];
    setStatus(first ? `⚠ ${first.startLineNumber}:${first.startColumn} ${trim(first.message)}` : "error", true);
    statusEl.title = "";
  }
}
function trim(m: string): string {
  return m.length > 80 ? m.slice(0, 79) + "…" : m;
}

// Resolve formulas + run the structural-conventions linter (C1/C2/C3). Pure and
// fast; a resolve failure just yields no findings (the compile diagnostics or the
// viewer surface the real problem instead). The model still renders even with
// findings — the point is to SHOW the unsound bits, not block the preview.
function lintCurrent(config: Record<string, unknown>): LintFinding[] {
  try {
    const { config: resolved } = resolveParametric(config as never);
    return lintStructure(resolved as never);
  } catch {
    return [];
  }
}

// Fold lint findings into the status pill: a summary count, err-styled when any
// are structural errors, with the full list in the hover title.
function applyRenderedStatus(findings: LintFinding[]): void {
  if (!findings.length) {
    setStatus("✓ rendered");
    statusEl.title = "";
    return;
  }
  const { errors, warnings } = partitionFindings(findings);
  const parts: string[] = [];
  if (errors.length) parts.push(`✖ ${errors.length} structural error${errors.length === 1 ? "" : "s"}`);
  if (warnings.length) parts.push(`⚠ ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`);
  setStatus(`✓ rendered · ${parts.join(" · ")}`, errors.length > 0);
  statusEl.title = findings.map(formatFinding).join("\n");
}

// ---- Native file sync (desktop): open + WATCH + autosave a .wdl on disk, so a
//      human and a coding agent CO-EDIT the same file. Mirrors the app's
//      configWatcher: native fs `watch()` reloads the editor when the file
//      changes on disk (the agent's write), and edits here autosave back to it
//      (so the agent reads the human's changes). Browser build: no-ops. ----

let openFilePath: string | null = null;
let lastDiskText: string | null = null;      // break the write→watch→reload echo loop
let unwatchFile: (() => void) | null = null;

async function attachFile(path: string): Promise<void> {
  const { readTextFile, watch } = await import("@tauri-apps/plugin-fs");
  if (unwatchFile) { unwatchFile(); unwatchFile = null; }
  openFilePath = path;
  currentName = (path.split(/[/\\]/).pop() ?? "house").replace(/\.(wdl|txt)$/i, "") || "house";
  const text = await readTextFile(path);
  lastDiskText = text;
  editor.setValue(text);                     // fires onDidChangeModelContent → recompile + render
  updateFileLabel();
  const stop = await watch(
    path,
    async () => {
      try {
        const t = await readTextFile(path);
        if (t === lastDiskText || t === editor.getValue()) { lastDiskText = t; return; }
        lastDiskText = t;
        editor.setValue(t);                  // external (agent/human) edit → reload + re-render
      } catch { /* transient mid-write; the next event retries */ }
    },
    { delayMs: 250 },
  );
  unwatchFile = stop;
}

async function openWdlNative(): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: false, filters: [{ name: "Wadi DSL", extensions: ["wdl"] }] });
  const path = typeof picked === "string" ? picked : null;
  if (path) await attachFile(path);
}

async function autosave(): Promise<void> {
  if (!openFilePath) return;
  const content = editor.getValue();
  if (content === lastDiskText) return;
  lastDiskText = content;                    // mark BEFORE the write so the watch echo is a no-op
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(openFilePath, content);
    updateFileLabel();
  } catch (e) {
    setStatus(`save failed: ${(e as Error).message}`, true);
  }
}

function baseName(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

// Detach from the currently watched file → a fresh, unsaved "untitled" document
// (used by New). Save As re-attaches to a chosen path.
function detachFile(): void {
  if (unwatchFile) { unwatchFile(); unwatchFile = null; }
  openFilePath = null;
  lastDiskText = null;
}

// The header label showing the open file + a • when there are unsaved edits.
function updateFileLabel(): void {
  const el = document.getElementById("filename");
  if (!el) return;
  if (!openFilePath) { el.textContent = "untitled.wdl"; el.classList.remove("dirty"); return; }
  const dirty = editor.getValue() !== lastDiskText;
  el.textContent = baseName(openFilePath) + (dirty ? " •" : "");
  el.classList.toggle("dirty", dirty);
}

// Save (desktop): write to the open+watched file, or — if none yet — Save As so
// the user PICKS a location; that file then becomes the watched, co-edited one.
async function saveWdl(): Promise<void> {
  if (!isTauri()) {
    downloadText(`${currentName}.wdl`, editor.getValue(), "text/plain;charset=utf-8");
    return;
  }
  if (openFilePath) {
    lastDiskText = editor.getValue();
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(openFilePath, lastDiskText);
      setStatus(`✓ saved ${baseName(openFilePath)}`);
      updateFileLabel();
    } catch (e) {
      setStatus(`save failed: ${(e as Error).message}`, true);
    }
    return;
  }
  await saveAsWdl();
}

// Save As (desktop): native dialog to choose a path, write, then WATCH it.
async function saveAsWdl(): Promise<void> {
  if (!isTauri()) {
    downloadText(`${currentName}.wdl`, editor.getValue(), "text/plain;charset=utf-8");
    return;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({
    defaultPath: `${currentName || "house"}.wdl`,
    filters: [{ name: "Wadi DSL", extensions: ["wdl"] }],
  });
  if (!path) return;
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, editor.getValue());
    await attachFile(path); // now the watched, co-edited file
    setStatus(`✓ saved + watching ${baseName(path)}`);
    updateFileLabel();
  } catch (e) {
    setStatus(`save failed: ${(e as Error).message}`, true);
  }
}

let debounce: number | undefined;
editor.onDidChangeModelContent(() => {
  updateFileLabel(); // responsive dirty dot
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => {
    run();
    void autosave(); // persist the human's edits so the agent reads them (desktop only)
  }, 300);
});

// ⌘S / Ctrl+S saves (desktop → to the watched file, or Save As; browser → download).
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveWdl());
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => void saveAsWdl());

// ---- Toolbar: sample picker · Open / Save .wdl · Download .wadi · Reference ----

function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function wireToolbar(): void {
  const $ = (id: string) => document.getElementById(id)!;

  // New — a menu of starter samples. Picking one starts a fresh, UNSAVED
  // document (detached from any open file); Save As then writes it to disk.
  const newBtn = $("new");
  const newMenu = $("new-menu");
  newBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    newMenu.hidden = !newMenu.hidden;
  });
  newMenu.querySelectorAll<HTMLButtonElement>("button[data-sample]").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.sample ?? "";
      const src = SAMPLES[key];
      if (src) {
        detachFile();          // start a fresh, unsaved document
        editor.setValue(src);  // fires onDidChangeModelContent → recompile + render
        currentName = key;
        updateFileLabel();
      }
      newMenu.hidden = true;
    }),
  );
  document.addEventListener("click", () => { newMenu.hidden = true; });

  // Open a .wdl from disk. Desktop → native dialog + live file WATCH (co-edit);
  // browser → a one-shot file read (no disk watch available).
  const file = $("file") as HTMLInputElement;
  $("open").addEventListener("click", () => {
    if (isTauri()) void openWdlNative();
    else file.click();
  });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    editor.setValue(await f.text());
    currentName = f.name.replace(/\.(wdl|txt)$/i, "") || "house";
    file.value = "";
  });

  // Save (desktop → to the watched file / Save-As dialog; browser → download).
  $("save").addEventListener("click", () => void saveWdl());
  const saveAsBtn = document.getElementById("saveas");
  if (saveAsBtn) saveAsBtn.addEventListener("click", () => void saveAsWdl());

  // Export the compiled .wadi (native Save dialog in the desktop app; download in
  // the browser). Rarely needed — the app renders the .wdl directly — but handy
  // for sharing a resolved config.
  $("download").addEventListener("click", async () => {
    const { config, diagnostics } = compileWithDiagnostics(editor.getValue());
    if (!config) {
      setStatus(`can't export — fix ${diagnostics.length} error${diagnostics.length === 1 ? "" : "s"}`, true);
      return;
    }
    const json = JSON.stringify(config, null, 2);
    if (isTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({ defaultPath: `${currentName || "house"}.wadi`, filters: [{ name: "Wadi house", extensions: ["wadi"] }] });
      if (!path) return;
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(path, json);
      setStatus(`✓ exported ${baseName(path)}`);
    } else {
      downloadText(`${currentName}.wadi`, json, "application/json");
    }
  });

  // Reference slide-over.
  const panel = $("reference-panel");
  $("reference-body").innerHTML = REFERENCE_HTML;
  $("reference").addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });
  $("ref-close").addEventListener("click", () => {
    panel.hidden = true;
  });
}
wireToolbar();

// Expose the editor + monaco for scripting/automation of the demo.
(window as unknown as { wadiEditor: typeof editor; monaco: typeof monaco }).wadiEditor = editor;
(window as unknown as { monaco: typeof monaco }).monaco = monaco;

// First compile + boot.
updateFileLabel();
run();
