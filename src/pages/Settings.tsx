import { useState } from "react";
import { ExternalLink, FolderOpen } from "lucide-react";

export default function Settings() {
  const [autoDetect, setAutoDetect] = useState(true);
  const [autoUpload, setAutoUpload] = useState(false);
  const [serverUrl, setServerUrl] = useState("https://gamebench-cn.vercel.app");

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-white">设置</h1>

      {/* PresentMon 配置 */}
      <Section title="PresentMon 配置">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">PresentMon 路径</div>
            <div className="flex gap-2">
              <input
                type="text"
                value="src-tauri/bin/PresentMon.exe"
                readOnly
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface border border-border text-slate-400"
              />
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-surface-card border border-border text-slate-400 hover:text-white">
                <FolderOpen size={14} />
                选择
              </button>
            </div>
            <div className="text-[10px] text-slate-600 mt-1">
              从{" "}
              <a
                href="https://github.com/GameTechDev/PresentMon/releases"
                target="_blank"
                className="text-brand-400 hover:underline inline-flex items-center gap-0.5"
              >
                GitHub Releases <ExternalLink size={10} />
              </a>{" "}
              下载 PresentMon Console Application
            </div>
          </div>

          <Toggle
            label="自动检测游戏"
            description="启动游戏时自动弹出 FPS 监测提示"
            checked={autoDetect}
            onChange={setAutoDetect}
          />
        </div>
      </Section>

      {/* 数据上传 */}
      <Section title="数据上传">
        <div className="space-y-3">
          <Toggle
            label="自动上传 FPS 数据"
            description="匿名上传性能数据，帮助其他用户参考（不包含个人信息）"
            checked={autoUpload}
            onChange={setAutoUpload}
          />

          <div>
            <div className="text-xs text-slate-500 mb-1">服务器地址</div>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-white focus:outline-none focus:border-brand-600"
            />
          </div>
        </div>
      </Section>

      {/* 关于 */}
      <Section title="关于">
        <div className="space-y-2 text-sm text-slate-400">
          <div>GameBench CN v0.1.0</div>
          <div>FPS 检测引擎: Intel PresentMon (MIT License)</div>
          <div>
            <a
              href="https://gamebench-cn.vercel.app"
              target="_blank"
              className="text-brand-400 hover:underline inline-flex items-center gap-1"
            >
              访问网站 <ExternalLink size={12} />
            </a>
          </div>
          <div>
            <a
              href="https://github.com/zanteken/gamebench-cn"
              target="_blank"
              className="text-brand-400 hover:underline inline-flex items-center gap-1"
            >
              GitHub 仓库 <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-card border border-border p-5">
      <h2 className="text-sm font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({
  label, description, checked, onChange,
}: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-slate-700"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
