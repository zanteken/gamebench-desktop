// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fps_monitor;
mod game_detect;
mod hardware;
mod logs;

use tauri::Manager;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // 硬件检测
            hardware::detect_hardware,
            hardware::get_cpu_info,
            hardware::get_gpu_info,
            hardware::get_ram_info,
            // FPS 监测
            fps_monitor::start_fps_monitor,
            fps_monitor::stop_fps_monitor,
            fps_monitor::get_fps_status,
            // 游戏检测
            game_detect::scan_running_games,
            game_detect::get_known_games,
            // 日志
            logs::read_logs,
            logs::clear_logs,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // 后台线程：定期扫描运行中的游戏
            std::thread::spawn(move || {
                game_detect::background_scanner(app_handle);
            });

            log::info!("GameBench CN 桌面端启动完成");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
