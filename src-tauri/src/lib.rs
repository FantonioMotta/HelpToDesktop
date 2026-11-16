use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, LogicalSize, Manager, PhysicalPosition, Size, WebviewWindow, WindowEvent,
};
use tauri_plugin_sql::{Migration, MigrationKind};

mod atlas;

const DATABASE_URL: &str = "sqlite:helpbar.db";

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks (created_at DESC);

            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes (updated_at DESC);

            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY NOT NULL,
                text TEXT NOT NULL,
                due_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                notified INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders (due_at);

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL DEFAULT '',
                end_time TEXT NOT NULL DEFAULT '',
                notes TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_date ON events (date, start_time);
        ",
        kind: MigrationKind::Up,
    }]
}

const COMPACT_W: f64 = 560.0;
const COMPACT_H: f64 = 72.0;
const EXPANDED_W: f64 = 1040.0;
const EXPANDED_H: f64 = 720.0;
const TOP_MARGIN: f64 = 8.0;
const TOP_MARGIN_COMPACT: f64 = 0.0;

fn position_window_top_center(window: &WebviewWindow, margin_logical: f64) -> tauri::Result<()> {
    if let Some(monitor) = window.primary_monitor()? {
        let screen = monitor.size();
        let scale = monitor.scale_factor();
        let win_size = window.outer_size()?;
        let x = ((screen.width as i32 - win_size.width as i32) / 2).max(0);
        let top_margin_physical = (margin_logical * scale).round() as i32;
        window.set_position(PhysicalPosition::new(x, top_margin_physical))?;
    }
    Ok(())
}

fn apply_shell_mode(window: &WebviewWindow, mode: &str) -> tauri::Result<()> {
    let (w, h, margin) = match mode {
        "expanded" | "focus" => (EXPANDED_W, EXPANDED_H, TOP_MARGIN),
        _ => (COMPACT_W, COMPACT_H, TOP_MARGIN_COMPACT),
    };
    window.set_size(Size::Logical(LogicalSize::new(w, h)))?;
    // Reposition after resize so it stays centered on the primary monitor.
    position_window_top_center(window, margin)?;
    Ok(())
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            _ => {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
    }
}

#[tauri::command]
fn set_shell_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    apply_shell_mode(&window, &mode).map_err(|e| e.to_string())?;
    Ok(())
}

/// Fully terminates the application (unlike closing the window, which hides to tray).
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Single-instance must be the first plugin: it prevents a second process
        // from opening the same SQLite file concurrently.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
            let _ = app.emit("helpbar:expand", ());
        }))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            set_shell_mode,
            quit_app,
            atlas::atlas_model_status,
            atlas::atlas_runtime_status,
            atlas::atlas_download_models,
            atlas::atlas_delete_models,
            atlas::atlas_start_ptt,
            atlas::atlas_stop_ptt,
            atlas::atlas_cancel,
            atlas::atlas_set_wake_word
        ])
        .setup(|app| {
            app.manage(atlas::AtlasState::new(app.handle().clone()));

            // System tray
            let show_item = MenuItem::with_id(app, "show", "Mostrar HelpBar", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "Configurações...", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Ocultar", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&show_item, &settings_item, &hide_item, &quit_item],
            )?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("HelpBar Desktop")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "settings" => {
                        show_main_window(app);
                        let _ = app.emit("helpbar:open-settings", ());
                    }
                    "hide" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            let _tray = tray_builder.build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = apply_shell_mode(&window, "compact");
                // Reposition once more shortly after show to account for DPI/layout settling.
                let window2 = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(150));
                    let _ = position_window_top_center(&window2, TOP_MARGIN_COMPACT);
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray instead of terminating
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building HelpBar Desktop")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<atlas::AtlasState>() {
                    state.shutdown();
                }
            }
        });
}
