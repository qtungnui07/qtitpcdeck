/*
 * Reactive store for active and completed store operations.
 *
 * Tracks installation, update, uninstallation, and download operations
 * across plugins and icon packs. Keeps live status via StoreOperationChangedEvent.
 */

import {
  AppStrings,
  type InstallStoreExtensionRequest,
  type StoreExtensionKind,
  type StoreOperationBody,
  type StoreOperationChangedEvent,
  type UninstallStoreExtensionRequest,
} from '@macro-deck/runtime';
import { onNotificationOf } from './api.svelte';
import { storeOperationEndpoints } from './endpoints';
import { translateKey } from './localization.svelte';
import { isTerminalStoreOperationState } from './store-display';

let operations = $state<StoreOperationBody[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

let unsubscribeOperationChanged: (() => void) | null = null;

export const storeOperationStore = {
  get operations(): readonly StoreOperationBody[] {
    return operations;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
  get activeOperations(): readonly StoreOperationBody[] {
    return operations.filter(op => !isTerminalStoreOperationState(op.state));
  },
  get hasActiveOperations(): boolean {
    return operations.some(op => !isTerminalStoreOperationState(op.state));
  },
  operationFor(kind: StoreExtensionKind, packageId: string): StoreOperationBody | null {
    const matches = operations.filter(
      op => op.extensionKind === kind && op.packageId === packageId,
    );
    if (matches.length === 0) return null;

    const active = matches.find(op => !isTerminalStoreOperationState(op.state));
    if (active) return active;

    return matches.reduce((latest, op) => (op.updatedAt > latest.updatedAt ? op : latest));
  },
  findActiveOperation(kind: StoreExtensionKind, packageId: string): StoreOperationBody | null {
    return operations.find(
      op => op.extensionKind === kind && op.packageId === packageId && !isTerminalStoreOperationState(op.state),
    ) ?? null;
  },
};

export const storeOperationsStore = storeOperationStore;

function upsertOperation(op: StoreOperationBody): void {
  const index = operations.findIndex(existing => existing.id === op.id);
  if (index >= 0) {
    operations = [
      ...operations.slice(0, index),
      op,
      ...operations.slice(index + 1),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } else {
    operations = [op, ...operations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export async function loadStoreOperations(): Promise<void> {
  isLoading = true;
  loadError = null;

  try {
    const response = await storeOperationEndpoints.list();
    operations = (response.operations ?? []).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  } catch (error) {
    loadError = error instanceof Error
      ? error.message
      : translateKey(AppStrings.Store.OperationFailed);
  } finally {
    isLoading = false;
  }
}

export async function installStoreExtension(
  kind: StoreExtensionKind,
  packageId: string,
  version?: string | null,
  allowUnsigned?: boolean,
): Promise<boolean> {
  try {
    const request: InstallStoreExtensionRequest = {
      kind,
      packageId,
      version: version ?? undefined,
      allowUnsigned,
    };
    const response = await storeOperationEndpoints.install(request);
    if (response.operation) {
      upsertOperation(response.operation);
    }
    return response.success ?? false;
  } catch (error) {
    console.error(`Failed to install ${kind} ${packageId}:`, error);
    return false;
  }
}

export async function uninstallStoreExtension(
  kind: StoreExtensionKind,
  id: string,
): Promise<boolean> {
  try {
    const request: UninstallStoreExtensionRequest = { kind, id };
    const response = await storeOperationEndpoints.uninstall(request);
    return response.success ?? false;
  } catch (error) {
    console.error(`Failed to uninstall ${kind} ${id}:`, error);
    return false;
  }
}

export async function retryStoreOperation(operationId: string): Promise<boolean> {
  try {
    const response = await storeOperationEndpoints.retry(operationId);
    if (response.operation) {
      upsertOperation(response.operation);
    }
    return response.success ?? false;
  } catch (error) {
    console.error(`Failed to retry operation ${operationId}:`, error);
    return false;
  }
}

export async function cancelStoreOperation(operationId: string): Promise<boolean> {
  try {
    const response = await storeOperationEndpoints.cancel(operationId);
    if (response.operation) {
      upsertOperation(response.operation);
    }
    return response.success ?? false;
  } catch (error) {
    console.error(`Failed to cancel operation ${operationId}:`, error);
    return false;
  }
}

export async function dismissStoreOperation(operationId: string): Promise<boolean> {
  operations = operations.filter(op => op.id !== operationId);
  try {
    const response = await storeOperationEndpoints.dismiss(operationId);
    return response.success ?? false;
  } catch (error) {
    console.error(`Failed to dismiss operation ${operationId}:`, error);
    return false;
  }
}

export function applyStoreOperationsBatch(batch: StoreOperationBody[]): void {
  operations = [...batch].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function startStoreOperations(): void {
  stopStoreOperations();

  unsubscribeOperationChanged = onNotificationOf<StoreOperationChangedEvent>(
    'StoreOperationChangedEvent',
    event => {
      if (event?.operation) {
        upsertOperation(event.operation);
      }
    },
  );
}

export function stopStoreOperations(): void {
  unsubscribeOperationChanged?.();
  unsubscribeOperationChanged = null;
}

export function resetStoreOperations(): void {
  stopStoreOperations();
  operations = [];
  isLoading = false;
  loadError = null;
}
