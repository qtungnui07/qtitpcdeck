/*
 * Reactive store for available extension updates.
 *
 * Checks for and tracks updates to installed plugins and icon packs.
 * Listens for live StoreUpdatesChangedEvent.
 */

import type {
  StoreAvailableUpdateBody,
  StoreUpdatesChangedEvent,
} from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { storeUpdatesEndpoints } from './endpoints';
import { loadStoreOperations } from './store-operations.svelte';

let updates = $state<StoreAvailableUpdateBody[]>([]);
let isLoading = $state(false);
let installing = $state(false);
let loadError = $state<string | null>(null);

let unsubscribeUpdatesChanged: (() => void) | null = null;

export const storeUpdatesStore = {
  get updates(): readonly StoreAvailableUpdateBody[] {
    return updates;
  },
  get count(): number {
    return updates.length;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get installing(): boolean {
    return installing;
  },
  get loadError(): string | null {
    return loadError;
  },
};

export async function loadStoreUpdates(): Promise<void> {
  isLoading = true;
  loadError = null;

  try {
    const response = await storeUpdatesEndpoints.list();
    updates = response.updates ?? [];
  } catch (error) {
    console.error('Failed to load store updates:', error);
    loadError = error instanceof Error ? error.message : String(error);
  } finally {
    isLoading = false;
  }
}

export async function checkStoreUpdates(): Promise<void> {
  isLoading = true;
  loadError = null;

  try {
    const response = await storeUpdatesEndpoints.check();
    updates = response.updates ?? [];
  } catch (error) {
    console.error('Failed to check store updates:', error);
    loadError = error instanceof Error ? error.message : String(error);
  } finally {
    isLoading = false;
  }
}

export async function installAllStoreUpdates(): Promise<boolean> {
  if (installing) return false;

  installing = true;
  try {
    await storeUpdatesEndpoints.installAll();
    await loadStoreOperations();
    return true;
  } catch (error) {
    console.error('Failed to install all store updates:', error);
    return false;
  } finally {
    installing = false;
  }
}

export function applyStoreUpdatesBatch(batch: StoreAvailableUpdateBody[]): void {
  updates = [...batch];
}

export function startStoreUpdates(): void {
  stopStoreUpdates();

  unsubscribeUpdatesChanged = onNotificationOf<StoreUpdatesChangedEvent>(
    'StoreUpdatesChangedEvent',
    event => {
      updates = event?.updates ?? [];
    },
  );
}

export function stopStoreUpdates(): void {
  unsubscribeUpdatesChanged?.();
  unsubscribeUpdatesChanged = null;
}

export function resetStoreUpdates(): void {
  stopStoreUpdates();
  updates = [];
  isLoading = false;
  installing = false;
  loadError = null;
}
