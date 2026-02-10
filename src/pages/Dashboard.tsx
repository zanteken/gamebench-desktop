import { useEffect, useState } from "react";
import { Cpu, MonitorSmartphone, MemoryStick, RefreshCw, Loader2, Gamepad2 } from "lucide-react";
import { detectHardware, scanRunningGames, onGameDetected, onGameExited } from "../lib/tauri-api";
import type { HardwareInfo, DetectedGame } from "../lib/types";

export default function Dashboard() {
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningGames, setRunningGames] = useState<DetectedGame[]>([]);

  const loadHardware = async () => {
    setLoading(true);
    setError(null);
    try {
      const hw = await detectHardware();
      setHardware(hw);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadGames = async () => {
    try {
      const games = await scanRunningGames();
      setRunningGames(games);
    } catch (_e) {
      // 静默失败
    }
  };

  useEffect(() => {
    loadHardware();
    loadGames();

    // 监听游戏启动/退出事件
    const unsub1 = onGameDetected((game) => {
      setRunningGames((prev) => [...prev, game]);
    });
    const unsub2 = onGameExited((name) => {
      setRunningGames((prev) => prev.filter((g) => g.process_name !== name));
    });

    // 定期刷新游戏列表
    const interval = setInterval(loadGames, 10000);

    return () => {
      unsub1.then((fn) => fn());
      unsub2.then((fn) => fn());
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">硬件概览</h1>
        <button
          onClick={loadHardware}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-surface-card border border-border text-slate-400 hover:text-white hover:border-brand-600/50 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          重新检测
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          检测失败: {error}
        </div>
      )}

      {loading && !hardware && (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 size={24} className="animate-spin mr-3" />
          正在检测硬件配置...
        </div>
      )}

      {hardware && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CPU 卡片 */}
          <div className="p-5 rounded-xl bg-surface-card border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Cpu size={20} className="text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500">处理器</div>
                <div className="text-sm font-semibold text-white">CPU</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 mb-0.5">型号</div>
                <div className="text-sm text-white font-medium">{hardware.cpu.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">核心</div>
                  <div className="text-lg font-bold text-white">{hardware.cpu.cores}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">线程</div>
                  <div className="text-lg font-bold text-white">{hardware.cpu.threads}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">频率</div>
                <div className="text-sm text-white">{hardware.cpu.base_clock_ghz.toFixed(2)} GHz</div>
              </div>
            </div>
          </div>

          {/* GPU 卡片 */}
          {hardware.gpus.map((gpu, i) => (
            <div key={i} className="p-5 rounded-xl bg-surface-card border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <MonitorSmartphone size={20} className="text-green-400" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">显卡 {hardware.gpus.length > 1 ? `#${i + 1}` : ""}</div>
                  <div className="text-sm font-semibold text-white">GPU</div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">型号</div>
                  <div className="text-sm text-white font-medium">{gpu.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500">显存</div>
                    <div className="text-lg font-bold text-white">{gpu.vram_gb} GB</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">分辨率</div>
                    <div className="text-sm text-white">{gpu.resolution}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">驱动版本</div>
                  <div className="text-xs text-slate-400">{gpu.driver_version}</div>
                </div>
              </div>
            </div>
          ))}

          {/* RAM 卡片 */}
          <div className="p-5 rounded-xl bg-surface-card border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MemoryStick size={20} className="text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500">内存</div>
                <div className="text-sm font-semibold text-white">RAM</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500">总量</div>
                <div className="text-2xl font-bold text-white">{hardware.ram.total_gb} GB</div>
              </div>
              {/* 内存使用条 */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>已使用 {hardware.ram.used_gb} GB</span>
                  <span>可用 {hardware.ram.available_gb} GB</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{
                      width: `${(hardware.ram.used_gb / hardware.ram.total_gb) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">系统</div>
                <div className="text-xs text-slate-400">{hardware.os}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 运行中的游戏 */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Gamepad2 size={16} className="text-brand-400" />
          运行中的游戏
        </h2>
        {runningGames.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-surface-card border border-border">
            <Gamepad2 size={32} className="mx-auto mb-3 text-slate-600" />
            <div className="text-sm text-slate-500">未检测到正在运行的游戏</div>
            <div className="text-xs text-slate-600 mt-1">启动游戏后将自动检测并提示开始 FPS 监测</div>
          </div>
        ) : (
          <div className="space-y-2">
            {runningGames.map((game) => (
              <div
                key={game.pid}
                className="flex items-center justify-between p-4 rounded-xl bg-surface-card border border-border"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {game.game_name || game.process_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {game.process_name} · PID: {game.pid}
                    {game.app_id && ` · Steam #${game.app_id}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-400">运行中</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
