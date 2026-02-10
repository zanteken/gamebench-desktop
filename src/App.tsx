import { useState, useEffect, useCallback } from "react";
import Dashboard from "./pages/Dashboard";
import FpsMonitor from "./pages/FpsMonitor";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import { Monitor, Gauge, Settings as SettingsIcon, Gamepad2, FileText } from "lucide-react";
import { detectHardware, scanRunningGames, onGameDetected, onGameExited } from "./lib/tauri-api";
import type { HardwareInfo, DetectedGame } from "./lib/types";

type Page = "dashboard" | "fps" | "settings" | "logs";

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "硬件概览", icon: <Monitor size={20} /> },
  { id: "fps", label: "FPS 监测", icon: <Gauge size={20} /> },
  { id: "logs", label: "运行日志", icon: <FileText size={20} /> },
  { id: "settings", label: "设置", icon: <SettingsIcon size={20} /> },
];

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  // 硬件状态（提升到 App 层，避免切换 tab 时重新检测）
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [hardwareError, setHardwareError] = useState<string | null>(null);
  const [runningGames, setRunningGames] = useState<DetectedGame[]>([]);

  // 加载硬件信息
  const loadHardware = useCallback(async () => {
    setHardwareLoading(true);
    setHardwareError(null);
    try {
      const hw = await detectHardware();
      setHardware(hw);
    } catch (e) {
      setHardwareError(String(e));
    } finally {
      setHardwareLoading(false);
    }
  }, []);

  // 加载游戏列表
  const loadGames = useCallback(async () => {
    try {
      const games = await scanRunningGames();
      setRunningGames(games);
    } catch (_e) {
      // 静默失败
    }
  }, []);

  // 初始化：只执行一次
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
  }, [loadHardware, loadGames]);

  return (
    <div className="flex h-screen bg-surface">
      {/* 侧边栏 */}
      <aside className="w-56 flex flex-col border-r border-border bg-surface-card">
        {/* Logo 区域（可拖动窗口） */}
        <div
          className="flex items-center gap-2.5 px-5 py-4 border-b border-border"
          data-tauri-drag-region
        >
          <Gamepad2 size={24} className="text-brand-400" />
          <div>
            <div className="text-sm font-bold text-white">GameBench</div>
            <div className="text-[10px] text-slate-500">PC 性能检测</div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 py-3 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                page === item.id
                  ? "bg-brand-600/20 text-brand-400"
                  : "text-slate-400 hover:text-white hover:bg-surface-hover"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* 版本信息 */}
        <div className="px-5 py-3 border-t border-border text-[10px] text-slate-600">
          v0.1.1 · PresentMon 2.x
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        {page === "dashboard" && (
          <Dashboard
            hardware={hardware}
            hardwareLoading={hardwareLoading}
            hardwareError={hardwareError}
            runningGames={runningGames}
            onRefreshHardware={loadHardware}
          />
        )}
        {page === "fps" && <FpsMonitor />}
        {page === "logs" && <Logs />}
        {page === "settings" && <Settings />}
      </main>
    </div>
  );
}
