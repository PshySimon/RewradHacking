import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorPasteDebug.js'),
).href;

test('describeMarkdownStrongMarkers reports inline bold markers and suspicious inner spacing', async () => {
    const { describeMarkdownStrongMarkers } = await import(moduleUrl);
    const sample = '模型会学会**适应这种随机丢失**，并学会从剩余的信息中提取有效特征。与RNN不同的是，**为什么需要position embedding？ **对于RNN模型来说。';

    const markers = describeMarkdownStrongMarkers(sample);

    assert.equal(markers.length, 2);
    assert.deepEqual(
        markers.map((marker) => ({
            raw: marker.raw,
            content: marker.content,
            hasLeadingInnerSpace: marker.hasLeadingInnerSpace,
            hasTrailingInnerSpace: marker.hasTrailingInnerSpace,
            previousChar: marker.previousChar,
            nextChar: marker.nextChar,
        })),
        [
            {
                raw: '**适应这种随机丢失**',
                content: '适应这种随机丢失',
                hasLeadingInnerSpace: false,
                hasTrailingInnerSpace: false,
                previousChar: '会',
                nextChar: '，',
            },
            {
                raw: '**为什么需要position embedding？ **',
                content: '为什么需要position embedding？ ',
                hasLeadingInnerSpace: false,
                hasTrailingInnerSpace: true,
                previousChar: '，',
                nextChar: '对',
            },
        ],
    );
});

test('describeMarkdownStrongMarkers exposes invisible characters in marker content', async () => {
    const { describeMarkdownStrongMarkers } = await import(moduleUrl);
    const sample = '这里是**为什么需要position embedding？\u200B**后续正文';

    const [marker] = describeMarkdownStrongMarkers(sample);

    assert.equal(marker.hasInvisibleCharacters, true);
    assert.equal(marker.visibleContent, '为什么需要position embedding？<ZWSP>');
    assert.equal(marker.nextChar, '后');
});

test('describeFenceMarkers reports fenced code blocks and heading context after closing fence', async () => {
    const { describeFenceMarkers } = await import(moduleUrl);
    const sample = 'para\n\n```python\nprint(1)\n```\n\n## 标题\n**为什么需要position embedding？**';

    const fences = describeFenceMarkers(sample);

    assert.deepEqual(
        fences.map((fence) => ({
            raw: fence.raw,
            line: fence.line,
            info: fence.info,
            previousLine: fence.previousLine,
            nextLine: fence.nextLine,
        })),
        [
            {
                raw: '```python',
                line: 3,
                info: 'python',
                previousLine: '',
                nextLine: 'print(1)',
            },
            {
                raw: '```',
                line: 5,
                info: '',
                previousLine: 'print(1)',
                nextLine: '',
            },
        ],
    );
});
