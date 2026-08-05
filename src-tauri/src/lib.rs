use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

// A file path the app was asked to open before the webview was ready
// (cold start via double-click on macOS, or a CLI arg on Windows/Linux).
// The frontend drains it once on boot via `take_pending_open`; warm opens
// (app already running) are pushed live via the `wadi://open-file` event.
struct PendingOpen(Mutex<Option<String>>);

#[tauri::command]
fn take_pending_open(state: tauri::State<'_, PendingOpen>) -> Option<String> {
  state.0.lock().unwrap().take()
}

// ---- Localhost MCP bridge (Phase 2) -----------------------------------------
// The wadi-mcp server POSTs a resolved house config here; we drive the MAIN
// window's live 3D view (`window.wadi.load`) and, for /capture, read back a 3D
// image (`window.wadiCapture3D`). Rust and the webview rendezvous by request id:
// the HTTP thread parks on a channel that the `bridge_response` command fills
// once the webview has loaded/captured. Bound to 127.0.0.1 only.
struct BridgeReply {
  ok: bool,
  png: Option<String>,
  mime: Option<String>,
  error: Option<String>,
  // The house's layer registry (id/label/group), so a capture caller can learn
  // which layers exist and toggle/isolate them on a follow-up shot.
  layers: Option<serde_json::Value>,
}
struct BridgeState(Mutex<HashMap<String, Sender<BridgeReply>>>);

#[tauri::command]
fn bridge_response(
  state: tauri::State<'_, BridgeState>,
  id: String,
  ok: bool,
  png: Option<String>,
  mime: Option<String>,
  error: Option<String>,
  layers: Option<serde_json::Value>,
) {
  if let Some(tx) = state.0.lock().unwrap().remove(&id) {
    let _ = tx.send(BridgeReply { ok, png, mime, error, layers });
  }
}

fn respond_json(req: tiny_http::Request, status: u16, body: serde_json::Value) {
  let header =
    tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
  let resp = tiny_http::Response::from_string(body.to_string())
    .with_status_code(status)
    .with_header(header);
  let _ = req.respond(resp);
}

fn start_bridge(app: AppHandle) {
  static COUNTER: AtomicU64 = AtomicU64::new(1);
  let port: u16 = std::env::var("WADI_APP_PORT")
    .ok()
    .and_then(|s| s.parse().ok())
    .unwrap_or(8765);
  let server = match tiny_http::Server::http(("127.0.0.1", port)) {
    Ok(s) => s,
    Err(e) => {
      log::warn!("[wadi bridge] could not bind 127.0.0.1:{port}: {e}");
      return;
    }
  };
  log::info!("[wadi bridge] listening on http://127.0.0.1:{port}");
  std::thread::spawn(move || {
    for mut req in server.incoming_requests() {
      let url = req.url().to_string();
      if url == "/health" {
        respond_json(req, 200, serde_json::json!({ "ok": true, "app": "wadi" }));
        continue;
      }
      if url != "/load" && url != "/capture" {
        respond_json(req, 404, serde_json::json!({ "ok": false, "error": "not found" }));
        continue;
      }
      let mut body = String::new();
      if req.as_reader().read_to_string(&mut body).is_err() {
        respond_json(req, 400, serde_json::json!({ "ok": false, "error": "unreadable body" }));
        continue;
      }
      let parsed: serde_json::Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => {
          respond_json(req, 400, serde_json::json!({ "ok": false, "error": "invalid json" }));
          continue;
        }
      };
      let config = parsed
        .get("config")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
      // Optional { room } view hint for an interior capture — forwarded verbatim
      // to the webview, which resolves the room and seats the first-person camera.
      let view = parsed.get("view").cloned().unwrap_or(serde_json::Value::Null);
      let action = if url == "/capture" { "capture" } else { "load" };
      let id = COUNTER.fetch_add(1, Ordering::Relaxed).to_string();
      let (tx, rx) = channel::<BridgeReply>();
      if let Some(state) = app.try_state::<BridgeState>() {
        state.0.lock().unwrap().insert(id.clone(), tx);
      }
      let _ = app.emit_to(
        "main",
        "wadi://bridge-request",
        serde_json::json!({ "id": id, "action": action, "config": config, "view": view }),
      );
      match rx.recv_timeout(std::time::Duration::from_secs(20)) {
        Ok(reply) if reply.ok => {
          if action == "capture" {
            respond_json(
              req,
              200,
              serde_json::json!({ "ok": true, "png": reply.png, "mime": reply.mime, "layers": reply.layers }),
            );
          } else {
            respond_json(req, 200, serde_json::json!({ "ok": true }));
          }
        }
        Ok(reply) => respond_json(
          req,
          500,
          serde_json::json!({ "ok": false, "error": reply.error.unwrap_or_default() }),
        ),
        Err(_) => {
          if let Some(state) = app.try_state::<BridgeState>() {
            state.0.lock().unwrap().remove(&id);
          }
          respond_json(
            req,
            504,
            serde_json::json!({ "ok": false, "error": "webview did not respond" }),
          );
        }
      }
    }
  });
}

// Open (or focus) the WDL editor+renderer window — the bundled Monaco playground
// at /dsl, which compiles .wdl in-webview and drives the app renderer in a
// same-origin iframe. Fully offline; no dev server, no VS Code, no watch loop.
fn open_dsl_editor(app: &tauri::AppHandle) {
  if let Some(win) = app.get_webview_window("dsl") {
    let _ = win.set_focus();
    return;
  }
  match WebviewWindowBuilder::new(app, "dsl", WebviewUrl::App("/dsl/index.html".into()))
    .title("Wadi WDL — editor + live renderer")
    .inner_size(1500.0, 950.0)
    .min_inner_size(1000.0, 640.0)
    .resizable(true)
    .build()
  {
    Ok(_) => {}
    Err(e) => eprintln!("[wadi] failed to open WDL editor window: {e}"),
  }
}

// Command form of `open_dsl_editor`, so the app's own header link (main window)
// can open the WDL editor window — same as the ⌘⇧D menu item.
#[tauri::command]
fn show_dsl_editor(app: tauri::AppHandle) {
  open_dsl_editor(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Windows/Linux hand the opened file to the process as a CLI argument;
  // macOS instead delivers it as an "open documents" apple event, handled
  // as RunEvent::Opened in the run loop below. Capture a launch arg here so
  // a cold start on Win/Linux has the path immediately.
  let initial = std::env::args()
    .skip(1)
    .find(|a| a.to_lowercase().ends_with(".wadi"));

  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .manage(PendingOpen(Mutex::new(initial)))
    .manage(BridgeState(Mutex::new(HashMap::new())))
    .invoke_handler(tauri::generate_handler![take_pending_open, bridge_response, show_dsl_editor])
    // Custom menu on macOS: the default Edit menu claims Cmd+Z / Shift+Cmd+Z
    // for native undo/redo, which would shadow the app's model-level
    // undo/redo (handled in the webview via the standard keyboard shortcuts).
    // Rebuild the Edit menu WITHOUT undo/redo — keeping the clipboard items
    // for text fields — so those accelerators fall through to the frontend.
    // Save/Open/New (Cmd+S/O/N) aren't in the default menu, so they already
    // reach the webview unshadowed.
    .menu(|handle| {
      #[cfg(target_os = "macos")]
      {
        use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
        let app_menu = SubmenuBuilder::new(handle, "Wadi")
          .about(None)
          .separator()
          .services()
          .separator()
          .hide()
          .hide_others()
          .show_all()
          .separator()
          .quit()
          .build()?;
        let edit_menu = SubmenuBuilder::new(handle, "Edit")
          .cut()
          .copy()
          .paste()
          .select_all()
          .build()?;
        let dsl_item = MenuItemBuilder::new("WDL Editor")
          .id("open-dsl")
          .accelerator("Cmd+Shift+D")
          .build(handle)?;
        let window_menu = SubmenuBuilder::new(handle, "Window")
          .minimize()
          .separator()
          .item(&dsl_item)
          .separator()
          .close_window()
          .build()?;
        MenuBuilder::new(handle)
          .items(&[&app_menu, &edit_menu, &window_menu])
          .build()
      }
      #[cfg(not(target_os = "macos"))]
      {
        tauri::menu::Menu::default(handle)
      }
    })
    .on_menu_event(|app, event| {
      if event.id().as_ref() == "open-dsl" {
        open_dsl_editor(app);
      }
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // Start the localhost MCP bridge (Phase 2) so wadi-mcp can drive the live view.
      start_bridge(app.handle().clone());
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|app, event| {
      // macOS: Finder "Open" / `open file.wadi` (and, later, wadi:// deep
      // links) arrive here as URLs — both on cold start and while running.
      // Stash the path so a not-yet-ready webview can drain it on boot, and
      // emit an event so an already-running webview loads it live.
      if let RunEvent::Opened { urls } = event {
        for url in urls {
          let path = url
            .to_file_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| url.to_string());
          if let Some(state) = app.try_state::<PendingOpen>() {
            *state.0.lock().unwrap() = Some(path.clone());
          }
          let _ = app.emit("wadi://open-file", path);
        }
      }
    });
}
