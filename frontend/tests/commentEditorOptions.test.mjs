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
