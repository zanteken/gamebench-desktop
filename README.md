# GameBench CN 桌面端

PC 游戏性能检测工具 — 硬件检测 + FPS 实时监测 + 数据上传

## 功能

- **硬件检测**: 自动识别 CPU、GPU、RAM 型号和参数
- **FPS 监测**: 集成 PresentMon，实时监测游戏帧率（FPS、1% Low、帧时间）
- **游戏检测**: 自动识别 70+ 款热门游戏进程
- **数据分析**: FPS 实时曲线、Session 总结报告

## 技术栈

- **框架**: Tauri 2.x (Rust + WebView2)
- **前端**: React 18 + TypeScript + Tailwind CSS + Recharts
- **FPS 引擎**: Intel PresentMon (MIT License)
- **安装包**: ~8MB（需要系统已安装 WebView2）

## 环境要求

- **操作系统**: Windows 10/11 (64-bit)
- **Node.js**: 18+
- **Rust**: 1.75+ (`rustup` 安装)
- **管理员权限**: PresentMon 需要 ETW 权限

## 安装步骤

### 1. 安装前置依赖

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js（推荐 nvm-windows）
# https://github.com/coreybutler/nvm-windows

# 安装 Tauri CLI
npm install -g @tauri-apps/cli
```

### 2. 下载 PresentMon

从 [PresentMon Releases](https://github.com/GameTechDev/PresentMon/releases) 下载最新的
`PresentMon-x.x.x-x64.exe`，重命名为 `PresentMon.exe`，放到 `src-tauri/bin/` 目录。

### 3. 安装项目依赖

```bash
npm install
```

### 4. 开发模式运行

```bash
npm run tauri dev
```

> ⚠️ FPS 监测功能需要以管理员身份运行（PresentMon 需要 ETW 权限）

### 5. 构建安装包

```bash
npm run tauri build
```

生成的安装包在 `src-tauri/target/release/bundle/nsis/` 目录。

## 项目结构

```
gamebench-desktop/
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs         # 入口 + Tauri 命令注册
│   │   ├── hardware.rs     # 硬件检测 (sysinfo + WMI)
│   │   ├── fps_monitor.rs  # PresentMon CLI 集成
│   │   └── game_detect.rs  # 游戏进程检测
│   ├── bin/
│   │   └── PresentMon.exe  # (需手动下载)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # React 前端
│   ├── App.tsx             # 主布局 + 导航
│   ├── pages/
│   │   ├── Dashboard.tsx   # 硬件概览 + 运行中游戏
│   │   ├── FpsMonitor.tsx  # FPS 实时监测 + 图表
│   │   └── Settings.tsx    # 配置页
│   └── lib/
│       ├── tauri-api.ts    # Rust 后端调用封装
│       └── types.ts        # TypeScript 类型定义
├── package.json
├── vite.config.ts
└── ARCHITECTURE.md         # 详细架构文档
```

## 通信机制

前端 ↔ Rust 后端通过 Tauri IPC:

| 方向 | 机制 | 用途 |
|------|------|------|
| 前端 → Rust | `invoke()` | 硬件检测、开始/停止监测 |
| Rust → 前端 | `emit()` + `listen()` | FPS 实时数据、游戏检测事件 |

## PresentMon 集成

通过 CLI 子进程模式调用:

```
PresentMon.exe --output_stdout --stop_existing_session
               --terminate_on_proc_exit --process_name game.exe
```

解析 CSV stdout 输出，提取 `FrameTime`/`MsBetweenPresents` 列，
计算滑动窗口 FPS 后通过 Tauri event 推送到前端。

## 下一步

- [ ] FPS 数据本地持久化 (SQLite)
- [ ] 数据上传到后端 API
- [ ] 硬件自动匹配 CPU/GPU 数据库
- [ ] FPS 预测（基于社区数据）
- [ ] 系统托盘常驻 + 热键控制
- [ ] 自动更新 (Tauri updater)
