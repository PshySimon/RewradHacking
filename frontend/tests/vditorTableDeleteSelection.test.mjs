import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorTableDeleteSelection.js'),
).href;

class FakeCell {
    constructor(tagName, textContent = ' ') {
        this.tagName = tagName.toUpperCase();
        this.textContent = textContent;
        this.parentElement = null;
    }

    remove() {
        if (!this.parentElement) {
            return;
        }

        this.parentElement.cells = this.parentElement.cells.filter((cell) => cell !== this);
        this.parentElement = null;
    }

    replaceWith(nextCell) {
        const row = this.parentElement;
        const index = row.cells.indexOf(this);
        nextCell.parentElement = row;
        row.cells.splice(index, 1, nextCell);
        this.parentElement = null;
    }
}

class FakeRow {
    constructor(tagName, cellCount, rowLabel) {
        this.parentElement = null;
        this.tagName = 'TR';
        this.cells = Array.from({ length: cellCount }, (_, columnIndex) => {
            const cell = new FakeCell(tagName, `${rowLabel}${columnIndex}`);
            cell.parentElement = this;
            return cell;
        });
    }

    remove() {
        if (!this.parentElement) {
            return;
        }

        this.parentElement.rows = this.parentElement.rows.filter((row) => row !== this);
        this.parentElement = null;
    }
}

class FakeTable {
    constructor(columnCount, bodyRowCount) {
        this.rows = [];
        this.removed = false;

        const headerRow = new FakeRow('th', columnCount, 'h');
        headerRow.parentElement = this;
        this.rows.push(headerRow);

        Array.from({ length: bodyRowCount }, (_, rowIndex) => {
            const row = new FakeRow('td', columnCount, `r${rowIndex}`);
            row.parentElement = this;
            this.rows.push(row);
        });
    }

    remove() {
        this.removed = true;
        this.rows = [];
    }
}

const createSimpleTable = (columnCount = 2, bodyRowCount = 2) => new FakeTable(columnCount, bodyRowCount);
const createMeasuredCell = (tableElement, left, top, right, bottom, tagName, rowIndex, columnIndex) => ({
    tagName,
    dataset: {},
    rowIndex,
    columnIndex,
    getBoundingClientRect: () => ({ left, top, right, bottom }),
    closest: (selector) => {
        if (selector === 'td, th') {
            return measuredTable.rows[rowIndex].cells[columnIndex];
        }
        if (selector === 'table') {
            return tableElement;
        }
        return null;
    },
});

let measuredTable = null;
const createMeasuredTable = () => {
    const tableElement = {
        getBoundingClientRect: () => ({ left: 80, top: 120, right: 380, bottom: 240 }),
        rows: [],
    };

    measuredTable = tableElement;
    tableElement.rows = [
        {
            cells: [
                createMeasuredCell(tableElement, 80, 120, 180, 160, 'TH', 0, 0),
                createMeasuredCell(tableElement, 180, 120, 280, 160, 'TH', 0, 1),
                createMeasuredCell(tableElement, 280, 120, 380, 160, 'TH', 0, 2),
            ],
        },
        {
            cells: [
                createMeasuredCell(tableElement, 80, 160, 180, 200, 'TD', 1, 0),
                createMeasuredCell(tableElement, 180, 160, 280, 200, 'TD', 1, 1),
                createMeasuredCell(tableElement, 280, 160, 380, 200, 'TD', 1, 2),
            ],
        },
        {
            cells: [
                createMeasuredCell(tableElement, 80, 200, 180, 240, 'TD', 2, 0),
                createMeasuredCell(tableElement, 180, 200, 280, 240, 'TD', 2, 1),
                createMeasuredCell(tableElement, 280, 200, 380, 240, 'TD', 2, 2),
            ],
        },
    ];

    return tableElement;
};

const createDocumentRef = () => ({
    createElement: (tagName) => new FakeCell(tagName),
});

test('normalizeSelectionRange sorts drag endpoints into an inclusive contiguous range', async () => {
    const { normalizeSelectionRange } = await import(moduleUrl);

    assert.deepEqual(normalizeSelectionRange(4, 2), { start: 2, end: 4 });
    assert.deepEqual(normalizeSelectionRange(1, 1), { start: 1, end: 1 });
});

test('deleteSelectedRows promotes the next remaining row into the header when row 0 is removed', async () => {
    const { deleteSelectedRows } = await import(moduleUrl);

    const tableElement = createSimpleTable();
    const result = deleteSelectedRows(tableElement, { start: 0, end: 0 }, createDocumentRef());

    assert.equal(result.tableRemoved, false);
    assert.equal(tableElement.rows.length, 2);
    assert.deepEqual(Array.from(tableElement.rows[0].cells).map((cell) => cell.tagName), ['TH', 'TH']);
    assert.deepEqual(Array.from(tableElement.rows[0].cells).map((cell) => cell.textContent), ['r00', 'r01']);
});

test('deleteSelectedRows removes the full table when the final remaining row is deleted', async () => {
    const { deleteSelectedRows } = await import(moduleUrl);

    const tableElement = createSimpleTable(2, 0);
    const result = deleteSelectedRows(tableElement, { start: 0, end: 0 }, createDocumentRef());

    assert.equal(result.tableRemoved, true);
    assert.equal(tableElement.removed, true);
});

test('deleteSelectedColumns removes the full table when the final remaining column is deleted', async () => {
    const { deleteSelectedColumns } = await import(moduleUrl);

    const tableElement = createSimpleTable(1, 2);
    const result = deleteSelectedColumns(tableElement, { start: 0, end: 0 });

    assert.equal(result.tableRemoved, true);
    assert.equal(tableElement.removed, true);
});

test('deleteSelectedColumns removes a contiguous column range from every row', async () => {
    const { deleteSelectedColumns } = await import(moduleUrl);

    const tableElement = createSimpleTable(4, 2);
    const result = deleteSelectedColumns(tableElement, { start: 1, end: 2 });

    assert.equal(result.tableRemoved, false);
    assert.deepEqual(
        tableElement.rows.map((row) => row.cells.map((cell) => cell.textContent)),
        [
            ['h0', 'h3'],
            ['r00', 'r03'],
            ['r10', 'r13'],
        ],
    );
});

test('buildCellSelection classifies full rows, full columns, and generic rectangles', async () => {
    const { buildCellSelection, collectTableCellMetrics } = await import(moduleUrl);

    const tableElement = createMeasuredTable();
    const metrics = collectTableCellMetrics(tableElement);

    assert.deepEqual(
        buildCellSelection(metrics.cellMap[1][0], metrics.cellMap[2][2], metrics),
        {
            startRow: 1,
            endRow: 2,
            startColumn: 0,
            endColumn: 2,
            mode: 'rows',
            deletable: true,
        },
    );
    assert.deepEqual(
        buildCellSelection(metrics.cellMap[0][1], metrics.cellMap[2][2], metrics),
        {
            startRow: 0,
            endRow: 2,
            startColumn: 1,
            endColumn: 2,
            mode: 'columns',
            deletable: true,
        },
    );
    assert.deepEqual(
        buildCellSelection(metrics.cellMap[1][1], metrics.cellMap[2][2], metrics),
        {
            startRow: 1,
            endRow: 2,
            startColumn: 1,
            endColumn: 2,
            mode: 'cells',
            deletable: false,
        },
    );
});
