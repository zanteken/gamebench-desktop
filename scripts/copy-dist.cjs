const fs = require('fs');
const path = require('path');

// 读取 tauri.conf.json 获取版本号
const tauriConfPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
const version = tauriConf.version;

// 源文件路径（NSIS 安装包）
const sourceDir = path.join(__dirname, '../src-tauri/target/release/bundle/nsis');
const sourceFile = path.join(sourceDir, `GameBench CN_${version}_x64-setup.exe`);

// 目标路径（项目根目录）
const targetDir = path.join(__dirname, '../..');
const targetFile = path.join(targetDir, `GameBench-CN-v${version}-setup.exe`);

// 复制文件
if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`✅ 安装包已复制到根目录: GameBench-CN-v${version}-setup.exe`);
} else {
  console.error(`❌ 源文件不存在: ${sourceFile}`);
  process.exit(1);
}
