import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '../src/index.css');

test('comment toolbar keeps higher stacking than editor content without forcing panel top offsets', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.mac-comment-trigger \.vditor-toolbar,[\s\S]*?z-index:\s*20\s*!important;/);
    assert.match(css, /\.mac-comment-trigger \.vditor-content,[\s\S]*?z-index:\s*1\s*!important;/);
    assert.doesNotMatch(css, /\.mac-comment-trigger \.vditor-toolbar__item > \.vditor-panel/);
});
