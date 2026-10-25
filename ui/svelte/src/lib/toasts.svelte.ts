/*
 * In-memory toast notifications.
 *
 * Toasts are transient feedback messages shown to the user (e.g. "Font imported",
 * "Failed to remove font"). They auto-dismiss after a duration unless dismissed
 * manually or configured with durationMs: 0.
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  detail?: string;
  variant: ToastVariant;
}

export interface ToastOptions {
  detail?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 5000;

let toasts = $state<Toast[]>([]);
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const toastStore = {
  get toasts(): readonly Toast[] {
    return toasts;
  },
  get count(): number {
    return toasts.length;
  },
};

export function showToast(message: string, options: ToastOptions = {}): number {
  const id = nextId++;
  const toast: Toast = {
    id,
    message,
    detail: options.detail,
    variant: options.variant ?? 'success',
  };
  toasts = [...toasts, toast];

  const duration = options.durationMs ?? DEFAULT_DURATION_MS;
  if (duration > 0) {
    timers.set(
      id,
      setTimeout(() => dismissToast(id), duration),
    );
  }
  return id;
}

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter(t => t.id !== id);
}

export function clearToasts(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
  toasts = [];
}

export function resetToastStore(): void {
  clearToasts();
  nextId = 1;
}
