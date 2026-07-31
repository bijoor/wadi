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
import { registerWadiDsl, LANG_ID } from "./dsl-language";
import { compileWithDiagnostics } from "../src/generator/toHouseConfig";
import { REFERENCE_HTML } from "./reference";
import minimalSrc from "../examples/minimal.wdl?raw";
import twoRoomSrc from "../examples/two_room.wdl?raw";
import twoStorySrc from "../examples/two_story.wdl?raw";
import coastalSrc from "../examples/coastal.wdl?raw";
import errorsSrc from "../examples/errors.wdl?raw";

const SAMPLES: Record<string, string> = {
  minimal: minimalSrc,
  two_room: twoRoomSrc,
  two_story: twoStorySrc,
  coastal: coastalSrc,
  errors: errorsSrc,
};
let currentName = "coastal"; // base filename for Save / Download

// Monaco only needs its base editor worker (plain-text language, no TS/JSON).
self.MonacoEnvironment = { getWorker: () => new editorWorker() };

registerWadiDsl(monaco);

const editor = monaco.editor.create(document.getElementById("editor")!, {
  value: coastalSrc,
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

async function pushToViewer(config: Record<string, unknown>): Promise<void> {
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
      setStatus("✓ rendered");
      return;
    }
    const wadi = await wadiPromise!;
    wadi.load(config); // live, in-place render (scene renders continuously)
    pokeResize();
    setStatus("✓ rendered");
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
  if (config) {
    setStatus("compiling…");
    void pushToViewer(config);
  } else {
    const first = diagnostics[0];
    setStatus(first ? `⚠ ${first.startLineNumber}:${first.startColumn} ${trim(first.message)}` : "error", true);
  }
}
function trim(m: string): string {
  return m.length > 80 ? m.slice(0, 79) + "…" : m;
}

let debounce: number | undefined;
editor.onDidChangeModelContent(() => {
  window.clearTimeout(debounce);
  debounce = window.setTimeout(run, 300);
});

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

  // Load a bundled sample.
  const sample = $("sample") as HTMLSelectElement;
  sample.addEventListener("change", () => {
    const src = SAMPLES[sample.value];
    if (src) {
      editor.setValue(src); // fires onDidChangeModelContent → recompile + render
      currentName = sample.value;
    }
    sample.selectedIndex = 0; // reset the label
  });

  // Open a .wdl from disk.
  const file = $("file") as HTMLInputElement;
  $("open").addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    editor.setValue(await f.text());
    currentName = f.name.replace(/\.(wdl|txt)$/i, "") || "house";
    file.value = "";
  });

  // Save the current .wdl source.
  $("save").addEventListener("click", () => {
    downloadText(`${currentName}.wdl`, editor.getValue(), "text/plain;charset=utf-8");
  });

  // Download the compiled .wadi (feed the desktop app / share).
  $("download").addEventListener("click", () => {
    const { config, diagnostics } = compileWithDiagnostics(editor.getValue());
    if (!config) {
      setStatus(`can't export — fix ${diagnostics.length} error${diagnostics.length === 1 ? "" : "s"}`, true);
      return;
    }
    downloadText(`${currentName}.wadi`, JSON.stringify(config, null, 2), "application/json");
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
run();
