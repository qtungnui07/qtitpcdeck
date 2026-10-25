/*
 * The profile store.
 *
 * Keeps the collection of user profiles (layouts, grid dimension defaults,
 * appearance configs). Subscribes to profile socket notifications to stay in sync.
 */

import {
  AppStrings,
  emptyCellStyleFromWire,
  type IpcProfile,
  type IpcProfilePlacement,
  type Profile,
  type ProfileCreatedEvent,
  type ProfileDeletedEvent,
  type ProfilesReorderedEvent,
  type ProfileUpdatedEvent,
  type Result,
} from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { profileEndpoints } from './endpoints';
import { translateKey } from './localization.svelte';

export type ProfileMovePosition = 'before' | 'after';

export function compareProfiles(a: Profile, b: Profile): number {
  if (a.isVirtual !== b.isVirtual) {
    return a.isVirtual ? 1 : -1;
  }
  if (a.order !== b.order) {
    return a.order - b.order;
  }
  const left = a.name.toUpperCase();
  const right = b.name.toUpperCase();
  if (left !== right) {
    return left < right ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function mapIpcProfile(ipc: IpcProfile): Profile {
  return {
    id: ipc.id,
    name: ipc.name,
    order: ipc.order,
    layoutType: ipc.layoutType,
    isVirtual: ipc.isVirtual,
    sourceIntegrationId: ipc.sourceIntegrationId,
    layout: {
      rows: ipc.layout.rows,
      columns: ipc.layout.columns,
      rowsLocked: ipc.layout.rowsLocked,
      columnsLocked: ipc.layout.columnsLocked,
      constraint: ipc.layout.constraint,
      compatibility: ipc.layout.compatibility,
    },
    defaultRows: ipc.defaultRows,
    defaultColumns: ipc.defaultColumns,
    defaultBackground:
      ipc.defaultBackgroundColor === 'rgba(18, 18, 18, 0.6)'
        ? null
        : (ipc.defaultBackgroundColor ?? null),
    ...(ipc.defaultBackgroundColorSource
      ? { defaultBackgroundSource: ipc.defaultBackgroundColorSource }
      : {}),
    defaultSpacing: ipc.defaultWidgetSpacing ?? null,
    defaultBorderRadius: ipc.defaultWidgetBorderRadius ?? null,
    defaultEmptyCellStyle: emptyCellStyleFromWire(ipc.defaultEmptyCellStyle),
    defaultShadows: ipc.defaultWidgetShadows ?? null,
  };
}

let profiles = $state<Profile[]>([]);
let selectedProfileId = $state<string | null>(null);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

let unsubscribeCreated: (() => void) | null = null;
let unsubscribeUpdated: (() => void) | null = null;
let unsubscribeReordered: (() => void) | null = null;
let unsubscribeDeleted: (() => void) | null = null;

function applyPlacements(placements: IpcProfilePlacement[]): void {
  if (placements.length === 0) {
    return;
  }
  const orders = new Map(placements.map(placement => [placement.id, placement.order]));
  profiles = profiles.map(profile => {
    const order = orders.get(profile.id);
    return order === undefined || order === profile.order ? profile : { ...profile, order };
  });
}

function removeFromState(id: string): void {
  profiles = profiles.filter(p => p.id !== id);
  if (selectedProfileId === id) {
    const sorted = [...profiles].sort(compareProfiles);
    selectedProfileId = sorted.length > 0 ? sorted[0].id : null;
  }
}

export const profileStore = {
  get profiles(): readonly Profile[] {
    return profiles;
  },
  get sortedProfiles(): readonly Profile[] {
    return [...profiles].sort(compareProfiles);
  },
  get selectedProfileId(): string | null {
    return selectedProfileId;
  },
  get selectedProfile(): Profile | null {
    return profiles.find(p => p.id === selectedProfileId) ?? null;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
  get isCurrentProfileLocked(): boolean {
    const p = profiles.find(item => item.id === selectedProfileId);
    return !!p && (p.isVirtual || p.layout.rowsLocked || p.layout.columnsLocked);
  },
};

export function selectProfile(id: string): void {
  if (selectedProfileId !== id) {
    selectedProfileId = id;
  }
}

export async function loadProfiles(preferredProfileId?: string | null): Promise<void> {
  isLoading = true;
  loadError = null;

  try {
    const response = await profileEndpoints.list();
    const loaded = (response.profiles ?? []).map(mapIpcProfile);
    profiles = loaded;

    const sorted = [...loaded].sort(compareProfiles);
    if ((!selectedProfileId || !loaded.some(p => p.id === selectedProfileId)) && sorted.length > 0) {
      const preferred =
        preferredProfileId && loaded.some(p => p.id === preferredProfileId)
          ? preferredProfileId
          : sorted[0].id;
      selectedProfileId = preferred;
    }
  } catch (error) {
    console.error('Failed to load profiles:', error);
    loadError =
      error instanceof Error
        ? error.message
        : translateKey(AppStrings.Errors.Profile.LoadFailed);
  } finally {
    isLoading = false;
  }
}

export async function createProfile(
  name: string,
  defaults?: {
    defaultRows?: number;
    defaultColumns?: number;
    defaultBackgroundColor?: string;
    defaultWidgetSpacing?: number;
    defaultWidgetBorderRadius?: number;
    defaultEmptyCellStyle?: string;
    defaultWidgetShadows?: boolean;
  },
): Promise<Result<Profile>> {
  try {
    const response = await profileEndpoints.create({ name, ...defaults });
    if (!response.success) {
      return { success: false, error: response.error };
    }
    if (!response.profile) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: translateKey(AppStrings.Errors.Profile.NoProfileReturned),
        },
      };
    }

    const profile = mapIpcProfile(response.profile);
    profiles = profiles.some(p => p.id === profile.id) ? profiles : [...profiles, profile];
    selectedProfileId = profile.id;
    return { success: true, data: profile };
  } catch (error) {
    console.error('Failed to create profile:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          error instanceof Error
            ? error.message
            : translateKey(AppStrings.Errors.Profile.CreateFailed),
      },
    };
  }
}

export async function updateProfile(
  id: string,
  updates: {
    name?: string;
    order?: number;
    defaultRows?: number;
    defaultColumns?: number;
    defaultBackgroundColor?: string;
    defaultBackgroundColorSource?: string;
    defaultWidgetSpacing?: number;
    defaultWidgetBorderRadius?: number;
    defaultEmptyCellStyle?: string;
    defaultWidgetShadows?: boolean;
  },
): Promise<Result<Profile>> {
  try {
    const response = await profileEndpoints.update({ id, ...updates });
    if (!response.success) {
      return { success: false, error: response.error };
    }
    if (response.profile) {
      const profile = mapIpcProfile(response.profile);
      profiles = profiles.map(p => (p.id === profile.id ? profile : p));
      return { success: true, data: profile };
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to update profile:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          error instanceof Error
            ? error.message
            : translateKey(AppStrings.Errors.Profile.UpdateFailed),
      },
    };
  }
}

export async function moveProfile(
  id: string,
  targetId: string,
  position: ProfileMovePosition,
): Promise<Result> {
  const previous = profiles;
  const ordered = [...profiles].sort(compareProfiles).filter(p => !p.isVirtual);
  const moving = ordered.find(p => p.id === id);
  if (!moving || id === targetId || !ordered.some(p => p.id === targetId)) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: translateKey(AppStrings.Errors.Profile.MoveFailed),
      },
    };
  }

  const reordered = ordered.filter(p => p.id !== id);
  const targetIndex = reordered.findIndex(p => p.id === targetId);
  reordered.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, moving);
  applyPlacements(reordered.map((profile, order) => ({ id: profile.id, order })));

  try {
    const response = await profileEndpoints.move(id, { targetId, position });
    if (!response.success) {
      profiles = previous;
      return { success: false, error: response.error };
    }
    applyPlacements(response.profiles ?? []);
    return { success: true };
  } catch (error) {
    console.error('Failed to move profile:', error);
    profiles = previous;
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          error instanceof Error
            ? error.message
            : translateKey(AppStrings.Errors.Profile.MoveFailed),
      },
    };
  }
}

export async function deleteProfile(id: string): Promise<Result> {
  try {
    const response = await profileEndpoints.delete(id);
    if (!response.success) {
      return { success: false, error: response.error };
    }
    removeFromState(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete profile:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          error instanceof Error
            ? error.message
            : translateKey(AppStrings.Errors.Profile.DeleteFailed),
      },
    };
  }
}

export async function duplicateProfile(id: string, name: string): Promise<Result<Profile>> {
  try {
    const response = await profileEndpoints.duplicate(id, name);
    if (!response.success) {
      return { success: false, error: response.error };
    }
    if (!response.profile) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: translateKey(AppStrings.Errors.Profile.NoProfileReturned),
        },
      };
    }

    const profile = mapIpcProfile(response.profile);
    profiles = profiles.some(p => p.id === profile.id) ? profiles : [...profiles, profile];
    selectedProfileId = profile.id;
    return { success: true, data: profile };
  } catch (error) {
    console.error('Failed to duplicate profile:', error);
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          error instanceof Error
            ? error.message
            : translateKey(AppStrings.Errors.Profile.DuplicateFailed),
      },
    };
  }
}

export function startProfiles(): void {
  stopProfiles();

  unsubscribeCreated = onNotificationOf<ProfileCreatedEvent>('ProfileCreatedEvent', event => {
    if (event.profile) {
      const profile = mapIpcProfile(event.profile);
      profiles = profiles.some(p => p.id === profile.id) ? profiles : [...profiles, profile];
    }
  });

  unsubscribeUpdated = onNotificationOf<ProfileUpdatedEvent>('ProfileUpdatedEvent', event => {
    if (event.profile) {
      const updated = mapIpcProfile(event.profile);
      profiles = profiles.map(p => (p.id === updated.id ? updated : p));
    }
  });

  unsubscribeReordered = onNotificationOf<ProfilesReorderedEvent>(
    'ProfilesReorderedEvent',
    event => {
      applyPlacements(event.profiles ?? []);
    },
  );

  unsubscribeDeleted = onNotificationOf<ProfileDeletedEvent>('ProfileDeletedEvent', event => {
    if (event.profileId) {
      removeFromState(event.profileId);
    }
  });
}

export function stopProfiles(): void {
  unsubscribeCreated?.();
  unsubscribeCreated = null;
  unsubscribeUpdated?.();
  unsubscribeUpdated = null;
  unsubscribeReordered?.();
  unsubscribeReordered = null;
  unsubscribeDeleted?.();
  unsubscribeDeleted = null;
}

export function resetProfiles(): void {
  stopProfiles();
  profiles = [];
  selectedProfileId = null;
  isLoading = false;
  loadError = null;
}
