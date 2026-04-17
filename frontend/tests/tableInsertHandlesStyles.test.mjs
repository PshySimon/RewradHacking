import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '../src/index.css');

test('table insert handles use pointer hit zones, thicker active lines, and midpoint circular arrows', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.vditor-table-insert-hitzone\s*\{[\s\S]*cursor:\s*pointer;/);
    assert.match(css, /\.vditor-table-insert-line--active\s*\{[\s\S]*background:\s*#0071E3;/);
    assert.match(css, /\.vditor-table-insert-line--active\s*\{[\s\S]*box-shadow:/);
    assert.match(css, /\.vditor-table-insert-triangle\s*\{[\s\S]*width:\s*20px;/);
    assert.match(css, /\.vditor-table-insert-triangle\s*\{[\s\S]*height:\s*20px;/);
    assert.match(css, /\.vditor-table-insert-triangle\s*\{[\s\S]*background:\s*#0071E3;/);
    assert.match(css, /\.vditor-table-insert-triangle\s*\{[\s\S]*border-radius:\s*50%;/);
    assert.match(css, /\.vditor-table-insert-triangle\s*\{[\s\S]*border:\s*2px solid #FFFFFF;/);
    assert.match(css, /\.vditor-table-insert-triangle::before\s*\{[\s\S]*border-top:\s*2px solid #FFFFFF;/);
    assert.match(css, /\.vditor-table-insert-triangle::before\s*\{[\s\S]*border-right:\s*2px solid #FFFFFF;/);
    assert.match(css, /\.vditor-table-insert-triangle--left,[\s\S]*\.vditor-table-insert-triangle--down\s*\{[\s\S]*transform:\s*translate\(-50%, -50%\) scale\(0\.85\);/);
    assert.match(css, /\.vditor-table-insert-triangle--active\s*\{[\s\S]*transform:\s*translate\(-50%, -50%\) scale\(1\);/);
});
