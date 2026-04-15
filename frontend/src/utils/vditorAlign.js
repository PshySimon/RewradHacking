/**
 * Vditor 段落对齐工具
 *
 * 核心发现：Vditor 的 Custom 类（自定义按钮）不支持 IMenuItem.toolbar 子菜单，
 * 只有内置按钮（如 headings）才有。因此我们必须在 click 回调中手动构建下拉面板，
 * 模仿 Headings 类的实现模式（创建 .vditor-hint.vditor-panel--arrow 面板）。
 *
 * 另一个核心问题：Vditor IR 模式的 Lute 引擎在 input 处理时会主动清除所有 [style] 属性，
 * 并且重渲染会生成全新 DOM 节点。因此用 CSS class + MutationObserver 来持久化对齐状态。
 */

// 段落索引 -> 对齐方向的映射表
const alignmentMap = new Map();

/**
 * 找到当前光标所在的块级段落元素
 */
function findCurrentParagraph() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    let node = sel.anchorNode;
    if (!node) return null;

    if (node.nodeType === 3) node = node.parentElement;
    if (!node) return null;

    const block = node.closest('[data-block]');
    if (!block) return null;
    if (!block.closest('.vditor-reset')) return null;

    return block;
}

/**
 * 获取段落在编辑器容器中的序号索引
 */
function getParagraphIndex(paragraphEl) {
    const container = paragraphEl.closest('.vditor-reset');
    if (!container) return -1;
    const blocks = container.querySelectorAll(':scope > [data-block]');
    return Array.from(blocks).indexOf(paragraphEl);
}

// CSS class 名映射
const ALIGN_CLASS = {
    left: 'vditor-align--left',
    center: 'vditor-align--center',
    right: 'vditor-align--right',
};

function removeAlignClasses(element) {
    Object.values(ALIGN_CLASS).forEach(cls => element.classList.remove(cls));
}

/**
 * 对当前光标所在段落应用对齐
 */
export function applyAlignment(alignment) {
    const paragraph = findCurrentParagraph();
    if (!paragraph) return null;

    const idx = getParagraphIndex(paragraph);
    if (idx < 0) return null;

    const current = alignmentMap.get(idx) || 'left';

    if (current === alignment) {
        // toggle：恢复默认（左对齐）
        alignmentMap.delete(idx);
        removeAlignClasses(paragraph);
        return null;
    } else {
        alignmentMap.set(idx, alignment);
        removeAlignClasses(paragraph);
        paragraph.classList.add(ALIGN_CLASS[alignment]);
        return alignment;
    }
}

/**
 * 重新将 alignmentMap 中记录的对齐 class 应用到 DOM 上
 */
function reapplyAlignments() {
    const container = document.querySelector('.vditor-ir .vditor-reset');
    if (!container) return;

    const blocks = container.querySelectorAll(':scope > [data-block]');
    alignmentMap.forEach((alignment, idx) => {
        if (idx < blocks.length) {
            const block = blocks[idx];
            if (!block.classList.contains(ALIGN_CLASS[alignment])) {
                removeAlignClasses(block);
                block.classList.add(ALIGN_CLASS[alignment]);
            }
        }
    });

    // 清理已不存在的索引
    const maxIdx = blocks.length;
    for (const idx of alignmentMap.keys()) {
        if (idx >= maxIdx) alignmentMap.delete(idx);
    }
}

/**
 * 安装 MutationObserver
 */
export function installAlignmentObserver() {
    const container = document.querySelector('.vditor-ir .vditor-reset');
    if (!container) return () => {};

    let rafId = null;

    const observer = new MutationObserver(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            reapplyAlignments();
            rafId = null;
        });
    });

    observer.observe(container, { childList: true, subtree: true });

    return () => {
        if (rafId) cancelAnimationFrame(rafId);
        observer.disconnect();
    };
}

export function clearAlignments() {
    alignmentMap.clear();
}

// ===================== SVG 图标（fill 风格，与 Vditor 原生一致） =====================

// 主按钮图标：对齐（4条横线，中间两条短且居中）
const ICON_ALIGN = `<svg viewBox="0 0 1024 1024"><path d="M896 128H128c-17.7 0-32 14.3-32 32s14.3 32 32 32h768c17.7 0 32-14.3 32-32s-14.3-32-32-32zM736 416H288c-17.7 0-32 14.3-32 32s14.3 32 32 32h448c17.7 0 32-14.3 32-32s-14.3-32-32-32zM896 704H128c-17.7 0-32 14.3-32 32s14.3 32 32 32h768c17.7 0 32-14.3 32-32s-14.3-32-32-32zM736 288H288c-17.7 0-32 14.3-32 32s14.3 32 32 32h448c17.7 0 32-14.3 32-32s-14.3-32-32-32z" fill="currentColor"/></svg>`;

/**
 * 关闭所有已存在的对齐面板
 */
function hideAlignPanel() {
    document.querySelectorAll('.vditor-align-panel').forEach(el => {
        el.style.display = 'none';
    });
}

/**
 * 构建对齐工具栏按钮的 IMenuItem 配置。
 * 
 * 注意：面板不能使用 vditor-hint 类！
 * 因为 Editor.jsx 的 forceHideRef 会在 mousedown 后 80ms 给所有 .vditor-hint
 * 加上 mac-force-hide-hint（display:none !important），导致面板刚弹出就被隐藏。
 */
export function buildAlignToolbarItem() {
    let panelElement = null;

    return {
        name: 'align',
        icon: ICON_ALIGN,
        tip: '段落对齐',
        tipPosition: 'ne',
        click(event, vditor) {
            event.stopPropagation();

            const btnElement = event.currentTarget || event.target;

            // 延迟创建面板（只创建一次），挂载到 body 以绕过 toolbar 的 overflow 裁切
            if (!panelElement) {
                panelElement = document.createElement('div');
                panelElement.className = 'vditor-align-panel';
                panelElement.innerHTML = `
                    <button data-align="left">
                        <svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M128 128h768v64H128zM128 320h512v64H128zM128 512h768v64H128zM128 704h512v64H128z" fill="currentColor"/></svg>
                        左对齐
                    </button>
                    <button data-align="center">
                        <svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M128 128h768v64H128zM256 320h512v64H256zM128 512h768v64H128zM256 704h512v64H256z" fill="currentColor"/></svg>
                        居中对齐
                    </button>
                    <button data-align="right">
                        <svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M128 128h768v64H128zM384 320h512v64H384zM128 512h768v64H128zM384 704h512v64H384z" fill="currentColor"/></svg>
                        右对齐
                    </button>
                `;

                panelElement.addEventListener('mousedown', (e) => e.stopPropagation());

                panelElement.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const align = btn.getAttribute('data-align');
                        applyAlignment(align);
                        panelElement.style.display = 'none';
                    });
                });

                document.body.appendChild(panelElement);
            }

            // Toggle 面板
            if (panelElement.style.display === 'block') {
                panelElement.style.display = 'none';
            } else {
                // 根据按钮位置计算面板坐标
                const btnRect = btnElement.getBoundingClientRect();
                panelElement.style.top = (btnRect.bottom + 4) + 'px';
                panelElement.style.left = btnRect.left + 'px';
                panelElement.style.display = 'block';

                // 点击外部关闭
                const closeOnOutsideClick = (e) => {
                    if (!panelElement.contains(e.target) && e.target !== btnElement && !btnElement.contains(e.target)) {
                        panelElement.style.display = 'none';
                        document.removeEventListener('click', closeOnOutsideClick, true);
                    }
                };
                setTimeout(() => {
                    document.addEventListener('click', closeOnOutsideClick, true);
                }, 0);
            }
        },
    };
}
