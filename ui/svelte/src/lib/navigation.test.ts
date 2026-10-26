/*
 * Tests for the nav model.
 *
 * The model is a getter rather than a constant because two of its fields come
 * from other stores: the notification badge and the activity ring. These tests
 * pin that wiring down, since a nav item that silently stops reading the
 * notification centre would look correct in every other test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigation, startNavigation, stopNavigation, toggleSidebar } from './navigation.svelte';
import { load, startNotificationCenter, stopNotificationCenter } from './notification-center.svelte';
import { startLocalization, stopLocalization } from './localization.svelte';

let list: unknown[] | null;

function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/notifications') {
      if (list === null) return new Response('', { status: 500 });
      return new Response(JSON.stringify({ notifications: list }), { status: 200 });
    }
    return new Response('', { status: 404 });
  });
}

function notificationsItem() {
  return navigation.bottomNavItems.find(item => item.id === 'notifications');
}

beforeEach(() => {
  list = [];
  localStorage.clear();
  stubFetch();
  vi.stubGlobal('WebSocket', class {});
  startLocalization();
  startNavigation();
  startNotificationCenter();
});

afterEach(() => {
  stopNotificationCenter();
  stopLocalization();
  stopNavigation();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('nav model', () => {
  it('carries no indicator when there are no notifications', () => {
    expect(notificationsItem()?.indicator).toBeNull();
  });

  it('carries no activity ring when nothing is running', () => {
    expect(notificationsItem()?.activity).toBe(false);
  });

  it('carries the badge count once notifications arrive', async () => {
    list = [{ id: 'n1', read: false }, { id: 'n2', read: false }];
    await load();

    expect(notificationsItem()?.indicator).toBe('2');
  });

  it('carries the activity ring while a notification reports progress', async () => {
    list = [{ id: 'n1', read: false, progress: 0.4 }];
    await load();

    expect(notificationsItem()?.activity).toBe(true);
  });

  it('shows both signals at once', async () => {
    list = [{ id: 'n1', read: false, progress: 0.4 }];
    await load();

    const item = notificationsItem();
    expect(item?.indicator).toBe('1');
    expect(item?.activity).toBe(true);
  });

  it('lists every main destination', () => {
    const ids = navigation.mainNavGroups.flat().map(item => item.id);
    // Library (icon packs, fonts) was removed: the deck imports packs by
    // dropping them on it, and nobody managed fonts here.
    expect(ids).toEqual([
      'deck', 'scripts', 'automations', 'variables', 'integrations', 'store',
    ]);
  });

  it('lists every bottom destination', () => {
    expect(navigation.bottomNavItems.map(item => item.id)).toEqual([
      'notifications', 'developer', 'settings',
    ]);
  });

  it('gives every route item a route and every action item an action', () => {
    const items = [...navigation.mainNavGroups.flat(), ...navigation.bottomNavItems];
    for (const item of items) {
      expect(item.route !== undefined || item.action !== undefined).toBe(true);
    }
  });

  it('starts expanded', () => {
    expect(navigation.isSidebarCollapsed).toBe(false);
  });

  it('collapses and persists on toggle', () => {
    toggleSidebar();
    expect(navigation.isSidebarCollapsed).toBe(true);
    expect(localStorage.getItem('md.sidebar.userCollapsed')).toBe('1');
  });

  it('restores a collapsed sidebar from storage', () => {
    stopNavigation();
    localStorage.setItem('md.sidebar.userCollapsed', '1');
    startNavigation();
    expect(navigation.isSidebarCollapsed).toBe(true);
  });

  it('formats a development build version', () => {
    expect(navigation.versionLabel).toBe('Loading…');
  });
});
