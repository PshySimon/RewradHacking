import { normalizeVditorMarkdown } from './vditorMarkdown';
import { buildVditorRenderOptions } from './vditorOptions';

const MAX_SAFE_EXCERPT_LENGTH = 180;

const stripCodeBlocks = (value = '') => value.replace(/```[\s\S]*?```/g, ' ');

const stripInlineCode = (value = '') => value.replace(/`([^`]+)`/g, '$1');

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
    .replace(/<[^>]*>/g, ' ')
    .replace(/<span class="vditor-ir__marker[^"]*"[^>]*>/gi, ' ');

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
    text = stripLinkAndImage(text);
    text = stripBlockquote(text);
    text = stripListMarker(text);
    text = stripHeadingMarker(text);
    text = stripInlineDelimiters(text);
    text = stripHtml(text);
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

export const markdownExcerpt = async (value = '', maxLength = MAX_SAFE_EXCERPT_LENGTH) => {
    const plainText = await markdownToPlainText(value);
    if (plainText.length <= maxLength) {
        return plainText;
    }

    return `${plainText.slice(0, maxLength)}...`;
};
