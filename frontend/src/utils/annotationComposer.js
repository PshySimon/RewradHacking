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
    preferredWidth = 320,
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

    const openAbove = roomAbove >= roomBelow;
    let y = openAbove ? pointerY - popupHeight + 52 : pointerY - 52;

    if (!openAbove && y + popupHeight > viewportHeight - margin) {
        y = viewportHeight - popupHeight - margin;
    }
    if (y < margin) {
        y = margin;
    }
    if (y + popupHeight > viewportHeight - margin) {
        y = viewportHeight - popupHeight - margin;
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
