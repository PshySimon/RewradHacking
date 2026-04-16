import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/commentEditorOptions.js'),
).href;

test('buildCommentEditorOptions keeps editor height auto so emoji panel is not capped by fixed height', async () => {
    const { buildCommentEditorOptions } = await import(moduleUrl);

    const options = buildCommentEditorOptions({
        after: () => {},
    });

    assert.equal(options.height, 'auto');
    assert.equal(options.mode, 'ir');
    assert.equal(options.placeholder, '输入评论...');
    assert.ok(Array.isArray(options.toolbar));
    assert.ok(options.toolbar.includes('emoji'));
    assert.equal(typeof options.after, 'function');
});

test('buildCommentEditorOptions does not attach a hidden global input decoration handler by default', async () => {
    const { buildCommentEditorOptions } = await import(moduleUrl);

    const options = buildCommentEditorOptions();

    assert.equal(options.input, undefined);
});

test('positionCommentToolbarPanel anchors emoji panels above the toolbar button when there is space', async () => {
    const { positionCommentToolbarPanel } = await import(moduleUrl);

    const toolbarItem = {
        getBoundingClientRect: () => ({ top: 140, height: 30.4 }),
    };
    const panel = {
        style: {},
        closest: (selector) => (selector === '.vditor-toolbar__item' ? toolbarItem : null),
        getBoundingClientRect: () => ({ height: 96 }),
        classList: {
            contains: (className) => className === 'vditor-panel--left',
        },
    };

    const positioned = positionCommentToolbarPanel(panel);

    assert.equal(positioned, true);
    assert.equal(panel.style.top, 'auto');
    assert.equal(panel.style.bottom, '36px');
    assert.equal(panel.style.left, 'auto');
    assert.equal(panel.style.right, '0');
});

test('positionCommentToolbarPanel falls back below the toolbar button when there is not enough space above', async () => {
    const { positionCommentToolbarPanel } = await import(moduleUrl);

    const toolbarItem = {
        getBoundingClientRect: () => ({ top: 70, height: 30.4 }),
    };
    const panel = {
        style: {},
        closest: (selector) => (selector === '.vditor-toolbar__item' ? toolbarItem : null),
        getBoundingClientRect: () => ({ height: 96 }),
        classList: {
            contains: () => false,
        },
    };

    const positioned = positionCommentToolbarPanel(panel);

    assert.equal(positioned, true);
    assert.equal(panel.style.top, '36px');
    assert.equal(panel.style.bottom, 'auto');
    assert.equal(panel.style.left, '0');
    assert.equal(panel.style.right, 'auto');
});

test('shouldRepositionCommentToolbarPanel only returns true when visibility signature changes', async () => {
    const { shouldRepositionCommentToolbarPanel } = await import(moduleUrl);

    global.window = {
        getComputedStyle: () => ({ display: 'block' }),
    };

    const root = {};
    const panel = {
        classList: {
            contains: (className) => className === 'vditor-panel--left',
        },
    };

    assert.equal(shouldRepositionCommentToolbarPanel(root, panel), true);
    assert.equal(shouldRepositionCommentToolbarPanel(root, panel), false);

    global.window = {
        getComputedStyle: () => ({ display: 'none' }),
    };
    assert.equal(shouldRepositionCommentToolbarPanel(root, panel), false);

    global.window = {
        getComputedStyle: () => ({ display: 'block' }),
    };
    assert.equal(shouldRepositionCommentToolbarPanel(root, panel), true);
});
