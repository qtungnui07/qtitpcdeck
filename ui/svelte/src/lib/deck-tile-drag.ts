/*
 * Drag-to-move for deck tiles, ported from the Angular grid's edit-mode
 * pointer pipeline in its single-tile-move role.
 *
 * A drag starts on a tile in edit mode, follows the pointer, and settles on
 * the cell under the pointer when the press releases. Only a whole-tile move
 * is supported: the tile keeps its span, the target cell must be inside the
 * grid and not overlap another widget, and the grid commits the rect through
 * the folder store. A moved tile that cannot land snaps back.
 */

import type { GridRect, GridWidget } from '@macro-deck/runtime';

export interface TileDragState {
  widget: GridWidget;
  /** Pointer position in grid-container coordinates. */
  x: number;
  y: number;
  /** The cell under the pointer, when it is a legal landing spot. */
  target: { x: number; y: number } | null;
}

export interface TileDragOptions {
  widgets: readonly GridWidget[];
  cols: number;
  rows: number;
  /** Cell from grid-container-local coordinates. */
  cellAt(x: number, y: number): { x: number; y: number } | null;
  /** Grid rect spans, for the overlap test (the dragged tile excluded). */
  onmove: (widgetId: string, rect: GridRect) => void;
  oncancel: () => void;
  onstate: (state: TileDragState | null) => void;
}

const DRAG_THRESHOLD_PX = 4;

export function beginTileDrag(
  event: PointerEvent,
  widget: GridWidget,
  container: HTMLElement,
  options: TileDragOptions,
): () => void {
  const startX = event.clientX;
  const startY = event.clientY;
  let started = false;

  const localPosition = (pointerEvent: PointerEvent): { x: number; y: number } => {
    const bounds = container.getBoundingClientRect();
    return { x: pointerEvent.clientX - bounds.left, y: pointerEvent.clientY - bounds.top };
  };

  const targetFor = (pointerEvent: PointerEvent): { x: number; y: number } | null => {
    const local = localPosition(pointerEvent);
    const cell = options.cellAt(local.x, local.y);
    if (cell === null) return null;
    if (cell.x + widget.w > options.cols || cell.y + widget.h > options.rows) return null;

    const overlaps = options.widgets.some(other =>
      other.id !== widget.id
      && cell.x < other.x + other.w
      && cell.x + widget.w > other.x
      && cell.y < other.y + other.h
      && cell.y + widget.h > other.y,
    );
    return overlaps ? null : cell;
  };

  const onPointerMove = (moveEvent: PointerEvent): void => {
    if (!started) {
      const moved = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (moved < DRAG_THRESHOLD_PX) return;
      started = true;
    }

    moveEvent.preventDefault();
    const local = localPosition(moveEvent);
    options.onstate({ widget, x: local.x, y: local.y, target: targetFor(moveEvent) });
  };

  const finish = (commit: boolean): void => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    options.onstate(null);

    if (!commit || !started) {
      if (started) options.oncancel();
      return;
    }

    const target = targetFor(lastPointer);
    if (target === null) {
      options.oncancel();
      return;
    }
    options.onmove(widget.id, { x: target.x, y: target.y, w: widget.w, h: widget.h });
  };

  let lastPointer = event;
  const onPointerUp = (upEvent: PointerEvent): void => {
    lastPointer = upEvent;
    finish(true);
  };
  const onPointerCancel = (): void => finish(false);

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  // The caller stops propagation; return an abort for unmount paths.
  return () => finish(false);
}
