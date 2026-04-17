const HOT_ZONE_RADIUS = 8;
const ACTIVE_LINE_THICKNESS = 2.5;
const OVERLAY_CLASS_PREFIX = 'vditor-table-insert-';
const OVERLAY_ROOT_CLASS = 'vditor-table-insert-overlay';

const buildVerticalBoundary = (column, side, tableRect, id) => {
    const x = side === 'before' ? column.left : column.right;

    return {
        id,
        axis: 'column',
        side,
        anchorCell: column.anchorCell,
        line: {
            x1: x,
            y1: 0,
            x2: x,
            y2: tableRect.bottom,
        },
        midpoint: {
            x,
            y: tableRect.bottom / 2,
        },
        hotZone: {
            left: x - HOT_ZONE_RADIUS,
            top: 0,
            width: HOT_ZONE_RADIUS * 2,
            height: tableRect.bottom,
        },
    };
};

const buildHorizontalBoundary = (row, side, tableRect, id) => {
    const y = side === 'before' ? row.top : row.bottom;
    const left = row.left ?? 0;
    const right = row.right ?? tableRect.right;

    return {
        id,
        axis: 'row',
        side,
        anchorCell: row.anchorCell,
        line: {
            x1: left,
            y1: y,
            x2: right,
            y2: y,
        },
        midpoint: {
            x: left + ((right - left) / 2),
            y,
        },
        hotZone: {
            left,
            top: y - HOT_ZONE_RADIUS,
            width: right - left,
            height: HOT_ZONE_RADIUS * 2,
        },
    };
};

export function buildLogicalBoundaryTargets(metrics) {
    if (!metrics?.columns?.length || !metrics?.rows?.length) {
        return { vertical: [], horizontal: [] };
    }

    const vertical = [
        buildVerticalBoundary(metrics.columns[0], 'before', metrics.tableRect, 'column-before-0'),
        ...metrics.columns.map((column, columnIndex) =>
            buildVerticalBoundary(column, 'after', metrics.tableRect, `column-after-${columnIndex}`),
        ),
    ];

    const horizontal = [
        buildHorizontalBoundary(metrics.rows[0], 'before', metrics.tableRect, 'row-before-0'),
        ...metrics.rows.map((row, rowIndex) =>
            buildHorizontalBoundary(row, 'after', metrics.tableRect, `row-after-${rowIndex}`),
        ),
    ];

    return { vertical, horizontal };
}

export function getBoundaryInsertAction(boundary) {
    return {
        axis: boundary.axis,
        side: boundary.side,
        anchorCell: boundary.anchorCell,
        insertHeader:
            boundary.axis === 'row'
            && boundary.side === 'before'
            && boundary.anchorCell?.rowIndex === 0
            && boundary.anchorCell?.isHeader === true,
    };
}

const relativeRect = (rect, tableRect) => ({
    left: rect.left - tableRect.left,
    top: rect.top - tableRect.top,
    right: rect.right - tableRect.left,
    bottom: rect.bottom - tableRect.top,
});

export function collectTableMetrics(tableElement) {
    const tableRect = tableElement.getBoundingClientRect();
    const normalizedTableRect = {
        left: 0,
        top: 0,
        right: tableRect.right - tableRect.left,
        bottom: tableRect.bottom - tableRect.top,
    };

    const rows = Array.from(tableElement.rows || []).map((row, rowIndex) => {
        const cells = Array.from(row.cells || []);
        const firstRect = relativeRect(cells[0].getBoundingClientRect(), tableRect);
        const lastRect = relativeRect(cells[cells.length - 1].getBoundingClientRect(), tableRect);

        return {
            top: firstRect.top,
            bottom: firstRect.bottom,
            left: firstRect.left,
            right: lastRect.right,
            anchorCell: {
                rowIndex,
                columnIndex: 0,
                isHeader: cells[0].tagName === 'TH',
            },
        };
    });

    const headerRow = tableElement.rows?.[0];
    const columns = Array.from(headerRow?.cells || []).map((cell, columnIndex) => {
        const rect = relativeRect(cell.getBoundingClientRect(), tableRect);

        return {
            left: rect.left,
            right: rect.right,
            anchorCell: {
                rowIndex: 0,
                columnIndex,
                isHeader: cell.tagName === 'TH',
            },
        };
    });

    return {
        tableRect: normalizedTableRect,
        columns,
        rows,
    };
}

export function getBoundaryOverlayState(boundary, active = false) {
    const isVertical = boundary.axis === 'column';
    const lineThickness = active ? ACTIVE_LINE_THICKNESS : 1;
    const lineSpan = isVertical
        ? `${boundary.line.y2 - boundary.line.y1}px`
        : `${boundary.line.x2 - boundary.line.x1}px`;

    return {
        hitZoneStyle: {
            left: `${boundary.hotZone.left}px`,
            top: `${boundary.hotZone.top}px`,
            width: `${boundary.hotZone.width}px`,
            height: `${boundary.hotZone.height}px`,
            cursor: 'pointer',
        },
        lineStyle: isVertical
            ? {
                left: `${boundary.midpoint.x}px`,
                top: `${boundary.midpoint.y}px`,
                width: `${lineThickness}px`,
                height: lineSpan,
            }
            : {
                left: `${boundary.midpoint.x}px`,
                top: `${boundary.midpoint.y}px`,
                width: lineSpan,
                height: `${lineThickness}px`,
            },
        triangleStyle: {
            left: `${boundary.midpoint.x}px`,
            top: `${boundary.midpoint.y}px`,
        },
        triangleDirection: isVertical
            ? (boundary.side === 'before' ? 'left' : 'right')
            : (boundary.side === 'before' ? 'up' : 'down'),
    };
}

const createEmptyCell = (documentRef, tagName, templateCell) => {
    const cell = documentRef.createElement(tagName);
    const align = templateCell?.getAttribute?.('align');
    if (align) {
        cell.setAttribute('align', align);
    }
    cell.textContent = ' ';
    return cell;
};

export function insertColumn(tableElement, columnIndex, side, documentRef = document) {
    Array.from(tableElement.rows || []).forEach((row, rowIndex) => {
        const referenceCell = row.cells[columnIndex];
        const nextCell = createEmptyCell(documentRef, rowIndex === 0 ? 'th' : 'td', referenceCell);
        referenceCell.insertAdjacentElement(side === 'before' ? 'beforebegin' : 'afterend', nextCell);
    });
}

export function insertBodyRow(tableElement, rowIndex, side, documentRef = document) {
    const referenceRow = tableElement.rows[rowIndex];
    const nextRow = documentRef.createElement('tr');
    const tbody = tableElement.tBodies?.[0] || tableElement.createTBody();

    Array.from(referenceRow.cells || []).forEach((cell) => {
        nextRow.appendChild(createEmptyCell(documentRef, 'td', cell));
    });

    if (referenceRow.parentElement?.tagName === 'THEAD') {
        tbody.insertBefore(nextRow, tbody.firstChild || null);
        return;
    }

    referenceRow.insertAdjacentElement(side === 'before' ? 'beforebegin' : 'afterend', nextRow);
}

export function insertHeaderRow(tableElement, documentRef = document) {
    const currentHeaderRow = tableElement.tHead?.rows?.[0] || tableElement.rows?.[0];
    const thead = tableElement.tHead || tableElement.createTHead();
    const tbody = tableElement.tBodies?.[0] || tableElement.createTBody();
    const freshHeaderRow = documentRef.createElement('tr');
    const demotedRow = documentRef.createElement('tr');

    Array.from(currentHeaderRow.cells || []).forEach((cell) => {
        freshHeaderRow.appendChild(createEmptyCell(documentRef, 'th', cell));

        const bodyCell = createEmptyCell(documentRef, 'td', cell);
        bodyCell.textContent = cell.textContent || ' ';
        demotedRow.appendChild(bodyCell);
    });

    thead.insertBefore(freshHeaderRow, thead.firstChild || null);
    tbody.insertBefore(demotedRow, tbody.firstChild || null);
    currentHeaderRow.remove();
}

export function focusInsertedCell(root, tableIndex, rowIndex, columnIndex) {
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

export function syncTableInsert(vditor, adapters = {}) {
    const ops = {
        resolveInternal: (editor) => editor?.vditor || null,
        dispatchInput: (element) => {
            const event = typeof InputEvent === 'function'
                ? new InputEvent('input', { bubbles: true })
                : new Event('input', { bubbles: true });
            element.dispatchEvent(event);
        },
        fallbackSync: (editor) => {
            if (typeof editor?.setValue === 'function' && typeof editor?.getValue === 'function') {
                editor.setValue(editor.getValue());
            }
        },
        ...adapters,
    };

    const internal = ops.resolveInternal(vditor);
    if (internal?.currentMode === 'ir' && internal.ir?.element) {
        internal.ir.preventInput = true;
        ops.dispatchInput(internal.ir.element);
        return;
    }

    ops.fallbackSync(vditor);
}

export function applyTableInsertAction({ vditor, tableElement, boundary, adapters = {} }) {
    const action = getBoundaryInsertAction(boundary);
    const ops = {
        insertHeaderRow,
        insertBodyRow,
        insertColumn,
        syncEditor: syncTableInsert,
        focusInsertedCell,
        resolveRoot: () => document.querySelector('.vditor-ir .vditor-reset'),
        resolveTableIndex: (candidateTable) =>
            Array.from(document.querySelectorAll('.vditor-ir .vditor-reset table')).indexOf(candidateTable),
        requestFrame: (callback) => requestAnimationFrame(callback),
        ...adapters,
    };

    const tableIndex = ops.resolveTableIndex(tableElement);
    let nextFocus = {
        tableIndex,
        rowIndex: action.anchorCell.rowIndex,
        columnIndex: action.anchorCell.columnIndex,
    };

    if (action.insertHeader) {
        ops.insertHeaderRow(tableElement);
        nextFocus = { tableIndex, rowIndex: 0, columnIndex: 0 };
    } else if (action.axis === 'row') {
        ops.insertBodyRow(tableElement, action.anchorCell.rowIndex, action.side);
        nextFocus = {
            tableIndex,
            rowIndex: action.side === 'before' ? action.anchorCell.rowIndex : action.anchorCell.rowIndex + 1,
            columnIndex: 0,
        };
    } else {
        ops.insertColumn(tableElement, action.anchorCell.columnIndex, action.side);
        nextFocus = {
            tableIndex,
            rowIndex: 0,
            columnIndex: action.side === 'before' ? action.anchorCell.columnIndex : action.anchorCell.columnIndex + 1,
        };
    }

    ops.syncEditor(vditor);
    ops.requestFrame(() => {
        ops.focusInsertedCell(ops.resolveRoot(), nextFocus.tableIndex, nextFocus.rowIndex, nextFocus.columnIndex);
    });

    return nextFocus;
}

const isOverlayMutationNode = (node) => {
    if (!node) {
        return false;
    }

    if (node.nodeType === 3) {
        return isOverlayMutationNode(node.parentElement);
    }

    const className = typeof node.className === 'string' ? node.className : '';
    if (className.split(/\s+/).some((token) => token.startsWith(OVERLAY_CLASS_PREFIX))) {
        return true;
    }

    return typeof node.closest === 'function'
        && Boolean(node.closest(`.${OVERLAY_ROOT_CLASS}`));
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
            return touchedNodes.some((node) => !isOverlayMutationNode(node));
        }

        return !isOverlayMutationNode(record.target);
    });
};

const translateOverlayState = (state, offsetX, offsetY) => ({
    hitZoneStyle: {
        ...state.hitZoneStyle,
        left: `${parseFloat(state.hitZoneStyle.left) + offsetX}px`,
        top: `${parseFloat(state.hitZoneStyle.top) + offsetY}px`,
    },
    lineStyle: {
        ...state.lineStyle,
        left: `${parseFloat(state.lineStyle.left) + offsetX}px`,
        top: `${parseFloat(state.lineStyle.top) + offsetY}px`,
    },
    triangleStyle: {
        left: `${parseFloat(state.triangleStyle.left) + offsetX}px`,
        top: `${parseFloat(state.triangleStyle.top) + offsetY}px`,
    },
    triangleDirection: state.triangleDirection,
});

const getTableOffsetWithinRoot = (tableElement, root) => {
    const tableRect = tableElement.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();

    return {
        x: tableRect.left - rootRect.left,
        y: tableRect.top - rootRect.top,
    };
};

const createBoundaryNodes = (documentRef, boundary, activeBoundaryId, offset, handleInsert) => {
    const state = translateOverlayState(
        getBoundaryOverlayState(boundary, boundary.id === activeBoundaryId),
        offset.x,
        offset.y,
    );
    const wrapper = documentRef.createElement('button');
    wrapper.type = 'button';
    wrapper.className = 'vditor-table-insert-hitzone';
    wrapper.dataset.boundaryId = boundary.id;
    Object.assign(wrapper.style, state.hitZoneStyle);

    const line = documentRef.createElement('span');
    line.className = `vditor-table-insert-line${boundary.id === activeBoundaryId ? ' vditor-table-insert-line--active' : ''}`;
    Object.assign(line.style, state.lineStyle);

    const triangle = documentRef.createElement('span');
    triangle.className = `vditor-table-insert-triangle vditor-table-insert-triangle--${state.triangleDirection}${boundary.id === activeBoundaryId ? ' vditor-table-insert-triangle--active' : ''}`;
    Object.assign(triangle.style, state.triangleStyle);

    wrapper.addEventListener('mouseenter', () => handleInsert({ type: 'activate', boundary }));
    wrapper.addEventListener('mouseleave', () => handleInsert({ type: 'clear', boundary }));
    wrapper.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button !== undefined && event.button !== 0) {
            return;
        }
        handleInsert({ type: 'insert', boundary });
    });
    wrapper.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    return [wrapper, line, triangle];
};

export function mountTableInsertOverlay({ documentRef = document, root, tableElement, boundaries, onInsert }) {
    const overlay = documentRef.createElement('div');
    overlay.className = 'vditor-table-insert-overlay';
    root.appendChild(overlay);

    const offset = getTableOffsetWithinRoot(tableElement, root);
    let activeBoundaryId = null;
    const render = () => {
        overlay.replaceChildren(
            ...boundaries.flatMap((group) =>
                group.map((boundary) =>
                    createBoundaryNodes(documentRef, boundary, activeBoundaryId, offset, ({ type, boundary: nextBoundary }) => {
                        if (type === 'activate') {
                            activeBoundaryId = nextBoundary.id;
                            render();
                            return;
                        }
                        if (type === 'clear') {
                            activeBoundaryId = null;
                            render();
                            return;
                        }
                        activeBoundaryId = null;
                        onInsert(nextBoundary);
                    }),
                ),
            ).flat(),
        );
    };

    render();

    return () => {
        overlay.remove();
    };
}

export function installTableInsertHandles(vditor, options = {}) {
    const windowRef = typeof window === 'undefined'
        ? { addEventListener() {}, removeEventListener() {} }
        : window;
    const documentRef = typeof document === 'undefined' ? null : document;

    const ops = {
        resolveRoot: () => documentRef?.querySelector('.vditor-ir') || null,
        collectMetrics: collectTableMetrics,
        buildTargets: buildLogicalBoundaryTargets,
        mountOverlay: (root, tableElement, boundaries, handleInsert) =>
            mountTableInsertOverlay({
                root,
                tableElement,
                boundaries: [boundaries.vertical, boundaries.horizontal],
                onInsert: handleInsert,
            }),
        createMutationObserver: (callback) => new MutationObserver(callback),
        createResizeObserver: (callback) => new ResizeObserver(callback),
        requestFrame: (callback) => requestAnimationFrame(callback),
        cancelFrame: (id) => cancelAnimationFrame(id),
        windowRef,
        ...options,
    };

    const root = ops.resolveRoot();
    if (!root) {
        return () => {};
    }

    let rafId = null;
    const overlayCleanups = [];
    const resizeObservers = [];

    const rerender = () => {
        while (overlayCleanups.length) {
            overlayCleanups.pop()();
        }
        while (resizeObservers.length) {
            resizeObservers.pop().disconnect();
        }

        const tableElements = Array.from(root.querySelectorAll('table'));
        tableElements.forEach((tableElement) => {
            const metrics = ops.collectMetrics(tableElement);
            const boundaries = ops.buildTargets(metrics);
            overlayCleanups.push(
                ops.mountOverlay(root, tableElement, boundaries, (boundary) =>
                    applyTableInsertAction({ vditor, tableElement, boundary }),
                ),
            );
            const resizeObserver = ops.createResizeObserver(schedule);
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

    const mutationObserver = ops.createMutationObserver((records) => {
        if (mutationsNeedRerender(records)) {
            schedule();
        }
    });
    schedule();
    mutationObserver.observe(root, { childList: true, subtree: true, characterData: true });
    ops.windowRef.addEventListener('resize', schedule);

    return () => {
        if (rafId !== null) {
            ops.cancelFrame(rafId);
        }
        while (overlayCleanups.length) {
            overlayCleanups.pop()();
        }
        while (resizeObservers.length) {
            resizeObservers.pop().disconnect();
        }
        mutationObserver.disconnect();
        ops.windowRef.removeEventListener('resize', schedule);
    };
}
