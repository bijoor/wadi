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
// editor.api is lean — it omits the editor UI contributions that render the
// Langium LSP providers' results. Import exactly the ones we need (these are
// editor features, NOT the 80 basic-languages, which the full "monaco-editor"
// entry would drag in): suggest (completion widget), hover, rename, and
// gotoSymbol + peekView (go-to-definition / find-references / peek).
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js";
import "monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js";
import "monaco-editor/esm/vs/editor/contrib/rename/browser/rename.js";
import "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/goToCommands.js";
import "monaco-editor/esm/vs/editor/contrib/peekView/browser/peekView.js";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { isTauri } from "@tauri-apps/api/core";
import { registerWadiDsl, LANG_ID } from "./dsl-language";
import { compileWithDiagnostics } from "../src/generator/toHouseConfig";
import { emitWdl } from "../src/generator/fromHouseConfig";
import {
  resolveModule,
  loadFolderLibraries,
  loadLibrary,
  removeLibrary,
  getLibrarySource,
  isValidModuleName,
  listLibraries,
  libraryCacheVersion,
} from "./libraries";
import { registerWadiLsp } from "./lsp";
import { THUMB_SUBDIR, joinRel, parentDir, thumbRelPath, patchThumbnails } from "./thumbPaths";
import { initPublishPanel, type PublishResult } from "./publishPanel";
import type { TemplatePackage } from "../../editor/src/templatePackage/assemble";
import { localTemplatesDir, setTemplateSource } from "../../editor/src/io/templateSource";
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
import konkanCottageSrc from "../examples/konkan_cottage.wdl?raw";
import errorsSrc from "../examples/errors.wdl?raw";

const SAMPLES: Record<string, string> = {
  minimal: minimalSrc,
  two_room: twoRoomSrc,
  two_story: twoStorySrc,
  coastal: coastalSrc,
  complete: completeSrc,
  konkan_cottage: konkanCottageSrc,
  errors: errorsSrc,
};
let currentName = "minimal"; // base filename for Save / Download

// Monaco only needs its base editor worker (plain-text language, no TS/JSON).
self.MonacoEnvironment = { getWorker: () => new editorWorker() };

registerWadiDsl(monaco);
// Langium-backed language features: completion / hover / go-to-definition /
// find-references / rename, resolving `import`s through the editor's module cache.
registerWadiLsp({ resolveModule, version: libraryCacheVersion, languageId: LANG_ID });

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

type Wadi = { load: (c: unknown) => unknown; setPersona?: (target: string) => unknown };

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

// The preview iframe runs in one of two personas: "studio" (Nakasha — the DEFAULT
// for the WDL editor: shows the capture toolbar + "Preview as owner" toggle, since
// the WDL editor IS the designer surface) or "owner" (Gharkul — the clean preview
// with the live configurator, reached via the in-preview "Preview as owner" toggle).
// `lastConfig` is the most recent compiled config.
let previewMode: "owner" | "studio" = "studio";
let lastConfig: Record<string, unknown> | null = null;
// Cover images (thumbnails) live ONLY in a .wadi, never the .wdl. When a .wadi is
// imported we stash them here and re-attach on every recompile, so they survive
// edits + reach the Publish panel. Captures made in the preview take precedence.
let carriedThumbnails: string[] = [];
// A .wdl can instead reference cover images by RELATIVE PATH in its `template {}`
// block (files in a `thumbnails/` subfolder next to the .wdl). On desktop we read
// those files and inline them as data URLs. Cache the last-resolved path list so a
// recompile only re-reads the files when the paths actually changed (an edit to the
// `thumbnails` line), and so freshly-captured (unsaved) shots aren't clobbered.
let lastResolvedThumbPaths = "";

// data URL ⇄ bytes (PNG) for reading/writing cover files via the Tauri fs plugin.
function bytesToDataUrl(bytes: Uint8Array, mime = "image/png"): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
function dataUrlToBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Desktop: turn a compiled config's `template.thumbnails` PATHS (relative to the
// open .wdl) into inline data URLs. Missing files are skipped. Returns null when
// there is nothing to resolve (browser, no open file, or no paths).
async function resolveTemplateThumbs(config: Record<string, unknown>): Promise<string[] | null> {
  const t = (config.template as { thumbnails?: unknown } | undefined)?.thumbnails;
  if (!Array.isArray(t) || !t.length || !openFilePath || !isTauri()) return null;
  const dir = parentDir(openFilePath);
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const urls: string[] = [];
  for (const rel of t) {
    if (typeof rel !== "string") continue;
    if (rel.startsWith("data:")) { urls.push(rel); continue; } // already inline
    try {
      urls.push(bytesToDataUrl(await readFile(joinRel(dir, rel))));
    } catch { /* missing cover file — skip, the card just shows fewer shots */ }
  }
  return urls.length ? urls : null;
}

// Switch the preview persona IN PLACE via the viewer's wadi.setPersona (no iframe
// reboot — a reboot blacks out the 3D and drops the loaded model). If the preview
// hasn't booted yet, the next boot picks up `previewMode` for its mode param.
async function setPreviewMode(mode: "owner" | "studio"): Promise<void> {
  if (mode === previewMode) return;
  previewMode = mode;
  if (!booted) return;
  const w = frame.contentWindow as (Window & { wadi?: Wadi }) | null;
  w?.wadi?.setPersona?.(mode === "studio" ? "architect" : "owner");
  pokeResize(); // the chrome changed → nudge the canvas to re-fit its new size
}

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
    // Cover images. Precedence:
    //   1. `template.thumbnails` PATHS in the .wdl, resolved from files (desktop) —
    //      but only re-read when the path list changed, so freshly-captured unsaved
    //      shots in the preview aren't clobbered on an unrelated edit.
    //   2. whatever the preview currently holds (imported .wadi + shots captured in
    //      the panel).
    //   3. the set carried from a decompiled .wadi.
    // `wadi.load` replaces the whole config, so without this the thumbnails vanish
    // on the next keystroke.
    const w0 = frame.contentWindow as (Window & { wadi?: { getConfig?: () => { thumbnails?: unknown } } }) | null;
    const existing = w0?.wadi?.getConfig?.()?.thumbnails;
    const pathKey = JSON.stringify((config.template as { thumbnails?: unknown } | undefined)?.thumbnails ?? null);
    let thumbs: string[] | null = null;
    if (pathKey !== lastResolvedThumbPaths) {
      lastResolvedThumbPaths = pathKey;
      thumbs = await resolveTemplateThumbs(config); // desktop path-ref → data URLs
    }
    if (!thumbs) {
      thumbs = Array.isArray(existing) && existing.length ? (existing as string[]) : carriedThumbnails;
    }
    if (thumbs.length) config.thumbnails = thumbs;
    else delete config.thumbnails;
    if (!booted) {
      // Boot the preview as a PURE, ISOLATED renderer: bare `?load` = EMBED mode,
      // which skips the owner "Choose your home" picker + the default auto-load
      // and just waits for our wadi.load(). We push the config over `wadi.load`
      // (NOT a blob: URL in ?load=) because a Tauri WKWebView iframe can't fetch a
      // blob: URL minted by its parent — that failed silently on the desktop and
      // dropped the preview into the owner gallery, showing a template instead of
      // the compiled WDL.
      const modeParam = previewMode === "studio" ? "mode=studio&" : "";
      frame.src = `/app/?${modeParam}panels=off&load`;
      wadiPromise = whenWadiReady();
      const wadi = await wadiPromise;
      booted = true;
      wadi.load(config); // first render (also runs the camera-fit-to-house path)
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
  const { config, diagnostics } = compileWithDiagnostics(editor.getValue(), { resolveModule });
  monaco.editor.setModelMarkers(
    model,
    "wadi-dsl",
    diagnostics.map((d) => ({ ...d, severity: monaco.MarkerSeverity.Error })),
  );
  const findings = config ? lintCurrent(config) : [];
  renderProblems(diagnostics, findings);
  if (config) {
    lastConfig = config;
    setStatus("compiling…");
    void pushToViewer(config, findings);
  } else {
    // A house that imports a library the cache doesn't have fails with a generic
    // "module not found" — surface exactly WHICH libraries are missing and how to
    // get them, so the fix is obvious (rather than hunting the raw diagnostic).
    const missing = unresolvedImports(editor.getValue());
    if (missing.length) {
      const list = missing.map((m) => `"${m}"`).join(", ");
      setStatus(`⚠ missing librar${missing.length === 1 ? "y" : "ies"} ${list} — 📚 Library → Load library file…`, true);
      statusEl.title = `Not in your cache or the bundled packs: ${list}. Load ${missing.length === 1 ? "it" : "them"} via the Library menu (or, in the desktop app, place the .wdl beside this file).`;
    } else {
      const first = diagnostics[0];
      setStatus(first ? `⚠ ${first.startLineNumber}:${first.startColumn} ${trim(first.message)}` : "error", true);
      statusEl.title = "";
    }
  }
}
function trim(m: string): string {
  return m.length > 80 ? m.slice(0, 79) + "…" : m;
}

// The library refs the source `import`s that DON'T resolve (not in the cache, not
// a bundled pack) — the actionable list behind a "module not found" compile error.
function unresolvedImports(src: string): string[] {
  const out: string[] = [];
  const re = /^\s*import\s+"([^"]+)"/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const ref = m[1];
    if (resolveModule(ref) === undefined && !out.includes(ref)) out.push(ref);
  }
  return out;
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
  lastResolvedThumbPaths = ""; // new file → re-resolve any template.thumbnails paths
  currentName = (path.split(/[/\\]/).pop() ?? "house").replace(/\.(wdl|txt)$/i, "") || "house";
  const text = await readTextFile(path);
  lastDiskText = text;
  await loadFolderLibraries(path);             // sibling *.wdl become importable before the first compile
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
  carriedThumbnails = []; // a fresh doc carries no cover images (New / Open / sample)
  lastResolvedThumbPaths = "";
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
    // An imported .wadi carries cover images as data URLs (in `carriedThumbnails`)
    // that the .wdl can't hold inline. Now that the doc HAS a location, materialize
    // them as files next to it + reference them — so import → Save As is a complete
    // round-trip and the shots survive a reopen. Skip if the source already
    // references cover paths (the author manages them).
    if (carriedThumbnails.length && !/^[ \t]*thumbnails[ \t]/m.test(editor.getValue())) {
      const res = await saveCoverShots();
      if (res.ok) setStatus(`✓ saved ${baseName(path)} — ${res.message.replace(/^✓ /, "")}`);
    }
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

// Turn a filename into a valid house identifier for the `house <Name> {` header
// (letters/digits/underscore, must start with a letter). Falls back to "House".
function toHouseName(fileBase: string): string {
  const id = fileBase.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(?=[0-9])/, "H_").replace(/^_+/, "");
  return /^[A-Za-z_]/.test(id) ? id : "House";
}

// Decompile a .wadi (JSON house config) → editable .wdl, loaded as a FRESH,
// unsaved document (the source is JSON, not a .wdl to co-edit). The compiled
// preview then re-renders from the emitted code, so a bad round-trip is visible.
function loadDecompiledWadi(jsonText: string, nameHint: string): void {
  let cfg: unknown;
  try {
    cfg = JSON.parse(jsonText);
  } catch (e) {
    setStatus(`import failed — not valid JSON: ${(e as Error).message}`, true);
    return;
  }
  let wdl: string;
  try {
    wdl = emitWdl(cfg as Record<string, unknown>, toHouseName(nameHint));
  } catch (e) {
    setStatus(`import failed — could not decompile: ${(e as Error).message}`, true);
    return;
  }
  detachFile();            // decompiled code is a new unsaved doc (Save As to keep it)
  // The cover images live ONLY in the .wadi (never the .wdl), so stash them and
  // re-attach on every recompile — otherwise they'd be lost the moment the source
  // recompiles. (detachFile above cleared them; set AFTER it.)
  const rawThumbs = (cfg as { thumbnails?: unknown }).thumbnails;
  carriedThumbnails = Array.isArray(rawThumbs)
    ? rawThumbs.filter((x): x is string => typeof x === "string")
    : [];
  editor.setValue(wdl);    // fires onDidChangeModelContent → recompile + render
  currentName = nameHint || "house";
  updateFileLabel();
  const n = carriedThumbnails.length;
  const shot = n
    ? ` — ${n} cover image${n === 1 ? "" : "s"} kept${isTauri() ? " (Save As writes them to a thumbnails/ folder)" : ""}`
    : "";
  setStatus(`↩ decompiled ${nameHint || "house"}.wadi → WDL${shot} (unsaved — Save As to keep)`);
}

async function importWadiNative(): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: false, filters: [{ name: "Wadi house", extensions: ["wadi", "json"] }] });
  const path = typeof picked === "string" ? picked : null;
  if (!path) return;
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const base = (path.split(/[/\\]/).pop() ?? "house").replace(/\.(wadi|json)$/i, "") || "house";
  loadDecompiledWadi(await readTextFile(path), base);
}

function wireToolbar(): void {
  const $ = (id: string) => document.getElementById(id)!;

  // File — the document menu: starter samples (New from sample), plus open / save /
  // save-as / import / export (those buttons keep their ids, so their handlers below
  // wire up unchanged; they just live inside this menu now). Picking a sample starts
  // a fresh, UNSAVED document; Save As then writes it to disk.
  const fileBtn = $("file");
  const fileMenu = $("file-menu");
  fileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileMenu.hidden = !fileMenu.hidden;
  });
  fileMenu.querySelectorAll<HTMLButtonElement>("button[data-sample]").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.sample ?? "";
      const src = SAMPLES[key];
      if (src) {
        detachFile();          // start a fresh, unsaved document
        editor.setValue(src);  // fires onDidChangeModelContent → recompile + render
        currentName = key;
        updateFileLabel();
      }
    }),
  );
  // Any click inside the menu (sample or action button) or anywhere outside closes it.
  document.addEventListener("click", () => { fileMenu.hidden = true; });

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

  // Import a .wadi house and decompile it into editable WDL. Desktop → native
  // dialog; browser → a one-shot file read.
  const wadiFile = $("wadi-file") as HTMLInputElement;
  $("import").addEventListener("click", () => {
    if (isTauri()) void importWadiNative();
    else wadiFile.click();
  });
  wadiFile.addEventListener("change", async () => {
    const f = wadiFile.files?.[0];
    if (!f) return;
    loadDecompiledWadi(await f.text(), f.name.replace(/\.(wadi|json)$/i, "") || "house");
    wadiFile.value = "";
  });

  // Save (desktop → to the watched file / Save-As dialog; browser → download).
  $("save").addEventListener("click", () => void saveWdl());
  const saveAsBtn = document.getElementById("saveas");
  if (saveAsBtn) saveAsBtn.addEventListener("click", () => void saveAsWdl());

  // Export the compiled .wadi (native Save dialog in the desktop app; download in
  // the browser). Rarely needed — the app renders the .wdl directly — but handy
  // for sharing a resolved config.
  $("download").addEventListener("click", async () => {
    const { config, diagnostics } = compileWithDiagnostics(editor.getValue(), { resolveModule });
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

  // Publish-template panel: capture cover shots + test the configurator in the
  // studio preview, then ship a complete package. Desktop pushes to R2; browser
  // downloads the package for the dev-machine publish flow.
  initPublishPanel({
    frame,
    setPreviewMode,
    getLastConfig: () => lastConfig,
    suggestId: () => currentName || "house",
    isTauri,
    doPublish,
    saveCoverShots,
    hasOpenFile: () => openFilePath !== null,
  });
}
wireToolbar();

// Publish a template = save the self-describing `.wadi` into a managed templates
// FOLDER, which the app auto-indexes (no index file, no upload step). Desktop
// writes it into the chosen local folder; the browser downloads it to drop into
// an online folder (e.g. a shared Google Drive) using that platform's own UI.
async function doPublish(pkg: TemplatePackage): Promise<PublishResult> {
  const shots = (pkg.wadi.thumbnails as string[] | undefined)?.length ?? 0;
  if (isTauri()) return publishTemplateDesktop(pkg);
  downloadText(pkg.file, JSON.stringify(pkg.wadi, null, 2), "application/json");
  return {
    ok: true,
    message: `Downloaded ${pkg.file} (${shots} cover shot${shots === 1 ? "" : "s"}). Drop it into your templates folder (e.g. a shared Google Drive) — the app indexes it.`,
  };
}

// Desktop: save the file into the managed templates folder — the SAME folder the
// app auto-indexes FROM (the unified `templateSource` preference), so a saved
// template shows up in the gallery straight away. Choosing a folder here also
// makes it the active catalog source. The browser build never reaches this.
async function publishTemplateDesktop(pkg: TemplatePackage): Promise<PublishResult> {
  let dir = localTemplatesDir();
  if (!dir) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({
      directory: true,
      title: "Pick your templates folder (the app will index every .wadi in it)",
    });
    if (typeof picked !== "string") return { ok: false, message: "Save cancelled — no templates folder chosen." };
    dir = picked;
    setTemplateSource({ kind: "local", dir }); // this folder is now the catalog too
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const message = await invoke<string>("save_template", {
    templatesDir: dir,
    file: pkg.file,
    wadi: pkg.wadi,
  });
  return { ok: true, message };
}

// Desktop: persist the cover shots captured in the preview as PNG FILES next to the
// open .wdl (in a `thumbnails/` subfolder) and reference them from the .wdl's
// `template {}` block, so the source is self-sufficient — reopening the .wdl later
// re-inlines them. This is the source-workflow counterpart to publishing (which
// bakes the data URLs into the .wadi artifact). Returns a user-facing message.
async function saveCoverShots(): Promise<PublishResult> {
  if (!isTauri()) {
    return { ok: false, message: "Cover-shot files are a desktop feature — in the browser, capture and Publish inlines them." };
  }
  if (!openFilePath) {
    return { ok: false, message: "Save the .wdl to a file first (Save As), then capture + save cover shots." };
  }
  // Shots come from the preview (freshly captured) or, for an imported .wadi that
  // hasn't been re-captured, the set carried off that .wadi.
  const w = frame.contentWindow as (Window & { wadi?: { getConfig?: () => { thumbnails?: unknown } } }) | null;
  const raw = w?.wadi?.getConfig?.()?.thumbnails;
  const fromPreview = Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string" && s.startsWith("data:")) : [];
  const shots = fromPreview.length ? fromPreview : carriedThumbnails.filter((s) => s.startsWith("data:"));
  if (!shots.length) {
    return { ok: false, message: "No captured shots to save — use 📸 / ✨ in the preview first." };
  }
  const dir = parentDir(openFilePath);
  const base = currentName || "house";
  const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
  await mkdir(joinRel(dir, THUMB_SUBDIR), { recursive: true });
  const paths: string[] = [];
  for (let i = 0; i < shots.length; i++) {
    const rel = thumbRelPath(base, i + 1);
    await writeFile(joinRel(dir, rel), dataUrlToBytes(shots[i]));
    paths.push(rel);
  }
  // Reference the files from the WDL source (creates/updates the template block).
  const src = editor.getValue();
  const patched = patchThumbnails(src, paths);
  if (patched === src && !/^[ \t]*thumbnails[ \t]/m.test(src)) {
    return { ok: false, message: `Wrote ${paths.length} file(s) to ${THUMB_SUBDIR}/, but could not find a house block to add the \`thumbnails\` line — add it manually.` };
  }
  // A path edit → recompile → resolveTemplateThumbs re-reads the just-written files.
  lastResolvedThumbPaths = "";
  if (patched !== src) editor.setValue(patched);
  return { ok: true, message: `✓ Saved ${paths.length} cover shot${paths.length === 1 ? "" : "s"} to ${THUMB_SUBDIR}/ and referenced them in the WDL.` };
}

// ---- Libraries: save the current .wdl as a reusable module + reuse saved ones.
// A small promise-based prompt (window.prompt is unreliable in the Tauri webview).
function promptName(message: string, initial = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000;";
    const box = document.createElement("div");
    box.style.cssText =
      "background:#2a2a2a;color:#eee;padding:16px 18px;border-radius:8px;min-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.5);font:13px system-ui,sans-serif;";
    const label = document.createElement("div");
    label.textContent = message;
    label.style.cssText = "margin-bottom:10px;";
    const input = document.createElement("input");
    input.value = initial;
    input.style.cssText =
      "width:100%;box-sizing:border-box;padding:6px 8px;background:#1e1e1e;color:#eee;border:1px solid #555;border-radius:4px;margin-bottom:12px;font:13px ui-monospace,monospace;";
    const btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
    const mk = (t: string, bg: string) => {
      const b = document.createElement("button");
      b.textContent = t;
      b.style.cssText = `padding:5px 14px;background:${bg};color:#fff;border:none;border-radius:4px;cursor:pointer;font:13px system-ui;`;
      return b;
    };
    const ok = mk("Save", "#2e7d46");
    const cancel = mk("Cancel", "#555");
    const done = (v: string | null) => { overlay.remove(); resolve(v); };
    ok.addEventListener("click", () => done(input.value.trim() || null));
    cancel.addEventListener("click", () => done(null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done(input.value.trim() || null);
      else if (e.key === "Escape") done(null);
    });
    btns.append(cancel, ok);
    box.append(label, input, btns);
    overlay.append(box);
    document.body.append(overlay);
    input.focus();
    input.select();
  });
}

async function saveCurrentAsLibrary(): Promise<void> {
  const src = editor.getValue();
  const { diagnostics } = compileWithDiagnostics(src, { resolveModule });
  if (diagnostics.length) {
    setStatus(`can't save library — fix ${diagnostics.length} syntax error${diagnostics.length === 1 ? "" : "s"} first`, true);
    return;
  }
  const suggested = isValidModuleName(currentName) ? currentName : "";
  const name = await promptName('Library name — used in  import "…" :', suggested);
  if (!name) return;
  if (!isValidModuleName(name)) {
    setStatus(`invalid library name "${name}" — use letters, digits, _ - / (no spaces)`, true);
    return;
  }
  loadLibrary(name, src, "saved");
  setStatus(`✓ saved library "${name}" — reuse with:  import "${name}" as ns`);
}

// Insert `import "name" as ns` just inside the `house … {` header (or at the top
// for a module file). ns is a safe identifier derived from the last path segment.
function insertImport(name: string): void {
  const ns = (name.split("/").pop() || name).replace(/[^A-Za-z0-9_]/g, "_").replace(/^(?=\d)/, "_") || "lib";
  const lines = editor.getValue().split("\n");
  const hi = lines.findIndex((l) => /^\s*house\b.*\{\s*$/.test(l));
  const insLine = hi >= 0 ? hi + 2 : 1;
  const indent = hi >= 0 ? "  " : "";
  editor.executeEdits("insert-import", [
    { range: new monaco.Range(insLine, 1, insLine, 1), text: `${indent}import "${name}" as ${ns}\n`, forceMoveMarkers: true },
  ]);
  editor.focus();
}

function openLibraryInEditor(name: string): void {
  const src = getLibrarySource(name);
  if (src === undefined) return;
  detachFile();
  editor.setValue(src);
  currentName = name;
  updateFileLabel();
  setStatus(`editing library "${name}" — "Save current as library" updates it`);
}

function reportLoaded(names: string[]): void {
  if (!names.length) return;
  const list = names.map((n) => `"${n}"`).join(", ");
  setStatus(names.length === 1 ? `✓ loaded library ${list} into the cache` : `✓ loaded ${names.length} libraries into the cache: ${list}`);
}

// Load one or MORE .wdl files INTO the cache (desktop → native dialog; browser →
// file upload). The same uniform "cache of loaded libraries" both surfaces resolve
// from — multi-select so a whole set loads in one go, never one-by-one.
async function loadLibraryFilesNative(): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: true, filters: [{ name: "Wadi library", extensions: ["wdl"] }] });
  const paths = Array.isArray(picked) ? picked : typeof picked === "string" ? [picked] : [];
  if (!paths.length) return;
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const names: string[] = [];
  for (const p of paths) {
    const name = baseName(p).replace(/\.wdl$/i, "");
    try { loadLibrary(name, await readTextFile(p), "file"); names.push(name); } catch { /* skip unreadable */ }
  }
  reportLoaded(names);
  run();
}

function wireLibraryMenu(): void {
  const btn = document.getElementById("library")!;
  const menu = document.getElementById("library-menu")!;
  const libFile = document.getElementById("lib-file") as HTMLInputElement;
  libFile.addEventListener("change", async () => {
    const files = libFile.files ? [...libFile.files] : [];
    if (!files.length) return;
    const names: string[] = [];
    for (const f of files) {
      const name = f.name.replace(/\.wdl$/i, "");
      loadLibrary(name, await f.text(), "file");
      names.push(name);
    }
    libFile.value = "";
    reportLoaded(names);
    run();
  });

  const render = () => {
    const libs = listLibraries();
    const rows = libs
      .map(
        (l) =>
          `<div class="lib-row"><button class="lib-import" data-import="${escHtml(l.name)}" title="Insert import statement">` +
          `${escHtml(l.name)} <span class="desc">— ${l.origin}</span></button>` +
          `<button class="lib-tool" data-edit="${escHtml(l.name)}" title="Open in editor">✎</button>` +
          `<button class="lib-tool" data-del="${escHtml(l.name)}" title="Remove from cache">×</button></div>`,
      )
      .join("");
    menu.innerHTML =
      `<button id="lib-save">💾 Save current as library…</button>` +
      `<button id="lib-load">📂 Load library file…</button>` +
      (libs.length
        ? `<div class="lib-sep"></div>${rows}`
        : `<div class="lib-empty">No libraries cached yet. Save one, load a <code>.wdl</code> — or, in the desktop app, drop a <code>.wdl</code> beside your file.</div>`);
    document.getElementById("lib-save")!.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = true; void saveCurrentAsLibrary(); });
    document.getElementById("lib-load")!.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = true;
      if (isTauri()) void loadLibraryFilesNative();
      else libFile.click();
    });
    menu.querySelectorAll<HTMLElement>("[data-import]").forEach((el) =>
      el.addEventListener("click", (e) => { e.stopPropagation(); insertImport(el.dataset.import!); menu.hidden = true; }));
    menu.querySelectorAll<HTMLElement>("[data-edit]").forEach((el) =>
      el.addEventListener("click", (e) => { e.stopPropagation(); openLibraryInEditor(el.dataset.edit!); menu.hidden = true; }));
    menu.querySelectorAll<HTMLElement>("[data-del]").forEach((el) =>
      el.addEventListener("click", (e) => { e.stopPropagation(); removeLibrary(el.dataset.del!); render(); run(); }));
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) render();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener("click", () => { menu.hidden = true; });
}
wireLibraryMenu();

// Expose the editor + monaco for scripting/automation of the demo.
(window as unknown as { wadiEditor: typeof editor; monaco: typeof monaco }).wadiEditor = editor;
(window as unknown as { monaco: typeof monaco }).monaco = monaco;

// First compile + boot.
updateFileLabel();
run();
