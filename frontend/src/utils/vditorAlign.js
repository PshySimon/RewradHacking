const ALIGN_CLASS = {
    left: 'vditor-align--left',
    center: 'vditor-align--center',
    right: 'vditor-align--right',
};

const ALIGN_VALUES = new Set(Object.keys(ALIGN_CLASS));
const ALIGN_MARKER_CLASS = 'vditor-align-marker';
const ALIGN_TEXT_MARKER_PATTERN = /\[rh-align=(?<alignment>left|center|right)\]/i;
const LEADING_ALIGN_TEXT_MARKER_PATTERN = /^(?<leading>\s*)\[rh-align=(?<alignment>left|center|right)\](?<content>[\s\S]*)$/i;
const BLOCK_HTML_PATTERN = /^<(?<tag>[a-z0-9]+)\b(?<attrs>[^>]*)>(?<inner>[\s\S]*)<\/\1>$/i;
const CLASS_ATTRIBUTE_PATTERN = /\bclass=(['"])(.*?)\1/i;
const OPENING_TAG_PATTERN = /^<(?<tag>[a-z0-9]+)\b(?<attrs>[^>]*)>/i;
const BR_TAG_PATTERN = /^<br\s*\/?>/i;

const isValidAlignment = (alignment) => ALIGN_VALUES.has(alignment);
const parseBlockHtml = (html = '') => html.match(BLOCK_HTML_PATTERN)?.groups || null;
const getAlignmentMarkerText = (alignment, { persistLeft = false } = {}) => (isValidAlignment(alignment) && (alignment !== 'left' || persistLeft)
    ? `[rh-align=${alignment}]`
    : '');

const removeAlignClasses = (element) => {
    if (!element?.classList) {
        return;
    }

    Object.values(ALIGN_CLASS).forEach((className) => element.classList.remove(className));
};

const mergeClassAttribute = (attrs = '', className) => {
    const classMatch = attrs.match(/\bclass=(['"])(.*?)\1/i);
    if (!classMatch) {
        return `${attrs} class="${className}"`;
    }

    const classes = classMatch[2].split(/\s+/).filter(Boolean);
    if (!classes.includes(className)) {
        classes.push(className);
    }

    return attrs.replace(classMatch[0], `class="${classes.join(' ')}"`);
};

const upsertDataAlignmentAttribute = (attrs = '', alignment) => {
    if (/\bdata-rh-align=(['"]).*?\1/i.test(attrs)) {
        return attrs.replace(/\bdata-rh-align=(['"]).*?\1/i, `data-rh-align="${alignment}"`);
    }

    return `${attrs} data-rh-align="${alignment}"`;
};

const stripLeadingAlignmentMarkerFromHtml = (inner = '') => inner
    .replace(new RegExp(`^\\s*<span\\b[^>]*class=(['"])[^'"]*${ALIGN_MARKER_CLASS}[^'"]*\\1[^>]*>\\s*\\[rh-align=(?:left|center|right)\\]\\s*<\\/span>`, 'i'), '')
    .replace(/^\s*\[rh-align=(?:left|center|right)\]/i, '');

const stripLeadingAlignmentMarkerFromText = (value = '') => value
    .replace(/^\s*\[rh-align=(?:left|center|right)\]/i, '');

const hasClassInAttrs = (attrs = '', className) => {
    const classMatch = attrs.match(CLASS_ATTRIBUTE_PATTERN);
    if (!classMatch) {
        return false;
    }

    return classMatch[2].split(/\s+/).includes(className);
};

const getSingleTopLevelElement = (html = '') => {
    const trimmed = html.trim();
    const openingMatch = trimmed.match(OPENING_TAG_PATTERN);
    const tag = openingMatch?.groups?.tag?.toLowerCase();
    if (!tag) {
        return null;
    }

    const tagPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
    let depth = 0;
    let match = null;

    while ((match = tagPattern.exec(trimmed)) !== null) {
        const isClosing = /^<\//.test(match[0]);
        depth += isClosing ? -1 : 1;

        if (depth === 0) {
            if (tagPattern.lastIndex !== trimmed.length) {
                return null;
            }

            return {
                tag,
                attrs: openingMatch.groups.attrs || '',
            };
        }
    }

    return null;
};

const isMathOnlyBlockHtml = (parsed) => {
    if (!parsed) {
        return false;
    }

    if (hasClassInAttrs(parsed.attrs, 'language-math')) {
        return true;
    }

    if (parsed.tag.toLowerCase() !== 'p') {
        return false;
    }

    const inlineElement = getSingleTopLevelElement(parsed.inner);
    return inlineElement?.tag === 'span'
        && hasClassInAttrs(inlineElement.attrs, 'language-math');
};

const isMathOnlyDomBlock = (block) => {
    if (!block) {
        return false;
    }

    if (block.classList?.contains('language-math')) {
        return true;
    }

    const visibleChildren = Array.from(block.childNodes || []).filter((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent.trim() !== '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        if (node.classList?.contains(ALIGN_MARKER_CLASS)) {
            return false;
        }
        return true;
    });

    return visibleChildren.length === 1
        && visibleChildren[0].classList?.contains('language-math');
};

export const upsertAlignmentMarker = (html = '', alignment = 'left') => {
    const parsed = parseBlockHtml(html);
    if (!parsed) {
        return html;
    }

    const inner = stripLeadingAlignmentMarkerFromHtml(parsed.inner);
    const marker = getAlignmentMarkerText(alignment, {
        persistLeft: alignment === 'left' && isMathOnlyBlockHtml({ ...parsed, inner }),
    });
    return `<${parsed.tag}${parsed.attrs}>${marker}${inner}</${parsed.tag}>`;
};

export const transformAlignedBlockHtml = (html = '') => {
    const parsed = parseBlockHtml(html);
    if (!parsed) {
        return html;
    }

    const markerMatch = parsed.inner.match(LEADING_ALIGN_TEXT_MARKER_PATTERN);
    if (!markerMatch?.groups?.alignment || !isValidAlignment(markerMatch.groups.alignment)) {
        if (!isMathOnlyBlockHtml(parsed)) {
            return html;
        }

        const attrs = mergeClassAttribute(parsed.attrs, ALIGN_CLASS.center);
        return `<${parsed.tag}${attrs}>${parsed.inner}</${parsed.tag}>`;
    }

    if (markerMatch.groups.alignment === 'left') {
        let content = markerMatch.groups.content;
        content = content.replace(BR_TAG_PATTERN, '');
        return `<${parsed.tag}${parsed.attrs}>${markerMatch.groups.leading}${content}</${parsed.tag}>`;
    }

    let content = markerMatch.groups.content;
    content = content.replace(BR_TAG_PATTERN, '');

    let attrs = mergeClassAttribute(parsed.attrs, ALIGN_CLASS[markerMatch.groups.alignment]);
    attrs = upsertDataAlignmentAttribute(attrs, markerMatch.groups.alignment);
    return `<${parsed.tag}${attrs}>${markerMatch.groups.leading}${content}</${parsed.tag}>`;
};

const findCurrentBlock = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    let node = selection.anchorNode;
    if (!node) {
        return null;
    }

    if (node.nodeType === 3) {
        node = node.parentElement;
    }
    if (!node) {
        return null;
    }

    const block = node.closest('[data-block]');
    if (!block || !block.closest('.vditor-reset')) {
        return null;
    }

    return block;
};

const getBlockAlignmentMarker = (block) => {
    const markerMatch = (block?.textContent || '').match(LEADING_ALIGN_TEXT_MARKER_PATTERN);
    const alignment = markerMatch?.groups?.alignment;
    return isValidAlignment(alignment) ? alignment : null;
};

const getBlockAlignment = (block) => {
    const alignment = getBlockAlignmentMarker(block) || 'left';
    return isValidAlignment(alignment) ? alignment : 'left';
};

const removeDomAlignmentMarkers = (block) => {
    block.querySelectorAll?.(`.${ALIGN_MARKER_CLASS}`).forEach((marker) => marker.remove());

    const firstChild = block.firstChild;
    if (firstChild?.nodeType === Node.TEXT_NODE) {
        firstChild.textContent = stripLeadingAlignmentMarkerFromText(firstChild.textContent);
        if (firstChild.textContent === '') {
            firstChild.remove();
        }
    }
};

const prependDomAlignmentMarker = (block, alignment, options = {}) => {
    const markerText = getAlignmentMarkerText(alignment, options);
    if (!markerText) {
        return;
    }

    const marker = document.createElement('span');
    marker.className = ALIGN_MARKER_CLASS;
    marker.textContent = markerText;
    marker.setAttribute('contenteditable', 'false');
    marker.setAttribute('aria-hidden', 'true');
    block.prepend(marker);
};

const syncBlockAlignment = (block) => {
    if (!block) {
        return;
    }

    const explicitAlignment = getBlockAlignmentMarker(block);
    const alignment = explicitAlignment || 'left';
    removeAlignClasses(block);

    if (alignment !== 'left') {
        block.classList.add(ALIGN_CLASS[alignment]);
    } else if (!explicitAlignment && isMathOnlyDomBlock(block)) {
        block.classList.add(ALIGN_CLASS.center);
    }

    if (!block.querySelector?.(`:scope > .${ALIGN_MARKER_CLASS}`) && explicitAlignment) {
        removeDomAlignmentMarkers(block);
        prependDomAlignmentMarker(block, alignment, { persistLeft: alignment === 'left' });
    }
};

const decorateAlignmentRoot = (root) => {
    if (!root?.querySelectorAll) {
        return;
    }

    root.querySelectorAll(':scope > [data-block]').forEach((block) => {
        syncBlockAlignment(block);
    });
};

export function applyAlignment(alignment) {
    if (!isValidAlignment(alignment)) {
        return null;
    }

    const block = findCurrentBlock();
    if (!block) {
        return null;
    }

    const current = getBlockAlignment(block);
    const nextAlignment = current === alignment ? 'left' : alignment;
    const persistLeft = nextAlignment === 'left' && isMathOnlyDomBlock(block);
    removeDomAlignmentMarkers(block);
    prependDomAlignmentMarker(block, nextAlignment, { persistLeft });
    syncBlockAlignment(block);
    return nextAlignment === 'left' ? null : nextAlignment;
}

export function installAlignmentObserver() {
    const container = document.querySelector('.vditor-ir .vditor-reset');
    if (!container) {
        return () => {};
    }

    let rafId = null;
    const scheduleDecoration = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
            decorateAlignmentRoot(container);
            rafId = null;
        });
    };

    scheduleDecoration();

    const observer = new MutationObserver(() => {
        scheduleDecoration();
    });

    observer.observe(container, { childList: true, subtree: true, characterData: true });

    return () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
        }
        observer.disconnect();
    };
}

export function clearAlignments() {
    const container = document.querySelector('.vditor-ir .vditor-reset');
    if (container) {
        decorateAlignmentRoot(container);
    }
}

const ICON_ALIGN = `<svg viewBox="0 0 1024 1024"><path d="M896 128H128c-17.7 0-32 14.3-32 32s14.3 32 32 32h768c17.7 0 32-14.3 32-32s-14.3-32-32-32zM736 416H288c-17.7 0-32 14.3-32 32s14.3 32 32 32h448c17.7 0 32-14.3 32-32s-14.3-32-32-32zM896 704H128c-17.7 0-32 14.3-32 32s14.3 32 32 32h768c17.7 0 32-14.3 32-32s-14.3-32-32-32zM736 288H288c-17.7 0-32 14.3-32 32s14.3 32 32 32h448c17.7 0 32-14.3 32-32s-14.3-32-32-32z" fill="currentColor"/></svg>`;

export function buildAlignToolbarItem() {
    let panelElement = null;

    return {
        name: 'align',
        icon: ICON_ALIGN,
        tip: '段落对齐',
        tipPosition: 'ne',
        click(event) {
            event.stopPropagation();

            const btnElement = event.currentTarget || event.target;
            if (!panelElement) {
                panelElement = document.createElement('div');
                panelElement.className = 'vditor-align-panel';
                panelElement.innerHTML = `
                    <button data-align="left">
                        <svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M128 128h768v64H128zM128 320h512v64H128zM128 512h768v64H128zM128 704h512v64H128z" fill="currentColor"/></svg>
                        左对齐
                    </button>
                    <button data-align="center">
                        <svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M128 128h768v64H128zM256 320h512v64H256zM128 512h768v64H128zM256 704h512v64H256z" fill="currentColor"/></svg>
                        居中对齐
                    </button>
                    <button data-align="right">
                        <svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M128 128h768v64H128zM384 320h512v64H384zM128 512h768v64H128zM384 704h512v64H384z" fill="currentColor"/></svg>
                        右对齐
                    </button>
                `;

                panelElement.addEventListener('mousedown', (mouseEvent) => mouseEvent.stopPropagation());
                panelElement.querySelectorAll('button').forEach((button) => {
                    button.addEventListener('click', (clickEvent) => {
                        clickEvent.preventDefault();
                        clickEvent.stopPropagation();
                        applyAlignment(button.getAttribute('data-align'));
                        panelElement.style.display = 'none';
                    });
                });

                document.body.appendChild(panelElement);
            }

            if (panelElement.style.display === 'block') {
                panelElement.style.display = 'none';
                return;
            }

            const buttonRect = btnElement.getBoundingClientRect();
            panelElement.style.top = `${buttonRect.bottom + 4}px`;
            panelElement.style.left = `${buttonRect.left}px`;
            panelElement.style.display = 'block';

            const closeOnOutsideClick = (clickEvent) => {
                if (!panelElement.contains(clickEvent.target) && clickEvent.target !== btnElement && !btnElement.contains(clickEvent.target)) {
                    panelElement.style.display = 'none';
                    document.removeEventListener('click', closeOnOutsideClick, true);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeOnOutsideClick, true);
            }, 0);
        },
    };
}
