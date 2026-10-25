import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcProfile } from '@macro-deck/runtime';
import { profileEndpoints } from './endpoints';
import {
  compareProfiles,
  createProfile,
  deleteProfile,
  duplicateProfile,
  loadProfiles,
  mapIpcProfile,
  moveProfile,
  profileStore,
  resetProfiles,
  selectProfile,
  startProfiles,
  stopProfiles,
  updateProfile,
} from './profiles.svelte';
import * as api from './api.svelte';

const SAMPLE_IPC_PROFILE: IpcProfile = {
  id: 'profile-1',
  name: 'Default Profile',
  order: 0,
  layoutType: 'Grid',
  isVirtual: false,
  layout: {
    rows: 3,
    columns: 5,
    rowsLocked: false,
    columnsLocked: false,
  },
  defaultRows: 3,
  defaultColumns: 5,
  defaultWidgetSpacing: 10,
  defaultWidgetBorderRadius: 8,
  defaultEmptyCellStyle: 'dashed',
  defaultWidgetShadows: true,
};

const SAMPLE_IPC_PROFILE_2: IpcProfile = {
  id: 'profile-2',
  name: 'Streaming Profile',
  order: 1,
  layoutType: 'Grid',
  isVirtual: false,
  layout: {
    rows: 4,
    columns: 6,
    rowsLocked: false,
    columnsLocked: false,
  },
  defaultRows: 4,
  defaultColumns: 6,
  defaultWidgetSpacing: 8,
  defaultWidgetBorderRadius: 4,
  defaultEmptyCellStyle: 'solid',
  defaultWidgetShadows: false,
};

describe('profileStore', () => {
  beforeEach(() => {
    resetProfiles();
  });

  afterEach(() => {
    resetProfiles();
    vi.restoreAllMocks();
  });

  it('initializes with empty state', () => {
    expect(profileStore.profiles).toEqual([]);
    expect(profileStore.sortedProfiles).toEqual([]);
    expect(profileStore.selectedProfileId).toBeNull();
    expect(profileStore.selectedProfile).toBeNull();
    expect(profileStore.isLoading).toBe(false);
    expect(profileStore.loadError).toBeNull();
  });

  it('loads profiles and auto-selects first sorted profile', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_IPC_PROFILE_2, SAMPLE_IPC_PROFILE],
    });

    await loadProfiles();

    expect(profileStore.profiles).toHaveLength(2);
    // SAMPLE_IPC_PROFILE has order 0, SAMPLE_IPC_PROFILE_2 has order 1
    expect(profileStore.sortedProfiles[0].id).toBe('profile-1');
    expect(profileStore.selectedProfileId).toBe('profile-1');
    expect(profileStore.selectedProfile?.name).toBe('Default Profile');
  });

  it('selects a specific profile', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_IPC_PROFILE, SAMPLE_IPC_PROFILE_2],
    });
    await loadProfiles();

    selectProfile('profile-2');
    expect(profileStore.selectedProfileId).toBe('profile-2');
    expect(profileStore.selectedProfile?.name).toBe('Streaming Profile');
  });

  it('handles load error gracefully', async () => {
    vi.spyOn(profileEndpoints, 'list').mockRejectedValue(new Error('Connection failed'));

    await loadProfiles();

    expect(profileStore.loadError).toBe('Connection failed');
    expect(profileStore.isLoading).toBe(false);
  });

  it('creates profile and selects it on success', async () => {
    vi.spyOn(profileEndpoints, 'create').mockResolvedValue({
      success: true,
      profile: {
        ...SAMPLE_IPC_PROFILE,
        id: 'new-profile',
        name: 'Gaming Profile',
      },
    });

    const result = await createProfile('Gaming Profile');

    expect(result.success).toBe(true);
    expect(profileStore.profiles).toHaveLength(1);
    expect(profileStore.selectedProfileId).toBe('new-profile');
  });

  it('updates profile in state on success', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_IPC_PROFILE],
    });
    await loadProfiles();

    vi.spyOn(profileEndpoints, 'update').mockResolvedValue({
      success: true,
      profile: {
        ...SAMPLE_IPC_PROFILE,
        name: 'Updated Default Name',
      },
    });

    const result = await updateProfile('profile-1', { name: 'Updated Default Name' });

    expect(result.success).toBe(true);
    expect(profileStore.selectedProfile?.name).toBe('Updated Default Name');
  });

  it('deletes profile and switches selection to remaining profile', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_IPC_PROFILE, SAMPLE_IPC_PROFILE_2],
    });
    await loadProfiles();
    selectProfile('profile-1');

    vi.spyOn(profileEndpoints, 'delete').mockResolvedValue({
      success: true,
    });

    const result = await deleteProfile('profile-1');

    expect(result.success).toBe(true);
    expect(profileStore.profiles).toHaveLength(1);
    expect(profileStore.selectedProfileId).toBe('profile-2');
  });

  it('reorders profiles correctly on moveProfile', async () => {
    vi.spyOn(profileEndpoints, 'list').mockResolvedValue({
      profiles: [SAMPLE_IPC_PROFILE, SAMPLE_IPC_PROFILE_2],
    });
    await loadProfiles();

    vi.spyOn(profileEndpoints, 'move').mockResolvedValue({
      success: true,
      profiles: [
        { id: 'profile-2', order: 0 },
        { id: 'profile-1', order: 1 },
      ],
    });

    const result = await moveProfile('profile-1', 'profile-2', 'after');

    expect(result.success).toBe(true);
    expect(profileStore.sortedProfiles[0].id).toBe('profile-2');
  });

  it('duplicates a profile', async () => {
    vi.spyOn(profileEndpoints, 'duplicate').mockResolvedValue({
      success: true,
      profile: {
        ...SAMPLE_IPC_PROFILE,
        id: 'dup-profile',
        name: 'Default Profile Copy',
      },
    });

    const result = await duplicateProfile('profile-1', 'Default Profile Copy');

    expect(result.success).toBe(true);
    expect(profileStore.selectedProfileId).toBe('dup-profile');
  });

  it('reacts to live socket events when started', () => {
    const listeners: Record<string, (event: any) => void> = {};
    vi.spyOn(api, 'onNotificationOf').mockImplementation((event: string, handler: any) => {
      listeners[event] = handler;
      return () => {
        delete listeners[event];
      };
    });

    startProfiles();

    expect(listeners['ProfileCreatedEvent']).toBeDefined();
    listeners['ProfileCreatedEvent']({ profile: SAMPLE_IPC_PROFILE });
    expect(profileStore.profiles).toHaveLength(1);

    listeners['ProfileUpdatedEvent']({
      profile: { ...SAMPLE_IPC_PROFILE, name: 'Live Renamed' },
    });
    expect(profileStore.profiles[0].name).toBe('Live Renamed');

    listeners['ProfileDeletedEvent']({ profileId: 'profile-1' });
    expect(profileStore.profiles).toHaveLength(0);

    stopProfiles();
  });

  it('sorts virtual profiles to the end', () => {
    const normal = mapIpcProfile(SAMPLE_IPC_PROFILE);
    const virtual = mapIpcProfile({
      ...SAMPLE_IPC_PROFILE_2,
      isVirtual: true,
      order: 0,
    });

    expect(compareProfiles(normal, virtual)).toBe(-1);
    expect(compareProfiles(virtual, normal)).toBe(1);
  });
});
