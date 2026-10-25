<script lang="ts">
  /*
   * Renders the deck widget grid:
   *
   * 1. Empty cells positioned absolutely using runtime grid metrics arithmetic.
   * 2. Placed widgets positioned and sized to span their allocated columns and rows.
   * 3. Edit mode vs. live execution mode:
   *    - In edit mode, clicking an empty cell triggers new widget creation / cell selection,
   *      and clicking a placed widget selects it for inspection or configuration.
   *    - In runtime mode, clicking a widget executes its configured action flow.
   */
  import {
    type ActionButtonTriggerType,
    type EmptyCellStyle,
    type GridWidget,
    type UiNode,
    cellFromPoint,
    cellOffset,
    computeCellDimensions,
    contentScaleFor,
    isCellOccupied,
    spanSize,
  } from '@macro-deck/runtime';
  import WidgetPreview from '$lib/render/WidgetPreview.svelte';
  import { beginTileDrag, type TileDragState } from '$lib/deck-tile-drag';
  import { shellDropTarget } from '$lib/shell-drop-target.svelte';
  import { shellFileDrop } from '$lib/shell-file-drop.svelte';
  import { shellDropKind, type ShellDropKind } from '$lib/shell-drop.util';

  interface Props {
    cols?: number;
    rows?: number;
    widgets?: readonly GridWidget[];
    background?: string | null;
    spacing?: number;
    borderRadius?: number | null;
    emptyCellStyle?: EmptyCellStyle;
    shadows?: boolean;
    editMode?: boolean;
    /** Render each tile through its host UI session instead of a label fallback. */
    live?: boolean;
    selectedWidgetId?: string | null;
    busyCell?: { x: number; y: number } | null;
    oncellclick?: (cell: { x: number, y: number }) => void;
    onwidgetclick?: (widget: GridWidget) => void;
    onwidgettrigger?: (widget: GridWidget, triggerType: ActionButtonTriggerType) => void;
    onwidgetdelete?: (widgetId: string) => void;
    onwidgetcontextmenu?: (widget: GridWidget, x: number, y: number) => void;
    onshellDrop?: (kind: ShellDropKind, path: string, cell: { x: number, y: number } | null) => void;
    onwidgetmove?: (widgetId: string, rect: { x: number, y: number, w: number, h: number }) => void;
  }

  let {
    cols = 5,
    rows = 3,
    widgets = [],
    background = '',
    spacing = 12,
    borderRadius = null,
    emptyCellStyle = 'visible',
    shadows = true,
    editMode = false,
    live = false,
    selectedWidgetId = null,
    busyCell = null,
    oncellclick,
    onwidgetclick,
    onwidgettrigger,
    onwidgetdelete,
    onwidgetcontextmenu,
    onshellDrop,
    onwidgetmove,
  }: Props = $props();

  let wrapperWidth = $state(0);
  let wrapperHeight = $state(0);

  // A stable stand-in for a widget with no data: a fresh `{}` per render is a
  // new prop value, which reopens every such tile's session on every repaint.
  const EMPTY_WIDGET_DATA: Record<string, unknown> = {};

  const outerMargin = 16;

  // Responsive cell dimensions. In test or headless environments where clientWidth/Height is 0,
  // fall back to reference dimension standards so elements remain positionable.
  const cellDimensions = $derived.by(() => {
    const availW = wrapperWidth > 0 ? wrapperWidth - 2 * outerMargin : cols * (120 + spacing);
    const availH = wrapperHeight > 0 ? wrapperHeight - 2 * outerMargin : rows * (120 + spacing);
    return computeCellDimensions(availW, availH, cols, rows, spacing);
  });

  const gridWidth = $derived(
    spanSize(cols, cellDimensions.cellWidth, cellDimensions.gap) + 2 * cellDimensions.padding,
  );
  const gridHeight = $derived(
    spanSize(rows, cellDimensions.cellHeight, cellDimensions.gap) + 2 * cellDimensions.padding,
  );
  const contentScale = $derived(
    contentScaleFor(cellDimensions.cellWidth, cellDimensions.cellHeight),
  );

  const radiusPx = $derived(
    borderRadius !== null ? `${borderRadius * contentScale}px` : `${22 * contentScale}px`,
  );

  const emptyCells = $derived(
    Array.from({ length: cols * rows }, (_, i) => {
      const x = i % cols;
      const y = Math.floor(i / cols);
      return { index: i, x, y };
    }),
  );

  function isCellBusy(x: number, y: number): boolean {
    return busyCell !== null && busyCell.x === x && busyCell.y === y;
  }

  // --- shell drops (a file dragged from the OS onto the grid) ---
  let gridContainer = $state<HTMLElement | undefined>(undefined);

  // Each live tile reports its rendered tree; a tree with an interactive
  // root (a button, a control) claims taps itself and the host executes the
  // action through the session, so the grid must not also fire one.
  let tileRoots = $state<Map<string, UiNode | null>>(new Map());

  function handleTileRoot(widgetId: string): (root: UiNode | null) => void {
    return (root) => {
      if (tileRoots.get(widgetId) !== root) {
        tileRoots.set(widgetId, root);
      }
    };
  }

  const DROP_KINDS: readonly ShellDropKind[] = ['application', 'iconPack', 'widgets'];

  function cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    if (gridContainer === undefined) return null;
    const bounds = gridContainer.getBoundingClientRect();
    return cellFromPoint(clientX - bounds.left, clientY - bounds.top, cellDimensions, cols, rows);
  }

  // An application needs an empty cell to land in; archives import wherever.
  function acceptDropAt(kind: ShellDropKind, at: { x: number, y: number }): boolean {
    if (kind === 'application') {
      const cell = cellAt(at.x, at.y);
      return cell !== null && !isCellOccupied(widgets, cell.x, cell.y);
    }
    return true;
  }

  function handleShellDrop(paths: Array<{ path: string; directory: boolean }>, at: { x: number, y: number }): void {
    for (const dropped of paths) {
      const kind = shellDropKind(dropped);
      if (kind === null) continue;
      onshellDrop?.(kind, dropped.path, kind === 'application' ? cellAt(at.x, at.y) : null);
    }
  }

  // The cell under the pointer while an application hovers, for the highlight.
  const dropCell = $derived.by(() => {
    if (gridContainer === undefined || shellFileDrop.activeTarget !== gridContainer) return null;
    if (shellFileDrop.hover === null) return null;
    const cell = cellAt(shellFileDrop.hover.x, shellFileDrop.hover.y);
    if (cell === null || isCellOccupied(widgets, cell.x, cell.y)) return null;
    return cell;
  });

  const dropHoverActive = $derived(gridContainer !== undefined && shellFileDrop.activeTarget === gridContainer);

  // --- edit-mode drag to move a tile ---
  let tileDrag = $state<TileDragState | null>(null);
  let suppressTileClick = false;

  function beginDrag(widget: GridWidget, event: PointerEvent): void {
    if (!editMode || gridContainer === undefined || event.button !== 0) return;
    event.stopPropagation();

    beginTileDrag(event, widget, gridContainer, {
      widgets,
      cols,
      rows,
      cellAt: (x, y) => cellFromPoint(x, y, cellDimensions, cols, rows),
      onmove: (id, rect) => onwidgetmove?.(id, rect),
      oncancel: () => undefined,
      onstate: state => {
        tileDrag = state;
        if (state !== null) {
          // The pointerup that ends a drag would otherwise click the tile
          // open. Cleared on a timer so a drag that ends off-grid cannot
          // eat the next genuine click.
          suppressTileClick = true;
          setTimeout(() => (suppressTileClick = false), 300);
        }
      },
    });
  }

  function handleCellClick(x: number, y: number): void {
    if (editMode && !isCellOccupied(widgets, x, y)) {
      oncellclick?.({ x, y });
    }
  }

  function handleWidgetClick(widget: GridWidget, event: MouseEvent): void {
    event.stopPropagation();
    if (suppressTileClick) {
      suppressTileClick = false;
      return;
    }
    if (editMode) {
      onwidgetclick?.(widget);
    } else if (!live) {
      // Non-live tiles (tests, session-less fallback) keep the direct path.
      onwidgettrigger?.(widget, 'onShortPress');
    }
    // Live tiles: the rendered tree owns the tap - its press pipeline emits
    // the lifecycle and trigger callbacks through ontrigger.
  }

  function handleWidgetKeyDown(widget: GridWidget, event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (editMode) {
        onwidgetclick?.(widget);
      } else if (!live) {
        // Non-live tiles keep the direct trigger; live tiles are focusable
        // themselves and activate through their own container.
        onwidgettrigger?.(widget, 'onShortPress');
      }
    }
  }
</script>

<div
  class="grid-wrapper"
  bind:clientWidth={wrapperWidth}
  bind:clientHeight={wrapperHeight}
  style:background={background || null}
  data-testid="deck-grid"
>
  <div
    class="grid-container"
    class:edit-mode={editMode}
    class:drop-active={dropHoverActive}
    bind:this={gridContainer}
    style:width="{gridWidth}px"
    style:height="{gridHeight}px"
    style:padding="{cellDimensions.padding}px"
    style:--widget-radius={radiusPx}
    style:--widget-scale={contentScale}
    style:--widget-shadow={shadows ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : 'none'}
    use:shellDropTarget={{ kinds: DROP_KINDS, acceptAt: acceptDropAt, onDrop: handleShellDrop }}
  >
    {#if tileDrag?.target}
      {@const ghostLeft = cellOffset(tileDrag.target.x, cellDimensions.cellWidth, cellDimensions.gap, cellDimensions.padding)}
      {@const ghostTop = cellOffset(tileDrag.target.y, cellDimensions.cellHeight, cellDimensions.gap, cellDimensions.padding)}
      {@const ghostWidth = spanSize(tileDrag.widget.w, cellDimensions.cellWidth, cellDimensions.gap)}
      {@const ghostHeight = spanSize(tileDrag.widget.h, cellDimensions.cellHeight, cellDimensions.gap)}
      <div
        class="drop-target-cell drag-ghost"
        style:left="{ghostLeft}px"
        style:top="{ghostTop}px"
        style:width="{ghostWidth}px"
        style:height="{ghostHeight}px"
      ></div>
    {/if}
    {#if dropCell !== null}
      {@const dropLeftPx = cellOffset(dropCell.x, cellDimensions.cellWidth, cellDimensions.gap, cellDimensions.padding)}
      {@const dropTopPx = cellOffset(dropCell.y, cellDimensions.cellHeight, cellDimensions.gap, cellDimensions.padding)}
      <div
        class="drop-target-cell"
        style:left="{dropLeftPx}px"
        style:top="{dropTopPx}px"
        style:width="{cellDimensions.cellWidth}px"
        style:height="{cellDimensions.cellHeight}px"
      ></div>
    {/if}

    {#each emptyCells as cell (cell.index)}
      {@const occupied = isCellOccupied(widgets, cell.x, cell.y)}
      {@const busy = isCellBusy(cell.x, cell.y)}
      {@const leftPx = cellOffset(cell.x, cellDimensions.cellWidth, cellDimensions.gap, cellDimensions.padding)}
      {@const topPx = cellOffset(cell.y, cellDimensions.cellHeight, cellDimensions.gap, cellDimensions.padding)}
      <button
        type="button"
        class="empty-cell"
        class:occupied
        class:edit-mode={editMode}
        class:transparent={emptyCellStyle === 'transparent'}
        style:left="{leftPx}px"
        style:top="{topPx}px"
        style:width="{cellDimensions.cellWidth}px"
        style:height="{cellDimensions.cellHeight}px"
        tabindex={editMode && !occupied ? 0 : -1}
        aria-label="Empty cell {cell.x}, {cell.y}"
        onclick={() => handleCellClick(cell.x, cell.y)}
      >
        {#if busy}
          <span class="cell-busy" role="status" aria-label="Creating widget">
            <span class="cell-spinner"></span>
          </span>
        {:else if editMode && !occupied}
          <!-- An empty cell in edit mode is the way in; without a mark it looks
               like background and nobody finds the add-widget picker. -->
          <span class="empty-cell-plus" aria-hidden="true">+</span>
        {/if}
      </button>
    {/each}

    {#each widgets as widget (widget.id)}
      {@const leftPx = cellOffset(widget.x, cellDimensions.cellWidth, cellDimensions.gap, cellDimensions.padding)}
      {@const topPx = cellOffset(widget.y, cellDimensions.cellHeight, cellDimensions.gap, cellDimensions.padding)}
      {@const widthPx = spanSize(widget.w, cellDimensions.cellWidth, cellDimensions.gap)}
      {@const heightPx = spanSize(widget.h, cellDimensions.cellHeight, cellDimensions.gap)}
      {@const widgetData = widget.data as Record<string, unknown> | undefined}
      {@const label = typeof widgetData?.label === 'string' ? widgetData.label : ''}
      {@const customBg = typeof widgetData?.backgroundColor === 'string' ? widgetData.backgroundColor : null}
      {@const customColor = typeof widgetData?.labelColor === 'string' ? widgetData.labelColor : null}
      {@const isSelected = selectedWidgetId === widget.id}

      <div
        class="widget"
        class:is-selected={isSelected}
        class:is-pinned={widget.isPinned}
        class:edit-mode={editMode}
        class:is-dragging={tileDrag?.widget.id === widget.id}
        style:left="{leftPx}px"
        style:top="{topPx}px"
        style:width="{widthPx}px"
        style:height="{heightPx}px"
        style:background={customBg || 'var(--color-bg-secondary)'}
        style:color={customColor || 'var(--color-text-primary)'}
        role="button"
        tabindex="0"
        aria-label={label || widget.type}
        data-widget-id={widget.id}
        onpointerdown={(e) => beginDrag(widget, e)}
        onclick={(e) => handleWidgetClick(widget, e)}
        onkeydown={(e) => handleWidgetKeyDown(widget, e)}
        oncontextmenu={(e) => {
          e.preventDefault();
          onwidgetcontextmenu?.(widget, e.clientX, e.clientY);
        }}
      >
        <!-- The live tile: the host composes the widget's tree and the runtime
             renders it, exactly what the phone shows. The label markup rides
             as the fallback for the moment before the tree arrives. -->
        {#if live}
          <div class="widget-live" class:widget-live-inert={editMode}>
            <WidgetPreview
              widgetId={widget.id}
              widgetType={widget.type}
              data={widgetData ?? EMPTY_WIDGET_DATA}
              width={widthPx}
              height={heightPx}
              variableScopeWidgetId={widget.id}
              onrootchange={handleTileRoot(widget.id)}
              ontrigger={triggerType => onwidgettrigger?.(widget, triggerType)}
              disabled={editMode}
            >
              <div class="widget-content">
                {#if label}
                  <span class="widget-label">{label}</span>
                {:else}
                  <span class="widget-type-badge">{widget.type}</span>
                {/if}
              </div>
            </WidgetPreview>
            {#if widget.isPinned}
              <span class="widget-pin-badge" title="Pinned widget">📌</span>
            {/if}
          </div>
        {:else}
          <div class="widget-content">
            {#if label}
              <span class="widget-label">{label}</span>
            {:else}
              <span class="widget-type-badge">{widget.type}</span>
            {/if}

            {#if widget.isPinned}
              <span class="widget-pin-badge" title="Pinned widget">📌</span>
            {/if}
          </div>
        {/if}

        {#if editMode && onwidgetdelete}
          <button
            type="button"
            class="widget-delete-btn"
            title="Delete widget"
            aria-label="Delete widget {label || widget.type}"
            onclick={(e) => {
              e.stopPropagation();
              onwidgetdelete(widget.id);
            }}
          >
            ✕
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .grid-wrapper {
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    background: var(--color-bg-primary);
    transition: background-color var(--transition-slow);
    overflow: hidden;
  }

  .grid-container {
    position: relative;
    box-sizing: border-box;
  }

  .grid-container.drop-active {
    outline: 2px dashed var(--color-accent);
    outline-offset: -6px;
    border-radius: var(--widget-radius, 22px);
  }

  .widget.is-dragging {
    opacity: 0.55;
    z-index: 6;
  }

  .drag-ghost {
    border-style: solid;
  }

  .drop-target-cell {
    position: absolute;
    border: 2px dashed var(--color-accent);
    border-radius: var(--widget-radius, 22px);
    background: var(--color-accent-muted, rgba(136, 192, 208, 0.15));
    pointer-events: none;
    z-index: 5;
  }

  .empty-cell {
    position: absolute;
    background-color: transparent;
    border-radius: var(--widget-radius, 22px);
    border: 1px solid var(--color-bg-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
  }

  .empty-cell.transparent {
    border-color: transparent;
  }

  .empty-cell.edit-mode {
    background-color: color-mix(in srgb, var(--color-text-primary) 2%, transparent);
    border-color: var(--color-border);
    cursor: pointer;
  }

  .empty-cell.occupied {
    background-color: transparent;
    border-color: transparent;
    cursor: default;
    pointer-events: none;
  }

  .empty-cell.edit-mode:not(.occupied):hover {
    background-color: var(--color-accent-muted);
    border-color: var(--color-accent);
  }

  .cell-busy {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-cell-plus {
    font-size: 1.5rem;
    line-height: 1;
    font-weight: 300;
    color: var(--color-text-muted);
    opacity: 0.7;
    user-select: none;
  }

  .empty-cell.edit-mode:not(.occupied):hover .empty-cell-plus {
    color: var(--color-accent);
    opacity: 1;
  }

  .cell-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: ds-spin 0.8s linear infinite;
  }

  .widget {
    position: absolute;
    border-radius: var(--widget-radius, 22px);
    box-shadow: var(--widget-shadow, 0 4px 6px -1px rgba(0, 0, 0, 0.3));
    overflow: hidden;
    cursor: pointer;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }

  .widget:active {
    transform: scale(0.96);
  }

  .widget.is-selected {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .widget-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    text-align: center;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  /*
   * The live tree fills the tile and receives the taps itself: a press on an
   * interactive node goes to the host through the tile's session, and the
   * grid's own click handler only fires for trees that claim nothing. Edit
   * mode inverts that - the tree goes inert so the tile-level click can
   * navigate to the editor.
   */
  .widget-live {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .widget-live.widget-live-inert {
    pointer-events: none;
  }

  .widget-live :global([data-node-type]) {
    max-width: 100%;
    max-height: 100%;
  }

  .widget-label {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .widget-type-badge {
    font-size: var(--text-xs);
    opacity: 0.75;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .widget-pin-badge {
    position: absolute;
    top: var(--space-1);
    left: var(--space-1);
    font-size: var(--text-xs);
  }

  .widget-delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    border-radius: 50%;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .widget:hover .widget-delete-btn {
    opacity: 1;
  }

  .widget-delete-btn:hover {
    background: var(--color-danger);
  }

  @keyframes ds-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
