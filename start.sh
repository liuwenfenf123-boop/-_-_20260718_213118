#!/bin/bash
# 星轨启动器 — 一键启动脚本
# 自动检测并修复 Electron 二进制缺失问题

PROJECT_DIR="/Users/lwf/Projects/星轨启动器"
ELECTRON_DIR="$PROJECT_DIR/node_modules/electron"
ELECTRON_FRAMEWORK="$ELECTRON_DIR/dist/Electron.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework"
PATH_TXT="$ELECTRON_DIR/path.txt"

# 清除可能导致问题的环境变量
unset ELECTRON_RUN_AS_NODE

# 1. 检查 Electron 是否完整（Framework 文件应大于 100MB）
NEED_FIX=false
if [ ! -f "$ELECTRON_FRAMEWORK" ]; then
  NEED_FIX=true
elif [ $(stat -f%z "$ELECTRON_FRAMEWORK" 2>/dev/null || echo 0) -lt 100000000 ]; then
  NEED_FIX=true
fi

if [ "$NEED_FIX" = true ]; then
  echo "⚠️  Electron 二进制不完整，正在修复..."
  cd "$PROJECT_DIR"
  rm -rf "$ELECTRON_DIR/dist" "$PATH_TXT"

  # 用国内镜像下载并解压
  ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ force_no_cache=true node "$ELECTRON_DIR/install.js" 2>&1

  # 如果 install.js 没成功（path.txt 不存在），手动解压缓存
  if [ ! -f "$PATH_TXT" ]; then
    CACHE_DIR=$(find ~/Library/Caches/electron/ -name "electron-v*.zip" 2>/dev/null | head -1)
    if [ -n "$CACHE_DIR" ]; then
      mkdir -p "$ELECTRON_DIR/dist"
      unzip -o "$CACHE_DIR" -d "$ELECTRON_DIR/dist/" > /dev/null 2>&1
      printf "Electron.app/Contents/MacOS/Electron" > "$PATH_TXT"
      echo "✅ 手动解压完成"
    else
      echo "❌ 下载失败，请检查网络"
      exit 1
    fi
  fi
  echo "✅ Electron 已修复"
fi

# 2. 检查 path.txt
if [ ! -f "$PATH_TXT" ]; then
  printf "Electron.app/Contents/MacOS/Electron" > "$PATH_TXT"
fi

# 3. 启动应用
echo "🚀 启动星轨启动器..."
cd "$PROJECT_DIR"
npx electron-vite dev
