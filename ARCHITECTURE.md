# GameBench CN 桌面端 — 技术架构

## 总体架构

```
gamebench-desktop/
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   ├── hardware.rs     # 硬件检测模块
│   │   ├── fps_monitor.rs  # PresentMon 集成
│   │   ├── game_detect.rs  # 运行中游戏检测
│   │   ├── uploader.rs     # 数据上传
│   │   └── tray.rs         # 系统托盘
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── bin/
│       └── PresentMon.exe  # 打包进安装包（MIT协议）
├── src/                    # React 前端
│   ├── App.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx   # 主面板：硬件信息 + 匹配结果
│   │   ├── FpsMonitor.tsx  # FPS 实时监控
│   │   ├── GameList.tsx    # 兼容游戏列表
│   │   └── Settings.tsx    # 设置页
│   ├── components/
│   │   ├── HardwareCard.tsx
│   │   ├── FpsChart.tsx
│   │   ├── GameCard.tsx
│   │   └── ScoreGauge.tsx
│   └── lib/
│       ├── tauri-api.ts    # 调用 Rust 后端的 bridge
│       └── types.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

## 数据流

```
┌──────────────────────────────────────────────────────────┐
│                    桌面端 (Tauri)                          │
│                                                          │
│  ┌─────────────┐    Tauri IPC     ┌──────────────────┐  │
│  │  React 前端   │ ◄────────────► │   Rust 后端       │  │
│  │              │    invoke/       │                  │  │
│  │  Dashboard   │    event         │  hardware.rs     │  │
│  │  FPS 图表    │                  │  ├ detect_cpu()  │  │
│  │  游戏列表    │                  │  ├ detect_gpu()  │  │
│  │              │                  │  └ detect_ram()  │  │
│  │              │                  │                  │  │
│  │              │                  │  fps_monitor.rs  │  │
│  │              │                  │  ├ start()       │  │
│  │              │                  │  ├ stop()        │  │
│  │              │                  │  └ → events      │  │
│  │              │                  │                  │  │
│  │              │                  │  game_detect.rs  │  │
│  │              │                  │  └ scan_running()│  │
│  └──────────────┘                  └────────┬─────────┘  │
│                                             │            │
└─────────────────────────────────────────────┼────────────┘
                                              │ HTTP POST
                                    ┌─────────▼──────────┐
                                    │  后端 API (FastAPI)  │
                                    │  /api/fps/upload    │
                                    │  /api/fps/predict   │
                                    └────────────────────┘
```

## 模块详细设计

### 1. 硬件检测 (hardware.rs)
- **CPU**: 通过 `sysinfo` crate 获取型号名、核心数、频率
- **GPU**: 通过 WMI (Win32_VideoController) 获取型号名、显存、驱动版本
- **RAM**: 通过 `sysinfo` 获取总量、频率
- **匹配**: 用模糊搜索将检测到的型号名匹配到 cpus.json/gpus.json 中的标准名

### 2. FPS 监测 (fps_monitor.rs)
- 启动 PresentMon CLI 子进程
- 解析实时输出的 CSV 数据（每帧的 present 时间戳）
- 计算滑动窗口 FPS（1秒平均、0.1% low、1% low）
- 通过 Tauri event 推送到前端实时渲染

### 3. 游戏检测 (game_detect.rs)
- 扫描运行中进程，匹配已知游戏列表（appId → 进程名映射）
- 检测到游戏启动时自动开始 FPS 监测
- 检测到游戏退出时生成 session 报告

### 4. 数据上传 (uploader.rs)
- 本地存储每次游戏 session 的 FPS 数据
- 汇总后上传：硬件配置 + 游戏 + 平均FPS + 1%low + 画质设置
- 匿名化处理（不上传个人信息）

## PresentMon 集成方案

PresentMon (https://github.com/GameTechDev/PresentMon)
- 许可: MIT
- 原理: 通过 Windows ETW (Event Tracing for Windows) 捕获 DXGI present 调用
- 需要: 管理员权限
- 输出: CSV 格式的每帧时间数据

使用 CLI 模式:
```
PresentMon.exe --output_stdout --stop_existing_session
               --terminate_on_proc_exit --process_name game.exe
```

输出格式:
```csv
Application,ProcessID,SwapChainAddress,Runtime,SyncInterval,PresentFlags,
AllowsTearing,PresentMode,CPUStartTime,CPUStartQPC,FrameTime,CPUBusy,CPUWait,
GPULatency,GPUTime,GPUBusy,GPUWait,VideoBusy,DisplayLatency,DisplayedTime,...
```

我们主要用: Application, FrameTime, CPUBusy, GPUBusy, GPUTime

## 技术栈版本

- Tauri: 2.x (稳定版)
- Rust: 1.75+
- React: 18.x
- Vite: 5.x
- TypeScript: 5.x
- PresentMon: 2.x (MIT)
