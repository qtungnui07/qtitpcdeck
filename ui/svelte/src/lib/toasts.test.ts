import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearToasts,
  dismissToast,
  resetToastStore,
  showToast,
  toastStore,
} from './toasts.svelte';

describe('toasts store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetToastStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with an empty toast list', () => {
    expect(toastStore.toasts).toEqual([]);
    expect(toastStore.count).toBe(0);
  });

  it('adds a toast with default success variant and auto-increments id', () => {
    const id1 = showToast('First message');
    const id2 = showToast('Second message', { variant: 'error', detail: 'More details' });

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(toastStore.count).toBe(2);
    expect(toastStore.toasts[0]).toEqual({
      id: 1,
      message: 'First message',
      detail: undefined,
      variant: 'success',
    });
    expect(toastStore.toasts[1]).toEqual({
      id: 2,
      message: 'Second message',
      detail: 'More details',
      variant: 'error',
    });
  });

  it('auto-dismisses a toast after default duration (5000ms)', () => {
    showToast('Auto dismiss');
    expect(toastStore.count).toBe(1);

    vi.advanceTimersByTime(4999);
    expect(toastStore.count).toBe(1);

    vi.advanceTimersByTime(1);
    expect(toastStore.count).toBe(0);
  });

  it('respects custom durationMs', () => {
    showToast('Custom duration', { durationMs: 2000 });
    expect(toastStore.count).toBe(1);

    vi.advanceTimersByTime(1999);
    expect(toastStore.count).toBe(1);

    vi.advanceTimersByTime(1);
    expect(toastStore.count).toBe(0);
  });

  it('does not auto-dismiss when durationMs is 0', () => {
    showToast('Persistent', { durationMs: 0 });
    expect(toastStore.count).toBe(1);

    vi.advanceTimersByTime(60_000);
    expect(toastStore.count).toBe(1);
  });

  it('dismisses a toast manually', () => {
    const id = showToast('To dismiss');
    expect(toastStore.count).toBe(1);

    dismissToast(id);
    expect(toastStore.count).toBe(0);
  });

  it('clears all toasts and timers', () => {
    showToast('One');
    showToast('Two');
    showToast('Three');
    expect(toastStore.count).toBe(3);

    clearToasts();
    expect(toastStore.count).toBe(0);
  });
});
