/*
 * Vitest setup.
 *
 * Three things the jsdom environment does not give us on Node 26:
 *
 * 1. `localStorage`. Node 26 defines a global `localStorage` of its own that
 *    throws unless the process was started with --localstorage-file, and that
 *    global shadows the one jsdom installs on the window. The specs and the theme
 *    store both read the bare global, so it is replaced here with a real
 *    in-memory Storage.
 *
 * 2. `matchMedia`. jsdom has never implemented it, and the theme store reads it
 *    at startup to follow the system preference.
 *
 * 3. `ResizeObserver`. jsdom has never implemented it either, and the shell uses
 *    one to collapse the sidebar when the window gets narrow.
 *
 * All three are installed on globalThis rather than on window because that is
 * where the code under test looks for them.
 */

class MemoryStorage implements Storage {
  #entries = new Map<string, string>();

  get length(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
  }

  getItem(key: string): string | null {
    return this.#entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#entries.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

if (typeof globalThis.matchMedia !== 'function') {
  Object.defineProperty(globalThis, 'matchMedia', {
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
    configurable: true,
    writable: true,
  });
}

/*
 * The shell only ever observes, so a no-op observer is enough: the callback is
 * never invoked, which leaves the sidebar in its unconstrained state - the same
 * state a wide window produces.
 */
if (typeof globalThis.ResizeObserver !== 'function') {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
    configurable: true,
    writable: true,
  });
}
