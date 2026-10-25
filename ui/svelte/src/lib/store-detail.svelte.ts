/*
 * Reactive loader for individual store extension details, issues, and similar items.
 */

import {
  AppStrings,
  type GetStoreRepositoryIssuesResponse,
  type StoreCatalogItemBody,
  type StoreExtensionDetailBody,
  type StoreExtensionKind,
} from '@macro-deck/runtime';
import { storeDetailEndpoints } from './endpoints';
import { translateKey } from './localization.svelte';

let currentDetail = $state<StoreExtensionDetailBody | null>(null);
let currentIssues = $state<GetStoreRepositoryIssuesResponse | null>(null);
let similarItems = $state<StoreCatalogItemBody[]>([]);
let isLoading = $state(false);
let loadError = $state<string | null>(null);

export const storeDetailStore = {
  get extension(): StoreExtensionDetailBody | null {
    return currentDetail;
  },
  get issues(): GetStoreRepositoryIssuesResponse | null {
    return currentIssues;
  },
  get similar(): readonly StoreCatalogItemBody[] {
    return similarItems;
  },
  get isLoading(): boolean {
    return isLoading;
  },
  get loadError(): string | null {
    return loadError;
  },
};

export async function loadStoreDetail(
  kind: StoreExtensionKind,
  packageId: string,
): Promise<StoreExtensionDetailBody | null> {
  isLoading = true;
  loadError = null;

  try {
    const response = await storeDetailEndpoints.get(kind, packageId);
    if (response.error || !response.extension) {
      loadError = response.error?.message ?? translateKey(AppStrings.Store.Error.PackageNotFound);
      currentDetail = null;
      return null;
    }
    currentDetail = response.extension;
    return response.extension;
  } catch (error) {
    loadError = error instanceof Error
      ? error.message
      : translateKey(AppStrings.Store.Error.PackageNotFound);
    currentDetail = null;
    return null;
  } finally {
    isLoading = false;
  }
}

export async function loadStoreIssues(
  kind: StoreExtensionKind,
  packageId: string,
): Promise<void> {
  try {
    const response = await storeDetailEndpoints.issues(kind, packageId);
    currentIssues = response;
  } catch (error) {
    console.error(`Failed to load issues for ${kind} ${packageId}:`, error);
  }
}

export async function loadStoreSimilar(
  kind: StoreExtensionKind,
  packageId: string,
  take = 6,
): Promise<void> {
  try {
    const response = await storeDetailEndpoints.similar(kind, packageId, take);
    similarItems = response.items ?? [];
  } catch (error) {
    console.error(`Failed to load similar items for ${kind} ${packageId}:`, error);
  }
}

export function setStoreDetailForTest(detail: StoreExtensionDetailBody | null): void {
  currentDetail = detail;
  isLoading = false;
  loadError = null;
}

export function resetStoreDetail(): void {
  currentDetail = null;
  currentIssues = null;
  similarItems = [];
  isLoading = false;
  loadError = null;
}
