/**
 * Vditor 裂图修复工具
 *
 * 检测编辑器中加载失败的外部图片，在其上覆盖「重新获取」按钮。
 * 点击后调用后端 /api/upload/fetch_image 代为下载并转存为本地资源，
 * 然后替换 img.src 和 IR 模式下对应的 marker span 中的 URL 文本。
 */

/**
 * 判断一个 URL 是否为外部图片（非本站资源）
 */
function isExternalUrl(src) {
    if (!src) return false;
    if (src.startsWith('data:')) return false;
    if (src.startsWith('/api/')) return false;
    if (src.startsWith('/')) return false;
    return src.startsWith('http://') || src.startsWith('https://');
}

/**
 * 创建裂图修复覆盖层
 */
function createRetryOverlay(img) {
    // 避免重复创建
    if (img.__retryOverlay) return;

    const overlay = document.createElement('div');
    overlay.className = 'vditor-broken-img-overlay';
    overlay.innerHTML = `
        <div class="vditor-broken-img-inner">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 3l-8 8"/>
                <path d="M17 3h4v4"/>
            </svg>
            <span>重新获取图片</span>
        </div>
    `;

    overlay.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await retryFetchImage(img, overlay);
    });

    // 定位：相对于图片的父容器
    const parent = img.parentElement;
    if (parent) {
        parent.style.position = 'relative';
        parent.appendChild(overlay);
    }

    img.__retryOverlay = overlay;
}

/**
 * 调用后端重新获取图片
 */
async function retryFetchImage(img, overlay) {
    const originalUrl = img.getAttribute('src') || img.getAttribute('data-src');
    if (!originalUrl || !isExternalUrl(originalUrl)) return;

    // 显示加载状态
    const inner = overlay.querySelector('.vditor-broken-img-inner');
    const originalContent = inner.innerHTML;
    inner.innerHTML = `
        <div class="vditor-broken-img-spinner"></div>
        <span>正在获取...</span>
    `;

    try {
        const token = localStorage.getItem('access_token');
        const resp = await fetch('/api/upload/fetch_image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ url: originalUrl }),
        });

        const result = await resp.json();

        if (result.code === 0 && result.data?.url) {
            const newUrl = result.data.url;

            // 1. 更新 img 的 src
            img.src = newUrl;

            // 2. 在 IR 模式下，同步更新对应的 marker--link span
            const irNode = img.closest('.vditor-ir__node[data-type="img"]');
            if (irNode) {
                const linkMarker = irNode.querySelector('.vditor-ir__marker--link');
                if (linkMarker) {
                    linkMarker.textContent = newUrl;
                }
            }

            // 3. 移除覆盖层
            overlay.remove();
            img.__retryOverlay = null;

            console.log(`[BrokenImg] 修复成功: ${originalUrl} → ${newUrl}`);
        } else {
            throw new Error(result.msg || '后端返回失败');
        }
    } catch (err) {
        console.warn('[BrokenImg] 修复失败:', err.message);
        inner.innerHTML = originalContent;
        // 短暂显示错误提示
        const span = overlay.querySelector('span');
        if (span) {
            span.textContent = '获取失败，点击重试';
            span.style.color = '#FF3B30';
            setTimeout(() => {
                span.textContent = '重新获取图片';
                span.style.color = '';
            }, 2000);
        }
    }
}

/**
 * 为单个 img 元素安装裂图检测
 */
function watchImage(img) {
    if (img.__brokenWatched) return;
    img.__brokenWatched = true;

    const src = img.getAttribute('src');
    if (!isExternalUrl(src)) return;

    // 如果图片已经加载失败（naturalWidth 为 0 且 complete 为 true）
    if (img.complete && img.naturalWidth === 0) {
        createRetryOverlay(img);
        return;
    }

    // 监听后续的加载失败
    img.addEventListener('error', () => {
        createRetryOverlay(img);
    }, { once: true });
}

/**
 * 扫描编辑器中所有外部图片并安装监听
 */
function scanImages(container) {
    if (!container) return;
    const imgs = container.querySelectorAll('img');
    imgs.forEach(watchImage);
}

/**
 * 安装裂图修复系统（MutationObserver 持续监控新增的图片）
 * @param {HTMLElement} editorElement - Vditor 编辑区域 (.vditor-ir .vditor-reset)
 * @returns {Function} cleanup 清理函数
 */
export function installBrokenImageHandler(editorElement) {
    if (!editorElement) return () => {};

    // 首次扫描
    scanImages(editorElement);

    // 监听新增图片
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.tagName === 'IMG') {
                    watchImage(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('img').forEach(watchImage);
                }
            }
        }
    });

    observer.observe(editorElement, { childList: true, subtree: true });

    return () => observer.disconnect();
}
