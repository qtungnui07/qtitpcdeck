/*
 * The notification list behind the sidebar badge, ported from the Angular
 * NotificationCenterService.
 *
 * The host drops its listeners while it restarts, so the initial fetch fails by
 * design there. Every caller fires and forgets, and the reconnect that follows
 * loads the list again - which is why the fetch swallows its error rather than
 * surfacing it.
 */

import type { UserNotification, UserNotificationsChangedEvent } from '@macro-deck/runtime';
import { onConnected, onNotificationOf } from './api.svelte';
import { notificationEndpoints } from './endpoints';

const MAX_BADGE_COUNT = 99;

/*
 * State is held in plain `$state` primitives, not in a wrapper object behind
 * getters. Svelte 5 tracks reads statically, so a getter that reads a rune is
 * not a dependency the compiler can see.
 */
let notifications = $state<UserNotification[]>([]);
let isLoading = $state(false);
let hasLoaded = $state(false);

let started = false;
let unsubscribes: Array<() => void> = [];
let loading: Promise<void> | null = null;
let generation = 0;

export const notificationCenter = {
  get notifications(): readonly UserNotification[] {
    return notifications;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get hasLoaded(): boolean {
    return hasLoaded;
  },
  get count(): number {
    return notifications.length;
  },
  get hasNotifications(): boolean {
    return notifications.length > 0;
  },
  get hasActiveProgress(): boolean {
    return notifications.some(notification => !!notification.progress);
  },
  get hasUnread(): boolean {
    return notifications.some(notification => notification.read === false);
  },
  get hasDismissable(): boolean {
    return notifications.some(notification => !notification.progress);
  },
  get badgeText(): string {
    const count = notifications.length;
    return count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : `${count}`;
  },
};

/**
 * Subscribes to the host and loads the list once the socket is up.
 *
 * Idempotent: the app calls it once at startup, and a second call is a no-op
 * rather than a second set of listeners.
 */
export function startNotificationCenter(): void {
  if (started) return;
  started = true;

  unsubscribes = [
    onNotificationOf<UserNotificationsChangedEvent>('UserNotificationsChangedEvent', event => {
      generation++;
      notifications = event.notifications ?? [];
    }),
    onConnected(() => {
      void load();
    }),
  ];
}

/**
 * Undoes startNotificationCenter: drops the listeners and forgets the list.
 *
 * The app never calls this - it exists so a test can exercise startup more than
 * once in a single module instance, which the `started` guard would otherwise
 * make impossible.
 */
export function stopNotificationCenter(): void {
  for (const unsubscribe of unsubscribes) unsubscribe();
  unsubscribes = [];
  started = false;
  notifications = [];
  isLoading = false;
  hasLoaded = false;
  loading = null;
  generation = 0;
}

export async function load(): Promise<void> {
  loading ??= fetchNotifications().finally(() => {
    loading = null;
  });
  return loading;
}

export function dismiss(id: string): void {
  void notificationEndpoints.dismiss(id);
}

export function dismissAll(): void {
  void notificationEndpoints.dismissAll();
}

export function markRead(id: string): void {
  setRead(notification => notification.id === id);
  void confirm(notificationEndpoints.markRead(id));
}

export function markAllRead(): void {
  setRead(() => true);
  void confirm(notificationEndpoints.markAllRead());
}

async function confirm(request: Promise<{ success: boolean }>): Promise<void> {
  try {
    if (!(await request).success) await load();
  } catch {
    await load();
  }
}

function setRead(matches: (notification: UserNotification) => boolean): void {
  generation++;
  notifications = notifications.map(notification =>
    notification.read === false && matches(notification) ? { ...notification, read: true } : notification);
}

async function fetchNotifications(): Promise<void> {
  isLoading = true;
  const gen = generation;
  try {
    const response = await notificationEndpoints.list();
    // A notification that arrived while this request was in flight is newer
    // than the response, so the response is dropped rather than overwriting it.
    if (gen === generation) {
      notifications = response?.notifications ?? [];
    }
    hasLoaded = true;
  } catch {
    // The host drops its listeners while it restarts, so this call fails by
    // design there. The reconnect that follows loads the list again.
  } finally {
    isLoading = false;
  }
}
