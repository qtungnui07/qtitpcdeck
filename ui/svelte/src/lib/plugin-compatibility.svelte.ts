/*
 * Plugin compatibility reports store.
 *
 * Tracks compatibility reports for installed plugins, reflecting findings,
 * severity tiers, and guidance. Automatically refreshes on socket notification.
 */

import { AppStrings, type PluginCompatibilityReport } from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { pluginCompatibilityEndpoints } from './endpoints';
import { translateKey } from './localization.svelte';

let reports = $state<PluginCompatibilityReport[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

let inFlightLoad: Promise<void> | null = null;
let unsubscribeNotification: (() => void) | null = null;

export const pluginCompatibilityStore = {
  get reports(): readonly PluginCompatibilityReport[] {
    return reports;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
};

export function forPlugin(pluginId: string): PluginCompatibilityReport | null {
  return reports.find(report => report.pluginId === pluginId) ?? null;
}

export function applyPluginCompatibilityBatch(items: PluginCompatibilityReport[]): void {
  reports = items;
}

export function loadPluginCompatibility(): Promise<void> {
  inFlightLoad ??= runLoad().finally(() => {
    inFlightLoad = null;
  });
  return inFlightLoad;
}

async function runLoad(): Promise<void> {
  isLoading = true;
  loadError = null;
  try {
    const response = await pluginCompatibilityEndpoints.get();
    reports = response.plugins ?? [];
  } catch (error) {
    console.error('Failed to load plugin compatibility state:', error);
    loadError =
      error instanceof Error
        ? error.message
        : translateKey(AppStrings.Errors.PluginCompatibility.LoadFailed);
  } finally {
    isLoading = false;
  }
}

export function startPluginCompatibility(): void {
  stopPluginCompatibility();
  unsubscribeNotification = onNotificationOf('PluginCompatibilityChangedEvent', () => {
    void loadPluginCompatibility();
  });
}

export function stopPluginCompatibility(): void {
  unsubscribeNotification?.();
  unsubscribeNotification = null;
}

export function resetPluginCompatibility(): void {
  stopPluginCompatibility();
  reports = [];
  isLoading = false;
  loadError = null;
  inFlightLoad = null;
}
