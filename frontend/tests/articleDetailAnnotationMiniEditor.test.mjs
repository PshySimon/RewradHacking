import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, '../src/pages/ArticleDetail.jsx');
const cssPath = path.resolve(__dirname, '../src/index.css');

test('ArticleDetail uses a mini Vditor annotation editor with emoji-only toolbar', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /buildCommentEditorOptions\(\{\s*toolbar:\s*\['emoji'\]/);
    assert.doesNotMatch(source, /mac-annotation-emoji-trigger/);
    assert.doesNotMatch(source, /\}, \[initialValue, onInstanceReady, onValueChange\]\);/);
    assert.match(source, /useEffect\(\(\) => \{[\s\S]*?new Vditor\(hostId,/);
    assert.match(source, /const isAnnotationEditorReadyRef = useRef\(false\)/);
    assert.match(source, /if \(!vditor \|\| !isAnnotationEditorReadyRef\.current \|\| typeof vditor\.getValue !== 'function'\)/);
});

test('ArticleDetail applies compact annotation editor sizing and typography overrides', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(source, /minHeight:\s*'96px'/);
    assert.match(source, /annotation\.author_avatar \|\| \(annotation\.author_nickname \|\| annotation\.author_username \|\| 'U'\)\[0\]\.toUpperCase\(\)/);
    assert.match(source, /reply\.author_avatar \|\| \(reply\.author_nickname \|\| reply\.author_username \|\| 'U'\)\[0\]\.toUpperCase\(\)/);
    assert.match(css, /\.mac-annotation-author\s*\{[\s\S]*position:\s*relative;/);
    assert.match(css, /\.mac-annotation-author\s*\{[\s\S]*margin-left:\s*-10px;/);
    assert.match(css, /\.mac-annotation-author\s*\{[\s\S]*padding-left:\s*30px;/);
    assert.match(css, /\.mac-annotation-avatar\s*\{[\s\S]*position:\s*absolute;/);
    assert.match(css, /\.mac-annotation-avatar\s*\{[\s\S]*left:\s*0;/);
    assert.match(css, /\.mac-annotation-meta\s*\{[\s\S]*align-items:\s*center;/);
    assert.match(css, /\.mac-annotation-composer\s*\{[\s\S]*padding:\s*6px 6px 8px;/);
    assert.match(css, /\.mac-annotation-composer\s*\{[\s\S]*max-height:\s*500px;/);
    assert.match(source, /buildAnnotationQuotePreview\(composerPos\.lineText,\s*20\)/);
    assert.match(css, /\.mac-annotation-composer-line\s*\{[^}]*white-space:\s*nowrap;/);
    assert.match(css, /\.mac-annotation-composer-line\s*\{[^}]*text-overflow:\s*ellipsis;/);
    assert.match(css, /\.mac-annotation-composer-line\s*\{[^}]*flex-shrink:\s*0;/);
    assert.match(css, /\.mac-annotation-thread-panel\s*\{[\s\S]*padding:\s*2px;/);
    assert.match(css, /\.mac-annotation-item\s*\{[\s\S]*padding:\s*6px 8px;/);
    assert.match(css, /\.mac-annotation-thread-toggle[\s\S]*gap:\s*4px;/);
    assert.match(css, /\.mac-annotation-thread-toggle[\s\S]*padding:\s*6px 8px 4px;/);
    assert.match(css, /\.mac-annotation-thread-actions[\s\S]*margin-top:\s*2px;/);
    assert.match(css, /\.mac-annotation-composer-actions[\s\S]*padding-top:\s*2px;/);
    assert.match(css, /\.mac-annotation-composer-actions[\s\S]*padding-bottom:\s*0;/);
    assert.match(css, /\.mac-annotation-composer-actions\s+\.mac-comment-submit[\s\S]*padding:\s*5px 14px;/);
    assert.match(css, /\.mac-annotation-composer-actions\s+\.mac-comment-submit[\s\S]*font-size:\s*12px;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-reset[\s\S]*font-size:\s*14px\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-ir[\s\S]*min-height:\s*56px\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-ir[\s\S]*padding:\s*4px 10px 6px\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-reset[\s\S]*padding-left:\s*0\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-reset\s*>?\s*p[\s\S]*margin:\s*0\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-reset\s*>?\s*p[\s\S]*margin-left:\s*0\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-toolbar[\s\S]*min-height:\s*28px\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-toolbar__item\s*>\s*button[\s\S]*padding:\s*2px\s*!important;/);
    assert.match(css, /\.mac-annotation-editor-shell\s+\.vditor-toolbar__item svg[\s\S]*width:\s*13px\s*!important;/);
});
