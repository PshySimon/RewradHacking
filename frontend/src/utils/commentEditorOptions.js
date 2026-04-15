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

export const buildCommentEditorOptions = (options = {}) => buildVditorEditorOptions({
    height: 'auto',
    mode: 'ir',
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
