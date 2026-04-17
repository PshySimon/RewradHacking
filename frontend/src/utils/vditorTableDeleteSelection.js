import { syncTableInsert } from './vditorTableInsertHandles.js';

const DELETE_SELECTION_OVERLAY_CLASS_PREFIX = 'vditor-table-delete-selection-';
const DELETE_SELECTION_OVERLAY_ROOT_CLASS = 'vditor-table-delete-selection-overlay';

export const TABLE_DELETE_SELECTION_ACTIVE_ATTR = 'data-vditor-table-selection-active';

const getDocumentRef = (tableElement, documentRef) => (
    documentRef
    || tableElement?.ownerDocument
    || (typeof document !== 'undefined' ? document : null)
);

const cloneCellAsHeader = (sourceCell, documentRef) => {
    const headerCell = documentRef.createElement('th');
    headerCell.textContent = sourceCell?.textContent || ' ';
    const align = sourceCell?.getAttribute?.('align');
    if (align) {
        headerCell.setAttribute('align', align);
    }
    return headerCell;
};

export function normalizeSelectionRange(anchorIndex, currentIndex) {
    return {
        start: Math.min(anchorIndex, currentIndex),
        end: Math.max(anchorIndex, currentIndex),
    };
}

export function deleteSelectedColumns(tableElement, range) {
    const rowList = Array.from(tableElement?.rows || []);
    const remainingColumns = (rowList[0]?.cells?.length || 0) - (range.end - range.start + 1);

    if (remainingColumns <= 0) {
        tableElement?.remove?.();
        return { tableRemoved: true };
    }

    rowList.forEach((row) => {
        for (let columnIndex = range.end; columnIndex >= range.start; columnIndex -= 1) {
            row.cells?.[columnIndex]?.remove?.();
        }
    });

    return { tableRemoved: false };
}

export function deleteSelectedRows(tableElement, range, documentRef = null) {
    const rowList = Array.from(tableElement?.rows || []);
    const remainingRows = rowList.length - (range.end - range.start + 1);

    if (remainingRows <= 0) {
        tableElement?.remove?.();
        return { tableRemoved: true };
    }

    for (let rowIndex = range.end; rowIndex >= range.start; rowIndex -= 1) {
        tableElement.rows?.[rowIndex]?.remove?.();
    }

    if (range.start === 0 && tableElement.rows?.[0]) {
        const doc = getDocumentRef(tableElement, documentRef);
        const firstRemainingRow = tableElement.rows[0];
        Array.from(firstRemainingRow.cells || []).forEach((cell) => {
            if (cell?.tagName === 'TH') {
                return;
            }

            const headerCell = cloneCellAsHeader(cell, doc);
            cell.replaceWith(headerCell);
        });
    }

    return { tableRemoved: false };
}

const relativeRect = (rect, tableRect) => ({
    left: rect.left - tableRect.left,
    top: rect.top - tableRect.top,
    right: rect.right - tableRect.left,
    bottom: rect.bottom - tableRect.top,
});

const resolveCellFromTarget = (target) => {
    if (!target) {
        return null;
    }

    if (target.nodeType === 3) {
        return resolveCellFromTarget(target.parentElement);
    }

    if (typeof target.closest === 'function') {
        return target.closest('td, th');
    }

    if (target.tagName === 'TD' || target.tagName === 'TH') {
        return target;
    }

    return null;
};

const resolveTableFromCell = (cell) => {
    if (!cell) {
        return null;
    }

    if (typeof cell.closest === 'function') {
        return cell.closest('table');
    }

    return cell.parentElement?.parentElement || null;
};

const measureSelectionRect = (selection, metrics) => {
    if (!selection || !metrics?.cellMap?.length) {
        return null;
    }

    const startCell = metrics.cellMap[selection.startRow]?.[selection.startColumn];
    const endCell = metrics.cellMap[selection.endRow]?.[selection.endColumn];
    if (!startCell || !endCell) {
        return null;
    }

    return {
        left: startCell.left,
        top: startCell.top,
        right: endCell.right,
        bottom: endCell.bottom,
        width: endCell.right - startCell.left,
        height: endCell.bottom - startCell.top,
    };
};

export function collectTableCellMetrics(tableElement) {
    const tableRect = tableElement.getBoundingClientRect();
    const rows = Array.from(tableElement.rows || []);
    const cellMap = rows.map((row, rowIndex) => (
        Array.from(row.cells || []).map((cell, columnIndex) => {
            const rect = relativeRect(cell.getBoundingClientRect(), tableRect);

            return {
                element: cell,
                rowIndex,
                columnIndex,
                isHeader: cell.tagName === 'TH',
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
            };
        })
    ));

    const elementMap = new Map();
    cellMap.forEach((row) => {
        row.forEach((cell) => {
            elementMap.set(cell.element, cell);
        });
    });

    return {
        tableRect: {
            left: 0,
            top: 0,
            right: tableRect.right - tableRect.left,
            bottom: tableRect.bottom - tableRect.top,
        },
        rowCount: cellMap.length,
        columnCount: cellMap[0]?.length || 0,
        cellMap,
        elementMap,
    };
}

const resolveMeasuredCell = (cellOrMetric, metrics) => {
    if (!cellOrMetric || !metrics) {
        return null;
    }

    if (typeof cellOrMetric.rowIndex === 'number' && typeof cellOrMetric.columnIndex === 'number' && !cellOrMetric.tagName) {
        return cellOrMetric;
    }

    return metrics.elementMap?.get(cellOrMetric) || null;
};

export function buildCellSelection(startCell, endCell, metrics) {
    const startMetric = resolveMeasuredCell(startCell, metrics);
    const endMetric = resolveMeasuredCell(endCell, metrics);
    if (!startMetric || !endMetric) {
        return null;
    }

    const rowRange = normalizeSelectionRange(startMetric.rowIndex, endMetric.rowIndex);
    const columnRange = normalizeSelectionRange(startMetric.columnIndex, endMetric.columnIndex);
    const coversAllRows = rowRange.start === 0 && rowRange.end === metrics.rowCount - 1;
    const coversAllColumns = columnRange.start === 0 && columnRange.end === metrics.columnCount - 1;

    let mode = 'cells';
    let deletable = false;

    if (coversAllColumns) {
        mode = 'rows';
        deletable = true;
    } else if (coversAllRows) {
        mode = 'columns';
        deletable = true;
    }

    return {
        startRow: rowRange.start,
        endRow: rowRange.end,
        startColumn: columnRange.start,
        endColumn: columnRange.end,
        mode,
        deletable,
    };
}

const getTableOffsetWithinRoot = (tableElement, root) => {
    const tableRect = tableElement.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();

    return {
        x: tableRect.left - rootRect.left,
        y: tableRect.top - rootRect.top,
    };
};

const setTableSelectionActive = (tableElement, active) => {
    if (!tableElement?.setAttribute || !tableElement?.removeAttribute) {
        return;
    }

    if (active) {
        tableElement.setAttribute(TABLE_DELETE_SELECTION_ACTIVE_ATTR, 'true');
        return;
    }

    tableElement.removeAttribute(TABLE_DELETE_SELECTION_ACTIVE_ATTR);
};

const isOverlayMutationNode = (node) => {
    if (!node) {
        return false;
    }

    if (node.nodeType === 3) {
        return isOverlayMutationNode(node.parentElement);
    }

    const className = typeof node.className === 'string' ? node.className : '';
    if (className.split(/\s+/).some((token) => token.startsWith(DELETE_SELECTION_OVERLAY_CLASS_PREFIX))) {
        return true;
    }

    return typeof node.closest === 'function'
        && Boolean(node.closest(`.${DELETE_SELECTION_OVERLAY_ROOT_CLASS}`));
};

const nodeTouchesTable = (node) => {
    if (!node) {
        return false;
    }

    if (node.nodeType === 3) {
        return nodeTouchesTable(node.parentElement);
    }

    if (node.tagName === 'TABLE') {
        return true;
    }

    if (typeof node.closest === 'function' && node.closest('table')) {
        return true;
    }

    return typeof node.querySelector === 'function'
        && Boolean(node.querySelector('table'));
};

const mutationsNeedRerender = (records) => {
    if (!Array.isArray(records) || records.length === 0) {
        return true;
    }

    return records.some((record) => {
        const touchedNodes = [
            ...Array.from(record.addedNodes || []),
            ...Array.from(record.removedNodes || []),
        ];

        if (touchedNodes.length > 0) {
            return touchedNodes.some((node) =>
                !isOverlayMutationNode(node) && nodeTouchesTable(node));
        }

        return !isOverlayMutationNode(record.target) && nodeTouchesTable(record.target);
    });
};

const createSelectionNode = ({ documentRef, selection, metrics, offset }) => {
    const rect = measureSelectionRect(selection, metrics);
    if (!rect) {
        return [];
    }

    const node = documentRef.createElement('div');
    node.className = [
        'vditor-table-delete-selection-rect',
        `vditor-table-delete-selection-rect--${selection.mode}`,
        selection.deletable
            ? 'vditor-table-delete-selection-rect--deletable'
            : 'vditor-table-delete-selection-rect--static',
    ].join(' ');
    Object.assign(node.style, {
        left: `${offset.x + rect.left}px`,
        top: `${offset.y + rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
    });
    return [node];
};

export function mountTableDeleteSelectionOverlay({
    documentRef = document,
    root,
    tableElement,
    metrics = collectTableCellMetrics(tableElement),
    onSelectionChange = () => {},
}) {
    const overlay = documentRef.createElement('div');
    overlay.className = DELETE_SELECTION_OVERLAY_ROOT_CLASS;
    root.appendChild(overlay);

    const offset = getTableOffsetWithinRoot(tableElement, root);
    let selection = null;
    let dragState = null;

    const render = () => {
        overlay.replaceChildren(
            ...createSelectionNode({ documentRef, selection, metrics, offset }),
        );
    };

    const emitSelection = (nextSelection) => {
        selection = nextSelection;
        setTableSelectionActive(tableElement, Boolean(nextSelection));
        onSelectionChange(nextSelection);
        render();
    };

    const beginDrag = (anchorCell) => {
        const anchorMetric = resolveMeasuredCell(anchorCell, metrics);
        if (!anchorMetric) {
            return false;
        }

        dragState = {
            anchorCell: anchorMetric,
            currentCell: anchorMetric,
            activated: false,
        };
        return true;
    };

    const updateDrag = (target) => {
        if (!dragState) {
            return { activated: false, selection };
        }

        const rawCell = resolveCellFromTarget(target);
        const nextCell = resolveMeasuredCell(rawCell, metrics);
        if (!nextCell) {
            return { activated: false, selection };
        }

        if (
            nextCell.rowIndex === dragState.anchorCell.rowIndex
            && nextCell.columnIndex === dragState.anchorCell.columnIndex
        ) {
            return { activated: false, selection };
        }

        const nextSelection = buildCellSelection(dragState.anchorCell, nextCell, metrics);
        const activated = !dragState.activated;
        dragState.activated = true;
        dragState.currentCell = nextCell;
        emitSelection(nextSelection);
        return { activated, selection: nextSelection };
    };

    const finishDrag = () => {
        dragState = null;
    };

    const clearSelection = () => {
        if (!dragState && !selection) {
            return;
        }
        dragState = null;
        emitSelection(null);
    };

    const setSelection = (nextSelection) => {
        dragState = null;
        emitSelection(nextSelection);
    };

    render();

    return {
        tableElement,
        metrics,
        overlay,
        beginDrag,
        updateDrag,
        finishDrag,
        clearSelection,
        setSelection,
        cleanup: () => {
            clearSelection();
            overlay.remove();
        },
    };
}

const getNearestFocusTarget = (tableElement, selection) => {
    const remainingRowCount = tableElement?.rows?.length || 0;
    const remainingColumnCount = tableElement?.rows?.[0]?.cells?.length || 0;

    return {
        rowIndex: selection.mode === 'rows'
            ? Math.min(selection.startRow, Math.max(remainingRowCount - 1, 0))
            : 0,
        columnIndex: selection.mode === 'columns'
            ? Math.min(selection.startColumn, Math.max(remainingColumnCount - 1, 0))
            : 0,
    };
}

export function focusDeleteTargetCell(root, tableIndex, rowIndex, columnIndex) {
    const tableElement = root?.querySelectorAll?.('table')?.[tableIndex];
    const cell = tableElement?.rows?.[rowIndex]?.cells?.[columnIndex];
    if (!cell || typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

export function focusAfterRemovedTable(parentElement, nextSibling, documentRef = null) {
    const doc = documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || !parentElement) {
        return;
    }

    let target = nextSibling;
    if (!target || target.tagName === 'TABLE') {
        target = doc.createElement('p');
        target.setAttribute('data-block', '0');
        target.innerHTML = '<wbr>\n';
        parentElement.insertBefore(target, nextSibling || null);
    }

    if (typeof window === 'undefined') {
        return;
    }

    const range = doc.createRange();
    range.selectNodeContents(target);
    range.collapse(true);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

export function applyTableDeleteSelection({ vditor, root, tableElement, selection, adapters = {} }) {
    const parentElement = tableElement?.parentElement || null;
    const nextSibling = tableElement?.nextElementSibling || null;
    const ops = {
        deleteRows: deleteSelectedRows,
        deleteColumns: deleteSelectedColumns,
        syncEditor: syncTableInsert,
        requestFrame: (callback) => requestAnimationFrame(callback),
        resolveTableIndex: (rootElement, candidateTable) =>
            Array.from(rootElement?.querySelectorAll?.('table') || []).indexOf(candidateTable),
        focusCell: focusDeleteTargetCell,
        focusAfterRemoval: focusAfterRemovedTable,
        documentRef: getDocumentRef(tableElement, null),
        ...adapters,
    };

    if (!selection?.deletable) {
        return { tableRemoved: false, skipped: true };
    }

    const tableIndex = ops.resolveTableIndex(root, tableElement);
    const result = selection.mode === 'rows'
        ? ops.deleteRows(tableElement, { start: selection.startRow, end: selection.endRow }, ops.documentRef)
        : ops.deleteColumns(tableElement, { start: selection.startColumn, end: selection.endColumn }, ops.documentRef);

    ops.syncEditor(vditor);
    ops.requestFrame(() => {
        if (result.tableRemoved) {
            ops.focusAfterRemoval(parentElement, nextSibling, ops.documentRef);
            return;
        }

        const nextFocus = getNearestFocusTarget(tableElement, selection);
        ops.focusCell(root, tableIndex, nextFocus.rowIndex, nextFocus.columnIndex);
    });

    return result;
}

const resolveControllerFromTarget = (target, controllers) => {
    const cell = resolveCellFromTarget(target);
    const tableElement = resolveTableFromCell(cell);
    if (!cell || !tableElement) {
        return { controller: null, cell: null, tableElement: null };
    }

    const controller = controllers.find((entry) => entry.tableElement === tableElement) || null;
    return { controller, cell, tableElement };
};

export function installTableDeleteSelection(vditor, options = {}) {
    const documentRef = typeof document === 'undefined' ? null : document;
    const defaultWindow = typeof window === 'undefined'
        ? { addEventListener() {}, removeEventListener() {}, getSelection: () => null }
        : window;
    const ops = {
        resolveRoot: () => documentRef?.querySelector('.vditor-ir') || null,
        resolvePointerTarget: () => documentRef,
        resolveKeyTarget: (root) => root,
        collectMetrics: collectTableCellMetrics,
        mountOverlay: (config) => mountTableDeleteSelectionOverlay(config),
        applyDeleteAction: (config) => applyTableDeleteSelection(config),
        createMutationObserver: (callback) => new MutationObserver(callback),
        createResizeObserver: (callback) => new ResizeObserver(callback),
        requestFrame: (callback) => requestAnimationFrame(callback),
        cancelFrame: (id) => cancelAnimationFrame(id),
        clearNativeSelection: () => defaultWindow.getSelection?.()?.removeAllRanges?.(),
        windowRef: defaultWindow,
        ...options,
    };

    const root = ops.resolveRoot();
    if (!root) {
        return () => {};
    }

    const pointerTarget = ops.resolvePointerTarget(root) || root;
    const keyTarget = ops.resolveKeyTarget(root) || root;
    let rafId = null;
    let dragState = null;
    let activeSelection = null;
    const controllers = [];
    const resizeObservers = [];

    const clearActiveSelection = () => {
        dragState = null;
        if (!activeSelection?.controller) {
            return;
        }

        activeSelection.controller.clearSelection();
        activeSelection = null;
    };

    const rerender = () => {
        dragState = null;
        activeSelection = null;
        while (controllers.length) {
            controllers.pop().cleanup();
        }
        while (resizeObservers.length) {
            resizeObservers.pop().disconnect();
        }

        const tableElements = Array.from(root.querySelectorAll('table'));
        tableElements.forEach((tableElement) => {
            const controller = ops.mountOverlay({
                documentRef,
                root,
                tableElement,
                metrics: ops.collectMetrics(tableElement),
                onSelectionChange: (selection) => {
                    if (!selection) {
                        if (activeSelection?.controller === controller) {
                            activeSelection = null;
                        }
                        return;
                    }

                    controllers.forEach((entry) => {
                        if (entry !== controller) {
                            entry.clearSelection();
                        }
                    });
                    activeSelection = { tableElement, selection, controller };
                },
            });
            controllers.push(controller);

            let hasObservedInitialResize = false;
            const resizeObserver = ops.createResizeObserver(() => {
                if (!hasObservedInitialResize) {
                    hasObservedInitialResize = true;
                    return;
                }

                schedule();
            });
            resizeObserver.observe(tableElement);
            resizeObservers.push(resizeObserver);
        });
    };

    const schedule = () => {
        if (rafId !== null) {
            ops.cancelFrame(rafId);
        }
        rafId = ops.requestFrame(() => {
            rerender();
            rafId = null;
        });
    };

    const handleMouseDown = (event) => {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        const { controller, cell } = resolveControllerFromTarget(event.target, controllers);
        if (!controller || !cell) {
            clearActiveSelection();
            return;
        }

        if (activeSelection?.controller && activeSelection.controller !== controller) {
            clearActiveSelection();
        } else if (activeSelection?.controller === controller) {
            controller.clearSelection();
            activeSelection = null;
        }

        controller.beginDrag(cell);
        dragState = { controller };
    };

    const handleMouseMove = (event) => {
        if (!dragState?.controller) {
            return;
        }

        const result = dragState.controller.updateDrag(event.target);
        if (!result.activated) {
            return;
        }

        event.preventDefault?.();
        ops.clearNativeSelection();
    };

    const handleMouseUp = () => {
        dragState?.controller?.finishDrag?.();
        dragState = null;
    };

    const handleKeyDown = (event) => {
        if (!activeSelection) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            clearActiveSelection();
            return;
        }

        if (event.key !== 'Delete' && event.key !== 'Backspace') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (!activeSelection.selection.deletable) {
            return;
        }

        const currentSelection = activeSelection;
        activeSelection = null;
        currentSelection.controller.clearSelection();
        ops.applyDeleteAction({
            vditor,
            root,
            tableElement: currentSelection.tableElement,
            selection: currentSelection.selection,
        });
        schedule();
    };

    const mutationObserver = ops.createMutationObserver((records) => {
        if (mutationsNeedRerender(records)) {
            schedule();
        }
    });
    schedule();
    mutationObserver.observe(root, { childList: true, subtree: true, characterData: true });
    pointerTarget.addEventListener('mousedown', handleMouseDown, true);
    pointerTarget.addEventListener('mousemove', handleMouseMove, true);
    pointerTarget.addEventListener('mouseup', handleMouseUp, true);
    keyTarget.addEventListener('keydown', handleKeyDown);
    ops.windowRef.addEventListener('resize', schedule);

    return () => {
        dragState = null;
        activeSelection = null;
        if (rafId !== null) {
            ops.cancelFrame(rafId);
        }
        while (controllers.length) {
            controllers.pop().cleanup();
        }
        while (resizeObservers.length) {
            resizeObservers.pop().disconnect();
        }
        mutationObserver.disconnect();
        pointerTarget.removeEventListener('mousedown', handleMouseDown, true);
        pointerTarget.removeEventListener('mousemove', handleMouseMove, true);
        pointerTarget.removeEventListener('mouseup', handleMouseUp, true);
        keyTarget.removeEventListener('keydown', handleKeyDown);
        ops.windowRef.removeEventListener('resize', schedule);
    };
}
