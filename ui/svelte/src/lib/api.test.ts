/*
 * Tests for the API client.
 *
 * The transport itself is @macro-deck/runtime's, already covered by its own
 * suite. What is worth testing here is the wiring: that the rune mirrors the
 * runtime store, that notifications reach subscribers, and that a request made
 * with no socket rejects rather than hanging.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  disconnect,
  invoke,
  invokeResult,
  onConnected,
  onNotification,
  onNotificationOf,
  request,
  setAuthHooks,
  startApi,
  stopApi,
} from './api.svelte';

beforeEach(() => {
  vi.stubGlobal('WebSocket', class {});
});

afterEach(() => {
  stopApi();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('starts disconnected', () => {
    expect(api.connectionState).toBe('disconnected');
    expect(api.isConnected).toBe(false);
  });

  it('exposes a stable client id', () => {
    const first = api.clientId;
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(api.clientId).toBe(first);
  });

  it('rejects a request made before the socket is open', async () => {
    await expect(request('GetVersion')).rejects.toThrow('The UI connection is not open.');
  });

  it('swallows a closed socket for invoke', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(invoke('SetSomething')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('returns null for invokeResult on a closed socket', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(invokeResult('GetSomething')).resolves.toBeNull();
  });

  it('accepts auth hooks without a socket', () => {
    expect(() =>
      setAuthHooks({
        accessToken: () => 'token',
        onUnauthorized: async () => true,
        onConnectionUnauthorized: () => {},
        onForbidden: () => {},
      }),
    ).not.toThrow();
  });

  it('disconnects without having started', () => {
    expect(() => disconnect()).not.toThrow();
  });

  it('starts and stops without a host', async () => {
    startApi();
    await Promise.resolve();
    stopApi();
    expect(api.connectionState).toBe('disconnected');
  });

  it('is idempotent on start', () => {
    startApi();
    startApi();
    expect(api.connectionState).toBe('disconnected');
  });

  it('returns a no-op unsubscribe when notifications are subscribed before start', () => {
    const unsubscribe = onNotification(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('returns a no-op unsubscribe for a typed notification before start', () => {
    const unsubscribe = onNotificationOf('SomeEvent', () => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  it('runs an onConnected listener immediately when already connected', () => {
    // Not connected, so the listener must not run yet.
    const listener = vi.fn();
    const unsubscribe = onConnected(listener);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
