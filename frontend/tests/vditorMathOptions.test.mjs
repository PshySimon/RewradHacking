import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const luteBundle = fs.readFileSync(
    path.resolve(__dirname, '../public/vendor/vditor/dist/js/lute/lute.min.js'),
    'utf8',
);
const sample = String.raw`这里手动计算一下，我们知道sin和cos函数的周期是$2k\pi$，假设两个位置分别是$pos_1和pos_2$，那么只有当式子满足$\frac{pos_1}{10000^{2i/d}}-\frac{pos_2}{10000^{2i/d}}=2k\pi$简化式子得到$pos_1-pos_2=2k\pi\cdot 10000^{2i/d}$，这里需要注意的是，i是个变量，因此并不是这一个方程而是d个方程组（假设是d维向量），这个方程组甚至不一定有解，很容易出现矛盾方程，出现两个位置编码完全一样的可能性很小（维度在比较大的情况下），并且设置$\omega$系数为10000也减少了重复的可能性。所以结论是**维度较小的情况下会出现，高维情况下几乎不会出现完全一样。`;

const loadLute = () => {
    globalThis.window = globalThis;
    globalThis.self = globalThis;
    if (!globalThis.Lute) {
        globalThis.eval(luteBundle);
    }
    return globalThis.Lute;
};

test('project Vditor math options parse inline formulas that start with digits', async () => {
    const moduleUrl = pathToFileURL(
        path.resolve(__dirname, '../src/utils/vditorOptions.js'),
    ).href;
    const { VDITOR_MATH_OPTIONS } = await import(moduleUrl);
    const Lute = loadLute();
    const lute = Lute.New();

    lute.SetMark(true);
    lute.SetVditorMathBlockPreview(true);
    lute.SetInlineMathAllowDigitAfterOpenMarker(Boolean(VDITOR_MATH_OPTIONS.inlineDigit));

    const html = lute.Md2HTML(sample);

    assert.match(html, /<span class="language-math">2k\\pi<\/span>/);
    assert.match(html, /<span class="language-math">pos_1和pos_2<\/span>/);
    assert.match(html, /<span class="language-math">\\omega<\/span>/);
    assert.doesNotMatch(html, /<span class="language-math">，假设两个位置分别是<\/span>/);
});
