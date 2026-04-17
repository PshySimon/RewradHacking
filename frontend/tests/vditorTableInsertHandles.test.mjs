import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorTableInsertHandles.js'),
).href;

test('buildLogicalBoundaryTargets returns N+1 logical boundaries for columns and rows', async () => {
    const { buildLogicalBoundaryTargets } = await import(moduleUrl);

    const metrics = {
        tableRect: { left: 0, top: 0, right: 220, bottom: 120 },
        columns: [
            { left: 0, right: 110, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { left: 110, right: 220, anchorCell: { rowIndex: 0, columnIndex: 1, isHeader: true } },
        ],
        rows: [
            { top: 0, bottom: 60, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { top: 60, bottom: 120, anchorCell: { rowIndex: 1, columnIndex: 0, isHeader: false } },
        ],
    };

    const boundaries = buildLogicalBoundaryTargets(metrics);

    assert.equal(boundaries.vertical.length, 3);
    assert.equal(boundaries.horizontal.length, 3);
    assert.deepEqual(
        boundaries.vertical.map((boundary) => [boundary.side, boundary.anchorCell.columnIndex]),
        [['before', 0], ['after', 0], ['after', 1]],
    );
    assert.deepEqual(
        boundaries.horizontal.map((boundary) => [boundary.side, boundary.anchorCell.rowIndex]),
        [['before', 0], ['after', 0], ['after', 1]],
    );
});

test('getBoundaryInsertAction maps top boundary to header insertion and internal boundaries to full-row/full-column inserts', async () => {
    const { buildLogicalBoundaryTargets, getBoundaryInsertAction } = await import(moduleUrl);

    const metrics = {
        tableRect: { left: 0, top: 0, right: 220, bottom: 120 },
        columns: [
            { left: 0, right: 110, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { left: 110, right: 220, anchorCell: { rowIndex: 0, columnIndex: 1, isHeader: true } },
        ],
        rows: [
            { top: 0, bottom: 60, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } },
            { top: 60, bottom: 120, anchorCell: { rowIndex: 1, columnIndex: 0, isHeader: false } },
        ],
    };

    const { vertical, horizontal } = buildLogicalBoundaryTargets(metrics);

    assert.deepEqual(getBoundaryInsertAction(vertical[0]), {
        axis: 'column',
        side: 'before',
        anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true },
        insertHeader: false,
    });
    assert.deepEqual(getBoundaryInsertAction(vertical[1]), {
        axis: 'column',
        side: 'after',
        anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true },
        insertHeader: false,
    });
    assert.deepEqual(getBoundaryInsertAction(horizontal[0]), {
        axis: 'row',
        side: 'before',
        anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true },
        insertHeader: true,
    });
});
