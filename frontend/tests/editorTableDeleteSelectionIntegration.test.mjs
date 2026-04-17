import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorPath = path.resolve(__dirname, '../src/pages/Editor.jsx');

test('Editor installs and cleans up Vditor table delete selection in the main editor only', () => {
    const source = fs.readFileSync(editorPath, 'utf8');

    assert.match(source, /installTableDeleteSelection/);
    assert.match(source, /const cleanupTableDeleteSelection = installTableDeleteSelection\(vditor\);/);
    assert.match(source, /vditor\.__cleanupTableDeleteSelection = cleanupTableDeleteSelection;/);
    assert.match(source, /if \(vditor\.__cleanupTableDeleteSelection\) vditor\.__cleanupTableDeleteSelection\(\);/);
});
