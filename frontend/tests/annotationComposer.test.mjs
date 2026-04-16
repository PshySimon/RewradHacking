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

    assert.equal(pos.popupWidth, 320);
    assert.equal(pos.x, 848);
    assert.equal(pos.y, 368);
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
    assert.equal(pos.y, 108);
});

test('clampAnnotationComposerPosition opens above the click in the lower half of the viewport', async () => {
    const { clampAnnotationComposerPosition } = await import(moduleUrl);

    const pos = clampAnnotationComposerPosition({
        pointerX: 1180,
        pointerY: 820,
        viewportWidth: 1280,
        viewportHeight: 900,
    });

    assert.equal(pos.x, 848);
    assert.equal(pos.y, 372);
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

    assert.equal(pos.x, 871);
    assert.equal(pos.y, 64);
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
