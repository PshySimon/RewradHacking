import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorPath = path.resolve(__dirname, '../src/pages/Editor.jsx');

test('Editor installs and cleans up Vditor table insert handles in the main editor only', () => {
    const source = fs.readFileSync(editorPath, 'utf8');

    assert.match(source, /installTableInsertHandles/);
    assert.match(source, /const cleanupTableInsertHandles = installTableInsertHandles\(vditor\);/);
    assert.match(source, /vditor\.__cleanupTableInsertHandles = cleanupTableInsertHandles;/);
    assert.match(source, /if \(vditor\.__cleanupTableInsertHandles\) vditor\.__cleanupTableInsertHandles\(\);/);
});
