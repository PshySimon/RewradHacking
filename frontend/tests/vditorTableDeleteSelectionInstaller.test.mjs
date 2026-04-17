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
        this.id = 'table-1';
        this.rows = [];
        this.attributes = new Map();

        const headerRow = new FakeRow('th', columnCount, 'h');
        headerRow.parentElement = this;
        this.rows.push(headerRow);

        Array.from({ length: bodyRowCount }, (_, rowIndex) => {
            const row = new FakeRow('td', columnCount, `r${rowIndex}`);
            row.parentElement = this;
            this.rows.push(row);
        });
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
        this.rows = [];
    }
}

const createSimpleTable = (columnCount = 3, bodyRowCount = 2) => new FakeTable(columnCount, bodyRowCount);
const createDocumentRef = () => ({
    createElement: (tagName) => new FakeCell(tagName),
});

const createRoot = (tables) => ({
    listeners: new Map(),
    querySelectorAll: (selector) => (selector === 'table' ? tables : []),
    addEventListener(type, handler) {
        this.listeners.set(type, handler);
    },
    removeEventListener(type) {
        this.listeners.delete(type);
    },
});

const createTargetCell = (tableElement, id) => ({
    id,
    closest: (selector) => {
        if (selector === 'td, th') {
            return createTargetCell(tableElement, `${id}:cell`);
        }
        if (selector === 'table') {
            return tableElement;
        }
        return null;
    },
});

test('applyTableDeleteSelection syncs the editor and focuses the nearest surviving cell after column deletion', async () => {
    const { applyTableDeleteSelection } = await import(moduleUrl);

    const tableElement = createSimpleTable(3, 2);
    const root = {
        querySelectorAll: () => [tableElement],
    };
    const calls = [];

    applyTableDeleteSelection({
        vditor: {},
        root,
        tableElement,
        selection: {
            startRow: 0,
            endRow: 2,
            startColumn: 1,
            endColumn: 1,
            mode: 'columns',
            deletable: true,
        },
        adapters: {
            documentRef: createDocumentRef(),
            syncEditor: () => calls.push(['sync']),
            requestFrame: (callback) => {
                calls.push(['raf']);
                callback();
            },
            focusCell: (nextRoot, tableIndex, rowIndex, columnIndex) => {
                calls.push(['focus-cell', tableIndex, rowIndex, columnIndex]);
            },
            focusAfterRemoval: () => calls.push(['focus-after-removal']),
        },
    });

    assert.deepEqual(calls, [
        ['sync'],
        ['raf'],
        ['focus-cell', 0, 0, 1],
    ]);
    assert.deepEqual(
        tableElement.rows.map((row) => row.cells.map((cell) => cell.textContent)),
        [
            ['h0', 'h2'],
            ['r00', 'r02'],
            ['r10', 'r12'],
        ],
    );
});

test('installTableDeleteSelection deletes a full-row rectangle selected by cross-cell drag', async () => {
    const { installTableDeleteSelection } = await import(moduleUrl);

    const tableElement = { id: 'table-1' };
    const root = createRoot([tableElement]);
    const calls = [];
    const startTarget = createTargetCell(tableElement, 'start');
    const endTarget = createTargetCell(tableElement, 'end');
    let controller = null;

    const cleanup = installTableDeleteSelection(
        {},
        {
            resolveRoot: () => root,
            resolvePointerTarget: () => root,
            resolveKeyTarget: () => root,
            collectMetrics: () => ({ rowCount: 3, columnCount: 3, cellMap: [] }),
            mountOverlay: ({ tableElement: nextTable, onSelectionChange }) => {
                controller = {
                    tableElement: nextTable,
                    beginDrag: (cell) => calls.push(['begin', cell.id]),
                    updateDrag: (target) => {
                        calls.push(['update', target.id]);
                        const selection = {
                            startRow: 1,
                            endRow: 2,
                            startColumn: 0,
                            endColumn: 2,
                            mode: 'rows',
                            deletable: true,
                        };
                        onSelectionChange(selection);
                        return { activated: true, selection };
                    },
                    finishDrag: () => calls.push(['finish']),
                    clearSelection: () => {
                        calls.push(['clear']);
                        onSelectionChange(null);
                    },
                    cleanup: () => calls.push(['cleanup-overlay']),
                };
                return controller;
            },
            createMutationObserver: () => ({ observe() {}, disconnect() {} }),
            createResizeObserver: () => ({ observe() {}, disconnect() {} }),
            requestFrame: (callback) => {
                callback();
                return 1;
            },
            cancelFrame: () => {},
            clearNativeSelection: () => calls.push(['clear-native-selection']),
            applyDeleteAction: ({ selection, tableElement: nextTable }) => {
                calls.push(['delete', selection.mode, selection.startRow, selection.endRow, nextTable.id]);
            },
            windowRef: { addEventListener() {}, removeEventListener() {} },
        },
    );

    root.listeners.get('mousedown')({ button: 0, target: startTarget });
    root.listeners.get('mousemove')({ target: endTarget, preventDefault() {} });
    root.listeners.get('mouseup')({});

    const event = {
        key: 'Delete',
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
        stopPropagation() {
            this.propagationStopped = true;
        },
    };

    root.listeners.get('keydown')(event);
    cleanup();

    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
    assert.deepEqual(calls.filter((entry) => entry[0] !== 'cleanup-overlay'), [
        ['begin', 'start:cell'],
        ['update', 'end'],
        ['clear-native-selection'],
        ['finish'],
        ['clear'],
        ['delete', 'rows', 1, 2, 'table-1'],
    ]);
});

test('installTableDeleteSelection keeps generic rectangles highlighted but does not delete them on Delete', async () => {
    const { installTableDeleteSelection } = await import(moduleUrl);

    const tableElement = { id: 'table-1' };
    const root = createRoot([tableElement]);
    const calls = [];
    const startTarget = createTargetCell(tableElement, 'start');
    const endTarget = createTargetCell(tableElement, 'end');

    const cleanup = installTableDeleteSelection(
        {},
        {
            resolveRoot: () => root,
            resolvePointerTarget: () => root,
            resolveKeyTarget: () => root,
            collectMetrics: () => ({ rowCount: 3, columnCount: 3, cellMap: [] }),
            mountOverlay: ({ tableElement: nextTable, onSelectionChange }) => ({
                tableElement: nextTable,
                beginDrag() {},
                updateDrag() {
                    const selection = {
                        startRow: 1,
                        endRow: 2,
                        startColumn: 1,
                        endColumn: 2,
                        mode: 'cells',
                        deletable: false,
                    };
                    onSelectionChange(selection);
                    return { activated: true, selection };
                },
                finishDrag() {},
                clearSelection: () => {
                    calls.push(['clear']);
                    onSelectionChange(null);
                },
                cleanup() {},
            }),
            createMutationObserver: () => ({ observe() {}, disconnect() {} }),
            createResizeObserver: () => ({ observe() {}, disconnect() {} }),
            requestFrame: (callback) => {
                callback();
                return 1;
            },
            cancelFrame: () => {},
            clearNativeSelection: () => calls.push(['clear-native-selection']),
            applyDeleteAction: () => calls.push(['delete']),
            windowRef: { addEventListener() {}, removeEventListener() {} },
        },
    );

    root.listeners.get('mousedown')({ button: 0, target: startTarget });
    root.listeners.get('mousemove')({ target: endTarget, preventDefault() {} });
    root.listeners.get('mouseup')({});

    const event = {
        key: 'Delete',
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
        stopPropagation() {
            this.propagationStopped = true;
        },
    };

    root.listeners.get('keydown')(event);
    cleanup();

    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
    assert.deepEqual(calls, [['clear-native-selection']]);
});

test('installTableDeleteSelection clears the current selection on Escape and outside click', async () => {
    const { installTableDeleteSelection } = await import(moduleUrl);

    const tableElement = { id: 'table-1' };
    const root = createRoot([tableElement]);
    const calls = [];
    const startTarget = createTargetCell(tableElement, 'start');
    const endTarget = createTargetCell(tableElement, 'end');

    const cleanup = installTableDeleteSelection(
        {},
        {
            resolveRoot: () => root,
            resolvePointerTarget: () => root,
            resolveKeyTarget: () => root,
            collectMetrics: () => ({ rowCount: 3, columnCount: 3, cellMap: [] }),
            mountOverlay: ({ tableElement: nextTable, onSelectionChange }) => ({
                tableElement: nextTable,
                beginDrag() {},
                updateDrag() {
                    const selection = {
                        startRow: 0,
                        endRow: 2,
                        startColumn: 1,
                        endColumn: 1,
                        mode: 'columns',
                        deletable: true,
                    };
                    onSelectionChange(selection);
                    return { activated: true, selection };
                },
                finishDrag() {},
                clearSelection: () => {
                    calls.push(['clear']);
                    onSelectionChange(null);
                },
                cleanup() {},
            }),
            createMutationObserver: () => ({ observe() {}, disconnect() {} }),
            createResizeObserver: () => ({ observe() {}, disconnect() {} }),
            requestFrame: (callback) => {
                callback();
                return 1;
            },
            cancelFrame: () => {},
            clearNativeSelection() {},
            applyDeleteAction: () => calls.push(['delete']),
            windowRef: { addEventListener() {}, removeEventListener() {} },
        },
    );

    root.listeners.get('mousedown')({ button: 0, target: startTarget });
    root.listeners.get('mousemove')({ target: endTarget, preventDefault() {} });
    root.listeners.get('mouseup')({});

    const escapeEvent = {
        key: 'Escape',
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
        stopPropagation() {
            this.propagationStopped = true;
        },
    };
    root.listeners.get('keydown')(escapeEvent);
    root.listeners.get('mousedown')({ button: 0, target: {} });
    cleanup();

    assert.equal(escapeEvent.defaultPrevented, true);
    assert.equal(escapeEvent.propagationStopped, true);
    assert.deepEqual(calls, [['clear']]);
});

test('installTableDeleteSelection ignores overlay-only mutations triggered by its own UI layer', async () => {
    const { installTableDeleteSelection } = await import(moduleUrl);

    const calls = [];
    let observerCallback = null;
    let emittedOverlayMutation = false;
    const overlayNode = {
        nodeType: 1,
        className: 'vditor-table-delete-selection-overlay',
        closest: () => overlayNode,
    };
    const rectNode = {
        nodeType: 1,
        className: 'vditor-table-delete-selection-rect vditor-table-delete-selection-rect--cells',
        closest: () => overlayNode,
    };

    const cleanup = installTableDeleteSelection(
        {},
        {
            resolveRoot: () => createRoot([{ id: 'table-1' }]),
            resolvePointerTarget: (root) => root,
            resolveKeyTarget: (root) => root,
            collectMetrics: () => ({ rowCount: 1, columnCount: 1, cellMap: [] }),
            mountOverlay: () => {
                calls.push(['mount']);
                if (!emittedOverlayMutation) {
                    emittedOverlayMutation = true;
                    observerCallback?.([
                        { type: 'childList', target: { id: 'root' }, addedNodes: [overlayNode], removedNodes: [] },
                        { type: 'childList', target: overlayNode, addedNodes: [rectNode], removedNodes: [] },
                    ]);
                }
                return {
                    tableElement: { id: 'table-1' },
                    beginDrag() {},
                    updateDrag() {
                        return { activated: false, selection: null };
                    },
                    finishDrag() {},
                    clearSelection() {},
                    cleanup: () => calls.push(['cleanup-overlay']),
                };
            },
            createMutationObserver: (callback) => {
                observerCallback = callback;
                return {
                    observe: () => calls.push(['observe-mutation']),
                    disconnect: () => calls.push(['disconnect-mutation']),
                };
            },
            createResizeObserver: () => ({
                observe: () => calls.push(['observe-resize']),
                disconnect: () => calls.push(['disconnect-resize']),
            }),
            requestFrame: (callback) => {
                calls.push(['raf']);
                callback();
                return calls.length;
            },
            cancelFrame: () => calls.push(['cancel-raf']),
            windowRef: { addEventListener() {}, removeEventListener() {} },
        },
    );

    cleanup();

    assert.deepEqual(calls, [
        ['raf'],
        ['mount'],
        ['observe-resize'],
        ['observe-mutation'],
        ['cancel-raf'],
        ['cleanup-overlay'],
        ['disconnect-resize'],
        ['disconnect-mutation'],
    ]);
});

test('installTableDeleteSelection does not loop when ResizeObserver emits an initial measurement immediately', async () => {
    const { installTableDeleteSelection } = await import(moduleUrl);

    const calls = [];
    let mountCount = 0;

    assert.doesNotThrow(() => {
        const cleanup = installTableDeleteSelection(
            {},
            {
                resolveRoot: () => createRoot([{ id: 'table-1' }]),
                resolvePointerTarget: (root) => root,
                resolveKeyTarget: (root) => root,
                collectMetrics: () => ({ rowCount: 1, columnCount: 1, cellMap: [] }),
                mountOverlay: () => {
                    mountCount += 1;
                    calls.push(['mount', mountCount]);
                    if (mountCount > 3) {
                        throw new Error('resize loop');
                    }
                    return {
                        tableElement: { id: 'table-1' },
                        beginDrag() {},
                        updateDrag() {
                            return { activated: false, selection: null };
                        },
                        finishDrag() {},
                        clearSelection() {},
                        cleanup: () => calls.push(['cleanup-overlay']),
                    };
                },
                createMutationObserver: () => ({
                    observe: () => calls.push(['observe-mutation']),
                    disconnect: () => calls.push(['disconnect-mutation']),
                }),
                createResizeObserver: (callback) => ({
                    observe: () => {
                        calls.push(['observe-resize']);
                        callback([{ target: { id: 'table-1' } }]);
                    },
                    disconnect: () => calls.push(['disconnect-resize']),
                }),
                requestFrame: (callback) => {
                    calls.push(['raf']);
                    callback();
                    return calls.length;
                },
                cancelFrame: () => calls.push(['cancel-raf']),
                windowRef: { addEventListener() {}, removeEventListener() {} },
            },
        );

        cleanup();
    });

    assert.equal(mountCount, 1);
    assert.deepEqual(calls, [
        ['raf'],
        ['mount', 1],
        ['observe-resize'],
        ['observe-mutation'],
        ['cancel-raf'],
        ['cleanup-overlay'],
        ['disconnect-resize'],
        ['disconnect-mutation'],
    ]);
});

test('installTableDeleteSelection ignores non-table mutations from the editor root', async () => {
    const { installTableDeleteSelection } = await import(moduleUrl);

    const calls = [];
    let observerCallback = null;
    let mountCount = 0;
    const paragraphNode = {
        nodeType: 1,
        className: 'vditor-ir__p',
        closest: (selector) => (selector === 'table' ? null : null),
        querySelector: (selector) => (selector === 'table' ? null : null),
        querySelectorAll: () => [],
    };

    const cleanup = installTableDeleteSelection(
        {},
        {
            resolveRoot: () => createRoot([{ id: 'table-1' }]),
            resolvePointerTarget: (root) => root,
            resolveKeyTarget: (root) => root,
            collectMetrics: () => ({ rowCount: 1, columnCount: 1, cellMap: [] }),
            mountOverlay: () => {
                mountCount += 1;
                calls.push(['mount', mountCount]);
                return {
                    tableElement: { id: 'table-1' },
                    beginDrag() {},
                    updateDrag() {
                        return { activated: false, selection: null };
                    },
                    finishDrag() {},
                    clearSelection() {},
                    cleanup: () => calls.push(['cleanup-overlay']),
                };
            },
            createMutationObserver: (callback) => {
                observerCallback = callback;
                return {
                    observe: () => calls.push(['observe-mutation']),
                    disconnect: () => calls.push(['disconnect-mutation']),
                };
            },
            createResizeObserver: () => ({
                observe: () => calls.push(['observe-resize']),
                disconnect: () => calls.push(['disconnect-resize']),
            }),
            requestFrame: (callback) => {
                calls.push(['raf']);
                callback();
                return calls.length;
            },
            cancelFrame: () => calls.push(['cancel-raf']),
            windowRef: { addEventListener() {}, removeEventListener() {} },
        },
    );

    observerCallback?.([
        {
            type: 'childList',
            target: paragraphNode,
            addedNodes: [paragraphNode],
            removedNodes: [],
        },
    ]);
    cleanup();

    assert.equal(mountCount, 1);
    assert.deepEqual(calls, [
        ['raf'],
        ['mount', 1],
        ['observe-resize'],
        ['observe-mutation'],
        ['cancel-raf'],
        ['cleanup-overlay'],
        ['disconnect-resize'],
        ['disconnect-mutation'],
    ]);
});

test('installTableDeleteSelection does not emit debug console logs during normal drag selection', async () => {
    const { installTableDeleteSelection } = await import(moduleUrl);

    const tableElement = { id: 'table-1' };
    const root = createRoot([tableElement]);
    const startTarget = createTargetCell(tableElement, 'start');
    const endTarget = createTargetCell(tableElement, 'end');
    const originalConsoleLog = console.log;
    const logCalls = [];

    console.log = (...args) => {
        logCalls.push(args);
    };

    try {
        const cleanup = installTableDeleteSelection(
            {},
            {
                resolveRoot: () => root,
                resolvePointerTarget: () => root,
                resolveKeyTarget: () => root,
                collectMetrics: () => ({ rowCount: 3, columnCount: 3, cellMap: [] }),
                mountOverlay: ({ tableElement: nextTable, onSelectionChange }) => ({
                    tableElement: nextTable,
                    beginDrag() {},
                    updateDrag() {
                        const selection = {
                            startRow: 1,
                            endRow: 2,
                            startColumn: 0,
                            endColumn: 2,
                            mode: 'rows',
                            deletable: true,
                        };
                        onSelectionChange(selection);
                        return { activated: true, selection };
                    },
                    finishDrag() {},
                    clearSelection: () => onSelectionChange(null),
                    cleanup() {},
                }),
                createMutationObserver: () => ({ observe() {}, disconnect() {} }),
                createResizeObserver: () => ({ observe() {}, disconnect() {} }),
                requestFrame: (callback) => {
                    callback();
                    return 1;
                },
                cancelFrame: () => {},
                clearNativeSelection() {},
                windowRef: { addEventListener() {}, removeEventListener() {} },
            },
        );

        root.listeners.get('mousedown')({ button: 0, target: startTarget });
        root.listeners.get('mousemove')({ target: endTarget, preventDefault() {} });
        root.listeners.get('mouseup')({});
        cleanup();
    } finally {
        console.log = originalConsoleLog;
    }

    assert.equal(logCalls.length, 0);
});
