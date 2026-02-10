use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

// ==================== 数据结构 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FpsSnapshot {
    /// 当前 FPS (1秒滑动窗口平均)
    pub fps: f64,
    /// 1% Low FPS
    pub fps_1_low: f64,
    /// 0.1% Low FPS
    pub fps_01_low: f64,
    /// 帧时间 (ms)
    pub frametime_ms: f64,
    /// CPU 占用时间 (ms)
    pub cpu_busy_ms: f64,
    /// GPU 占用时间 (ms)
    pub gpu_busy_ms: f64,
    /// 监测的进程名
    pub process_name: String,
    /// 从开始监测到现在的秒数
    pub elapsed_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FpsSession {
    /// 游戏进程名
    pub process_name: String,
    /// 平均 FPS
    pub avg_fps: f64,
    /// 1% Low
    pub fps_1_low: f64,
    /// 0.1% Low
    pub fps_01_low: f64,
    /// 最大 FPS
    pub max_fps: f64,
    /// 最小 FPS
    pub min_fps: f64,
    /// 总帧数
    pub total_frames: u64,
    /// 监测时长 (秒)
    pub duration_secs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FpsStatus {
    pub running: bool,
    pub process_name: Option<String>,
    pub current_fps: Option<f64>,
}

// ==================== 全局状态 ====================

struct MonitorState {
    child: Option<Child>,
    running: bool,
    process_name: String,
    frame_times: Vec<f64>,  // 最近的帧时间 (ms)
    start_time: Option<Instant>,
    all_frame_times: Vec<f64>,  // 本次 session 所有帧时间
}

fn get_monitor() -> &'static Arc<Mutex<MonitorState>> {
    static MONITOR: OnceLock<Arc<Mutex<MonitorState>>> = OnceLock::new();
    MONITOR.get_or_init(|| {
        Arc::new(Mutex::new(MonitorState {
            child: None,
            running: false,
            process_name: String::new(),
            frame_times: Vec::new(),
            start_time: None,
            all_frame_times: Vec::new(),
        }))
    })
}

// ==================== PresentMon 路径 ====================

/// 获取捆绑的 PresentMon.exe 路径
fn get_presentmon_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    // 开发模式：相对路径
    let dev_path = std::path::PathBuf::from("src-tauri/bin/PresentMon.exe");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // 打包模式：Tauri resource 目录
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("无法获取资源目录: {}", e))?;

    let bundled = resource_dir.join("bin").join("PresentMon.exe");
    if bundled.exists() {
        return Ok(bundled);
    }

    // 系统 PATH
    if let Ok(output) = Command::new("where").arg("PresentMon.exe").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !path.is_empty() {
                return Ok(std::path::PathBuf::from(path));
            }
        }
    }

    Err(
        "未找到 PresentMon.exe。请从 https://github.com/GameTechDev/PresentMon/releases \
         下载并放到 src-tauri/bin/ 目录"
            .to_string(),
    )
}

// ==================== 核心逻辑 ====================

/// 从 PresentMon CSV 行中解析帧时间数据
/// CSV 列 (v2): Application,ProcessID,SwapChainAddress,Runtime,SyncInterval,
///              PresentFlags,AllowsTearing,PresentMode,CPUStartTime,CPUStartQPC,
///              FrameTime,CPUBusy,CPUWait,GPULatency,GPUTime,GPUBusy,...
fn parse_csv_line(header: &[String], line: &str) -> Option<(String, f64, f64, f64)> {
    let fields: Vec<&str> = line.split(',').collect();
    if fields.len() < 5 {
        return None;
    }

    // 通过列名找索引
    let app_idx = header.iter().position(|h| h == "Application")?;
    let frametime_idx = header
        .iter()
        .position(|h| h == "FrameTime" || h == "MsBetweenPresents")?;
    let cpu_idx = header.iter().position(|h| h == "CPUBusy").unwrap_or(0);
    let gpu_idx = header
        .iter()
        .position(|h| h == "GPUBusy" || h == "GPUTime")
        .unwrap_or(0);

    let app = fields.get(app_idx)?.to_string();
    let frametime: f64 = fields.get(frametime_idx)?.parse().ok()?;
    let cpu_busy: f64 = fields
        .get(cpu_idx)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let gpu_busy: f64 = fields
        .get(gpu_idx)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);

    if frametime > 0.0 && frametime < 1000.0 {
        Some((app, frametime, cpu_busy, gpu_busy))
    } else {
        None
    }
}

/// 计算 percentile low FPS
fn percentile_low_fps(frame_times: &[f64], percentile: f64) -> f64 {
    if frame_times.is_empty() {
        return 0.0;
    }
    let mut sorted = frame_times.to_vec();
    sorted.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));

    let count = ((percentile / 100.0) * sorted.len() as f64).ceil() as usize;
    let count = count.max(1).min(sorted.len());

    let worst_times = &sorted[..count];
    let avg_worst = worst_times.iter().sum::<f64>() / worst_times.len() as f64;

    if avg_worst > 0.0 {
        1000.0 / avg_worst
    } else {
        0.0
    }
}

/// FPS 实时推送线程
fn fps_reader_thread(app: AppHandle, process_name: String) {
    let monitor = get_monitor();

    // 获取 PresentMon 路径
    let pm_path = match get_presentmon_path(&app) {
        Ok(p) => p,
        Err(e) => {
            log::error!("{}", e);
            let _ = app.emit("fps-error", e);
            return;
        }
    };

    // 启动 PresentMon
    let mut cmd = Command::new(&pm_path);
    cmd.args([
        "--output_stdout",
        "--stop_existing_session",
        "--terminate_on_proc_exit",
        "--process_name",
        &process_name,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    // Windows: 隐藏控制台窗口
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    log::info!("启动 PresentMon: {:?} --process_name {}", pm_path, process_name);

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let msg = format!("启动 PresentMon 失败: {}。请确保以管理员身份运行。", e);
            log::error!("{}", msg);
            let _ = app.emit("fps-error", msg);
            return;
        }
    };

    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            log::error!("无法获取 PresentMon stdout");
            return;
        }
    };

    // 保存子进程引用
    {
        let mut state = monitor.lock().unwrap();
        state.child = Some(child);
        state.running = true;
        state.process_name = process_name.clone();
        state.start_time = Some(Instant::now());
        state.frame_times.clear();
        state.all_frame_times.clear();
    }

    let _ = app.emit("fps-started", &process_name);

    let reader = BufReader::new(stdout);
    let mut header: Vec<String> = Vec::new();
    let mut window: Vec<f64> = Vec::new(); // 1秒窗口
    let mut window_start = Instant::now();

    for line_result in reader.lines() {
        // 检查是否已停止
        {
            let state = monitor.lock().unwrap();
            if !state.running {
                break;
            }
        }

        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // 第一行是 CSV header
        if header.is_empty() {
            header = trimmed.split(',').map(|s| s.trim().to_string()).collect();
            log::info!("PresentMon CSV 列: {:?}", &header[..header.len().min(10)]);
            continue;
        }

        // 解析数据行
        if let Some((_, frametime, cpu_busy, gpu_busy)) = parse_csv_line(&header, trimmed) {
            window.push(frametime);

            // 保存到全局状态
            {
                let mut state = monitor.lock().unwrap();
                state.all_frame_times.push(frametime);
            }

            // 每秒推送一次快照
            if window_start.elapsed().as_secs_f64() >= 1.0 {
                if !window.is_empty() {
                    let avg_frametime =
                        window.iter().sum::<f64>() / window.len() as f64;
                    let fps = 1000.0 / avg_frametime;
                    let fps_1_low = percentile_low_fps(&window, 1.0);
                    let fps_01_low = percentile_low_fps(&window, 0.1);

                    let elapsed = {
                        let state = monitor.lock().unwrap();
                        state
                            .start_time
                            .map(|t| t.elapsed().as_secs_f64())
                            .unwrap_or(0.0)
                    };

                    let snapshot = FpsSnapshot {
                        fps: (fps * 10.0).round() / 10.0,
                        fps_1_low: (fps_1_low * 10.0).round() / 10.0,
                        fps_01_low: (fps_01_low * 10.0).round() / 10.0,
                        frametime_ms: (avg_frametime * 100.0).round() / 100.0,
                        cpu_busy_ms: (cpu_busy * 100.0).round() / 100.0,
                        gpu_busy_ms: (gpu_busy * 100.0).round() / 100.0,
                        process_name: process_name.clone(),
                        elapsed_secs: (elapsed * 10.0).round() / 10.0,
                    };

                    let _ = app.emit("fps-update", &snapshot);
                }

                window.clear();
                window_start = Instant::now();
            }
        }
    }

    // 监测结束，生成 session 报告
    let session = {
        let mut state = monitor.lock().unwrap();
        state.running = false;

        let all = &state.all_frame_times;
        if !all.is_empty() {
            let avg_ft = all.iter().sum::<f64>() / all.len() as f64;
            let min_ft = all.iter().cloned().fold(f64::INFINITY, f64::min);
            let max_ft = all.iter().cloned().fold(0.0_f64, f64::max);
            let duration = state
                .start_time
                .map(|t| t.elapsed().as_secs_f64())
                .unwrap_or(0.0);

            Some(FpsSession {
                process_name: state.process_name.clone(),
                avg_fps: (1000.0 / avg_ft * 10.0).round() / 10.0,
                fps_1_low: (percentile_low_fps(all, 1.0) * 10.0).round() / 10.0,
                fps_01_low: (percentile_low_fps(all, 0.1) * 10.0).round() / 10.0,
                max_fps: (1000.0 / min_ft * 10.0).round() / 10.0,
                min_fps: (1000.0 / max_ft * 10.0).round() / 10.0,
                total_frames: all.len() as u64,
                duration_secs: (duration * 10.0).round() / 10.0,
            })
        } else {
            None
        }
    };

    if let Some(session) = session {
        log::info!(
            "FPS Session 结束: {} | 平均 {:.1} FPS | 1% Low {:.1} | 时长 {:.0}s",
            session.process_name,
            session.avg_fps,
            session.fps_1_low,
            session.duration_secs
        );
        let _ = app.emit("fps-session-complete", &session);
    }

    let _ = app.emit("fps-stopped", &process_name);
}

// ==================== Tauri 命令 ====================

/// 开始 FPS 监测
#[tauri::command]
pub fn start_fps_monitor(app: AppHandle, process_name: String) -> Result<(), String> {
    let monitor = get_monitor();
    {
        let state = monitor.lock().unwrap();
        if state.running {
            return Err(format!(
                "已经在监测 {} 的帧率",
                state.process_name
            ));
        }
    }

    log::info!("开始监测: {}", process_name);

    let app_clone = app.clone();
    let name_clone = process_name.clone();
    std::thread::spawn(move || {
        fps_reader_thread(app_clone, name_clone);
    });

    Ok(())
}

/// 停止 FPS 监测
#[tauri::command]
pub fn stop_fps_monitor() -> Result<(), String> {
    let monitor = get_monitor();
    let mut state = monitor.lock().unwrap();
    state.running = false;

    if let Some(ref mut child) = state.child {
        let _ = child.kill();
        log::info!("已停止 PresentMon 进程");
    }
    state.child = None;

    Ok(())
}

/// 获取当前监测状态
#[tauri::command]
pub fn get_fps_status() -> Result<FpsStatus, String> {
    let monitor = get_monitor();
    let state = monitor.lock().unwrap();

    let current_fps = if !state.all_frame_times.is_empty() {
        let recent: Vec<&f64> = state
            .all_frame_times
            .iter()
            .rev()
            .take(60) // 最近60帧
            .collect();
        let avg = recent.iter().copied().sum::<f64>() / recent.len() as f64;
        Some((1000.0 / avg * 10.0).round() / 10.0)
    } else {
        None
    };

    Ok(FpsStatus {
        running: state.running,
        process_name: if state.running {
            Some(state.process_name.clone())
        } else {
            None
        },
        current_fps,
    })
}
