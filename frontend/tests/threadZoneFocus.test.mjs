import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, '../src/components/ThreadZone.jsx');

test('ThreadZone consumes focused comment targets after scrolling to them once', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /export default function ThreadZone\(\{[\s\S]*onFocusCommentConsumed\s*=\s*\(\)\s*=>\s*\{\}/);
    assert.match(source, /targetNode\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\);[\s\S]*onFocusCommentConsumed\(focusCommentId\);/);
});

test('ThreadZone locally focuses newly created comments without mutating the URL', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /const \[localFocusCommentId, setLocalFocusCommentId\] = useState\(''\)/);
    assert.match(source, /const effectiveFocusCommentId = localFocusCommentId \|\| focusCommentId;/);
    assert.match(source, /setLocalFocusCommentId\(res\.data\.id\)/);
    assert.match(source, /if \(effectiveFocusCommentId === focusCommentId\) \{[\s\S]*onFocusCommentConsumed\(focusCommentId\);[\s\S]*\} else \{[\s\S]*setLocalFocusCommentId\(''\);/);
    assert.doesNotMatch(source, /window\.location\.hash\s*=\s*`#comment-/);
});
