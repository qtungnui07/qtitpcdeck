/*
 * The pending announcement.
 *
 * An announcement is pushed over the socket when it changes and fetched once on connect, so the
 * generation counter matters: a fetch that was in flight when a push arrived must not overwrite the
 * newer announcement with the older one it happened to read first.
 */

import type { Announcement, AnnouncementChangedEvent } from '@macro-deck/runtime';
import { onConnected, onNotificationOf } from './api.svelte';
import { announcementEndpoints } from './endpoints';

let pending = $state<Announcement | null>(null);
let generation = 0;
let unsubscribeConnected: (() => void) | null = null;
let unsubscribeNotification: (() => void) | null = null;

export const announcements = {
  get pending() {
    return pending;
  },
};

export async function loadAnnouncement(): Promise<void> {
  const seen = generation;
  try {
    const response = await announcementEndpoints.pending();
    if (seen === generation) {
      pending = response.announcement ?? null;
    }
  } catch {
    // An announcement is a nicety; a host that cannot serve one is not an error worth surfacing.
  }
}

/*
 * Applies an announcement pushed by the host.
 *
 * Exported rather than inlined into the socket subscription so the ordering rule can be tested
 * without a socket: a push always wins over a fetch that was already in flight.
 */
export function applyAnnouncementPush(announcement: Announcement | null): void {
  generation += 1;
  pending = announcement;
}

export function dismissAnnouncement(): void {  const announcement = pending;
  if (!announcement) return;

  generation += 1;
  pending = null;
  announcementEndpoints.markSeen({ number: announcement.number }).catch((error: unknown) => {
    console.error('Could not mark the announcement as seen', error);
  });
}

export function startAnnouncements(): void {
  stopAnnouncements();

  unsubscribeNotification = onNotificationOf<AnnouncementChangedEvent>(
    'AnnouncementChangedEvent',
    event => applyAnnouncementPush(event.announcement ?? null),
  );

  unsubscribeConnected = onConnected(() => {
    void loadAnnouncement();
  });
}

export function stopAnnouncements(): void {
  unsubscribeNotification?.();
  unsubscribeNotification = null;
  unsubscribeConnected?.();
  unsubscribeConnected = null;
}

export function resetAnnouncements(): void {
  stopAnnouncements();
  pending = null;
  generation = 0;
}
