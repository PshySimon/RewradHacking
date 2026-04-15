const STRONG_MARKER_PATTERN = /(\*\*|__)(.+?)\1/gs;

export const revealInvisibleCharacters = (value = '') => value
    .replace(/\u200B/g, '<ZWSP>')
    .replace(/\u200C/g, '<ZWNJ>')
    .replace(/\u200D/g, '<ZWJ>')
    .replace(/\uFEFF/g, '<BOM>');

export const hasInvisibleCharacters = (value = '') => value.includes('\u200B')
    || value.includes('\u200C')
    || value.includes('\u200D')
    || value.includes('\uFEFF');

export const toVisibleSnippet = (value = '', limit = 160) => {
    if (typeof value !== 'string') {
        return value;
    }

    const visible = revealInvisibleCharacters(value);
    return visible.length > limit ? `${visible.slice(0, limit)}...[truncated]` : visible;
};

const charAtOrEmpty = (value, index) => {
    if (index < 0 || index >= value.length) {
        return '';
    }
    return revealInvisibleCharacters(value[index]);
};

export const describeMarkdownStrongMarkers = (value = '') => {
    if (typeof value !== 'string' || value.length === 0) {
        return [];
    }

    const markers = [];

    for (const match of value.matchAll(STRONG_MARKER_PATTERN)) {
        const [raw, marker, content] = match;
        const start = match.index ?? 0;
        const end = start + raw.length;

        markers.push({
            marker,
            raw,
            content,
            visibleContent: revealInvisibleCharacters(content),
            start,
            end,
            hasLeadingInnerSpace: /^\s/u.test(content),
            hasTrailingInnerSpace: /\s$/u.test(content),
            hasInvisibleCharacters: hasInvisibleCharacters(content),
            previousChar: charAtOrEmpty(value, start - 1),
            nextChar: charAtOrEmpty(value, end),
            context: toVisibleSnippet(value.slice(Math.max(0, start - 24), Math.min(value.length, end + 24)), 120),
        });
    }

    return markers;
};

export const describeNeedleContexts = (value = '', needles = [], radius = 32) => {
    if (typeof value !== 'string' || value.length === 0) {
        return [];
    }

    return needles
        .filter((needle) => typeof needle === 'string' && needle.length > 0)
        .map((needle) => {
            const index = value.indexOf(needle);
            if (index === -1) {
                return {
                    needle,
                    found: false,
                };
            }

            return {
                needle,
                found: true,
                index,
                context: toVisibleSnippet(
                    value.slice(Math.max(0, index - radius), Math.min(value.length, index + needle.length + radius)),
                    radius * 2 + needle.length,
                ),
            };
        });
};

export const describeFenceMarkers = (value = '') => {
    if (typeof value !== 'string' || value.length === 0) {
        return [];
    }

    const lines = value.split('\n');

    return lines.flatMap((line, index) => {
        const match = line.match(/^(```+)(.*)$/);
        if (!match) {
            return [];
        }

        return [{
            raw: line,
            marker: match[1],
            info: match[2].trim(),
            line: index + 1,
            previousLine: index > 0 ? revealInvisibleCharacters(lines[index - 1]) : '',
            nextLine: index + 1 < lines.length ? revealInvisibleCharacters(lines[index + 1]) : '',
            context: toVisibleSnippet(
                lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join('\n'),
                240,
            ),
        }];
    });
};
