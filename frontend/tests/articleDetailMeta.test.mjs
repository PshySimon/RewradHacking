import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, '../src/pages/ArticleDetail.jsx');

test('ArticleDetail shows author before created_at inside the title meta ribbon', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(
        source,
        /<div className="mac-article-meta-right">[\s\S]*?article\.author_name[\s\S]*?article\.created_at/s,
    );
    assert.match(source, /作者：\{article\.author_name \|\| '作者'\}/);
});
