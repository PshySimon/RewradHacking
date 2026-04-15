import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const alignModuleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorAlign.js'),
).href;
const luteBundle = fs.readFileSync(
    path.resolve(__dirname, '../public/vendor/vditor/dist/js/lute/lute.min.js'),
    'utf8',
);

const loadLute = () => {
    globalThis.window = globalThis;
    globalThis.self = globalThis;
    if (!globalThis.Lute) {
        globalThis.eval(luteBundle);
    }
    return globalThis.Lute;
};

test('upsertAlignmentMarker adds and removes persisted paragraph markers', async () => {
    const { upsertAlignmentMarker } = await import(alignModuleUrl);

    const centered = upsertAlignmentMarker('<p>hello</p>', 'center');
    const restored = upsertAlignmentMarker(centered, 'left');

    assert.equal(centered, '<p>[rh-align=center]hello</p>');
    assert.equal(restored, '<p>hello</p>');
});

test('upsertAlignmentMarker preserves explicit left alignment for math-only paragraphs', async () => {
    const { upsertAlignmentMarker } = await import(alignModuleUrl);

    const left = upsertAlignmentMarker('<p><span class="language-math">m=2</span></p>', 'left');

    assert.equal(left, '<p>[rh-align=left]<span class="language-math">m=2</span></p>');
});

test('transformAlignedBlockHtml strips persisted marker and applies alignment class', async () => {
    const { transformAlignedBlockHtml } = await import(alignModuleUrl);

    const transformed = transformAlignedBlockHtml('<p>[rh-align=right]hello</p>');

    assert.equal(transformed, '<p class="vditor-align--right" data-rh-align="right">hello</p>');
    assert.doesNotMatch(transformed, /\[rh-align=right\]/);
});

test('transformAlignedBlockHtml lets explicit left alignment override math-only auto centering', async () => {
    const { transformAlignedBlockHtml } = await import(alignModuleUrl);

    const transformed = transformAlignedBlockHtml('<p>[rh-align=left]<span class="language-math">m=2</span></p>');

    assert.equal(transformed, '<p><span class="language-math">m=2</span></p>');
});

test('transformAlignedBlockHtml centers paragraph whose only content is inline math', async () => {
    const { transformAlignedBlockHtml } = await import(alignModuleUrl);

    const transformed = transformAlignedBlockHtml('<p><span class="language-math">m=2</span></p>');

    assert.equal(transformed, '<p class="vditor-align--center"><span class="language-math">m=2</span></p>');
});

test('transformAlignedBlockHtml centers display math blocks', async () => {
    const { transformAlignedBlockHtml } = await import(alignModuleUrl);

    const transformed = transformAlignedBlockHtml('<div class="language-math">m=2</div>');

    assert.equal(transformed, '<div class="language-math vditor-align--center">m=2</div>');
});

test('transformAlignedBlockHtml does not center paragraphs with text around math', async () => {
    const { transformAlignedBlockHtml } = await import(alignModuleUrl);

    const transformed = transformAlignedBlockHtml('<p>坡度为 <span class="language-math">m=2</span>。</p>');

    assert.equal(transformed, '<p>坡度为 <span class="language-math">m=2</span>。</p>');
});

test('transformAlignedBlockHtml does not center paragraphs with extra inline elements around math', async () => {
    const { transformAlignedBlockHtml } = await import(alignModuleUrl);

    const transformed = transformAlignedBlockHtml('<p><span class="language-math">m=2</span><span>。</span></p>');

    assert.equal(transformed, '<p><span class="language-math">m=2</span><span>。</span></p>');
});

test('hidden editor marker survives Vditor IR markdown serialization', () => {
    const lute = loadLute().New();
    const html = '<p data-block="0"><span class="vditor-align-marker" contenteditable="false">[rh-align=center]</span>hello</p>';

    assert.equal(lute.VditorIRDOM2Md(html), '[rh-align=center]hello\n');
});
