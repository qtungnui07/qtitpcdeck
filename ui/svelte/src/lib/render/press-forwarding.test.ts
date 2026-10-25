import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { UiNode } from '@macro-deck/runtime';
import UiRenderSurface from './UiRenderSurface.svelte';

/*
 * The tile press path: a host tree whose root declares the press events must
 * forward them through the surface's event bus when the pointer goes down and
 * up on it. This is the wire between the runtime renderer and the session
 * (which sends the event to the host); a break here is a tile that looks alive
 * and does nothing when pressed.
 */
describe('UiRenderSurface press forwarding', () => {
  it('forwards pressStart and press from a button tree', async () => {
    const onevent = vi.fn();
    const tree: UiNode = {
      id: 'btn',
      type: 'ui.button',
      properties: { events: ['press-start', 'press', 'press-end'] },
    };

    const { container } = render(UiRenderSurface, { root: tree, onevent });

    const button = container.querySelector('.ui-widget-node [data-node-id="btn"]');
    expect(button).not.toBeNull();

    await fireEvent.pointerDown(button as Element, { clientX: 10, clientY: 10, pointerId: 1, button: 0 });
    await fireEvent.pointerUp(button as Element, { clientX: 10, clientY: 10, pointerId: 1, button: 0 });

    const names = onevent.mock.calls.map(call => (call[0] as { name: string }).name);
    expect(names).toContain('press-start');
    expect(names).toContain('press');
  });
});
