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
    assert.match(source, /resolveAnnotationAnchor\(targetAnnotation, visualAnnotationLinesRef\.current\)[\s\S]*preserveFocus:\s*true/);
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

test('ArticleDetail captures the current visual line when wiring hotzone click handlers', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /marker\.dataset\.annotationKey = markerKey/);
    assert.match(source, /marker\.dataset\.annotationLine = String\(lineIndex\)/);
    assert.match(source, /openAnnotationBubbleForLine\(\{\s*line,/);
    assert.match(source, /findNearestMeasuredLine\(lines, event\.clientY\)/);
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

test('ArticleDetail submits and resolves visual-line anchors in addition to legacy line indexes', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /block_anchor:/);
    assert.match(source, /block_text_start:/);
    assert.match(source, /block_text_end:/);
    assert.match(source, /quote_text:/);
    assert.match(source, /resolveAnnotationAnchor/);
    assert.match(source, /measureVisualLines/);
});

test('ArticleDetail uses viewport-driven lazy parsing instead of rebuilding all visual lines on scroll', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /new IntersectionObserver\(/);
    assert.match(source, /visualLineCacheRef/);
    assert.match(source, /pendingMeasureBlocksRef/);
    assert.doesNotMatch(source, /window\.addEventListener\('scroll',[\s\S]*buildLineAnnotationAnchors\(\)/);
});

test('ArticleDetail measures a block on demand for hotzone clicks and hash-focused annotations', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /ensureVisualLinesForBlock/);
    assert.match(source, /ensureVisualLinesForAnnotation/);
    assert.match(source, /findNearestMeasuredLine/);
});

test('ArticleDetail suppresses preview chips for unparsed block-level fallback hotzones until visual lines are measured', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /const preview = allowPreview \? buildAnnotationPreview\(rootPreviewAnnotations\) : null/);
    assert.match(source, /markerKey:\s*`block:\$\{record\.blockAnchor\}`[\s\S]*allowPreview:\s*false/);
    assert.match(source, /markerKey:\s*line\.key[\s\S]*allowPreview:\s*true/);
    assert.match(source, /const markerLabel = !allowPreview && !allowHoverHighlight\s*\?\s*'添加批注'/);
});

test('ArticleDetail eagerly upgrades a fallback block hotzone to visual-line markers on hover', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');

    assert.match(source, /fallbackMarker\.onmouseenter = \(\) => \{/);
    assert.match(source, /ensureVisualLinesForBlock\(record\.blockAnchor\);[\s\S]*renderAnnotationHotzones\(\);/);
});

test('ArticleDetail keeps fallback hotzones visually inert until the block is parsed into visual lines', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(source, /marker\.classList\.toggle\('mac-line-annotation-btn--fallback', !allowHoverHighlight\)/);
    assert.match(source, /allowHoverHighlight:\s*false/);
    assert.match(css, /\.mac-line-annotation-btn--fallback:hover\s*\{[\s\S]*background:\s*transparent;/);
});

test('ArticleDetail hides the annotation overlay during active scrolling and redraws it after scroll idle', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(source, /const annotationHotzoneScrollTimeoutRef = useRef\(0\)/);
    assert.match(source, /const annotationHotzoneScrollingRef = useRef\(false\)/);
    assert.match(source, /setAnnotationHotzoneOverlayVisible\(false\);/);
    assert.match(source, /if \(annotationHotzoneScrollingRef\.current\) \{\s*return;\s*\}/);
    assert.match(source, /Array\.from\(pendingMeasureBlocksRef\.current\)\.slice\(0,\s*2\)/);
    assert.match(source, /annotationHotzoneScrollTimeoutRef\.current = window\.setTimeout\(\(\) => \{[\s\S]*renderAnnotationHotzones\(\);[\s\S]*setAnnotationHotzoneOverlayVisible\(true\);[\s\S]*120\)/);
    assert.match(css, /\.mac-annotation-hotzone-overlay--hidden\s*\{[\s\S]*opacity:\s*0;/);
});
