import { buildVditorEditorOptions } from './vditorOptions.js';

const COMMENT_EMOJIS = {
    '😂': '😂',
    '🤣': '🤣',
    '😅': '😅',
    '😭': '😭',
    '🥺': '🥺',
    '🥰': '🥰',
    '😎': '😎',
    '🤔': '🤔',
    '👍': '👍',
    '👏': '👏',
    '🙏': '🙏',
    '🚀': '🚀',
    '🔥': '🔥',
    '🎉': '🎉',
    '💯': '💯',
    '❤️': '❤️',
    '✨': '✨',
    '💡': '💡',
    '👀': '👀',
    '🐶': '🐶',
};

export const COMMENT_EMOJI_LIST = Object.values(COMMENT_EMOJIS);

export const positionCommentToolbarPanel = (panel) => {
    if (!panel || typeof panel.closest !== 'function' || !panel.style) {
        return false;
    }

    const toolbarItem = panel.closest('.vditor-toolbar__item');
    if (
        !toolbarItem
        || typeof toolbarItem.getBoundingClientRect !== 'function'
        || typeof panel.getBoundingClientRect !== 'function'
    ) {
        return false;
    }

    const itemRect = toolbarItem.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const verticalOffset = Math.max(Math.round(itemRect.height + 6), 28);
    
    const spaceBelow = window.innerHeight - itemRect.bottom;
    const spaceAbove = itemRect.top;
    const popupHeight = panelRect.height > 0 ? panelRect.height : 240;

    if (spaceBelow < popupHeight + 12 && spaceAbove > spaceBelow) {
        panel.style.top = 'auto';
        panel.style.bottom = `${verticalOffset}px`;
    } else {
        panel.style.top = `${verticalOffset}px`;
        panel.style.bottom = 'auto';
    }

    if (panel.classList?.contains('vditor-panel--left')) {
        panel.style.left = 'auto';
        panel.style.right = '0';
    } else {
        panel.style.left = '0';
        panel.style.right = 'auto';
    }

    return true;
};

export const shouldRepositionCommentToolbarPanel = (root, panel) => {
    if (
        !root
        || !panel
        || typeof window === 'undefined'
        || typeof window.getComputedStyle !== 'function'
        || !panel.classList
    ) {
        return false;
    }

    const isVisible = window.getComputedStyle(panel).display !== 'none';
    if (!isVisible) {
        delete root.__commentToolbarPanelSignature;
        delete root.__commentToolbarPanelElement;
        return false;
    }

    const signature = [
        panel.classList.contains('vditor-panel--left') ? 'left' : 'right',
        panel.classList.contains('vditor-panel--arrow') ? 'arrow' : 'plain',
        panel.className,
    ].join(':');

    if (
        root.__commentToolbarPanelElement === panel
        && root.__commentToolbarPanelSignature === signature
    ) {
        return false;
    }

    root.__commentToolbarPanelElement = panel;
    root.__commentToolbarPanelSignature = signature;
    return true;
};

export const buildCommentEditorOptions = (options = {}) => buildVditorEditorOptions({
    height: 'auto',
    mode: 'ir',
    decorateOnAfter: false,
    decorateOnInput: false,
    placeholder: '输入评论...',
    cache: { enable: false },
    hint: {
        emoji: COMMENT_EMOJIS,
    },
    toolbar: [
        'emoji', 'bold', 'italic', 'link', '|',
        'list', 'ordered-list', '|',
        'quote', 'inline-code', 'code',
    ],
    ...options,
});
