import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.svelte';

describe('EmptyState component', () => {
  it('renders heading, message, and icon', () => {
    const { container } = render(EmptyState, {
      props: {
        heading: 'No items found',
        message: 'Try adjusting your search filters.',
        icon: 'type',
      },
    });

    expect(container.querySelector('.es-title')?.textContent).toBe('No items found');
    expect(container.querySelector('.es-message')?.textContent).toBe('Try adjusting your search filters.');
    expect(container.querySelector('.icon-type')).not.toBeNull();
  });

  it('applies compact style when compact is true', () => {
    const { container } = render(EmptyState, {
      props: {
        heading: 'Empty',
        compact: true,
      },
    });

    expect(container.querySelector('.es-compact')).not.toBeNull();
  });
});
