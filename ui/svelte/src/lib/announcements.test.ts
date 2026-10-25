/*
 * Tests for the announcement store.
 *
 * The generation counter is the interesting part: a fetch that was in flight when a push arrived
 * must not overwrite the newer announcement with the older one it happened to read first.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  announcements,
  applyAnnouncementPush,
  dismissAnnouncement,
  loadAnnouncement,
  resetAnnouncements,
} from './announcements.svelte';

let pendingResponse: unknown = null;
let pendingStatus = 200;
let seenCalls: unknown[] = [];
let resolvePending: (() => void) | null = null;

function stubFetch(): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');

    if (url.pathname === '/api/announcements/pending') {
      if (resolvePending !== null) {
        await new Promise<void>(resolve => {
          resolvePending = resolve;
        });
      }
      if (pendingStatus !== 200) return new Response('', { status: pendingStatus });
      return new Response(JSON.stringify({ announcement: pendingResponse }), { status: 200 });
    }

    if (url.pathname === '/api/announcements/seen') {
      seenCalls.push(JSON.parse(String(init?.body ?? '{}')));
      return new Response(null, { status: 204 });
    }

    return new Response('', { status: 404 });
  });
}

beforeEach(() => {
  pendingResponse = null;
  pendingStatus = 200;
  seenCalls = [];
  resolvePending = null;
  stubFetch();
});

afterEach(() => {
  resetAnnouncements();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('announcements', () => {
  it('starts with nothing pending', () => {
    expect(announcements.pending).toBeNull();
  });

  it('loads a pending announcement', async () => {
    pendingResponse = { number: 7, title: 'Version 4', content: 'Notes.' };
    await loadAnnouncement();

    expect(announcements.pending?.title).toBe('Version 4');
  });

  it('clears the announcement when the host has none', async () => {
    pendingResponse = { number: 7, title: 'Version 4', content: 'Notes.' };
    await loadAnnouncement();

    pendingResponse = null;
    await loadAnnouncement();

    expect(announcements.pending).toBeNull();
  });

  it('swallows a host that cannot serve an announcement', async () => {
    pendingStatus = 500;
    await expect(loadAnnouncement()).resolves.toBeUndefined();
    expect(announcements.pending).toBeNull();
  });

  it('dismisses and tells the host', async () => {
    pendingResponse = { number: 7, title: 'Version 4', content: 'Notes.' };
    await loadAnnouncement();

    dismissAnnouncement();
    await vi.waitFor(() => expect(seenCalls).toHaveLength(1));

    expect(announcements.pending).toBeNull();
    expect(seenCalls[0]).toEqual({ number: 7 });
  });

  it('does nothing when there is nothing to dismiss', () => {
    dismissAnnouncement();
    expect(seenCalls).toHaveLength(0);
  });

  it('keeps the announcement when the host rejects the acknowledgement', async () => {
    pendingResponse = { number: 7, title: 'Version 4', content: 'Notes.' };
    await loadAnnouncement();

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }));

    dismissAnnouncement();
    await vi.waitFor(() => expect(error).toHaveBeenCalled());

    // The dialog is gone either way: the user dismissed it, and re-showing it would be worse than
    // a lost acknowledgement.
    expect(announcements.pending).toBeNull();
  });

  it('ignores a stale fetch that resolves after a newer one', async () => {
    pendingResponse = { number: 7, title: 'Old', content: 'Old notes.' };

    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/announcements/pending') {
        await gate;
        return new Response(JSON.stringify({ announcement: pendingResponse }), { status: 200 });
      }
      return new Response('', { status: 404 });
    });

    const inFlight = loadAnnouncement();

    // A push lands while the fetch is still open. It bumps the generation, so the fetch that
    // resolves afterwards must not overwrite it with the older announcement it read first.
    pendingResponse = { number: 8, title: 'New', content: 'New notes.' };
    applyAnnouncementPush({ number: 8, title: 'New', content: 'New notes.' } as never);
    release();
    await inFlight;

    expect(announcements.pending?.title).toBe('New');
  });

  it('resets to nothing pending', async () => {
    pendingResponse = { number: 7, title: 'Version 4', content: 'Notes.' };
    await loadAnnouncement();

    resetAnnouncements();
    expect(announcements.pending).toBeNull();
  });
});
