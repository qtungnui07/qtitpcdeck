/*
 * Reactive store for Store test builds.
 */

import {
  type InstallStoreTestBuildRequest,
  type StoreOperationBody,
  type StoreTestBody,
} from '@macro-deck/runtime';
import { storeTestsEndpoints } from './endpoints';

let tests = $state<StoreTestBody[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

export const storeTestsStore = {
  get tests(): readonly StoreTestBody[] {
    return tests;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
};

export async function loadStoreTests(): Promise<void> {
  isLoading = true;
  loadError = null;

  try {
    const res = await storeTestsEndpoints.list();
    if (res.success) {
      tests = res.tests ?? [];
    } else {
      loadError = res.error?.message ?? 'Failed to load store tests';
      tests = [];
    }
  } catch (error) {
    console.error('Failed to load store tests:', error);
    loadError = error instanceof Error ? error.message : String(error);
  } finally {
    isLoading = false;
  }
}

export async function installStoreTestBuild(
  packageId: string,
  buildId: string,
  consent: boolean = true,
): Promise<{ success: boolean; operation?: StoreOperationBody | null }> {
  try {
    const request: InstallStoreTestBuildRequest = { packageId, buildId, consent };
    const res = await storeTestsEndpoints.install(request);
    return { success: res.success ?? false, operation: res.operation };
  } catch (error) {
    console.error(`Failed to install test build ${packageId} ${buildId}:`, error);
    return { success: false };
  }
}

export function resetStoreTests(): void {
  tests = [];
  isLoading = false;
  loadError = null;
}
