import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/markdownText.js'),
).href;

test('markdownText.toPlainText removes inline strong emphasis in Chinese text', async () => {
    const { toPlainText } = await import(moduleUrl);
    const src = 'dropout 会随机丢失维度信息，**为什么需要position embedding？** 对模型很关键。';
    const plain = toPlainText(src);
    assert.equal(plain, 'dropout 会随机丢失维度信息，为什么需要position embedding？ 对模型很关键。');
});

test('markdownText.toPlainText removes fenced code blocks for card previews', async () => {
    const { toPlainText } = await import(moduleUrl);
    const src = [
        '先说一句',
        '```python',
        'def foo():',
        '    return 1',
        '```',
        '再说一句',
    ].join('\n');
    const plain = toPlainText(src);
    assert.equal(plain.includes('def foo()'), false);
    assert.equal(plain.startsWith('先说一句'), true);
    assert.equal(plain.endsWith('再说一句'), true);
});

test('markdownText.toPlainText removes Vditor rendering marker spans', async () => {
    const { toPlainText } = await import(moduleUrl);
    const src = '<p><span class="vditor-ir__marker vditor-ir__marker--bi">**</span><span class="vditor-ir__node">适应这种随机丢失</span><span class="vditor-ir__marker vditor-ir__marker--bi">**</span> from training</p>';
    const plain = toPlainText(src);
    assert.equal(plain, '适应这种随机丢失 from training');
});

test('markdownText.markdownExcerpt strips emphasis and trims by max length', async () => {
    const { markdownExcerpt } = await import(moduleUrl);
    const src = `这是**非常重要**的解释，强调**概念**，为了卡片展示会保留部分：${'内容'.repeat(80)}`;
    const excerpt = await markdownExcerpt(src, 20);
    assert.equal(excerpt.includes('**'), false);
    assert.equal(excerpt.length <= 23, true);
    assert.equal(excerpt.endsWith('...'), true);
});
