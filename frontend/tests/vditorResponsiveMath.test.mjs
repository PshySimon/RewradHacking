import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const responsiveMathModuleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorResponsiveMath.js'),
).href;
const css = fs.readFileSync(path.resolve(__dirname, '../src/index.css'), 'utf8');

test('calculateMathFit scales formulas when the required scale remains readable', async () => {
    const { calculateMathFit } = await import(responsiveMathModuleUrl);

    assert.deepEqual(calculateMathFit({ availableWidth: 720, contentWidth: 900 }), {
        mode: 'scale',
        scale: 0.8,
    });
});

test('calculateMathFit falls back to local scrolling when scaling would be too small', async () => {
    const { calculateMathFit } = await import(responsiveMathModuleUrl);

    assert.deepEqual(calculateMathFit({ availableWidth: 360, contentWidth: 900 }), {
        mode: 'scroll',
        scale: 1,
    });
});

test('math overflow styles isolate formulas from the article layout', () => {
    assert.match(css, /\.mac-markdown-stream[\s\S]*overflow-x:\s*hidden/);
    assert.match(css, /span\.language-math[\s\S]*display:\s*inline-block/);
    assert.match(css, /\.rh-responsive-math[\s\S]*max-width:\s*100%/);
    assert.match(css, /\.rh-responsive-math--scroll[\s\S]*overflow-x:\s*auto/);
    assert.match(css, /\.rh-responsive-math--scaled[\s\S]*--rh-math-scale/);
});
