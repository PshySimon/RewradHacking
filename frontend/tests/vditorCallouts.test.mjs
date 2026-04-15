import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const calloutModuleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorCallouts.js'),
).href;
const luteBundle = fs.readFileSync(
    path.resolve(__dirname, '../public/vendor/vditor/dist/js/lute/lute.min.js'),
    'utf8',
);

const loadLute = () => {
    globalThis.window = globalThis;
    globalThis.self = globalThis;
    if (!globalThis.Lute) {
        globalThis.eval(luteBundle);
    }
    return globalThis.Lute;
};

const renderMarkdownToHtml = async (markdown) => {
    const { transformVditorRenderedHtml } = await import(calloutModuleUrl);
    const Lute = loadLute();
    const lute = Lute.New();

    return transformVditorRenderedHtml(lute.Md2HTML(markdown));
};

class FakeClassList {
    constructor(initial = []) {
        this.items = new Set(initial);
    }

    add(...tokens) {
        tokens.forEach((token) => this.items.add(token));
    }

    remove(...tokens) {
        tokens.forEach((token) => this.items.delete(token));
    }

    contains(token) {
        return this.items.has(token);
    }
}

class FakeElement {
    constructor(textContent = '', classes = []) {
        this.textContent = textContent;
        this.classList = new FakeClassList(classes);
        this.dataset = {};
        this.children = [];
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    removeAttribute(name) {
        if (name === 'data-callout-decoration') {
            delete this.dataset.calloutDecoration;
        }
        if (name === 'data-callout-title') {
            delete this.dataset.calloutTitle;
        }
        if (name === 'data-callout-type') {
            delete this.dataset.calloutType;
        }
    }

    querySelectorAll(selector) {
        const matches = [];

        const visit = (node) => {
            if (selector === '[data-callout-decoration]' && node.dataset.calloutDecoration) {
                matches.push(node);
            }
            if (selector === '.vditor-reset' && node.classList.contains('vditor-reset')) {
                matches.push(node);
            }
            node.children.forEach(visit);
        };

        this.children.forEach(visit);
        return matches;
    }
}

test('transformVditorRenderedHtml converts single-paragraph info callouts', async () => {
    const html = await renderMarkdownToHtml(':::info\nhello\n:::');

    assert.match(html, /md-callout-info/);
    assert.match(html, /<div class="md-callout__title">Info<\/div>/);
    assert.match(html, /<p>\s*hello<\/p>/);
});

test('transformVditorRenderedHtml keeps multi-paragraph warning callouts inside one container', async () => {
    const html = await renderMarkdownToHtml(':::warning\nline1\n\nline2\n:::');

    assert.match(html, /md-callout-warning/);
    assert.match(html, /<p>\s*line1<\/p>/);
    assert.match(html, /<p>line2<\/p>/);
    assert.doesNotMatch(html, /:::warning/);
});

test('transformVditorRenderedHtml supports custom titles and nested list content', async () => {
    const html = await renderMarkdownToHtml(':::tip Quick note\n- a\n- b\n:::');

    assert.match(html, /md-callout-tip/);
    assert.match(html, /<div class="md-callout__title">Quick note<\/div>/);
    assert.match(html, /<ul>/);
    assert.match(html, /<li>a<\/li>/);
    assert.match(html, /<li>b<\/li>/);
});

test('observeVditorCallouts decorates IR roots and reacts to subsequent mutations', async () => {
    const { observeVditorCallouts } = await import(calloutModuleUrl);
    const root = new FakeElement('', ['vditor-reset']);
    const opener = root.appendChild(new FakeElement(':::info'));
    const body = root.appendChild(new FakeElement('body'));
    const closer = root.appendChild(new FakeElement(':::'));

    const observers = [];
    globalThis.MutationObserver = class {
        constructor(callback) {
            this.callback = callback;
            observers.push(this);
        }

        observe(target, options) {
            this.target = target;
            this.options = options;
        }
    };

    observeVditorCallouts(root);

    assert.equal(observers.length, 1);
    assert.equal(observers[0].target, root);
    assert.equal(body.dataset.calloutType, 'info');
    assert.ok(body.classList.contains('md-callout-block'));
    assert.ok(body.classList.contains('md-callout-block--start'));
    assert.ok(body.classList.contains('md-callout-block--end'));
    assert.equal(body.dataset.calloutTitle, 'Info');

    root.children = [
        new FakeElement(':::warning'),
        new FakeElement('updated body'),
        new FakeElement(':::'),
    ];
    observers[0].callback();

    assert.equal(root.children[1].dataset.calloutType, 'warning');
    assert.equal(root.children[1].dataset.calloutTitle, 'Warning');
    assert.ok(root.children[1].classList.contains('md-callout-block--warning'));
});
