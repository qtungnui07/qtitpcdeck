import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import UiRenderSurface from './UiRenderSurface.svelte';

describe('UiRenderSurface', () => {
  it('mounts with a null root without an update loop', () => {
    const { container } = render(UiRenderSurface, { root: null });
    expect(container).toBeDefined();
  });

  it('mounts with a trivial tree without an update loop', () => {
    const { container } = render(UiRenderSurface, {
      root: { id: 'root', type: 'ui.config.stack', children: [] },
      onevent: () => undefined,
    });
    expect(container).toBeDefined();
  });
});
