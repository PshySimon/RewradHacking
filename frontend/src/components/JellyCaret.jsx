import React, { useEffect, useRef, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { getCollapsedCaretFallbackRect, getNativeCollapsedCaretRect } from '../utils/caretFallback';

const toVisibleText = (value = '', limit = 80) => {
    const normalized = String(value).replace(/\n/g, '\\n');
    return normalized.length > limit ? `${normalized.slice(0, limit)}...[truncated]` : normalized;
};

const describeNode = (node) => {
    if (!node) {
        return null;
    }

    if (node.nodeType === 3) {
        return {
            nodeType: 3,
            text: toVisibleText(node.textContent || ''),
            parentTag: node.parentNode?.tagName || '',
        };
    }

    return {
        nodeType: node.nodeType,
        tagName: node.tagName || '',
        text: toVisibleText(node.textContent || ''),
        childCount: node.childNodes?.length || 0,
    };
};

const rectToPayload = (rect) => {
    if (!rect) {
        return null;
    }

    return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
    };
};

const debugJellyCaret = (stage, payload = {}) => {
    if (typeof console === 'undefined' || typeof console.debug !== 'function') {
        return;
    }

    console.debug(`[JellyCaretDebug] ${stage}`, payload);
    try {
        console.debug(`[JellyCaretDebugJSON] ${stage} ${JSON.stringify(payload)}`);
    } catch (error) {
        console.debug(`[JellyCaretDebugJSON] ${stage} <unserializable>`, error);
    }
};

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
        const rects = range.getClientRects();
        let r = null;
        let fallbackSource = 'native-empty';

        if (rects.length > 0) {
            r = getNativeCollapsedCaretRect(rects, sel);
            if (r) {
                fallbackSource = 'native';
            }
        } 
        
        if (!r) {
            const textFallbackRect = getCollapsedCaretFallbackRect(sel);
            if (textFallbackRect) {
                r = textFallbackRect;
                fallbackSource = 'text-probe';
            }
        }

        if (!r) {
            // 触发彻底抛弃 DOM 突变的完美盲估法：由于空行或特殊块首尾
            let node = sel.anchorNode;
            
            // 探索选区具体的子元素（例如空行中的 <br>）以获得真确物理探针
            if (node.nodeType === 1 && node.childNodes.length > 0) {
                const child = node.childNodes[Math.min(sel.anchorOffset, node.childNodes.length - 1)];
                if (child && child.nodeType === 1 && child.getBoundingClientRect) {
                    node = child;
                }
            }
            if (node.nodeType === 3) node = node.parentNode; // 回退到元素

            if (node && node.getBoundingClientRect) {
                const nodeRect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                // 精确补偿 padding 偏移（拯救空壳子与具有内边距的块容器）
                const pl = parseFloat(style.paddingLeft) || 0;
                const pt = parseFloat(style.paddingTop) || 0;
                r = {
                    left: nodeRect.left + pl,
                    top: nodeRect.top + pt,
                    height: 22 // 标准基础高度预估，杜绝巨大容器干扰
                };
                fallbackSource = 'node-box';
            }
        }

        if (!r) return null;

        let x = r.left;
        let y = r.top;
        let h = Math.min(r.height > 0 ? r.height : 22, 50);

        // 核心跃迁：将坐标从不稳定的 viewport (视口) 强制映射为 .vditor-ir 的内部容器绝对坐标！
        const container = document.querySelector('.vditor-ir');
        if (container) {
            const cRect = container.getBoundingClientRect();
            // 减去容器视口偏移，加上容器内部滚动量，得到与滚动状态无关的内部原生坐标！
            x = x - cRect.left + container.scrollLeft;
            y = y - cRect.top + container.scrollTop;
        }

        debugJellyCaret('measure', {
            anchorOffset: sel.anchorOffset,
            anchorNode: describeNode(sel.anchorNode),
            nativeRects: Array.from(rects).slice(0, 4).map(rectToPayload),
            fallbackSource,
            chosenRect: rectToPayload(r),
            containerRect: container ? rectToPayload(container.getBoundingClientRect()) : null,
            mapped: { x, y, h },
        });

        return { x, y, h };
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

        // ---- 极简平滑阻尼模型 (Lerp) —— 严格杜绝坐标“越界回弹” ----
        // 传统的经典弹簧物理在面对跨越多行或大范围跳转时，会导致由于末端动能过大，光标飞出目标边界然后再弹回来（观感非常夸张和头晕）。
        // 现在的策略：【坐标定位】仅采用指数平滑衰减，绝对不越过原生起始点；【果冻形变】则利用虚拟动能产生延迟回正的 Q 弹感！
        const lerpFactor = 0.55; // 追踪系数，越高越跟手，绝不过冲
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dh = target.h - pos.h;

        // 真实坐标系：永远只朝着目标单向逼近
        const stepX = dx * lerpFactor;
        const stepY = dy * lerpFactor;
        
        pos.x += stepX;
        pos.y += stepY;
        pos.h += dh * 0.5;

        // ---- 虚拟弹性引擎：专注提振“果冻甩尾”特效（真实的弹簧物理） ----
        // 既然坐标系已经被严格限死不会越界，我们把全部的弹簧特效功力都倾注在这条由 SVG 绘制的 Bezier 线上！
        // 这种“骨骼极稳、皮肤 Q 弹”的混合双引擎，才是真正舒适的极致动画手感。
        
        // 1. 根据当前距离产生拉扯力：光标往右移(dx>0)时，应该受到向左的拉力(负值)，形成“头部先走、尾部拖延”的变形
        const pullForce = -dx * 0.08; 
        
        // 2. 形状记忆恢复力：弯曲得越厉害，试图猛烈弹回直线的力量就越大
        const restoreForce = -bendRef.current * 0.4;
        
        // 合力驱动虚拟形变速度槽 (Damping 0.65：稍低的阻尼允许它回正时短暂地过冲反向弯曲，形成真实的晃动感)
        vel.x = (vel.x + pullForce + restoreForce) * 0.65;
        
        bendRef.current += vel.x;

        // 适度放宽最大弯曲幅度上限，让高速跨屏拖动时光标能拉成一张完美的弓（最大 6 个像素）
        const maxBend = 6;
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
        // SVG 内部坐标系固定为 20 高，避免 path 坐标和外层 height 同时按 h 缩放导致视觉高度翻倍。
        const h = Math.max(pos.h, 2);
        const renderHeight = 20;
        const midBend = bend;  // 中段弯曲（很小的值，最大 4px）

        // 三次贝塞尔曲线：起点(0,0) → 终点(0,h)，中间控制点有横向偏移
        // 起点终点 x 都是 0 → 静止时就是一条直线
        const path = `M 0,0 C ${midBend},${renderHeight * 0.33} ${midBend},${renderHeight * 0.66} 0,${renderHeight}`;

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

    // ==== 移除人工 handleScroll 事件监听！ ====
    // 因为坐标系已经变为 .vditor-ir 容器内部的物理绝对坐标，不论编辑器怎么滚动，
    // DOM 的内部原生排版引力会自动带着 SVG 完美移动，一劳永逸消灭滚动同步滞后。

    const container = document.querySelector('.vditor-ir');
    
    // 如果还没找到目标内部容器，或者还没准备好，则先隐身候命
    if (!editorReady || !container) return null;

    return ReactDOM.createPortal(
        <svg
            ref={svgRef}
            className="jelly-caret-svg"
            style={{
                position: 'absolute',    // 降维为 absolute，跟随父结构
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 99,
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
        </svg>,
        container
    );
}
