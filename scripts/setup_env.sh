#!/usr/bin/env bash
# 面经项目全栈依赖安装与前端预编译脚本 (Cross-Platform)

echo "=== 开始安装 PrepMaster 面经系统的全栈依赖 ==="
echo "注意：此脚本假定您的系统环境中已经原生配置好了 pip(Python) 与 npm(Node.js)"

# ===== 安装后端依赖 =====
echo ">>> [1/2] 正在安装后端 (FastAPI) 标准库依附..."
cd backend || exit 1
pip install -r requirements.txt
echo "✅ 后端依赖校验与安装完成。"
cd ..

# ===== 安装并编译前端 =====
echo ">>> [2/2] 正在拉取前端 (Vite+React) npm 包容并执行生产级编译..."
cd frontend || exit 1
npm install
npm run build
echo "✅ 前端依赖拉取与校验构建完成。"
cd ..

echo "=== 🎊 全栈环境初始化完毕 🎊 ==="
echo "您可以随时执行当前目录树顶部的 ./start.sh 来进行本地投产模拟！"
