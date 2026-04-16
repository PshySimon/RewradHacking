const getSelectionAnchorElement = (selection) => {
    const node = selection?.anchorNode;
    if (!node) {
        return null;
    }

    if (node.nodeType === 1) {
        return node;
    }

    return node.parentElement || node.parentNode || null;
};

export const getNativeCollapsedCaretRect = (rectsLike, selection) => {
    if (!rectsLike || typeof rectsLike.length !== 'number' || rectsLike.length === 0) {
        return null;
    }

    const rect = rectsLike[0];
    if (!rect) {
        return null;
    }

    const hasFinitePosition = Number.isFinite(rect.left) && Number.isFinite(rect.top);
    const hasCaretLikeWidth = !Number.isFinite(rect.width) || rect.width < 10;
    const hasReasonableHeight = !Number.isFinite(rect.height) || rect.height <= 60;

    if (!hasFinitePosition || !hasCaretLikeWidth || !hasReasonableHeight) {
        return null;
    }

    if (!rect.height || rect.height <= 0) {
        const anchorElement = getSelectionAnchorElement(selection);
        const anchorRect = anchorElement?.getBoundingClientRect?.();
        const style =
            anchorElement && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
                ? window.getComputedStyle(anchorElement)
                : null;
        const paddingTop = style ? parseFloat(style.paddingTop) || 0 : 0;
        const lineHeight = style ? parseFloat(style.lineHeight) || 22 : 22;

        return {
            left: rect.left,
            right: rect.right,
            top:
                anchorRect && Number.isFinite(anchorRect.top)
                    ? anchorRect.top + paddingTop
                    : rect.top,
            bottom:
                anchorRect && Number.isFinite(anchorRect.top)
                    ? anchorRect.top + paddingTop + lineHeight
                    : rect.top + lineHeight,
            width: rect.width,
            height: lineHeight,
        };
    }

    return rect;
};

const getRangeRect = (node, startOffset, endOffset, preferRightEdge = false) => {
    if (!node || typeof document === 'undefined' || typeof document.createRange !== 'function') {
        return null;
    }

    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, endOffset);
    const rects = range.getClientRects();
    if (!rects || rects.length === 0) {
        return null;
    }

    const rect = preferRightEdge ? rects[rects.length - 1] : rects[0];
    return {
        left: preferRightEdge && Number.isFinite(rect.right) ? rect.right : rect.left,
        top: rect.top,
        height: rect.height > 0 ? rect.height : 22,
    };
};

export const getCollapsedCaretFallbackRect = (selection) => {
    const node = selection?.anchorNode;
    const offset = selection?.anchorOffset;

    if (!node || !Number.isFinite(offset) || node.nodeType !== 3) {
        return null;
    }

    const textLength = node.textContent?.length || 0;

    if (offset > 0) {
        const previousCharRect = getRangeRect(node, offset - 1, offset, true);
        if (previousCharRect) {
            return previousCharRect;
        }
    }

    if (offset < textLength) {
        const nextCharRect = getRangeRect(node, offset, offset + 1, false);
        if (nextCharRect) {
            return nextCharRect;
        }
    }

    return null;
};
