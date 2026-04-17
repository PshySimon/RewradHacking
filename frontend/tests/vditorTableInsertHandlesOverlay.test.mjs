import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorTableInsertHandles.js'),
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

test('collectTableMetrics normalizes row and column bounds relative to the table origin', async () => {
    const { collectTableMetrics } = await import(moduleUrl);

    const cell = (left, top, right, bottom, tagName) => ({
        tagName,
        getBoundingClientRect: () => ({ left, top, right, bottom }),
    });

    const tableElement = {
        getBoundingClientRect: () => ({ left: 20, top: 40, right: 240, bottom: 160, width: 220, height: 120 }),
        rows: [
            { cells: [cell(20, 40, 130, 100, 'TH'), cell(130, 40, 240, 100, 'TH')] },
            { cells: [cell(20, 100, 130, 160, 'TD'), cell(130, 100, 240, 160, 'TD')] },
        ],
    };

    const metrics = collectTableMetrics(tableElement);

    assert.deepEqual(metrics.tableRect, { left: 0, top: 0, right: 220, bottom: 120 });
    assert.deepEqual(metrics.columns.map((column) => [column.left, column.right]), [[0, 110], [110, 220]]);
    assert.deepEqual(metrics.rows.map((row) => [row.top, row.bottom, row.anchorCell.isHeader]), [[0, 60, true], [60, 120, false]]);
});

test('getBoundaryOverlayState spans the full logical line and marks the hit zone as clickable', async () => {
    const { buildLogicalBoundaryTargets, getBoundaryOverlayState } = await import(moduleUrl);

    const { vertical, horizontal } = buildLogicalBoundaryTargets({
        tableRect: { left: 0, top: 0, right: 480, bottom: 120 },
        columns: [
            { left: 0, right: 110, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { left: 110, right: 220, anchorCell: { rowIndex: 0, columnIndex: 1, isHeader: true } },
        ],
        rows: [
            { top: 0, bottom: 60, left: 0, right: 220, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { top: 60, bottom: 120, left: 0, right: 220, anchorCell: { rowIndex: 1, columnIndex: 0, isHeader: false } },
        ],
    });

    const verticalState = getBoundaryOverlayState(vertical[1], true);
    const horizontalState = getBoundaryOverlayState(horizontal[2], true);

    assert.equal(verticalState.hitZoneStyle.cursor, 'pointer');
    assert.equal(verticalState.lineStyle.height, '120px');
    assert.equal(verticalState.triangleStyle.top, '60px');
    assert.equal(horizontalState.lineStyle.width, '220px');
    assert.equal(horizontalState.triangleStyle.left, '110px');
    assert.equal(horizontalState.hitZoneStyle.width, '220px');
});

test('mountTableInsertOverlay positions horizontal lines and triangles against the table midpoint instead of stretching across the editor', async () => {
    const {
        buildLogicalBoundaryTargets,
        mountTableInsertOverlay,
    } = await import(moduleUrl);

    const root = new FakeElement('div');
    root.getBoundingClientRect = () => ({ left: 20, top: 40, right: 620, bottom: 540 });

    const tableElement = new FakeElement('table');
    tableElement.getBoundingClientRect = () => ({ left: 60, top: 80, right: 280, bottom: 200 });

    const boundaries = buildLogicalBoundaryTargets({
        tableRect: { left: 0, top: 0, right: 220, bottom: 120 },
        columns: [
            { left: 0, right: 110, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { left: 110, right: 220, anchorCell: { rowIndex: 0, columnIndex: 1, isHeader: true } },
        ],
        rows: [
            { top: 0, bottom: 60, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { top: 60, bottom: 120, anchorCell: { rowIndex: 1, columnIndex: 0, isHeader: false } },
        ],
    });

    mountTableInsertOverlay({
        documentRef: new FakeDocument(),
        root,
        tableElement,
        boundaries: [boundaries.vertical, boundaries.horizontal],
        onInsert: () => {},
    });

    const overlay = root.children[0];
    const hitZoneIndex = overlay.children.findIndex((node) => node.dataset.boundaryId === 'row-after-1');
    const hitZone = overlay.children[hitZoneIndex];
    const line = overlay.children[hitZoneIndex + 1];
    const triangle = overlay.children[hitZoneIndex + 2];

    assert.equal(hitZone.style.left, '40px');
    assert.equal(hitZone.style.top, '152px');
    assert.equal(hitZone.style.width, '220px');
    assert.equal(line.style.left, '150px');
    assert.equal(line.style.top, '160px');
    assert.equal(line.style.width, '220px');
    assert.equal(triangle.style.left, '150px');
    assert.equal(triangle.style.top, '160px');
});

test('mountTableInsertOverlay triggers insertion from mousedown on the boundary hit zone', async () => {
    const {
        buildLogicalBoundaryTargets,
        mountTableInsertOverlay,
    } = await import(moduleUrl);

    const root = new FakeElement('div');
    root.getBoundingClientRect = () => ({ left: 20, top: 40, right: 620, bottom: 540 });

    const tableElement = new FakeElement('table');
    tableElement.getBoundingClientRect = () => ({ left: 60, top: 80, right: 280, bottom: 200 });

    const boundaries = buildLogicalBoundaryTargets({
        tableRect: { left: 0, top: 0, right: 220, bottom: 120 },
        columns: [
            { left: 0, right: 110, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { left: 110, right: 220, anchorCell: { rowIndex: 0, columnIndex: 1, isHeader: true } },
        ],
        rows: [
            { top: 0, bottom: 60, left: 0, right: 220, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { top: 60, bottom: 120, left: 0, right: 220, anchorCell: { rowIndex: 1, columnIndex: 0, isHeader: false } },
        ],
    });

    const inserts = [];
    mountTableInsertOverlay({
        documentRef: new FakeDocument(),
        root,
        tableElement,
        boundaries: [boundaries.vertical, boundaries.horizontal],
        onInsert: (boundary) => inserts.push(boundary.id),
    });

    const overlay = root.children[0];
    const hitZone = overlay.children.find((node) => node.dataset.boundaryId === 'column-after-0');

    hitZone.listeners.get('mousedown')({
        button: 0,
        preventDefault() {},
        stopPropagation() {},
    });

    assert.deepEqual(inserts, ['column-after-0']);
});
