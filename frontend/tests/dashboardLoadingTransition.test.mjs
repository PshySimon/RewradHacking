import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, '../src/pages/Dashboard.jsx');
const cssPath = path.resolve(__dirname, '../src/index.css');

test('Dashboard renders a loading shell with spinner and fades it out before cards fade in', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(source, /const INITIAL_FEED_LOADING_MIN_MS = 420/);
    assert.match(source, /const \[hasCompletedInitialFeedLoad, setHasCompletedInitialFeedLoad\] = useState\(false\)/);
    assert.match(source, /const \[feedLoadingPhase, setFeedLoadingPhase\] = useState\('visible'\)/);
    assert.match(source, /const \[transitionPhase, setTransitionPhase\] = useState\('preload'\)/);
    assert.match(source, /const shouldShowLoadingShell = !hasCompletedInitialFeedLoad/);
    assert.match(source, /setFeedLoadingPhase\(shouldShowLoadingShell \? 'visible' : 'hidden'\)/);
    assert.match(source, /const waitBeforeFade = Math\.max\(0, INITIAL_FEED_LOADING_MIN_MS - elapsed\)/);
    assert.match(source, /setTransitionPhase\('preload'\)/);
    assert.match(source, /setFeedLoadingPhase\('fading-out'\)/);
    assert.match(source, /setFeedLoadingPhase\('hidden'\)/);
    assert.match(source, /setHasCompletedInitialFeedLoad\(true\)/);
    assert.match(source, /className=\{`zhi-feed-loading zhi-feed-loading--\$\{feedLoadingPhase\}`\}/);
    assert.match(source, /className="zhi-feed-loading-spinner"/);
    assert.match(source, /className="zhi-feed-loading-card"/);
    assert.match(css, /\.zhi-feed-loading\s*\{/);
    assert.match(css, /\.zhi-feed-loading--visible\s*\{/);
    assert.match(css, /\.zhi-feed-loading--fading-out\s*\{/);
    assert.match(css, /\.zhi-feed-loading-spinner\s*\{/);
    assert.match(css, /\.zhi-feed--preload \.zhi-feed-card\s*\{/);
});
