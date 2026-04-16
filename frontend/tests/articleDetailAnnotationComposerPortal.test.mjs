import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, '../src/pages/ArticleDetail.jsx');
const cssPath = path.resolve(__dirname, '../src/index.css');

test('ArticleDetail renders the annotation composer through a portal', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /createPortal\s*\(/);
    assert.match(source, /activeComposeLine !== null[\s\S]*createPortal\s*\(/);
});

test('ArticleDetail renders annotation hotzones through a detached overlay instead of widening the markdown stream', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(source, /annotation-hotzone-overlay/);
    assert.doesNotMatch(source, /root\.appendChild\(marker\)/);
    assert.doesNotMatch(css, /\.mac-markdown-stream\s*\{[\s\S]*overflow-x:\s*visible;/);
});

test('ArticleDetail renders annotation previews in the hotzone and keeps the full thread in a separate popup panel', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.doesNotMatch(source, /mac-annotations-zone/);
    assert.match(source, /buildAnnotationPreview/);
    assert.match(source, /mac-line-annotation-btn--has-preview/);
    assert.match(source, /mac-line-annotation-preview/);
    assert.match(source, /mac-annotation-thread-panel/);
    assert.match(source, /targetAnnotation\.line_index[\s\S]*preserveFocus:\s*true/);
    assert.doesNotMatch(css, /\.mac-annotations-zone\s*\{/);
    assert.match(css, /\.mac-line-annotation-preview\s*\{/);
    assert.match(css, /\.mac-annotation-thread-panel\s*\{/);
});

test('ArticleDetail consumes annotation hashes once instead of persisting popup-open state on normal article visits', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.doesNotMatch(source, /window\.location\.hash\s*=\s*`#annotation-/);
    assert.match(source, /window\.history\.replaceState\([\s\S]*location\.pathname\}\$\{location\.search\}`/);
});

test('ArticleDetail distinguishes thread replies from new root annotations and renders recipient context', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /activeReplyParentId/);
    assert.match(source, /reply\.recipient_nickname \|\| reply\.recipient_username/);
    assert.match(source, /setActiveReplyParentId\(annotation\.id\)/);
    assert.match(source, /const \[annotationReplyOverrides, setAnnotationReplyOverrides\] = useState\(\{\}\)/);
    assert.match(source, /const override = annotationReplyOverrides\[item\.id\] \|\| null/);
    assert.match(source, /parent_id:\s*item\.parent_id \|\| override\?\.parent_id \|\| null/);
});

test('ArticleDetail captures the current line index when wiring hotzone click handlers', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /const currentLineIndex = lineIndex;/);
    assert.match(source, /openAnnotationBubbleForLine\(\{\s*lineIndex:\s*currentLineIndex/);
    assert.match(source, /marker\.dataset\.annotationLine = String\(currentLineIndex\)/);
});

test('ArticleDetail keeps thread input neutral until the user explicitly chooses a reply target', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /添加回复/);
    assert.doesNotMatch(source, /回复 @\$\{activeReplyTarget\.author_nickname \|\| activeReplyTarget\.author_username\}/);
    assert.doesNotMatch(source, /<div className="mac-annotation-reply-hint">添加回复<\/div>/);
});

test('ArticleDetail keeps an explicit reply action on every root annotation even when there are multiple roots', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(source, /activeRootAnnotations\.map\(\(annotation\) => \{[\s\S]*className="mac-annotation-root-reply-row"[\s\S]*setActiveReplyParentId\(annotation\.id\)/);
    assert.match(source, /const repliesByRootId = activeReplyAnnotations\.reduce\(/);
    assert.match(source, /const rootId = getAnnotationRootId\(annotation\.id\)/);
    assert.match(source, /const replies = repliesByRootId\[annotation\.id\] \|\| \[\]/);
    assert.match(source, /className="mac-annotation-inline-action mac-annotation-root-reply"/);
    assert.match(css, /\.mac-annotation-root-reply-row\s*\{/);
    assert.match(css, /\.mac-annotation-root-reply\s*\{/);
});

test('ArticleDetail collapses reply threads by default and only expands the focused root when needed', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /const \[expandedAnnotationRoots, setExpandedAnnotationRoots\] = useState\(\{\}\)/);
    assert.match(source, /const isExpanded = Boolean\(expandedAnnotationRoots\[annotation\.id\]\)/);
    assert.match(source, /focusTargetId \? \{ \[getAnnotationRootId\(focusTargetId\)\]: true \} : \{\}/);
    assert.match(source, /replies\.length > 0 && isExpanded \?/);
    assert.match(source, /isExpanded \? '收起回复' : `展开 \${replies\.length} 条回复`/);
});

test('ArticleDetail removes redundant root-level recipient labels, empty-reply copy, and header counters from the annotation popup', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.doesNotMatch(source, /annotation\.parent_id \? '回复' : '写给'/);
    assert.doesNotMatch(source, /暂无回复/);
    assert.doesNotMatch(source, /activeComposeText\.length}\/1200/);
});

test('ArticleDetail adds a visual connector between the preview hotzone and the annotation popup', () => {
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.mac-line-annotation-preview::before\s*\{/);
    assert.match(css, /\.mac-annotation-composer::before\s*\{/);
});

test('ArticleDetail keeps the input panel fixed while only the thread list scrolls', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.doesNotMatch(source, /<div className="mac-annotation-composer-scroll">/);
    assert.match(css, /\.mac-annotation-thread-panel\s*\{[\s\S]*overflow-y:\s*auto;/);
    assert.match(css, /\.mac-annotation-thread-panel\s*\{[\s\S]*min-height:\s*0;/);
    assert.match(css, /\.mac-annotation-thread-panel\s*\{[\s\S]*flex:\s*1 1 auto;/);
    assert.match(css, /\.mac-annotation-thread\s*\{[\s\S]*max-height:\s*none;/);
    assert.match(css, /\.mac-annotation-thread\s*\{[\s\S]*overflow:\s*visible;/);
});

test('ArticleDetail reloads canonical annotations after creating a reply so parent and recipient metadata stay correct', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /const fetchAnnotations = async \(\) => \{/);
    assert.match(source, /await axios\.post\([\s\S]*?await fetchAnnotations\(\);/);
    assert.match(source, /setAnnotationReplyOverrides\(\(prev\) => \(\{[\s\S]*\[res\.data\.id\]:\s*\{/);
    assert.doesNotMatch(source, /setAnnotations\(\(prev\) => \[\.\.\.prev, \{ \.\.\.res\.data, content: next \}\]/);
});
