import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { GridWidget } from '@macro-deck/runtime';
import DeckGrid from './DeckGrid.svelte';

const SAMPLE_WIDGET: GridWidget = {
  id: 'w-1',
  folderId: 'folder-1',
  type: 'ActionButton',
  x: 1,
  y: 0,
  w: 1,
  h: 1,
  data: { label: 'Play Music', backgroundColor: '#224466', labelColor: '#ffffff' },
  isPinned: false,
};

describe('DeckGrid component', () => {
  it('renders correct number of empty cells based on cols and rows', () => {
    const { container } = render(DeckGrid, {
      props: {
        cols: 4,
        rows: 2,
        widgets: [],
      },
    });

    const emptyCells = container.querySelectorAll('.empty-cell');
    expect(emptyCells).toHaveLength(8);
  });

  it('marks occupied cells when widgets are placed', () => {
    const { container } = render(DeckGrid, {
      props: {
        cols: 3,
        rows: 2,
        widgets: [SAMPLE_WIDGET],
      },
    });

    const emptyCells = container.querySelectorAll('.empty-cell');
    // SAMPLE_WIDGET is at x=1, y=0 -> index 1
    expect(emptyCells[1].classList.contains('occupied')).toBe(true);
    expect(emptyCells[0].classList.contains('occupied')).toBe(false);
  });

  it('invokes oncellclick when clicking an unoccupied cell in edit mode', async () => {
    const oncellclick = vi.fn();
    const { container } = render(DeckGrid, {
      props: {
        cols: 3,
        rows: 2,
        editMode: true,
        widgets: [SAMPLE_WIDGET],
        oncellclick,
      },
    });

    const emptyCells = container.querySelectorAll('.empty-cell');
    await fireEvent.click(emptyCells[0]);

    expect(oncellclick).toHaveBeenCalledWith({ x: 0, y: 0 });

    // Clicking occupied cell should not call oncellclick
    await fireEvent.click(emptyCells[1]);
    expect(oncellclick).toHaveBeenCalledTimes(1);
  });

  it('does not invoke oncellclick when not in edit mode', async () => {
    const oncellclick = vi.fn();
    const { container } = render(DeckGrid, {
      props: {
        cols: 3,
        rows: 2,
        editMode: false,
        widgets: [],
        oncellclick,
      },
    });

    const emptyCells = container.querySelectorAll('.empty-cell');
    await fireEvent.click(emptyCells[0]);

    expect(oncellclick).not.toHaveBeenCalled();
  });

  it('renders placed widget with label and executes trigger in execution mode', async () => {
    const onwidgettrigger = vi.fn();
    const onwidgetclick = vi.fn();

    const { getByText, container } = render(DeckGrid, {
      props: {
        cols: 4,
        rows: 3,
        editMode: false,
        widgets: [SAMPLE_WIDGET],
        onwidgettrigger,
        onwidgetclick,
      },
    });

    expect(getByText('Play Music')).toBeDefined();

    const widgetEl = container.querySelector('[data-widget-id="w-1"]') as HTMLElement;
    expect(widgetEl).not.toBeNull();

    await fireEvent.click(widgetEl);
    expect(onwidgettrigger).toHaveBeenCalledWith(SAMPLE_WIDGET, 'onShortPress');
    expect(onwidgetclick).not.toHaveBeenCalled();
  });

  it('invokes onwidgetclick in edit mode and allows deletion', async () => {
    const onwidgettrigger = vi.fn();
    const onwidgetclick = vi.fn();
    const onwidgetdelete = vi.fn();

    const { container } = render(DeckGrid, {
      props: {
        cols: 4,
        rows: 3,
        editMode: true,
        widgets: [SAMPLE_WIDGET],
        onwidgettrigger,
        onwidgetclick,
        onwidgetdelete,
      },
    });

    const widgetEl = container.querySelector('[data-widget-id="w-1"]') as HTMLElement;
    await fireEvent.click(widgetEl);

    expect(onwidgetclick).toHaveBeenCalledWith(SAMPLE_WIDGET);
    expect(onwidgettrigger).not.toHaveBeenCalled();

    const deleteBtn = container.querySelector('.widget-delete-btn') as HTMLElement;
    expect(deleteBtn).not.toBeNull();

    await fireEvent.click(deleteBtn);
    expect(onwidgetdelete).toHaveBeenCalledWith('w-1');
  });

  it('handles widget keyboard interaction (Enter and Space)', async () => {
    const onwidgettrigger = vi.fn();

    const { container } = render(DeckGrid, {
      props: {
        cols: 4,
        rows: 3,
        editMode: false,
        widgets: [SAMPLE_WIDGET],
        onwidgettrigger,
      },
    });

    const widgetEl = container.querySelector('[data-widget-id="w-1"]') as HTMLElement;
    await fireEvent.keyDown(widgetEl, { key: 'Enter' });
    expect(onwidgettrigger).toHaveBeenCalledTimes(1);

    await fireEvent.keyDown(widgetEl, { key: ' ' });
    expect(onwidgettrigger).toHaveBeenCalledTimes(2);
  });

  it('renders busy spinner at specified cell coordinates', () => {
    const { container } = render(DeckGrid, {
      props: {
        cols: 3,
        rows: 2,
        widgets: [],
        busyCell: { x: 2, y: 1 },
      },
    });

    const busyIndicator = container.querySelector('.cell-busy');
    expect(busyIndicator).not.toBeNull();
    expect(busyIndicator?.getAttribute('aria-label')).toBe('Creating widget');
  });
});
