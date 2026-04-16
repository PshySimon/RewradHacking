import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '../src/index.css');

test('comment toolbar keeps higher stacking than editor content', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.mac-comment-trigger \.vditor-toolbar,[\s\S]*?z-index:\s*20\s*!important;/);
    assert.match(css, /\.mac-comment-trigger \.vditor-toolbar,[\s\S]*?overflow:\s*visible\s*!important;/);
    assert.match(css, /\.mac-comment-trigger \.vditor-content,[\s\S]*?z-index:\s*1\s*!important;/);
});

test('comment toolbar suppresses sticky tooltips on focus and active state', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.mac-comment-trigger \.vditor-tooltipped:focus::before,[\s\S]*?display:\s*none\s*!important;/);
    assert.match(css, /\.mac-comment-trigger \.vditor-tooltipped:focus::after,[\s\S]*?display:\s*none\s*!important;/);
});

test('emoji panel reserves preview tail space before hover so the panel height stays stable', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.mac-comment-trigger \.vditor-emojis__tail,[\s\S]*?min-height:\s*18px\s*!important;/);
    assert.match(css, /\.mac-comment-trigger \.vditor-emojis__tip:empty::before,[\s\S]*?content:\s*'\\00a0'\s*!important;/);
});
