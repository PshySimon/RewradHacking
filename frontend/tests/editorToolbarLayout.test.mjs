import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '../src/index.css');

test('main editor toolbar wraps instead of forcing horizontal scrolling', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /^\.vditor-toolbar\s*\{[^}]*flex-wrap:\s*wrap\s*!important;/m);
    assert.match(css, /^\.vditor-toolbar\s*\{[^}]*overflow:\s*visible\s*!important;/m);
});

test('main editor toolbar items stay fixed-width flex items so hover tooltips can anchor correctly', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /^\.vditor-toolbar__item\s*\{[^}]*flex:\s*0 0 auto\s*!important;/m);
    assert.match(css, /^\.vditor-toolbar__item\s*\{[^}]*position:\s*relative\s*!important;/m);
});
