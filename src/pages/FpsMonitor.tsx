import { useEffect, useState, useRef } from "react";
import { Play, Square, Activity, Clock, Zap, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  startFpsMonitor, stopFpsMonitor, scanRunningGames,
  onFpsUpdate, onFpsStopped, onFpsSessionComplete, onFpsError,
} from "../lib/tauri-api";
import type { FpsSnapshot, FpsSession, DetectedGame } from "../lib/types";

const MAX_CHART_POINTS = 120; // 2分钟 (每秒1个点)

export default function FpsMonitor() {
  const [running, setRunning] = useState(false);
  const [processName, setProcessName] = useState("");
  const [games, setGames] = useState<DetectedGame[]>([]);
  const [snapshots, setSnapshots] = useState<FpsSnapshot[]>([]);
  const [latest, setLatest] = useState<FpsSnapshot | null>(null);
  const [session, setSession] = useState<FpsSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chartRef = useRef<FpsSnapshot[]>([]);

  // 扫描运行中的游戏
  const refreshGames = async () => {
    try {
      const g = await scanRunningGames();
      setGames(g);
      // 自动选择第一个
      if (g.length > 0 && !processName) {
        setProcessName(g[0].process_name);
      }
    } catch (_) {}
  };

  useEffect(() => {
    refreshGames();
    const interval = setInterval(refreshGames, 5000);

    // 监听事件
    const unsub1 = onFpsUpdate((snap) => {
      setLatest(snap);
      chartRef.current = [...chartRef.current.slice(-MAX_CHART_POINTS + 1), snap];
      setSnapshots([...chartRef.current]);
    });

    const unsub2 = onFpsStopped(() => {
      setRunning(false);
    });

    const unsub3 = onFpsSessionComplete((s) => {
      setSession(s);
    });

    const unsub4 = onFpsError((err) => {
      setError(err);
      setRunning(false);
    });

    return () => {
      clearInterval(interval);
      unsub1.then((fn) => fn());
      unsub2.then((fn) => fn());
      unsub3.then((fn) => fn());
      unsub4.then((fn) => fn());
    };
  }, []);

  const handleStart = async () => {
    if (!processName.trim()) {
      setError("请输入或选择游戏进程名");
      return;
    }
    setError(null);
    setSession(null);
    setSnapshots([]);
    chartRef.current = [];
    try {
      await startFpsMonitor(processName);
      setRunning(true);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleStop = async () => {
    try {
      await stopFpsMonitor();
    } catch (e) {
      setError(String(e));
    }
  };

  // FPS 颜色映射
  const fpsColor = (fps: number) => {
    if (fps >= 60) return "text-green-400";
    if (fps >= 30) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-white">FPS 实时监测</h1>

      {/* 控制区 */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">游戏进程</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              placeholder="输入进程名，如 cs2.exe"
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface-card border border-border text-white placeholder-slate-600 focus:outline-none focus:border-brand-600"
              disabled={running}
            />
            {games.length > 0 && (
              <select
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
                disabled={running}
                className="px-3 py-2 text-sm rounded-lg bg-surface-card border border-border text-white focus:outline-none"
              >
                <option value="">选择运行中的游戏</option>
                {games.map((g) => (
                  <option key={g.pid} value={g.process_name}>
                    {g.game_name || g.process_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {running ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Square size={16} />
            停止
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition-colors"
          >
            <Play size={16} />
            开始监测
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* 实时数据概览 */}
      {latest && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="当前 FPS"
            value={latest.fps.toFixed(1)}
            color={fpsColor(latest.fps)}
            icon={<Activity size={16} />}
          />
          <StatCard
            label="1% Low"
            value={latest.fps_1_low.toFixed(1)}
            color={fpsColor(latest.fps_1_low)}
            icon={<Zap size={16} />}
          />
          <StatCard
            label="帧时间"
            value={`${latest.frametime_ms.toFixed(1)} ms`}
            color="text-blue-400"
            icon={<Clock size={16} />}
          />
          <StatCard
            label="监测时长"
            value={formatDuration(latest.elapsed_secs)}
            color="text-slate-300"
            icon={<Clock size={16} />}
          />
        </div>
      )}

      {/* FPS 图表 */}
      <div className="rounded-xl bg-surface-card border border-border p-4">
        <div className="text-xs text-slate-500 mb-3">
          FPS 实时曲线 {running && <span className="text-green-400">● 记录中</span>}
        </div>
        <div className="h-64">
          {snapshots.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="elapsed_secs"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickFormatter={(v) => `${Math.round(v)}s`}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a2233",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(v) => `${Number(v).toFixed(0)}s`}
                />
                <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="5 5" label={{ value: "60 FPS", fill: "#22c55e", fontSize: 10 }} />
                <ReferenceLine y={30} stroke="#eab308" strokeDasharray="5 5" label={{ value: "30 FPS", fill: "#eab308", fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="fps"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="FPS"
                />
                <Line
                  type="monotone"
                  dataKey="fps_1_low"
                  stroke="#f97316"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                  name="1% Low"
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              {running ? "等待数据..." : "开始监测后显示 FPS 曲线"}
            </div>
          )}
        </div>
      </div>

      {/* Session 总结 */}
      {session && (
        <div className="rounded-xl bg-surface-card border border-green-500/30 p-5">
          <div className="text-sm font-semibold text-green-400 mb-3">
            ✅ 监测完成 — {session.process_name}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            <MiniStat label="平均 FPS" value={session.avg_fps.toFixed(1)} />
            <MiniStat label="1% Low" value={session.fps_1_low.toFixed(1)} />
            <MiniStat label="0.1% Low" value={session.fps_01_low.toFixed(1)} />
            <MiniStat label="最高" value={session.max_fps.toFixed(0)} />
            <MiniStat label="最低" value={session.min_fps.toFixed(0)} />
            <MiniStat label="总帧数" value={session.total_frames.toLocaleString()} />
          </div>
          <div className="mt-3 text-xs text-slate-500">
            监测时长: {formatDuration(session.duration_secs)}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, color, icon,
}: {
  label: string; value: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl bg-surface-card border border-border">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}
