use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use sysinfo::System;
use tauri::{AppHandle, Emitter};

// ==================== 数据结构 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    /// 进程名 (e.g., "GTA5.exe")
    pub process_name: String,
    /// 进程 ID
    pub pid: u32,
    /// 匹配到的游戏名称（如果在已知列表中）
    pub game_name: Option<String>,
    /// 对应的 Steam AppId（如果匹配到）
    pub app_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct KnownGame {
    name: String,
    app_id: u32,
    process_names: Vec<String>,
}

// ==================== 已知游戏列表 ====================

/// 热门游戏进程名 → 游戏信息的映射
/// 后续可从服务端动态更新
fn build_known_games() -> HashMap<String, (String, u32)> {
    let games = vec![
        // 进程名(小写), 游戏名, Steam AppId
        ("gta5.exe", "Grand Theft Auto V", 271590),
        ("gtav.exe", "Grand Theft Auto V", 271590),
        ("eldenring.exe", "Elden Ring", 1245620),
        ("cyberpunk2077.exe", "Cyberpunk 2077", 1091500),
        ("witcher3.exe", "The Witcher 3", 292030),
        ("rdr2.exe", "Red Dead Redemption 2", 1174180),
        ("cs2.exe", "Counter-Strike 2", 730),
        ("csgo.exe", "Counter-Strike 2", 730),
        ("dota2.exe", "Dota 2", 570),
        ("valorant.exe", "VALORANT", 0),
        ("overwatch.exe", "Overwatch 2", 0),
        ("leagueclient.exe", "League of Legends", 0),
        ("league of legends.exe", "League of Legends", 0),
        ("pubg.exe", "PUBG: Battlegrounds", 578080),
        ("tslgame.exe", "PUBG: Battlegrounds", 578080),
        ("fortnite.exe", "Fortnite", 0),
        ("apex_r5apex.exe", "Apex Legends", 1172470),
        ("r5apex.exe", "Apex Legends", 1172470),
        ("terraria.exe", "Terraria", 105600),
        ("rust.exe", "Rust", 252490),
        ("baldursgate3.exe", "Baldur's Gate 3", 1086940),
        ("bg3.exe", "Baldur's Gate 3", 1086940),
        ("hogwartslegacy.exe", "Hogwarts Legacy", 990080),
        ("sekiro.exe", "Sekiro: Shadows Die Twice", 814380),
        ("darksoulsiii.exe", "Dark Souls III", 374320),
        ("monsterhunterworld.exe", "Monster Hunter: World", 582010),
        ("monsterhunterwilds.exe", "Monster Hunter Wilds", 2246340),
        ("fallout4.exe", "Fallout 4", 377160),
        ("starfield.exe", "Starfield", 1716740),
        ("palworld.exe", "Palworld", 1623730),
        ("lethal company.exe", "Lethal Company", 1966720),
        ("satisfactory.exe", "Satisfactory", 526870),
        ("helldivers2.exe", "Helldivers 2", 553850),
        ("arrowhead_hd2.exe", "Helldivers 2", 553850),
        ("doom eternal.exe", "DOOM Eternal", 782330),
        ("forzahorizon5.exe", "Forza Horizon 5", 1551360),
        ("dyinglight.exe", "Dying Light", 239140),
        ("dyinglight2.exe", "Dying Light 2", 534380),
        ("halo infinite.exe", "Halo Infinite", 1240440),
        ("destiny2.exe", "Destiny 2", 1085660),
        ("bf1.exe", "Battlefield 1", 1238840),
        ("bf2042.exe", "Battlefield 2042", 1517290),
        ("nms.exe", "No Man's Sky", 275850),
        ("b1-wukong-win64-shipping.exe", "Black Myth: Wukong", 2358720),
        ("rimworldwin64.exe", "RimWorld", 294100),
        ("factorio.exe", "Factorio", 427520),
        ("subnautica.exe", "Subnautica", 264710),
        ("totalwarhammer3.exe", "Total War: Warhammer III", 1142710),
        ("civilization vi.exe", "Civilization VI", 289070),
        ("stellaris.exe", "Stellaris", 281990),
        ("cities2.exe", "Cities: Skylines II", 949230),
        ("stardewvalley.exe", "Stardew Valley", 413150),
        ("valheim.exe", "Valheim", 892970),
        ("phasmophobia.exe", "Phasmophobia", 739630),
        ("among us.exe", "Among Us", 945360),
        ("deeprock galactic.exe", "Deep Rock Galactic", 548430),
        ("slay the spire.exe", "Slay the Spire", 646570),
        ("hades.exe", "Hades", 1145360),
        ("deadcells.exe", "Dead Cells", 588650),
        ("hollowknight.exe", "Hollow Knight", 367520),
        ("ori.exe", "Ori and the Blind Forest", 261570),
        ("celeste.exe", "Celeste", 504230),
        ("cuphead.exe", "Cuphead", 268910),
    ];

    let mut map = HashMap::new();
    for (process, name, app_id) in games {
        map.insert(
            process.to_lowercase(),
            (name.to_string(), app_id),
        );
    }
    map
}

// ==================== 进程扫描 ====================

/// 扫描当前运行中的游戏进程
fn scan_processes() -> Vec<DetectedGame> {
    let known = build_known_games();
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut games = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for (pid, process) in sys.processes() {
        let exe_name = process
            .name()
            .to_string_lossy()
            .to_lowercase();

        // 跳过系统进程
        if exe_name.is_empty()
            || exe_name.starts_with("system")
            || exe_name.starts_with("svchost")
            || exe_name.starts_with("csrss")
            || exe_name.starts_with("conhost")
            || exe_name == "explorer.exe"
            || exe_name.starts_with("runtime")
        {
            continue;
        }

        // 检查是否是已知游戏
        if let Some((game_name, app_id)) = known.get(&exe_name) {
            if !seen.contains(&exe_name) {
                seen.insert(exe_name.clone());
                games.push(DetectedGame {
                    process_name: process.name().to_string_lossy().to_string(),
                    pid: pid.as_u32(),
                    game_name: Some(game_name.clone()),
                    app_id: if *app_id > 0 { Some(*app_id) } else { None },
                });
            }
        }

        // 也检查通过 Steam 启动的进程（进程路径包含 steamapps/common）
        if let Some(exe_path) = process.exe() {
            let path_str = exe_path.to_string_lossy().to_lowercase();
            if path_str.contains("steamapps")
                && path_str.contains("common")
                && !seen.contains(&exe_name)
                && !known.contains_key(&exe_name)
            {
                // Steam 游戏但不在已知列表中
                // 从路径提取游戏名: .../steamapps/common/GameName/...
                let game_name = extract_steam_game_name(&path_str);
                seen.insert(exe_name.clone());
                games.push(DetectedGame {
                    process_name: process.name().to_string_lossy().to_string(),
                    pid: pid.as_u32(),
                    game_name,
                    app_id: None,
                });
            }
        }
    }

    games
}

/// 从 Steam 安装路径提取游戏名
fn extract_steam_game_name(path: &str) -> Option<String> {
    // 路径格式: .../steamapps/common/GameName/game.exe
    if let Some(idx) = path.find("steamapps/common/") {
        let after = &path[idx + "steamapps/common/".len()..];
        if let Some(slash_idx) = after.find('/') {
            let name = &after[..slash_idx];
            return Some(name.to_string());
        }
        // Windows 反斜杠
        if let Some(slash_idx) = after.find('\\') {
            let name = &after[..slash_idx];
            return Some(name.to_string());
        }
    }
    None
}

// ==================== 后台扫描器 ====================

/// 后台定期扫描运行中的游戏，检测到新游戏时通知前端
pub fn background_scanner(app: AppHandle) {
    let mut last_detected: Vec<String> = Vec::new();

    loop {
        std::thread::sleep(std::time::Duration::from_secs(5));

        let games = scan_processes();
        let current: Vec<String> = games.iter().map(|g| g.process_name.clone()).collect();

        // 检测新启动的游戏
        for game in &games {
            if !last_detected.contains(&game.process_name) {
                log::info!(
                    "检测到游戏启动: {} ({})",
                    game.game_name.as_deref().unwrap_or("Unknown"),
                    game.process_name
                );
                let _ = app.emit("game-detected", game);
            }
        }

        // 检测退出的游戏
        for old_name in &last_detected {
            if !current.contains(old_name) {
                log::info!("检测到游戏退出: {}", old_name);
                let _ = app.emit("game-exited", old_name.as_str());
            }
        }

        last_detected = current;
    }
}

// ==================== Tauri 命令 ====================

/// 立即扫描运行中的游戏
#[tauri::command]
pub fn scan_running_games() -> Result<Vec<DetectedGame>, String> {
    Ok(scan_processes())
}

/// 获取已知游戏列表（用于前端展示支持的游戏）
#[tauri::command]
pub fn get_known_games() -> Result<Vec<(String, String)>, String> {
    let known = build_known_games();
    let mut games: Vec<(String, String)> = known
        .iter()
        .map(|(process, (name, _))| (name.clone(), process.clone()))
        .collect();
    games.sort_by(|a, b| a.0.cmp(&b.0));
    games.dedup_by(|a, b| a.0 == b.0);
    Ok(games)
}
