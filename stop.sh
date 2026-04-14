#!/usr/bin/env bash
# 面经网站一键优雅停止脚本

echo "=== 正在关闭面经项目 ==="

# 终结后端
if [ -f logs/backend.pid ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    # 验证 PID 是否还在运行
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        pkill -P $BACKEND_PID 2>/dev/null
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

# 终极扫尾：强杀 3001 和 3000 避免任何游离的孤儿进程占用端口
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# 睡眠两秒，给操作系统底层网络栈充分的时间释放处于 TIME_WAIT/CLOSE_WAIT 状态的端口
echo "休眠缓冲，等待系统回收网络端口..."
sleep 2

echo "=== 项目现已完全处于清净态 ==="
