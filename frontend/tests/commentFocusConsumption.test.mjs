import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articleDetailSourcePath = path.resolve(__dirname, '../src/pages/ArticleDetail.jsx');
const codePlaygroundSourcePath = path.resolve(__dirname, '../src/pages/CodePlayground.jsx');

test('ArticleDetail consumes comment hashes after ThreadZone focuses the target comment', () => {
    const source = fs.readFileSync(articleDetailSourcePath, 'utf8');

    assert.match(source, /onFocusCommentConsumed=\{\(\) => \{/);
    assert.match(source, /window\.history\.replaceState\([\s\S]*location\.pathname\}\$\{location\.search\}`/);
    assert.match(source, /setFocusCommentId\(''\);/);
});

test('CodePlayground consumes comment_id query params after ThreadZone focuses the target comment', () => {
    const source = fs.readFileSync(codePlaygroundSourcePath, 'utf8');

    assert.match(source, /onFocusCommentConsumed=\{\(\) => \{/);
    assert.match(source, /const params = new URLSearchParams\(location\.search\);[\s\S]*params\.delete\('comment_id'\);/);
    assert.match(source, /navigate\(\{ search: nextSearch \? `\?\$\{nextSearch\}` : '' \}, \{ replace: true \}\);/);
    assert.match(source, /setFocusCommentId\(''\);/);
});
