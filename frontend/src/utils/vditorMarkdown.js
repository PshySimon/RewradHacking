const EMPTY_FORMATTED_HTML_PATTERN = /(\*\*|__)\s*<([a-zA-Z][\w-]*)\b[^>]*>\s*<\/\2>\s*\1/g;
const ORPHAN_BOLD_MARKER_PATTERN = /(^|[\s\u3002\uff0c\uff1a:;,.!?！？])(\*\*\*\*|____)(?=(<|[\u4E00-\u9FFFA-Za-z0-9]))/gu;
const CALLOUT_OPEN_PATTERN = /^:::(danger|info|note|tip|warning)(?:\s+.*)?$/i;
const CALLOUT_CLOSE_PATTERN = /^:::\s*$/i;

const stripEmptyFormattedHtml = (line) => {
    let normalized = line;

    while (EMPTY_FORMATTED_HTML_PATTERN.test(normalized)) {
        normalized = normalized.replace(EMPTY_FORMATTED_HTML_PATTERN, '');
    }

    return normalized;
};

const stripOrphanBoldMarkers = (line) => line.replace(
    ORPHAN_BOLD_MARKER_PATTERN,
    (_, prefix) => prefix,
);

const isFenceMarker = (line) => /^\s*```/.test(line);

const isBrokenMathBlockStart = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('$') || trimmed.startsWith('$$')) {
        return false;
    }

    return !trimmed.slice(1).includes('$');
};

const isBrokenMathBlockEnd = (line) => {
    const trimmed = line.trim();
    return trimmed === '$' || trimmed === '\\$' || trimmed === '\\ $';
};

const isMathBlockMarker = (line) => line.trim() === '$$';

const normalizeMathBody = (lines) => {
    const normalizedLines = lines
        .map((bodyLine) => stripOrphanBoldMarkers(stripEmptyFormattedHtml(bodyLine)));

    while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1].trim() === '\\') {
        normalizedLines.pop();
    }

    return normalizedLines.join('\n').trim();
};

const countNonEmptyLines = (value) => value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .length;

const trimMalformedBoldSpacingInLine = (line) => line
    .replace(/^(\s*(?:[-+*]|\d+\.)?\s*)(\*\*|__)\s+([^*\n](?:.*?[^*\n])?)\s+\2(?=\S)/, '$1$2$3$2 ')
    .replace(/^(\s*(?:[-+*]|\d+\.)?\s*)(\*\*|__)\s+([^*\n](?:.*?[^*\n])?)\s+\2/, '$1$2$3$2')
    .replace(/^(\s*(?:[-+*]|\d+\.)?\s*(?:\*\*|__)[^*\n]+(?:\*\*|__))(?=\S)/, '$1 ');

const normalizeCalloutBlocks = (text = '') => {
    const lines = text.split('\n');
    const normalized = [];
    let inFence = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        if (isFenceMarker(line)) {
            inFence = !inFence;
            normalized.push(line);
            continue;
        }

        normalized.push(line);

        if (inFence || !CALLOUT_OPEN_PATTERN.test(line.trim())) {
            continue;
        }

        const nextLine = lines[index + 1];
        if (typeof nextLine === 'string' && nextLine.trim() !== '' && !CALLOUT_CLOSE_PATTERN.test(nextLine.trim())) {
            normalized.push('');
        }
    }

    return normalized.join('\n');
};

export const normalizePastedVditorMarkdown = (text = '') => normalizeCalloutBlocks(
    text
        .split('\n')
        .map((line) => trimMalformedBoldSpacingInLine(line))
        .join('\n'),
);

export const normalizeVditorMarkdown = (text = '') => {
    const lines = text.split('\n');
    const normalized = [];
    let inFence = false;

    for (let i = 0; i < lines.length; i += 1) {
        const line = stripOrphanBoldMarkers(stripEmptyFormattedHtml(lines[i]));

        if (isFenceMarker(line)) {
            inFence = !inFence;
            normalized.push(line);
            continue;
        }

        if (!inFence && isBrokenMathBlockStart(line)) {
            let endIndex = i + 1;
            while (endIndex < lines.length) {
                if (isFenceMarker(lines[endIndex])) {
                    break;
                }
                if (lines[endIndex].trim() === '\\' && endIndex + 1 < lines.length && isBrokenMathBlockEnd(lines[endIndex + 1])) {
                    break;
                }
                if (isBrokenMathBlockEnd(lines[endIndex])) {
                    break;
                }
                endIndex += 1;
            }

            const hasSplitBackslashCloser = endIndex + 1 < lines.length
                && lines[endIndex].trim() === '\\'
                && isBrokenMathBlockEnd(lines[endIndex + 1]);

            if (endIndex < lines.length && (isBrokenMathBlockEnd(lines[endIndex]) || hasSplitBackslashCloser)) {
                const firstLine = line.replace(/^\s*\$\s?/, '');
                const body = normalizeMathBody([firstLine, ...lines.slice(i + 1, endIndex)]);

                if (countNonEmptyLines(body) <= 1) {
                    normalized.push(`$ ${body} $`);
                } else {
                    normalized.push('$$');
                    normalized.push(body);
                    normalized.push('$$');
                }
                i = hasSplitBackslashCloser ? endIndex + 1 : endIndex;
                continue;
            }
        }

        if (!inFence && isMathBlockMarker(line)) {
            let endIndex = i + 1;
            while (endIndex < lines.length && !isMathBlockMarker(lines[endIndex])) {
                endIndex += 1;
            }

            if (endIndex < lines.length) {
                const body = normalizeMathBody(lines.slice(i + 1, endIndex));
                if (countNonEmptyLines(body) <= 1) {
                    normalized.push(`$ ${body} $`);
                } else {
                    normalized.push('$$');
                    normalized.push(body);
                    normalized.push('$$');
                }
                i = endIndex;
                continue;
            }
        }

        normalized.push(line);
    }

    return normalizeCalloutBlocks(normalized.join('\n'));
};
