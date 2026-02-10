import { useState, useEffect, useRef } from "react";
import { FileText, Trash2, Download, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 解析 Rust 日志文件
  const loadLogs = async () => {
    try {
      // 尝试读取日志文件
      const logContent = await invoke<string>("read_logs");
      const lines = logContent.split("\n").filter((line) => line.trim());

      const parsed: LogEntry[] = lines
        .map((line) => {
          // 解析日志格式: [2024-02-10T12:34:56Z INFO gamebench_desktop] Message
          const match = line.match(/\[([^\]]+)\s+(\w+)\s+([^\]]+)\]\s+(.+)/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2],
              message: match[4],
            };
          }
          // 备用格式
          return {
            timestamp: new Date().toISOString(),
            level: "INFO",
            message: line,
          };
        })
        .filter((log) => log.message);

      setLogs(parsed);
    } catch (e) {
      setLogs([
        {
          timestamp: new Date().toISOString(),
          level: "WARN",
          message: `无法读取日志: ${e}`,
        },
      ]);
    }
  };

  useEffect(() => {
    loadLogs();
    // 每 5 秒刷新一次
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const clearLogs = async () => {
    try {
      await invoke("clear_logs");
      setLogs([]);
    } catch (e) {
      console.error("清空日志失败:", e);
    }
  };

  const exportLogs = () => {
    const text = logs
      .map((log) => `[${log.timestamp} ${log.level}] ${log.message}`)
      .join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gamebench-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "ERROR":
        return "text-red-400";
      case "WARN":
        return "text-yellow-400";
      case "INFO":
        return "text-blue-400";
      case "DEBUG":
        return "text-slate-400";
      default:
        return "text-slate-300";
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-brand-400" />
          <h1 className="text-xl font-bold text-white">运行日志</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              autoScroll
                ? "bg-brand-600/20 border-brand-600/50 text-brand-400"
                : "bg-surface-card border-border text-slate-400 hover:text-white"
            }`}
          >
            {autoScroll ? "自动滚动: 开" : "自动滚动: 关"}
          </button>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-surface-card border border-border text-slate-400 hover:text-white hover:border-brand-600/50 transition-colors"
          >
            <RefreshCw size={14} />
            刷新
          </button>
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-surface-card border border-border text-slate-400 hover:text-white hover:border-brand-600/50 transition-colors"
          >
            <Download size={14} />
            导出
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={14} />
            清空
          </button>
        </div>
      </div>

      {/* 日志内容区 */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto rounded-xl bg-surface-card border border-border p-4 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            暂无日志
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="text-slate-600 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString("zh-CN", {
                    hour12: false,
                  })}
                </span>
                <span className={`shrink-0 w-12 ${getLevelColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span>共 {logs.length} 条日志</span>
        <span className="text-red-400">
          错误: {logs.filter((l) => l.level === "ERROR").length}
        </span>
        <span className="text-yellow-400">
          警告: {logs.filter((l) => l.level === "WARN").length}
        </span>
      </div>
    </div>
  );
}
