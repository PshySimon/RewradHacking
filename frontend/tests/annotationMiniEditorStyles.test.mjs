import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '../src/index.css');

test('annotation mini editor uses compact size and smaller type than the comment editor', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.mac-annotation-editor-shell #annotation-mini-editor[\s\S]*?min-height:\s*88px\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell \.vditor-ir[\s\S]*?min-height:\s*44px\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell \.vditor-reset[\s\S]*?font-size:\s*14px\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell \.vditor-ir__placeholder[\s\S]*?font-size:\s*14px\s*!important;/);
});
