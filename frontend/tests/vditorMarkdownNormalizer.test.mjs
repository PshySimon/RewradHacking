import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorMarkdown.js'),
).href;

const noisySample = String.raw`+ <font style="color:rgb(25, 27, 31);">两个</font>**<font style="color:rgb(25, 27, 31);">位置向量的内积只和相对位置 k 有关</font>**<font style="color:rgb(25, 27, 31);">。</font>**<font style="color:rgb(25, 27, 31);"></font>**<font style="color:rgb(25, 27, 31);">证明如下：</font>

$ PE(t) \cdot PE(t + k) =\sum_{i=0}^{d/2-1} PE(t, 2i) PE(t + k, 2i) + \sum_{i=0}^{d/2-1} PE(t, 2i+1) PE(t + k, 2i+1)
\ $
`;

test('normalizeVditorMarkdown removes empty strong wrappers around empty font tags', async () => {
    const { normalizeVditorMarkdown } = await import(moduleUrl);

    const normalized = normalizeVditorMarkdown(noisySample);

    assert.doesNotMatch(normalized, /\*\*<font[^>]*><\/font>\*\*/);
    assert.match(normalized, /证明如下：/);
});

test('normalizeVditorMarkdown converts broken single-line dollar math into a clean single-line paragraph formula', async () => {
    const { normalizeVditorMarkdown } = await import(moduleUrl);

    const normalized = normalizeVditorMarkdown(noisySample);

    assert.ok(normalized.includes('$ PE(t) \\cdot PE(t + k) =\\sum_{i=0}^{d/2-1} PE(t, 2i) PE(t + k, 2i) + \\sum_{i=0}^{d/2-1} PE(t, 2i+1) PE(t + k, 2i+1) $'));
    assert.doesNotMatch(normalized, /\n\\ \$\n?/);
    assert.doesNotMatch(normalized, /\n\$\$\nPE\(t\)/);
});

test('normalizeVditorMarkdown removes orphan bold markers and backslash-only math closing lines', async () => {
    const { normalizeVditorMarkdown } = await import(moduleUrl);
    const sample = String.raw`- 两个位置向量的内积只和相对位置 k 有关。****证明如下：

$ PE(t) \cdot PE(t + k) = \sum_i x_i
\
$
`;

    const normalized = normalizeVditorMarkdown(sample);

    assert.doesNotMatch(normalized, /\*\*\*\*证明如下：/);
    assert.match(normalized, /有关。证明如下：/);
    assert.match(normalized, /\n\$ PE\(t\) \\cdot PE\(t \+ k\) = \\sum_i x_i \$/);
    assert.doesNotMatch(normalized, /\n\\\n\$\n?$/);
});

test('normalizeVditorMarkdown preserves valid single-line inline math paragraphs', async () => {
    const { normalizeVditorMarkdown } = await import(moduleUrl);
    const sample = String.raw`$ = \sum_{i=0}^{d/2-1} \sin (t \cdot w_{2i}) $

$ = \sum_{i=0}^{d/2-1} \cos (k \cdot w_{2i}) $`;

    const normalized = normalizeVditorMarkdown(sample);

    assert.equal(normalized, sample);
});

test('normalizeVditorMarkdown strips orphan backslash lines inside existing math blocks', async () => {
    const { normalizeVditorMarkdown } = await import(moduleUrl);
    const sample = String.raw`$$
PE(t) \cdot PE(t + k) =\sum_{i=0}^{d/2-1} x_i
\
$$`;

    const normalized = normalizeVditorMarkdown(sample);

    assert.equal(normalized, String.raw`$ PE(t) \cdot PE(t + k) =\sum_{i=0}^{d/2-1} x_i $`);
});

test('normalizePastedVditorMarkdown trims spaces inside bold markers and separates following body text', async () => {
    const { normalizePastedVditorMarkdown } = await import(moduleUrl);
    const sample = String.raw`+ ** Probing tasks： **一般做法是设计一些简单的分类任务`;

    const normalized = normalizePastedVditorMarkdown(sample);

    assert.equal(normalized, String.raw`+ **Probing tasks：** 一般做法是设计一些简单的分类任务`);
});

test('normalizePastedVditorMarkdown does not cross lines and break previous bold paragraphs', async () => {
    const { normalizePastedVditorMarkdown } = await import(moduleUrl);
    const sample = String.raw`**预训练语言模型**

+ ** Probing tasks： **一般做法是设计一些简单的分类任务
+ ** Visualization： **我们都知道 BERT 是由多层 Transformer 构成的`;

    const normalized = normalizePastedVditorMarkdown(sample);

    assert.equal(normalized, String.raw`**预训练语言模型**

+ **Probing tasks：** 一般做法是设计一些简单的分类任务
+ **Visualization：** 我们都知道 BERT 是由多层 Transformer 构成的`);
});

test('normalizePastedVditorMarkdown inserts a space after closing bold markers in list items', async () => {
    const { normalizePastedVditorMarkdown } = await import(moduleUrl);
    const sample = String.raw`+ **Probing tasks：**一般做法是设计一些简单的分类任务
+ **Visualization：**我们都知道 BERT 是由多层 Transformer 构成的`;

    const normalized = normalizePastedVditorMarkdown(sample);

    assert.equal(normalized, String.raw`+ **Probing tasks：** 一般做法是设计一些简单的分类任务
+ **Visualization：** 我们都知道 BERT 是由多层 Transformer 构成的`);
});

test('normalizePastedVditorMarkdown preserves valid inline bold in prose and canonicalizes callout blocks', async () => {
    const { normalizePastedVditorMarkdown } = await import(moduleUrl);
    const sample = String.raw`:::info
I **do not** like the story of the movie, but I **do** like the cast.
I **do** like the story of the movie, but I **do not** like the cast.

:::`;

    const normalized = normalizePastedVditorMarkdown(sample);

    assert.equal(normalized, String.raw`:::info

I **do not** like the story of the movie, but I **do** like the cast.
I **do** like the story of the movie, but I **do not** like the cast.

:::`);
});

test('normalizeVditorMarkdown canonicalizes callout blocks for IR rendering', async () => {
    const { normalizeVditorMarkdown } = await import(moduleUrl);
    const sample = String.raw`:::warning
line1
line2

:::`;

    const normalized = normalizeVditorMarkdown(sample);

    assert.equal(normalized, String.raw`:::warning

line1
line2

:::`);
});
