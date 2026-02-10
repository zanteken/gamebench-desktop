// ==================== 硬件信息 ====================

export interface CpuInfo {
  name: string;
  cores: number;
  threads: number;
  base_clock_ghz: number;
  current_clock_ghz: number;
  arch: string;
}

export interface GpuInfo {
  name: string;
  vram_gb: number;
  driver_version: string;
  resolution: string;
}

export interface RamInfo {
  total_gb: number;
  used_gb: number;
  available_gb: number;
}

export interface HardwareInfo {
  cpu: CpuInfo;
  gpus: GpuInfo[];
  ram: RamInfo;
  os: string;
}

// ==================== FPS 监测 ====================

export interface FpsSnapshot {
  fps: number;
  fps_1_low: number;
  fps_01_low: number;
  frametime_ms: number;
  cpu_busy_ms: number;
  gpu_busy_ms: number;
  process_name: string;
  elapsed_secs: number;
}

export interface FpsSession {
  process_name: string;
  avg_fps: number;
  fps_1_low: number;
  fps_01_low: number;
  max_fps: number;
  min_fps: number;
  total_frames: number;
  duration_secs: number;
}

export interface FpsStatus {
  running: boolean;
  process_name: string | null;
  current_fps: number | null;
}

// ==================== 游戏检测 ====================

export interface DetectedGame {
  process_name: string;
  pid: number;
  game_name: string | null;
  app_id: number | null;
}
