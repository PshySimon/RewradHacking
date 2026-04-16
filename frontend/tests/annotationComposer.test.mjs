import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/annotationComposer.js'),
).href;

test('getAnnotationHotzoneWidth covers the full space from content edge to viewport edge', async () => {
    const { getAnnotationHotzoneWidth } = await import(moduleUrl);

    assert.equal(getAnnotationHotzoneWidth({ lineRight: 900, viewportWidth: 1440, margin: 24 }), 516);
    assert.equal(getAnnotationHotzoneWidth({ lineRight: 1260, viewportWidth: 1280, margin: 12 }), 12);
});

test('clampAnnotationComposerPosition prefers opening left of the click and stays within viewport', async () => {
    const { clampAnnotationComposerPosition } = await import(moduleUrl);

    const pos = clampAnnotationComposerPosition({
        pointerX: 1180,
        pointerY: 420,
        viewportWidth: 1280,
        viewportHeight: 900,
    });

    assert.equal(pos.popupWidth, 360);
    assert.equal(pos.x, 808);
    assert.equal(pos.y, 186);
    assert.equal(pos.popupHeight, 468);
});

test('clampAnnotationComposerPosition falls back to the right side when left space is insufficient', async () => {
    const { clampAnnotationComposerPosition } = await import(moduleUrl);

    const pos = clampAnnotationComposerPosition({
        pointerX: 120,
        pointerY: 160,
        viewportWidth: 1280,
        viewportHeight: 900,
    });

    assert.equal(pos.x, 132);
    assert.equal(pos.y, 12);
});

test('clampAnnotationComposerPosition opens above the click in the lower half of the viewport', async () => {
    const { clampAnnotationComposerPosition } = await import(moduleUrl);

    const pos = clampAnnotationComposerPosition({
        pointerX: 1180,
        pointerY: 820,
        viewportWidth: 1280,
        viewportHeight: 900,
    });

    assert.equal(pos.x, 808);
    assert.equal(pos.y, 388);
    assert.equal(pos.popupHeight, 500);
});

test('clampAnnotationComposerPosition uses the real available vertical space on short viewports', async () => {
    const { clampAnnotationComposerPosition } = await import(moduleUrl);

    const pos = clampAnnotationComposerPosition({
        pointerX: 1203,
        pointerY: 252,
        viewportWidth: 1392,
        viewportHeight: 481,
    });

    assert.equal(pos.x, 831);
    assert.equal(pos.y, 132);
    assert.equal(pos.popupHeight, 240);
});

test('insertAnnotationEmoji places plain-text emoji at the current selection', async () => {
    const { insertAnnotationEmoji } = await import(moduleUrl);

    const next = insertAnnotationEmoji({
        value: 'Hello world',
        selectionStart: 5,
        selectionEnd: 5,
        emoji: '🔥',
    });

    assert.deepEqual(next, {
        value: 'Hello🔥 world',
        selectionStart: 7,
        selectionEnd: 7,
    });
});

test('getAnnotationHotzoneLayout anchors the hotzone to the article root edge instead of shrinking content width', async () => {
    const { getAnnotationHotzoneLayout } = await import(moduleUrl);

    const layout = getAnnotationHotzoneLayout({
        rootRect: { top: 100, right: 900, width: 760 },
        blockRect: { top: 148, height: 42 },
        viewportWidth: 1440,
        margin: 24,
    });

    assert.deepEqual(layout, {
        left: 593,
        top: 48,
        width: 683,
        height: 42,
    });
});

test('buildAnnotationPreview returns a compact preview for the hotzone and tracks remaining count', async () => {
    const { buildAnnotationPreview } = await import(moduleUrl);

    const preview = buildAnnotationPreview([
        { content: '这是第一条比较长的批注内容，需要被截断展示' },
        { content: '第二条批注' },
        { content: '第三条批注' },
    ], 12);

    assert.deepEqual(preview, {
        previewText: '这是第一条比较长的批注内…',
        extraCount: 2,
        totalCount: 3,
    });
});

test('buildAnnotationQuotePreview truncates the quoted line to 20 characters with ellipsis', async () => {
    const { buildAnnotationQuotePreview } = await import(moduleUrl);

    assert.equal(buildAnnotationQuotePreview('短句', 20), '短句');
    assert.equal(
        buildAnnotationQuotePreview('二、 相对位置编码（Relative PE）的崛起（当前主流）', 20),
        '二、 相对位置编码（Relative P…',
    );
});

test('createAnnotationLineKey prefers visual-line anchors and falls back to legacy line indexes', async () => {
    const { createAnnotationLineKey } = await import(moduleUrl);

    assert.equal(
        createAnnotationLineKey({
            blockAnchor: 'block-3',
            textStart: 8,
            textEnd: 16,
            legacyLineIndex: 2,
        }),
        'block:block-3:8:16',
    );
    assert.equal(
        createAnnotationLineKey({
            legacyLineIndex: 7,
        }),
        'legacy:7',
    );
});

test('resolveAnnotationAnchor prefers block anchor overlap before falling back to legacy line index', async () => {
    const { resolveAnnotationAnchor } = await import(moduleUrl);

    const visualLines = [
        { key: 'block:block-1:0:8', blockAnchor: 'block-1', textStart: 0, textEnd: 8, legacyLineIndex: 1 },
        { key: 'block:block-1:8:16', blockAnchor: 'block-1', textStart: 8, textEnd: 16, legacyLineIndex: 1 },
        { key: 'legacy:2', blockAnchor: 'block-2', textStart: 0, textEnd: 12, legacyLineIndex: 2 },
    ];

    assert.equal(
        resolveAnnotationAnchor({
            block_anchor: 'block-1',
            block_text_start: 9,
            block_text_end: 12,
            line_index: 99,
        }, visualLines)?.key,
        'block:block-1:8:16',
    );

    assert.equal(
        resolveAnnotationAnchor({
            line_index: 2,
        }, visualLines)?.key,
        'legacy:2',
    );
});

test('createVisualLineCacheKey fingerprints a block by anchor, text, and rendered width', async () => {
    const { createVisualLineCacheKey } = await import(moduleUrl);

    assert.equal(
        createVisualLineCacheKey({
            blockAnchor: 'block-7',
            text: '这是一段文本',
            width: 742.4,
        }),
        'block-7::742::这是一段文本',
    );
});

test('reuseCachedVisualLines returns cached lines only when the fingerprint still matches', async () => {
    const { reuseCachedVisualLines } = await import(moduleUrl);

    const cached = [
        { key: 'block:block-7:0:8', blockAnchor: 'block-7', textStart: 0, textEnd: 8 },
    ];
    const cache = new Map([
        ['block-7', { fingerprint: 'block-7::742::这是一段文本', lines: cached }],
    ]);

    assert.equal(
        reuseCachedVisualLines({
            cache,
            blockAnchor: 'block-7',
            fingerprint: 'block-7::742::这是一段文本',
        }),
        cached,
    );
    assert.equal(
        reuseCachedVisualLines({
            cache,
            blockAnchor: 'block-7',
            fingerprint: 'block-7::640::这是一段文本',
        }),
        null,
    );
});

test('groupMeasuredCharacterRects keeps inline math glyphs on the same visual line when their boxes overlap vertically', async () => {
    const { groupMeasuredCharacterRects } = await import(moduleUrl);

    const groups = groupMeasuredCharacterRects([
        {
            top: 100,
            bottom: 122,
            left: 10,
            right: 18,
            textStart: 0,
            textEnd: 1,
        },
        {
            top: 104,
            bottom: 120,
            left: 19,
            right: 27,
            textStart: 1,
            textEnd: 2,
        },
        {
            top: 102,
            bottom: 118,
            left: 28,
            right: 36,
            textStart: 2,
            textEnd: 3,
        },
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].textStart, 0);
    assert.equal(groups[0].textEnd, 3);
});

test('groupMeasuredCharacterRects still splits truly separate visual lines', async () => {
    const { groupMeasuredCharacterRects } = await import(moduleUrl);

    const groups = groupMeasuredCharacterRects([
        {
            top: 100,
            bottom: 122,
            left: 10,
            right: 18,
            textStart: 0,
            textEnd: 1,
        },
        {
            top: 136,
            bottom: 158,
            left: 12,
            right: 20,
            textStart: 1,
            textEnd: 2,
        },
    ]);

    assert.equal(groups.length, 2);
});
