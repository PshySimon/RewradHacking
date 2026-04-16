import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '../src/index.css');

test('editor paragraph spacing is tightened so typed paragraphs render closer to pasted soft line breaks', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(
        css,
        /\.mac-vditor-override\s+\.vditor-reset\s+p\s*\{[^}]*margin-top:\s*0\s*!important;[^}]*margin-bottom:\s*6px\s*!important;[^}]*\}/,
    );
});
