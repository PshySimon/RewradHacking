const DEFAULT_CALLOUT_TITLES = {
    danger: 'Danger',
    info: 'Info',
    note: 'Note',
    tip: 'Tip',
    warning: 'Warning',
};

const BLOCK_TOKEN_PATTERN = /<(p|ul|ol|pre|blockquote|table|div|h[1-6])\b[\s\S]*?<\/\1>/gi;
const PARAGRAPH_INNER_PATTERN = /^<p\b[^>]*>([\s\S]*?)<\/p>$/i;
const BR_TAG_PATTERN = /<br\s*\/?>/gi;
const CALLOUT_OPEN_PATTERN = /^:::(danger|info|note|tip|warning)(?:\s+(.+))?$/i;
const CALLOUT_CLOSE_PATTERN = /^:::\s*$/i;

const decodeEntities = (value) => value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripHtml = (value) => decodeEntities(
    value.replace(BR_TAG_PATTERN, '\n').replace(/<[^>]+>/g, ''),
);

const tokenizeTopLevelHtml = (html) => {
    const tokens = [];
    let lastIndex = 0;
    let match;

    while ((match = BLOCK_TOKEN_PATTERN.exec(html)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ raw: html.slice(lastIndex, match.index), tag: null });
        }
        tokens.push({ raw: match[0], tag: match[1].toLowerCase() });
        lastIndex = BLOCK_TOKEN_PATTERN.lastIndex;
    }

    if (lastIndex < html.length) {
        tokens.push({ raw: html.slice(lastIndex), tag: null });
    }

    return tokens;
};

const splitParagraphLines = (paragraphHtml) => {
    const match = paragraphHtml.match(PARAGRAPH_INNER_PATTERN);
    if (!match) {
        return null;
    }

    return match[1].split(BR_TAG_PATTERN);
};

const buildParagraph = (lines) => {
    const nonEmptyLines = lines.filter((line) => stripHtml(line).trim() !== '');
    if (nonEmptyLines.length === 0) {
        return '';
    }

    return `<p>${nonEmptyLines.join('<br />')}</p>`;
};

const stripTrailingCloserFromToken = (raw) => raw
    .replace(/<br\s*\/?>\s*:::\s*(?=<\/(li|p)>)/gi, '')
    .replace(/:::\s*(?=<\/p>)/gi, '');

const getCalloutOpener = (token) => {
    if (token.tag !== 'p') {
        return null;
    }

    const lines = splitParagraphLines(token.raw);
    if (!lines || lines.length === 0) {
        return null;
    }

    const openerText = stripHtml(lines[0]).trim();
    const match = openerText.match(CALLOUT_OPEN_PATTERN);
    if (!match) {
        return null;
    }

    return {
        lines,
        title: match[2]?.trim() || DEFAULT_CALLOUT_TITLES[match[1].toLowerCase()],
        type: match[1].toLowerCase(),
    };
};

const findCloserIndex = (lines) => lines.findIndex((line) => stripHtml(line).trim() === ':::');

const buildCalloutHtml = ({ title, type, bodyParts }) => {
    const bodyHtml = bodyParts.join('').trim();
    return `<div class="md-callout md-callout-${type}" data-callout-type="${type}"><div class="md-callout__title">${escapeHtml(title)}</div><div class="md-callout__body">${bodyHtml}</div></div>`;
};

export const transformVditorRenderedHtml = (html = '') => {
    const tokens = tokenizeTopLevelHtml(html);
    const transformed = [];

    for (let index = 0; index < tokens.length; index += 1) {
        const opener = getCalloutOpener(tokens[index]);
        if (!opener) {
            transformed.push(tokens[index].raw);
            continue;
        }

        const bodyParts = [];
        let consumedUntil = index;
        let currentLines = opener.lines.slice(1);
        let closerIndex = findCloserIndex(currentLines);

        if (closerIndex >= 0) {
            const paragraph = buildParagraph(currentLines.slice(0, closerIndex));
            if (paragraph) {
                bodyParts.push(paragraph);
            }
            transformed.push(buildCalloutHtml({
                bodyParts,
                title: opener.title,
                type: opener.type,
            }));
            continue;
        }

        const firstParagraph = buildParagraph(currentLines);
        if (firstParagraph) {
            bodyParts.push(firstParagraph);
        }

        for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
            consumedUntil = cursor;
            const token = tokens[cursor];

            if (token.tag === 'p') {
                const paragraphLines = splitParagraphLines(token.raw);
                closerIndex = paragraphLines ? findCloserIndex(paragraphLines) : -1;

                if (closerIndex >= 0) {
                    const paragraph = buildParagraph(paragraphLines.slice(0, closerIndex));
                    if (paragraph) {
                        bodyParts.push(paragraph);
                    }
                    break;
                }
            }

            const strippedToken = stripTrailingCloserFromToken(token.raw);
            if (strippedToken !== token.raw) {
                if (stripHtml(strippedToken).trim() !== '') {
                    bodyParts.push(strippedToken);
                }
                break;
            }

            bodyParts.push(token.raw);
        }

        if (consumedUntil === index) {
            transformed.push(tokens[index].raw);
            continue;
        }

        transformed.push(buildCalloutHtml({
            bodyParts,
            title: opener.title,
            type: opener.type,
        }));
        index = consumedUntil;
    }

    return transformed.join('');
};

const CALLOUT_DECORATION_CLASSES = [
    'md-callout-block',
    'md-callout-block--start',
    'md-callout-block--end',
    'md-callout-block--hidden-marker',
    'md-callout-block--danger',
    'md-callout-block--info',
    'md-callout-block--note',
    'md-callout-block--tip',
    'md-callout-block--warning',
];

const getNodeText = (element) => (element?.textContent || '').replace(/\u200b/g, '').trim();

const debugCallout = (stage, payload = {}) => {
    if (typeof console === 'undefined') {
        return;
    }

    console.debug(`[VditorCalloutDebug] ${stage}`, payload);
};

const clearCalloutDecoration = (root) => {
    root.querySelectorAll('[data-callout-decoration]').forEach((element) => {
        CALLOUT_DECORATION_CLASSES.forEach((className) => element.classList.remove(className));
        element.removeAttribute('data-callout-decoration');
        element.removeAttribute('data-callout-title');
        element.removeAttribute('data-callout-type');
    });
};

const decorateCalloutRoot = (root) => {
    if (!root) {
        return;
    }

    clearCalloutDecoration(root);
    const elements = Array.from(root.children);
    debugCallout('decorate-root:start', {
        childCount: elements.length,
        sample: elements.slice(0, 6).map((element) => getNodeText(element)),
        tagName: root.tagName,
    });

    for (let index = 0; index < elements.length; index += 1) {
        const openerMatch = getNodeText(elements[index]).match(CALLOUT_OPEN_PATTERN);
        if (!openerMatch) {
            continue;
        }

        let closerIndex = -1;
        for (let cursor = index + 1; cursor < elements.length; cursor += 1) {
            if (CALLOUT_CLOSE_PATTERN.test(getNodeText(elements[cursor]))) {
                closerIndex = cursor;
                break;
            }
        }

        if (closerIndex === -1 || closerIndex === index + 1) {
            debugCallout('decorate-root:skip', {
                closerIndex,
                opener: getNodeText(elements[index]),
            });
            continue;
        }

        const type = openerMatch[1].toLowerCase();
        const title = openerMatch[2]?.trim() || DEFAULT_CALLOUT_TITLES[type];
        debugCallout('decorate-root:match', {
            closerIndex,
            opener: getNodeText(elements[index]),
            title,
            type,
        });

        elements[index].classList.add('md-callout-block--hidden-marker');
        elements[index].dataset.calloutDecoration = 'marker';
        elements[index].dataset.calloutType = type;

        elements[closerIndex].classList.add('md-callout-block--hidden-marker');
        elements[closerIndex].dataset.calloutDecoration = 'marker';
        elements[closerIndex].dataset.calloutType = type;

        for (let cursor = index + 1; cursor < closerIndex; cursor += 1) {
            const element = elements[cursor];
            element.classList.add('md-callout-block', `md-callout-block--${type}`);
            element.dataset.calloutDecoration = 'body';
            element.dataset.calloutType = type;

            if (cursor === index + 1) {
                element.classList.add('md-callout-block--start');
                element.dataset.calloutTitle = title;
            }

            if (cursor === closerIndex - 1) {
                element.classList.add('md-callout-block--end');
            }
        }

        index = closerIndex;
    }
};

export const decorateVditorCallouts = (container) => {
    if (!container) {
        if (typeof document === 'undefined') {
            return;
        }
        document.querySelectorAll('.vditor-reset').forEach((root) => decorateCalloutRoot(root));
        return;
    }

    if (container.classList?.contains('vditor-reset')) {
        decorateCalloutRoot(container);
        return;
    }

    container.querySelectorAll?.('.vditor-reset').forEach((root) => decorateCalloutRoot(root));
};

const calloutObservers = new WeakMap();

const observeCalloutRoot = (root) => {
    if (!root) {
        return;
    }

    debugCallout('observe-root', {
        alreadyObserved: calloutObservers.has(root),
        childCount: root.children?.length || 0,
        tagName: root.tagName,
    });
    decorateCalloutRoot(root);

    if (typeof MutationObserver === 'undefined' || calloutObservers.has(root)) {
        return;
    }

    const observer = new MutationObserver(() => {
        debugCallout('mutation', {
            childCount: root.children?.length || 0,
            sample: Array.from(root.children || []).slice(0, 6).map((element) => getNodeText(element)),
        });
        decorateCalloutRoot(root);
    });

    observer.observe(root, {
        characterData: true,
        childList: true,
        subtree: true,
    });

    calloutObservers.set(root, observer);
};

export const observeVditorCallouts = (container) => {
    if (!container) {
        if (typeof document === 'undefined') {
            return;
        }
        const roots = document.querySelectorAll('.vditor-reset');
        debugCallout('observe-all', {
            rootCount: roots.length,
        });
        roots.forEach((root) => observeCalloutRoot(root));
        return;
    }

    if (container.classList?.contains('vditor-reset')) {
        debugCallout('observe-container:root', {
            tagName: container.tagName,
            childCount: container.children?.length || 0,
        });
        observeCalloutRoot(container);
        return;
    }

    const roots = container.querySelectorAll?.('.vditor-reset') || [];
    debugCallout('observe-container:query', {
        rootCount: roots.length,
    });
    roots.forEach((root) => observeCalloutRoot(root));
};
