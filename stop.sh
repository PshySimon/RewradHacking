#!/usr/bin/env bash
# 面经网站一键优雅停止脚本

echo "=== 正在关闭面经项目 ==="

# 终结后端
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    # 验证 PID 是否还在运行
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo "✅ 后端服务模块 (PID: $BACKEND_PID) 已收归下线。"
    else
        echo "⚠️ 后端服务模块不在运行阶段（可能已被手动终结）。"
    fi
    rm logs/backend.pid
else
    echo "未找到后端守护凭据 (backend.pid)。"
fi

# 终结前端
if [ -f logs/frontend.pid ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
        echo "✅ 前端开发控制面板 (PID: $FRONTEND_PID) 拦截切断完成。"
        
        # 特别处理 vite(npm run dev): shell PID 杀了未必连坐杀掉 node 内部子进程节点
        # 使用 pkill 进行关联清理扫尾，避免端口强占
        pkill -P $FRONTEND_PID 2>/dev/null
    else
        echo "⚠️ 前端开发面板不在运行阶段。"
    fi
    rm logs/frontend.pid
else
    echo "未找到前端守护凭据 (frontend.pid)。"
fi

echo "=== 项目现已完全处于清净态 ==="
