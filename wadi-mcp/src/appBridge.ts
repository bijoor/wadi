// Client for the Wadi desktop app's localhost bridge (Phase 2). When the Tauri
// app is running it exposes a tiny HTTP server that can load a config into the
// live 3D view and capture a real 3D PNG. These calls are best-effort: if the
// app isn't running they just fail fast, and the tools fall back to a message.
//
// Contract (must match src-tauri):
//   GET  /health            → 200 { ok: true }
//   POST /load    {config}  → 200 { ok: true }              (show it in the live view)
//   POST /capture {config}  → 200 { ok: true, png: <b64> }  (load + return a 3D PNG)
// Port: default 8765, override with WADI_APP_PORT (both sides read the same env).

const PORT = Number(process.env.WADI_APP_PORT || 8765);
const BASE = `http://127.0.0.1:${PORT}`;

/** Is the Wadi desktop app running and serving the bridge? */
export async function appReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

/** Load a resolved house config into the app's live 3D view. */
export async function appLoad(config: unknown): Promise<void> {
  const r = await fetch(`${BASE}/load`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`app /load returned ${r.status}`);
}

export interface CaptureLayer {
  id: string;
  label: string;
  group?: string;
}
export interface CaptureView {
  /** Seat the first-person camera inside this room (by name/key). */
  room?: string;
  /** Exterior preset angle: iso | front | back | left | right | top. */
  camera?: string;
  /** Show/hide layers by id or label, e.g. { Structure: false }. */
  layers?: Record<string, boolean>;
  /** Show ONLY these layers (by id or label), hide the rest. */
  isolate?: string[];
}
export interface CaptureResult {
  data: string;
  mime: string;
  /** The house's layer registry, so the caller can refine a follow-up shot. */
  layers?: CaptureLayer[];
}

/** Load a config and capture a 3D image (base64 + mime) from the app's renderer.
 *  `view.room` → interior; `view.camera` → a named exterior angle; `view.layers`/
 *  `view.isolate` → toggle/isolate layers before the shot (restored after). The
 *  house's layer list is returned so a caller can discover ids and refine. */
export async function appCapture(config: unknown, view?: CaptureView): Promise<CaptureResult> {
  const r = await fetch(`${BASE}/capture`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config, view }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`app /capture returned ${r.status}`);
  const j = (await r.json()) as {
    ok?: boolean;
    png?: string;
    mime?: string;
    error?: string;
    layers?: CaptureLayer[];
  };
  if (!j.ok || !j.png) throw new Error(j.error || "capture failed");
  return { data: j.png, mime: j.mime || "image/jpeg", layers: j.layers };
}

/** The message used when a 3D tool is called but the app isn't open. */
export const APP_NOT_RUNNING =
  "The Wadi desktop app isn't running, so live 3D isn't available. Open the Wadi app " +
  "(it serves the bridge on 127.0.0.1:" +
  PORT +
  "), or use `wadi_preview` for headless 2D drawings (plans / elevations / roof).";
