import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorPasteInsert.js'),
).href;

test('insertPastedPlainText prefers insertMD so multi-block markdown is fully parsed', async () => {
    const { insertPastedPlainText } = await import(moduleUrl);
    const calls = [];
    const vditor = {
        insertMD(value) {
            calls.push(['insertMD', value]);
        },
        insertValue(value) {
            calls.push(['insertValue', value]);
        },
    };

    insertPastedPlainText(vditor, 'para\n\n```python\nprint(1)\n```\n\n**tail**');

    assert.deepEqual(calls, [['insertMD', 'para\n\n```python\nprint(1)\n```\n\n**tail**']]);
});

test('insertPastedPlainText falls back to insertValue when insertMD is unavailable', async () => {
    const { insertPastedPlainText } = await import(moduleUrl);
    const calls = [];
    const vditor = {
        insertValue(value) {
            calls.push(['insertValue', value]);
        },
    };

    insertPastedPlainText(vditor, '**bold**');

    assert.deepEqual(calls, [['insertValue', '**bold**']]);
});
