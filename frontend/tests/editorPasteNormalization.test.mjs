import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, '../src/pages/Editor.jsx');

test('Editor normalizes inserted paste content with pasted-markdown repair during post-insert cleanup', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /const normalizedValue = normalizeVditorMarkdown\(currentValue\);/);
    assert.match(source, /const normalizedPastedValue = normalizePastedVditorMarkdown\(normalizedValue\);/);
    assert.match(source, /if \(normalizedPastedValue !== currentValue\) \{/);
    assert.match(source, /vditor\.setValue\(normalizedPastedValue\);/);
});
