# Table Design Reference for DX Hub Applications

> **Purpose**: Provide a complete reference for implementing table experiences that mirror monday.com tables using Vibe components, application tokens, and inclusive header behaviors.

## 1. Core Principles
- **Clarity first**: Every column must communicate ownership, status, and next steps at a glance without opening rows.
- **Inline workflows**: Prefer inline editing, drag-and-drop column ordering, and contextual actions to keep users in the table view.
- **Live feedback**: Reflect loading, saving, or error states in-line with skeletons, badges, and row banners.
- **Consistency**: Reuse shared tokens (`--dx-primary`, `--dx-border`, `--dx-radius-sm`, `--dx-font-text1-normal`) and @vibe/core primitives to match monday.com look and feel.

## 2. Table Anatomy
1. **Table Shell**
   - Wrap tables in `TableContainer` (`@vibe/core/Table`) with `surface="primary"` so it pulls `--application-surface-color`.
   - Use `padding: var(--page-padding-y) var(--page-padding-x)` on the parent region to align with app shell gutters.
   - Sticky headers require the container to manage `overflow: auto` and `position: relative`.
2. **Header Stack**
   - **Primary header**: Board title, view switcher, last updated metadata.
   - **Toolbar row**: Filter chips, `Search`, `MenuButton` for view actions, `Button` for "New". Use `@vibe/core/Toolbar` with tokens `gap: var(--dx-space-3)`.
   - **Column header bar**: Provided by `TableHeader`. Columns expose sorting, resizing, and context menus.
3. **Body & Footer**
   - `TableBody` handles zebra striping with `--table-row-alt-bg: rgba(103, 104, 121, 0.04)`.
   - Virtualized sections should use `@vibe/code/DataGrid` or `@vibe/code/VirtualTable` to keep sticky header and selection area in sync.
   - Footer hosts bulk actions, pagination, or summary rows with `TableFooter`.

## 3. Tokens & Theming
- **Surface & background**
  - Canvas: `background: var(--application-background-color)`.
  - Table shell: `background: var(--application-surface-color); border: 1px solid var(--dx-border); border-radius: var(--dx-radius-lg)`.
- **Typography**
  - Header cells: `font: var(--dx-font-text2-medium); text-transform: none; letter-spacing: 0`.
  - Data cells: `font: var(--dx-font-text1-normal)` with `line-height: 20px`.
- **Spacing**
  - Default row height: `min-height: 40px` (`padding-block: var(--dx-space-2)`).
  - Compact density: `min-height: 32px` triggered via `density="compact"` prop.
  - Column padding: `padding-inline: var(--dx-space-3)`.
- **Color states**
  - Hover: `background: color-mix(in srgb, var(--dx-primary) 8%, transparent)`.
  - Selected: `background: color-mix(in srgb, var(--dx-primary) 16%, transparent); border-left: 3px solid var(--dx-primary)`.
  - Focus ring: `outline: 2px solid var(--dx-primary-selected); outline-offset: -2px`.

## 4. Column Patterns
| Column Type | Component | Tokens | Notes |
| --- | --- | --- | --- |
| Status | `@vibe/code/StatusColumn` | `--status-color-done`, `--status-color-working`, `--status-color-stuck` | Use pill badges, enable inline status picker (`Dropdown` + icons). |
| People | `@vibe/code/PeopleColumn` | `--avatar-size-sm`, `--dx-space-2` | Display avatars + role, support multi-select with `DialogType=popover`. |
| Timeline / Date Range | `@vibe/code/TimelineColumn` | `--timeline-track-bg`, `--positive-color` | Render mini progress bars, highlight overdue with `--negative-color`. |
| Numbers | `TableCell align="end"` + `NumberInput` | `--dx-font-mono` optional | Provide `formatNumber` utility and totals row. |
| Tags | `@vibe/core/Tag` group | `--tag-gap: var(--dx-space-1)` | Collapse overflow into "+N" badge with tooltip. |
| Mirror / Link | `@vibe/code/RelationColumn` | `--link-color` | Display linked board icon + summary. |

### Column Behavior Checklist
- Enable resize handles via `column.enableResizing = true` (adds 4px drag area using `::after`).
- Provide column context menu (`ColumnMenu`) with sort, filter, hide, duplicate, and delete actions.
- Persist ordering, visibility, width, and sorting in `/api/preferences/tables/:viewId`.

## 5. Header Functions
- **Sorting**: `TableSortLabel` within header cell; show icon aligned right, use aria `aria-sort` with values `ascending`, `descending`, or `none`.
- **Filtering**: Provide filter chip summary under primary header. Each column menu should open `FilterPopover` using `@vibe/core/Dialog` with `type="popover"` and `surface="primary"`.
- **Grouping**: Use `@vibe/code/GroupHeaderRow` to cluster rows by status/owner. Group headers adopt `background: var(--group-header-bg, #f6f7fb)` and `font-weight: 600`.
- **Aggregations**: Show summary row pinned to bottom using `TableFooter`. Format numbers via `Intl.NumberFormat` and highlight totals with `--dx-text-strong`.
- **View Controls**: Provide `ViewTabs` aligned with header to switch between Table/Kanban/Calendar using `@vibe/code/ViewSwitcher`.

## 6. Skeletons & Loading States
- Replace body with `@vibe/core/Skeleton` rows: `SkeletonLine` width 60-90% inside cells.
- Keep header, toolbar, and filters interactive while skeleton loads data.
- For async column metadata, show `SkeletonRectangle` 24x24 in column header before icons load.
- Bulk operations show inline banner row with `@vibe/core/Notification` `type="loading"` pinned above the table.

## 7. Row States & Inline Editing
- **Default**: zebra stripes using `nth-child(even)` tinted with `--table-row-alt-bg`.
- **Hover**: lighten background and display inline action buttons (e.g., `IconButton` for quick actions) using `opacity` transitions.
- **Selection**: Multi-select via leading checkbox column. When selection exists, show `BulkActionsBar` anchored bottom with `surface="secondary"` tokens.
- **Editing**: Use `@vibe/core/Editable` wrappers. On edit, highlight cell border `box-shadow: 0 0 0 2px color-mix(in srgb, var(--dx-primary) 35%, transparent)`.
- **Error**: Show `InlineError` component below the cell with `font-size: 12px; color: var(--negative-color)` and keep focus inside the cell until resolved.

## 8. Accessibility
- Tables must use semantic `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<td>` generated by `@vibe/core/Table`.
- Provide row selection using `aria-checked` and `role="rowheader"` for the primary column.
- Keyboard commands:
  - `Tab`/`Shift+Tab` move between focusable elements.
  - `Arrow` keys move cell focus when virtualization is enabled (`useTableKeyboardNavigation`).
  - `Enter` toggles edit mode, `Esc` cancels, `Cmd/Ctrl+S` commits inline edits.
- Ensure color contrast ≥ 4.5:1; rely on tokens for dark mode compatibility.

## 9. Responsiveness & Density
- Breakpoints follow `--bp-sm: 640px`, `--bp-md: 960px`, `--bp-lg: 1280px`.
- Below `--bp-md` transform table into stacked cards using `@vibe/code/TableCardView`. Each card repeats column label using `Label` and data using respective field components.
- Provide density toggle in toolbar using `SegmentedToggle` (`values: comfortable | compact`). Persist user choice per board.
- Column overflow uses horizontal scroll with gradient fade edges (`mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent)`).

## 10. Empty, Error, and Success States
- **Empty**: Show `EmptyState` with illustration (120px), call-to-action `Button type="primary"`, and short description.
- **Error**: Display inline `Notification status="danger"` spanning full width above the table, with retry button.
- **Success**: Use `Toast` anchored bottom-left to confirm bulk updates or imports.
- Import flows show progress rows with `ProgressBar` inside cells.

## 11. Implementation Workflow
1. Define data model and view preferences schema.
2. Compose table using `@vibe/code/DataGrid` with column definitions typed via `ColumnDef<Row>`.
3. Hook filters, sorting, and pagination into TanStack Table state managed through React Query or SWR.
4. Persist UI state after every change using `useDebouncedPersist` to avoid flooding API.
5. Instrument events (`table.column_sorted`, `table.row_edited`) via `trackEvent` with metadata (viewId, columnId, direction).

## 12. Quality Checklist
- [ ] Header sticks on vertical scroll and retains drop shadow (`box-shadow: var(--shadow-sm)` when `scrollTop > 0`).
- [ ] Column resizing persists and respects minimum width (120px) and maximum (480px).
- [ ] Keyboard navigation covers header buttons, filters, and cells.
- [ ] Skeletons mirror final layout (same column widths).
- [ ] Bulk selection bar appears after 1+ rows selected and hides when selection clears.
- [ ] Responsive card view renders from same column definitions.
- [ ] All icons come from `@vibe/icons`.
- [ ] Ensure analytics events fire on load, column change, selection, and inline save.

## 13. References
- Vibe Table documentation: `https://vibe.monday.com/?path=/docs/components-table--docs`.
- Internal tokens: `src/app/globals.css`, `tailwind.config.ts`, and component-level CSS modules for examples.
- Existing implementations: `src/features/sequences/manager/components/SequenceManagerPage.tsx` for toolbar + table layout.

