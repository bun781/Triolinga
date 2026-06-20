#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(debug_assertions))]
use std::{thread, time::Duration};
use tauri::Manager;

#[cfg(not(debug_assertions))]
fn node_binary() -> &'static str {
    for candidate in [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ] {
        if std::path::Path::new(candidate).exists() {
            return candidate;
        }
    }

    "node"
}

#[cfg(not(debug_assertions))]
fn wait_for_server(url: &str, max_attempts: u32) {
    for _ in 0..max_attempts {
        if std::net::TcpStream::connect(url).is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(500));
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                let _ = window.open_devtools();
            }

            #[cfg(not(debug_assertions))]
            {
                let resource_dir = app
                    .path()
                    .resource_dir()
                    .expect("failed to get resource dir");
                let server_dir = resource_dir.join(".next/standalone");
                let server_js = server_dir.join("server.js");
                let data_dir = app
                    .path()
                    .app_data_dir()
                    .expect("failed to get app data dir")
                    .join("pglite");
                std::fs::create_dir_all(&data_dir).expect("failed to create PGlite data dir");

                std::process::Command::new(node_binary())
                    .arg(&server_js)
                    .current_dir(&server_dir)
                    .env("PORT", "3001")
                    .env("HOSTNAME", "127.0.0.1")
                    .env("PGLITE_DATA_DIR", &data_dir)
                    .spawn()
                    .expect("failed to spawn Next.js server");

                wait_for_server("127.0.0.1:3001", 40);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
