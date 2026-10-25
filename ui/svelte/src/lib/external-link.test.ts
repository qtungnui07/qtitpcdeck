/*
 * Tests for opening a link outside the app.
 *
 * The interesting case is the shell bridge: when it is present the URL must go
 * through it, and when it is absent a new tab is the fallback.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternal, usesShell } from './external-link';

function installBridge(bridge: Record<string, unknown> | undefined): void {
  (window as { macroDeckShell?: unknown }).macroDeckShell = bridge;
}

afterEach(() => {
  installBridge(undefined);
  vi.restoreAllMocks();
});

describe('external link', () => {
  it('reports no shell in a plain browser', () => {
    expect(usesShell()).toBe(false);
  });

  it('reports a shell when the bridge can open a URL', () => {
    installBridge({ openExternal: async () => true });
    expect(usesShell()).toBe(true);
  });

  it('reports no shell when the bridge lacks openExternal', () => {
    installBridge({});
    expect(usesShell()).toBe(false);
  });

  it('opens a new tab when there is no shell', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);

    openExternal('https://example.com');

    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    vi.unstubAllGlobals();
  });

  it('routes through the shell when there is one', () => {
    const openExternalInShell = vi.fn(async () => true);
    installBridge({ openExternal: openExternalInShell });
    const open = vi.fn();
    vi.stubGlobal('open', open);

    openExternal('https://example.com');

    expect(openExternalInShell).toHaveBeenCalledWith('https://example.com');
    expect(open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('reports a rejected bridge call instead of falling back', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    installBridge({ openExternal: async () => { throw new Error('nope'); } });
    const open = vi.fn();
    vi.stubGlobal('open', open);

    openExternal('https://example.com');
    await vi.waitFor(() => {
      expect(error).toHaveBeenCalled();
    });
    expect(open).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('reports a bridge that throws synchronously', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    installBridge({
      openExternal: () => {
        throw new Error('nope');
      },
    });

    openExternal('https://example.com');

    expect(error).toHaveBeenCalled();
  });
});
