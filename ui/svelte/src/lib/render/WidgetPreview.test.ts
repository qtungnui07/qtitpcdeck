import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiNode } from '@macro-deck/runtime';
import { startLocalization } from '$lib/localization.svelte';

vi.mock('$lib/ui-session.svelte', async () => {
  const { fakeSession } = await import('./fake-session.svelte');
  return { openUiSession: () => fakeSession };
});

import WidgetPreview from './WidgetPreview.svelte';
import { fakeSession, resetFakeSession } from './fake-session.svelte';

/*
 * A tile is painted from a host session, and that tree never exists at the
 * moment the session opens - it arrives over the socket afterwards. Reading
 * the handle's root once at mount (the bug this test holds shut) leaves every
 * tile on its fallback label: no icon, and no press handler to run an action.
 */
describe('WidgetPreview', () => {
  beforeEach(() => {
    startLocalization();
    resetFakeSession();
  });

  it('renders the tree once the session delivers it', async () => {
    const tree: UiNode = {
      id: 'btn',
      type: 'ui.button',
      properties: { events: ['press'] },
    };

    const { container } = render(WidgetPreview, {
      widgetId: 'w1',
      widgetType: 'ActionButton',
      data: {},
      width: 120,
      height: 120,
    });

    expect(container.querySelector('[data-node-id]')).toBeNull();

    fakeSession.root = tree;
    await tick();

    expect(container.querySelector('[data-node-id="btn"]')).not.toBeNull();
  });

  it('drops the tree when the session is replaced', async () => {
    const { container } = render(WidgetPreview, {
      widgetId: 'w2',
      widgetType: 'ActionButton',
      data: {},
      width: 120,
      height: 120,
    });

    fakeSession.root = { id: 'one', type: 'ui.text' };
    await tick();
    expect(container.querySelector('[data-node-id="one"]')).not.toBeNull();

    fakeSession.root = null;
    await tick();
    expect(container.querySelector('[data-node-id]')).toBeNull();
  });
});
