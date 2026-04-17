import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(
    path.resolve(__dirname, '../src/utils/vditorTableInsertHandles.js'),
).href;

test('installTableInsertHandles schedules overlay mounts and tears them down on cleanup', async () => {
    const { installTableInsertHandles } = await import(moduleUrl);

    const calls = [];
    const cleanup = installTableInsertHandles(
        { getValue: () => '', setValue: () => {} },
        {
            resolveRoot: () => ({ querySelectorAll: () => [{ id: 'table-1' }, { id: 'table-2' }] }),
            collectMetrics: (tableElement) => ({
                tableRect: { left: 0, top: 0, right: 10, bottom: 10 },
                columns: [{ left: 0, right: 10, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } }],
                rows: [{ top: 0, bottom: 10, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } }],
                tableElement,
            }),
            buildTargets: () => ({ vertical: [{ id: 'column-before-0' }], horizontal: [{ id: 'row-before-0' }] }),
            mountOverlay: (root, tableElement) => {
                calls.push(['mount', root.id, tableElement.id]);
                return () => calls.push(['unmount', root.id, tableElement.id]);
            },
            createMutationObserver: (callback) => ({
                observe: () => {
                    calls.push(['observe-mutation']);
                    callback();
                },
                disconnect: () => calls.push(['disconnect-mutation']),
            }),
            createResizeObserver: () => ({
                observe: () => calls.push(['observe-resize']),
                disconnect: () => calls.push(['disconnect-resize']),
            }),
            requestFrame: (callback) => {
                calls.push(['raf']);
                callback();
                return 1;
            },
            cancelFrame: () => calls.push(['cancel-raf']),
            windowRef: {
                addEventListener: () => calls.push(['add-window-resize']),
                removeEventListener: () => calls.push(['remove-window-resize']),
            },
        },
    );

    cleanup();

    assert.deepEqual(calls, [
        ['raf'],
        ['mount', undefined, 'table-1'],
        ['observe-resize'],
        ['mount', undefined, 'table-2'],
        ['observe-resize'],
        ['observe-mutation'],
        ['cancel-raf'],
        ['raf'],
        ['unmount', undefined, 'table-2'],
        ['unmount', undefined, 'table-1'],
        ['disconnect-resize'],
        ['disconnect-resize'],
        ['mount', undefined, 'table-1'],
        ['observe-resize'],
        ['mount', undefined, 'table-2'],
        ['observe-resize'],
        ['add-window-resize'],
        ['cancel-raf'],
        ['unmount', undefined, 'table-2'],
        ['unmount', undefined, 'table-1'],
        ['disconnect-resize'],
        ['disconnect-resize'],
        ['disconnect-mutation'],
        ['remove-window-resize'],
    ]);
});

test('installTableInsertHandles ignores overlay-only mutations triggered by its own UI layer', async () => {
    const { installTableInsertHandles } = await import(moduleUrl);

    const calls = [];
    let observerCallback = null;
    let emittedOverlayMutation = false;
    const overlayNode = {
        nodeType: 1,
        className: 'vditor-table-insert-overlay',
        closest: () => overlayNode,
    };
    const hitZoneNode = {
        nodeType: 1,
        className: 'vditor-table-insert-hitzone',
        closest: () => overlayNode,
    };

    const cleanup = installTableInsertHandles(
        { getValue: () => '', setValue: () => {} },
        {
            resolveRoot: () => ({ id: 'root', querySelectorAll: () => [{ id: 'table-1' }] }),
            collectMetrics: () => ({
                tableRect: { left: 0, top: 0, right: 10, bottom: 10 },
                columns: [{ left: 0, right: 10, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } }],
                rows: [{ top: 0, bottom: 10, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } }],
            }),
            buildTargets: () => ({ vertical: [{ id: 'column-before-0' }], horizontal: [{ id: 'row-before-0' }] }),
            mountOverlay: () => {
                calls.push(['mount']);
                if (!emittedOverlayMutation) {
                    emittedOverlayMutation = true;
                    observerCallback?.([
                        { type: 'childList', target: { id: 'root' }, addedNodes: [overlayNode], removedNodes: [] },
                        { type: 'childList', target: overlayNode, addedNodes: [hitZoneNode], removedNodes: [] },
                    ]);
                }
                return () => calls.push(['unmount']);
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
            windowRef: {
                addEventListener: () => calls.push(['add-window-resize']),
                removeEventListener: () => calls.push(['remove-window-resize']),
            },
        },
    );

    cleanup();

    assert.deepEqual(calls, [
        ['raf'],
        ['mount'],
        ['observe-resize'],
        ['observe-mutation'],
        ['add-window-resize'],
        ['cancel-raf'],
        ['unmount'],
        ['disconnect-resize'],
        ['disconnect-mutation'],
        ['remove-window-resize'],
    ]);
});

test('installTableInsertHandles skips tables marked as delete-selection active', async () => {
    const { installTableInsertHandles } = await import(moduleUrl);

    const calls = [];
    const activeTable = {
        id: 'table-active',
        getAttribute: (name) => (name === 'data-vditor-table-selection-active' ? 'true' : null),
    };
    const idleTable = {
        id: 'table-idle',
        getAttribute: () => null,
    };

    const cleanup = installTableInsertHandles(
        { getValue: () => '', setValue: () => {} },
        {
            resolveRoot: () => ({ querySelectorAll: () => [activeTable, idleTable] }),
            collectMetrics: (tableElement) => ({
                tableRect: { left: 0, top: 0, right: 10, bottom: 10 },
                columns: [{ left: 0, right: 10, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } }],
                rows: [{ top: 0, bottom: 10, anchorCell: { rowIndex: 0, columnIndex: 0, isHeader: true } }],
                tableElement,
            }),
            buildTargets: () => ({ vertical: [{ id: 'column-before-0' }], horizontal: [{ id: 'row-before-0' }] }),
            mountOverlay: (root, tableElement) => {
                calls.push(['mount', tableElement.id]);
                return () => calls.push(['unmount', tableElement.id]);
            },
            createMutationObserver: () => ({
                observe: () => calls.push(['observe-mutation']),
                disconnect: () => calls.push(['disconnect-mutation']),
            }),
            createResizeObserver: () => ({
                observe: () => calls.push(['observe-resize']),
                disconnect: () => calls.push(['disconnect-resize']),
            }),
            requestFrame: (callback) => {
                calls.push(['raf']);
                callback();
                return 1;
            },
            cancelFrame: () => calls.push(['cancel-raf']),
            windowRef: {
                addEventListener: () => calls.push(['add-window-resize']),
                removeEventListener: () => calls.push(['remove-window-resize']),
            },
        },
    );

    cleanup();

    assert.deepEqual(calls, [
        ['raf'],
        ['mount', 'table-idle'],
        ['observe-resize'],
        ['observe-mutation'],
        ['add-window-resize'],
        ['cancel-raf'],
        ['unmount', 'table-idle'],
        ['disconnect-resize'],
        ['disconnect-mutation'],
        ['remove-window-resize'],
    ]);
});
