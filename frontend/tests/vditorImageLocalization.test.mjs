import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorImageLocalization.js'),
).href;

test('extractExternalImageUrls finds markdown and html image urls only', async () => {
    const { extractExternalImageUrls } = await import(moduleUrl);
    const content = String.raw`
![a](https://img.example.com/a.png)
![local](/api/static/images/local.png)
![data](data:image/png;base64,xxx)
[not image](https://img.example.com/page.png)
<img src="https://img.example.com/b.webp?x=1" />
<img src='/api/static/images/c.png' />
![dup](https://img.example.com/a.png)
`;

    assert.deepEqual(extractExternalImageUrls(content), [
        'https://img.example.com/a.png',
        'https://img.example.com/b.webp?x=1',
    ]);
});

test('replaceImageUrl replaces every pasted occurrence with local url', async () => {
    const { replaceImageUrl } = await import(moduleUrl);
    const content = String.raw`![a](https://img.example.com/a.png)
<img src="https://img.example.com/a.png" />`;

    const replaced = replaceImageUrl(
        content,
        'https://img.example.com/a.png',
        '/api/static/images/local.png',
    );

    assert.equal(replaced, String.raw`![a](/api/static/images/local.png)
<img src="/api/static/images/local.png" />`);
});

test('localizeExternalImagesInVditor reports progress and leaves failed urls unchanged', async () => {
    const { localizeExternalImagesInVditor } = await import(moduleUrl);
    const states = [];
    let value = String.raw`![a](https://img.example.com/a.png)
![b](https://img.example.com/b.png)`;
    const vditor = {
        getValue: () => value,
        setValue: (next) => { value = next; },
    };
    const fetchImage = async (url) => {
        if (url.endsWith('/b.png')) {
            throw new Error('blocked');
        }
        return '/api/static/images/a-local.png';
    };

    const result = await localizeExternalImagesInVditor({
        vditor,
        fetchImage,
        onProgress: (state) => states.push(state),
        concurrency: 2,
        hideDelayMs: 0,
    });

    assert.equal(result.total, 2);
    assert.equal(result.success, 1);
    assert.equal(result.failed, 1);
    assert.match(value, /\/api\/static\/images\/a-local\.png/);
    assert.match(value, /https:\/\/img\.example\.com\/b\.png/);
    assert.equal(states.at(0).status, 'running');
    assert.equal(states.at(-1).status, 'done');
});
