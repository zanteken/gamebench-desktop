use serde::{Deserialize, Serialize};
use sysinfo::System;

// ==================== 数据结构 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuInfo {
    /// 型号名 (e.g., "Intel Core i5-12400")
    pub name: String,
    /// 物理核心数
    pub cores: usize,
    /// 逻辑线程数
    pub threads: usize,
    /// 基础频率 (GHz)
    pub base_clock_ghz: f64,
    /// 当前频率 (GHz)
    pub current_clock_ghz: f64,
    /// CPU 架构
    pub arch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    /// 型号名 (e.g., "NVIDIA GeForce RTX 3060")
    pub name: String,
    /// 显存大小 (GB)
    pub vram_gb: f64,
    /// 驱动版本
    pub driver_version: String,
    /// 分辨率 (e.g., "1920x1080")
    pub resolution: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RamInfo {
    /// 总内存 (GB)
    pub total_gb: f64,
    /// 已使用 (GB)
    pub used_gb: f64,
    /// 可用 (GB)
    pub available_gb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub cpu: CpuInfo,
    pub gpus: Vec<GpuInfo>,
    pub ram: RamInfo,
    /// OS 信息
    pub os: String,
}

// ==================== CPU 检测 ====================

fn detect_cpu_info() -> CpuInfo {
    let mut sys = System::new_all();
    sys.refresh_cpu_all();

    let cpus = sys.cpus();
    let name = if !cpus.is_empty() {
        cpus[0].brand().to_string()
    } else {
        "Unknown CPU".to_string()
    };

    let threads = cpus.len();
    let cores = sys.physical_core_count().unwrap_or(threads / 2);

    // 频率 (MHz → GHz)
    let current_mhz = if !cpus.is_empty() {
        cpus[0].frequency() as f64
    } else {
        0.0
    };

    CpuInfo {
        name: clean_cpu_name(&name),
        cores,
        threads,
        base_clock_ghz: current_mhz / 1000.0,
        current_clock_ghz: current_mhz / 1000.0,
        arch: std::env::consts::ARCH.to_string(),
    }
}

/// 清理 CPU 名称中的多余空格和频率后缀
fn clean_cpu_name(raw: &str) -> String {
    let name = raw
        .replace("(R)", "")
        .replace("(TM)", "")
        .replace("  ", " ")
        .trim()
        .to_string();

    // 去除尾部频率 "@ 3.60GHz" 等
    if let Some(idx) = name.find(" @ ") {
        name[..idx].trim().to_string()
    } else {
        name
    }
}

// ==================== GPU 检测 (Windows) ====================

#[cfg(target_os = "windows")]
fn detect_gpu_info() -> Vec<GpuInfo> {
    use std::collections::HashMap;

    match detect_gpu_wmi() {
        Ok(gpus) => gpus,
        Err(e) => {
            log::warn!("WMI GPU 检测失败: {}, 使用备用方案", e);
            detect_gpu_fallback()
        }
    }
}

#[cfg(target_os = "windows")]
fn detect_gpu_wmi() -> Result<Vec<GpuInfo>, Box<dyn std::error::Error>> {
    use wmi::{COMLibrary, WMIConnection};
    use std::collections::HashMap;

    let com = COMLibrary::new()?;
    let wmi = WMIConnection::new(com)?;

    // 查询 Win32_VideoController
    let results: Vec<HashMap<String, wmi::Variant>> =
        wmi.raw_query("SELECT Name, AdapterRAM, DriverVersion, \
                        CurrentHorizontalResolution, CurrentVerticalResolution \
                        FROM Win32_VideoController")?;

    let mut gpus = Vec::new();
    for item in results {
        let name = match item.get("Name") {
            Some(wmi::Variant::String(s)) => s.clone(),
            _ => continue,
        };

        // AdapterRAM 返回 bytes (u32, 最大 4GB; 超过时可能溢出)
        let vram_bytes = match item.get("AdapterRAM") {
            Some(wmi::Variant::UI4(n)) => *n as u64,
            Some(wmi::Variant::I4(n)) => {
                if *n < 0 {
                    // 负值意味着超过 2GB，需要特殊处理
                    (*n as u32) as u64
                } else {
                    *n as u64
                }
            }
            _ => 0,
        };
        let vram_gb = vram_bytes as f64 / (1024.0 * 1024.0 * 1024.0);

        let driver = match item.get("DriverVersion") {
            Some(wmi::Variant::String(s)) => s.clone(),
            _ => "Unknown".to_string(),
        };

        let h_res = match item.get("CurrentHorizontalResolution") {
            Some(wmi::Variant::UI4(n)) => *n,
            _ => 0,
        };
        let v_res = match item.get("CurrentVerticalResolution") {
            Some(wmi::Variant::UI4(n)) => *n,
            _ => 0,
        };
        let resolution = if h_res > 0 && v_res > 0 {
            format!("{}x{}", h_res, v_res)
        } else {
            "Unknown".to_string()
        };

        // 跳过 Microsoft Basic Display Adapter 等虚拟设备
        if name.contains("Microsoft") || name.contains("Basic") {
            continue;
        }

        gpus.push(GpuInfo {
            name,
            vram_gb: (vram_gb * 10.0).round() / 10.0, // 保留1位小数
            driver_version: driver,
            resolution,
        });
    }

    Ok(gpus)
}

#[cfg(target_os = "windows")]
fn detect_gpu_fallback() -> Vec<GpuInfo> {
    // 备用方案：通过 DXGI 或 systeminfo 命令行
    vec![GpuInfo {
        name: "检测中...".to_string(),
        vram_gb: 0.0,
        driver_version: "Unknown".to_string(),
        resolution: "Unknown".to_string(),
    }]
}

#[cfg(not(target_os = "windows"))]
fn detect_gpu_info() -> Vec<GpuInfo> {
    // 非 Windows 平台的 stub
    vec![GpuInfo {
        name: "仅支持 Windows 检测".to_string(),
        vram_gb: 0.0,
        driver_version: "N/A".to_string(),
        resolution: "N/A".to_string(),
    }]
}

// ==================== RAM 检测 ====================

fn detect_ram_info() -> RamInfo {
    let mut sys = System::new_all();
    sys.refresh_memory();

    let total = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let used = sys.used_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let available = sys.available_memory() as f64 / (1024.0 * 1024.0 * 1024.0);

    RamInfo {
        total_gb: (total * 10.0).round() / 10.0,
        used_gb: (used * 10.0).round() / 10.0,
        available_gb: (available * 10.0).round() / 10.0,
    }
}

// ==================== OS 检测 ====================

fn detect_os() -> String {
    let name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let version = System::os_version().unwrap_or_else(|| "".to_string());
    let arch = System::cpu_arch().unwrap_or_else(|| "".to_string());
    format!("{} {} ({})", name, version, arch)
}

// ==================== Tauri 命令 ====================

/// 一次性获取全部硬件信息
#[tauri::command]
pub fn detect_hardware() -> Result<HardwareInfo, String> {
    log::info!("开始检测硬件...");

    let cpu = detect_cpu_info();
    let gpus = detect_gpu_info();
    let ram = detect_ram_info();
    let os = detect_os();

    log::info!("CPU: {}", cpu.name);
    for gpu in &gpus {
        log::info!("GPU: {} ({:.1} GB)", gpu.name, gpu.vram_gb);
    }
    log::info!("RAM: {:.1} GB", ram.total_gb);

    Ok(HardwareInfo { cpu, gpus, ram, os })
}

/// 仅获取 CPU 信息
#[tauri::command]
pub fn get_cpu_info() -> Result<CpuInfo, String> {
    Ok(detect_cpu_info())
}

/// 仅获取 GPU 信息
#[tauri::command]
pub fn get_gpu_info() -> Result<Vec<GpuInfo>, String> {
    Ok(detect_gpu_info())
}

/// 仅获取 RAM 信息
#[tauri::command]
pub fn get_ram_info() -> Result<RamInfo, String> {
    Ok(detect_ram_info())
}
