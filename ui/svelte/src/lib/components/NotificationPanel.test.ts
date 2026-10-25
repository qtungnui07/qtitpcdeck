import { fireEvent, render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStrings, type UserNotification } from '@macro-deck/runtime';
import { startLocalization, translateKey } from '$lib/localization.svelte';

const state = vi.hoisted(() => ({ items: [] as UserNotification[] }));

vi.mock('$lib/notification-center.svelte', () => ({
  notificationCenter: {
    get notifications() { return state.items; },
    get hasUnread() { return state.items.some(notification => notification.read === false); },
    get hasDismissable() { return state.items.some(notification => !notification.progress); },
  },
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

import NotificationPanel from './NotificationPanel.svelte';
import { dismiss, markAllRead } from '$lib/notification-center.svelte';

function notification(overrides: Partial<UserNotification> = {}): UserNotification {
  return {
    id: 'n1',
    sequence: 1,
    timestamp: new Date().toISOString(),
    severity: 'Warning',
    kind: 'Update',
    title: 'Could not check for updates',
    message: 'The stable feed is unreachable.',
    action: { kind: 'OpenUpdateSettings' },
    read: false,
    ...overrides,
  };
}

describe('NotificationPanel', () => {
  beforeEach(() => {
    startLocalization();
    state.items = [notification()];
    vi.mocked(dismiss).mockClear();
    vi.mocked(markAllRead).mockClear();
  });

  it('shows the host\'s notification with its action', () => {
    const { getByText } = render(NotificationPanel, { open: true });

    expect(getByText(translateKey(AppStrings.Nav.Notifications))).toBeDefined();
    expect(getByText('Could not check for updates')).toBeDefined();
    expect(getByText(translateKey(AppStrings.Shell.Notifications.Action.OpenUpdateSettings))).toBeDefined();
  });

  it('leaves out an action this client cannot carry out', () => {
    state.items = [notification({ action: { kind: 'InstallUpdate' } })];
    const { queryByText } = render(NotificationPanel, { open: true });

    expect(queryByText(translateKey(AppStrings.Shell.Notifications.Action.InstallUpdate))).toBeNull();
  });

  it('dismisses a notification through the store', async () => {
    const { getByLabelText } = render(NotificationPanel, { open: true });

    await fireEvent.click(getByLabelText(translateKey(AppStrings.Shell.Notifications.Dismiss)));

    expect(dismiss).toHaveBeenCalledWith('n1');
  });

  it('offers mark-all-read only while something is unread', () => {
    const unread = render(NotificationPanel, { open: true });
    expect(unread.getByText(translateKey(AppStrings.Shell.Notifications.MarkAllRead))).toBeDefined();
    unread.unmount();

    state.items = [notification({ read: true })];
    const read = render(NotificationPanel, { open: true });
    expect(read.queryByText(translateKey(AppStrings.Shell.Notifications.MarkAllRead))).toBeNull();
  });

  it('shows the empty state when the host has nothing to report', () => {
    state.items = [];
    const { getByText } = render(NotificationPanel, { open: true });

    expect(getByText(translateKey(AppStrings.Shell.Notifications.EmptyHeading))).toBeDefined();
  });
});
