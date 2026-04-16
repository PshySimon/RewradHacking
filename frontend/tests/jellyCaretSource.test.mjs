import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jellyCaretPath = path.resolve(__dirname, '../src/components/JellyCaret.jsx');

test('JellyCaret keeps a fixed internal SVG height so the caret is not double-scaled vertically', () => {
    const source = fs.readFileSync(jellyCaretPath, 'utf8');

    assert.match(source, /const renderHeight = 20;/);
    assert.match(source, /const path = `M 0,0 C \$\{midBend\},\$\{renderHeight \* 0\.33\} \$\{midBend\},\$\{renderHeight \* 0\.66\} 0,\$\{renderHeight\}`;/);
    assert.match(source, /svg\.style\.height = `\$\{h\}px`;/);
});
