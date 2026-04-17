import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorTableDeleteSelection.js'),
).href;

class FakeElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.className = '';
        this.style = {};
        this.dataset = {};
        this.children = [];
        this.parentElement = null;
        this.listeners = new Map();
        this.attributes = new Map();
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    append(...children) {
        children.forEach((child) => this.appendChild(child));
    }

    replaceChildren(...children) {
        this.children = [];
        this.append(...children);
    }

    addEventListener(type, handler) {
        this.listeners.set(type, handler);
    }

    removeEventListener(type) {
        this.listeners.delete(type);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    remove() {
        if (!this.parentElement) {
            return;
        }

        this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
        this.parentElement = null;
    }
}

class FakeDocument {
    createElement(tagName) {
        return new FakeElement(tagName);
    }
}

const createCell = (tableElement, rowIndex, columnIndex, left, top, right, bottom, tagName = 'TD') => ({
    tagName,
    rowIndex,
    columnIndex,
    getBoundingClientRect: () => ({ left, top, right, bottom }),
    closest: (selector) => {
        if (selector === 'td, th') {
            return tableElement.rows[rowIndex].cells[columnIndex];
        }
        if (selector === 'table') {
            return tableElement;
        }
        return null;
    },
});

const createMeasuredTable = () => {
    const tableElement = new FakeElement('table');
    tableElement.getBoundingClientRect = () => ({ left: 80, top: 120, right: 380, bottom: 240 });
    tableElement.rows = [
        {
            cells: [
                createCell(tableElement, 0, 0, 80, 120, 180, 160, 'TH'),
                createCell(tableElement, 0, 1, 180, 120, 280, 160, 'TH'),
                createCell(tableElement, 0, 2, 280, 120, 380, 160, 'TH'),
            ],
        },
        {
            cells: [
                createCell(tableElement, 1, 0, 80, 160, 180, 200),
                createCell(tableElement, 1, 1, 180, 160, 280, 200),
                createCell(tableElement, 1, 2, 280, 160, 380, 200),
            ],
        },
        {
            cells: [
                createCell(tableElement, 2, 0, 80, 200, 180, 240),
                createCell(tableElement, 2, 1, 180, 200, 280, 240),
                createCell(tableElement, 2, 2, 280, 200, 380, 240),
            ],
        },
    ];
    return tableElement;
};

test('mountTableDeleteSelectionOverlay keeps same-cell drags in native-selection mode', async () => {
    const {
        collectTableCellMetrics,
        mountTableDeleteSelectionOverlay,
        TABLE_DELETE_SELECTION_ACTIVE_ATTR,
    } = await import(moduleUrl);

    const root = new FakeElement('div');
    root.getBoundingClientRect = () => ({ left: 20, top: 40, right: 620, bottom: 540 });
    const tableElement = createMeasuredTable();
    const selections = [];
    const metrics = collectTableCellMetrics(tableElement);

    const controller = mountTableDeleteSelectionOverlay({
        documentRef: new FakeDocument(),
        root,
        tableElement,
        metrics,
        onSelectionChange: (selection) => selections.push(selection),
    });

    controller.beginDrag(metrics.cellMap[1][1].element);
    const result = controller.updateDrag(metrics.cellMap[1][1].element);
    controller.finishDrag();

    assert.equal(result.activated, false);
    assert.equal(result.selection, null);
    assert.deepEqual(selections, []);
    assert.equal(tableElement.getAttribute(TABLE_DELETE_SELECTION_ACTIVE_ATTR), null);
    assert.equal(root.children[0].children.length, 0);

    controller.cleanup();
});

test('mountTableDeleteSelectionOverlay activates a rectangular selection once drag crosses into another cell', async () => {
    const {
        collectTableCellMetrics,
        mountTableDeleteSelectionOverlay,
        TABLE_DELETE_SELECTION_ACTIVE_ATTR,
    } = await import(moduleUrl);

    const root = new FakeElement('div');
    root.getBoundingClientRect = () => ({ left: 20, top: 40, right: 620, bottom: 540 });
    const tableElement = createMeasuredTable();
    const selections = [];
    const metrics = collectTableCellMetrics(tableElement);

    const controller = mountTableDeleteSelectionOverlay({
        documentRef: new FakeDocument(),
        root,
        tableElement,
        metrics,
        onSelectionChange: (selection) => selections.push(selection),
    });

    controller.beginDrag(metrics.cellMap[0][0].element);
    const result = controller.updateDrag(metrics.cellMap[2][1].element);
    controller.finishDrag();

    assert.equal(result.activated, true);
    assert.deepEqual(selections.at(-1), {
        startRow: 0,
        endRow: 2,
        startColumn: 0,
        endColumn: 1,
        mode: 'columns',
        deletable: true,
    });
    assert.equal(tableElement.getAttribute(TABLE_DELETE_SELECTION_ACTIVE_ATTR), 'true');

    controller.cleanup();
});

test('mountTableDeleteSelectionOverlay renders a single rectangle matched to the selected cell bounds', async () => {
    const {
        collectTableCellMetrics,
        mountTableDeleteSelectionOverlay,
    } = await import(moduleUrl);

    const root = new FakeElement('div');
    root.getBoundingClientRect = () => ({ left: 20, top: 40, right: 620, bottom: 540 });
    const tableElement = createMeasuredTable();
    const metrics = collectTableCellMetrics(tableElement);

    const controller = mountTableDeleteSelectionOverlay({
        documentRef: new FakeDocument(),
        root,
        tableElement,
        metrics,
    });

    controller.setSelection({
        startRow: 1,
        endRow: 2,
        startColumn: 1,
        endColumn: 2,
        mode: 'cells',
        deletable: false,
    });

    const overlay = root.children[0];
    assert.equal(overlay.children.length, 1);
    assert.equal(overlay.children[0].className.includes('vditor-table-delete-selection-rect'), true);
    assert.deepEqual(overlay.children[0].style, {
        left: '160px',
        top: '120px',
        width: '200px',
        height: '80px',
    });

    controller.cleanup();
});
