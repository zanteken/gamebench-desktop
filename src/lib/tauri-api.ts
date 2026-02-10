import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  HardwareInfo,
  CpuInfo,
  GpuInfo,
  RamInfo,
  FpsSnapshot,
  FpsSession,
  FpsStatus,
  DetectedGame,
} from "./types";

// ==================== 硬件检测 ====================

export async function detectHardware(): Promise<HardwareInfo> {
  return invoke<HardwareInfo>("detect_hardware");
}

export async function getCpuInfo(): Promise<CpuInfo> {
  return invoke<CpuInfo>("get_cpu_info");
}

export async function getGpuInfo(): Promise<GpuInfo[]> {
  return invoke<GpuInfo[]>("get_gpu_info");
}

export async function getRamInfo(): Promise<RamInfo> {
  return invoke<RamInfo>("get_ram_info");
}

// ==================== FPS 监测 ====================

export async function startFpsMonitor(processName: string): Promise<void> {
  return invoke("start_fps_monitor", { processName });
}

export async function stopFpsMonitor(): Promise<void> {
  return invoke("stop_fps_monitor");
}

export async function getFpsStatus(): Promise<FpsStatus> {
  return invoke<FpsStatus>("get_fps_status");
}

// FPS 事件监听
export function onFpsUpdate(
  callback: (snapshot: FpsSnapshot) => void
): Promise<UnlistenFn> {
  return listen<FpsSnapshot>("fps-update", (event) => {
    callback(event.payload);
  });
}

export function onFpsStarted(
  callback: (processName: string) => void
): Promise<UnlistenFn> {
  return listen<string>("fps-started", (event) => {
    callback(event.payload);
  });
}

export function onFpsStopped(
  callback: (processName: string) => void
): Promise<UnlistenFn> {
  return listen<string>("fps-stopped", (event) => {
    callback(event.payload);
  });
}

export function onFpsSessionComplete(
  callback: (session: FpsSession) => void
): Promise<UnlistenFn> {
  return listen<FpsSession>("fps-session-complete", (event) => {
    callback(event.payload);
  });
}

export function onFpsError(
  callback: (error: string) => void
): Promise<UnlistenFn> {
  return listen<string>("fps-error", (event) => {
    callback(event.payload);
  });
}

// ==================== 游戏检测 ====================

export async function scanRunningGames(): Promise<DetectedGame[]> {
  return invoke<DetectedGame[]>("scan_running_games");
}

export async function getKnownGames(): Promise<[string, string][]> {
  return invoke<[string, string][]>("get_known_games");
}

// 游戏事件监听
export function onGameDetected(
  callback: (game: DetectedGame) => void
): Promise<UnlistenFn> {
  return listen<DetectedGame>("game-detected", (event) => {
    callback(event.payload);
  });
}

export function onGameExited(
  callback: (processName: string) => void
): Promise<UnlistenFn> {
  return listen<string>("game-exited", (event) => {
    callback(event.payload);
  });
}
