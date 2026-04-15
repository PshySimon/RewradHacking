const EMPTY_FORMATTED_HTML_PATTERN = /(\*\*|__)\s*<([a-zA-Z][\w-]*)\b[^>]*>\s*<\/\2>\s*\1/g;
const ORPHAN_BOLD_MARKER_PATTERN = /(^|[\s\u3002\uff0c\uff1a:;,.!?！？])(\*\*\*\*|____)(?=(<|[\u4E00-\u9FFFA-Za-z0-9]))/gu;
const CALLOUT_OPEN_PATTERN = /^:::(danger|info|note|tip|warning)(?:\s+.*)?$/i;
const CALLOUT_CLOSE_PATTERN = /^:::\s*$/i;
const ZERO_WIDTH_CHARACTER_PATTERN = /[\u200B\u200C\u200D\uFEFF]/g;
const BROKEN_MATH_BLOCK_END_PATTERN = /^\\?\s*\$(?<suffix>[,.;:!?。，；：！？、）)\]】》」』]*)$/u;
const VDITOR_MATH_DEBUG_PREFIX = '[VditorMathDebug]';

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

const stripZeroWidthCharacters = (value = '') => value.replace(ZERO_WIDTH_CHARACTER_PATTERN, '');
const revealInvisibleCharacters = (value = '') => value
    .replace(/\u200B/g, '<ZWSP>')
    .replace(/\u200C/g, '<ZWNJ>')
    .replace(/\u200D/g, '<ZWJ>')
    .replace(/\uFEFF/g, '<BOM>');

const toDebugSnippet = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const visibleValue = revealInvisibleCharacters(value);
    return visibleValue.length > 500 ? `${visibleValue.slice(0, 500)}...[truncated]` : visibleValue;
};

const hasZeroWidthCharacters = (value = '') => /[\u200B\u200C\u200D\uFEFF]/u.test(value);

const shouldForceMathDebug = () => {
    try {
        return typeof window !== 'undefined'
            && typeof window.localStorage !== 'undefined'
            && window.localStorage.getItem('rh_vditor_math_debug') === '1';
    } catch {
        return false;
    }
};

export const shouldDebugVditorMath = (value = '') => shouldForceMathDebug()
    || hasZeroWidthCharacters(value)
    || value.includes('$')
    || value.includes('\\frac')
    || value.includes('\\sum')
    || value.includes('\\begin');

export const debugVditorMath = (stage, payload = {}) => {
    if (typeof console === 'undefined' || !console.debug) {
        return;
    }

    console.debug(
        `${VDITOR_MATH_DEBUG_PREFIX} ${stage}`,
        Object.fromEntries(
            Object.entries(payload).map(([key, value]) => [key, toDebugSnippet(value)]),
        ),
    );
};

const isFenceMarker = (line) => /^\s*```/.test(line);

const findSingleDollarIndices = (line) => {
    const indices = [];

    for (let index = 0; index < line.length; index += 1) {
        if (line[index] !== '$') {
            continue;
        }
        if (line[index - 1] === '\\') {
            continue;
        }
        if (line[index - 1] === '$' || line[index + 1] === '$') {
            continue;
        }
        indices.push(index);
    }

    return indices;
};

const looksLikeMathFragment = (fragment) => /[\\^_=]/.test(fragment);

const getBrokenMathBlockStart = (line) => {
    const normalizedLine = stripZeroWidthCharacters(line);
    const trimmed = normalizedLine.trim();
    if (!trimmed.startsWith('$') || trimmed.startsWith('$$')) {
        const singleDollarIndices = findSingleDollarIndices(normalizedLine);
        if (singleDollarIndices.length !== 1) {
            return null;
        }

        const markerIndex = singleDollarIndices[0];
        const body = normalizedLine.slice(markerIndex + 1);
        if (!looksLikeMathFragment(body) || body.includes('$')) {
            return null;
        }

        return {
            prefix: normalizedLine.slice(0, markerIndex),
            body: body.replace(/^\s?/, ''),
        };
    }

    if (trimmed.slice(1).includes('$')) {
        return null;
    }

    const markerIndex = normalizedLine.indexOf('$');
    return {
        prefix: normalizedLine.slice(0, markerIndex),
        body: normalizedLine.slice(markerIndex + 1).replace(/^\s?/, ''),
    };
};

const isBrokenMathBlockEnd = (line) => {
    const trimmed = stripZeroWidthCharacters(line).trim();
    return BROKEN_MATH_BLOCK_END_PATTERN.test(trimmed);
};

const getBrokenMathBlockEndSuffix = (line) => {
    const trimmed = stripZeroWidthCharacters(line).trim();
    return trimmed.match(BROKEN_MATH_BLOCK_END_PATTERN)?.groups?.suffix || '';
};

const isMathBlockMarker = (line) => line.trim() === '$$';

const normalizeMathBody = (lines) => {
    const normalizedLines = lines
        .map((bodyLine) => stripZeroWidthCharacters(stripOrphanBoldMarkers(stripEmptyFormattedHtml(bodyLine))));

    while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1].trim() === '\\') {
        normalizedLines.pop();
    }

    return normalizedLines.join('\n').trim();
};

const countNonEmptyLines = (value) => value
    .split('\n')
    .map((line) => stripZeroWidthCharacters(line).trim())
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

export const normalizePastedMathSegments = (text = '') => {
    if (!text.includes('$')) {
        return text;
    }

    const normalized = text.replace(/\$([\s\S]+?)\$/g, (match, inner) => {
        if (inner.includes('```')) {
            return match;
        }

        const body = normalizeMathBody(inner.split('\n'));
        if (!body) {
            return match;
        }

        const hasMathSymbol = body.includes('\\') || body.includes('_') || body.includes('^');
        const hasBasicOp = body.includes('=') || body.includes('+') || body.includes('-') ||
            body.includes('*') || body.includes('/') || body.includes('<') || body.includes('>');
        const isMath = hasMathSymbol || (inner.includes('\n') && hasBasicOp);

        if (!isMath) {
            return match;
        }

        if (inner.includes('\n')) {
            if (countNonEmptyLines(body) <= 1) {
                return `$ ${body} $`;
            }
            return `$$\n${body}\n$$`;
        }

        return `$${body}$`;
    });

    if (shouldDebugVditorMath(text) || shouldDebugVditorMath(normalized)) {
        debugVditorMath('paste-math:final', {
            changed: normalized !== text ? 'yes' : 'no',
            input: text,
            output: normalized,
        });
    }

    return normalized;
};

export const normalizeVditorMarkdown = (text = '') => {
    const shouldDebug = shouldDebugVditorMath(text);
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

        const brokenMathBlockStart = !inFence ? getBrokenMathBlockStart(line) : null;

        if (brokenMathBlockStart) {
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
                const body = normalizeMathBody([brokenMathBlockStart.body, ...lines.slice(i + 1, endIndex)]);
                const suffix = hasSplitBackslashCloser
                    ? getBrokenMathBlockEndSuffix(lines[endIndex + 1])
                    : getBrokenMathBlockEndSuffix(lines[endIndex]);
                const prefix = brokenMathBlockStart.prefix;
                const closingLine = hasSplitBackslashCloser ? lines[endIndex + 1] : lines[endIndex];

                if (countNonEmptyLines(body) <= 1) {
                    normalized.push(`${prefix}$ ${body} $${suffix}`);
                } else {
                    if (prefix) {
                        normalized.push(prefix);
                    }
                    normalized.push('$$');
                    normalized.push(body);
                    normalized.push('$$');
                    if (suffix) {
                        normalized.push(suffix);
                    }
                }
                if (shouldDebug) {
                    debugVditorMath('normalize:broken-math-repaired', {
                        lineIndex: String(i),
                        startLine: lines[i],
                        closingLine,
                        prefix,
                        normalizedBody: body,
                        suffix,
                    });
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

    const result = normalizeCalloutBlocks(normalized.join('\n'));
    if (shouldDebug) {
        debugVditorMath('normalize:final', {
            changed: result !== text ? 'yes' : 'no',
            input: text,
            output: result,
        });
    }
    return result;
};
