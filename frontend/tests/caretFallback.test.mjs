import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/caretFallback.js'),
).href;

test('getCollapsedCaretFallbackRect uses the previous character right edge for line-end text selections without native rects', async () => {
    const { getCollapsedCaretFallbackRect } = await import(moduleUrl);

    const parentNode = {
        nodeType: 1,
        childNodes: [],
    };
    const textNode = {
        nodeType: 3,
        textContent: 'abc',
        parentNode,
    };
    parentNode.childNodes = [textNode];

    global.document = {
        createRange() {
            return {
                setStart(node, offset) {
                    this.startNode = node;
                    this.startOffset = offset;
                },
                setEnd(node, offset) {
                    this.endNode = node;
                    this.endOffset = offset;
                },
                getClientRects() {
                    if (this.startNode === textNode && this.startOffset === 2 && this.endOffset === 3) {
                        return [{ left: 30, right: 42, top: 10, height: 20, width: 12 }];
                    }
                    return [];
                },
            };
        },
    };

    const selection = {
        anchorNode: textNode,
        anchorOffset: 3,
    };

    const rect = getCollapsedCaretFallbackRect(selection);

    assert.deepEqual(rect, {
        left: 42,
        top: 10,
        height: 20,
    });
});

test('getCollapsedCaretFallbackRect returns null when there is no character geometry to probe', async () => {
    const { getCollapsedCaretFallbackRect } = await import(moduleUrl);

    global.document = {
        createRange() {
            return {
                setStart() {},
                setEnd() {},
                getClientRects() {
                    return [];
                },
            };
        },
    };

    const selection = {
        anchorNode: {
            nodeType: 3,
            textContent: '',
            parentNode: null,
        },
        anchorOffset: 0,
    };

    assert.equal(getCollapsedCaretFallbackRect(selection), null);
});

test('getNativeCollapsedCaretRect reanchors zero-size native rects to the anchor line top while keeping native x', async () => {
    const { getNativeCollapsedCaretRect } = await import(moduleUrl);

    const anchorElement = {
        getBoundingClientRect() {
            return {
                top: 335.79998779296875,
            };
        },
    };
    const selection = {
        anchorNode: {
            nodeType: 3,
            parentElement: anchorElement,
        },
    };

    global.window = {
        getComputedStyle() {
            return {
                paddingTop: '0',
                lineHeight: '22',
            };
        },
    };

    const rect = getNativeCollapsedCaretRect(
        [
            {
                left: 331.4666748046875,
                right: 331.4666748046875,
                top: 356.20001220703125,
                bottom: 356.20001220703125,
                width: 0,
                height: 0,
            },
        ],
        selection,
    );

    assert.deepEqual(rect, {
        left: 331.4666748046875,
        right: 331.4666748046875,
        top: 335.79998779296875,
        bottom: 357.79998779296875,
        width: 0,
        height: 22,
    });
});

test('getNativeCollapsedCaretRect rejects implausible native rects', async () => {
    const { getNativeCollapsedCaretRect } = await import(moduleUrl);

    assert.equal(
        getNativeCollapsedCaretRect([
            {
                left: Number.NaN,
                top: 20,
                width: 0,
                height: 0,
            },
        ]),
        null,
    );

    assert.equal(
        getNativeCollapsedCaretRect([
            {
                left: 10,
                top: 20,
                width: 18,
                height: 22,
            },
        ]),
        null,
    );
});
