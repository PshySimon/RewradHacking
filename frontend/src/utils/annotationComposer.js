export const getAnnotationHotzoneWidth = ({
    lineRight,
    viewportWidth,
    margin = 12,
}) => {
    const safeRight = Number(lineRight || 0);
    const safeViewportWidth = Number(viewportWidth || 0);
    return Math.max(12, Math.floor(safeViewportWidth - safeRight - margin));
};

export const getAnnotationInnerHotzoneWidth = (rootWidth) => {
    const safeRootWidth = Number(rootWidth || 0);
    return Math.max(140, Math.min(220, Math.round(safeRootWidth * 0.22)));
};

export const getAnnotationHotzoneLayout = ({
    rootRect,
    blockRect,
    viewportWidth,
    margin = 12,
}) => {
    const innerWidth = getAnnotationInnerHotzoneWidth(rootRect.width);
    const outsideWidth = getAnnotationHotzoneWidth({
        lineRight: rootRect.right,
        viewportWidth,
        margin,
    });

    return {
        left: Math.floor(rootRect.width - innerWidth),
        top: Math.floor(blockRect.top - rootRect.top),
        width: innerWidth + outsideWidth,
        height: Math.floor(blockRect.height),
    };
};

export const clampAnnotationComposerPosition = ({
    pointerX,
    pointerY,
    viewportWidth,
    viewportHeight,
    margin = 12,
    preferredWidth = 360,
    preferredHeight = 500,
    minimumHeight = 180,
    gap = 12,
}) => {
    const popupWidth = Math.min(preferredWidth, Math.max(260, viewportWidth - margin * 2));
    const roomAbove = Math.max(0, pointerY - margin);
    const roomBelow = Math.max(0, viewportHeight - pointerY - margin);
    const popupHeight = Math.min(
        preferredHeight,
        Math.max(minimumHeight, Math.max(roomAbove, roomBelow)),
    );

    let x = pointerX - popupWidth - gap;
    if (x < margin) {
        x = pointerX + gap;
    }
    if (x + popupWidth > viewportWidth - margin) {
        x = viewportWidth - popupWidth - margin;
    }
    if (x < margin) {
        x = margin;
    }

    const maxY = Math.max(margin, viewportHeight - popupHeight - margin);
    let y = pointerY - popupHeight / 2;
    if (y < margin) {
        y = margin;
    }
    if (y > maxY) {
        y = maxY;
    }

    return {
        x: Math.floor(x),
        y: Math.floor(y),
        popupWidth,
        popupHeight: Math.floor(popupHeight),
    };
};

export const insertAnnotationEmoji = ({
    value,
    selectionStart,
    selectionEnd,
    emoji,
}) => {
    const currentValue = value || '';
    const start = Number.isFinite(selectionStart) ? selectionStart : currentValue.length;
    const end = Number.isFinite(selectionEnd) ? selectionEnd : start;
    const nextValue = `${currentValue.slice(0, start)}${emoji}${currentValue.slice(end)}`;
    const nextCursor = start + emoji.length;

    return {
        value: nextValue,
        selectionStart: nextCursor,
        selectionEnd: nextCursor,
    };
};

export const buildAnnotationPreview = (annotations, maxLength = 18) => {
    const list = Array.isArray(annotations) ? annotations : [];
    const visible = list.filter((annotation) => String(annotation?.content || '').trim());
    if (visible.length === 0) {
        return null;
    }

    const firstContent = String(visible[0].content || '').trim().replace(/\s+/g, ' ');
    const previewText = firstContent.length > maxLength
        ? `${firstContent.slice(0, maxLength)}…`
        : firstContent;

    return {
        previewText,
        extraCount: Math.max(0, visible.length - 1),
        totalCount: visible.length,
    };
};

export const buildAnnotationQuotePreview = (lineText, maxLength = 20) => {
    const normalized = String(lineText || '').trim().replace(/\s+/g, ' ');
    if (!normalized) {
        return '';
    }
    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength)}…`
        : normalized;
};

export const createVisualLineCacheKey = ({
    blockAnchor,
    text,
    width,
}) => {
    const normalizedText = normalizeMeasuredLineText(text || '');
    return `${String(blockAnchor || '')}::${Math.round(Number(width || 0))}::${normalizedText}`;
};

export const reuseCachedVisualLines = ({
    cache,
    blockAnchor,
    fingerprint,
}) => {
    if (!(cache instanceof Map)) {
        return null;
    }

    const cached = cache.get(blockAnchor);
    if (!cached || cached.fingerprint !== fingerprint || !Array.isArray(cached.lines)) {
        return null;
    }

    return cached.lines;
};

export const createAnnotationLineKey = ({
    blockAnchor,
    textStart,
    textEnd,
    legacyLineIndex,
}) => {
    if (blockAnchor && Number.isFinite(textStart) && Number.isFinite(textEnd)) {
        return `block:${blockAnchor}:${textStart}:${textEnd}`;
    }

    return `legacy:${Number(legacyLineIndex || 0)}`;
};

export const resolveAnnotationAnchor = (annotation, visualLines = []) => {
    if (!annotation) {
        return null;
    }

    const list = Array.isArray(visualLines) ? visualLines : [];
    const hasBlockAnchor = Boolean(annotation.block_anchor)
        && Number.isFinite(annotation.block_text_start)
        && Number.isFinite(annotation.block_text_end);

    if (hasBlockAnchor) {
        const sameBlock = list.filter((line) => line.blockAnchor === annotation.block_anchor);
        let best = null;
        let bestOverlap = -1;

        sameBlock.forEach((line) => {
            const overlap = Math.max(
                0,
                Math.min(line.textEnd, annotation.block_text_end) - Math.max(line.textStart, annotation.block_text_start),
            );
            if (overlap > bestOverlap) {
                best = line;
                bestOverlap = overlap;
            }
        });

        if (best) {
            return best;
        }
    }

    return list.find((line) => Number(line.legacyLineIndex || 0) === Number(annotation.line_index || 0)) || null;
};

const normalizeMeasuredLineText = (value = '') => String(value || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const materializeMeasuredLineRect = (line) => {
    const rect = line?.rect;
    if (!rect) {
        return null;
    }

    const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    if (!Number.isFinite(rect.docTop) || !Number.isFinite(rect.docLeft)) {
        return rect;
    }

    return {
        top: rect.docTop - scrollY,
        bottom: rect.docBottom - scrollY,
        left: rect.docLeft - scrollX,
        right: rect.docRight - scrollX,
        width: rect.width,
        height: rect.height,
    };
};

export const findNearestMeasuredLine = (lines, pointerY) => {
    const list = Array.isArray(lines) ? lines : [];
    if (list.length === 0) {
        return null;
    }

    return list.reduce((best, line) => {
        const rect = materializeMeasuredLineRect(line);
        if (!rect) {
            return best;
        }
        const centerY = rect.top + rect.height / 2;
        const distance = Math.abs(pointerY - centerY);
        if (!best || distance < best.distance) {
            return { line, distance };
        }
        return best;
    }, null)?.line || null;
};

const mergeCharacterRectIntoLine = (line, rectLike, verticalTolerance = 6) => {
    const lineCenter = (line.top + line.bottom) / 2;
    const rectCenter = (rectLike.top + rectLike.bottom) / 2;
    const overlap = Math.min(line.bottom, rectLike.bottom) - Math.max(line.top, rectLike.top);

    if (overlap > 0 || Math.abs(lineCenter - rectCenter) <= verticalTolerance) {
        line.top = Math.min(line.top, rectLike.top);
        line.bottom = Math.max(line.bottom, rectLike.bottom);
        line.left = Math.min(line.left, rectLike.left);
        line.right = Math.max(line.right, rectLike.right);
        line.textStart = Math.min(line.textStart, rectLike.textStart);
        line.textEnd = Math.max(line.textEnd, rectLike.textEnd);
        return true;
    }

    return false;
};

export const groupMeasuredCharacterRects = (rects, verticalTolerance = 6) => {
    const groups = [];
    const list = Array.isArray(rects) ? rects : [];

    list.forEach((rectLike) => {
        if (!rectLike) {
            return;
        }

        let merged = false;
        for (const line of groups) {
            if (mergeCharacterRectIntoLine(line, rectLike, verticalTolerance)) {
                merged = true;
                break;
            }
        }

        if (!merged) {
            groups.push({
                top: rectLike.top,
                bottom: rectLike.bottom,
                left: rectLike.left,
                right: rectLike.right,
                textStart: rectLike.textStart,
                textEnd: rectLike.textEnd,
            });
        }
    });

    return groups.sort((a, b) => a.top - b.top || a.left - b.left);
};

export const measureVisualLines = (
    block,
    {
        blockAnchor,
        legacyLineIndex,
        startLineIndex = 1,
    } = {},
) => {
    if (!(block instanceof HTMLElement) || typeof document === 'undefined') {
        return [];
    }

    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let currentOffset = 0;
    let fullText = '';
    let node = walker.nextNode();

    while (node) {
        const text = node.textContent || '';
        textNodes.push({
            node,
            start: currentOffset,
            text,
        });
        fullText += text;
        currentOffset += text.length;
        node = walker.nextNode();
    }

    const measuredRects = [];

    textNodes.forEach(({ node: textNode, start, text }) => {
        for (let index = 0; index < text.length; index += 1) {
            const char = text[index];
            if (!char || /\s/.test(char)) {
                continue;
            }

            const range = document.createRange();
            range.setStart(textNode, index);
            range.setEnd(textNode, index + 1);
            const rect = range.getBoundingClientRect();
            if (!rect || rect.width === 0 && rect.height === 0) {
                continue;
            }
            measuredRects.push({
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                textStart: start + index,
                textEnd: start + index + 1,
            });
        }
    });

    const groups = groupMeasuredCharacterRects(measuredRects);

    if (groups.length === 0) {
        const fallbackText = normalizeMeasuredLineText(fullText);
        if (!fallbackText) {
            return [];
        }

        const rect = block.getBoundingClientRect();
        return [{
            key: createAnnotationLineKey({
                blockAnchor,
                textStart: 0,
                textEnd: fullText.length,
                legacyLineIndex,
            }),
            blockAnchor,
            legacyLineIndex,
            lineIndex: startLineIndex,
            textStart: 0,
            textEnd: fullText.length,
            lineText: fallbackText,
            rect: {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                docTop: rect.top + (typeof window !== 'undefined' ? window.scrollY : 0),
                docBottom: rect.bottom + (typeof window !== 'undefined' ? window.scrollY : 0),
                docLeft: rect.left + (typeof window !== 'undefined' ? window.scrollX : 0),
                docRight: rect.right + (typeof window !== 'undefined' ? window.scrollX : 0),
                width: rect.width,
                height: rect.height,
            },
        }];
    }

    return groups
        .map((line, index) => {
            const lineText = normalizeMeasuredLineText(fullText.slice(line.textStart, line.textEnd));
            const textEnd = Math.max(line.textStart + 1, line.textEnd);
            return {
                key: createAnnotationLineKey({
                    blockAnchor,
                    textStart: line.textStart,
                    textEnd,
                    legacyLineIndex,
                }),
                blockAnchor,
                legacyLineIndex,
                lineIndex: startLineIndex + index,
                textStart: line.textStart,
                textEnd,
                lineText,
                rect: {
                    top: line.top,
                    bottom: line.bottom,
                    left: line.left,
                    right: line.right,
                    docTop: line.top + (typeof window !== 'undefined' ? window.scrollY : 0),
                    docBottom: line.bottom + (typeof window !== 'undefined' ? window.scrollY : 0),
                    docLeft: line.left + (typeof window !== 'undefined' ? window.scrollX : 0),
                    docRight: line.right + (typeof window !== 'undefined' ? window.scrollX : 0),
                    width: Math.max(0, line.right - line.left),
                    height: Math.max(0, line.bottom - line.top),
                },
            };
        });
};
