# Vditor Table Insert Handles Design

Date: 2026-04-17
Status: Proposed
Scope: Main desktop editor table insertion interaction in Vditor IR mode

## Summary

Add hover-driven insert handles for tables in the main rich text editor so users can insert full rows and full columns by clicking logical table boundary lines. The interaction is desktop-only, appears only on hover, highlights an entire logical row or column boundary, and shows a single triangle at the boundary midpoint pointing toward the insertion side.

## Goals

- Make table row and column insertion discoverable without using keyboard shortcuts or toolbar menus.
- Keep the interaction visually clear: hover a line, see the whole line highlight, see one directional triangle, click to insert.
- Preserve the current Vditor-based editing flow without patching vendor source files.
- Keep overlay UI separate from editor content so table Markdown/HTML serialization stays clean.

## Non-Goals

- Mobile or touch interaction.
- New delete, resize, merge, or drag behaviors.
- Changes to comment editors, annotation mini editors, or other Vditor instances outside the main editor.

## User Decisions Captured

- The feature is desktop-only.
- Handles activate only on hover near a logical table boundary line.
- Hover feedback must be more visible than the normal border: the active line becomes thicker and more obvious.
- The active boundary uses a pointer cursor.
- A single triangle is shown at the geometric midpoint of the active logical line.
- Clicking inserts an entire row or entire column, not a single cell segment.
- The top horizontal boundary inserts a new header row.

## Interaction Model

### Logical Boundaries

The interaction model is based on full logical table boundaries, not per-cell edge segments.

For a table with `N` columns and `M` rows, the user-visible insert targets are:

- `N + 1` vertical logical boundaries
- `M + 1` horizontal logical boundaries

Examples:

- A `2 x 2` table exposes `3` vertical boundaries and `3` horizontal boundaries.
- A `1 x 2` table exposes `3` vertical boundaries and `2` horizontal boundaries.

The implementation may derive these logical boundaries from cell geometry, but the user should always see and interact with one full line per insertion boundary.

### Hover Activation

- The table shows no extra handles by default.
- When the pointer enters a boundary hot zone, one logical boundary becomes active.
- Only one boundary can be active at a time.
- The hot zone extends a small distance on both sides of the logical line so the line is easy to target.
- The editor must suppress text-selection side effects while interacting with the insert overlay.

### Hover Visuals

- The active logical boundary line is highlighted across its full visible span.
- The active line becomes thicker than the default table border, approximately `2px` to `3px`, with `2.5px` as the working target.
- The highlight color uses the existing editor blue family, centered around `#007AFF`.
- A subtle outer glow may be used to improve visibility, but it must stay lighter than a selected-row or selected-column treatment.
- A single triangle appears at the geometric midpoint of the active logical line.
- The triangle sits slightly outside the table edge it points through, preserving a clean “insert here” cue.
- Both line and triangle fade in quickly, around `120ms`.
- The pointer changes to `cursor: pointer`.

### Click Semantics

Clicking a logical boundary inserts full structure:

- Vertical boundary click inserts one full column.
- Horizontal boundary click inserts one full row.

Specific mapping:

- Left outer boundary: insert column before column 1.
- Internal vertical boundary: insert column after the column immediately to its left.
- Right outer boundary: insert column after the last column.
- Top outer boundary: insert a new header row before the current header row, and demote the previous header row into the first body row.
- Internal horizontal boundary: insert row after the row immediately above the boundary.
- Bottom outer boundary: insert row after the last body row.

### Post-Click Behavior

- The table updates immediately.
- The overlay is recalculated from the updated table structure.
- The caret moves into the first cell of the newly inserted row or column.
- The previous hover state is cleared.

## Technical Design

### Integration Strategy

Implement this as a local editor extension, following the existing pattern used for custom Vditor enhancements in the project:

- Add a new utility module, e.g. `frontend/src/utils/vditorTableInsertHandles.js`.
- Install it from the main editor’s Vditor setup in `frontend/src/pages/Editor.jsx`.
- Compose it through the existing `after` and `input` extension flow built by `buildVditorEditorOptions`.

Do not modify files under `frontend/public/vendor/vditor/`.

### Main Components

#### 1. Table Overlay Installer

Responsibilities:

- Locate the main IR editor root.
- Watch for table creation, deletion, and re-render.
- Create and destroy overlay roots per table.
- Recompute overlay geometry whenever the table layout changes.

Likely triggers:

- Vditor `after` callback
- Vditor `input` callback
- MutationObserver on the IR content root
- ResizeObserver on active tables or the editor container

#### 2. Logical Boundary Collector

Responsibilities:

- Read current table DOM geometry.
- Derive logical vertical and horizontal insertion boundaries.
- Store enough metadata for both rendering and click dispatch.

Each logical boundary record should include:

- `axis`: `row` or `column`
- `side`: `before` or `after`
- `tableElement`
- `anchorCell`
- `startX`, `endX`, `startY`, `endY`
- `midpointX`, `midpointY`
- `hotZoneRect`

The collector may inspect cell rectangles to derive full logical lines, but the output must represent whole-line targets.

#### 3. Overlay Renderer

Responsibilities:

- Render invisible hit areas for hover targeting.
- Render the visible active line and triangle for the currently active boundary.
- Keep overlay elements positioned above the table but outside serialized content.

Key constraints:

- Overlay must not become part of table Markdown or editor value.
- Overlay must not shift table layout.
- Overlay must be clipped and layered so that it remains visible over the table border without covering table text unnecessarily.

#### 4. Command Bridge

Responsibilities:

- Translate a boundary click into a row/column insert command.
- Reuse Vditor-compatible table mutation logic locally instead of editing vendor code.
- Restore focus and selection after insertion.

The bridge should mirror current Vditor table behaviors:

- Insert row before/after
- Insert column before/after
- Insert header row when acting on the top boundary and shift the previous header row into the body
- Re-run Vditor post-render behavior so the editor state, preview state, and undo stack remain coherent

## Data and Control Flow

1. Vditor renders or updates editor content.
2. Table insert handle installer scans the IR root for tables.
3. For each eligible table, the boundary collector derives logical line targets.
4. The overlay renderer places hover hit zones and prepares active-state visuals.
5. Pointer enters a hit zone.
6. The matching logical line becomes active.
7. The renderer highlights the full line and shows the midpoint triangle.
8. User clicks.
9. The command bridge mutates the table structure and restores caret placement.
10. The installer recomputes overlay state from the updated table.

## Eligibility Rules

This feature targets regular Vditor-generated Markdown tables in the main IR editor. The design assumes:

- One header row at the top of the table
- Standard rectangular row/column structure
- No special interaction is exposed outside the main editor instance

If a table cannot be mapped cleanly to the logical boundary model, the overlay should stay hidden rather than guessing.

## Error Handling and Safety

- If no stable anchor cell can be derived for a boundary, skip rendering that boundary.
- If insertion fails, clear active visuals and leave the editor content unchanged.
- If table geometry is temporarily incomplete during render, defer overlay generation to the next animation frame instead of using stale coordinates.
- Overlay listeners must be cleaned up when the table or editor is destroyed.

## Testing Strategy

### Pure Logic Tests

Add unit tests for boundary derivation and action mapping:

- `2 x 2` table yields `3` vertical and `3` horizontal logical boundaries.
- Left outer vertical boundary maps to `column-before`.
- Internal vertical boundary maps to the left column’s `column-after`.
- Top outer horizontal boundary maps to `row-before`.
- Internal horizontal boundary maps to the upper row’s `row-after`.

### DOM/Interaction Tests

Add focused tests for:

- Only one logical boundary activates at a time.
- Hovering a logical boundary activates full-line highlight, not a single cell edge segment.
- Midpoint triangle is placed at the logical line midpoint.
- Pointer cursor is applied for active hit zones.
- Clicking a vertical boundary inserts a full column.
- Clicking a horizontal boundary inserts a full row.
- Clicking the top boundary inserts a new header row.
- Caret lands in the first cell of the inserted structure.

### Regression Tests

Cover recomputation after:

- Re-rendering the same table
- Inserting multiple rows/columns in sequence
- Window resize or editor width change
- Row height change caused by content wrapping

## Acceptance Criteria

- Hovering near a logical insertion boundary highlights the entire boundary line.
- The active line is visibly thicker than the standard table border.
- A single triangle appears at the active line midpoint and points toward the insertion side.
- The pointer becomes `pointer` over active insert boundaries.
- Clicking a vertical boundary inserts exactly one full column in the correct position.
- Clicking a horizontal boundary inserts exactly one full row in the correct position.
- Clicking the top boundary inserts a new header row.
- After insertion, the table remains editable and the caret moves into the inserted structure.
- Overlay visuals are recalculated from the updated table and do not leave stale highlights behind.
- No overlay DOM leaks into serialized editor content.

## Implementation Notes

- Keep logical boundary calculation and click-action mapping as pure functions where possible.
- Keep DOM reads grouped together and schedule visual writes with `requestAnimationFrame` when needed.
- Prefer rebuilding overlay state from the current table DOM after structural changes rather than patching previous overlay geometry.
- Scope all selectors to the main editor instance to avoid affecting comment or annotation editors.
