import { render, fireEvent, act } from '@testing-library/svelte';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import DetailPage from './DetailPage.svelte';

describe('DetailPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders back button with default label and header content', () => {
    const { container } = render(DetailPage);
    const backBtn = container.querySelector('.dp-back');
    expect(backBtn).not.toBeNull();
    expect(backBtn?.getAttribute('aria-label')).toBeTruthy();
  });

  it('uses custom backLabel if provided', () => {
    const { container } = render(DetailPage, {
      backLabel: 'Back to Integrations',
    });
    const backBtn = container.querySelector('.dp-back');
    expect(backBtn?.getAttribute('aria-label')).toBe('Back to Integrations');
  });

  it('triggers leaving animation when back button is clicked and emits close on animationend', async () => {
    const onclose = vi.fn();
    const { container } = render(DetailPage, { onclose });

    const backBtn = container.querySelector('.dp-back')!;
    const surface = container.querySelector('.dp-surface')!;

    await fireEvent.click(backBtn);
    expect(surface.classList.contains('dp-leaving')).toBe(true);

    expect(onclose).not.toHaveBeenCalled();

    // Simulate animationend
    await fireEvent.animationEnd(surface);
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('fires close on fallback timer if animationend never arrives', async () => {
    const onclose = vi.fn();
    const { container } = render(DetailPage, { onclose });

    const backBtn = container.querySelector('.dp-back')!;
    await fireEvent.click(backBtn);

    expect(onclose).not.toHaveBeenCalled();

    // Fast-forward past CLOSE_FALLBACK_MS (600ms)
    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(onclose).toHaveBeenCalledTimes(1);
  });
});
