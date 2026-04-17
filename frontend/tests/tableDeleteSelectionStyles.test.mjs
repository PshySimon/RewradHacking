import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '../src/index.css');

test('table delete selection styles render a rectangle overlay instead of band hitzones', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.vditor-table-delete-selection-overlay\s*\{/);
    assert.match(css, /\.vditor-table-delete-selection-rect\s*\{[\s\S]*position:\s*absolute;/);
    assert.match(css, /\.vditor-table-delete-selection-rect\s*\{[\s\S]*border:/);
    assert.match(css, /\.vditor-table-delete-selection-rect--deletable\s*\{[\s\S]*background:/);
    assert.match(css, /\.vditor-table-delete-selection-rect--static\s*\{[\s\S]*background:/);
    assert.doesNotMatch(css, /\.vditor-table-delete-selection-band\s*\{/);
});
