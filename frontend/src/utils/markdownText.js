import { normalizeVditorMarkdown } from './vditorMarkdown.js';
import { buildVditorRenderOptions } from './vditorOptions.js';

const MAX_SAFE_EXCERPT_LENGTH = 180;

const isFenceLine = (line = '') => /^\s*```/u.test(line);

const stripCodeBlocks = (value = '') => {
    const lines = value.split('\n');
    const out = [];
    let inFence = false;

    for (const line of lines) {
        if (isFenceLine(line)) {
            inFence = !inFence;
            continue;
        }

        if (inFence) {
            continue;
        }

        out.push(line);
    }

    return out.join('\n');
};

const stripInlineCode = (value = '') => value.replace(/`[^`\n]*`/g, '');

const stripLinkAndImage = (value = '') => {
    let text = value.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    return text;
};

const stripBlockquote = (value = '') => value.replace(/^\s*>\s?/gm, '');

const stripListMarker = (value = '') => value.replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, '');

const stripHeadingMarker = (value = '') => value.replace(/^\s{0,3}#{1,6}\s*/gm, '');

const stripInlineDelimiters = (value = '') => {
    let text = value;
    text = text.replace(/(\*\*|__)(.+?)\1/g, '$2');
    text = text.replace(/(\*|_)(.+?)\1/g, '$2');
    text = text.replace(/~~(.+?)~~/g, '$1');
    return text;
};

const stripCalloutFence = (value = '') => {
    const lines = value.split('\n').map(line => {
        if (/^\s*:::\s*(?:danger|info|note|tip|warning)(?:\s+.*)?$/i.test(line)) {
            return '';
        }
        if (/^\s*:::\s*$/.test(line)) {
            return '';
        }
        return line;
    });
    return lines.join('\n');
};

const stripHtml = (value = '') => value
    .replace(/<span[^>]*class="[^"]*\bvditor-ir__marker\b[^"]*"[^>]*>/gi, ' ')
    .replace(/<\/span>/gi, '')
    .replace(/<[^>]*>/g, ' ');

const stripInlineEmphasis = (value = '') => {
    let text = value;
    text = text.replace(/(\*\*|__)([^*\n]*?)\1/g, '$2');
    text = text.replace(/(\*|_)([^*\n]*?)\1/g, '$2');
    text = text.replace(/\*{2,}|_{2,}/g, '');
    return text;
};

const normalizeWhitespace = (value = '') => {
    let text = value
        .replace(/\u00A0/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ ]{2,}/g, ' ')
        .trim();

    return text;
};

const decodeHtmlEntities = (value = '') => {
    if (typeof window === 'undefined' || typeof window.document === 'undefined') {
        return value;
    }

    const textarea = window.document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
};

const stripMarkdown = (value = '') => {
    let text = value;
    text = stripCalloutFence(text);
    text = stripCodeBlocks(text);
    text = stripInlineCode(text);
    text = stripInlineEmphasis(text);
    text = stripLinkAndImage(text);
    text = stripBlockquote(text);
    text = stripListMarker(text);
    text = stripHeadingMarker(text);
    text = stripInlineDelimiters(text);
    text = stripHtml(text);
    text = decodeHtmlEntities(text);
    return normalizeWhitespace(text);
};

export const toPlainText = (value = '') => {
    const stripped = stripMarkdown(value);
    return stripped;
};

const htmlToPlainText = async (html = '') => {
    if (!html || typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
        return toPlainText(html);
    }

    try {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('pre').forEach((node) => node.remove());
        doc.querySelectorAll('.vditor-ir__marker').forEach((node) => node.remove());
        doc.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
        return normalizeWhitespace(doc.body?.textContent || '');
    } catch {
        return toPlainText(decodeHtmlEntities(html));
    }
};

export const markdownToPlainText = async (value = '', options = {}) => {
    const { forceFallback = false } = options;
    const normalizedText = normalizeVditorMarkdown(value || '');

    if (!forceFallback && typeof window !== 'undefined' && window.Vditor && typeof window.Vditor.md2html === 'function') {
        try {
            const html = await Promise.resolve(window.Vditor.md2html(normalizedText, buildVditorRenderOptions()));
            return await htmlToPlainText(html || '');
        } catch {
            return stripMarkdown(normalizedText);
        }
    }

    return stripMarkdown(normalizedText);
};

export { stripMarkdown };

export const markdownExcerpt = async (value = '', maxLength = MAX_SAFE_EXCERPT_LENGTH) => {
    const plainText = await markdownToPlainText(value);
    if (plainText.length <= maxLength) {
        return plainText;
    }

    return `${plainText.slice(0, maxLength)}...`;
};
