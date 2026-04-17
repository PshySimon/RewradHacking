import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorTableInsertHandles.js'),
).href;

class FakeCell {
    constructor(tagName, textContent = '') {
        this.tagName = tagName.toUpperCase();
        this.textContent = textContent;
        this.attributes = new Map();
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, value);
    }
}

class FakeRow {
    constructor(cells = []) {
        this.cells = cells;
        this.parentElement = null;
    }

    appendChild(cell) {
        this.cells.push(cell);
        return cell;
    }

    insertAdjacentElement(position, row) {
        const siblings = this.parentElement.rows;
        const index = siblings.indexOf(this);
        const targetIndex = position === 'beforebegin' ? index : index + 1;
        row.parentElement = this.parentElement;
        siblings.splice(targetIndex, 0, row);
    }
}

class FakeSection {
    constructor(tagName, rows = []) {
        this.tagName = tagName.toUpperCase();
        this.rows = [];
        rows.forEach((row) => this.appendChild(row));
    }

    appendChild(row) {
        row.parentElement = this;
        this.rows.push(row);
        return row;
    }

    insertBefore(row, referenceRow) {
        row.parentElement = this;
        if (!referenceRow) {
            this.rows.push(row);
            return row;
        }

        const index = this.rows.indexOf(referenceRow);
        this.rows.splice(index, 0, row);
        return row;
    }

    get firstChild() {
        return this.rows[0] || null;
    }
}

class FakeTable {
    constructor(tHead, tbody) {
        this.tHead = tHead;
        this.tBodies = tbody ? [tbody] : [];
    }

    get rows() {
        return [
            ...(this.tHead?.rows || []),
            ...this.tBodies.flatMap((section) => section.rows),
        ];
    }

    createTBody() {
        const tbody = new FakeSection('tbody');
        this.tBodies.push(tbody);
        return tbody;
    }
}

class FakeDocument {
    createElement(tagName) {
        if (tagName === 'tr') {
            return new FakeRow();
        }

        return new FakeCell(tagName);
    }
}

test('applyTableInsertAction routes the top boundary to header insertion and focuses the first inserted header cell', async () => {
    const { applyTableInsertAction } = await import(moduleUrl);

    const calls = [];
    const boundary = {
        axis: 'row',
        side: 'before',
        anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true },
    };

    const result = applyTableInsertAction({
        vditor: {
            getValue: () => '| H1 | H2 |\n| --- | --- |\n| A1 | A2 |',
            setValue: (markdown) => calls.push(['setValue', markdown]),
        },
        tableElement: {},
        boundary,
        adapters: {
            insertHeaderRow: () => calls.push(['insertHeaderRow']),
            insertBodyRow: () => calls.push(['insertBodyRow']),
            insertColumn: () => calls.push(['insertColumn']),
            syncEditor: () => calls.push(['syncEditor']),
            focusInsertedCell: (_root, tableIndex, rowIndex, columnIndex) => calls.push(['focus', tableIndex, rowIndex, columnIndex]),
            resolveRoot: () => ({ id: 'root' }),
            requestFrame: (callback) => callback(),
            resolveTableIndex: () => 1,
        },
    });

    assert.deepEqual(result, { tableIndex: 1, rowIndex: 0, columnIndex: 0 });
    assert.deepEqual(calls, [
        ['insertHeaderRow'],
        ['syncEditor'],
        ['focus', 1, 0, 0],
    ]);
});

test('applyTableInsertAction routes internal vertical boundaries to after-column insertion and focuses the new column in the anchor row', async () => {
    const { applyTableInsertAction } = await import(moduleUrl);

    const calls = [];
    const boundary = {
        axis: 'column',
        side: 'after',
        anchorCell: { rowIndex: 0, columnIndex: 1, isHeader: true },
    };

    const result = applyTableInsertAction({
        vditor: {
            getValue: () => '| H1 | H2 |\n| --- | --- |\n| A1 | A2 |',
            setValue: (markdown) => calls.push(['setValue', markdown]),
        },
        tableElement: {},
        boundary,
        adapters: {
            insertHeaderRow: () => calls.push(['insertHeaderRow']),
            insertBodyRow: () => calls.push(['insertBodyRow']),
            insertColumn: (_table, columnIndex, side) => calls.push(['insertColumn', columnIndex, side]),
            syncEditor: () => calls.push(['syncEditor']),
            focusInsertedCell: (_root, tableIndex, rowIndex, columnIndex) => calls.push(['focus', tableIndex, rowIndex, columnIndex]),
            resolveRoot: () => ({ id: 'root' }),
            requestFrame: (callback) => callback(),
            resolveTableIndex: () => 0,
        },
    });

    assert.deepEqual(result, { tableIndex: 0, rowIndex: 0, columnIndex: 2 });
    assert.deepEqual(calls, [
        ['insertColumn', 1, 'after'],
        ['syncEditor'],
        ['focus', 0, 0, 2],
    ]);
});

test('insertBodyRow keeps a new row under tbody when the boundary sits below the header row', async () => {
    const { insertBodyRow } = await import(moduleUrl);

    const headerRow = new FakeRow([new FakeCell('th', 'H1'), new FakeCell('th', 'H2')]);
    const bodyRow = new FakeRow([new FakeCell('td', 'A1'), new FakeCell('td', 'A2')]);
    const thead = new FakeSection('thead', [headerRow]);
    const tbody = new FakeSection('tbody', [bodyRow]);
    const table = new FakeTable(thead, tbody);

    insertBodyRow(table, 0, 'after', new FakeDocument());

    assert.equal(thead.rows.length, 1);
    assert.equal(tbody.rows.length, 2);
    assert.equal(tbody.rows[0].cells.length, 2);
    assert.equal(tbody.rows[0].cells[0].tagName, 'TD');
    assert.equal(tbody.rows[0].cells[0].textContent, ' ');
});

test('syncTableInsert uses the internal IR input bridge before falling back to setValue', async () => {
    const { syncTableInsert } = await import(moduleUrl);

    const calls = [];
    const irElement = {
        dispatchEvent: (event) => calls.push(['dispatchEvent', event.type, event.bubbles]),
    };
    const vditor = {
        getValue: () => 'stale markdown',
        setValue: (markdown) => calls.push(['setValue', markdown]),
        vditor: {
            currentMode: 'ir',
            ir: {
                element: irElement,
                preventInput: false,
            },
        },
    };

    syncTableInsert(vditor);

    assert.equal(vditor.vditor.ir.preventInput, true);
    assert.deepEqual(calls, [['dispatchEvent', 'input', true]]);
});
