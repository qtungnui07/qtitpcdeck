import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SegmentedControl from './SegmentedControl.svelte';

describe('SegmentedControl', () => {
  const options = [
    { value: 'tab1', label: 'First Tab' },
    { value: 'tab2', label: 'Second Tab' },
    { value: 'tab3', label: 'Third Tab', badge: '5' },
  ];

  it('renders all options and highlights the active one', () => {
    const { getByRole, getAllByRole } = render(SegmentedControl, {
      options,
      value: 'tab1',
      tablist: true,
      ariaLabel: 'Navigation Tabs',
    });

    const tablist = getByRole('tablist');
    expect(tablist.getAttribute('aria-label')).toBe('Navigation Tabs');

    const tabs = getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(tabs[0].textContent).toContain('First Tab');
    expect(tabs[2].textContent).toContain('5');
  });

  it('invokes onchange when clicking a different option', async () => {
    const onchange = vi.fn();
    const { getAllByRole } = render(SegmentedControl, {
      options,
      value: 'tab1',
      tablist: true,
      onchange,
    });

    const tabs = getAllByRole('tab');
    await fireEvent.click(tabs[1]);

    expect(onchange).toHaveBeenCalledWith('tab2');
  });

  it('does not invoke onchange when clicking the already active option', async () => {
    const onchange = vi.fn();
    const { getAllByRole } = render(SegmentedControl, {
      options,
      value: 'tab1',
      tablist: true,
      onchange,
    });

    const tabs = getAllByRole('tab');
    await fireEvent.click(tabs[0]);

    expect(onchange).not.toHaveBeenCalled();
  });

  it('navigates with keyboard arrows when tablist is true', async () => {
    const onchange = vi.fn();
    const { getByRole } = render(SegmentedControl, {
      options,
      value: 'tab1',
      tablist: true,
      onchange,
    });

    const tablist = getByRole('tablist');
    await fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onchange).toHaveBeenCalledWith('tab2');

    await fireEvent.keyDown(tablist, { key: 'End' });
    expect(onchange).toHaveBeenCalledWith('tab3');
  });
});
