import React, { useEffect, useRef, useCallback } from 'react';

/**
 * 🌌 JellyCaret — 果冻弹性追踪光标
 *
 * 核心机制：
 *   1. 隐藏浏览器原生 caret（通过 CSS caret-color: transparent）
 *   2. 用 SVG 绘制一条竖直线代替光标
 *   3. 当光标位置变化时，竖直线在移动过程中变形为 S 曲线（贝塞尔弯曲），
 *      到达目标位置后弹性回弹还原为直线 — 模拟果冻甩尾的物理手感
 *
 * 动画路径描述：
 *   静止态：一条 2px 宽的竖直线 "|"
 *   移动态：上半截先动、下半截拖延 → 形成 ")" 或 "(" 形弯曲
 *   到达后：弹性过冲回弹 → 微微反向弯 → 回归直线 "|"
 */
export default function JellyCaret({ editorReady }) {
    const svgRef = useRef(null);
    const rafRef = useRef(null);

    // 当前实际渲染位置（逐帧追踪用）
    const posRef = useRef({ x: 0, y: 0, h: 0 });
    // 目标位置（Selection 变化时即时更新）
    const targetRef = useRef({ x: 0, y: 0, h: 0 });
    // 弯曲度（曲线偏移量，正值 = 向右弯，负值 = 向左弯）
    const bendRef = useRef(0);
    // 速度追踪（用于判断移动方向和弯曲强度）
    const velRef = useRef({ x: 0, y: 0 });
    // 可见性
    const visibleRef = useRef(false);
    // 闪烁相位
    const blinkRef = useRef({ on: true, timer: 0, lastMove: 0 });

    /**
     * 从浏览器 Selection API 获取光标的精确像素坐标
     */
    const getCaretRect = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;

        const range = sel.getRangeAt(0);

        // 先尝试用 range.getClientRects() 获取精确位置
        const rects = range.getClientRects();
        if (rects.length > 0) {
            const r = rects[0];
            return { x: r.left, y: r.top, h: r.height };
        }

        // 回退：在光标位置插入一个零宽字符测量，然后删除
        // 这是处理空行/空段落的兜底方案
        const span = document.createElement('span');
        span.textContent = '\u200B'; // 零宽空格
        range.insertNode(span);
        const rect = span.getBoundingClientRect();
        const result = { x: rect.left, y: rect.top, h: rect.height };
        span.parentNode.removeChild(span);

        // 恢复 selection（插入 span 会打乱 range）
        sel.removeAllRanges();
        sel.addRange(range);

        return result;
    }, []);

    /**
     * 核心动画循环 — 每帧用 spring 弹簧物理驱动位置追踪和曲线弯曲
     */
    const animate = useCallback(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const pos = posRef.current;
        const target = targetRef.current;
        const vel = velRef.current;
        const blink = blinkRef.current;

        // ---- 弹簧物理参数（含蓄微弯，快速归位） ----
        const stiffness = 0.45;   // 刚度：高值 → 快速追上目标，减少拖拽感
        const damping = 0.65;     // 阻尼：较低值 → 极少过冲回弹
        const bendDecay = 0.75;   // 弯曲恢复速度：低值 → 弯曲迅速消退

        // ---- 位置追踪（弹簧插值） ----
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dh = target.h - pos.h;

        vel.x = (vel.x + dx * stiffness) * damping;
        vel.y = (vel.y + dy * stiffness) * damping;

        pos.x += vel.x;
        pos.y += vel.y;
        pos.h += dh * 0.5; // 高度变化用简单线性插值

        // ---- 弯曲度计算（极微弯曲） ----
        const newBend = vel.x * 0.6;
        bendRef.current = bendRef.current * bendDecay + newBend * (1 - bendDecay);

        // 最大弯曲度 2px — 几乎只是轻微晃动
        const maxBend = 2;
        const bend = Math.max(-maxBend, Math.min(maxBend, bendRef.current));

        // ---- 闪烁逻辑 ----
        const now = performance.now();
        if (Math.abs(vel.x) > 0.3 || Math.abs(vel.y) > 0.3) {
            // 正在移动 → 常亮
            blink.on = true;
            blink.lastMove = now;
            blink.timer = now;
        } else if (now - blink.lastMove > 530) {
            // 静止超过 530ms → 开始标准闪烁（530ms 亮 / 530ms 灭 — 模拟 macOS 光标节奏）
            if (now - blink.timer > 530) {
                blink.on = !blink.on;
                blink.timer = now;
            }
        }

        // ---- SVG 路径构建 ----
        // 起点和终点都锚定在直线位置（x=0），只有中段有微微弯曲
        const h = Math.max(pos.h, 2);
        const midBend = bend;  // 中段弯曲（很小的值，最大 4px）

        // 三次贝塞尔曲线：起点(0,0) → 终点(0,h)，中间控制点有横向偏移
        // 起点终点 x 都是 0 → 静止时就是一条直线
        const path = `M 0,0 C ${midBend},${h * 0.33} ${midBend},${h * 0.66} 0,${h}`;

        // ---- 应用到 DOM ----
        const pathEl = svg.querySelector('.jc-path');
        const glowEl = svg.querySelector('.jc-glow');
        if (pathEl) pathEl.setAttribute('d', path);
        if (glowEl) glowEl.setAttribute('d', path);

        svg.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        svg.style.opacity = visibleRef.current && blink.on ? '1' : '0';
        svg.style.height = `${h}px`;

        // ---- 判断是否还需要继续动画 ----
        const isSettled = Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 &&
            Math.abs(vel.x) < 0.05 && Math.abs(vel.y) < 0.05 &&
            Math.abs(bend) < 0.1;

        // 即使位置稳定，闪烁仍需要持续运行
        rafRef.current = requestAnimationFrame(animate);
    }, []);

    /**
     * 监听 Selection 变化，更新目标位置
     */
    useEffect(() => {
        if (!editorReady) return;

        const updateTarget = () => {
            // 确保光标在编辑器内部
            const sel = window.getSelection();
            if (!sel || !sel.isCollapsed || sel.rangeCount === 0) {
                visibleRef.current = false;
                return;
            }

            const editorEl = document.querySelector('.vditor-ir .vditor-reset');
            if (!editorEl) {
                visibleRef.current = false;
                return;
            }

            // 检查光标是否在编辑器区域内
            const anchorNode = sel.anchorNode;
            if (!editorEl.contains(anchorNode)) {
                visibleRef.current = false;
                return;
            }

            const rect = getCaretRect();
            if (!rect || rect.h === 0) return;

            visibleRef.current = true;
            const prev = targetRef.current;

            // 只有位置真正变化时才更新（避免不必要的弹簧触发）
            if (Math.abs(prev.x - rect.x) > 0.5 || Math.abs(prev.y - rect.y) > 0.5 || Math.abs(prev.h - rect.h) > 1) {
                targetRef.current = { x: rect.x, y: rect.y, h: rect.h };

                // 首次挂载时直接跳到目标位置（不需要从 0,0 飞过来）
                if (posRef.current.h === 0) {
                    posRef.current = { ...targetRef.current };
                }
            }
        };

        // 监听多种事件来捕获光标位置变化
        document.addEventListener('selectionchange', updateTarget);

        // keyup 补充捕获键盘移动光标（selectionchange 在某些浏览器中对键盘事件有延迟）
        const editorEl = document.querySelector('.vditor-ir .vditor-reset');
        const handleKeyUp = () => setTimeout(updateTarget, 10);
        const handleMouseUp = () => setTimeout(updateTarget, 10);
        const handleFocus = () => {
            visibleRef.current = true;
            updateTarget();
        };
        const handleBlur = () => {
            visibleRef.current = false;
        };

        if (editorEl) {
            editorEl.addEventListener('keyup', handleKeyUp);
            editorEl.addEventListener('mouseup', handleMouseUp);
            editorEl.addEventListener('focus', handleFocus, true);
            editorEl.addEventListener('blur', handleBlur, true);
        }

        // 启动动画循环
        updateTarget();
        rafRef.current = requestAnimationFrame(animate);

        return () => {
            document.removeEventListener('selectionchange', updateTarget);
            if (editorEl) {
                editorEl.removeEventListener('keyup', handleKeyUp);
                editorEl.removeEventListener('mouseup', handleMouseUp);
                editorEl.removeEventListener('focus', handleFocus, true);
                editorEl.removeEventListener('blur', handleBlur, true);
            }
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [editorReady, animate, getCaretRect]);

    /**
     * 页面滚动时实时更新目标位置（光标的视口坐标会变）
     */
    useEffect(() => {
        if (!editorReady) return;

        const handleScroll = () => {
            const rect = getCaretRect();
            if (rect && rect.h > 0 && visibleRef.current) {
                targetRef.current = { x: rect.x, y: rect.y, h: rect.h };
                // 滚动时直接跳（不用弹簧追踪，避免跟手延迟感）
                posRef.current = { ...targetRef.current };
                bendRef.current = 0;
            }
        };

        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [editorReady, getCaretRect]);

    return (
        <svg
            ref={svgRef}
            className="jelly-caret-svg"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 99999,
                overflow: 'visible',
                width: '30px',        // 留够曲线弯曲的横向空间
                marginLeft: '-15px',  // 居中对齐到光标位置
                opacity: 0,
            }}
            viewBox="-15 0 30 20"
            preserveAspectRatio="none"
        >
            {/* 辉光层：给曲线加一层模糊发光，增加高级感 */}
            <path
                className="jc-glow"
                d="M 0,0 C 0,7 0,14 0,20"
                stroke="#1D1D1F"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                opacity="0.15"
                filter="blur(2px)"
            />
            {/* 主体线：实际的光标线条 */}
            <path
                className="jc-path"
                d="M 0,0 C 0,7 0,14 0,20"
                stroke="#1D1D1F"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    );
}
