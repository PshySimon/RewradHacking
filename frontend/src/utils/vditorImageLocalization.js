const MARKDOWN_IMAGE_RE = /!\[[^\]]*]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)/g;
const HTML_IMAGE_RE = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi;

export function isExternalImageUrl(url) {
    if (!url) return false;
    const normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) return false;
    if (normalized.includes('/api/static/images/')) return false;
    if (normalized.startsWith('data:')) return false;
    return true;
}

export function extractExternalImageUrls(content) {
    if (!content) return [];

    const seen = new Set();
    const urls = [];
    const add = (url) => {
        const normalized = (url || '').trim();
        if (!isExternalImageUrl(normalized) || seen.has(normalized)) return;
        seen.add(normalized);
        urls.push(normalized);
    };

    for (const match of content.matchAll(MARKDOWN_IMAGE_RE)) {
        add(match[1] || match[2]);
    }
    for (const match of content.matchAll(HTML_IMAGE_RE)) {
        add(match[2]);
    }

    return urls;
}

export function replaceImageUrl(content, oldUrl, newUrl) {
    if (!content || !oldUrl || !newUrl) return content;
    return content.split(oldUrl).join(newUrl);
}

const createInitialState = (total) => ({
    status: 'running',
    total,
    completed: 0,
    success: 0,
    failed: 0,
    currentUrl: '',
    errors: [],
});

export async function localizeExternalImagesInVditor({
    vditor,
    fetchImage,
    onProgress,
    concurrency = 3,
    hideDelayMs = 2500,
}) {
    if (!vditor || typeof vditor.getValue !== 'function' || typeof fetchImage !== 'function') {
        return null;
    }

    const urls = extractExternalImageUrls(vditor.getValue());
    if (urls.length === 0) {
        onProgress?.(null);
        return null;
    }

    const state = createInitialState(urls.length);
    const emit = () => onProgress?.({ ...state, errors: [...state.errors] });
    emit();

    let cursor = 0;
    const workerCount = Math.max(1, Math.min(concurrency, urls.length));

    const runWorker = async () => {
        while (cursor < urls.length) {
            const url = urls[cursor];
            cursor += 1;
            state.currentUrl = url;
            emit();

            try {
                const newUrl = await fetchImage(url);
                if (!newUrl) throw new Error('empty local image url');
                const currentValue = vditor.getValue();
                const nextValue = replaceImageUrl(currentValue, url, newUrl);
                if (nextValue !== currentValue && typeof vditor.setValue === 'function') {
                    vditor.setValue(nextValue);
                }
                state.success += 1;
            } catch (error) {
                state.failed += 1;
                state.errors.push({ url, message: error?.message || String(error) });
            } finally {
                state.completed += 1;
                emit();
            }
        }
    };

    await Promise.all(Array.from({ length: workerCount }, runWorker));

    state.status = 'done';
    state.currentUrl = '';
    emit();

    if (hideDelayMs > 0) {
        setTimeout(() => onProgress?.(null), hideDelayMs);
    }

    return {
        total: state.total,
        success: state.success,
        failed: state.failed,
        errors: state.errors,
    };
}
