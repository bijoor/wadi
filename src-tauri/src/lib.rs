use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

// A file path the app was asked to open before the webview was ready
// (cold start via double-click on macOS, or a CLI arg on Windows/Linux).
// The frontend drains it once on boot via `take_pending_open`; warm opens
// (app already running) are pushed live via the `wadi://open-file` event.
struct PendingOpen(Mutex<Option<String>>);

#[tauri::command]
fn take_pending_open(state: tauri::State<'_, PendingOpen>) -> Option<String> {
  state.0.lock().unwrap().take()
}

// Open (or focus) the DSL editor+renderer window — the bundled Monaco playground
// at /dsl, which compiles .wdl in-webview and drives the app renderer in a
// same-origin iframe. Fully offline; no dev server, no VS Code, no watch loop.
fn open_dsl_editor(app: &tauri::AppHandle) {
  if let Some(win) = app.get_webview_window("dsl") {
    let _ = win.set_focus();
    return;
  }
  match WebviewWindowBuilder::new(app, "dsl", WebviewUrl::App("/dsl/index.html".into()))
    .title("Wadi DSL — editor + live renderer")
    .inner_size(1500.0, 950.0)
    .min_inner_size(1000.0, 640.0)
    .resizable(true)
    .build()
  {
    Ok(_) => {}
    Err(e) => eprintln!("[wadi] failed to open DSL editor window: {e}"),
  }
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
    .invoke_handler(tauri::generate_handler![take_pending_open])
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
        let dsl_item = MenuItemBuilder::new("DSL Editor")
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
