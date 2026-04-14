#!/usr/bin/env bash
# 面经网站一键启动脚本 (FastAPI Backend + React Frontend 分离架构)

echo "=== 正在启动面经项目 ==="

mkdir -p logs

# ===== 1. 启动后端服务 =====
echo "[1/2] 正在拉起 FastAPI 后端引擎..."
cd backend || exit 1
nohup uvicorn app.main:app --host 0.0.0.0 --port 3001 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../logs/backend.pid
echo "=> 后端 API 已稳健挂载，PID: $BACKEND_PID (日志记录于 logs/backend.log)"
cd ..

# ===== 2. 启动前端服务 =====
echo "[2/2] 正在拉起 Vite React 前端大门..."
cd frontend || exit 1
nohup npm run dev -- --host 0.0.0.0 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
echo "=> 前端大门 已拉起发力，PID: $FRONTEND_PID (日志记录于 logs/frontend.log)"
cd ..

echo " "
echo "=== 部署点火完成！ ==="
echo "👉 后端核心将守候监听: http://127.0.0.1:3001/"
echo "🚀 随时通过浏览器访问前台体验: http://127.0.0.1:3000/ "
echo "如需关停随时执行 ./stop.sh 以优雅谢幕。"
