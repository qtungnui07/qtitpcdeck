/*
 * Tests for the notification centre.
 *
 * The badge is the visible part, so the derived counts are what matter: a
 * notification with progress is not dismissable, an unread one drives the
 * activity ring, and the badge caps at 99+.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dismiss,
  dismissAll,
  load,
  markAllRead,
  markRead,
  notificationCenter,
  startNotificationCenter,
  stopNotificationCenter,
} from './notification-center.svelte';

let list: unknown[] | null;
let calls: Array<{ method: string; path: string }>;

function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, path: url.pathname });

    if (url.pathname === '/api/notifications' && method === 'GET') {
      if (list === null) return new Response('', { status: 500 });
      return new Response(JSON.stringify({ notifications: list }), { status: 200 });
    }

    if (url.pathname === '/api/notifications' && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }

    if (url.pathname.startsWith('/api/notifications/') && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }

    if (method === 'PUT') {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response('', { status: 404 });
  });
}

function notification(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'n1', read: false, ...overrides };
}

beforeEach(() => {
  list = [];
  calls = [];
  stubFetch();
  vi.stubGlobal('WebSocket', class {});
});

afterEach(() => {
  stopNotificationCenter();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('notification centre', () => {
  it('starts empty', () => {
    expect(notificationCenter.count).toBe(0);
    expect(notificationCenter.hasNotifications).toBe(false);
    expect(notificationCenter.hasLoaded).toBe(false);
  });

  it('loads the list from the host', async () => {
    list = [notification(), notification({ id: 'n2' })];
    await load();

    expect(notificationCenter.count).toBe(2);
    expect(notificationCenter.hasLoaded).toBe(true);
  });

  it('survives a host that refuses the list', async () => {
    list = null;
    await expect(load()).resolves.toBeUndefined();
    expect(notificationCenter.count).toBe(0);
  });

  it('caps the badge at 99+', async () => {
    list = Array.from({ length: 120 }, (_, index) => notification({ id: `n${index}` }));
    await load();

    expect(notificationCenter.badgeText).toBe('99+');
  });

  it('shows the exact count below the cap', async () => {
    list = [notification(), notification({ id: 'n2' })];
    await load();

    expect(notificationCenter.badgeText).toBe('2');
  });

  it('reports unread notifications', async () => {
    list = [notification({ read: true }), notification({ id: 'n2', read: false })];
    await load();

    expect(notificationCenter.hasUnread).toBe(true);
  });

  it('reports no unread when every notification is read', async () => {
    list = [notification({ read: true })];
    await load();

    expect(notificationCenter.hasUnread).toBe(false);
  });

  it('reports active progress', async () => {
    list = [notification({ progress: 0.5 })];
    await load();

    expect(notificationCenter.hasActiveProgress).toBe(true);
  });

  it('treats a notification with progress as not dismissable', async () => {
    list = [notification({ progress: 0.5 })];
    await load();

    expect(notificationCenter.hasDismissable).toBe(false);
  });

  it('treats a notification without progress as dismissable', async () => {
    list = [notification()];
    await load();

    expect(notificationCenter.hasDismissable).toBe(true);
  });

  it('marks one notification read optimistically', async () => {
    list = [notification({ id: 'n1' }), notification({ id: 'n2' })];
    await load();

    markRead('n1');

    expect(notificationCenter.notifications[0].read).toBe(true);
    expect(notificationCenter.notifications[1].read).toBe(false);
  });

  it('marks every notification read', async () => {
    list = [notification({ id: 'n1' }), notification({ id: 'n2' })];
    await load();

    markAllRead();

    expect(notificationCenter.hasUnread).toBe(false);
  });

  it('reloads when the host refuses a mark-read', async () => {
    list = [notification()];
    await load();

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PUT') {
        return new Response(JSON.stringify({ success: false }), { status: 200 });
      }
      if (url.pathname === '/api/notifications' && method === 'GET') {
        return new Response(JSON.stringify({ notifications: [notification({ read: true })] }), { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    markRead('n1');
    await vi.waitFor(() => {
      expect(notificationCenter.hasUnread).toBe(false);
    });
  });

  it('dismisses one notification through the host', async () => {
    list = [notification()];
    await load();

    dismiss('n1');
    await vi.waitFor(() => {
      expect(calls.some(call => call.method === 'DELETE' && call.path === '/api/notifications/n1')).toBe(true);
    });
  });

  it('dismisses every notification through the host', async () => {
    list = [notification()];
    await load();

    dismissAll();
    await vi.waitFor(() => {
      expect(calls.some(call => call.method === 'DELETE' && call.path === '/api/notifications')).toBe(true);
    });
  });

  it('escapes an id in the dismiss path', async () => {
    list = [notification()];
    await load();

    dismiss('a/b');
    await vi.waitFor(() => {
      expect(calls.some(call => call.path === '/api/notifications/a%2Fb')).toBe(true);
    });
  });

  it('is idempotent on start', () => {
    startNotificationCenter();
    startNotificationCenter();
    expect(notificationCenter.count).toBe(0);
  });

  it('stops cleanly without having started', () => {
    expect(() => stopNotificationCenter()).not.toThrow();
  });
});
