#!/bin/bash
# 强制清除 ELECTRON_RUN_AS_NODE 并启动
unset ELECTRON_RUN_AS_NODE
export ELECTRON_RUN_AS_NODE=""
cd /Users/lwf/Projects/星轨启动器
exec npx electron-vite dev
