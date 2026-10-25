import { render, fireEvent } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import TabBar, { type TabItem } from './TabBar.svelte';

describe('TabBar', () => {
  const sampleItems: TabItem[] = [
    { id: 'tab1', label: 'Overview' },
    { id: 'tab2', label: 'Actions', badge: 5 },
    { id: 'tab3', label: 'Variables', badge: 0 },
    { id: 'tab4', label: 'Alerts', dot: true },
    { id: 'tab5', label: 'Extra', removable: true },
  ];

  it('renders all tab items', () => {
    const { getByRole, getAllByRole } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab1',
    });

    const tablist = getByRole('tablist');
    expect(tablist).not.toBeNull();

    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs[0].textContent).toContain('Overview');
    expect(tabs[1].textContent).toContain('Actions');
  });

  it('marks active tab with proper attributes', () => {
    const { getAllByRole } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab2',
    });

    const tabs = getAllByRole('tab');
    expect(tabs[1].classList.contains('active')).toBe(true);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('tabindex')).toBe('0');

    expect(tabs[0].classList.contains('active')).toBe(false);
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[0].getAttribute('tabindex')).toBe('-1');
  });

  it('emits onchange when a different tab is clicked', async () => {
    const onchange = vi.fn();
    const { getAllByRole } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab1',
      onchange,
    });

    const tabs = getAllByRole('tab');
    await fireEvent.click(tabs[1]);
    expect(onchange).toHaveBeenCalledWith('tab2');
  });

  it('does not emit onchange when clicking the already active tab', async () => {
    const onchange = vi.fn();
    const { getAllByRole } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab1',
      onchange,
    });

    const tabs = getAllByRole('tab');
    await fireEvent.click(tabs[0]);
    expect(onchange).not.toHaveBeenCalled();
  });

  it('renders badge when non-zero and suppresses when zero', () => {
    const { container } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab1',
    });

    const badges = container.querySelectorAll('.tab-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('5');
  });

  it('renders dot indicator when enabled', () => {
    const { container } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab1',
    });

    const dots = container.querySelectorAll('.tab-dot');
    expect(dots).toHaveLength(1);
  });

  it('renders remove button for removable tabs and fires onremove', async () => {
    const onremove = vi.fn();
    const { container } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab1',
      onremove,
    });

    const removeBtn = container.querySelector('.tab-remove-btn');
    expect(removeBtn).not.toBeNull();

    await fireEvent.click(removeBtn!);
    expect(onremove).toHaveBeenCalledWith('tab5');
  });

  it('sets id and aria-controls when idPrefix is provided', () => {
    const { getAllByRole } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab1',
      idPrefix: 'detail',
    });

    const tabs = getAllByRole('tab');
    expect(tabs[0].id).toBe('detail-tab-tab1');
    expect(tabs[0].getAttribute('aria-controls')).toBe('detail-panel-tab1');
    expect(tabs[1].id).toBe('detail-tab-tab2');
    expect(tabs[1].getAttribute('aria-controls')).toBeNull();
  });

  it('handles keyboard navigation with arrow keys and home/end', async () => {
    const { getByRole, getAllByRole } = render(TabBar, {
      items: sampleItems,
      activeId: 'tab1',
    });

    const tablist = getByRole('tablist');
    const tabs = getAllByRole('tab');

    tabs[0].focus();
    expect(document.activeElement).toBe(tabs[0]);

    await fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);

    await fireEvent.keyDown(tablist, { key: 'End' });
    expect(document.activeElement).toBe(tabs[4]);

    await fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[0]);

    await fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[4]);

    await fireEvent.keyDown(tablist, { key: 'Home' });
    expect(document.activeElement).toBe(tabs[0]);
  });
});
