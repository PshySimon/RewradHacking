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

test('normalizeVditorMarkdown repairs broken inline math closed by punctuation after zero-width lines', async () => {
    const { normalizeVditorMarkdown } = await import(moduleUrl);
    const sample = '其中i表示第i个token，m为坡度，也就是惩罚系数，第n个头对应的坡度为$ m=2^{\\frac{-8}{n}}\n\u200B\n $。';

    const normalized = normalizeVditorMarkdown(sample);

    assert.equal(normalized, '其中i表示第i个token，m为坡度，也就是惩罚系数，第n个头对应的坡度为$ m=2^{\\frac{-8}{n}} $。');
    assert.doesNotMatch(normalized, /\u200B/);
    assert.doesNotMatch(normalized, /\n \$。\n?/);
});

test('normalizePastedMathSegments keeps single-line sentence math inline even when copied across lines', async () => {
    const { normalizePastedMathSegments } = await import(moduleUrl);
    const sample = '其中i表示第i个token，m为坡度，也就是惩罚系数，第n个头对应的坡度为$ m=2^{\\frac{-8}{n}}\n\u200B\n $。';

    const normalized = normalizePastedMathSegments(sample);

    assert.equal(normalized, '其中i表示第i个token，m为坡度，也就是惩罚系数，第n个头对应的坡度为$ m=2^{\\frac{-8}{n}} $。');
    assert.doesNotMatch(normalized, /\$\$\n/);
    assert.doesNotMatch(normalized, /\u200B/);
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

test('normalizePastedVditorMarkdown inserts a space after inline bold markers in prose when body text follows immediately', async () => {
    const { normalizePastedVditorMarkdown } = await import(moduleUrl);
    const sample = '与RNN不同的是引入了position embedding（Bert甚至还引入了token_type_emebdding，这是个定制化的embedding，主要用于区分不同的句子段落），**为什么需要position embedding？**对于RNN模型来说。';

    const normalized = normalizePastedVditorMarkdown(sample);

    assert.equal(
        normalized,
        '与RNN不同的是引入了position embedding（Bert甚至还引入了token_type_emebdding，这是个定制化的embedding，主要用于区分不同的句子段落），**为什么需要position embedding？** 对于RNN模型来说。',
    );
});

test('normalizePastedVditorMarkdown inserts a space after inline underscore markers in prose when body text follows immediately', async () => {
    const { normalizePastedVditorMarkdown } = await import(moduleUrl);
    const sample = '这里顺手记一下，__why positional embedding matters?__对于Transformer来说也很关键。';

    const normalized = normalizePastedVditorMarkdown(sample);

    assert.equal(
        normalized,
        '这里顺手记一下，__why positional embedding matters?__ 对于Transformer来说也很关键。',
    );
});

test('normalizePastedVditorMarkdown keeps already-parseable tight inline strong markers unchanged', async () => {
    const { normalizePastedVditorMarkdown } = await import(moduleUrl);
    const sample = '模型会学会**适应这种随机丢失**并学会从剩余的信息中提取有效特征。';

    const normalized = normalizePastedVditorMarkdown(sample);

    assert.equal(normalized, sample);
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

test('normalizeVditorMarkdown strips font tags after fenced code blocks so following markdown stays parseable', async () => {
    const { normalizeVditorMarkdown } = await import(moduleUrl);
    const sample = [
        'dropout 确实会随机丢弃一部分 embedding 维度的信息，但在训练过程中，模型会学会**适应这种随机丢失**。',
        '',
        '```python',
        'class Encoder(nn.Module):',
        '    def __init__(self):',
        '        pass',
        '```',
        '',
        '## <font style="color:rgb(64, 64, 64);">位置编码层（Positional Encoding Layer）</font>',
        '与RNN不同的是引入了position embedding，**为什么需要position embedding？**对于RNN模型来说。',
    ].join('\n');

    const normalized = normalizeVditorMarkdown(sample);

    assert.doesNotMatch(normalized, /<font\b/i);
    assert.match(normalized, /^## 位置编码层（Positional Encoding Layer）$/m);
    assert.match(normalized, /\*\*为什么需要position embedding？\*\*/);
});

test('normalizePastedVditorMarkdown canonicalizes font-wrapped prose-plus-code strong runs into parseable markdown', async () => {
    const { normalizePastedVditorMarkdown, normalizeVditorMarkdown } = await import(moduleUrl);
    const sample = [
        '#### <font style="color:rgb(64, 64, 64);">二、 相对位置编码（Relative PE）的崛起（当前主流）</font>',
        '<font style="color:rgb(64, 64, 64);">这类方法的核心思想是：</font>**<font style="color:rgb(64, 64, 64);">让注意力分数的计算依赖于两个token之间的相对距离</font>****<font style="color:rgb(64, 64, 64);"> </font>**`**<font style="color:rgb(64, 64, 64);background-color:rgb(236, 236, 236);">i-j</font>**`**<font style="color:rgb(64, 64, 64);">，而非它们的绝对位置</font>****<font style="color:rgb(64, 64, 64);"> </font>**`**<font style="color:rgb(64, 64, 64);background-color:rgb(236, 236, 236);">i</font>**`**<font style="color:rgb(64, 64, 64);"> </font>****<font style="color:rgb(64, 64, 64);">和</font>****<font style="color:rgb(64, 64, 64);"> </font>**`**<font style="color:rgb(64, 64, 64);background-color:rgb(236, 236, 236);">j</font>**`<font style="color:rgb(64, 64, 64);">。这更符合语言的内在规律（一个词的重要性往往取决于它与其它词的相对距离）。</font>',
    ].join('\n');

    const normalized = normalizePastedVditorMarkdown(normalizeVditorMarkdown(sample));

    assert.doesNotMatch(normalized, /`?\*\*[^`\n]+\*\*`?\*\*/);
    assert.match(normalized, /\*\*让注意力分数的计算依赖于两个token之间的相对距离`i-j`，而非它们的绝对位置`i`和`j`\*\*/);
    assert.match(normalized, /`i-j`/);
    assert.match(normalized, /`i`/);
    assert.match(normalized, /`j`/);
});

test('normalizePastedVditorMarkdown unwraps isolated backticked strong fragments into plain inline code', async () => {
    const { normalizePastedVditorMarkdown, normalizeVditorMarkdown } = await import(moduleUrl);
    const sample = '模型无法处理比训练时所见更长的序列，因为超过长度</font>`**<font style="color:rgb(64, 64, 64);background-color:rgb(236, 236, 236);">N</font>**`<font style="color:rgb(64, 64, 64);">的位置根本没有编码。</font>';

    const normalized = normalizePastedVditorMarkdown(normalizeVditorMarkdown(sample));

    assert.equal(normalized, '模型无法处理比训练时所见更长的序列，因为超过长度`N`的位置根本没有编码。');
});
